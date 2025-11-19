import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, uuid, time, date, boolean, real, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: uuid("id").primaryKey(), // Allow external UUIDs from Supabase auth
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: text("role", { enum: ["student", "parent"] }).notNull(),
  // Student-specific fields
  education_level: text("education_level", { enum: ["vmbo", "havo", "vwo", "mbo"] }), // null for parents
  grade: integer("grade"), // 1-6 for all levels, null for parents
  classroom_id: uuid("classroom_id"), // References classrooms table
  created_at: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
});

export const courses = pgTable("courses", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  user_id: uuid("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  level: text("level").default("havo5"),
});

export const schedule = pgTable("schedule", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  user_id: uuid("user_id").references(() => users.id).notNull(),
  course_id: uuid("course_id").references(() => courses.id),
  day_of_week: integer("day_of_week"), // 1=ma, 7=zo
  start_time: time("start_time"),
  end_time: time("end_time"),
  kind: text("kind", { enum: ["les", "toets", "sport", "werk", "afspraak", "hobby", "anders"] }).default("les"),
  title: text("title"),
  date: date("date"), // for one-off tests
  is_recurring: boolean("is_recurring").default(false), // true for weekly recurring items, false for one-time events
});

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  user_id: uuid("user_id").references(() => users.id).notNull(),
  course_id: uuid("course_id").references(() => courses.id),
  title: text("title").notNull(),
  due_at: timestamp("due_at", { withTimezone: true }),
  est_minutes: integer("est_minutes"),
  priority: integer("priority").default(0),
  status: text("status").default("todo"),
  source: text("source"), // 'check-in' | 'manual'
  created_at: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  user_id: uuid("user_id").references(() => users.id).notNull(),
  happened_at: timestamp("happened_at", { withTimezone: true }).default(sql`now()`),
  transcript: text("transcript"),
  summary: text("summary"),
  coach_text: text("coach_text"),
});

export const materials = pgTable("materials", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  user_id: uuid("user_id").references(() => users.id).notNull(),
  course_id: uuid("course_id").references(() => courses.id),
  title: text("title"),
  chapter: text("chapter"),
  paragraph: text("paragraph"),
  text_content: text("text_content"), // OCR result
  created_at: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
});

export const quiz_results = pgTable("quiz_results", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  user_id: uuid("user_id").references(() => users.id).notNull(),
  course_id: uuid("course_id").references(() => courses.id),
  material_id: uuid("material_id").references(() => materials.id),
  score: integer("score"),
  weak_points: text("weak_points"),
});

export const parent_child_relationships = pgTable("parent_child_relationships", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  parent_id: uuid("parent_id").references(() => users.id).notNull(),
  child_id: uuid("child_id").references(() => users.id).notNull(),
  child_email: text("child_email").notNull(), // For lookup during setup
  child_name: text("child_name").notNull(), // For display in parent dashboard
  is_confirmed: boolean("is_confirmed").default(false), // Child can confirm/deny
  created_at: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
});

export const calendar_integrations = pgTable("calendar_integrations", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  user_id: uuid("user_id").references(() => users.id).notNull().unique(),
  provider: text("provider", { enum: ["google"] }).notNull(),
  access_token: text("access_token"),
  refresh_token: text("refresh_token"),
  token_expires: timestamp("token_expires", { withTimezone: true }),
  calendar_id: text("calendar_id"), // primary calendar ID to sync
  last_sync_at: timestamp("last_sync_at", { withTimezone: true }),
  sync_enabled: boolean("sync_enabled").default(true),
  created_at: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
});

export const imported_events = pgTable("imported_events", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  user_id: uuid("user_id").references(() => users.id).notNull(),
  schedule_id: uuid("schedule_id").references(() => schedule.id).notNull(),
  external_id: text("external_id").notNull(), // Google Calendar event ID
  provider: text("provider", { enum: ["google"] }).notNull(),
  last_modified: timestamp("last_modified", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
});

// Compliments feature tables
export const classrooms = pgTable("classrooms", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  education_level: text("education_level", { enum: ["vmbo", "havo", "vwo", "mbo"] }).notNull(),
  grade: integer("grade").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
});

export const compliments = pgTable("compliments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  from_user: uuid("from_user"), // NULL for anonymous
  to_user: uuid("to_user").notNull(), // References auth.users
  classroom_id: uuid("classroom_id").references(() => classrooms.id).notNull(),
  message: text("message").notNull(),
  toxicity_score: real("toxicity_score").default(0),
  created_at: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
});

export const compliment_streaks = pgTable("compliment_streaks", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  user_id: uuid("user_id").notNull(), // References auth.users
  current_streak: integer("current_streak").default(0),
  longest_streak: integer("longest_streak").default(0),
  last_sent_date: date("last_sent_date"),
  total_sent: integer("total_sent").default(0),
  total_received: integer("total_received").default(0),
  points: integer("points").default(0),
  badges: jsonb("badges").default(sql`'[]'::jsonb`),
  created_at: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
  updated_at: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
});

// Checkins table (daily mental check-ins)
export const checkins = pgTable("checkins", {
  id: uuid("id").defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull().references(() => users.id),
  date: date("date").notNull(),
  mood_color: integer("mood_color").notNull(),
  sleep: integer("sleep"),
  tension: integer("tension"),
  eating: integer("eating"),
  medication: boolean("medication"),
  notes: text("notes"),
  created_at: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
  updated_at: timestamp("updated_at", { withTimezone: true }).default(sql`now()`),
});

// StudyPlay game platform tables
export const study_playtime = pgTable("study_playtime", {
  user_id: uuid("user_id").primaryKey().references(() => users.id),
  balance_minutes: integer("balance_minutes").notNull().default(0),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
});

