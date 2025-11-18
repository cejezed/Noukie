import { createClient } from "@supabase/supabase-js";
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
function norm(s) {
    return (s || "").replace(/\r/g, "").trim();
}
function stripTag(s) {
    const m = s.match(/^\s*\[[^\]]+\]\s*(.*)$/);
    return m ? m[1] : s;
}
/** --------- Per-regel parsing: Q/A, MC met pipes of TSV ---------- */
function parseBulkLines(text, defaultMode) {
    const lines = norm(text)
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
    const rows = [];
    for (const line of lines) {
        if (/^antwo(ord)?\s*:/i.test(line))
            continue; // hoort bij blok-parser
        // Pipe: Vraag | A | B | C | D | correct  (MC)
        if (line.includes("|")) {
            const parts = line.split("|").map((p) => p.trim()).filter(Boolean);
            if (parts.length >= 6) {
                const [prompt, A, B, C, D, correctRaw] = parts;
                const choices = [A, B, C, D];
                let correct = correctRaw;
                const letter = correct.toUpperCase();
                if (["A", "B", "C", "D"].includes(letter)) {
                    const idx = { A: 0, B: 1, C: 2, D: 3 }[letter];
                    correct = choices[idx];
                }
                rows.push({ prompt, answer: correct, qtype: "mc", choices });
                continue;
            }
            // Pipe: Vraag | Antwoord | mc | A;B;C
            if (parts.length >= 3 && parts[2].toLowerCase() === "mc") {
                const prompt = parts[0];
                const answer = parts[1];
                const rest = parts.slice(3).join("|");
                const choices = rest
                    .split(";")
                    .map((s) => s.trim())
                    .filter(Boolean) || [];
                if (!choices.some((c) => c.toLowerCase() === answer.toLowerCase())) {
                    choices.unshift(answer);
                }
                rows.push({ prompt, answer, qtype: "mc", choices });
                continue;
            }
            // Pipe: Vraag | Antwoord  (open)
            if (parts.length >= 2) {
                rows.push({ prompt: parts[0], answer: parts[1], qtype: defaultMode === "mc" ? "mc" : "open" });
                continue;
            }
        }
        // TSV: Vraag \t A \t B \t C \t D \t correct
        if (line.includes("\t")) {
            const t = line.split("\t").map((p) => p.trim());
            if (t.length >= 6) {
                const [prompt, A, B, C, D, correctRaw] = t;
                const choices = [A, B, C, D];
                let correct = correctRaw;
                const letter = correct.toUpperCase();
                if (["A", "B", "C", "D"].includes(letter)) {
                    const idx = { A: 0, B: 1, C: 2, D: 3 }[letter];
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
        // Comma: Vraag,Antwoord (exact 1 komma en vraag eindigt met '?')
        const commaParts = line.split(",").map((p) => p.trim());
        if (commaParts.length === 2 && /[?¿]$/.test(commaParts[0])) {
            rows.push({ prompt: commaParts[0], answer: commaParts[1], qtype: defaultMode === "mc" ? "mc" : "open" });
            continue;
        }
        // "Vraag? Antwoord"
        const m = line.match(/^(.+?\?)\s+(.+)$/);
        if (m) {
            rows.push({ prompt: m[1].trim(), answer: m[2].trim(), qtype: defaultMode === "mc" ? "mc" : "open" });
            continue;
        }
    }
    return rows;
}
/** --------- Blok-parser: Chat-stijl A/B/C/D + "Antwoord:" ---------- */
function parseBlocks(text) {
    const lines = norm(text).split("\n");
    const blocks = [];
    let cur = [];
    for (const line of lines) {
        const l = line.trim();
        if (!l)
            continue;
        const looksLikeQuestion = /\?/.test(l);
        const currentHasAnswer = cur.some((x) => /^Antwoord\s*:/i.test(x));
        if (cur.length === 0) {
            cur.push(l);
        }
        else if (looksLikeQuestion && !currentHasAnswer) {
            blocks.push(cur);
            cur = [l];
        }
        else {
            cur.push(l);
        }
    }
    if (cur.length)
        blocks.push(cur);
    const result = [];
    for (const raw of blocks) {
        const ansIdx = raw.findIndex((l) => /^Antwoord\s*:/i.test(l));
        if (ansIdx === -1)
            continue;
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
        // haal A/B/C/D uit regels (A. / A) / - A etc.)
        const opts = [];
        let buf = "";
        const push = () => {
            const s = buf.trim();
            if (s)
                opts.push(s);
            buf = "";
        };
        const ends = (s) => /[.!?;:]$/.test(s.trim());
        for (let i = 0; i < linesOpts.length; i++) {
            let ln = linesOpts[i].replace(/^[\-\u2022]?\s*([A-D][\)\.]|\([A-D]\))\s*/, "").trim();
            if (!ln)
                continue;
            if (!buf) {
                buf = ln;
            }
            else {
                if (!ends(buf))
                    buf = (buf + " " + ln).trim();
                else {
                    push();
                    buf = ln;
                }
            }
            if (i === linesOpts.length - 1)
                push();
        }
        let picked = opts.slice(0, 4);
        if (picked.length < 4) {
            while (picked.length < 4 && opts.length)
                picked.push(opts[picked.length] || opts[0]);
            if (picked.length < 4)
                continue;
        }
        // answer kan A/B/C/D of tekstfragment zijn
        const letter = ansText.trim().toUpperCase();
        let correct = picked[0];
        if (["A", "B", "C", "D"].includes(letter)) {
            const idx = { A: 0, B: 1, C: 2, D: 3 }[letter];
            correct = picked[idx];
        }
        else {
            const n = ansText.toLowerCase();
            correct = picked.find((o) => o.toLowerCase() === n || o.toLowerCase().includes(n) || n.includes(o.toLowerCase())) || picked[0];
        }
        result.push({ question, options: picked, answer: correct });
    }
    return result;
}
export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-user-id");
    if (req.method === "OPTIONS")
        return res.status(204).end();
    if (req.method !== "POST")
        return res.status(405).end("Method Not Allowed");
    const userId = req.headers["x-user-id"] || null;
    if (!userId)
        return res.status(401).json({ error: "Missing x-user-id" });
    try {
        const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
        const { subject, chapter, title, description, mode = "open", // "open" | "mc" (default voor regels zonder choices)
        generateMc = false, // genegeerd in deze variant (we genereren geen afleiders)
        text, } = body || {};
        if (!subject || !chapter || !title || !text) {
            return res.status(400).json({ error: "Missing subject/chapter/title/text" });
        }
        // 1) Probeer chat-blok parser (A–D + Antwoord:)
        let mcBlocks = parseBlocks(text);
        // 2) Per-regel parser
        const rows = parseBulkLines(text, mode);
        if (!mcBlocks.length && !rows.length) {
            return res.status(400).json({ error: "Geen vragen gedetecteerd in de invoer." });
        }
        // 3) Quiz aanmaken
        const { data: quiz, error: qErr } = await admin
            .from("study_quizzes")
            .insert({
            title,
            subject,
            chapter,
            description: description || null,
            owner_id: userId,
            is_published: false,
        })
            .select("*")
            .single();
        if (qErr || !quiz)
            return res.status(400).json({ error: qErr?.message || "quiz insert failed" });
        // 4) Items opbouwen
        const items = [];
        let sort = 0;
        // 4a) uit blokken (altijd MC met jouw keuzes)
        for (const b of mcBlocks) {
            items.push({
                quiz_id: quiz.id,
                qtype: "mc",
                prompt: b.question,
                choices: JSON.stringify(b.options),
                answer: b.answer,
                explanation: null,
                sort_order: sort++,
                is_published: true,
            });
        }
        // 4b) uit regels
        for (const r of rows) {
            if (r.qtype === "mc" && r.choices && r.choices.length > 0) {
                items.push({
                    quiz_id: quiz.id,
                    qtype: "mc",
                    prompt: r.prompt,
                    choices: JSON.stringify(r.choices),
                    answer: r.answer,
                    explanation: null,
                    sort_order: sort++,
                    is_published: true,
                });
            }
            else if (r.qtype === "mc" && (!r.choices || r.choices.length === 0)) {
                // Jij hebt MC gekozen zonder choices → alleen juiste antwoord als enige optie
                items.push({
                    quiz_id: quiz.id,
                    qtype: "mc",
                    prompt: r.prompt,
                    choices: JSON.stringify([r.answer]),
                    answer: r.answer,
                    explanation: null,
                    sort_order: sort++,
                    is_published: true,
                });
            }
            else {
                // open vraag
                items.push({
                    quiz_id: quiz.id,
                    qtype: "open",
                    prompt: r.prompt,
                    answer: r.answer,
                    explanation: null,
                    sort_order: sort++,
                    is_published: true,
                });
            }
        }
        // 5) Insert alle vragen
        if (items.length) {
            const { error: insErr } = await admin.from("study_questions").insert(items);
            if (insErr)
                return res.status(400).json({ error: insErr.message });
        }
        return res.status(201).json({
            ok: true,
            quiz_id: quiz.id,
            questions: items.length,
        });
    }
    catch (e) {
        return res.status(500).json({ error: String(e?.message || e) });
    }
}
