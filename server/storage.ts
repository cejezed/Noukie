import { supabase } from "./db";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import {
  users,
  courses,
  schedule,
  tasks,
  sessions,
  materials,
  quizResults,
  parentChildRelationships,
  calendarIntegrations,
  importedEvents,
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
  type ParentChildRelationship,
  type InsertParentChildRelationship,
  type CalendarIntegration,
  type InsertCalendarIntegration,
  type ImportedEvent,
  type InsertImportedEvent,
} from "@shared/schema";

// Use the centralized database connection from db.ts
// No need for separate database initialization - use the imported db

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
  
  // Parent-Child Relationships
  createParentChildRelationship(relationship: InsertParentChildRelationship): Promise<ParentChildRelationship>;
  getChildrenByParentId(parentId: string): Promise<ParentChildRelationship[]>;
  findChildByEmail(childEmail: string): Promise<User | undefined>;
  confirmRelationship(relationshipId: string): Promise<void>;
  getPendingParentRequests(childId: string): Promise<ParentChildRelationship[]>;
  
  // Calendar Integrations
  getCalendarIntegration(userId: string): Promise<CalendarIntegration | undefined>;
  createCalendarIntegration(integration: InsertCalendarIntegration): Promise<CalendarIntegration>;
  updateCalendarIntegration(userId: string, updates: Partial<CalendarIntegration>): Promise<void>;
  deleteCalendarIntegration(userId: string): Promise<void>;
  
  // Imported Events
  getImportedEvent(userId: string, externalId: string): Promise<ImportedEvent | undefined>;
  createImportedEvent(event: InsertImportedEvent): Promise<ImportedEvent>;
  getImportedEventsByUserId(userId: string): Promise<ImportedEvent[]>;
}

export class PostgresStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email));
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }

  async getCoursesByUserId(userId: string): Promise<Course[]> {
    return await db.select().from(courses).where(eq(courses.userId, userId));
  }

  async createCourse(course: InsertCourse): Promise<Course> {
    const result = await db.insert(courses).values(course).returning();
    return result[0];
  }

  async deleteCourse(id: string): Promise<void> {
    await db.delete(courses).where(eq(courses.id, id));
  }

  async getScheduleByUserId(userId: string): Promise<Schedule[]> {
    return await db.select().from(schedule).where(eq(schedule.userId, userId));
  }

  async getScheduleByDay(userId: string, dayOfWeek: number): Promise<Schedule[]> {
    return await db.select().from(schedule)
      .where(and(
        eq(schedule.userId, userId),
        eq(schedule.dayOfWeek, dayOfWeek)
      ));
  }

  async createScheduleItem(scheduleItem: InsertSchedule): Promise<Schedule> {
    const result = await db.insert(schedule).values(scheduleItem).returning();
    return result[0];
  }

  async deleteScheduleItem(id: string): Promise<void> {
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
    const taskResults = await db.select().from(tasks)
      .where(and(
        eq(tasks.userId, userId),
        gte(tasks.dueAt, startDate),
        lte(tasks.dueAt, endDate)
      ))
      .orderBy(desc(tasks.priority), tasks.dueAt);
    
    return taskResults;
  }

  async createTask(task: InsertTask): Promise<Task> {
    const result = await db.insert(tasks).values(task).returning();
    return result[0];
  }

  async deleteTask(id: string): Promise<void> {
    await db.delete(tasks).where(eq(tasks.id, id));
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

  // Parent-Child Relationship methods
  async createParentChildRelationship(relationship: InsertParentChildRelationship): Promise<ParentChildRelationship> {
    const result = await db.insert(parentChildRelationships).values(relationship).returning();
    return result[0];
  }

  async getChildrenByParentId(parentId: string): Promise<ParentChildRelationship[]> {
    return await db.select().from(parentChildRelationships)
      .where(eq(parentChildRelationships.parentId, parentId));
  }

  async findChildByEmail(childEmail: string): Promise<User | undefined> {
    const result = await db.select().from(users)
      .where(eq(users.email, childEmail));
    return result[0];
  }

  async confirmRelationship(relationshipId: string): Promise<void> {
    await db.update(parentChildRelationships)
      .set({ isConfirmed: true })
      .where(eq(parentChildRelationships.id, relationshipId));
  }

  async getPendingParentRequests(childId: string): Promise<ParentChildRelationship[]> {
    return await db.select().from(parentChildRelationships)
      .where(and(
        eq(parentChildRelationships.childId, childId),
        eq(parentChildRelationships.isConfirmed, false)
      ));
  }

  // Calendar Integration methods
  async getCalendarIntegration(userId: string): Promise<CalendarIntegration | undefined> {
    const result = await db.select().from(calendarIntegrations)
      .where(eq(calendarIntegrations.userId, userId));
    return result[0];
  }

  async createCalendarIntegration(integration: InsertCalendarIntegration): Promise<CalendarIntegration> {
    const result = await db.insert(calendarIntegrations).values(integration).returning();
    return result[0];
  }

  async updateCalendarIntegration(userId: string, updates: Partial<CalendarIntegration>): Promise<void> {
    await db.update(calendarIntegrations)
      .set(updates)
      .where(eq(calendarIntegrations.userId, userId));
  }

  async deleteCalendarIntegration(userId: string): Promise<void> {
    await db.delete(calendarIntegrations)
      .where(eq(calendarIntegrations.userId, userId));
  }

  // Imported Events methods
  async getImportedEvent(userId: string, externalId: string): Promise<ImportedEvent | undefined> {
    const result = await db.select().from(importedEvents)
      .where(and(
        eq(importedEvents.userId, userId),
        eq(importedEvents.externalId, externalId)
      ));
    return result[0];
  }

  async createImportedEvent(event: InsertImportedEvent): Promise<ImportedEvent> {
    const result = await db.insert(importedEvents).values(event).returning();
    return result[0];
  }

  async getImportedEventsByUserId(userId: string): Promise<ImportedEvent[]> {
    return await db.select().from(importedEvents)
      .where(eq(importedEvents.userId, userId));
  }
}

export const storage = new PostgresStorage();
