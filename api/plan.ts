import type { Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";

/**
 * Maak 2 clients:
 *  - admin: alleen voor auth.getUser (service role key)
 *  - userClient: gebruikt het JWT van de user voor DB interacties (RLS enforced)
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE!; // NIET naar de client lekken!

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey); // voor auth/getUser

function createUserClient(jwt: string) {
  return createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
}

// Kleine helper om weekstart te normaliseren (naar maandag)
function normalizeToMondayISO(input: string): string {
  const d = new Date(input);
  if (isNaN(d.getTime())) throw new Error("Ongeldige datum");
  const js = d.getDay(); // 0 = zo .. 6 = za
  const shift = js === 0 ? -6 : 1 - js; // naar maandag
  d.setDate(d.getDate() + shift);
  // Alleen datum (Z) opslaan om TZ-misverstanden te voorkomen
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export async function handleCreatePlan(req: Request, res: Response) {
  try {
    // 1) Auth header
    const auth = req.headers.authorization;
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : undefined;
    if (!token) return res.status(401).json({ error: "Geen autorisatie-token." });

    // 2) Verifieer user met admin client
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) return res.status(401).json({ error: "Niet geautoriseerd." });

    // 3) Validatie body
    const { title, week_start_date } = req.body ?? {};
    if (!title || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ error: "Titel is verplicht." });
    }
    if (!week_start_date || typeof week_start_date !== "string") {
      return res.status(400).json({ error: "Startdatum van de week is verplicht." });
    }

    let weekStartISO: string;
    try {
      weekStartISO = normalizeToMondayISO(week_start_date);
    } catch {
      return res.status(400).json({ error: "Ongeldige datum voor week_start_date." });
    }

    // 4) DB insert met user-scoped client (RLS actief)
    const supabaseUser = createUserClient(token);

    const { data: newPlan, error: insertError } = await supabaseUser
      .from("plans")
      .insert({
        title: title.trim(),
        week_start_date: weekStartISO, // bv. "2025-09-01"
        user_id: user.id,
      })
      .select("*")
      .single();

    if (insertError) {
      // unieker foutbericht bij constraint violations etc.
      return res.status(400).json({ error: "Kon planning niet aanmaken", details: insertError.message });
    }

    return res.status(201).json(newPlan);
  } catch (err: any) {
    console.error("Fout bij het aanmaken van een planning:", err);
    return res.status(500).json({ error: "Interne serverfout" });
  }
}
