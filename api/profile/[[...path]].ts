import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-user-id");

  if (req.method === "OPTIONS") return res.status(204).end();

  // Determine route from path parameter
  const pathParam = req.query.path;
  const path = Array.isArray(pathParam) ? pathParam.join("/") : (pathParam || "");

  // Route: /api/profile/xp - Add XP
  if (path === "xp") {
    if (req.method !== "POST") return res.status(405).end("Method Not Allowed");

    const { userId, delta, reason, meta } = req.body as { userId: string; delta: number; reason: string; meta?: any };
    if (!userId || typeof delta !== "number") {
      return res.status(400).json({ error: "Missing userId or delta" });
    }

    try {
      // Get current profile
      const { data: current } = await admin.from("study_profile").select("*").eq("user_id", userId).single();

      const oldXp = current?.xp_total || 0;
      const oldLevel = current?.level || 1;
      const newXp = oldXp + delta;

      // Calculate new level: floor(sqrt(xp_total / 10)) with minimum 1
      const newLevel = Math.max(1, Math.floor(Math.sqrt(newXp / 10)));
      const leveledUp = newLevel > oldLevel;

      // Upsert profile
      const { error: profileError } = await admin.from("study_profile").upsert(
        {
          user_id: userId,
          xp_total: newXp,
          level: newLevel,
          games_played: current?.games_played || 0,
          tests_completed: current?.tests_completed || 0,
          streak_days: current?.streak_days || 0,
          last_activity_date: new Date().toISOString().split("T")[0],
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

      if (profileError) throw profileError;

      // Log XP change
      await admin.from("study_xp_log").insert({
        user_id: userId,
        delta,
        reason,
        meta: meta || null,
      });

      return res.status(200).json({
        ok: true,
        newXp,
        newLevel,
        leveledUp,
        xpAwarded: delta
      });
    } catch (err: any) {
      console.error("XP award error:", err);
      return res.status(500).json({ error: err.message || "Failed to award XP" });
    }
  }

  // Route: /api/profile - Get profile
  if (path === "" || !path) {
    if (req.method !== "GET") return res.status(405).end("Method Not Allowed");

    const userId = (req.headers["x-user-id"] as string) || (req.query.userId as string);
    if (!userId) return res.status(400).json({ error: "Missing userId" });

    try {
      const { data: profile, error } = await admin.from("study_profile").select("*").eq("user_id", userId).single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      // Return default profile if none exists
      if (!profile) {
        return res.status(200).json({
          user_id: userId,
          xp_total: 0,
          level: 1,
          games_played: 0,
          tests_completed: 0,
          streak_days: 0,
          last_activity_date: null,
        });
      }

      return res.status(200).json(profile);
    } catch (err: any) {
      console.error("Profile fetch error:", err);
      return res.status(500).json({ error: err.message || "Failed to fetch profile" });
    }
  }

  return res.status(404).json({ error: "Not found" });
}
