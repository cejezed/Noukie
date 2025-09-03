import { Router } from "express";
import { z } from "zod";
import { db } from "../db/client";
import { tasks } from "../db/schema";
import { eq, and } from "drizzle-orm";

const router = Router();

// Tijdelijk: userId uit body/header (vervang later door echte auth)
function getUserId(req: any): string | undefined {
  return req.user?.id || req.body?.user_id || req.query?.user_id || req.headers["x-user-id"];
}

const CreateTask = z.object({
  title: z.string().min(1),
  est_minutes: z.number().int().positive().optional(),      // ✅ snake_case
  course_id: z.string().uuid().optional().nullable(),       // ✅ snake_case  
  priority: z.number().int().min(0).max(2).optional(),
  user_id: z.string().uuid().optional(),                    // ✅ snake_case
  due_at: z.string().optional(),                            // ✅ snake_case - voeg due_at toe
});

router.get("/", async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const rows = userId
      ? await db.select().from(tasks).where(eq(tasks.user_id, userId))  // ✅ snake_case
      : await db.select().from(tasks).limit(100);
    res.json(rows);
  } catch (e) { next(e); }
});

router.post("/", async (req, res, next) => {
  try {
    const parsed = CreateTask.parse(req.body);
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Geen user_id (auth) gevonden" });

    const [row] = await db.insert(tasks).values({
      user_id: userId,                                       // ✅ snake_case
      title: parsed.title,
      est_minutes: parsed.est_minutes ?? null,              // ✅ snake_case
      course_id: parsed.course_id ?? null,                  // ✅ snake_case
      priority: parsed.priority ?? 0,
      status: "todo",
      due_at: parsed.due_at ? new Date(parsed.due_at) : null, // ✅ snake_case
    }).returning();

    res.status(201).json(row);
  } catch (e) { next(e); }
});

router.patch("/:id/status", async (req, res, next) => {
  try {
    const { id } = req.params;
    const status = req.body?.status;
    if (status !== "todo" && status !== "done") {
      return res.status(400).json({ error: "status must be 'todo' or 'done'" });
    }
    const userId = getUserId(req);
    const where = userId ? and(eq(tasks.id, id), eq(tasks.user_id, userId)) : eq(tasks.id, id); // ✅ snake_case
    const [row] = await db.update(tasks).set({ status }).where(where).returning();
    if (!row) return res.status(404).json({ error: "Task niet gevonden" });
    res.json(row);
  } catch (e) { next(e); }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);
    const where = userId ? and(eq(tasks.id, id), eq(tasks.user_id, userId)) : eq(tasks.id, id); // ✅ snake_case
    const [row] = await db.delete(tasks).where(where).returning();
    if (!row) return res.status(404).json({ error: "Task niet gevonden" });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;