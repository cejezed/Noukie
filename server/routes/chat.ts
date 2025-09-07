// server/routes/chat.ts
import { Router } from "express";
import type { Request, Response } from "express";
import { supabaseForRequest } from "../lib/supabaseClient";

// -----------------------------
// Helpers voor NL datum parsing
// -----------------------------
const WD = ["zondag","maandag","dinsdag","woensdag","donderdag","vrijdag","zaterdag"];
const MONTHS = ["januari","februari","maart","april","mei","juni","juli","augustus","september","oktober","november","december"];

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate()+n); return x; }

function parseRelativeDateTimeNL(inputRaw: string, now = new Date()) {
  const input = inputRaw.toLowerCase().trim();
  let date = startOfDay(now);
  let time: string | null = null;

  if (/\bmorgen\b/.test(input)) date = startOfDay(addDays(now, 1));
  else if (/\bovermorgen\b/.test(input)) date = startOfDay(addDays(now, 2));
  else if (/\bvandaag\b/.test(input)) date = startOfDay(now);

  for (let i = 0; i < WD.length; i++) {
    if (input.includes(WD[i])) {
      const target = i; const cur = now.getDay();
      let diff = target - cur; if (diff <= 0) diff += 7;
      date = startOfDay(addDays(now, diff)); break;
    }
  }

  const dmLong = input.match(/(\d{1,2})\s+([a-z]+)(?:\s+(\d{4}))?/);
  const dmShort = input.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);

  if (dmLong) {
    const d = parseInt(dmLong[1], 10);
    const mName = dmLong[2];
    const y = dmLong[3] ? parseInt(dmLong[3], 10) : now.getFullYear();
    const m = MONTHS.indexOf(mName);
    if (m >= 0) date = startOfDay(new Date(y, m, d));
  } else if (dmShort) {
    const d = parseInt(dmShort[1], 10);
    const m = parseInt(dmShort[2], 10) - 1;
    let y = dmShort[3] ? parseInt(dmShort[3], 10) : now.getFullYear();
    if (y < 100) y += 2000;
    date = startOfDay(new Date(y, m, d));
  }

  const hhmm = input.match(/\b(\d{1,2}):(\d{2})\b/);
  const hhmmCompact = input.match(/\b(\d{1,2})(\d{2})\b/);
  const omUur = input.match(/\bom\s*(\d{1,2})\s*uur\b/);

  if (hhmm) time = `${hhmm[1].padStart(2,"0")}:${hhmm[2]}`;
  else if (omUur) time = `${omUur[1].padStart(2,"0")}:00`;
  else if (hhmmCompact) {
    const h = parseInt(hhmmCompact[1],10), m = parseInt(hhmmCompact[2],10);
    if (h>=0 && h<=23 && m>=0 && m<=59) time = `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
  }

  if (!time) {
    if (/\b(ochtend|smorgens)\b/.test(input)) time = "09:00";
    else if (/\b(middag|vanmiddag)\b/.test(input)) time = "14:00";
    else if (/\b(avond|vanavond)\b/.test(input)) time = "19:00";
  }

  if (time) {
    const [H,M] = time.split(":").map(Number);
    date.setHours(H, M, 0, 0);
  }
  return { date, time: time ?? null };
}

function parseEstMinutes(input: string) {
  const m1 = input.match(/(\d{1,3})\s*min/);
  if (m1) return parseInt(m1[1], 10);
  const h1 = input.match(/(\d+(?:[.,]\d+)?)\s*uur/);
  if (h1) return Math.round(parseFloat(h1[1].replace(",", ".")) * 60);
  return null;
}

function extractTaskCandidates(text: string): string[] {
  const lines = text.split(/\n/).map(s => s.trim()).filter(Boolean);
  const picked = lines
    .filter(l => /^[-•]/.test(l) || /^maak taak:/i.test(l))
    .map(l => l.replace(/^[-•]\s*/,"").replace(/^maak taak:\s*/i,"").trim());
  return picked.length ? picked : [text];
}

// -----------------------------
// GET /api/chat/history
// -----------------------------
export async function chatHistory(req: Request, res: Response) {
  try {
    const accessToken = req.headers.authorization?.replace("Bearer ", "");
    const supabase = supabaseForRequest(accessToken);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return res.status(401).json({ error: "unauthorized" });

    const { data, error } = await supabase
      .from("chat_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;

    res.json({ messages: (data ?? []).reverse() });
  } catch (e: any) {
    res.status(500).json({ error: "internal_error", detail: String(e?.message || e) });
  }
}

// -----------------------------
// POST /api/chat/coach
// -----------------------------
export async function chatCoach(req: Request, res: Response) {
  try {
    const { message } = req.body || {};
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "message required" });
    }

    const accessToken = req.headers.authorization?.replace("Bearer ", "");
    const supabase = supabaseForRequest(accessToken);

    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return res.status(401).json({ error: "unauthorized" });

    // user bericht opslaan
    await supabase.from("chat_messages").insert({ user_id: user.id, role: "user", content: message });

    // taken maken?
    const shouldPlan = /\b(taak|taken|huiswerk|paragraaf|toets|leren|inplannen|plan|maken)\b/i.test(message);
    let created: any[] = [];
    if (shouldPlan) {
      const now = new Date();
      const candidates = extractTaskCandidates(message);

      const { data: courses } = await supabase.from("courses").select("id,name");

      for (const c of candidates) {
        const { date } = parseRelativeDateTimeNL(c, now);
        const est = parseEstMinutes(c);

        let course_id: string | null = null;
        if (courses?.length) {
          const hit = courses.find(k => c.toLowerCase().includes(k.name.toLowerCase()));
          if (hit) course_id = hit.id;
        }

        const title = c.replace(/\s+/g," ").trim();

        // ✅ Aangepaste logica: controleer of de datum geldig is voordat je de taak opslaat
        if (isNaN(date.getTime())) {
          console.warn(`Ongeldige datum gedetecteerd voor taak: "${title}". Taak wordt overgeslagen.`);
          continue;
        }

        const { data, error } = await supabase
          .from("tasks")
          .insert({
            user_id: user.id,
            title: title || "Taak",
            status: "todo",
            due_at: date.toISOString(),
            course_id,
            est_minutes: est ?? null,
          })
          .select("*")
          .single();

        if (!error && data) created.push(data);
      }
    }

    // coach antwoord
    const did = created.length;
    const tail =
      did > 0
        ? `Ik heb ${did} ${did===1?"taak":"taken"} ingepland. Wil je ook een herhaaltaak toevoegen voor morgenavond?`
        : `Zal ik dit vertalen naar concrete taken (met tijd en duur)? Bijvoorbeeld: “Morgen 19:00 wiskunde 3.2 oefenen (30 min)”.`;

    const reply = `Goed dat je dit vertelt. Wat vond je vandaag het lastigst?\n${tail}\nTip: blokken van 25–30 minuten met pauzes werken vaak beter dan lange sessies.`;

    // assistant bericht opslaan
    await supabase.from("chat_messages").insert({ user_id: user.id, role: "assistant", content: reply });

    res.json({ reply, created_count: did, created_tasks: created });
  } catch (e: any) {
    console.error("[chatCoach] error", e);
    res.status(500).json({ error: "internal_error", detail: String(e?.message || e) });
  }
}

// -----------------------------
// POST /api/explain (NIEUW)
// -----------------------------
export async function explain(req: Request, res: Response) {
  try {
    const body = req.body ?? {};
    const raw = (typeof body.text === "string" ? body.text : body.message) as string | undefined;
    const text = raw?.trim() ?? "";

    if (text.length < 3) {
      return res.status(400).json({
        error: "MISSING_TEXT",
        message: 'Stuur JSON met { "text": "<min. 3 tekens>" } (of "message").',
        example: { text: "Leg fotosynthese uit in simpele stappen." }
      });
    }

    const subject =
      typeof body.subject === "string" && body.subject.trim().length
        ? body.subject.trim()
        : undefined;

    // Placeholder (vervang door je echte explain/LLM-call)
    const explanation =
      `Uitleg${subject ? ` (vak: ${subject})` : ""}:\n` +
      `• Samenvatting van je vraag: "${text}".\n` +
      `• Geef 2–3 korte, stapsgewijze hints (geen volledig antwoord).\n` +
      `• Voeg één concreet voorbeeld toe.\n`;

    return res.json({ explanation });
  } catch (e: any) {
    console.error("[explain] error", e);
    return res.status(500).json({ error: "internal_error", detail: String(e?.message || e) });
  }
}

// -----------------------------
// Router-koppelingen
// -----------------------------
const router = Router();

// bestaande endpoints
router.get("/chat/history", chatHistory);
router.post("/chat/coach", chatCoach);

// nieuwe uitleg-endpoint
router.post("/explain", explain);

export default router;
