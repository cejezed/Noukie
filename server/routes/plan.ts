// server/routes/plan.ts
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/client";     // ⬅️ pad moet kloppen met jouw project
import { tasks } from "../db/schema";  // ⬅️ tasks staat in je Drizzle schema

const router = Router();

const Body = z.object({
  transcript: z.string().min(1),
  date: z.string().optional(),
  userId: z.string().uuid(), // komt uit TextCheckin
});

// Vervang deze dummy planner later door je echte AI-planner
function makePlan(transcript: string) {
  const base = transcript.slice(0, 40);
  return [
    { title: `Plan: ${base}… (1)`, estMinutes: 25, priority: 1 },
    { title: `Plan: ${base}… (2)`, estMinutes: 30, priority: 0 },
  ];
}

router.post("/", async (req, res, next) => {
  try {
    const parsed = Body.parse(req.body);

    // Maak taken op basis van transcript (dummy)
    const planned = makePlan(parsed.transcript);

    // Insert via Drizzle (camelCase in TS → snake_case in DB)
    const rows = await db
      .insert(tasks)
      .values(
        planned.map((t) => ({
          user_id: parsed.userId,              // → user_id
          title: t.title,
          estMinutes: t.estMinutes ?? null,   // → est_minutes
          courseId: null,                     // → course_id
          priority: t.priority ?? 0,
          status: "todo",
        }))
      )
      .returning();

    res.status(201).json({ tasks: rows });
  } catch (e) {
    next(e);
  }
});

export default router;
