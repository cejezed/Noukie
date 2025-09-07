import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

// Initialize AI clients
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Helper function to convert image URL to Gemini format
async function urlToGoogleGenerativePart(url) {
  const response = await fetch(url);
  const contentType = response.headers.get("content-type") || 'image/jpeg';
  const buffer = await response.arrayBuffer();
  return {
    inlineData: {
      data: Buffer.from(buffer).toString("base64"),
      mimeType: contentType,
    },
  };
}

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🔥 Chat request received');

    // Step 1: Validate user
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Geen autorisatie-token.' });
    }
    
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      console.error('❌ User authentication failed:', userError);
      return res.status(401).json({ error: 'Niet geautoriseerd.' });
    }

    console.log('✅ User authenticated:', user.id);

    const { opgave, poging, course, imageUrl, history } = req.body;

    console.log('📝 Request data:', {
      opgave: opgave?.substring(0, 50) + '...',
      course,
      hasImage: !!imageUrl,
      historyLength: history?.length || 0
    });

    // Validation
    if (!opgave && !imageUrl) {
      return res.status(400).json({ error: 'Geen opgave of afbeelding opgegeven.' });
    }

    if (!course) {
      return res.status(400).json({ error: 'Geen vak geselecteerd.' });
    }

    // Step 2: Generate AI response with Gemini
    console.log('🤖 Generating AI response...');
    
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro-latest' });
    
    let promptText = `Je bent een vriendelijke AI-tutor voor een havo 5-leerling. Het vak is: ${course}.
De vraag is: "${opgave}". De eigen poging is: "${poging || 'Niet ingevuld.'}"

Analyseer de vraag en de eventuele afbeelding. Begeleid de leerling met een Socratic-stijl hint en een wedervraag. Antwoord in het Nederlands.`;

    // Add conversation history if available
    if (history && history.length > 0) {
      promptText += `\n\nVorige conversatie:\n`;
      history.forEach((msg, index) => {
        promptText += `${msg.role === 'user' ? 'Leerling' : 'Tutor'}: ${msg.text}\n`;
      });
      promptText += `\nGeef nu je volgende antwoord rekening houdend met deze context.`;
    }
    
    const contentParts = [promptText];
    
    if (imageUrl) {
      console.log('🖼️ Processing image...');
      try {
        const imagePart = await urlToGoogleGenerativePart(imageUrl);
        contentParts.push(imagePart);
      } catch (imageError) {
        console.error('❌ Image processing failed:', imageError);
        return res.status(400).json({ error: 'Afbeelding kon niet worden verwerkt.' });
      }
    }
    
    const result = await model.generateContent({ 
      contents: [{ role: "user", parts: contentParts }] 
    });
    
    const aiResponseText = result.response.text();
    console.log('✅ AI response generated:', aiResponseText.substring(0, 100) + '...');

    // Step 3: Generate audio with OpenAI
    console.log('🔊 Generating audio...');
    
    let aiAudioUrl = null;
    try {
      const mp3 = await openai.audio.speech.create({ 
        model: "tts-1", 
        voice: "nova", 
        input: aiResponseText.substring(0, 4000) // Limit length for TTS
      });
      const buffer = Buffer.from(await mp3.arrayBuffer());
      aiAudioUrl = `data:audio/mpeg;base64,${buffer.toString('base64')}`;
      console.log('✅ Audio generated successfully');
    } catch (audioError) {
      console.error('⚠️ Audio generation failed (continuing without audio):', audioError);
      // Continue without audio - don't fail the whole request
    }

    // Step 4: Send response
    console.log('📤 Sending response...');
    res.status(200).json({ 
      aiResponseText, 
      aiAudioUrl 
    });

  } catch (error) {
    console.error("❌ Error in chat function:", error);
    res.status(500).json({ 
      error: 'Interne serverfout.', 
      details: error.message 
    });
  }
}