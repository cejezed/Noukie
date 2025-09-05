import "dotenv/config";
import express, { type Request, type Response, type NextFunction } from "express";
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
import { handleChatRequest } from "./handlers/chat.ts";

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
  res.json({ ok: true, env: app.get("env"), time: new Date().toISOString() });
  });

  // --- API Routes ---
  // Courses
  app.post('/api/courses', handleCreateCourse);
  app.get('/api/courses/:userId', handleGetCourses);
  app.delete('/api/courses/:courseId', handleDeleteCourse);

  // Tasks
  app.post('/api/tasks', handleCreateTask);
  app.get('/api/tasks/:userId/today', handleGetTasksForToday);
  app.get('/api/tasks/:userId/week/:week_start/:week_end', handleGetTasksForWeek);
  app.patch('/api/tasks/:taskId/status', handleUpdateTaskStatus);
  app.delete('/api/tasks/:taskId', handleDeleteTask);

  // Schedule
  app.post('/api/schedule', handleCreateScheduleItem);
  app.get('/api/schedule/:userId', handleGetSchedule);
  app.delete('/api/schedule/:itemId', handleDeleteScheduleItem);
  app.patch('/api/schedule/:itemId/cancel', handleCancelScheduleItem);

  // AI & Voice
  app.post('/api/chat', handleChatRequest);
  app.use("/api/voice-test", voiceTestRouter);

  // ----------------------------------------------------------------------------
  // Voice ingest (blijft ongewijzigd)
  // ----------------------------------------------------------------------------
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
  // ... (de rest van uw voice ingest logica blijft hier ongewijzigd) ...

  // ----------------------------------------------------------------------------
  // De rest van de server logica blijft ongewijzigd...
  // Voeg dit toe na je API routes, voor registerRoutes
app.use(express.static('dist'));

// SPA fallback - serveer index.html voor alle niet-API routes
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
});
  // ----------------------------------------------------------------------------
  (async () => {
    const server = await registerRoutes(app);
      // ... (logging, error handling, Vite setup, etc. blijven hier ongewijzigd) ...
        if (app.get("env") === "development") {
            await setupVite(app, server);
              } else {
                  serveStatic(app);
                    }
                      const port = parseInt(process.env.PORT || "5000", 10);
                        server.listen({ port, host: "0.0.0.0", reusePort: true }, () => {
                            log(`serving on port ${port}`);
                              });
                              })().catch((e) => {
                                console.error("Fatal bootstrap error:", e);
                                  process.exit(1);
                                  });

