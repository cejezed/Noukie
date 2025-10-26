import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const userId = (req.headers["x-user-id"] as string) || null;
  if (!userId) return res.status(401).json({ error: "Missing x-user-id" });

  if (req.method === "GET") {
    const subject = (req.query.subject as string) || "";
    const { data, error } = await admin
      .from("study_quizzes")
      .select("*")
      .ilike("subject", subject || "%")
      .order("created_at", { ascending: false });
    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ data });
  }

  if (req.method === "POST") {
    type Body = {
      id?: string;
      subject: string;
      chapter: string;
      title: string;
      description?: string;
      is_published?: boolean;
      assigned_to?: string | null;
      available_from?: string | null;
      available_until?: string | null;
    };
    const body = req.body as Body;

    if (body.id) {
      const { data, error } = await admin
        .from("study_quizzes")
        .update({
          subject: body.subject,
          chapter: body.chapter,
          title: body.title,
          description: body.description ?? null,
          is_published: body.is_published ?? false,
          assigned_to: body.assigned_to ?? null,
          available_from: body.available_from ?? null,
          available_until: body.available_until ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", body.id)
        .eq("user_id", userId)
        .select("*")
        .single();
      if (error) return res.status(400).json({ error: error.message });
      return res.status(200).json({ data });
    } else {
      const { data, error } = await admin
        .from("study_quizzes")
        .insert([
          {
            user_id: userId,
            subject: body.subject,
            chapter: body.chapter,
            title: body.title,
            description: body.description ?? null,
            is_published: body.is_published ?? false,
            assigned_to: body.assigned_to ?? null,
            available_from: body.available_from ?? null,
            available_until: body.available_until ?? null,
          },
        ])
        .select("*")
        .single();
      if (error) return res.status(400).json({ error: error.message });
      return res.status(201).json({ data });
    }
  }

  if (req.method === "DELETE") {
    const id = (req.query.id as string) || "";
    if (!id) return res.status(400).json({ error: "Missing ?id" });

    // eigenaar-check
    const { data: q, error: qErr } = await admin
      .from("study_quizzes")
      .select("id,user_id")
      .eq("id", id)
      .single();
    if (qErr) return res.status(400).json({ error: qErr.message });
    if (q.user_id !== userId) return res.status(403).json({ error: "Not owner" });

    const { error: delErr } = await admin.from("study_quizzes").delete().eq("id", id);
    if (delErr) return res.status(400).json({ error: delErr.message });

    return res.status(204).end();
  }

  res.setHeader("Allow", "GET, POST, DELETE");
  return res.status(405).end("Method Not Allowed");
}
