import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import fs from "fs";
import path from "path";
import { storage } from "./storage";
import { transcribeAudio, generatePlan, generateExplanation } from "./services/openai";
import { checkAndSendReminders } from "./services/cron";
import { signUp as supabaseSignUp, signIn as supabaseSignIn, signOut as supabaseSignOut } from "./services/supabase";
import { insertTaskSchema, insertSessionSchema, insertScheduleSchema, insertUserSchema, insertCourseSchema } from "@shared/schema";

const upload = multer({ dest: 'uploads/' });

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "OK", timestamp: new Date().toISOString() });
  });

  // Authentication routes
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { email, password, name, role } = req.body;
      
      if (!email || !password || !name || !role) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Create user in Supabase Auth
      const supabaseResult = await supabaseSignUp(email, password, name, role);
      
      // TODO: Sync with custom users table later when database connection is fixed
      res.json(supabaseResult);
    } catch (error) {
      console.error("Signup error:", error);
      res.status(500).json({ error: (error as Error).message || "Failed to create account" });
    }
  });

  app.post("/api/auth/signin", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ error: "Missing email or password" });
      }

      const result = await supabaseSignIn(email, password);
      res.json(result);
    } catch (error) {
      console.error("Signin error:", error);
      res.status(500).json({ error: (error as Error).message || "Failed to sign in" });
    }
  });

  app.post("/api/auth/signout", async (req, res) => {
    try {
      await supabaseSignOut();
      res.json({ success: true });
    } catch (error) {
      console.error("Signout error:", error);
      res.status(500).json({ error: (error as Error).message || "Failed to sign out" });
    }
  });

  // ASR endpoint
  app.post("/api/asr", upload.single("audio"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No audio file provided" });
      }

      const { text } = await transcribeAudio(req.file.path);
      
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      
      res.json({ transcript: text });
    } catch (error) {
      console.error("ASR error:", error);
      res.status(500).json({ error: "Failed to transcribe audio" });
    }
  });

  // Planning endpoint
  app.post("/api/plan", async (req, res) => {
    try {
      const { transcript, date, userId } = req.body;
      
      if (!transcript || !userId) {
        return res.status(400).json({ error: "Missing transcript or userId" });
      }

      const plan = await generatePlan(transcript, date || new Date().toISOString());
      
      // Create tasks in database
      const createdTasks = [];
      for (const taskData of plan.tasks) {
        // Find course by name
        const courses = await storage.getCoursesByUserId(userId);
        const course = courses.find(c => c.name === taskData.course);
        
        const task = await storage.createTask({
          userId,
          courseId: course?.id || null,
          title: taskData.title,
          dueAt: new Date(taskData.due_at),
          estMinutes: taskData.est_minutes,
          priority: taskData.priority,
          source: "check-in",
          status: "todo"
        });
        createdTasks.push(task);
      }

      // Create session record
      await storage.createSession({
        userId,
        transcript,
        summary: plan.coach_text,
        coachText: plan.coach_text
      });

      res.json({
        tasks: createdTasks,
        coach_text: plan.coach_text
      });
    } catch (error) {
      console.error("Planning error:", error);
      res.status(500).json({ error: "Failed to create plan" });
    }
  });

  // TTS endpoint
  app.post("/api/tts", async (req, res) => {
    try {
      const { text } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: "No text provided" });
      }

      // For now, return a dummy audio URL
      // In production, use Azure TTS or similar
      res.json({ audioUrl: "/api/tts/dummy.mp3" });
    } catch (error) {
      console.error("TTS error:", error);
      res.status(500).json({ error: "Failed to generate speech" });
    }
  });

  // OCR endpoint
  app.post("/api/ocr", upload.single("image"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image file provided" });
      }

      // Dummy OCR response for now
      const dummyText = "Bereken de sinus van hoek A in een rechthoekige driehoek waar de overstaande zijde 6 cm is en de schuine zijde 10 cm.";
      
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      
      res.json({ text: dummyText });
    } catch (error) {
      console.error("OCR error:", error);
      res.status(500).json({ error: "Failed to process image" });
    }
  });

  // Explanation endpoint
  app.post("/api/explain", async (req, res) => {
    try {
      const { mode, text, ocrText, course } = req.body;
      
      if (!mode || (!text && !ocrText)) {
        return res.status(400).json({ error: "Missing required parameters" });
      }

      const explanation = await generateExplanation(mode, text, ocrText, course);
      
      res.json(explanation);
    } catch (error) {
      console.error("Explanation error:", error);
      res.status(500).json({ error: "Failed to generate explanation" });
    }
  });

  // Courses management
  app.get("/api/courses/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const courses = await storage.getCoursesByUserId(userId);
      res.json(courses);
    } catch (error) {
      console.error("Courses fetch error:", error);
      res.status(500).json({ error: "Failed to fetch courses" });
    }
  });

  app.post("/api/courses", async (req, res) => {
    try {
      // Skip validation for in-memory storage to allow flexible IDs
      const courseData = req.body;
      const created = await storage.createCourse(courseData);
      res.json(created);
    } catch (error) {
      console.error("Course create error:", error);
      res.status(500).json({ error: "Failed to create course" });
    }
  });

  app.delete("/api/courses/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteCourse(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Course delete error:", error);
      res.status(500).json({ error: "Failed to delete course" });
    }
  });

  // Schedule management
  app.get("/api/schedule/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const scheduleItems = await storage.getScheduleByUserId(userId);
      res.json(scheduleItems);
    } catch (error) {
      console.error("Schedule fetch error:", error);
      res.status(500).json({ error: "Failed to fetch schedule" });
    }
  });

  app.post("/api/schedule", async (req, res) => {
    try {
      // Skip validation for in-memory storage to allow non-UUID IDs
      const scheduleData = req.body;
      const created = await storage.createScheduleItem(scheduleData);
      res.json(created);
    } catch (error) {
      console.error("Schedule create error:", error);
      res.status(500).json({ error: "Failed to create schedule item" });
    }
  });

  app.get("/api/schedule/:userId/today", async (req, res) => {
    try {
      const { userId } = req.params;
      const today = new Date();
      const dayOfWeek = today.getDay(); // 0=Sunday, 1=Monday, etc
      const adjustedDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek; // Convert Sunday (0) to 7
      
      console.log(`Today is ${today.toDateString()}, day of week: ${dayOfWeek}, adjusted: ${adjustedDayOfWeek}`);
      
      const scheduleItems = await storage.getScheduleByDay(userId, adjustedDayOfWeek);
      console.log(`Found ${scheduleItems.length} schedule items for today:`, scheduleItems);
      
      res.json(scheduleItems);
    } catch (error) {
      console.error("Today schedule fetch error:", error);
      res.status(500).json({ error: "Failed to fetch today's schedule" });
    }
  });

  app.delete("/api/schedule/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteScheduleItem(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Schedule delete error:", error);
      res.status(500).json({ error: "Failed to delete schedule item" });
    }
  });

  // Task management
  app.get("/api/tasks/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const tasks = await storage.getTasksByUserId(userId);
      res.json(tasks);
    } catch (error) {
      console.error("Tasks fetch error:", error);
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });

  app.get("/api/tasks/:userId/today", async (req, res) => {
    try {
      const { userId } = req.params;
      const tasks = await storage.getTodayTasks(userId);
      res.json(tasks);
    } catch (error) {
      console.error("Today tasks fetch error:", error);
      res.status(500).json({ error: "Failed to fetch today's tasks" });
    }
  });

  app.patch("/api/tasks/:id/status", async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      await storage.updateTaskStatus(id, status);
      res.json({ success: true });
    } catch (error) {
      console.error("Task status update error:", error);
      res.status(500).json({ error: "Failed to update task status" });
    }
  });

  // Cron endpoint for daily reminders
  app.post("/api/cron/daily-reminder", async (req, res) => {
    try {
      const result = await checkAndSendReminders();
      res.json(result);
    } catch (error) {
      console.error("Daily reminder error:", error);
      res.status(500).json({ error: "Failed to process daily reminders" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
