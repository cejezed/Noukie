// api/coach.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

// --- Env guards (voorkomt 'string | undefined' errors én runtime issues)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;

if (!GEMINI_API_KEY) throw new Error('Missing GEMINI_API_KEY');
if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Missing SUPABASE_URL or SUPABASE_*_KEY');

// Initialize clients
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // --- Auth
    const authHeader = req.headers.authorization as string | undefined;
    const token = authHeader?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Geen autorisatie token' });

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    const user = userData?.user ?? null;
    if (userError || !user) return res.status(401).json({ error: 'Niet geautoriseerd' });

    const { message, userId, systemHint, context, history } = (req.body ?? {}) as {
      message?: string;
      userId?: string;
      systemHint?: string;
      context?: unknown;
      history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    };

    if (!message || !userId) {
      return res.status(400).json({ error: 'Message en userId zijn verplicht' });
    }
    if (userId !== user.id) {
      return res.status(403).json({ error: 'Geen toegang tot deze gebruiker' });
    }

    // --- Data ophalen
    const { data: memory = [] } = await supabase
      .from('coach_memory')
      .select('*')
      .eq('user_id', userId)
      .order('last_interaction', { ascending: false })
      .limit(10);

    const { data: recentCheckins = [] } = await supabase
      .from('checkins')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(5);

    // Let op: géén .catch chaining op Supabase call; gebruik try/catch.
    let recentTasksRows: any[] = [];
    try {
      const { data: tasksData } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5);
      recentTasksRows = tasksData ?? [];
    } catch {
      recentTasksRows = [];
    }

    // --- Prompt opbouwen
    const coachContext = buildCoachContext(memory, recentCheckins, recentTasksRows, message);

    let conversationHistory = '';
    if (history && history.length > 0) {
      conversationHistory += '\n\nVorige berichten in dit gesprek:\n';
      history.slice(-6).forEach((msg) => {
        conversationHistory += `${msg.role === 'user' ? 'Leerling' : 'Coach'}: ${msg.content}\n`;
      });
    }

    const prompt = `Je bent Coach Noukie, een persoonlijke studiecoach voor Nederlandse middelbare scholieren.

CONTEXT OVER DEZE LEERLING:
${coachContext}

SYSTEEM HINT: ${systemHint || 'Geen specifieke hint'}
EXTRA CONTEXT: ${context ? JSON.stringify(context) : 'Geen extra context'}

${conversationHistory}

HUIDIG BERICHT VAN LEERLING: "${message}"

GEDRAG ALS COACH:
- Onthoud wat je weet over deze leerling uit eerdere gesprekken
- Gebruik check-in informatie ALLEEN als het relevant is voor het onderwerp
- Stel relevante vervolgvragen en toon oprechte interesse
- Moedig aan en vier kleine successen
- Bied concrete, haalbare stappen en planning
- Wees warm, persoonlijk en empathisch
- Spreek Nederlands in een vriendelijke, toegankelijke toon
- Als iemand worstelt met een vak, verwijs naar eerdere problemen of successen
- Stel proactief hulp voor met planning, studie-aanpak of welzijn
- Vermijd het constant benoemen van slaap/stemming tenzij relevant

Reageer als een coach die deze leerling echt kent en begrijpt. Maak het persoonlijk maar niet opdringerig.`;

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro-latest' });
    const result = await model.generateContent(prompt);
    let response = await result.response.text();

    response = response.replace(/\s*\{"signals":\s*\{[^}]*\}\}\s*/g, '').trim();

    // --- Memory & suggesties
    await updateCoachMemory(userId, message, response);
    await generateProactiveSuggestions(userId, message, memory ?? []);

    // --- Reply
    return res.status(200).json({
      reply: response,
      message: response,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('❌ Coach chat error:', error);
    return res.status(500).json({
      error: 'Coach is tijdelijk niet beschikbaar',
      details: error?.message ?? 'Unknown error',
    });
  }
}

// Helpers
function buildCoachContext(
  memory: any[],
  checkins: any[],
  tasks: any[],
  currentMessage: string
): string {
  let context = 'Wat ik weet over deze leerling:\n';

  if (memory?.length) {
    context += '\nEerdere coach gesprekken:\n';
    for (const m of memory) {
      const date = m?.last_interaction ? new Date(m.last_interaction).toLocaleDateString('nl-NL') : '';
      const snippet = (m?.context ?? '').toString().slice(0, 100);
      context += `- ${m?.topic ?? 'onderwerp'} (${m?.sentiment ?? 'neutral'}): ${snippet}... - ${date}\n`;
    }
  }

  const lowerMessage = (currentMessage ?? '').toLowerCase();
  const isWellbeingRelated =
    ['moe', 'slaap', 'stress', 'energie', 'humeur', 'voelen'].some((w) => lowerMessage.includes(w));

  if (isWellbeingRelated && checkins?.length) {
    const c0 = checkins[0];
    if (c0?.date) {
      const daysAgo = Math.floor((Date.now() - new Date(c0.date).getTime()) / (1000 * 60 * 60 * 24));
      if (daysAgo <= 2) {
        const idx = Math.max(1, Math.min(Number(c0.mood_color ?? 3), 5)) - 1;
        const mood = ['😰 slecht', '😟 niet zo', '😐 oké', '🙂 goed', '😊 super'][idx] ?? '😐 neutraal';
        const slaap = c0.sleep ?? c0.sleep_score ?? '?';
        const energie = c0.energy ?? c0.energy_score ?? '?';
        context += `\nRecente check-in (${c0.date}): Humeur ${mood}, Slaap: ${slaap}/5, Energie: ${energie}/5\n`;
      }
    }
  }

  if (tasks?.length) {
    context += '\nRecente taken/planning:\n';
    for (const t of tasks) {
      const date = t?.created_at ? new Date(t.created_at).toLocaleDateString('nl-NL') : '';
      const label = t?.title ?? t?.description ?? 'Taak';
      context += `- ${label} - ${date}\n`;
    }
  }

  if (!memory?.length && !tasks?.length) {
    context += 'Dit is een nieuwe leerling of er zijn nog weinig eerdere gegevens beschikbaar.\n';
  }

  return context;
}

