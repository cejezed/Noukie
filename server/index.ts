import "dotenv/config";
import express, { type Request, type Response } from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";

import { registerRoutes } from "./routes.ts";
import { setupVite, serveStatic, log } from "./vite";
import { startDailyReminderCron } from "./services/cron";
import voiceTestRouter from "./routes/voiceTest";

// Importeren van ALLE benodigde API handlers
import { handleCreateCourse, handleGetCourses, handleDeleteCourse } from "./handlers/courses.ts";
import { handleGetTasksForToday, handleGetTasksForWeek, handleUpdateTaskStatus, handleDeleteTask, handleCreateTask } from "./handlers/tasks.ts";
import { handleGetSchedule, handleCreateScheduleItem, handleDeleteScheduleItem, handleCancelScheduleItem } from "./handlers/schedule.ts";
import { handleChatRequest, explain } from "./handlers/chat.ts"; // explain toegevoegd

// ----------------------------------------------------------------------------
// App bootstrap
// ----------------------------------------------------------------------------
const app = express();
export default app; // ⬅️ Belangrijk voor Vercel serverless

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
  res.json({ ok: true, env: app.get("env"), time: new Date().toISOString() });
});

// --- API Routes ---
// Courses
app.post("/api/courses", handleCreateCourse);
app.get("/api/courses/:userId", handleGetCourses);
app.delete("/api/courses/:courseId", handleDeleteCourse);

// Tasks
app.post("/api/tasks", handleCreateTask);
app.get("/api/tasks/:userId/today", handleGetTasksForToday);
app.get("/api/tasks/:userId/week/:week_start/:week_end", handleGetTasksForWeek);
app.patch("/api/tasks/:taskId/status", handleUpdateTaskStatus);
app.delete("/api/tasks/:taskId", handleDeleteTask);

// Schedule
app.post("/api/schedule", handleCreateScheduleItem);
app.get("/api/schedule/:userId", handleGetSchedule);
app.delete("/api/schedule/:itemId", handleDeleteScheduleItem);
app.patch("/api/schedule/:itemId/cancel", handleCancelScheduleItem);

// AI & Voice
app.post("/api/chat", handleChatRequest);
app.post("/api/explain", explain); // duidelijke 400 bij ontbrekende {text}
app.use("/api/voice-test", voiceTestRouter);

// ----------------------------------------------------------------------------
// Voice ingest setup
// ----------------------------------------------------------------------------
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

// Voice ingest endpoint
app.post("/api/ingest", upload.single("audio"), async (req: Request, res: Response) => {
  try {
    console.log("Voice ingest request received");

    if (!req.file) {
      return res.status(400).json({ error: "No audio file provided" });
    }

    console.log("Audio file received:", {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
    });

    // TODO: Echte audioverwerking toevoegen
    const response = {
      text: "Audio ontvangen en verwerkt",
      agentReply: "Bedankt voor je voice check-in! Ik heb je opname ontvangen en verwerkt.",
    };

    res.json(response);
  } catch (error: any) {
    console.error("Voice ingest error:", error);
    res.status(500).json({ error: "Audio processing failed", details: error.message });
  }
});

// ----------------------------------------------------------------------------
// Static file serving en SPA fallback
// ----------------------------------------------------------------------------

// 🔹 Op Vercel: GEEN listen(), wél statics + SPA fallback meteen registreren
if (process.env.VERCEL) {
  // Client assets komen uit client/dist (Vite output)
  app.use(express.static("client/dist"));

  // SPA fallback NA alle API routes
  app.get("*", (req: Request, res: Response) => {
    if (req.path.startsWith("/api/")) {
      return res.status(404).json({ error: "API route not found" });
    }
    const indexPath = path.join(process.cwd(), "client", "dist", "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).json({
        error: "Application not built",
        message: "Run npm run build first",
      });
    }
  });
} else {
  // 🔹 Lokaal / niet-Vercel: behoud je bestaande dev/prod gedrag en listen()
  (async () => {
    const server = await registerRoutes(app);

    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      // Serve client statics in productie
      app.use(express.static("client/dist"));
    }

    // SPA fallback
    app.get("*", (req: Request, res: Response) => {
      if (req.path.startsWith("/api/")) {
        return res.status(404).json({ error: "API route not found" });
      }
      const indexPath = path.join(process.cwd(), "client", "dist", "index.html");
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).json({
          error: "Application not built",
          message: "Run npm run build first",
        });
      }
    });

    const port = parseInt(process.env.PORT || "5000", 10);
    server.listen({ port, host: "0.0.0.0", reusePort: true }, () => {
      log(`serving on port ${port}`);
    });
  })().catch((e) => {
    console.error("Fatal bootstrap error:", e);
    process.exit(1);
  });
}
