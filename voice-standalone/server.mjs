import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Static files (index.html en js/css)
const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));

// Healthcheck
app.get("/health", (_req, res) => {
  console.log("[health] hit");
  res.json({
    ok: true,
    env: process.env.OPENAI_API_KEY ? "OPENAI ok" : "OPENAI missing",
  });
});

// Upload (multer in memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

// helper: bepaal extensie
function pickExt(file) {
  const byType = {
    "audio/webm": "webm",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/mp4": "m4a",
    "audio/x-m4a": "m4a",
    "video/mp4": "mp4",
  };
  if (file.mimetype && byType[file.mimetype]) return byType[file.mimetype];
  if (file.originalname && file.originalname.includes(".")) {
    return file.originalname.split(".").pop().toLowerCase();
  }
  return null;
}

// Ingest endpoint
app.post("/ingest", upload.single("audio"), async (req, res) => {
  console.log("[ingest] start", req.file?.mimetype, req.file?.originalname);
  try {
    if (!req.file) return res.status(400).json({ error: "No audio uploaded" });
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY missing" });
    }

    const ext = pickExt(req.file);
    const allowed = new Set(["mp3","m4a","wav","webm","mp4","mpeg","mpga"]);
    if (!ext || !allowed.has(ext)) {
      return res.status(415).json({
        error: `Unsupported format "${ext ?? 'unknown'}". Use one of: mp3, m4a, wav, webm, mp4, mpeg/mpga.`,
      });
    }

    // Lazy import OpenAI
    const OpenAI = (await import("openai")).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // tijdelijk bestand met juiste extensie
    const tmp = path.join(process.cwd(), `tmp-${Date.now()}.${ext}`);
    fs.writeFileSync(tmp, req.file.buffer);
    console.log("[ingest] saved", tmp);

    // transcriptie
    const tr = await openai.audio.transcriptions
      .create({
        file: fs.createReadStream(tmp),
        model: "gpt-4o-transcribe", // of "whisper-1"
      })
      .finally(() => {
        try { fs.unlinkSync(tmp); } catch {}
      });

    const text = tr?.text ?? "";

    // kort AI antwoord
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content:
            "Je bent Huiswerkcoach, Nederlandstalig. Antwoord kort, concreet en motiverend. Geef 1 micro-actie of 1 vervolgvraag.",
        },
        { role: "user", content: text || "Geen tekst gedetecteerd." },
      ],
    });

    const agentReply =
      resp.choices?.[0]?.message?.content?.trim() || "Geen antwoord.";
    res.json({ text, agentReply });
  } catch (e) {
    console.error("[ingest] error:", e?.message || e);
    res.status(500).json({ error: e?.message ?? "Server error" });
  }
});

// Server starten
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Voice standalone listening on :${PORT}`);
  console.log(`Public dir: ${publicDir}`);
});
