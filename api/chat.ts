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

type Mode = "chat" | "studeren";

const BASE_SYSTEM = `Je bent "Noukie", een vriendelijke studie-buddy in een huiswerk-app. Antwoord altijd in het Nederlands, kort en duidelijk.`;

const STUDY_SYSTEM = `Rol: leercoach (studeren en leren).
Doel: Begrip vergroten en stof verankeren.

Werkwijze:
1) Leg de kern uit in eenvoudige stappen (max. 5 korte alinea's) met 1 concreet voorbeeld.
2) Geef 3–5 kernpunten samenvatting (bulletpoints).
3) Maak 3 oefenvragen met korte hints (geen volledige uitwerkingen).
4) Sluit af met 1 check-vraag (om te testen of het begrepen is).

Stijl: vriendelijk, compact, activerend. Vraag niet om onnodige info, maar stel waar nodig 1 gerichte vervolgvraag. Gebruik waar passend ezelsbruggetjes of analogieën.`;

const CHAT_SYSTEM = `Rol: coach voor vrij gesprek.
Stijl: vriendelijk, to-the-point (max. 2–3 zinnen), geen standaard schema's tenzij expliciet gevraagd.`;

function buildSystemPrompt(mode: Mode, systemHint?: string, context?: unknown) {
  const safeContext =
    context ? `\n[Context JSON]\n${JSON.stringify(context).slice(0, 4000)}` : "";

  if (mode === "studeren") {
    return [
      BASE_SYSTEM,
      STUDY_SYSTEM,
      systemHint?.trim() || "",
      safeContext,
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  // default = chat
  return [
    BASE_SYSTEM,
    CHAT_SYSTEM,
    systemHint?.trim() || "",
    safeContext,
  ]
    .filter(Boolean)
    .join("\n\n");
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
    // 1) Auth check
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) {
      return res.status(401).json({ error: "Geen autorisatie-token." });
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return res.status(401).json({ error: "Niet geautoriseerd." });
    }

    // 2) Body
    const body = (req.body ?? {}) as any;
    const message = (body.message ?? "").toString().trim();
    const history = Array.isArray(body.history) ? body.history : [];
    const systemHint = (body.systemHint ?? "").toString();
    const context = body.context ?? {};
    const mode: Mode =
      body.mode === "studeren" || body.mode === "chat" ? body.mode : "chat";

    if (!message) {
      return res.status(400).json({ error: "message ontbreekt of is ongeldig" });
    }

    // 3) System prompt
    const systemPrompt = buildSystemPrompt(mode, systemHint, context);

    // 4) OpenAI call
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: mode === "studeren" ? 0.3 : 0.6,
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
      (mode === "studeren"
        ? "Kun je aangeven welk stuk van de stof je lastig vindt? Dan leg ik het stap-voor-stap uit."
        : "Oké—vertel nog iets meer, dan denk ik mee.");

    // 5) Response
    return res.status(200).json({ reply, mode });
  } catch (e: any) {
    console.error("chat error", e);
    return res
      .status(500)
      .json({ error: "Interne serverfout.", details: e?.message });
  }
}
