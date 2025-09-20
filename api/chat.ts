// api/chat.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

// Init OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// Init Supabase (server-side met service role key)
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Kleine CORS helper
function cors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // 1. Auth check
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) {
      return res.status(401).json({ error: "Geen autorisatie-token." });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return res.status(401).json({ error: "Niet geautoriseerd." });
    }

    // 2. Body uitlezen
    const body = (req.body ?? {}) as any;
    const message = (body.message ?? "").toString().trim();
    const history = Array.isArray(body.history) ? body.history : [];
    const systemHint = (body.systemHint ?? "").toString();
    const context = body.context ?? {};

    if (!message) {
      return res.status(400).json({ error: "message ontbreekt of is ongeldig" });
    }

    // 3. Prompt opbouwen
    const systemPrompt =
      (systemHint?.trim() ||
        `Je bent "Noukie", een vriendelijke studie-buddy. 
Reageer kort, natuurlijk en in het Nederlands (max 2–3 zinnen).
Bied géén standaard blokken of schema's aan, tenzij de gebruiker dat expliciet vraagt.`) +
      (context ? `\n[Context JSON]\n${JSON.stringify(context).slice(0, 4000)}` : "");

    // 4. OpenAI call
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.5,
      messages: [
        { role: "system", content: systemPrompt },
        ...history.map((h: any) => ({
          role: h.role,
          content: String(h.content),
        })),
        { role: "user", content: message },
      ],
    });

    const reply =
      resp.choices?.[0]?.message?.content?.trim() ||
      "Oké—vertel nog iets meer, dan denk ik mee.";

    // 5. Terugsturen
    return res.status(200).json({ reply });
  } catch (e: any) {
    console.error("chat error", e);
    return res
      .status(500)
      .json({ error: "Interne serverfout.", details: e?.message });
  }
}
