// server/db/schema.ts (of src/schema.ts)
import { pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";

export const tasks = pgTable("tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),                   // snake_case kolom
  title: text("title").notNull(),
  status: text("status").notNull().default("todo"),    // 'todo' of 'done'
  estMinutes: integer("est_minutes"),
  courseId: uuid("course_id"),
  priority: integer("priority").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
