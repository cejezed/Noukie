import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, uuid, time, date, boolean } from "drizzle-orm/pg-core";
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
