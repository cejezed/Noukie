import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

/** 
 * Choose contextually similar distractors based on simple Jaccard similarity over content words.
 * This avoids silly, obviously-wrong options.
 */
function tokenize(s: string): string[] {
  return (s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[’'"]/g, "'")
    .replace(/[^a-z0-9\s']/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

const STOP = new Set([
  "de","het","een","en","of","in","op","van","voor","met","door","dat","die",
  "te","als","om","aan","bij","uit","tot","over","zoals","waarin","waartoe",
  "is","zijn","werd","werden","was","waren","heeft","hebben","het","een"
]);

function contentTokens(s: string): string[] {
  return tokenize(s).filter(w => !STOP.has(w) && w.length > 2);
}

function jaccard(a: string, b: string): number {
  const A = new Set(contentTokens(a));
  const B = new Set(contentTokens(b));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const union = A.size + B.size - inter;
  return inter / union;
}

function similarDistractors(correct: string, pool: string[], k = 3): string[] {
  const candidates = pool
    .filter(s => s && s !== correct)
    .map(s => ({ s, score: jaccard(correct, s) }))
    .sort((a, b) => b.score - a.score);

  // Prefer the top-scoring ones; if scores are too low, fall back to random fill.
  const chosen: string[] = [];
  for (const c of candidates) {
    if (!chosen.includes(c.s)) chosen.push(c.s);
    if (chosen.length >= k) break;
  }
  if (chosen.length < k) {
    const rest = pool.filter(s => s && s !== correct && !chosen.includes(s));
    rest.sort(() => Math.random() - 0.5);
    chosen.push(...rest.slice(0, k - chosen.length));
  }
  return chosen.slice(0, k);
}


function parseQuizletLike(input: string) {
  // Ondersteunt: tab-gescheiden (TSV), komma-gescheiden (CSV) of gekopieerde lijsten "term<tab>def"
  // Retourneert [{term, def}, ...]
  const lines = input.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const rows: Array<{ term: string; def: string }> = [];
  for (const line of lines) {
    // detecteer delimiter per regel
    let parts: string[] = [];
    if (line.includes("\t")) parts = line.split("\t");
    else if (line.includes(";")) parts = line.split(";");
    else if (line.includes(",")) parts = line.split(",");
    else {
      // fallback: probeer " - " scheiding
      parts = line.split(" - ");
    }
    if (parts.length >= 2) {
      const term = (parts[0] ?? "").trim();
      const def = (parts.slice(1).join(" ").trim());
      if (term && def) rows.push({ term, def });
    }
  }
  return rows;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const userId = (req.headers["x-user-id"] as string) || null;
  if (!userId) return res.status(401).json({ error: "Missing x-user-id" });

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  try {
    const body = req.body as {
      subject: string;
      chapter: string;
      title: string;
      description?: string;
      mode?: "open" | "mc";
      generateMc?: boolean; // indien true, maak meerkeuze-opties met afleiders
      text?: string;        // geplakte data (TSV/CSV)
      csv?: string;         // alternatief veld voor CSV
    };

    const subject = body.subject?.trim();
    const chapter = body.chapter?.trim();
    const title = body.title?.trim();
    const description = body.description?.trim() || "";
    const mode = body.mode === "mc" ? "mc" : "open";
    const src = (body.text ?? body.csv ?? "").trim();

    if (!subject || !chapter || !title || !src) {
      return res.status(400).json({ error: "subject, chapter, title en text/csv zijn verplicht." });
    }

    const pairs = parseQuizletLike(src);
    if (!pairs.length) {
      return res.status(400).json({ error: "Geen valide regels gevonden. Verwacht: term<TAB/CSV>definitie per regel." });
    }

    // 1) Quiz aanmaken
    const { data: quiz, error: qErr } = await admin
      .from("study_quizzes")
      .insert([{ user_id: userId, subject, chapter, title, description, is_published: false }])
      .select("*")
      .single();
    if (qErr) return res.status(400).json({ error: qErr.message });

    // 2) Vragen payload bouwen
    // - open: prompt = term, answer = definitie
    // - mc:   prompt = term, choices = [juiste, ...afleiders], answer = juiste
    let allDefs = pairs.map(p => p.def);
    const items = pairs.map((row, idx) => {
      if (mode === "mc" && body.generateMc) {
        // kies 3 afleiders uit andere definities
        const distractors = similarDistractors(row.def, allDefs, 3);
        const choices = [row.def, ...distractors].sort(() => Math.random() - 0.5);
        return {
          qtype: "mc",
          prompt: row.term,
          choices,
          answer: row.def,
          explanation: "",
          sort_order: idx,
        };
      } else if (mode === "mc") {
        // mc zonder afleiders → maak een simpele 2-optie (juist/onjuist) als fallback
        const wrong = allDefs.find(d => d !== row.def) || "—";
        const choices = [row.def, wrong].sort(() => Math.random() - 0.5);
        return {
          qtype: "mc",
          prompt: row.term,
          choices,
          answer: row.def,
          explanation: "",
          sort_order: idx,
        };
      } else {
        // open vraag
        return {
          qtype: "open",
          prompt: row.term,
          choices: null,
          answer: row.def,
          explanation: "",
          sort_order: idx,
        };
      }
    });

    // 3) Insert in study_questions (JSONB choices)
    const payload = items.map(i => ({
      quiz_id: quiz.id,
      qtype: i.qtype,
      prompt: i.prompt,
      choices: i.choices ? JSON.stringify(i.choices) : null,
      answer: i.answer,
      explanation: i.explanation,
      sort_order: i.sort_order,
    }));

    const { error: insErr } = await admin.from("study_questions").insert(payload);
    if (insErr) return res.status(400).json({ error: insErr.message });

    return res.status(201).json({ ok: true, quiz_id: quiz.id, questions: payload.length });
  } catch (e: any) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
