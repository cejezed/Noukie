import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import {
  users,
  courses,
  schedule,
  tasks,
  sessions,
  materials,
  quizResults,
  type User,
  type InsertUser,
  type Course,
  type InsertCourse,
  type Schedule,
  type InsertSchedule,
  type Task,
  type InsertTask,
  type Session,
  type InsertSession,
  type Material,
  type InsertMaterial,
  type QuizResult,
  type InsertQuizResult,
} from "@shared/schema";

// Use Supabase database URL
const databaseUrl = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;

// Temporary in-memory storage as fallback when database is not available
let inMemoryStorage: {
  users: any[];
  courses: any[];
  schedule: any[];
  tasks: any[];
  sessions: any[];
  materials: any[];
  quizResults: any[];
} = {
  users: [],
  courses: [],
  schedule: [],
  tasks: [],
  sessions: [],
  materials: [],
  quizResults: [],
};

let db: any = null;
let useInMemory = false; // Use real database now

// Initialize Supabase database connection
if (databaseUrl) {
  try {
    const sql = postgres(databaseUrl);
    db = drizzle(sql);
    console.log("✅ Connected to Supabase database");
  } catch (error) {
    console.error("❌ Supabase database connection failed:", error);
    useInMemory = true;
    console.log("Falling back to in-memory storage");
  }
} else {
  console.log("⚠️ No Supabase DATABASE_URL found, using in-memory storage");
  useInMemory = true;
}

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Courses
  getCoursesByUserId(userId: string): Promise<Course[]>;
  createCourse(course: InsertCourse): Promise<Course>;
  deleteCourse(id: string): Promise<void>;
  
  // Schedule
  getScheduleByUserId(userId: string): Promise<Schedule[]>;
  getScheduleByDay(userId: string, dayOfWeek: number): Promise<Schedule[]>;
  createScheduleItem(schedule: InsertSchedule): Promise<Schedule>;
  deleteScheduleItem(id: string): Promise<void>;
  
  // Tasks
  getTasksByUserId(userId: string): Promise<Task[]>;
  getTodayTasks(userId: string): Promise<Task[]>;
  getTasksByDateRange(userId: string, startDate: Date, endDate: Date): Promise<Task[]>;
  createTask(task: InsertTask): Promise<Task>;
  updateTaskStatus(id: string, status: string): Promise<void>;
  
  // Sessions
  getLastSession(userId: string): Promise<Session | undefined>;
  getTodaySession(userId: string): Promise<Session | undefined>;
  createSession(session: InsertSession): Promise<Session>;
  
  // Materials
  createMaterial(material: InsertMaterial): Promise<Material>;
  
  // Quiz Results
  createQuizResult(result: InsertQuizResult): Promise<QuizResult>;
}

