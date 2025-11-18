import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Import quizlet parser functions
type MC = { question: string; options: string[]; answer: string };
type Row = { prompt: string; answer: string; qtype: "mc" | "open"; choices?: string[] };

function norm(s: string): string {
  return (s || "").replace(/\r/g, "").trim();
}

function stripTag(s: string): string {
  const m = s.match(/^\s*\[[^\]]+\]\s*(.*)$/);
  return m ? m[1] : s;
}

function parseBulkLines(text: string, defaultMode: "open" | "mc"): Row[] {
  const lines = norm(text).split("\n").map((l) => l.trim()).filter(Boolean);
  const rows: Row[] = [];

  for (const line of lines) {
    if (/^antwo(ord)?\s*:/i.test(line)) continue;

    if (line.includes("|")) {
      const parts = line.split("|").map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 6) {
        const [prompt, A, B, C, D, correctRaw] = parts;
        const choices = [A, B, C, D];
        let correct = correctRaw;
        const letter = correct.toUpperCase();
        if (["A", "B", "C", "D"].includes(letter)) {
          const idx = { A: 0, B: 1, C: 2, D: 3 }[letter as "A" | "B" | "C" | "D"]!;
          correct = choices[idx];
        }
        rows.push({ prompt, answer: correct, qtype: "mc", choices });
        continue;
      }
      if (parts.length >= 3 && parts[2].toLowerCase() === "mc") {
        const prompt = parts[0];
        const answer = parts[1];
        const rest = parts.slice(3).join("|");
        const choices = rest.split(";").map((s) => s.trim()).filter(Boolean) || [];
        if (!choices.some((c) => c.toLowerCase() === answer.toLowerCase())) {
          choices.unshift(answer);
        }
        rows.push({ prompt, answer, qtype: "mc", choices });
        continue;
      }
      if (parts.length >= 2) {
        rows.push({ prompt: parts[0], answer: parts[1], qtype: defaultMode === "mc" ? "mc" : "open" });
        continue;
      }
    }

    if (line.includes("\t")) {
      const t = line.split("\t").map((p) => p.trim());
      if (t.length >= 6) {
        const [prompt, A, B, C, D, correctRaw] = t;
        const choices = [A, B, C, D];
        let correct = correctRaw;
        const letter = correct.toUpperCase();
        if (["A", "B", "C", "D"].includes(letter)) {
          const idx = { A: 0, B: 1, C: 2, D: 3 }[letter as "A" | "B" | "C" | "D"]!;
          correct = choices[idx];
        }
        rows.push({ prompt, answer: correct, qtype: "mc", choices });
        continue;
      }
      if (t.length >= 2) {
        rows.push({ prompt: t[0], answer: t[1], qtype: defaultMode === "mc" ? "mc" : "open" });
        continue;
      }
    }

    const commaParts = line.split(",").map((p) => p.trim());
    if (commaParts.length === 2 && /[?¿]$/.test(commaParts[0])) {
      rows.push({ prompt: commaParts[0], answer: commaParts[1], qtype: defaultMode === "mc" ? "mc" : "open" });
      continue;
    }

    const m = line.match(/^(.+?\?)\s+(.+)$/);
    if (m) {
      rows.push({ prompt: m[1].trim(), answer: m[2].trim(), qtype: defaultMode === "mc" ? "mc" : "open" });
    }
  }
  return rows;
}

