import type { Express } from "express";
import OpenAI from 'openai';
import { createServer, type Server } from "http";
import multer from "multer";
import fs from "fs";
import { storage } from "./storage";
import {
  transcribeAudio,
  generatePlan,
  generateExplanation,
  expandExplanation,
} from "./services/openai";
import { checkAndSendReminders } from "./services/cron";
import {
  signUp as supabaseSignUp,
  signIn as supabaseSignIn,
  signOut as supabaseSignOut,
} from "./services/supabase";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } 
});

// === Coach helpers ===
const WD = ["zondag","maandag","dinsdag","woensdag","donderdag","vrijdag","zaterdag"];
const MONTHS = ["januari","februari","maart","april","mei","juni","juli","augustus","september","oktober","november","december"];

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate()+n); return x; }

function parseRelativeDateTimeNL(inputRaw: string, now = new Date()) {
  const input = inputRaw.toLowerCase().trim();
  let date = startOfDay(now);
  let time: string | null = null;

  if (/\bmorgen\b/.test(input)) date = startOfDay(addDays(now, 1));
  else if (/\bovermorgen\b/.test(input)) date = startOfDay(addDays(now, 2));
  else if (/\bvandaag\b/.test(input)) date = startOfDay(now);

  for (let i = 0; i < WD.length; i++) {
    if (input.includes(WD[i])) {
      const target = i; const cur = now.getDay();
      let diff = target - cur; if (diff <= 0) diff += 7;
      date = startOfDay(addDays(now, diff)); break;
    }
  }

  const dmLong = input.match(/(\d{1,2})\s+([a-z]+)(?:\s+(\d{4}))?/);
  const dmShort = input.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);

  if (dmLong) {
    const d = parseInt(dmLong[1], 10);
    const mName = dmLong[2];
    const y = dmLong[3] ? parseInt(dmLong[3], 10) : now.getFullYear();
    const m = MONTHS.indexOf(mName);
    if (m >= 0) date = startOfDay(new Date(y, m, d));
  } else if (dmShort) {
    const d = parseInt(dmShort[1], 10);
    const m = parseInt(dmShort[2], 10) - 1;
    let y = dmShort[3] ? parseInt(dmShort[3], 10) : now.getFullYear();
    if (y < 100) y += 2000;
    date = startOfDay(new Date(y, m, d));
  }

  const hhmm = input.match(/\b(\d{1,2}):(\d{2})\b/);
  const hhmmCompact = input.match(/\b(\d{1,2})(\d{2})\b/);
  const omUur = input.match(/\bom\s*(\d{1,2})\s*uur\b/);

  if (hhmm) time = `${hhmm[1].padStart(2,"0")}:${hhmm[2]}`;
  else if (omUur) time = `${omUur[1].padStart(2,"0")}:00`;
  else if (hhmmCompact) {
    const h = parseInt(hhmmCompact[1],10), m = parseInt(hhmmCompact[2],10);
    if (h>=0 && h<=23 && m>=0 && m<=59) time = `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
  }

  if (!time) {
    if (/\b(ochtend|smorgens)\b/.test(input)) time = "09:00";
    else if (/\b(middag|vanmiddag)\b/.test(input)) time = "14:00";
    else if (/\b(avond|vanavond)\b/.test(input)) time = "19:00";
  }

  if (time) { const [H,M] = time.split(":").map(Number); date.setHours(H, M, 0, 0); }
  return { date, time: time ?? null };
}

function parseEstMinutes(input: string) {
  const m1 = input.match(/(\d{1,3})\s*min/); if (m1) return parseInt(m1[1], 10);
  const h1 = input.match(/(\d+(?:[.,]\d+)?)\s*uur/); if (h1) return Math.round(parseFloat(h1[1].replace(",", ".")) * 60);
  return null;
}

function extractTaskCandidates(text: string): string[] {
  const lines = text.split(/\n/).map(s => s.trim()).filter(Boolean);
  const picked = lines
    .filter(l => /^[-•]/.test(l) || /^maak taak:/i.test(l))
    .map(l => l.replace(/^[-•]\s*/,"").replace(/^maak taak:\s*/i,"").trim());
  return picked.length ? picked : [text];
}

type ChatMsg = { role: "user"|"assistant"; content: string; created_at: string };
const chatMem = new Map<string, ChatMsg[]>();

async function saveChatMessage(userId: string, role: "user"|"assistant", content: string) {
  const s = (storage as any);
  if (s.createChatMessage) {
    await s.createChatMessage({ user_id: userId, role, content });
    return;
  }
  const arr = chatMem.get(userId) ?? [];
  arr.push({ role, content, created_at: new Date().toISOString() });
  chatMem.set(userId, arr);
}

async function listChatMessages(userId: string, limit = 50): Promise<ChatMsg[]> {
  const s = (storage as any);
  if (s.getChatMessagesByUserId) {
    const rows = await s.getChatMessagesByUserId(userId, limit);
    return rows;
  }
  const arr = chatMem.get(userId) ?? [];
  return arr.slice(-limit);
}

function camelSchedule(s: any) {
  if (!s) return s;
  return {
    ...s,
    userId: s.user_id,
    courseId: s.course_id,
    dayOfWeek: s.day_of_week,
    startTime: s.start_time,
    endTime: s.end_time,
    isRecurring: s.is_recurring,
  };
}

function datesHaveWeekdayInRange(startISO: string, endISO: string, weekday1to7: number) {
  const start = new Date(startISO);
  const end = new Date(endISO);
  let iter = new Date(start);

  for (let i = 0; i < 35 && iter <= end; i++) {
    let jsDow = iter.getDay();
    if (jsDow === 0) jsDow = 7;
    if (jsDow === weekday1to7) return true;
    iter.setDate(iter.getDate() + 1);
  }
  return false;
}

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "OK", timestamp: new Date().toISOString() });
  });

  /** ========= COACH CHAT ========= */
  app.get("/api/chat/history", async (req, res) => {
    try {
      const userId = (req.query.userId as string) || (req.query.userid as string);
      if (!userId) return res.status(400).json({ error: "Missing userId" });
      const msgs = await listChatMessages(userId, 50);
      res.json({ messages: msgs });
    } catch (error) {
      console.error("Chat history error:", error);
      res.status(500).json({ error: "Failed to fetch chat history" });
    }
  });

  app.post("/api/chat/coach", async (req, res) => {
    try {
      const { userId, message } = req.body || {};
      if (!userId || !message) return res.status(400).json({ error: "Missing userId or message" });

      await saveChatMessage(userId, "user", message);

      const shouldPlan = /\b(taak|taken|huiswerk|paragraaf|toets|leren|inplannen|plan|maken)\b/i.test(message);
      const created: any[] = [];

      if (shouldPlan) {
        const now = new Date();
        const candidates = extractTaskCandidates(message);
        const courses = await storage.getCoursesByUserId(userId);

        for (const c of candidates) {
          const { date } = parseRelativeDateTimeNL(c, now);
          const est = parseEstMinutes(c);

          let course_id: string | null = null;
          if (courses?.length) {
            const lower = c.toLowerCase();
            const hit = courses.find((k: any) => lower.includes(String(k.name).toLowerCase()));
            if (hit) course_id = hit.id;
          }

          const title = c.replace(/\s+/g, " ").trim();

          const task = await storage.createTask({
            user_id: userId,
            title: title || "Taak",
            status: "todo",
            due_at: date,
            course_id,
            est_minutes: est ?? 30,
            priority: 1,
            source: "coach",
          } as any);

          created.push(task);
        }
      }

      const did = created.length;
      const tail = did > 0
        ? `Ik heb ${did} ${did===1?"taak":"taken"} ingepland. Wil je ook een korte herhaaltaak toevoegen voor morgenavond?`
        : `Zal ik dit vertalen naar concrete taken (met tijd en duur)? Bijvoorbeeld: "Morgen 19:00 wiskunde 3.2 oefenen (30 min)".`;

      const reply = `Fijn dat je dit deelt. Wat ging vandaag het lastigst?\n${tail}\nTip: blokken van 25–30 minuten met korte pauzes werken vaak beter dan lange sessies.`;

      await saveChatMessage(userId, "assistant", reply);

      res.json({ reply, created_count: did, created_tasks: created });
    } catch (error) {
      console.error("Chat coach error:", error);
      res.status(500).json({ error: "Failed to handle coach chat" });
    }
  });

  /** ========= AUTH ========= */
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { email, password, name, role, educationLevel, grade } = req.body;

      if (!email || !password || !name || !role) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      if (role === "student" && (!educationLevel || !grade)) {
        return res.status(400).json({ error: "Students must provide education level and grade" });
      }

      const supabaseResult = await supabaseSignUp(email, password, name, role);

      try {
        const userData = {
          id: supabaseResult.user?.id || `user-${Date.now()}`,
          email,
          name,
          role,
          education_level: role === "student" ? educationLevel : null,
          grade: role === "student" ? parseInt(grade) : null,
        };
        await storage.createUser(userData as any);
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

  app.post("/api/auth/signout", async (_req, res) => {
    try {
      await supabaseSignOut();
      res.json({ success: true });
    } catch (error) {
      console.error("Signout error:", error);
      res.status(500).json({ error: (error as Error).message || "Failed to sign out" });
    }
  });

  /** ========= ASR ========= */
  app.post("/api/asr", upload.single("audio"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No audio file provided" });
      }
      
      const lang = req.body.lang || 'nl';
      console.log(`🎤 Transcribing audio (${lang}), size: ${req.file.size} bytes`);
      
      let transcription;
      
      if (req.file.buffer) {
        const file = new File(
          [req.file.buffer], 
          'audio.webm',
          { type: req.file.mimetype || 'audio/webm' }
        );
        
        transcription = await openai.audio.transcriptions.create({
          file: file,
          model: 'whisper-1',
          language: lang,
          response_format: 'json'
        });
      } 
      else if (req.file.path) {
        const fileStream = fs.createReadStream(req.file.path);
        
        transcription = await openai.audio.transcriptions.create({
          file: fileStream,
          model: 'whisper-1',
          language: lang,
          response_format: 'json'
        });
        
        try {
          fs.unlinkSync(req.file.path);
        } catch (cleanupError) {
          console.warn('Could not delete temp file:', cleanupError);
        }
      } 
      else {
        return res.status(400).json({ error: 'Invalid file upload' });
      }

      console.log(`✅ Transcription: "${transcription.text}"`);

      res.json({ 
        transcript: transcription.text,
        text: transcription.text,
        lang: lang 
      });

    } catch (error: any) {
      console.error('❌ ASR error:', error);
      res.status(500).json({ 
        error: 'Transcriptie mislukt',
        details: error?.message 
      });
    }
  });



  app.post("/api/plan", async (req, res) => {
    try {
      const { transcript, date, user_id } = req.body;
      if (!transcript || !user_id) {
        return res.status(400).json({ error: "Missing transcript or user_id" });
      }

      const plan = await generatePlan(transcript, date || new Date().toISOString());

      // Create tasks
      const createdTasks: any[] = [];
      for (const taskData of plan.tasks) {
        // Find course by name
        const courses = await storage.getCoursesByUserId(user_id);
        const course = courses.find((c) => c.name === taskData.course);

        // due_at fallback naar morgen als invalid
        let dueDate: Date;
        try {
          dueDate = taskData.due_at ? new Date(taskData.due_at) : new Date();
          if (isNaN(dueDate.getTime())) {
            dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 1);
          }
        } catch {
          dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + 1);
        }

        const task = await storage.createTask({
          user_id,
          course_id: course?.id || null,
          title: taskData.title,
          due_at: dueDate,
          est_minutes: taskData.est_minutes || 30,
          priority: taskData.priority || 1,
          source: "check-in",
          status: "todo",
        } as any);
        createdTasks.push(task);
      }

      // Session record
      await storage.createSession({
        user_id,
        transcript,
        summary: plan.coach_text,
        coach_text: plan.coach_text,
      } as any);

      res.json({ tasks: createdTasks, coach_text: plan.coach_text });
    } catch (error) {
      console.error("Planning error:", error);
      res.status(500).json({ error: "Failed to create plan" });
    }
  });

  app.post("/api/tts", async (req, res) => {
    try {
      const { text } = req.body;
      if (!text) return res.status(400).json({ error: "No text provided" });
      // Placeholder: return null; hook up Azure TTS in production
      res.json({ audioUrl: null });
    } catch (error) {
      console.error("TTS error:", error);
      res.status(500).json({ error: "Failed to generate speech" });
    }
  });

  app.post("/api/ocr", upload.single("image"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No image file provided" });
      const dummyText =
        "Bereken de sinus van hoek A in een rechthoekige driehoek waar de overstaande zijde 6 cm is en de schuine zijde 10 cm.";
      fs.unlinkSync(req.file.path);
      res.json({ text: dummyText });
    } catch (error) {
      console.error("OCR error:", error);
      res.status(500).json({ error: "Failed to process image" });
    }
  });

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

  app.post("/api/explain/expand", async (req, res) => {
    try {
      const { originalExplanation, topic, course } = req.body;
      if (!originalExplanation || !topic || !course) {
        return res.status(400).json({ error: "Missing required parameters" });
      }
      const expandedExplanation = await expandExplanation(
        originalExplanation,
        topic,
        course
      );
      res.json(expandedExplanation);
    } catch (error) {
      console.error("Expand explanation error:", error);
      res.status(500).json({ error: "Failed to expand explanation" });
    }
  });

  /** ========= COURSES ========= */
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
      const dbCourseData = {
        name: courseData.name,
        color: courseData.color,
        level: courseData.level,
        user_id: courseData.user_id || courseData.userId,
      };

      const userId = dbCourseData.user_id;
      if (userId) {
        const existingUser = await storage.getUser(userId);
        if (!existingUser) {
          try {
            await storage.createUser({
              id: userId,
              email: "user@example.com",
              name: "User",
              role: "student",
            } as any);
            console.log(`✅ Created user record for ${userId}`);
          } catch {
            console.log(`User ${userId} might already exist, continuing...`);
          }
        }
      }

      const created = await storage.createCourse(dbCourseData as any);
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

  /** ========= SCHEDULE ========= */

  // Flexible list endpoint: ?userId=&start=&end=&dayOfWeek=
  app.get("/api/schedule", async (req, res) => {
    try {
      const { userId, start, end, dayOfWeek } = req.query as {
        userId?: string;
        start?: string;
        end?: string;
        dayOfWeek?: string;
      };
      if (!userId) return res.status(400).json({ error: "Missing userId" });

      // a) specific weekday (1..7)
      if (dayOfWeek) {
        const dow = Math.max(1, Math.min(7, parseInt(dayOfWeek, 10) || 1));
        const rows = await storage.getScheduleByDay(userId, dow);
        return res.json(rows.map(camelSchedule));
      }

      // b) range filter (start+end)
      if (start && end) {
        const all = await storage.getScheduleByUserId(userId);
        const s = new Date(start);
        const e = new Date(end);

        const inRange = all.filter((r: any) => {
          // dated items (e.g., toets)
          if (r.date) {
            const d = new Date(r.date);
            return d >= s && d <= e;
          }
          // recurring lessons: show if weekday occurs within range
          const dow = r.day_of_week; // 1..7
          return datesHaveWeekdayInRange(start, end, dow);
        });

        return res.json(inRange.map(camelSchedule));
      }

      // c) fallback: all for user
      const rows = await storage.getScheduleByUserId(userId);
      res.json(rows.map(camelSchedule));
    } catch (error) {
      console.error("Schedule (range) fetch error:", error);
      res.status(500).json({ error: "Failed to fetch schedule" });
    }
  });

  // Backward-compatible: by user id (no filters)
  app.get("/api/schedule/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const scheduleItems = await storage.getScheduleByUserId(userId);
      res.json(scheduleItems.map(camelSchedule));
    } catch (error) {
      console.error("Schedule fetch error:", error);
      res.status(500).json({ error: "Failed to fetch schedule" });
    }
  });

  // Today for user
  app.get("/api/schedule/:userId/today", async (req, res) => {
    try {
      const { userId } = req.params;
      const today = new Date();
      const jsDow = today.getDay(); // 0=Sun..6=Sat
      const adjustedDayOfWeek = jsDow === 0 ? 7 : jsDow; // 1=Mon..7=Sun

      const scheduleItems = await storage.getScheduleByDay(userId, adjustedDayOfWeek);
      res.json(scheduleItems.map(camelSchedule));
    } catch (error) {
      console.error("Today schedule fetch error:", error);
      res.status(500).json({ error: "Failed to fetch today's schedule" });
    }
  });

  // Create schedule item
  app.post("/api/schedule", async (req, res) => {
    try {
      const scheduleData = req.body;
      const dbScheduleData = {
        user_id: scheduleData.user_id ?? scheduleData.userId,
        course_id: scheduleData.course_id ?? scheduleData.courseId ?? null,
        day_of_week: scheduleData.day_of_week ?? scheduleData.dayOfWeek,
        start_time: scheduleData.start_time ?? scheduleData.startTime,
        end_time: scheduleData.end_time ?? scheduleData.endTime,
        kind: scheduleData.kind,
        title: scheduleData.title ?? null,
        date: scheduleData.date ?? null, // YYYY-MM-DD (for single events/tests)
        is_recurring:
          scheduleData.is_recurring ?? scheduleData.isRecurring ?? false,
      };

      // Normalize Sunday (0) → 7
      if (dbScheduleData.day_of_week === 0) dbScheduleData.day_of_week = 7;

      if (
        !dbScheduleData.user_id ||
        !dbScheduleData.day_of_week ||
        !dbScheduleData.start_time ||
        !dbScheduleData.end_time
      ) {
        return res
          .status(400)
          .json({ error: "Missing required schedule fields" });
      }

      const created = await storage.createScheduleItem(dbScheduleData as any);
      res.json(camelSchedule(created));
    } catch (error) {
      console.error("Schedule create error:", error);
      res.status(500).json({ error: "Failed to create schedule item" });
    }
  });

  // Delete schedule item
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
  // Cancel/restore schedule item
  app.patch("/api/schedule/:id/cancel", async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      // Je moet ook een updateScheduleStatus functie toevoegen aan je storage
      await storage.updateScheduleStatus(id, status);
      res.json({ success: true });
    } catch (error) {
      console.error("Cancel schedule error:", error);
      res.status(500).json({ error: "Failed to cancel schedule item" });
    }
  });
  // Import iCal schedule
  app.post("/api/schedule/import-ical", async (req, res) => {
    try {
      const { userId, icalUrl } = req.body;
      if (!userId || !icalUrl) {
        return res.status(400).json({ error: "Missing userId or icalUrl" });
      }

      const existingUser = await storage.getUser(userId);
      if (!existingUser) {
        try {
          await storage.createUser({
            id: userId,
            email: "user@example.com",
            name: "User",
            role: "student",
          } as any);
          console.log(`✅ Created user record for ${userId}`);
        } catch {
          console.log(`User ${userId} might already exist, continuing...`);
        }
      }

      const { default: ical } = await import("node-ical");
      console.log(`📅 Fetching iCal from: ${icalUrl}`);
      const events = await ical.async.fromURL(icalUrl);

      let scheduleCount = 0;
      const courseNames = new Set<string>();

      for (const key in events) {
        const event: any = (events as any)[key];
        if (event.type !== "VEVENT") continue;

        const summary = event.summary || "Onbekend event";
        const startDate: Date = event.start;
        const endDate: Date = event.end;
        if (!startDate || !endDate) continue;

        // Subject detection
        let courseName = "Algemeen";
        const summaryStr = summary.toString().toLowerCase();
        if (summaryStr.includes("wiskundig") || summaryStr.includes("wiskunde"))
          courseName = "Wiskunde";
        else if (summaryStr.includes("nederlands")) courseName = "Nederlands";
        else if (summaryStr.includes("engels")) courseName = "Engels";
        else if (summaryStr.includes("geschiedenis"))
          courseName = "Geschiedenis";
        else if (summaryStr.includes("aardrijkskunde"))
          courseName = "Aardrijkskunde";
        else if (summaryStr.includes("biologie")) courseName = "Biologie";
        else if (summaryStr.includes("scheikunde")) courseName = "Scheikunde";
        else if (summaryStr.includes("natuurkunde")) courseName = "Natuurkunde";
        else if (summaryStr.includes("economie")) courseName = "Economie";
        else if (summaryStr.includes("frans")) courseName = "Frans";
        else if (summaryStr.includes("duits")) courseName = "Duits";
        else if (summaryStr.includes("sport") || summaryStr.includes("lichamel"))
          courseName = "Lichamelijke Opvoeding";
        else if (summaryStr.includes("kunst") || summaryStr.includes("tekenen"))
          courseName = "Kunst";
        else if (summaryStr.includes("muziek")) courseName = "Muziek";
        else if (summaryStr.includes("informatica") || summaryStr.includes("computer"))
          courseName = "Informatica";
        else if (
          summaryStr.includes("toets") ||
          summaryStr.includes("test") ||
          summaryStr.includes("exam")
        ) {
          const words = summaryStr.split(/[^\w]+/);
          for (const word of words) {
            if (word.includes("wisk")) {
              courseName = "Wiskunde";
              break;
            }
            if (word.includes("ned")) {
              courseName = "Nederlands";
              break;
            }
            if (word.includes("eng")) {
              courseName = "Engels";
              break;
            }
            if (word.includes("gesch")) {
              courseName = "Geschiedenis";
              break;
            }
            if (word.includes("bio")) {
              courseName = "Biologie";
              break;
            }
          }
        }

        courseNames.add(courseName);

        // Find or create course
        let courses = await storage.getCoursesByUserId(userId);
        let course = courses.find((c) => c.name === courseName);
        if (!course) {
          course = await storage.createCourse({
            user_id: userId,
            name: courseName,
            level: "havo5",
          } as any);
        }

        const isTest =
          summaryStr.includes("toets") ||
          summaryStr.includes("test") ||
          summaryStr.includes("exam") ||
          summaryStr.includes("proefwerk");

        const dayOfWeek = startDate.getDay() === 0 ? 7 : startDate.getDay();
        const startTime = `${startDate.getHours().toString().padStart(2, "0")}:${startDate
          .getMinutes()
          .toString()
          .padStart(2, "0")}:00`;
        const endTime = `${endDate.getHours().toString().padStart(2, "0")}:${endDate
          .getMinutes()
          .toString()
          .padStart(2, "0")}:00`;

        await storage.createScheduleItem({
          user_id: userId,
          course_id: course.id,
          day_of_week: dayOfWeek,
          start_time: startTime,
          end_time: endTime,
          kind: isTest ? "toets" : "les",
          title: summary.toString(),
          date: isTest ? startDate.toISOString().split("T")[0] : null,
        } as any);

        scheduleCount++;
      }

      console.log(`✅ Imported ${scheduleCount} schedule items and ${courseNames.size} courses`);

      res.json({
        success: true,
        scheduleCount,
        courseCount: courseNames.size,
        courses: Array.from(courseNames),
  });
    } catch (error) {
      console.error("iCal import error:", error);
      res.status(500).json({
        error: "Failed to import iCal",
        details: (error as Error).message,
      });
    }
  });

  /** ========= TASKS ========= */
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

  app.post("/api/tasks", async (req, res) => {
    try {
      const taskData = req.body;
      const dbTaskData: any = {
        title: taskData.title,
        description: taskData.description,
        status: taskData.status || "todo",
        priority: taskData.priority || 0,
        est_minutes: taskData.est_minutes,
        due_at: taskData.due_at,
        user_id: taskData.user_id || taskData.userId,
        course_id: taskData.course_id || taskData.courseId,
        source: taskData.source,
      };

      // Ensure user record exists (best-effort)
      const userId = dbTaskData.user_id;
      if (userId) {
        const existingUser = await storage.getUser(userId);
        if (!existingUser) {
          try {
            await storage.createUser({
              id: userId,
              email: "user@example.com",
              name: "User",
              role: "student",
            } as any);
            console.log(`✅ Created user record for ${userId}`);
          } catch {
            console.log(`User ${userId} might already exist, continuing...`);
          }
        }
      }

      // Normalize due_at
      if (dbTaskData.due_at && typeof dbTaskData.due_at === "string") {
        dbTaskData.due_at = new Date(dbTaskData.due_at);
        if (isNaN(dbTaskData.due_at.getTime())) {
          dbTaskData.due_at = new Date();
          dbTaskData.due_at.setDate(dbTaskData.due_at.getDate() + 1);
        }
      } else if (!dbTaskData.due_at) {
        dbTaskData.due_at = new Date();
        dbTaskData.due_at.setDate(dbTaskData.due_at.getDate() + 1);
      }

      const created = await storage.createTask(dbTaskData);
      res.json(created);
    } catch (error) {
      console.error("Task create error:", error);
      res.status(500).json({ error: "Failed to create task" });
    }
  });

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

  /** ========= CRON ========= */
  app.post("/api/cron/daily-reminder", async (_req, res) => {
    try {
      const result = await checkAndSendReminders();
      res.json(result);
    } catch (error) {
      console.error("Daily reminder error:", error);
      res.status(500).json({ error: "Failed to process daily reminders" });
    }
  });

  /** ========= PARENT/CHILD ========= */
  app.post("/api/parent/add-child", async (req, res) => {
    try {
      const { parentId, childEmail, childName } = req.body;
      if (!parentId || !childEmail || !childName) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const child = await storage.findChildByEmail(childEmail);
      if (!child) {
        return res
          .status(404)
          .json({ error: "Child not found with this email address" });
      }
      if ((child as any).role !== "student") {
        return res
          .status(400)
          .json({ error: "Only student accounts can be added as children" });
      }

      const relationship = await storage.createParentChildRelationship({
        parent_id: parentId,
        child_id: (child as any).id,
        child_email: childEmail,
        child_name: childName,
        is_confirmed: false,
      } as any);

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
      const childrenData = await Promise.all(
        relationships.map(async (rel) => {
          const child = await storage.getUser(rel.child_id);
          return { relationship: rel, child };
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
      res.json(schedule.map(camelSchedule));
    } catch (error) {
      console.error("Get child schedule error:", error);
      res.status(500).json({ error: "Failed to get child schedule" });
    }
  });

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

  /** ========= GOOGLE CALENDAR (DISABLED) ========= */
  // DISABLED: All Google Calendar routes have been commented out
  // Uncomment and restore the .disabled files to re-enable

  // const googleCalendar = new GoogleCalendarService();

  // app.get("/api/calendar/status/:userId", async (req, res) => {
  //   try {
  //     const { userId } = req.params;
  //     const integration = await storage.getCalendarIntegration(userId);
  //     res.json({
  //       connected: !!integration,
  //       syncEnabled: integration?.sync_enabled || false,
  //       lastSync: integration?.last_sync_at,
  //       provider: integration?.provider || null,
  //     });
  //   } catch (error) {
  //     console.error("Calendar status error:", error);
  //     res.status(500).json({ error: "Failed to get calendar status" });
  //   }
  // });

  /** ========= SERVER ========= */
  const httpServer = createServer(app);
  return httpServer;
}