export const study_playtime_log = pgTable("study_playtime_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull().references(() => users.id),
  delta: integer("delta").notNull(),
  reason: text("reason").notNull(),
  meta: jsonb("meta"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
});

export const study_profile = pgTable("study_profile", {
  user_id: uuid("user_id").primaryKey().references(() => users.id),
  xp_total: integer("xp_total").notNull().default(0),
  level: integer("level").notNull().default(1),
  games_played: integer("games_played").notNull().default(0),
  tests_completed: integer("tests_completed").notNull().default(0),
  streak_days: integer("streak_days").notNull().default(0),
  last_activity_date: date("last_activity_date"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
});

export const study_scores = pgTable("study_scores", {
  id: uuid("id").defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull().references(() => users.id),
  game_id: text("game_id").notNull(),
  score: integer("score").notNull(),
  level_reached: integer("level_reached"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
});

export const study_xp_log = pgTable("study_xp_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  user_id: uuid("user_id").notNull().references(() => users.id),
  delta: integer("delta").notNull(),
  reason: text("reason").notNull(),
  meta: jsonb("meta"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  created_at: true,
}); // Allow id to be provided (for Supabase auth sync)

export const insertCourseSchema = createInsertSchema(courses).omit({
  id: true,
});

export const insertScheduleSchema = createInsertSchema(schedule).omit({
  id: true,
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  created_at: true,
});

export const insertSessionSchema = createInsertSchema(sessions).omit({
  id: true,
  happened_at: true,
});

export const insertMaterialSchema = createInsertSchema(materials).omit({
  id: true,
  created_at: true,
});

export const insertQuizResultSchema = createInsertSchema(quiz_results).omit({
  id: true,
});

export const insertParentChildRelationshipSchema = createInsertSchema(parent_child_relationships).omit({
  id: true,
  created_at: true,
});

export const insertCalendarIntegrationSchema = createInsertSchema(calendar_integrations).omit({
  id: true,
  created_at: true,
});

export const insertImportedEventSchema = createInsertSchema(imported_events).omit({
  id: true,
  created_at: true,
});

export const insertClassroomSchema = createInsertSchema(classrooms).omit({
  id: true,
  created_at: true,
});

export const insertComplimentSchema = createInsertSchema(compliments).omit({
  id: true,
  created_at: true,
});

export const insertComplimentStreakSchema = createInsertSchema(compliment_streaks).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const insertCheckinSchema = createInsertSchema(checkins).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const insertStudyPlaytimeSchema = createInsertSchema(study_playtime).omit({
  updated_at: true,
});

export const insertStudyPlaytimeLogSchema = createInsertSchema(study_playtime_log).omit({
  id: true,
  created_at: true,
});

export const insertStudyProfileSchema = createInsertSchema(study_profile).omit({
  created_at: true,
  updated_at: true,
});

export const insertStudyScoreSchema = createInsertSchema(study_scores).omit({
  id: true,
  created_at: true,
});

export const insertStudyXpLogSchema = createInsertSchema(study_xp_log).omit({
  id: true,
  created_at: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Course = typeof courses.$inferSelect;
export type InsertCourse = z.infer<typeof insertCourseSchema>;
export type Schedule = typeof schedule.$inferSelect;
export type InsertSchedule = z.infer<typeof insertScheduleSchema>;
export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Session = typeof sessions.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Material = typeof materials.$inferSelect;
export type InsertMaterial = z.infer<typeof insertMaterialSchema>;
export type QuizResult = typeof quiz_results.$inferSelect;
export type InsertQuizResult = z.infer<typeof insertQuizResultSchema>;
export type ParentChildRelationship = typeof parent_child_relationships.$inferSelect;
export type InsertParentChildRelationship = z.infer<typeof insertParentChildRelationshipSchema>;
export type CalendarIntegration = typeof calendar_integrations.$inferSelect;
export type InsertCalendarIntegration = z.infer<typeof insertCalendarIntegrationSchema>;
export type ImportedEvent = typeof imported_events.$inferSelect;
export type InsertImportedEvent = z.infer<typeof insertImportedEventSchema>;
export type Classroom = typeof classrooms.$inferSelect;
export type InsertClassroom = z.infer<typeof insertClassroomSchema>;
export type Compliment = typeof compliments.$inferSelect;
export type InsertCompliment = z.infer<typeof insertComplimentSchema>;
export type ComplimentStreak = typeof compliment_streaks.$inferSelect;
export type InsertComplimentStreak = z.infer<typeof insertComplimentStreakSchema>;

// Checkin types
export type Checkin = typeof checkins.$inferSelect;
export type InsertCheckin = z.infer<typeof insertCheckinSchema>;

// StudyPlay types
export type StudyPlaytime = typeof study_playtime.$inferSelect;
export type InsertStudyPlaytime = z.infer<typeof insertStudyPlaytimeSchema>;
export type StudyPlaytimeLog = typeof study_playtime_log.$inferSelect;
export type InsertStudyPlaytimeLog = z.infer<typeof insertStudyPlaytimeLogSchema>;
export type StudyProfile = typeof study_profile.$inferSelect;
export type InsertStudyProfile = z.infer<typeof insertStudyProfileSchema>;
export type StudyScore = typeof study_scores.$inferSelect;
export type InsertStudyScore = z.infer<typeof insertStudyScoreSchema>;
export type StudyXpLog = typeof study_xp_log.$inferSelect;
export type InsertStudyXpLog = z.infer<typeof insertStudyXpLogSchema>;
