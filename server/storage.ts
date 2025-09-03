import { supabase } from "./db";
import {
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
  updateScheduleStatus(id: string, status: string): Promise<void>;

  // Tasks
  getTasksByUserId(userId: string): Promise<Task[]>;
  getTodayTasks(userId: string): Promise<Task[]>;
  getTasksByDateRange(userId: string, startDate: Date, endDate: Date): Promise<Task[]>;
  createTask(task: InsertTask): Promise<Task>;
  updateTaskStatus(id: string, status: string): Promise<void>;
  deleteTask(id: string): Promise<void>;

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
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const { data, error } = await supabase.from("users").select("*").eq("id", id).single();
    if (error && error.code !== "PGRST116") throw error;
    return data || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const { data, error } = await supabase.from("users").select("*").eq("email", email).single();
    if (error && error.code !== "PGRST116") throw error;
    return data || undefined;
  }

  async createUser(user: InsertUser): Promise<User> {
    const { data, error } = await supabase.from("users").insert(user).select().single();
    if (error) throw error;
    return data!;
  }

  // Courses
  async getCoursesByUserId(userId: string): Promise<Course[]> {
    const { data, error } = await supabase.from("courses").select("*").eq("user_id", userId);
    if (error) throw error;
    return data || [];
  }

  async createCourse(course: InsertCourse): Promise<Course> {
    const { data, error } = await supabase.from("courses").insert(course).select().single();
    if (error) throw error;
    return data!;
  }

  async deleteCourse(id: string): Promise<void> {
    const { error } = await supabase.from("courses").delete().eq("id", id);
    if (error) throw error;
  }

  // Schedule
  async getScheduleByUserId(userId: string): Promise<Schedule[]> {
    const { data, error } = await supabase.from("schedule").select("*").eq("user_id", userId);
    if (error) throw error;
    return data || [];
  }

  async getScheduleByDay(userId: string, dayOfWeek: number): Promise<Schedule[]> {
    const { data, error } = await supabase
      .from("schedule")
      .select("*")
      .eq("user_id", userId)
      .eq("day_of_week", dayOfWeek);
    if (error) throw error;
    return data || [];
  }

  async createScheduleItem(scheduleItem: InsertSchedule): Promise<Schedule> {
    const { data, error } = await supabase.from("schedule").insert(scheduleItem).select().single();
    if (error) throw error;
    return data!;
  }

  async deleteScheduleItem(id: string): Promise<void> {
    const { error } = await supabase.from("schedule").delete().eq("id", id);
    if (error) throw error;
  }

  async updateScheduleStatus(id: string, status: string): Promise<void> {
    const { error } = await supabase.from("schedule").update({ status }).eq("id", id);
    if (error) throw error;
  }

  // Tasks
  async getTasksByUserId(userId: string): Promise<Task[]> {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", userId)
      .order("priority", { ascending: false })
      .order("due_at", { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async getTodayTasks(userId: string): Promise<Task[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", userId)
      .gte("due_at", today.toISOString())
      .lt("due_at", tomorrow.toISOString())
      .order("priority", { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async getTasksByDateRange(userId: string, startDate: Date, endDate: Date): Promise<Task[]> {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", userId)
      .gte("due_at", startDate.toISOString())
      .lte("due_at", endDate.toISOString())
      .order("priority", { ascending: false })
      .order("due_at", { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async createTask(task: InsertTask): Promise<Task> {
    const { data, error } = await supabase.from("tasks").insert(task).select().single();
    if (error) throw error;
    return data!;
  }

  async updateTaskStatus(id: string, status: string): Promise<void> {
    const { error } = await supabase.from("tasks").update({ status }).eq("id", id);
    if (error) throw error;
  }

  async deleteTask(id: string): Promise<void> {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) throw error;
  }

  // Sessions
  async getLastSession(userId: string): Promise<Session | undefined> {
    const { data, error } = await supabase
      .from("sessions")
      .select("*")
      .eq("user_id", userId)
      .order("happened_at", { ascending: false })
      .limit(1)
      .single();
    if (error && error.code !== "PGRST116") throw error;
    return data || undefined;
  }

  async getTodaySession(userId: string): Promise<Session | undefined> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data, error } = await supabase
      .from("sessions")
      .select("*")
      .eq("user_id", userId)
      .gte("happened_at", today.toISOString())
      .lt("happened_at", tomorrow.toISOString())
      .limit(1)
      .single();
    if (error && error.code !== "PGRST116") throw error;
    return data || undefined;
  }

  async createSession(session: InsertSession): Promise<Session> {
    const { data, error } = await supabase.from("sessions").insert(session).select().single();
    if (error) throw error;
    return data!;
  }

  // Materials
  async createMaterial(material: InsertMaterial): Promise<Material> {
    const { data, error } = await supabase.from("materials").insert(material).select().single();
    if (error) throw error;
    return data!;
  }

  // Quiz Results
  async createQuizResult(result: InsertQuizResult): Promise<QuizResult> {
    const { data, error } = await supabase.from("quiz_results").insert(result).select().single();
    if (error) throw error;
    return data!;
  }

  // Parent-Child Relationships
  async createParentChildRelationship(
    relationship: InsertParentChildRelationship
  ): Promise<ParentChildRelationship> {
    const { data, error } = await supabase.from("parent_child_relationships").insert(relationship).select().single();
    if (error) throw error;
    return data!;
  }

  async getChildrenByParentId(parentId: string): Promise<ParentChildRelationship[]> {
    const { data, error } = await supabase
      .from("parent_child_relationships")
      .select("*")
      .eq("parent_id", parentId);
    if (error) throw error;
    return data || [];
  }

  async findChildByEmail(childEmail: string): Promise<User | undefined> {
    const { data, error } = await supabase.from("users").select("*").eq("email", childEmail).single();
    if (error && error.code !== "PGRST116") throw error;
    return data || undefined;
  }

  async confirmRelationship(relationshipId: string): Promise<void> {
    const { error } = await supabase
      .from("parent_child_relationships")
      .update({ is_confirmed: true })
      .eq("id", relationshipId);
    if (error) throw error;
  }

  async getPendingParentRequests(childId: string): Promise<ParentChildRelationship[]> {
    const { data, error } = await supabase
      .from("parent_child_relationships")
      .select("*")
      .eq("child_id", childId)
      .eq("is_confirmed", false);
    if (error) throw error;
    return data || [];
  }

  // Calendar Integrations
  async getCalendarIntegration(userId: string): Promise<CalendarIntegration | undefined> {
    const { data, error } = await supabase.from("calendar_integrations").select("*").eq("user_id", userId).single();
    if (error && error.code !== "PGRST116") throw error;
    return data || undefined;
  }

  async createCalendarIntegration(integration: InsertCalendarIntegration): Promise<CalendarIntegration> {
    const { data, error } = await supabase.from("calendar_integrations").insert(integration).select().single();
    if (error) throw error;
    return data!;
  }

  async updateCalendarIntegration(userId: string, updates: Partial<CalendarIntegration>): Promise<void> {
    const { error } = await supabase.from("calendar_integrations").update(updates).eq("user_id", userId);
    if (error) throw error;
  }

  async deleteCalendarIntegration(userId: string): Promise<void> {
    const { error } = await supabase.from("calendar_integrations").delete().eq("user_id", userId);
    if (error) throw error;
  }

  // Imported Events
  async getImportedEvent(userId: string, externalId: string): Promise<ImportedEvent | undefined> {
    const { data, error } = await supabase
      .from("imported_events")
      .select("*")
      .eq("user_id", userId)
      .eq("external_id", externalId)
      .single();
    if (error && error.code !== "PGRST116") throw error;
    return data || undefined;
  }

  async createImportedEvent(event: InsertImportedEvent): Promise<ImportedEvent> {
    const { data, error } = await supabase.from("imported_events").insert(event).select().single();
    if (error) throw error;
    return data!;
  }

  async getImportedEventsByUserId(userId: string): Promise<ImportedEvent[]> {
    const { data, error } = await supabase.from("imported_events").select("*").eq("user_id", userId);
    if (error) throw error;
    return data || [];
  }
}

export const storage = new PostgresStorage();
