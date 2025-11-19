import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-user-id");

  if (req.method === "OPTIONS") return res.status(204).end();

  const userId = (req.headers["x-user-id"] as string) || req.body?.userId;
  if (!userId) return res.status(401).json({ error: "Missing user id" });

  // Determine route from path parameter
  const pathParam = req.query.path;
  const path = Array.isArray(pathParam) ? pathParam.join("/") : (pathParam || "");

  // Helper function to get or create playtime record
  async function getOrCreatePlaytime(uid: string) {
    const { data, error } = await admin
      .from("study_playtime")
      .select("*")
      .eq("user_id", uid)
      .single();

    if (error && error.code === "PGRST116") {
      // No record exists, create one
      const { data: newData, error: insertError } = await admin
        .from("study_playtime")
        .insert({ user_id: uid, balance_minutes: 0 })
        .select("*")
        .single();

      if (insertError) throw insertError;
      return newData;
    }

    if (error) throw error;
    return data;
  }

  // Route: /api/playtime (GET balance)
  if (path === "" || !path) {
    if (req.method !== "GET") return res.status(405).end("Method Not Allowed");

    try {
      const playtime = await getOrCreatePlaytime(userId);
      return res.status(200).json({
        balanceMinutes: playtime?.balance_minutes || 0
      });
    } catch (error: any) {
      console.error("Get playtime error:", error);
      return res.status(500).json({ error: error.message });
    }
  }

  // Route: /api/playtime/use (POST - deduct minutes)
  if (path === "use") {
    if (req.method !== "POST") return res.status(405).end("Method Not Allowed");

    try {
      const { costMinutes } = req.body;
      if (!costMinutes || costMinutes <= 0) {
        return res.status(400).json({ error: "Invalid costMinutes" });
      }

      const current = await getOrCreatePlaytime(userId);
      const currentBalance = current?.balance_minutes || 0;

      if (currentBalance < costMinutes) {
        return res.status(400).json({
          error: "Insufficient playtime",
          balanceMinutes: currentBalance
        });
      }

      const newBalance = currentBalance - costMinutes;

      const { data, error } = await admin
        .from("study_playtime")
        .update({
          balance_minutes: newBalance,
          updated_at: new Date().toISOString()
        })
        .eq("user_id", userId)
        .select("*")
        .single();

      if (error) throw error;

      // Log the usage
      await admin.from("study_playtime_log").insert({
        user_id: userId,
        delta: -costMinutes,
        reason: "game_play",
        balance_after: newBalance,
      });

      return res.status(200).json({
        balanceMinutes: data?.balance_minutes || 0,
        deducted: costMinutes
      });
    } catch (error: any) {
      console.error("Use playtime error:", error);
      return res.status(500).json({ error: error.message });
    }
  }

  // Route: /api/playtime/add (POST - add minutes)
  if (path === "add") {
    if (req.method !== "POST") return res.status(405).end("Method Not Allowed");

    try {
      const { userId: bodyUserId, delta, reason, meta } = req.body;
      const targetUserId = bodyUserId || userId;

      if (!delta || delta <= 0) {
        return res.status(400).json({ error: "Invalid delta" });
      }

      const current = await getOrCreatePlaytime(targetUserId);
      const currentBalance = current?.balance_minutes || 0;
      const newBalance = currentBalance + delta;

      const { data, error } = await admin
        .from("study_playtime")
        .upsert({
          user_id: targetUserId,
          balance_minutes: newBalance,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' })
        .select("*")
        .single();

      if (error) throw error;

      // Log the addition
      await admin.from("study_playtime_log").insert({
        user_id: targetUserId,
        delta: delta,
        reason: reason || "manual_add",
        balance_after: newBalance,
        meta: meta ? JSON.stringify(meta) : null,
      });

      return res.status(200).json({
        balanceMinutes: data?.balance_minutes || 0,
        added: delta
      });
    } catch (error: any) {
      console.error("Add playtime error:", error);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(404).json({ error: "Not found" });
}
