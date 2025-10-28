import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// --------------------- Kleine utils ---------------------
function norm(s: string): string {
  return (s || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+\n/g, "\n")
    .trim();
}
function stripTag(s: string): string {
  // "[Nederland 1948–2008] Vraag?" -> "Vraag?"
  const m = s.match(/^\s*\[[^\]]+\]\s*(.*)$/);
  return m ? m[1] : s;
}
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = arr.slice();
  let s = (seed >>> 0) + 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (1103515245 * s + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function endsSentence(line: string): boolean {
  return /[.!?;:]$/.test(line.trim());
}

// ---------------- Parser voor jouw toetsformaat ----------------
type MC = { question: string; options: string[]; answer: string };

function parseToets(text: string): MC[] {
  const lines = norm(text).split(/\n/);

  const blocks: string[][] = [];
  let cur: string[] = [];
  for (const line of lines) {
    if (!line.trim()) continue; // oversla lege regels

    // Nieuwe vraag begint als er een vraagteken in zit én "Antwoord:" nog niet gezien is in het huidige blok
    const looksLikeQuestion = /\?/.test(line);
    const currentHasAnswer = cur.some((l) => /^Antwoord\s*:/i.test(l));

    if (cur.length === 0) {
      cur.push(line);
    } else if (looksLikeQuestion && !currentHasAnswer) {
      // start nieuw blok
      blocks.push(cur);
      cur = [line];
    } else {
      cur.push(line);
    }
  }
  if (cur.length) blocks.push(cur);

  // Verwerk blokken naar {question, options, answer}
  const result: MC[] = [];

  for (const rawBlock of blocks) {
    const block = rawBlock.slice();

    // 1) Vind antwoordregel
    const ansIdx = block.findIndex((l) => /^Antwoord\s*:/i.test(l));
    if (ansIdx === -1) continue;

    const ansLine = block[ansIdx];
    const ansText = norm(ansLine.replace(/^Antwoord\s*:\s*/i, ""));

    // 2) Vraag = eerste regel (strip tag), alles tot eerste '?' hoort erbij
    const qFirst = block[0] || "";
    // Soms staat direct na de vraag al het begin van optie 1 op dezelfde regel. Splits op eerste '? '
    const qm = qFirst.indexOf("?") >= 0 ? qFirst.indexOf("?") : qFirst.lastIndexOf("?");
    let question = qFirst;
    let optionStartInline = "";
    if (qm >= 0) {
      question = stripTag(qFirst.slice(0, qm + 1)).trim();
      optionStartInline = norm(qFirst.slice(qm + 1)); // rest op dezelfde regel als eerste optie-fragment
    } else {
      question = stripTag(qFirst).trim();
    }

    // 3) Verzamel optie-regels: alles tussen (regel 1 en "Antwoord:"),
    // inclusief mogelijke inline-start, en plak doorlopende regels aan elkaar
    const optionLines = block.slice(1, ansIdx);
    const merged: string[] = [];

    // Als inline deel lijkt op een optie, voeg als eerste toe
    if (optionStartInline) {
      merged.push(optionStartInline);
    }

    // Merge-regels: een optie kan uit meerdere regels bestaan (tot eindpunctuatie)
    let buf = "";
    const pushBuf = () => {
      const s = norm(buf);
      if (s) merged.push(s);
      buf = "";
    };

    for (let i = 0; i < optionLines.length; i++) {
      const line = optionLines[i].trim();
      if (!line) continue;

      if (!buf) {
        buf = line;
      } else {
        // heuristiek: als vorige niet eindigt op zinsafsluiter, is dit een vervolg van dezelfde optie
        if (!endsSentence(buf)) {
          buf = norm(buf + " " + line);
        } else {
          pushBuf();
          buf = line;
        }
      }

      // Als dit de laatste regel is, push resterende buffer
      if (i === optionLines.length - 1) {
        pushBuf();
      }
    }

    // Filter rommel
    const options = merged
      .map((s) => s.replace(/^[-•]\s*/, "")) // bullets weg
      .filter((s) => !!s && !/^Antwoord\s*:/i.test(s));

    // Soms staan er meer dan 4 regels (bv. extra uitleg), we houden de 4 meest plausibele:
    // - Eerst: alle regels die inhoud bevatten
    // - Als >4: kies de 4 langste, omdat heel korte snippers vaak geen op zichzelf staande optie zijn
    let picked = options.slice();
    if (picked.length > 4) {
      picked = picked
        .map((s, i) => ({ s, i, len: s.length }))
        .sort((a, b) => b.len - a.len)
        .slice(0, 4)
        .sort((a, b) => a.i - b.i)
        .map((x) => x.s);
    }

    // Als we nog steeds <4 hebben, laat blok vallen (onvoldoende opties)
    if (picked.length < 4) {
      // Laatste redmiddel: vul aan met duplicaten van de langste (zodat importer iig werkt)
      // (Je kunt dit desgewenst weglaten)
      while (picked.length < 4 && picked.length > 0) {
        picked.push(picked[picked.length - 1]);
      }
      if (picked.length < 4) continue;
    }

    // 4) Bepaal juiste optie:
    //    - match op exact gelijk
    //    - of: zoek de optie die de antwoord-text bevat of door het antwoord-text wordt bevat
    const normalizedAns = norm(ansText).toLowerCase();
    let correct = picked.find((o) => norm(o).toLowerCase() === normalizedAns);
    if (!correct) {
      correct = picked.find(
        (o) =>
          norm(o).toLowerCase().includes(normalizedAns) ||
          normalizedAns.includes(norm(o).toLowerCase())
      );
    }
    if (!correct) {
      // Als niets matcht, neem de eerste als fallback (zodat de vraag niet wegvalt)
      correct = picked[0];
    }

    // 5) Shuffle opties zodat juiste antwoord niet steeds op zelfde plek staat
    const shuffled = seededShuffle(picked, question.length + picked.join("|").length);

    // 6) Resultaat toevoegen
    result.push({
      question,
      options: shuffled,
      answer: correct,
    });
  }

  return result;
}

// --------------------- Endpoint ---------------------
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS (optioneel, zoals je eerdere endpoints)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-user-id");

  if (req.method === "OPTIONS") return res.status(204).end();

  const userId = (req.headers["x-user-id"] as string) || null;
  if (!userId) return res.status(401).json({ error: "Missing x-user-id" });

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { text, title, subject } = body || {};
    if (!text || !title || !subject) {
      return res.status(400).json({ error: "Missing text/title/subject" });
    }

    const items = parseToets(text);
    if (!items.length) {
      return res.status(400).json({ error: "Geen vragen gevonden in de invoer" });
    }

    // 1) Quiz aanmaken
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

    // 2) Vragen klaarmaken
    const payload = items.map((i, idx) => ({
      quiz_id: quiz.id,
      qtype: "mc",
      prompt: i.question,
      choices: JSON.stringify(i.options),
      answer: i.answer,
      explanation: null,
      sort_order: idx,
      is_published: true,
    }));

    // 3) Insert
    const { error: insErr } = await admin.from("study_questions").insert(payload);
    if (insErr) return res.status(400).json({ error: insErr.message });

    return res.status(201).json({
      ok: true,
      quiz_id: quiz.id,
      questions_detected: items.length,
    });
  } catch (e: any) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
