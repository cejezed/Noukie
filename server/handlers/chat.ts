console.log('Google AI API Key:', process.env.GOOGLE_AI_API_KEY ? 'GEVONDEN' : 'NIET GEVONDEN');
console.log('Eerste 10 karakters van key:', process.env.GOOGLE_AI_API_KEY?.substring(0, 10));
console.log('GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'GEVONDEN' : 'NIET GEVONDEN');

import type { Request, Response } from 'express';
import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import OpenAI from 'openai';
import { supabase } from '../../client/src/lib/supabase';

// Initialiseer de AI clients met de API-sleutels uit de environment variabelen
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY!);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// Helper-functie om een afbeelding van een URL op te halen en om te zetten naar het formaat dat Gemini begrijpt
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

// Handler voor de AI chat requests
export async function handleChatRequest(req: Request, res: Response) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Geen autorisatie-token.' });
    
    // Verifieer de gebruiker via Supabase
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return res.status(401).json({ error: 'Niet geautoriseerd.' });

    const { opgave, poging, course, imageUrl, history } = req.body;
    
    // Gebruik 'gemini-1.5-flash' of een ander beschikbaar model
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Creëer de initiële prompt
    const initialPrompt = `
      Je bent een vriendelijke AI-tutor voor een havo 5-leerling.
      Het vak is: ${course}.
      De vraag van de leerling is: "${opgave}"
      De eigen poging van de leerling is: "${poging || 'Niet ingevuld.'}"
      
      Analyseer de vraag en de eventuele afbeelding. Begeleid de leerling met een Socratic-stijl hint en een wedervraag.
      Geef geen directe antwoorden. Houd je antwoord beknopt en in het Nederlands.
    `;
    
    // Bouw de chatgeschiedenis op met de nieuwe input
    let contents = [];
    if (history && Array.isArray(history)) {
      contents = history.map((item: any) => ({
        role: item.role,
        parts: [{ text: item.text }]
      }));
    }

    // Voeg de huidige prompt en afbeelding toe aan de geschiedenis
    const userPromptParts: Part[] = [{ text: initialPrompt }];
    if (imageUrl) {
      const imagePart = await urlToGoogleGenerativePart(imageUrl);
      userPromptParts.push(imagePart);
    }
    contents.push({
      role: "user",
      parts: userPromptParts
    });

    // Roep het Gemini model aan met de volledige geschiedenis
    const result = await model.generateContent({
      contents: contents
    });
    
    const aiResponseText = result.response.text();

    // Zet de tekst om naar spraak
    const mp3 = await openai.audio.speech.create({ model: "tts-1", voice: "nova", input: aiResponseText });
    const buffer = Buffer.from(await mp3.arrayBuffer());
    const aiAudioUrl = `data:audio/mpeg;base64,${buffer.toString('base64')}`;

    // Stuur het complete antwoord terug
    res.status(200).json({ aiResponseText, aiAudioUrl });
  } catch (error: any) {
    console.error("Fout in /api/chat route:", error);
    res.status(500).json({ error: 'Interne serverfout.', details: error.message });
  }
}
