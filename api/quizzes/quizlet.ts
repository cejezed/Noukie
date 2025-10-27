import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** -------------------------------------------------------
 *  Utilities
 * ------------------------------------------------------*/
function normalizeSpaces(s: string): string {
  return (s || "")
    .replace(/\r/g, "")
    .replace(/\s*\n+\s*/g, " ") // collapse newlines to spaces within a line
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

/** Small deterministic shuffle seeded per question index
 * keeps options order varied but stable per run. */
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = arr.slice();
  let s = (seed >>> 0) + 1;
  for (let i = a.length - 1; i > 0; i--) {
    // Linear congruential generator
    s = (1103515245 * s + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Pick contextually similar distractors.
 *  - Prefers top-K most similar definitions
 *  - Then samples randomly from that top-set (seeded by question index)
 *  - Falls back to random long-enough strings if needed
 */
function similarDistractors(
  correct: string,
  pool: string[],
  k: number,
  seedForQuestion: number
): string[] {
  const MIN_LEN = 10;
  const cleanCorrect = normalizeSpaces(correct);

  const basePool = pool
    .map(s => normalizeSpaces(s))
    .filter(s => s && s !== cleanCorrect);

  const scored = basePool
    .map(s => ({ s, score: jaccard(cleanCorrect, s) }))
    .sort((a, b) => b.score - a.score);

  // Take a top window (10) and seeded-shuffle it to avoid the same 3 every time
  const topWindow = scored.slice(0, Math.max(10, k * 3)).map(x => x.s);
  let chosen: string[] = [];
  if (topWindow.length > 0) {
    const shuffled = seededShuffle(topWindow, seedForQuestion);
    chosen = shuffled.filter(s => s.length >= MIN_LEN).slice(0, k);
  }

  // Fallback: fill any missing with random (seeded)
  if (chosen.length < k) {
    const rest = seededShuffle(basePool, seedForQuestion + 7).filter(
      s => !chosen.includes(s) && s.length >= MIN_LEN
    );
    chosen.push(...rest.slice(0, k - chosen.length));
  }

  return Array.from(new Set(chosen)).slice(0, k);
}

/** -------------------------------------------------------
 *  Parsing
 * ------------------------------------------------------*/
type Pair = { term: string; def: string };

function splitFirst(haystack: string, delimiter: string): [string, string] | null {
  const i = haystack.indexOf(delimiter);
  if (i === -1) return null;
  return [haystack.slice(0, i), haystack.slice(i + delimiter.length)];
}

function stripLeadingTag(term: string): string {
  // Remove leading "[...]" tag if present, keep it if you prefer
  // e.g. "[Nederland 1948–2008] Vraag?" -> "Vraag?"
  const m = term.match(/^\[[^\]]+\]\s*(.*)$/);
  return m ? m[1] : term;
}

function parseLine(line: string): Pair | null {
  const raw = normalizeSpaces(line);

  // Prefer Q/A pattern: split at first "? "
  const qa = splitFirst(raw, "? ");
  if (qa) {
    const term = stripLeadingTag((qa[0] + "?").trim());
    const def = qa[1].trim();
    if (term && def) return { term, def };
  }

  // Tab
  if (raw.includes("\t")) {
    const parts = raw.split("\t").map(normalizeSpaces).filter(Boolean);
    if (parts.length >= 2) return { term: stripLeadingTag(parts[0]), def: parts.slice(1).join(" ") };
  }

  // Semicolon
  if (raw.includes(";")) {
    const m = raw.split(/;(.*)/);
    if (m && m.length >= 3) {
      const a = normalizeSpaces(m[0]);
      const b = normalizeSpaces(m[1]);
      if (a && b) return { term: stripLeadingTag(a), def: b };
    }
  }

  // CSV tolerant
  const csvMatch = raw.match(/^\s*"([^"]+)"\s*,\s*"([^"]+)"\s*$/)
                || raw.match(/^\s*([^,]+)\s*,\s*(.+)\s*$/);
  if (csvMatch) {
    const term = stripLeadingTag(normalizeSpaces(csvMatch[1]));
    const def  = normalizeSpaces(csvMatch[2]);
    if (term && def) return { term, def };
  }

  return null;
}

function parseQuizletLike(input: string): Pair[] {
  // Split by hard line breaks into candidate lines; allow multiple sentences per line
  const lines = (input || "")
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  const rows: Pair[] = [];
  for (const line of lines) {
    const pair = parseLine(line);
    if (pair) rows.push(pair);
  }

  // Also try to recover if user pasted a whole paragraph (no line breaks)
  if (rows.length <= 3) {
    const para = normalizeSpaces(input || "");
    // Split at pattern: "<vraag>? <antwoord>. " by capturing the first "? "
    const chunks = para.split(/(?<=\?)\s+(?=[^\?]+\.\s|\S)/);
    for (const chunk of chunks) {
      const p = parseLine(chunk);
      if (p) rows.push(p);
    }
    // Deduplicate
    const uniq: Pair[] = [];
    const seen = new Set<string>();
    for (const r of rows) {
      const key = r.term + "||" + r.def;
      if (!seen.has(key)) {
        seen.add(key);
        uniq.push(r);
      }
    }
    return uniq;
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

    // 1) Parse
    const pairs = parseQuizletLike(text);
    if (!pairs.length) {
      return res.status(400).json({ error: "No questions parsed from input" });
    }

    // 2) Create quiz
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

    // 3) Build items
    const allDefs = pairs.map(p => normalizeSpaces(p.def)).filter(Boolean);

    const items = pairs.map((row, idx) => {
      const prompt = normalizeSpaces(row.term);
      const correct = normalizeSpaces(row.def);

      if (mode === "mc" && generateMc) {
        const distractors = similarDistractors(correct, allDefs, 3, idx + 1234);
        const choices = seededShuffle([correct, ...distractors], idx + 5678);

        return {
          qtype: "mc",
          prompt,
          choices,
          answer: correct,
          explanation: null,
          sort_order: idx,
        };
      }

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
