// server/db/schema.ts
import { pgTable, pgSchema, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";
// (Optioneel) auth.users referentie als je NIET je eigen users-tabel wilt
export const auth = pgSchema("auth");
export const authUsers = auth.table("users", {
    id: uuid("id").primaryKey(),
    email: text("email"),
});
export const courses = pgTable("courses", {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    color: text("color"),
    // Koppel user_id aan auth.users.id
    user_id: uuid("user_id").notNull().references(() => authUsers.id), // ✅ snake_case property
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(), // ✅ snake_case property
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(), // ✅ snake_case property
});
export const tasks = pgTable("tasks", {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").notNull().default("todo"), // 'todo' | 'done'
    priority: integer("priority").default(0).notNull(), // 0=geen, 1=normaal, 2=hoog
    est_minutes: integer("est_minutes"), // ✅ snake_case property
    actual_minutes: integer("actual_minutes"), // ✅ snake_case property
    due_at: timestamp("due_at", { withTimezone: true }), // ✅ snake_case property
    // Relaties
    user_id: uuid("user_id").notNull().references(() => authUsers.id), // ✅ snake_case property
    course_id: uuid("course_id").references(() => courses.id), // ✅ snake_case property
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(), // ✅ snake_case property
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(), // ✅ snake_case property
});
export const sessions = pgTable("sessions", {
    id: uuid("id").defaultRandom().primaryKey(),
    task_id: uuid("task_id").notNull().references(() => tasks.id), // ✅ snake_case property
    user_id: uuid("user_id").notNull().references(() => authUsers.id), // ✅ snake_case property
    started_at: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(), // ✅ snake_case property
    ended_at: timestamp("ended_at", { withTimezone: true }), // ✅ snake_case property
    actual_minutes: integer("actual_minutes"), // ✅ snake_case property
    notes: text("notes"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(), // ✅ snake_case property
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(), // ✅ snake_case property
});
