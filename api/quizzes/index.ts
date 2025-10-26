import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';


const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);


export default async function handler(req: VercelRequest, res: VercelResponse) {
const userId = (req.headers['x-user-id'] as string) || null;
if (!userId) return res.status(401).json({ error: 'Missing x-user-id' });


if (req.method === 'GET') {
const subject = (req.query.subject as string) || '';
// Toon gepubliceerde quizzes (en eigen ongepubliceerde voor beheer)
const { data, error } = await admin
.from('study_quizzes')
.select('*')
.or(`is_published.eq.true,user_id.eq.${userId}`)
.ilike('subject', subject || '%')
.order('created_at', { ascending: false });
if (error) return res.status(400).json({ error: error.message });
return res.status(200).json({ data });
}


if (req.method === 'POST') {
const body = req.body as { id?: string; subject: string; chapter: string; title: string; description?: string; is_published?: boolean };
if (body.id) {
const { data, error } = await admin
.from('study_quizzes')
.update({ subject: body.subject, chapter: body.chapter, title: body.title, description: body.description, is_published: body.is_published ?? false, updated_at: new Date().toISOString() })
.eq('id', body.id)
.eq('user_id', userId)
.select('*')
.single();
if (error) return res.status(400).json({ error: error.message });
return res.status(200).json({ data });
} else {
const { data, error } = await admin
.from('study_quizzes')
.insert([{ user_id: userId, subject: body.subject, chapter: body.chapter, title: body.title, description: body.description, is_published: body.is_published ?? false }])
.select('*')
.single();
if (error) return res.status(400).json({ error: error.message });
return res.status(201).json({ data });
}
}


res.setHeader('Allow', 'GET, POST');
res.status(405).end('Method Not Allowed');
}