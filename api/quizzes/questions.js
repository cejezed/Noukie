import { createClient } from '@supabase/supabase-js';
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
export default async function handler(req, res) {
    const userId = req.headers['x-user-id'] || null;
    if (!userId)
        return res.status(401).json({ error: 'Missing x-user-id' });
    if (req.method === 'GET') {
        const quizId = req.query.quiz_id;
        const { data, error } = await admin
            .from('study_questions')
            .select('*')
            .eq('quiz_id', quizId)
            .order('sort_order', { ascending: true });
        if (error)
            return res.status(400).json({ error: error.message });
        return res.status(200).json({ data });
    }
    if (req.method === 'POST') {
        const body = req.body;
        // ownership check van de quiz
        const { data: quiz, error: qerr } = await admin.from('study_quizzes').select('user_id').eq('id', body.quiz_id).single();
        if (qerr)
            return res.status(400).json({ error: qerr.message });
        if (quiz.user_id !== userId)
            return res.status(403).json({ error: 'Not owner' });
        const payload = body.items.map((i, idx) => ({
            quiz_id: body.quiz_id,
            qtype: i.qtype ?? 'mc',
            prompt: i.prompt,
            choices: i.choices ? JSON.stringify(i.choices) : null,
            answer: i.answer ?? null,
            explanation: i.explanation ?? null,
            sort_order: i.sort_order ?? idx,
        }));
        const { error } = await admin.from('study_questions').insert(payload);
        if (error)
            return res.status(400).json({ error: error.message });
        return res.status(201).json({ ok: true, count: payload.length });
    }
    res.setHeader('Allow', 'GET, POST');
    res.status(405).end('Method Not Allowed');
}
