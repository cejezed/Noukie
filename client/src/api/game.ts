/**
 * Game API Service
 *
 * Frontend service functions for game-related API calls
 */

import type {
  SaveGameSessionRequest,
  SaveGameSessionResponse,
  GetGameProfileRequest,
  GetGameProfileResponse,
} from "@/types/game";

/**
 * Get user ID from Supabase auth
 * (Reuse from existing auth patterns)
 */
async function getUserId(): Promise<string> {
  const { supabase } = await import("@/lib/supabase");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");
  return user.id;
}

/**
 * Save completed game session to backend
 *
 * @param request - Session data to save
 * @returns Updated profile, subject stats, and rank info
 */
export async function saveGameSession(
  request: SaveGameSessionRequest
): Promise<SaveGameSessionResponse> {
  const userId = await getUserId();

  const response = await fetch("/api/game/session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": userId,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to save game session: ${error}`);
  }

  return response.json();
}

/**
 * Get user's game profile and subject stats
 *
 * @param request - Optional subject filter
 * @returns User profile and subject stats
 */
export async function getGameProfile(
  request: GetGameProfileRequest = {}
): Promise<GetGameProfileResponse> {
  const userId = await getUserId();

  const params = new URLSearchParams();
  if (request.subject) {
    params.append("subject", request.subject);
  }

  const url = `/api/game/profile${params.toString() ? `?${params.toString()}` : ""}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "x-user-id": userId,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get game profile: ${error}`);
  }

  return response.json();
}
