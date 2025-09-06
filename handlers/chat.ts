import type { Request, Response } from 'express';
import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import OpenAI from 'openai';
import { supabase } from '../client/src/lib/supabase';

// Initialiseer de AI clients met de API-sleutels uit de environment variabelen
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// Helper functie om een afbeelding van een URL om te zetten naar het formaat dat Gemini nodig heeft
async function urlToGoogleGenerativePart(url: string): Promise<Part> {
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

export async function handleChatRequest(req: Request, res: Response) {
  try {
    console.log('🔥 Chat request received:', {
      method: req.method,
      url: req.url,
      hasBody: !!req.body,
      bodyKeys: Object.keys(req.body || {})
    });

    // Stap 1: Valideer de gebruiker op dezelfde manier als in courses.ts
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      console.log('❌ No authorization token');
      return res.status(401).json({ error: 'Geen autorisatie-token.' });
    }
    
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      console.log('❌ User authentication failed:', userError);
      return res.status(401).json({ error: 'Niet geautoriseerd.' });
    }

    console.log('✅ User authenticated:', user.id);

    const { opgave, poging, course, imageUrl, history } = req.body;

    console.log('📝 Request data:', {
      opgave: opgave?.substring(0, 50) + '...',
      poging: poging?.substring(0, 50) + '...',
      course,
      hasImage: !!imageUrl,
      historyLength: history?.length || 0
    });

    // Validatie
    if (!opgave && !imageUrl) {
      return res.status(400).json({ error: 'Geen opgave of afbeelding opgegeven.' });
    }

    if (!course) {
      return res.status(400).json({ error: 'Geen vak geselecteerd.' });
    }

    // Stap 2: Genereer de AI-tekst met Gemini
    console.log('🤖 Generating AI response...');
    
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro-latest' });
    
    let promptText = `Je bent een vriendelijke AI-tutor voor een havo 5-leerling. Het vak is: ${course}.
De vraag is: "${opgave}". De eigen poging is: "${poging || 'Niet ingevuld.'}"

Analyseer de vraag en de eventuele afbeelding. Begeleid de leerling met een Socratic-stijl hint en een wedervraag. Antwoord in het Nederlands.`;

    // Voeg conversation history toe als die er is
    if (history && history.length > 0) {
      promptText += `\n\nVorige conversatie:\n`;
      history.forEach((msg: any, index: number) => {
        promptText += `${msg.role === 'user' ? 'Leerling' : 'Tutor'}: ${msg.text}\n`;
      });
      promptText += `\nGeef nu je volgende antwoord rekening houdend met deze context.`;
    }
    
    const contentParts: (string | Part)[] = [promptText];
    
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

    // Stap 3: Genereer de audio met OpenAI
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

    // Stap 4: Stuur het complete antwoord terug naar de front-end
    console.log('📤 Sending response...');
    res.status(200).json({ 
      aiResponseText, 
      aiAudioUrl 
    });

  } catch (error: any) {
    console.error("❌ Fout in /api/chat route:", error);
    res.status(500).json({ 
      error: 'Interne serverfout.', 
      details: error.message 
    });
  }
}