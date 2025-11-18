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
  type MentalCheckin,
  type InsertMentalCheckin,
  type AppEvent,
  type InsertAppEvent,
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

  // Mental Checkins
  getMentalCheckinsByStudentId(studentId: string, days?: number): Promise<MentalCheckin[]>;
  getMentalMetrics(studentId: string): Promise<{
    checkinsLast7d: number;
    avgSleepLast7d: number;
    avgStressLast7d: number;
    avgEnergyLast7d: number;
    daysNotFeelingWellLast30d: number;
    helpNowCountLast30d: number;
    funWithTopList: Array<{ label: string; count: number }>;
  }>;
  upsertMentalCheckin(checkin: InsertMentalCheckin): Promise<MentalCheckin>;

  // Quiz Metrics
  getQuizMetrics(studentId: string): Promise<{
    quizzesCompletedLast7d: number;
    avgQuizScoreLast7d: number;
    bestQuizScoreLast7d: number;
    retakesCountLast30d: number;
    subjectsMostPracticedLast30d: Array<{ subject: string; count: number }>;
  }>;

  // Study Metrics
  getStudyMetrics(studentId: string): Promise<{
    vocabSessionsLast7d: number;
    vocabWordsReviewedLast7d: number;
    studySessionsLast7d: number;
  }>;

  // Usage Metrics
  getUsageMetrics(studentId: string): Promise<{
    loginsLast7d: number;
    activeDaysLast7d: number;
    lastActiveAt: string | null;
    dailyActivityLast30d: Array<{ date: string; count: number }>;
  }>;
  createAppEvent(event: InsertAppEvent): Promise<AppEvent>;
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

  // Mental Checkins
  async getMentalCheckinsByStudentId(studentId: string, days: number = 30): Promise<MentalCheckin[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await supabase
      .from("mental_checkins")
      .select("*")
      .eq("student_id", studentId)
      .gte("date", startDate.toISOString().split('T')[0])
      .order("date", { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async getMentalMetrics(studentId: string): Promise<{
    checkinsLast7d: number;
    avgSleepLast7d: number;
    avgStressLast7d: number;
    avgEnergyLast7d: number;
    daysNotFeelingWellLast30d: number;
    helpNowCountLast30d: number;
    funWithTopList: Array<{ label: string; count: number }>;
  }> {
    // Get last 30 days of checkins
    const checkins30d = await this.getMentalCheckinsByStudentId(studentId, 30);

    // Get last 7 days of checkins
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const checkins7d = checkins30d.filter(c => new Date(c.date) >= sevenDaysAgo);

    // Calculate averages for last 7 days
    const avgSleepLast7d = checkins7d.length > 0
      ? checkins7d.reduce((sum, c) => sum + (c.sleep_score || 0), 0) / checkins7d.length
      : 0;

    const avgStressLast7d = checkins7d.length > 0
      ? checkins7d.reduce((sum, c) => sum + (c.stress_score || 0), 0) / checkins7d.length
      : 0;

    const avgEnergyLast7d = checkins7d.length > 0
      ? checkins7d.reduce((sum, c) => sum + (c.energy_score || 0), 0) / checkins7d.length
      : 0;

    // Count "niet lekker" and "hulp nu" in last 30 days
    const daysNotFeelingWellLast30d = checkins30d.filter(c => c.mood === 'niet_lekker').length;
    const helpNowCountLast30d = checkins30d.filter(c => c.mood === 'hulp_nu').length;

    // Build fun_with frequency list
    const funWithCounts: Record<string, number> = {};
    checkins30d.forEach(c => {
      if (c.fun_with && c.fun_with.trim()) {
        const items = c.fun_with.split(',').map((s: string) => s.trim()).filter((s: string) => s);
        items.forEach((item: string) => {
          funWithCounts[item] = (funWithCounts[item] || 0) + 1;
        });
      }
    });

    const funWithTopList = Object.entries(funWithCounts)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10

    return {
      checkinsLast7d: checkins7d.length,
      avgSleepLast7d: Math.round(avgSleepLast7d * 10) / 10,
      avgStressLast7d: Math.round(avgStressLast7d * 10) / 10,
      avgEnergyLast7d: Math.round(avgEnergyLast7d * 10) / 10,
      daysNotFeelingWellLast30d,
      helpNowCountLast30d,
      funWithTopList,
    };
  }

  async upsertMentalCheckin(checkin: InsertMentalCheckin): Promise<MentalCheckin> {
    const { data, error} = await supabase
      .from("mental_checkins")
      .upsert(checkin, { onConflict: 'student_id,date' })
      .select()
      .single();

    if (error) throw error;
    return data!;
  }

  // Quiz Metrics
  async getQuizMetrics(studentId: string): Promise<{
    quizzesCompletedLast7d: number;
    avgQuizScoreLast7d: number;
    bestQuizScoreLast7d: number;
    retakesCountLast30d: number;
    subjectsMostPracticedLast30d: Array<{ subject: string; count: number }>;
  }> {
    // Get quiz results from last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: quizzes30d, error } = await supabase
      .from("quiz_results")
      .select("*, courses(name)")
      .eq("user_id", studentId)
      .gte("created_at", thirtyDaysAgo.toISOString())
      .order("created_at", { ascending: false });

    if (error) throw error;

    const results = quizzes30d || [];

    // Filter last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const quizzes7d = results.filter((q: any) => new Date(q.created_at) >= sevenDaysAgo);

    // Calculate metrics
    const quizzesCompletedLast7d = quizzes7d.length;

    const scoresLast7d = quizzes7d.filter((q: any) => q.score !== null).map((q: any) => q.score);
    const avgQuizScoreLast7d = scoresLast7d.length > 0
      ? Math.round((scoresLast7d.reduce((sum: number, score: number) => sum + score, 0) / scoresLast7d.length) * 10) / 10
      : 0;

    const bestQuizScoreLast7d = scoresLast7d.length > 0 ? Math.max(...scoresLast7d) : 0;

    // Count retakes (same course_id + material_id combination)
    const quizKeys = new Set<string>();
    let retakesCountLast30d = 0;
    results.forEach((q: any) => {
      const key = `${q.course_id || 'none'}-${q.material_id || 'none'}`;
      if (quizKeys.has(key)) {
        retakesCountLast30d++;
      } else {
        quizKeys.add(key);
      }
    });

    // Subject frequency
    const subjectCounts: Record<string, number> = {};
    results.forEach((q: any) => {
      const courseName = q.courses?.name || 'Onbekend';
      subjectCounts[courseName] = (subjectCounts[courseName] || 0) + 1;
    });

    const subjectsMostPracticedLast30d = Object.entries(subjectCounts)
      .map(([subject, count]) => ({ subject, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // Top 5

    return {
      quizzesCompletedLast7d,
      avgQuizScoreLast7d,
      bestQuizScoreLast7d,
      retakesCountLast30d,
      subjectsMostPracticedLast30d,
    };
  }

  // Study Metrics
  async getStudyMetrics(studentId: string): Promise<{
    vocabSessionsLast7d: number;
    vocabWordsReviewedLast7d: number;
    studySessionsLast7d: number;
  }> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Get sessions from last 7 days
    const { data: sessions, error } = await supabase
      .from("sessions")
      .select("*")
      .eq("user_id", studentId)
      .gte("happened_at", sevenDaysAgo.toISOString());

    if (error) throw error;

    const studySessionsLast7d = sessions?.length || 0;

    // For vocab, we would need a separate vocab table
    // For now, return placeholder values
    // TODO: Implement vocab tracking when vocab table is created
    const vocabSessionsLast7d = 0;
    const vocabWordsReviewedLast7d = 0;

    return {
      vocabSessionsLast7d,
      vocabWordsReviewedLast7d,
      studySessionsLast7d,
    };
  }

  // Usage Metrics
  async getUsageMetrics(studentId: string): Promise<{
    loginsLast7d: number;
    activeDaysLast7d: number;
    lastActiveAt: string | null;
    dailyActivityLast30d: Array<{ date: string; count: number }>;
  }> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get app events from last 30 days
    const { data: events, error } = await supabase
      .from("app_events")
      .select("*")
      .eq("user_id", studentId)
      .gte("created_at", thirtyDaysAgo.toISOString())
      .order("created_at", { ascending: false });

    if (error && error.code !== "PGRST116") throw error;

    const allEvents = events || [];

    // Count logins in last 7 days
    const events7d = allEvents.filter((e: any) => new Date(e.created_at) >= sevenDaysAgo);
    const loginsLast7d = events7d.filter((e: any) => e.event_type === 'login').length;

    // Count unique active days in last 7 days
    const activeDates7d = new Set<string>();
    events7d.forEach((e: any) => {
      const dateStr = new Date(e.created_at).toISOString().split('T')[0];
      activeDates7d.add(dateStr);
    });
    const activeDaysLast7d = activeDates7d.size;

    // Get last active timestamp
    const lastActiveAt = allEvents.length > 0 ? allEvents[0].created_at : null;

    // Build daily activity array for last 30 days
    const dailyCountsMap: Record<string, number> = {};
    allEvents.forEach((e: any) => {
      const dateStr = new Date(e.created_at).toISOString().split('T')[0];
      dailyCountsMap[dateStr] = (dailyCountsMap[dateStr] || 0) + 1;
    });

    // Fill in all 30 days (including zeros)
    const dailyActivityLast30d: Array<{ date: string; count: number }> = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      dailyActivityLast30d.push({
        date: dateStr,
        count: dailyCountsMap[dateStr] || 0,
      });
    }

    return {
      loginsLast7d,
      activeDaysLast7d,
      lastActiveAt,
      dailyActivityLast30d,
    };
  }

  async createAppEvent(event: InsertAppEvent): Promise<AppEvent> {
    const { data, error } = await supabase
      .from("app_events")
      .insert(event)
      .select()
      .single();

    if (error) throw error;
    return data!;
  }
}

export const storage = new PostgresStorage();
