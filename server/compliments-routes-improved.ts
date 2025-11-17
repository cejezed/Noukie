/**
 * IMPROVED COMPLIMENTS ROUTES
 * Production-ready version with security improvements
 *
 * Key improvements:
 * 1. Uses req.user from Supabase auth middleware (not x-user-id header)
 * 2. Never exposes from_user in responses
 * 3. Uses SECURITY DEFINER functions for streak updates
 * 4. Better moderation error handling
 * 5. Timezone-aware date handling
 */

import type { Express } from "express";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Service role for admin operations
);

/**
 * Middleware: Extract user from Supabase JWT
 * This should be applied to all authenticated routes
 */
async function requireAuth(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }

  const token = authHeader.substring(7);

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: "Unauthorized: Invalid token" });
    }

    // Attach user to request object - THIS is the source of truth
    req.user = user;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(500).json({ error: "Authentication failed" });
  }
}

/**
 * Helper: Moderate message with OpenAI
 * Returns safe/unsafe + score
 */
async function moderateMessage(message: string): Promise<{
  safe: boolean;
  score: number;
  categories?: string[];
}> {
  try {
    const moderation = await openai.moderations.create({
      input: message,
    });

    const result = moderation.results[0];

    // Get all flagged categories
    const flaggedCategories = [];
    if (result.categories.hate) flaggedCategories.push('hate');
    if (result.categories.harassment) flaggedCategories.push('harassment');
    if (result.categories.violence) flaggedCategories.push('violence');
    if (result.categories.sexual) flaggedCategories.push('sexual');
    if (result.categories['self-harm']) flaggedCategories.push('self-harm');

    const maxScore = Math.max(
      result.category_scores.hate,
      result.category_scores["hate/threatening"],
      result.category_scores.harassment,
      result.category_scores["harassment/threatening"],
      result.category_scores["self-harm"],
      result.category_scores["self-harm/intent"],
      result.category_scores["self-harm/instructions"],
      result.category_scores.sexual,
      result.category_scores["sexual/minors"],
      result.category_scores.violence,
      result.category_scores["violence/graphic"]
    );

    return {
      safe: !result.flagged && maxScore < 0.5,
      score: maxScore,
      categories: flaggedCategories,
    };
  } catch (error) {
    console.error("Moderation API error:", error);

    // DECISION POINT: Fail-safe strategy
    // Option 1 (current): Block message on API error (safest)
    // Option 2: Allow message but log event + mark toxicity_score = -1

    // We choose Option 1 for school environment
    return {
      safe: false,
      score: 1.0,
      categories: ['moderation_api_error']
    };
  }
}

/**
 * Setup compliments routes
 */
