import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';


const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);


export default async function handler(req: VercelRequest, res: VercelResponse) {
const userId = (req.headers['x-user-id'] as string) || null;
if (!userId) return res.status(401).json({ error: 'Missing x-user-id' });


if (req.method === 'POST') {
const body = req.body as { action: 'start'|'answer'|'finish'; quiz_id?: string; result_id?: string; question_id?: string; given_answer?: string; mode?: string; time_remaining?: number };


if (body.action === 'start') {
const { data, error } = await admin
.from('study_results')
.insert([{ quiz_id: body.quiz_id!, user_id: userId }])
.select('*')
.single();
if (error) return res.status(400).json({ error: error.message });
return res.status(201).json({ result: data });
}


if (body.action === 'answer') {
// vraag ophalen om correctheid te bepalen
const { data: q, error: qerr } = await admin
.from('study_questions')
.select('id,qtype,answer')
.eq('id', body.question_id!)
.single();
if (qerr) return res.status(400).json({ error: qerr.message });
const isCorrect = q.qtype === 'mc' || q.qtype === 'open' ? (q.answer ? (String(body.given_answer ?? '').trim().toLowerCase() === String(q.answer).trim().toLowerCase()) : null) : null;


const { error } = await admin
.from('study_answers')
.insert([{ result_id: body.result_id!, question_id: body.question_id!, given_answer: body.given_answer ?? null, is_correct: isCorrect }]);
if (error) return res.status(400).json({ error: error.message });
return res.status(201).json({ ok: true, is_correct: isCorrect });
}


if (body.action === 'finish') {
// stats berekenen
const { data: answers, error: aerr } = await admin
.from('study_answers')
.select('is_correct')
.eq('result_id', body.result_id!);
if (aerr) return res.status(400).json({ error: aerr.message });
const total = answers.length;
const correct = answers.filter(a => a.is_correct === true).length;
const percent = total > 0 ? Math.round((correct/total)*10000)/100 : 0;


const { data, error } = await admin
.from('study_results')
.update({ finished_at: new Date().toISOString(), total, correct, percent })
.eq('id', body.result_id!)
.eq('user_id', userId)
.select('*')
.single();
if (error) return res.status(400).json({ error: error.message });

// ✅ STUDYPLAY INTEGRATION: Award XP and Playtime
let xpAwarded = 0;
let playtimeAwarded = 0;
let leveledUp = false;
let newLevel = 1;

try {
  // Get the base URL for the Express server
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : (req.headers.origin || 'http://localhost:5000');

  // Calculate XP based on mode
  // Game mode: +75 XP (bonus +25 for time pressure)
  // Practice mode: +50 XP (standard)
  const isGameMode = body.mode === 'game';
  const baseXP = isGameMode ? 75 : 50;

  // Bonus XP for finishing quickly in game mode (if more than 30 seconds remaining)
  const timeRemaining = body.time_remaining || 0;
  const speedBonus = isGameMode && timeRemaining > 30 ? 10 : 0;
  const totalXP = baseXP + speedBonus;

  // Award XP
  const xpResponse = await fetch(`${baseUrl}/api/profile/xp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      delta: totalXP,
      reason: isGameMode ? 'quiz_game_completed' : 'quiz_completed',
      meta: { quizId: body.quiz_id, resultId: body.result_id, score: percent, mode: body.mode, timeRemaining }
    })
  });

  if (xpResponse.ok) {
    const xpData = await xpResponse.json();
    xpAwarded = totalXP;
    leveledUp = xpData.leveledUp || false;
    newLevel = xpData.newLevel || 1;
  }

  // Award Playtime
  // Game mode: +4 minutes (net +2 after cost)
  // Practice mode: +3 minutes
  const playtimeAmount = isGameMode ? 4 : 3;
  const playtimeResponse = await fetch(`${baseUrl}/api/playtime/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      delta: playtimeAmount,
      reason: isGameMode ? 'quiz_game_completed' : 'quiz_completed',
      meta: { quizId: body.quiz_id, resultId: body.result_id, mode: body.mode }
    })
  });

  if (playtimeResponse.ok) {
    playtimeAwarded = playtimeAmount;
  }

  // Note: Streak update and tests_completed increment happen automatically
  // in the storage.awardXp() and storage.addPlaytime() methods via updateStreak()
  // and incrementTestsCompleted() calls in the Express route handlers

} catch (err) {
  // Log error but don't fail the quiz completion
  console.error('Failed to award XP/playtime:', err);
}

return res.status(200).json({
  result: data,
  rewards: {
    xpAwarded,
    playtimeAwarded,
    leveledUp,
    newLevel
  }
});
}
}


res.setHeader('Allow', 'POST');
res.status(405).end('Method Not Allowed');
}