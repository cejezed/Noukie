// server/routes/voiceTest.ts
import { Router } from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Huiswerkcoach-stijl: kort, concreet, motiverend
const SYSTEM_PROMPT = `
Je bent Huiswerkcoach, Nederlandstalig. Antwoord kort, concreet en motiverend.
Bij planning: geef 1 micro-actie of 1 vervolgvraag.
`;

router.post("/ingest", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No audio uploaded" });

    const tmp = path.join(process.cwd(), `tmp-${Date.now()}.bin`);
    fs.writeFileSync(tmp, req.file.buffer);

    // 1) Transcriptie
    const tr = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tmp) as any,
      model: "gpt-4o-transcribe", // evt. "whisper-1"
      // language: "nl"
    });
    fs.unlinkSync(tmp);

    const text = (tr as any)?.text ?? "";

    // 2) Antwoord van de agent
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: text || "Geen tekst gedetecteerd." }
      ]
    });

    const agentReply = resp.choices[0]?.message?.content?.trim() || "Geen antwoord.";
    const usage = resp.usage as any;

    res.json({
      text,
      agentReply,
      tokens: { input: usage?.prompt_tokens, output: usage?.completion_tokens }
    });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e?.message ?? "Server error" });
  }
});

export default router;