async function updateCoachMemory(userId: string, userMessage: string, coachResponse: string) {
  try {
    const topic = extractTopic(userMessage);
    const sentiment = extractSentiment(userMessage, coachResponse);
    const ctx = `Leerling: "${(userMessage ?? '').slice(0, 200)}" | Coach: "${(coachResponse ?? '').slice(0, 200)}..."`;

    await supabase
      .from('coach_memory')
      .upsert(
        {
          user_id: userId,
          topic,
          context: ctx,
          sentiment,
          last_interaction: new Date().toISOString(),
        },
        { onConflict: 'user_id,topic', ignoreDuplicates: false }
      );
  } catch (err) {
    console.error('❌ Failed to update coach memory:', err);
  }
}

async function generateProactiveSuggestions(userId: string, message: string, memory: any[]) {
  try {
    const suggestions: any[] = [];
    const lowerMessage = (message ?? '').toLowerCase();

    if (lowerMessage.includes('wiskunde') && (lowerMessage.includes('moeilijk') || lowerMessage.includes('snap niet'))) {
      suggestions.push({
        user_id: userId,
        suggestion_text: 'Zullen we morgen 15 minuten wiskunde oefenen? Ik kan je helpen een planning te maken!',
        suggestion_type: 'study_reminder',
        priority: 2,
      });
    }
    if (['stress', 'druk', 'zenuwachtig'].some((w) => lowerMessage.includes(w))) {
      suggestions.push({
        user_id: userId,
        suggestion_text: 'Je klinkt gestrest. Zullen we samen kijken naar je planning voor aankomende week?',
        suggestion_type: 'wellbeing_check',
        priority: 3,
      });
    }
    if (['toets', 'proefwerk', 'examen'].some((w) => lowerMessage.includes(w))) {
      suggestions.push({
        user_id: userId,
        suggestion_text: 'Heb je al een studieplan voor je toets? Ik help graag met het maken van een schema!',
        suggestion_type: 'study_planning',
        priority: 2,
      });
    }

    const recentStruggles =
      (memory ?? []).filter(
        (m: any) =>
          m?.sentiment === 'struggling' &&
          m?.last_interaction &&
          new Date(m.last_interaction) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      ) ?? [];

    if (recentStruggles.length > 0) {
      const topic = recentStruggles[0]?.topic ?? 'dat onderwerp';
      suggestions.push({
        user_id: userId,
        suggestion_text: `Hoe gaat het nu met ${topic}? Vorige week had je er nog moeite mee.`,
        suggestion_type: 'follow_up',
        priority: 1,
      });
    }

    if (suggestions.length) {
      await supabase.from('coach_suggestions').insert(suggestions);
    }
  } catch (err) {
    console.error('❌ Failed to generate suggestions:', err);
  }
}

function extractTopic(message: string): string {
  const topics: Record<string, string[]> = {
    wiskunde: ['wiskunde', 'rekenen', 'som', 'formule', 'algebra', 'goniometrie'],
    nederlands: ['nederlands', 'essay', 'schrijven', 'taal', 'literatuur'],
    engels: ['engels', 'english', 'vertalen'],
    geschiedenis: ['geschiedenis', 'historie'],
    biologie: ['biologie', 'bio'],
    scheikunde: ['scheikunde', 'chemie'],
    natuurkunde: ['natuurkunde', 'fysica'],
    planning: ['planning', 'tijd', 'deadline', 'organiseren', 'schema'],
    stress: ['stress', 'druk', 'zenuwachtig', 'bang', 'zorgen'],
    toetsen: ['toets', 'proefwerk', 'examen', 'test'],
    algemeen: [],
  };
  const lower = (message ?? '').toLowerCase();
  for (const [topic, keywords] of Object.entries(topics)) {
    if (keywords.some((k) => lower.includes(k))) return topic;
  }
  return 'algemeen';
}

function extractSentiment(userMessage: string, coachResponse: string): string {
  const neg = ['moeilijk', 'lukt niet', 'snap niet', 'stress', 'verdrietig', 'bang', 'zorgen', 'help', 'probleem'];
  const pos = ['goed', 'super', 'gelukt', 'blij', 'trots', 'leuk', 'fijn', 'succesvol'];
  const lower = (userMessage ?? '').toLowerCase();
  if (neg.some((w) => lower.includes(w))) return 'struggling';
  if (pos.some((w) => lower.includes(w))) return 'positive';
  return 'neutral';
}