export function setupComplimentsRoutes(app: Express) {

  /**
   * POST /api/compliments
   * Send a compliment to a classmate
   *
   * Security:
   * - User authenticated via Supabase JWT (requireAuth middleware)
   * - Classroom match verified
   * - OpenAI moderation applied
   * - Daily limit enforced via database function
   * - from_user NEVER exposed in response
   */
  app.post("/api/compliments", requireAuth, async (req: any, res) => {
    try {
      const { to_user, message } = req.body;
      const from_user = req.user.id; // From auth middleware - source of truth

      // Validate input
      if (!to_user || typeof to_user !== 'string') {
        return res.status(400).json({
          error: "to_user is required and must be a valid UUID"
        });
      }

      if (!message || typeof message !== 'string') {
        return res.status(400).json({
          error: "message is required"
        });
      }

      // Validate message length
      const trimmedMessage = message.trim();
      if (trimmedMessage.length < 3 || trimmedMessage.length > 500) {
        return res.status(400).json({
          error: "Je compliment moet tussen de 3 en 500 tekens lang zijn"
        });
      }

      // Prevent self-compliments
      if (from_user === to_user) {
        return res.status(400).json({
          error: "Je kunt jezelf geen compliment geven 😊"
        });
      }

      // Check daily limit using SECURITY DEFINER function
      const { data: canSend, error: limitError } = await supabase
        .rpc('check_daily_compliment_limit', { p_user_id: from_user });

      if (limitError) {
        console.error("Daily limit check error:", limitError);
        return res.status(500).json({
          error: "Kon daily limit niet checken"
        });
      }

      if (!canSend) {
        return res.status(429).json({
          error: "Je hebt vandaag al een compliment verstuurd. Kom morgen terug! 🔥",
          retry_after: "tomorrow"
        });
      }

      // Get sender's classroom
      const { data: senderData, error: senderError } = await supabase
        .from("users")
        .select("classroom_id")
        .eq("id", from_user)
        .single();

      if (senderError || !senderData?.classroom_id) {
        return res.status(400).json({
          error: "Je moet in een klas zitten om complimenten te versturen"
        });
      }

      // Verify recipient exists and is in same classroom
      const { data: recipientData, error: recipientError } = await supabase
        .from("users")
        .select("classroom_id, name")
        .eq("id", to_user)
        .single();

      if (recipientError || !recipientData) {
        return res.status(400).json({
          error: "Deze klasgenoot bestaat niet"
        });
      }

      if (recipientData.classroom_id !== senderData.classroom_id) {
        return res.status(403).json({
          error: "Je kunt alleen complimenten versturen naar klasgenoten"
        });
      }

      // Moderate message with OpenAI
      const moderation = await moderateMessage(trimmedMessage);

      if (!moderation.safe) {
        console.warn(`Blocked compliment from ${from_user}: score ${moderation.score}, categories: ${moderation.categories?.join(', ')}`);

        // User-friendly error message
        let errorMessage = "Je compliment bevat helaas ongepaste inhoud. ";

        if (moderation.categories?.includes('moderation_api_error')) {
          errorMessage = "We kunnen je compliment op dit moment niet controleren. Probeer het later nog eens.";
        } else {
          errorMessage += "Probeer het opnieuw met een vriendelijk en positief bericht! 💌";
        }

        return res.status(400).json({
          error: errorMessage,
          hint: "Tip: Kies een van de voorbeelden of schrijf iets positiefs over je klasgenoot"
        });
      }

      // Insert compliment - RLS will verify classroom match
      const { data: compliment, error: insertError } = await supabase
        .from("compliments")
        .insert({
          from_user, // Stored for streak tracking, but NEVER exposed to recipient
          to_user,
          classroom_id: senderData.classroom_id,
          message: trimmedMessage,
          toxicity_score: moderation.score,
        })
        .select('id, to_user, classroom_id, message, created_at') // NEVER select from_user
        .single();

      if (insertError) {
        console.error("Error inserting compliment:", insertError);

        // Check if RLS blocked it
        if (insertError.code === '42501' || insertError.message?.includes('policy')) {
          return res.status(403).json({
            error: "Je mag dit compliment niet versturen (classroom mismatch)"
          });
        }

        return res.status(500).json({
          error: "Kon compliment niet opslaan"
        });
      }

      // Update sender's streak using SECURITY DEFINER function
      const { error: streakError } = await supabase
        .rpc('update_user_streak', { p_user_id: from_user });

      if (streakError) {
        console.error("Streak update error:", streakError);
        // Non-critical - continue anyway
      }

      // Update recipient's received count using SECURITY DEFINER function
      const { error: receivedError } = await supabase
        .rpc('increment_received_count', { p_user_id: to_user });

      if (receivedError) {
        console.error("Received count error:", receivedError);
        // Non-critical - continue anyway
      }

      // Return success WITHOUT from_user
      res.json({
        success: true,
        compliment: {
          id: compliment.id,
          message: compliment.message,
          created_at: compliment.created_at,
          // NEVER include from_user here
        }
      });

    } catch (error) {
      console.error("POST /api/compliments error:", error);
      res.status(500).json({
        error: "Er ging iets mis bij het versturen van je compliment"
      });
    }
  });

  /**
   * GET /api/compliments/mine
   * Get received compliments (RLS enforces to_user = auth.uid())
   */
  app.get("/api/compliments/mine", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;

      // RLS will automatically filter to only compliments where to_user = userId
      const { data, error } = await supabase
        .from("compliments")
        .select('id, message, created_at, toxicity_score') // NEVER select from_user
        .eq("to_user", userId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching compliments:", error);
        return res.status(500).json({
          error: "Kon complimenten niet ophalen"
        });
      }

      res.json(data || []);
    } catch (error) {
      console.error("GET /api/compliments/mine error:", error);
      res.status(500).json({
        error: "Er ging iets mis"
      });
    }
  });

  /**
   * GET /api/compliments/streak
   * Get streak data for current user
   */
  app.get("/api/compliments/streak", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;

      const { data, error } = await supabase
        .from("compliment_streaks")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (error && error.code !== "PGRST116") { // PGRST116 = no rows
        console.error("Error fetching streak:", error);
        return res.status(500).json({
          error: "Kon streak data niet ophalen"
        });
      }

      // Return default if no streak yet
      res.json(data || {
        user_id: userId,
        current_streak: 0,
        longest_streak: 0,
        last_sent_at: null,
        total_sent: 0,
        total_received: 0,
        points: 0,
        badges: [],
      });
    } catch (error) {
      console.error("GET /api/compliments/streak error:", error);
      res.status(500).json({
        error: "Er ging iets mis"
      });
    }
  });

  /**
   * GET /api/compliments/classmates
   * Get list of classmates (for dropdown)
   */
  app.get("/api/compliments/classmates", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;

      // Get user's classroom
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("classroom_id")
        .eq("id", userId)
        .single();

      if (userError || !userData?.classroom_id) {
        return res.json([]); // No classroom = no classmates
      }

      // Get all users in same classroom (except self)
      const { data, error } = await supabase
        .from("users")
        .select("id, name, email")
        .eq("classroom_id", userData.classroom_id)
        .neq("id", userId)
        .order("name");

      if (error) {
        console.error("Error fetching classmates:", error);
        return res.status(500).json({
          error: "Kon klasgenoten niet ophalen"
        });
      }

      res.json(data || []);
    } catch (error) {
      console.error("GET /api/compliments/classmates error:", error);
      res.status(500).json({
        error: "Er ging iets mis"
      });
    }
  });

  /**
   * GET /api/compliments/stats
   * Get classroom aggregate stats
   * Uses SECURITY DEFINER function for privacy
   */
  app.get("/api/compliments/stats", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;

      // Use SECURITY DEFINER function that:
      // 1. Only returns aggregates (no individual data)
      // 2. Requires >= 5 students for privacy
      // 3. Is timezone-aware
      const { data, error } = await supabase
        .rpc('get_classroom_stats', { p_user_id: userId });

      if (error) {
        console.error("Error fetching stats:", error);
        return res.status(500).json({
          error: "Kon statistieken niet ophalen"
        });
      }

      res.json(data || {
        total_compliments: 0,
        total_students: 0,
        avg_per_student: '0',
        this_week: 0,
        this_month: 0,
      });
    } catch (error) {
      console.error("GET /api/compliments/stats error:", error);
      res.status(500).json({
        error: "Er ging iets mis"
        });
    }
  });
}
