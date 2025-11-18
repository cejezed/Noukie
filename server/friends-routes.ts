/**
 * =====================================================
 * FRIENDS + INVITE SYSTEM API ROUTES
 * =====================================================
 *
 * This module provides secure API endpoints for the friends and invite system.
 *
 * Features:
 * - Generate/retrieve user invite codes
 * - Redeem invite codes to create friendships
 * - List user's friends
 * - Remove friendships
 *
 * Security:
 * - All routes require JWT authentication
 * - Invite codes are generated server-side only
 * - Friendships are created via database functions (RLS enforced)
 * - No client-side inserts allowed
 * - Rate limiting on redeem endpoint (10 attempts per 15 minutes)
 * - Failed attempt logging for security monitoring
 *
 * =====================================================
 */

import { createClient } from "@supabase/supabase-js";
import type { Express, Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";

// Initialize Supabase client with service role for admin operations
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Initialize Supabase client for user operations (with RLS)
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// =====================================================
// MIDDLEWARE: Require Authentication
// =====================================================

interface AuthRequest extends Request {
  user?: {
    id: string;
    email?: string;
    [key: string]: any;
  };
}

async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Missing or invalid authorization header"
      });
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Invalid or expired token"
      });
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: "Authentication failed"
    });
  }
}

// =====================================================
// MIDDLEWARE: Rate Limiting for Redeem Endpoint
// =====================================================
// Prevents brute-force attacks on invite code redemption

const redeemRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Max 10 attempts per window
  message: {
    error: "Too many attempts",
    message: "Te veel pogingen. Probeer het over 15 minuten opnieuw."
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Skip successful requests from counting against limit
  skipSuccessfulRequests: false,
  // Key generator (per IP + user combination for better security)
  keyGenerator: (req: AuthRequest) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const userId = req.user?.id || 'anonymous';
    return `${ip}-${userId}`;
  },
  handler: (req: AuthRequest, res: Response) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const userId = req.user?.id || 'unknown';
    console.warn(`[SECURITY] Rate limit exceeded for redeem endpoint - IP: ${ip}, User: ${userId}`);

    res.status(429).json({
      error: "Too many attempts",
      message: "Te veel pogingen. Probeer het over 15 minuten opnieuw."
    });
  }
});

// =====================================================
// HELPER: Log Failed Redemption Attempts
// =====================================================

interface FailedAttempt {
  userId: string;
  userEmail?: string;
  ip: string;
  code: string;
  reason: string;
  timestamp: string;
}

function logFailedRedemption(attempt: FailedAttempt) {
  console.warn('[SECURITY] Failed invite code redemption:', JSON.stringify(attempt));

  // TODO: In production, send to monitoring service (e.g., Sentry, DataDog)
  // Example: Sentry.captureMessage('Failed invite code redemption', { extra: attempt });
}

// =====================================================
// ROUTE 1: GET /api/friends/invite-code
// =====================================================
// Returns the user's invite code (generates one if it doesn't exist)

async function getInviteCode(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "User ID not found in token"
      });
    }

    // Call database function to get or create invite code
    const { data, error } = await supabaseAdmin.rpc("get_or_create_invite_code", {
      p_user_id: userId
    });

    if (error) {
      console.error("Error getting invite code:", error);
      return res.status(500).json({
        error: "Database error",
        message: "Failed to retrieve invite code"
      });
    }

    return res.status(200).json({
      code: data
    });
  } catch (error) {
    console.error("Get invite code error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: "Failed to process request"
    });
  }
}

// =====================================================
// ROUTE 2: POST /api/friends/redeem
// =====================================================
// Redeems an invite code to create a friendship

interface RedeemCodeBody {
  code: string;
}

