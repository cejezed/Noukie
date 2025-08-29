import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const notes = pgTable("notes", {
  id: serial("id").primaryKey(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
