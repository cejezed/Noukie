// server/index.ts
import "dotenv/config";
import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";

import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { startDailyReminderCron } from "./services/cron";
import { cronManager } from "./cronJobs";
import voiceTestRouter from "./routes/voiceTest";

// ----------------------------------------------------------------------------
// App bootstrap
// ----------------------------------------------------------------------------
const app = express();

// Basis security/infra
app.disable("x-powered-by");
app.set("trust proxy", true);

// Parsers ALTIJD vóór routes
app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

// Health/ok
app.get("/api/ok", (_req, res) => res.type("text").send("OK"));
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    env: app.get("env"),
    time: new Date().toISOString(),
  });
});

// ----------------------------------------------------------------------------
// Voice ingest (multer + OpenAI Whisper) – ongewijzigde logica, opgeschoond
// ----------------------------------------------------------------------------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
});

function pickExt(file: Express.Multer.File | undefined) {
  if (!file) return null;
  const byType: Record<string, string> = {
    "audio/webm": "webm",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/mp4": "m4a",
    "audio/x-m4a": "m4a",
    "video/mp4": "mp4",
    "audio/mpga": "mp3",
    "audio/mpeg3": "mp3",
  };
  if (file.mimetype && byType[file.mimetype]) return byType[file.mimetype];
  if (file.originalname && file.originalname.includes(".")) {
    return file.originalname.split(".").pop()?.toLowerCase() ?? null;
  }
  return null;
}

// Losse testroute (zoals bij jou)
app.use("/api/voice-test", voiceTestRouter);

// Ingest route
app.post("/api/ingest", upload.single("audio"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log("[ingest] start", req.file?.mimetype, req.file?.originalname);

    if (!req.file) return res.status(400).json({ error: "No audio uploaded" });
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY missing" });
    }

    const ext = pickExt(req.file);
    const allowed = new Set(["mp3", "m4a", "wav", "webm", "mp4", "mpeg", "mpga"]);
    if (!ext || !allowed.has(ext)) {
      return res.status(415).json({
        error: `Unsupported format "${ext ?? "unknown"}". Use one of: mp3, m4a, wav, webm, mp4, mpeg/mpga.`,
      });
    }

    // Dynamic import OpenAI
    const OpenAI = (await import("openai")).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

    // Tijdelijk bestand voor Whisper
    const tmp = path.join(process.cwd(), `tmp-${Date.now()}.${ext}`);
    fs.writeFileSync(tmp, req.file.buffer);
    console.log("[ingest] saved", tmp);

    try {
      const tr = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tmp),
        model: "whisper-1",
      });

      const text = tr?.text ?? "";

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
      return res.json({ text, agentReply });
    } finally {
      try {
        fs.unlinkSync(tmp);
      } catch {
        // negeer
      }
    }
  } catch (err) {
    return next(err);
  }
});

// ----------------------------------------------------------------------------
// Routes registreren (API's zoals /api/tasks)
// ----------------------------------------------------------------------------
// Belangrijk: registerRoutes moet je subrouters mounten (bijv. app.use("/api", router))
// en geeft het Node http(s) server object terug (zoals in jouw bestaande code).
(async () => {
  const server = await registerRoutes(app);

  // ----------------------------------------------------------------------------
  // API logging (ná routes, zodat response body/status correct is)
  // ----------------------------------------------------------------------------
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    const reqPath = req.path;
    let capturedJson: any;

    const originalJson = res.json.bind(res);
    (res as any).json = (body: any) => {
      capturedJson = body;
      return originalJson(body);
    };

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (reqPath.startsWith("/api")) {
        let line = `${req.method} ${reqPath} ${res.statusCode} in ${duration}ms`;
        if (capturedJson && typeof capturedJson === "object") {
          try {
            const s = JSON.stringify(capturedJson);
            line += ` :: ${s.length > 200 ? s.slice(0, 200) + "…" : s}`;
          } catch {
            // ignore
          }
        }
        log(line);
      }
    });

    next();
  });

  // ----------------------------------------------------------------------------
  // Globale error-handler (als allerlaatste vóór Vite/static & listen)
  // ----------------------------------------------------------------------------
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err?.status || err?.statusCode || 500;

    if (app.get("env") === "development") {
      console.error("[API ERROR]", {
        status,
        message: err?.message,
        stack: err?.stack,
        cause: err?.cause,
      });
      return res.status(status).json({
        error: err?.message || "Internal Server Error",
        stack: err?.stack,
      });
    }

    console.error("[API ERROR]", err?.message || err);
    return res.status(status).json({ error: "Internal Server Error" });
  });

  // ----------------------------------------------------------------------------
  // Cron jobs
  // ----------------------------------------------------------------------------
  if (app.get("env") === "production") {
    startDailyReminderCron();
    log("Daily reminder cron job started");
    cronManager.start();
  } else {
    // In development alleen cronManager als je dat wilt testen
    cronManager.start();
  }

  // ----------------------------------------------------------------------------
  // Vite dev server of statische build serveren
  // ----------------------------------------------------------------------------
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ----------------------------------------------------------------------------
  // Start server
  // ----------------------------------------------------------------------------
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    }
  );
})().catch((e) => {
  console.error("Fatal bootstrap error:", e);
  process.exit(1);
});
