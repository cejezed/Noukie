import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

// Initialize AI client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🤖 Coach chat request received');
    
    // Step 1: Authenticate user
    const authHeader = req.headers.authorization as string;
    const token = authHeader?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Geen autorisatie token' });
    }
    
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      console.error('❌ User authentication failed:', userError);
      return res.status(401).json({ error: 'Niet geautoriseerd' });
    }

    console.log('✅ User authenticated:', user.id);

    const { message, userId, systemHint, context, history } = req.body;
    
    // Validation
    if (!message || !userId) {
      return res.status(400).json({ error: 'Message en userId zijn verplicht' });
    }

    // Verify userId matches authenticated user
    if (userId !== user.id) {
      return res.status(403).json({ error: 'Geen toegang tot deze gebruiker' });
    }

    console.log(`👤 Coach chat for user: ${userId}`);
    
    // Step 2: Gather context about the user
    console.log('📚 Gathering user context...');
    
    // Get coach memory
    const { data: memory } = await supabase
      .from('coach_memory')
      .select('*')
      .eq('user_id', userId)
      .order('last_interaction', { ascending: false })
      .limit(10);
    
    // Get recent check-ins
    const { data: recentCheckins } = await supabase
      .from('checkins')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(5);
    
    // Get recent tasks/planning (graceful fail if table doesn't exist)
    const { data: recentTasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5)
      .then(result => result)
      .catch(() => ({ data: null }));
    
    // Step 3: Build context for AI
    const coachContext = buildCoachContext(memory, recentCheckins, recentTasks?.data, message);
    
    // Step 4: Generate AI response with Gemini
    console.log('🤖 Generating coach response...');
    
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });
    
    // Build conversation history
    let conversationHistory = "";
    if (history && history.length > 0) {
      conversationHistory = "\n\nVorige berichten in dit gesprek:\n";
      history.slice(-6).forEach((msg: any) => {
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

    const result = await model.generateContent(prompt);
    let response = await result.response.text();

    // Clean up debug signals
    response = response.replace(/\s*\{"signals":\s*\{[^}]*\}\}\s*/g, '').trim();
    
    console.log('✅ Coach response generated');
    
    // Step 5: Update coach memory with new information
    await updateCoachMemory(userId, message, response);
    
    // Step 6: Generate proactive suggestions for later
    await generateProactiveSuggestions(userId, message, memory || []);
    
    // Step 7: Send response
    console.log('📤 Sending coach response...');
    res.status(200).json({
      reply: response,
      message: response,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('❌ Coach chat error:', error);
    res.status(500).json({ 
      error: 'Coach is tijdelijk niet beschikbaar', 
      details: error.message 
    });
  }
}

// Helper function to build context about the user
function buildCoachContext(memory: any[], checkins: any[], tasks: any[], currentMessage: string): string {
  let context = "Wat ik weet over deze leerling:\n";
  
  // Previous coach conversations and topics
  if (memory && memory.length > 0) {
    context += "\nEerdere coach gesprekken:\n";
    memory.forEach(m => {
      const date = new Date(m.last_interaction).toLocaleDateString('nl-NL');
      context += `- ${m.topic} (${m.sentiment}): ${m.context.substring(0, 100)}... - ${date}\n`;
    });
  }
  
  // Check-ins ONLY when relevant
  const lowerMessage = currentMessage.toLowerCase();
  const isWellbeingRelated = lowerMessage.includes('moe') || lowerMessage.includes('slaap') || 
                            lowerMessage.includes('stress') || lowerMessage.includes('energie') ||
                            lowerMessage.includes('humeur') || lowerMessage.includes('voelen');
  
  if (isWellbeingRelated && checkins && checkins.length > 0) {
    const recentCheckin = checkins[0];
    const daysAgo = Math.floor((Date.now() - new Date(recentCheckin.date).getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysAgo <= 2) { // Only recent check-ins
      const mood = ['😰 slecht', '😟 niet zo', '😐 oké', '🙂 goed', '😊 super'][recentCheckin.mood_color - 1] || '😐 neutraal';
      context += `\nRecente check-in (${recentCheckin.date}): Humeur ${mood}, Slaap: ${recentCheckin.sleep}/5, Energie: ${recentCheckin.eating}/5\n`;
    }
  }
  
  // Recent tasks/planning (if available)
  if (tasks && tasks.length > 0) {
    context += "\nRecente taken/planning:\n";
    tasks.forEach(t => {
      const date = new Date(t.created_at).toLocaleDateString('nl-NL');
      context += `- ${t.title || t.description || 'Taak'} - ${date}\n`;
    });
  }
  
  if (!memory?.length && !tasks?.length) {
    context += "Dit is een nieuwe leerling of er zijn nog weinig eerdere gegevens beschikbaar.\n";
  }
  
  return context;
}

// Update coach memory with new conversation
async function updateCoachMemory(userId: string, userMessage: string, coachResponse: string) {
  try {
    const topic = extractTopic(userMessage);
    const sentiment = extractSentiment(userMessage, coachResponse);
    
    const context = `Leerling: "${userMessage.substring(0, 200)}" | Coach: "${coachResponse.substring(0, 200)}..."`;
    
    await supabase.from('coach_memory').upsert({
      user_id: userId,
      topic,
      context,
      sentiment,
      last_interaction: new Date().toISOString()
    }, { 
      onConflict: 'user_id,topic',
      ignoreDuplicates: false 
    });
    
    console.log(`💾 Memory updated for user ${userId}: ${topic} (${sentiment})`);
  } catch (error) {
    console.error('❌ Failed to update coach memory:', error);
  }
}

// Generate proactive suggestions for later follow-up
async function generateProactiveSuggestions(userId: string, message: string, memory: any[]) {
  try {
    const suggestions = [];
    const lowerMessage = message.toLowerCase();
    
    // Study-related suggestions
    if (lowerMessage.includes('wiskunde') && (lowerMessage.includes('moeilijk') || lowerMessage.includes('snap niet'))) {
      suggestions.push({
        user_id: userId,
        suggestion_text: "Zullen we morgen 15 minuten wiskunde oefenen? Ik kan je helpen een planning te maken!",
        suggestion_type: "study_reminder",
        priority: 2
      });
    }
    
    if (lowerMessage.includes('stress') || lowerMessage.includes('druk') || lowerMessage.includes('zenuwachtig')) {
      suggestions.push({
        user_id: userId,
        suggestion_text: "Je klinkt gestrest. Zullen we samen kijken naar je planning voor aankomende week?",
        suggestion_type: "wellbeing_check",
        priority: 3
      });
    }
    
    if (lowerMessage.includes('toets') || lowerMessage.includes('proefwerk') || lowerMessage.includes('examen')) {
      suggestions.push({
        user_id: userId,
        suggestion_text: "Heb je al een studieplan voor je toets? Ik help graag met het maken van een schema!",
        suggestion_type: "study_planning",
        priority: 2
      });
    }
    
    // Follow-up based on previous struggles
    const recentStruggles = memory?.filter(m => 
      m.sentiment === 'struggling' && 
      new Date(m.last_interaction) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last week
    );
    
    if (recentStruggles?.length > 0) {
      const topic = recentStruggles[0].topic;
      suggestions.push({
        user_id: userId,
        suggestion_text: `Hoe gaat het nu met ${topic}? Vorige week had je er nog moeite mee.`,
        suggestion_type: "follow_up",
        priority: 1
      });
    }
    
    // Save suggestions to database
    if (suggestions.length > 0) {
      await supabase.from('coach_suggestions').insert(suggestions);
      console.log(`💡 Generated ${suggestions.length} suggestions for user ${userId}`);
    }
    
  } catch (error) {
    console.error('❌ Failed to generate suggestions:', error);
  }
}

// Extract topic from user message
function extractTopic(message: string): string {
  const topics = {
    'wiskunde': ['wiskunde', 'rekenen', 'som', 'formule', 'algebra', 'goniometrie'],
    'nederlands': ['nederlands', 'essay', 'schrijven', 'taal', 'literatuur'],
    'engels': ['engels', 'english', 'vertalen'],
    'geschiedenis': ['geschiedenis', 'historie'],
    'biologie': ['biologie', 'bio'],
    'scheikunde': ['scheikunde', 'chemie'],
    'natuurkunde': ['natuurkunde', 'fysica'],
    'planning': ['planning', 'tijd', 'deadline', 'organiseren', 'schema'],
    'stress': ['stress', 'druk', 'zenuwachtig', 'bang', 'zorgen'],
    'toetsen': ['toets', 'proefwerk', 'examen', 'test'],
    'algemeen': []
  };
  
  const lowerMessage = message.toLowerCase();
  for (const [topic, keywords] of Object.entries(topics)) {
    if (keywords.some(keyword => lowerMessage.includes(keyword))) {
      return topic;
    }
  }
  return 'algemeen';
}

// Extract sentiment from conversation
function extractSentiment(userMessage: string, coachResponse: string): string {
  const negative = ['moeilijk', 'lukt niet', 'snap niet', 'stress', 'verdrietig', 'bang', 'zorgen', 'help', 'probleem'];
  const positive = ['goed', 'super', 'gelukt', 'blij', 'trots', 'leuk', 'fijn', 'succesvol'];
  
  const lowerMessage = userMessage.toLowerCase();
  
  if (negative.some(word => lowerMessage.includes(word))) return 'struggling';
  if (positive.some(word => lowerMessage.includes(word))) return 'positive';
  return 'neutral';
}