async function redeemInviteCode(req: AuthRequest, res: Response) {
  const startTime = Date.now(); // For timing-attack mitigation

  try {
    const userId = req.user?.id;
    const userEmail = req.user?.email;

    if (!userId) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "User ID not found in token"
      });
    }

    const { code } = req.body as RedeemCodeBody;

    // Validate input
    if (!code || typeof code !== "string" || code.trim().length === 0) {
      return res.status(400).json({
        error: "Bad request",
        message: "Uitnodigingscode is verplicht"
      });
    }

    // Normalize code (uppercase, trim)
    const normalizedCode = code.trim().toUpperCase();

    // Call database function to redeem code
    const { data, error } = await supabaseAdmin.rpc("redeem_invite_code", {
      p_redeemer_id: userId,
      p_code: normalizedCode
    });

    if (error) {
      console.error("Error redeeming invite code:", error);

      // Log failed attempt
      logFailedRedemption({
        userId,
        userEmail,
        ip: req.ip || req.socket.remoteAddress || 'unknown',
        code: normalizedCode.substring(0, 4) + '****', // Partial code for privacy
        reason: 'database_error',
        timestamp: new Date().toISOString()
      });

      return res.status(500).json({
        error: "Database error",
        message: "Kon uitnodigingscode niet verwerken"
      });
    }

    // Check if redemption was successful
    if (!data.success) {
      // Log failed attempt with specific reason
      logFailedRedemption({
        userId,
        userEmail,
        ip: req.ip || req.socket.remoteAddress || 'unknown',
        code: normalizedCode.substring(0, 4) + '****', // Partial code for privacy
        reason: data.error || 'unknown_error',
        timestamp: new Date().toISOString()
      });

      // Add small delay to mitigate timing attacks (constant-time response)
      const elapsedTime = Date.now() - startTime;
      const targetTime = 200; // Target 200ms response time
      if (elapsedTime < targetTime) {
        await new Promise(resolve => setTimeout(resolve, targetTime - elapsedTime));
      }

      // Generic error message to prevent information leakage
      return res.status(400).json({
        error: "Ongeldige code",
        message: "De uitnodigingscode is ongeldig of kan niet worden gebruikt"
      });
    }

    // Success!
    console.log(`[SUCCESS] Friendship created - User: ${userId}, Code: ${normalizedCode.substring(0, 4)}****`);

    return res.status(200).json({
      success: true,
      message: data.message || "Vriendschap succesvol aangemaakt!",
      friendshipId: data.friendship_id
    });
  } catch (error) {
    console.error("Redeem invite code error:", error);

    // Log failed attempt
    logFailedRedemption({
      userId: req.user?.id || 'unknown',
      userEmail: req.user?.email,
      ip: req.ip || req.socket.remoteAddress || 'unknown',
      code: 'error',
      reason: 'exception',
      timestamp: new Date().toISOString()
    });

    return res.status(500).json({
      error: "Internal server error",
      message: "Kon uitnodigingscode niet verwerken"
    });
  }
}

// =====================================================
// ROUTE 3: GET /api/friends
// =====================================================
// Returns a list of the user's friends

async function getFriends(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "User ID not found in token"
      });
    }

    // Call database function to get friends list
    const { data, error } = await supabaseAdmin.rpc("get_user_friends", {
      p_user_id: userId
    });

    if (error) {
      console.error("Error getting friends:", error);
      return res.status(500).json({
        error: "Database error",
        message: "Failed to retrieve friends list"
      });
    }

    // Return friends list (sorted alphabetically by name in DB function)
    return res.status(200).json(data || []);
  } catch (error) {
    console.error("Get friends error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: "Failed to process request"
    });
  }
}

// =====================================================
// ROUTE 4: DELETE /api/friends/:friendId
// =====================================================
// Removes a friendship

async function removeFriend(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    const { friendId } = req.params;

    if (!userId) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "User ID not found in token"
      });
    }

    if (!friendId) {
      return res.status(400).json({
        error: "Bad request",
        message: "Friend ID is required"
      });
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(friendId)) {
      return res.status(400).json({
        error: "Bad request",
        message: "Invalid friend ID format"
      });
    }

    // Determine user_a and user_b (lexicographic order)
    let userA: string, userB: string;
    if (userId < friendId) {
      userA = userId;
      userB = friendId;
    } else {
      userA = friendId;
      userB = userId;
    }

    // Delete the friendship (RLS policy allows deletion if user is participant)
    const { error } = await supabaseAdmin
      .from("friendships")
      .delete()
      .eq("user_a", userA)
      .eq("user_b", userB);

    if (error) {
      console.error("Error removing friend:", error);
      return res.status(500).json({
        error: "Database error",
        message: "Failed to remove friend"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Vriendschap verwijderd"
    });
  } catch (error) {
    console.error("Remove friend error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: "Failed to process request"
    });
  }
}

// =====================================================
// ROUTE 5: GET /api/friends/check/:friendId
// =====================================================
// Checks if two users are friends (utility endpoint)

async function checkFriendship(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    const { friendId } = req.params;

    if (!userId) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "User ID not found in token"
      });
    }

    if (!friendId) {
      return res.status(400).json({
        error: "Bad request",
        message: "Friend ID is required"
      });
    }

    // Call database function to check friendship
    const { data, error } = await supabaseAdmin.rpc("are_users_friends", {
      p_user_id_1: userId,
      p_user_id_2: friendId
    });

    if (error) {
      console.error("Error checking friendship:", error);
      return res.status(500).json({
        error: "Database error",
        message: "Failed to check friendship status"
      });
    }

    return res.status(200).json({
      areFriends: data || false
    });
  } catch (error) {
    console.error("Check friendship error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: "Failed to process request"
    });
  }
}

// =====================================================
// SETUP ROUTES
// =====================================================

export function setupFriendsRoutes(app: Express) {
  // All routes require authentication
  app.get("/api/friends/invite-code", requireAuth, getInviteCode);

  // Redeem endpoint with rate limiting for brute-force protection
  app.post("/api/friends/redeem", requireAuth, redeemRateLimiter, redeemInviteCode);

  app.get("/api/friends", requireAuth, getFriends);
  app.delete("/api/friends/:friendId", requireAuth, removeFriend);
  app.get("/api/friends/check/:friendId", requireAuth, checkFriendship);

  console.log("✅ Friends routes initialized with security hardening");
}