export class PostgresStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    if (useInMemory) {
      return inMemoryStorage.users.find(u => u.id === id);
    }
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    if (useInMemory) {
      return inMemoryStorage.users.find(u => u.email === email);
    }
    const result = await db.select().from(users).where(eq(users.email, email));
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    if (useInMemory) {
      const newUser = { ...user, id: `user-${Date.now()}`, createdAt: new Date() };
      inMemoryStorage.users.push(newUser);
      return newUser;
    }
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }

  async getCoursesByUserId(userId: string): Promise<Course[]> {
    if (useInMemory) {
      return inMemoryStorage.courses.filter(c => c.userId === userId);
    }
    return await db.select().from(courses).where(eq(courses.userId, userId));
  }

  async createCourse(course: InsertCourse): Promise<Course> {
    if (useInMemory) {
      const newCourse = { ...course, id: `course-${Date.now()}`, level: course.level || "havo5" };
      inMemoryStorage.courses.push(newCourse);
      return newCourse;
    }
    const result = await db.insert(courses).values(course).returning();
    return result[0];
  }

  async deleteCourse(id: string): Promise<void> {
    if (useInMemory) {
      const index = inMemoryStorage.courses.findIndex(c => c.id === id);
      if (index > -1) inMemoryStorage.courses.splice(index, 1);
      return;
    }
    await db.delete(courses).where(eq(courses.id, id));
  }

  async getScheduleByUserId(userId: string): Promise<Schedule[]> {
    if (useInMemory) {
      return inMemoryStorage.schedule.filter(s => s.userId === userId);
    }
    return await db.select().from(schedule).where(eq(schedule.userId, userId));
  }

  async getScheduleByDay(userId: string, dayOfWeek: number): Promise<Schedule[]> {
    if (useInMemory) {
      return inMemoryStorage.schedule.filter(s => 
        s.userId === userId && s.dayOfWeek === dayOfWeek
      );
    }
    return await db.select().from(schedule)
      .where(and(
        eq(schedule.userId, userId),
        eq(schedule.dayOfWeek, dayOfWeek)
      ));
  }

  async createScheduleItem(scheduleItem: InsertSchedule): Promise<Schedule> {
    if (useInMemory) {
      const newItem = { 
        ...scheduleItem, 
        id: `schedule-${Date.now()}`,
        date: scheduleItem.date || null,
        courseId: scheduleItem.courseId || null,
        dayOfWeek: scheduleItem.dayOfWeek || null,
        startTime: scheduleItem.startTime || null,
        endTime: scheduleItem.endTime || null,
        kind: scheduleItem.kind || "les",
        title: scheduleItem.title || null
      };
      inMemoryStorage.schedule.push(newItem);
      return newItem;
    }
    const result = await db.insert(schedule).values(scheduleItem).returning();
    return result[0];
  }

  async deleteScheduleItem(id: string): Promise<void> {
    if (useInMemory) {
      const index = inMemoryStorage.schedule.findIndex(s => s.id === id);
      if (index > -1) inMemoryStorage.schedule.splice(index, 1);
      return;
    }
    await db.delete(schedule).where(eq(schedule.id, id));
  }

  async getTasksByUserId(userId: string): Promise<Task[]> {
    return await db.select().from(tasks)
      .where(eq(tasks.userId, userId))
      .orderBy(desc(tasks.priority), tasks.dueAt);
  }

  async getTodayTasks(userId: string): Promise<Task[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return await db.select().from(tasks)
      .where(and(
        eq(tasks.userId, userId),
        gte(tasks.dueAt, today),
        lte(tasks.dueAt, tomorrow)
      ))
      .orderBy(desc(tasks.priority));
  }

  async getTasksByDateRange(userId: string, startDate: Date, endDate: Date): Promise<Task[]> {
    return await db.select().from(tasks)
      .where(and(
        eq(tasks.userId, userId),
        gte(tasks.dueAt, startDate),
        lte(tasks.dueAt, endDate)
      ))
      .orderBy(desc(tasks.priority), tasks.dueAt);
  }

  async createTask(task: InsertTask): Promise<Task> {
    const result = await db.insert(tasks).values(task).returning();
    return result[0];
  }

  async updateTaskStatus(id: string, status: string): Promise<void> {
    await db.update(tasks)
      .set({ status })
      .where(eq(tasks.id, id));
  }

  async getLastSession(userId: string): Promise<Session | undefined> {
    const result = await db.select().from(sessions)
      .where(eq(sessions.userId, userId))
      .orderBy(desc(sessions.happenedAt))
      .limit(1);
    return result[0];
  }

  async getTodaySession(userId: string): Promise<Session | undefined> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const result = await db.select().from(sessions)
      .where(and(
        eq(sessions.userId, userId),
        gte(sessions.happenedAt, today),
        lte(sessions.happenedAt, tomorrow)
      ))
      .limit(1);
    return result[0];
  }

  async createSession(session: InsertSession): Promise<Session> {
    const result = await db.insert(sessions).values(session).returning();
    return result[0];
  }

  async createMaterial(material: InsertMaterial): Promise<Material> {
    const result = await db.insert(materials).values(material).returning();
    return result[0];
  }

  async createQuizResult(result: InsertQuizResult): Promise<QuizResult> {
    const queryResult = await db.insert(quizResults).values(result).returning();
    return queryResult[0];
  }
}

export const storage = new PostgresStorage();