function parseBlocks(text: string): MC[] {
  const lines = norm(text).split("\n");
  const blocks: string[][] = [];
  let cur: string[] = [];

  for (const line of lines) {
    const l = line.trim();
    if (!l) continue;
    const looksLikeQuestion = /\?/.test(l);
    const currentHasAnswer = cur.some((x) => /^Antwoord\s*:/i.test(x));

    if (cur.length === 0) {
      cur.push(l);
    } else if (looksLikeQuestion && !currentHasAnswer) {
      blocks.push(cur);
      cur = [l];
    } else {
      cur.push(l);
    }
  }
  if (cur.length) blocks.push(cur);

  const result: MC[] = [];

  for (const raw of blocks) {
    const ansIdx = raw.findIndex((l) => /^Antwoord\s*:/i.test(l));
    if (ansIdx === -1) continue;

    const ansText = norm(raw[ansIdx].replace(/^Antwoord\s*:\s*/i, ""));
    const header = raw[0] || "";
    const qm = header.indexOf("?") >= 0 ? header.indexOf("?") : header.lastIndexOf("?");
    let question = stripTag(header);
    let inline = "";
    if (qm >= 0) {
      question = stripTag(header.slice(0, qm + 1)).trim();
      inline = norm(header.slice(qm + 1));
    }

    const mid = raw.slice(1, ansIdx);
    const linesOpts = (inline ? [inline] : []).concat(mid);

    const opts: string[] = [];
    let buf = "";
    const push = () => { const s = buf.trim(); if (s) opts.push(s); buf = ""; };
    const ends = (s: string) => /[.!?;:]$/.test(s.trim());

    for (let i = 0; i < linesOpts.length; i++) {
      let ln = linesOpts[i].replace(/^[\-\u2022]?\s*([A-D][\)\.]|\([A-D]\))\s*/, "").trim();
      if (!ln) continue;
      if (!buf) buf = ln;
      else if (!ends(buf)) buf = (buf + " " + ln).trim();
      else { push(); buf = ln; }
      if (i === linesOpts.length - 1) push();
    }

    let picked = opts.slice(0, 4);
    if (picked.length < 4) {
      while (picked.length < 4 && opts.length) picked.push(opts[picked.length] || opts[0]);
      if (picked.length < 4) continue;
    }

    const letter = ansText.trim().toUpperCase();
    let correct = picked[0];
    if (["A", "B", "C", "D"].includes(letter)) {
      const idx = { A: 0, B: 1, C: 2, D: 3 }[letter as "A" | "B" | "C" | "D"]!;
      correct = picked[idx];
    } else {
      const n = ansText.toLowerCase();
      correct = picked.find((o) => o.toLowerCase() === n || o.toLowerCase().includes(n) || n.includes(o.toLowerCase())) || picked[0];
    }

    result.push({ question, options: picked, answer: correct });
  }
  return result;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-user-id");

  if (req.method === "OPTIONS") return res.status(204).end();

  const userId = (req.headers["x-user-id"] as string) || null;
  if (!userId) return res.status(401).json({ error: "Missing x-user-id" });

  // Determine route from path parameter
  const pathParam = req.query.path;
  const path = Array.isArray(pathParam) ? pathParam.join("/") : (pathParam || "");

  // Route: /api/quizzes/questions
  if (path === "questions") {
    if (req.method === "GET") {
      const quizId = req.query.quiz_id as string;
      const { data, error } = await admin.from("study_questions").select("*").eq("quiz_id", quizId).order("sort_order", { ascending: true });
      if (error) return res.status(400).json({ error: error.message });
      return res.status(200).json({ data });
    }

    if (req.method === "POST") {
      const body = req.body as { quiz_id: string; items: Array<{ qtype?: "mc" | "open"; prompt: string; choices?: string[]; answer?: string; explanation?: string; sort_order?: number }> };
      const { data: quiz, error: qerr } = await admin.from("study_quizzes").select("user_id").eq("id", body.quiz_id).single();
      if (qerr) return res.status(400).json({ error: qerr.message });
      if (quiz.user_id !== userId) return res.status(403).json({ error: "Not owner" });

      const payload = body.items.map((i, idx) => ({
        quiz_id: body.quiz_id,
        qtype: i.qtype ?? "mc",
        prompt: i.prompt,
        choices: i.choices ? JSON.stringify(i.choices) : null,
        answer: i.answer ?? null,
        explanation: i.explanation ?? null,
        sort_order: i.sort_order ?? idx,
      }));

      const { error } = await admin.from("study_questions").insert(payload);
      if (error) return res.status(400).json({ error: error.message });
      return res.status(201).json({ ok: true, count: payload.length });
    }

    return res.status(405).end("Method Not Allowed");
  }

  // Route: /api/quizzes/play
  if (path === "play") {
    if (req.method !== "POST") return res.status(405).end("Method Not Allowed");

    const body = req.body as { action: "start" | "answer" | "finish"; quiz_id?: string; result_id?: string; question_id?: string; given_answer?: string; mode?: string; time_remaining?: number };

    if (body.action === "start") {
      const { data, error } = await admin.from("study_results").insert([{ quiz_id: body.quiz_id!, user_id: userId }]).select("*").single();
      if (error) return res.status(400).json({ error: error.message });
      return res.status(201).json({ result: data });
    }

    if (body.action === "answer") {
      const { data: q, error: qerr } = await admin.from("study_questions").select("id,qtype,answer").eq("id", body.question_id!).single();
      if (qerr) return res.status(400).json({ error: qerr.message });
      const isCorrect = q.qtype === "mc" || q.qtype === "open" ? (q.answer ? String(body.given_answer ?? "").trim().toLowerCase() === String(q.answer).trim().toLowerCase() : null) : null;

      const { error } = await admin.from("study_answers").insert([{ result_id: body.result_id!, question_id: body.question_id!, given_answer: body.given_answer ?? null, is_correct: isCorrect }]);
      if (error) return res.status(400).json({ error: error.message });
      return res.status(201).json({ ok: true, is_correct: isCorrect });
    }

    if (body.action === "finish") {
      const { data: answers, error: aerr } = await admin.from("study_answers").select("is_correct").eq("result_id", body.result_id!);
      if (aerr) return res.status(400).json({ error: aerr.message });
      const total = answers.length;
      const correct = answers.filter((a) => a.is_correct === true).length;
      const percent = total > 0 ? Math.round((correct / total) * 10000) / 100 : 0;

      const { data, error } = await admin.from("study_results").update({ finished_at: new Date().toISOString(), total, correct, percent }).eq("id", body.result_id!).eq("user_id", userId).select("*").single();
      if (error) return res.status(400).json({ error: error.message });

      // Award XP and Playtime
      let xpAwarded = 0, playtimeAwarded = 0, leveledUp = false, newLevel = 1;
      try {
        const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : (req.headers.origin || "http://localhost:5000");
        const isGameMode = body.mode === "game";
        const baseXP = isGameMode ? 75 : 50;
        const timeRemaining = body.time_remaining || 0;
        const speedBonus = isGameMode && timeRemaining > 30 ? 10 : 0;
        const totalXP = baseXP + speedBonus;

        const xpResponse = await fetch(`${baseUrl}/api/profile/xp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, delta: totalXP, reason: isGameMode ? "quiz_game_completed" : "quiz_completed", meta: { quizId: body.quiz_id, resultId: body.result_id, score: percent, mode: body.mode, timeRemaining } }),
        });
        if (xpResponse.ok) {
          const xpData = await xpResponse.json();
          xpAwarded = totalXP;
          leveledUp = xpData.leveledUp || false;
          newLevel = xpData.newLevel || 1;
        }

        const playtimeAmount = isGameMode ? 4 : 3;
        const playtimeResponse = await fetch(`${baseUrl}/api/playtime/add`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, delta: playtimeAmount, reason: isGameMode ? "quiz_game_completed" : "quiz_completed", meta: { quizId: body.quiz_id, resultId: body.result_id, mode: body.mode } }),
        });
        if (playtimeResponse.ok) playtimeAwarded = playtimeAmount;
      } catch (err) {
        console.error("Failed to award XP/playtime:", err);
      }

      return res.status(200).json({ result: data, rewards: { xpAwarded, playtimeAwarded, leveledUp, newLevel } });
    }

    return res.status(400).json({ error: "Invalid action" });
  }

  // Route: /api/quizzes/quizlet
  if (path === "quizlet") {
    if (req.method !== "POST") return res.status(405).end("Method Not Allowed");

    try {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const { subject, chapter, title, description, mode = "open", text } = body || {};

      if (!subject || !chapter || !title || !text) {
        return res.status(400).json({ error: "Missing subject/chapter/title/text" });
      }

      let mcBlocks = parseBlocks(text);
      const rows = parseBulkLines(text, mode);

      if (!mcBlocks.length && !rows.length) {
        return res.status(400).json({ error: "Geen vragen gedetecteerd in de invoer." });
      }

      const { data: quiz, error: qErr } = await admin.from("study_quizzes").insert({ title, subject, chapter, description: description || null, owner_id: userId, is_published: false }).select("*").single();
      if (qErr || !quiz) return res.status(400).json({ error: qErr?.message || "quiz insert failed" });

      const items: any[] = [];
      let sort = 0;

      for (const b of mcBlocks) {
        items.push({ quiz_id: quiz.id, qtype: "mc", prompt: b.question, choices: JSON.stringify(b.options), answer: b.answer, explanation: null, sort_order: sort++, is_published: true });
      }

      for (const r of rows) {
        if (r.qtype === "mc" && r.choices && r.choices.length > 0) {
          items.push({ quiz_id: quiz.id, qtype: "mc", prompt: r.prompt, choices: JSON.stringify(r.choices), answer: r.answer, explanation: null, sort_order: sort++, is_published: true });
        } else if (r.qtype === "mc") {
          items.push({ quiz_id: quiz.id, qtype: "mc", prompt: r.prompt, choices: JSON.stringify([r.answer]), answer: r.answer, explanation: null, sort_order: sort++, is_published: true });
        } else {
          items.push({ quiz_id: quiz.id, qtype: "open", prompt: r.prompt, answer: r.answer, explanation: null, sort_order: sort++, is_published: true });
        }
      }

      if (items.length) {
        const { error: insErr } = await admin.from("study_questions").insert(items);
        if (insErr) return res.status(400).json({ error: insErr.message });
      }

      return res.status(201).json({ ok: true, quiz_id: quiz.id, questions: items.length });
    } catch (e: any) {
      return res.status(500).json({ error: String(e?.message || e) });
    }
  }

  // Route: /api/quizzes (root - list/create/delete)
  if (path === "" || !path) {
    if (req.method === "GET") {
      const subject = (req.query.subject as string) || "";
      const { data, error } = await admin.from("study_quizzes").select("*").ilike("subject", subject || "%").order("created_at", { ascending: false });
      if (error) return res.status(400).json({ error: error.message });
      return res.status(200).json({ data });
    }

    if (req.method === "POST") {
      type Body = { id?: string; subject: string; chapter: string; title: string; description?: string; is_published?: boolean; assigned_to?: string | null; available_from?: string | null; available_until?: string | null };
      const body = req.body as Body;

      if (body.id) {
        const { data, error } = await admin.from("study_quizzes").update({ subject: body.subject, chapter: body.chapter, title: body.title, description: body.description ?? null, is_published: body.is_published ?? false, assigned_to: body.assigned_to ?? null, available_from: body.available_from ?? null, available_until: body.available_until ?? null, updated_at: new Date().toISOString() }).eq("id", body.id).eq("user_id", userId).select("*").single();
        if (error) return res.status(400).json({ error: error.message });
        return res.status(200).json({ data });
      } else {
        const { data, error } = await admin.from("study_quizzes").insert([{ user_id: userId, subject: body.subject, chapter: body.chapter, title: body.title, description: body.description ?? null, is_published: body.is_published ?? false, assigned_to: body.assigned_to ?? null, available_from: body.available_from ?? null, available_until: body.available_until ?? null }]).select("*").single();
        if (error) return res.status(400).json({ error: error.message });
        return res.status(201).json({ data });
      }
    }

    if (req.method === "DELETE") {
      const id = (req.query.id as string) || "";
      if (!id) return res.status(400).json({ error: "Missing ?id" });

      const { data: q, error: qErr } = await admin.from("study_quizzes").select("id,user_id").eq("id", id).single();
      if (qErr) return res.status(400).json({ error: qErr.message });
      if (q.user_id !== userId) return res.status(403).json({ error: "Not owner" });

      const { error: delErr } = await admin.from("study_quizzes").delete().eq("id", id);
      if (delErr) return res.status(400).json({ error: delErr.message });

      return res.status(204).end();
    }

    return res.status(405).end("Method Not Allowed");
  }

  return res.status(404).json({ error: "Not found" });
}
