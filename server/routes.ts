import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import fs from "fs";
import path from "path";
import { storage } from "./storage";
import { transcribeAudio, generatePlan, generateExplanation, expandExplanation } from "./services/openai";
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
      const { email, password, name, role, educationLevel, grade } = req.body;
      
      if (!email || !password || !name || !role) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // For students, require education level and grade
      if (role === 'student' && (!educationLevel || !grade)) {
        return res.status(400).json({ error: "Students must provide education level and grade" });
      }

      // Create user in Supabase Auth
      const supabaseResult = await supabaseSignUp(email, password, name, role);
      
      // Create user in our database with additional fields
      try {
        const userData = {
          id: supabaseResult.user?.id || `user-${Date.now()}`,
          email,
          name,
          role,
          educationLevel: role === 'student' ? educationLevel : null,
          grade: role === 'student' ? parseInt(grade) : null,
        };
        
        await storage.createUser(userData);
      } catch (dbError) {
        console.warn("Database sync failed, but auth succeeded:", dbError);
      }
      
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

      // For now, return null to indicate no audio available
      // In production, use Azure TTS or similar
      res.json({ audioUrl: null });
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

  // Expand explanation endpoint
  app.post("/api/explain/expand", async (req, res) => {
    try {
      const { originalExplanation, topic, course } = req.body;
      
      if (!originalExplanation || !topic || !course) {
        return res.status(400).json({ error: "Missing required parameters" });
      }

      const expandedExplanation = await expandExplanation(originalExplanation, topic, course);
      
      res.json(expandedExplanation);
    } catch (error) {
      console.error("Expand explanation error:", error);
      res.status(500).json({ error: "Failed to expand explanation" });
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
      const courseData = req.body;
      
      // Ensure user exists in our database (sync from Supabase auth)
      const userId = courseData.userId;
      if (userId) {
        const existingUser = await storage.getUser(userId);
        if (!existingUser) {
          // Create user record from Supabase auth data
          try {
            await storage.createUser({
              id: userId,
              email: "user@example.com", // Will be updated with real data later
              name: "User",
              role: "student"
            });
            console.log(`✅ Created user record for ${userId}`);
          } catch (userError) {
            console.log(`User ${userId} might already exist, continuing...`);
          }
        }
      }
      
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

  // Import iCal schedule
  app.post("/api/schedule/import-ical", async (req, res) => {
    try {
      const { userId, icalUrl } = req.body;
      
      if (!userId || !icalUrl) {
        return res.status(400).json({ error: "Missing userId or icalUrl" });
      }

      // Ensure user exists in our database (sync from Supabase auth)
      const existingUser = await storage.getUser(userId);
      if (!existingUser) {
        // Create user record from Supabase auth data
        try {
          await storage.createUser({
            id: userId,
            email: "user@example.com", // Will be updated with real data later
            name: "User",
            role: "student"
          });
          console.log(`✅ Created user record for ${userId}`);
        } catch (userError) {
          console.log(`User ${userId} might already exist, continuing...`);
        }
      }

      // Import iCal events
      const { default: ical } = await import('node-ical');
      
      console.log(`📅 Fetching iCal from: ${icalUrl}`);
      const events = await ical.async.fromURL(icalUrl);
      
      let scheduleCount = 0;
      const courseNames = new Set<string>();
      
      for (const key in events) {
        const event = events[key];
        
        // Only process VEVENT components
        if (event.type !== 'VEVENT') continue;
        
        const summary = event.summary || "Onbekend event";
        const startDate = event.start;
        const endDate = event.end;
        
        if (!startDate || !endDate) continue;
        
        // Extract course name from summary (common patterns)
        let courseName = "Algemeen";
        const summaryStr = summary.toString().toLowerCase();
        
        // Common Dutch school subjects
        if (summaryStr.includes('wiskundig') || summaryStr.includes('wiskunde')) courseName = "Wiskunde";
        else if (summaryStr.includes('nederlands')) courseName = "Nederlands";
        else if (summaryStr.includes('engels')) courseName = "Engels";
        else if (summaryStr.includes('geschiedenis')) courseName = "Geschiedenis";
        else if (summaryStr.includes('aardrijkskunde')) courseName = "Aardrijkskunde";
        else if (summaryStr.includes('biologie')) courseName = "Biologie";
        else if (summaryStr.includes('scheikunde')) courseName = "Scheikunde";
        else if (summaryStr.includes('natuurkunde')) courseName = "Natuurkunde";
        else if (summaryStr.includes('economie')) courseName = "Economie";
        else if (summaryStr.includes('frans')) courseName = "Frans";
        else if (summaryStr.includes('duits')) courseName = "Duits";
        else if (summaryStr.includes('sport') || summaryStr.includes('lichamel')) courseName = "Lichamelijke Opvoeding";
        else if (summaryStr.includes('kunst') || summaryStr.includes('tekenen')) courseName = "Kunst";
        else if (summaryStr.includes('muziek')) courseName = "Muziek";
        else if (summaryStr.includes('informatica') || summaryStr.includes('computer')) courseName = "Informatica";
        else if (summaryStr.includes('toets') || summaryStr.includes('test') || summaryStr.includes('exam')) {
          // For tests, try to extract subject from the rest of the title
          const words = summaryStr.split(/[^\w]+/);
          for (const word of words) {
            if (word.includes('wisk')) { courseName = "Wiskunde"; break; }
            if (word.includes('ned')) { courseName = "Nederlands"; break; }
            if (word.includes('eng')) { courseName = "Engels"; break; }
            if (word.includes('gesch')) { courseName = "Geschiedenis"; break; }
            if (word.includes('bio')) { courseName = "Biologie"; break; }
          }
        }
        
        courseNames.add(courseName);
        
        // Find or create course
        let courses = await storage.getCoursesByUserId(userId);
        let course = courses.find(c => c.name === courseName);
        
        if (!course) {
          course = await storage.createCourse({
            userId,
            name: courseName,
            level: "havo5"
          });
        }
        
        // Determine if it's a test or lesson
        const isTest = summaryStr.includes('toets') || summaryStr.includes('test') || 
                      summaryStr.includes('exam') || summaryStr.includes('proefwerk');
        
        // Create schedule item
        const dayOfWeek = startDate.getDay() === 0 ? 7 : startDate.getDay(); // Convert Sunday from 0 to 7
        const startTime = `${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')}:00`;
        const endTime = `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}:00`;
        
        await storage.createScheduleItem({
          userId,
          courseId: course.id,
          dayOfWeek,
          startTime,
          endTime,
          kind: isTest ? "toets" : "les",
          title: summary.toString(),
          date: isTest ? startDate.toISOString().split('T')[0] : null
        });
        
        scheduleCount++;
      }
      
      console.log(`✅ Imported ${scheduleCount} schedule items and ${courseNames.size} courses`);
      
      res.json({
        success: true,
        scheduleCount,
        courseCount: courseNames.size,
        courses: Array.from(courseNames)
      });
      
    } catch (error) {
      console.error("iCal import error:", error);
      res.status(500).json({ 
        error: "Failed to import iCal", 
        details: (error as Error).message 
      });
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

  // Create manual task
  app.post("/api/tasks", async (req, res) => {
    try {
      const taskData = req.body;
      
      // Ensure user exists in our database (sync from Supabase auth)
      const userId = taskData.userId;
      if (userId) {
        const existingUser = await storage.getUser(userId);
        if (!existingUser) {
          // Create user record from Supabase auth data
          try {
            await storage.createUser({
              id: userId,
              email: "user@example.com", // Will be updated with real data later
              name: "User",
              role: "student"
            });
            console.log(`✅ Created user record for ${userId}`);
          } catch (userError) {
            console.log(`User ${userId} might already exist, continuing...`);
          }
        }
      }
      
      const created = await storage.createTask(taskData);
      res.json(created);
    } catch (error) {
      console.error("Task create error:", error);
      res.status(500).json({ error: "Failed to create task" });
    }
  });

  // Delete task
  app.delete("/api/tasks/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteTask(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Task delete error:", error);
      res.status(500).json({ error: "Failed to delete task" });
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

  // Parent-Child relationship routes
  app.post("/api/parent/add-child", async (req, res) => {
    try {
      const { parentId, childEmail, childName } = req.body;
      
      if (!parentId || !childEmail || !childName) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Check if child exists
      const child = await storage.findChildByEmail(childEmail);
      if (!child) {
        return res.status(404).json({ error: "Child not found with this email address" });
      }

      if (child.role !== 'student') {
        return res.status(400).json({ error: "Only student accounts can be added as children" });
      }

      // Create the relationship
      const relationship = await storage.createParentChildRelationship({
        parentId,
        childId: child.id,
        childEmail,
        childName,
        isConfirmed: false, // Child needs to confirm
      });

      res.json({ success: true, relationship });
    } catch (error) {
      console.error("Add child error:", error);
      res.status(500).json({ error: "Failed to add child" });
    }
  });

  app.get("/api/parent/:parentId/children", async (req, res) => {
    try {
      const { parentId } = req.params;
      const relationships = await storage.getChildrenByParentId(parentId);
      
      // Get full child user data
      const childrenData = await Promise.all(
        relationships.map(async (rel) => {
          const child = await storage.getUser(rel.childId);
          return {
            relationship: rel,
            child: child
          };
        })
      );

      res.json(childrenData);
    } catch (error) {
      console.error("Get children error:", error);
      res.status(500).json({ error: "Failed to get children" });
    }
  });

  app.post("/api/student/confirm-parent/:relationshipId", async (req, res) => {
    try {
      const { relationshipId } = req.params;
      await storage.confirmRelationship(relationshipId);
      res.json({ success: true });
    } catch (error) {
      console.error("Confirm parent error:", error);
      res.status(500).json({ error: "Failed to confirm parent relationship" });
    }
  });

  // Get child data for parent (tasks, schedule, etc)
  app.get("/api/parent/child/:childId/tasks", async (req, res) => {
    try {
      const { childId } = req.params;
      const tasks = await storage.getTasksByUserId(childId);
      res.json(tasks);
    } catch (error) {
      console.error("Get child tasks error:", error);
      res.status(500).json({ error: "Failed to get child tasks" });
    }
  });

  app.get("/api/parent/child/:childId/schedule", async (req, res) => {
    try {
      const { childId } = req.params;
      const schedule = await storage.getScheduleByUserId(childId);
      res.json(schedule);
    } catch (error) {
      console.error("Get child schedule error:", error);
      res.status(500).json({ error: "Failed to get child schedule" });
    }
  });

  // Get pending parent requests for student
  app.get("/api/student/:studentId/parent-requests", async (req, res) => {
    try {
      const { studentId } = req.params;
      const relationships = await storage.getPendingParentRequests(studentId);
      res.json(relationships);
    } catch (error) {
      console.error("Get parent requests error:", error);
      res.status(500).json({ error: "Failed to get parent requests" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
