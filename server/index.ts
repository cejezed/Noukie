import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { startDailyReminderCron } from "./services/cron";
import { cronManager } from "./cronJobs";
import voiceTestRouter from "./routes/voiceTest";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import dotenv from 'dotenv';
dotenv.config();

const app = express();
app.use(express.json());
app.get("/api/ok", (_req, res) => res.type("text").send("OK"));
app.use(express.urlencoded({ extended: false }));
app.use("/api/voice-test", voiceTestRouter);

// Multer setup for audio uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

// Helper function for file extensions
function pickExt(file: any) {
  const byType: Record<string, string> = {
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
    return file.originalname.split(".").pop()?.toLowerCase();
  }
  return null;
}

// Voice ingest route
app.post("/api/ingest", upload.single("audio"), async (req, res) => {
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

    // Dynamic import of OpenAI
    const OpenAI = (await import("openai")).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Create temporary file
    const tmp = path.join(process.cwd(), `tmp-${Date.now()}.${ext}`);
    fs.writeFileSync(tmp, req.file.buffer);
    console.log("[ingest] saved", tmp);

    // Transcription
    const tr = await openai.audio.transcriptions
      .create({
        file: fs.createReadStream(tmp),
        model: "whisper-1",
      })
      .finally(() => {
        try { fs.unlinkSync(tmp); } catch {}
      });

    const text = tr?.text ?? "";

    // AI response
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: "Je bent Huiswerkcoach, Nederlandstalig. Antwoord kort, concreet en motiverend. Geef 1 micro-actie of 1 vervolgvraag.",
        },
        { role: "user", content: text || "Geen tekst gedetecteerd." },
      ],
    });

    const agentReply = resp.choices?.[0]?.message?.content?.trim() || "Geen antwoord.";
    res.json({ text, agentReply });
  } catch (e: any) {
    console.error("[ingest] error:", e?.message || e);
    res.status(500).json({ error: e?.message ?? "Server error" });
  }
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Start cron jobs
  if (app.get("env") === "production") {
    startDailyReminderCron();
    log("Daily reminder cron job started");
    cronManager.start();
  } else if (app.get("env") === "development") {
    // Start calendar sync in development too (with test schedule)
    cronManager.start();
  }

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports acre firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
