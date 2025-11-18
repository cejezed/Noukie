import { createClient } from '@supabase/supabase-js';
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
export default async function handler(req, res) {
    const userId = req.headers['x-user-id'] || null;
    if (!userId)
        return res.status(401).json({ error: 'Missing x-user-id' });
    if (req.method === 'POST') {
        const body = req.body;
        if (body.action === 'start') {
            const { data, error } = await admin
                .from('study_results')
                .insert([{ quiz_id: body.quiz_id, user_id: userId }])
                .select('*')
                .single();
            if (error)
                return res.status(400).json({ error: error.message });
            return res.status(201).json({ result: data });
        }
        if (body.action === 'answer') {
            // vraag ophalen om correctheid te bepalen
            const { data: q, error: qerr } = await admin
                .from('study_questions')
                .select('id,qtype,answer')
                .eq('id', body.question_id)
                .single();
            if (qerr)
                return res.status(400).json({ error: qerr.message });
            const isCorrect = q.qtype === 'mc' || q.qtype === 'open' ? (q.answer ? (String(body.given_answer ?? '').trim().toLowerCase() === String(q.answer).trim().toLowerCase()) : null) : null;
            const { error } = await admin
                .from('study_answers')
                .insert([{ result_id: body.result_id, question_id: body.question_id, given_answer: body.given_answer ?? null, is_correct: isCorrect }]);
            if (error)
                return res.status(400).json({ error: error.message });
            return res.status(201).json({ ok: true, is_correct: isCorrect });
        }
        if (body.action === 'finish') {
            // stats berekenen
            const { data: answers, error: aerr } = await admin
                .from('study_answers')
                .select('is_correct')
                .eq('result_id', body.result_id);
            if (aerr)
                return res.status(400).json({ error: aerr.message });
            const total = answers.length;
            const correct = answers.filter(a => a.is_correct === true).length;
            const percent = total > 0 ? Math.round((correct / total) * 10000) / 100 : 0;
            const { data, error } = await admin
                .from('study_results')
                .update({ finished_at: new Date().toISOString(), total, correct, percent })
                .eq('id', body.result_id)
                .eq('user_id', userId)
                .select('*')
                .single();
            if (error)
                return res.status(400).json({ error: error.message });
            return res.status(200).json({ result: data });
        }
    }
    res.setHeader('Allow', 'POST');
    res.status(405).end('Method Not Allowed');
}
