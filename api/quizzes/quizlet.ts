import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** -------------------------------------------------------
 *  Helpers: tekst-normalisatie + contextuele distractors
 * ------------------------------------------------------*/
function normalizeSpaces(s: string): string {
  return (s || "")
    .replace(/\r/g, "")
    .replace(/\s*\n+\s*/g, " ")  // interne newlines -> spatie
    .replace(/\s{2,}/g, " ")
    .trim();
}

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
  "is","zijn","werd","werden","was","waren","heeft","hebben"
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
  const MIN_LEN = 18; // te korte zinnetjes vermijden (zoals “muziek en waarden”)
  const cleanCorrect = normalizeSpaces(correct);

  // Kandidaten scoren op gelijkenis en filteren op lengte + geen (deel)duplicaten
  const candidates = pool
    .map(s => normalizeSpaces(s))
    .filter(s =>
      s &&
      s !== cleanCorrect &&
      s.length >= MIN_LEN &&
      !s.includes(cleanCorrect) &&
      !cleanCorrect.includes(s)
    )
    .map(s => ({ s, score: jaccard(cleanCorrect, s) }))
    .sort((a, b) => b.score - a.score);

  const chosen: string[] = [];
  for (const c of candidates) {
    if (!chosen.includes(c.s)) chosen.push(c.s);
    if (chosen.length >= k) break;
  }

  // Fallback: random aanvullen als er te weinig overblijven
  if (chosen.length < k) {
    const rest = pool
      .map(s => normalizeSpaces(s))
      .filter(
        s =>
          s &&
          s !== cleanCorrect &&
          !chosen.includes(s) &&
          s.length >= MIN_LEN
      );
    rest.sort(() => Math.random() - 0.5);
    chosen.push(...rest.slice(0, k - chosen.length));
  }

  return chosen.slice(0, k);
}

/** -------------------------------------------------------
 *  Parser: ondersteunt meerdere invoervormen
 *  - "Vraag?\sAntwoord"
 *  - "term<TAB>def"  /  "term;def"
 *  - CSV-achtig: 2 velden, desnoods met quotes
 * ------------------------------------------------------*/
type Pair = { term: string; def: string };

function splitFirst(haystack: string, delimiter: string): [string, string] | null {
  const i = haystack.indexOf(delimiter);
  if (i === -1) return null;
  return [haystack.slice(0, i), haystack.slice(i + delimiter.length)];
}

function parseLine(line: string): Pair | null {
  const raw = normalizeSpaces(line);

  // 1) Q/A: split op eerste '? ' (jouw invoer)
  const qa = splitFirst(raw, "? ");
  if (qa) {
    return { term: (qa[0] + "?").trim(), def: qa[1].trim() };
  }

  // 2) Tab-gescheiden
  if (raw.includes("\t")) {
    const parts = raw.split("\t").map(normalizeSpaces).filter(Boolean);
    if (parts.length >= 2) return { term: parts[0], def: parts.slice(1).join(" ") };
  }

  // 3) Semicolon-gescheiden
  if (raw.includes(";")) {
    const [a, b] = raw.split(/;(.*)/).map(s => normalizeSpaces(s || ""));
    if (a && b) return { term: a, def: b };
  }

  // 4) CSV (2 velden), tolerant met quotes
  //    Voorbeeld: "term","def met, komma"
  const csvMatch = raw.match(/^\s*"([^"]+)"\s*,\s*"([^"]+)"\s*$/)
                || raw.match(/^\s*([^,]+)\s*,\s*(.+)\s*$/);
  if (csvMatch) {
    const term = normalizeSpaces(csvMatch[1]);
    const def  = normalizeSpaces(csvMatch[2]);
    if (term && def) return { term, def };
  }

  return null;
}

function parseQuizletLike(input: string): Pair[] {
  const lines = (input || "")
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  const rows: Pair[] = [];
  for (const line of lines) {
    const pair = parseLine(line);
    if (pair) rows.push(pair);
  }
  return rows;
}

/** -------------------------------------------------------
 *  Endpoint
 * ------------------------------------------------------*/
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const userId = (req.headers["x-user-id"] as string) || null;
  if (!userId) return res.status(401).json({ error: "Missing x-user-id" });

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { text, title, subject, mode = "mc", generateMc = true } = body || {};

    if (!text || !title || !subject) {
      return res.status(400).json({ error: "Missing text/title/subject" });
    }

    // 1) Parse input
    const pairs = parseQuizletLike(text);
    if (!pairs.length) {
      return res.status(400).json({ error: "No questions parsed from input" });
    }

    // 2) Quiz row
    const { data: quiz, error: qErr } = await admin
      .from("study_quizzes")
      .insert({
        title,
        subject,
        owner_id: userId,
        is_published: false,
      })
      .select("*")
      .single();

    if (qErr || !quiz) return res.status(400).json({ error: qErr?.message || "quiz insert failed" });

    // 3) Items bouwen
    const allDefs = pairs.map(p => normalizeSpaces(p.def));

    const items = pairs.map((row, idx) => {
      const prompt = normalizeSpaces(row.term);
      const correct = normalizeSpaces(row.def);

      if (mode === "mc" && generateMc) {
        const distractors = similarDistractors(correct, allDefs, 3);
        const choices = [correct, ...distractors].sort(() => Math.random() - 0.5);

        return {
          qtype: "mc",
          prompt,
          choices,
          answer: correct,
          explanation: null,
          sort_order: idx,
        };
      }

      // open vraag
      return {
        qtype: "open",
        prompt,
        choices: null,
        answer: correct,
        explanation: null,
        sort_order: idx,
      };
    });

    // 4) Insert questions
    const payload = items.map((i: any) => ({
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
