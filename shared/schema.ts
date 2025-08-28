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
  educationLevel: text("education_level", { enum: ["vmbo", "havo", "vwo", "mbo"] }), // null for parents
  grade: integer("grade"), // 1-6 for all levels, null for parents
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
});

export const courses = pgTable("courses", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  level: text("level").default("havo5"),
});

export const schedule = pgTable("schedule", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id).notNull(),
  courseId: uuid("course_id").references(() => courses.id),
  dayOfWeek: integer("day_of_week"), // 1=ma, 7=zo
  startTime: time("start_time"),
  endTime: time("end_time"),
  kind: text("kind", { enum: ["les", "toets", "sport", "werk", "afspraak", "hobby", "anders"] }).default("les"),
  title: text("title"),
  date: date("date"), // for one-off tests
});

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id).notNull(),
  courseId: uuid("course_id").references(() => courses.id),
  title: text("title").notNull(),
  dueAt: timestamp("due_at", { withTimezone: true }),
  estMinutes: integer("est_minutes"),
  priority: integer("priority").default(0),
  status: text("status").default("todo"),
  source: text("source"), // 'check-in' | 'manual'
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id).notNull(),
  happenedAt: timestamp("happened_at", { withTimezone: true }).default(sql`now()`),
  transcript: text("transcript"),
  summary: text("summary"),
  coachText: text("coach_text"),
});

export const materials = pgTable("materials", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id).notNull(),
  courseId: uuid("course_id").references(() => courses.id),
  title: text("title"),
  chapter: text("chapter"),
  paragraph: text("paragraph"),
  textContent: text("text_content"), // OCR result
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
});

export const quizResults = pgTable("quiz_results", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id).notNull(),
  courseId: uuid("course_id").references(() => courses.id),
  materialId: uuid("material_id").references(() => materials.id),
  score: integer("score"),
  weakPoints: text("weak_points"),
});

export const parentChildRelationships = pgTable("parent_child_relationships", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  parentId: uuid("parent_id").references(() => users.id).notNull(),
  childId: uuid("child_id").references(() => users.id).notNull(),
  childEmail: text("child_email").notNull(), // For lookup during setup
  childName: text("child_name").notNull(), // For display in parent dashboard
  isConfirmed: boolean("is_confirmed").default(false), // Child can confirm/deny
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  createdAt: true,
}); // Allow id to be provided (for Supabase auth sync)

export const insertCourseSchema = createInsertSchema(courses).omit({
  id: true,
});

export const insertScheduleSchema = createInsertSchema(schedule).omit({
  id: true,
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
});

export const insertSessionSchema = createInsertSchema(sessions).omit({
  id: true,
  happenedAt: true,
});

export const insertMaterialSchema = createInsertSchema(materials).omit({
  id: true,
  createdAt: true,
});

export const insertQuizResultSchema = createInsertSchema(quizResults).omit({
  id: true,
});

export const insertParentChildRelationshipSchema = createInsertSchema(parentChildRelationships).omit({
  id: true,
  createdAt: true,
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
export type QuizResult = typeof quizResults.$inferSelect;
export type InsertQuizResult = z.infer<typeof insertQuizResultSchema>;
export type ParentChildRelationship = typeof parentChildRelationships.$inferSelect;
export type InsertParentChildRelationship = z.infer<typeof insertParentChildRelationshipSchema>;
