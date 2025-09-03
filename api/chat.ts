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
    // Stap 1: Valideer de gebruiker op dezelfde manier als in courses.ts
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Geen autorisatie-token.' });
    }
    
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return res.status(401).json({ error: 'Niet geautoriseerd.' });
    }

    const { opgave, poging, course, imageUrl } = req.body;

    // Stap 2: Genereer de AI-tekst met Gemini
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro-latest' });
    const promptText = `
      Je bent een vriendelijke AI-tutor voor een havo 5-leerling. Het vak is: ${course}.
      De vraag is: "${opgave}". De eigen poging is: "${poging || 'Niet ingevuld.'}"
      Analyseer de vraag en de eventuele afbeelding. Begeleid de leerling met een Socratic-stijl hint en een wedervraag. Antwoord in het Nederlands.
    `;
    
    const contentParts: (string | Part)[] = [promptText];
    if (imageUrl) {
      const imagePart = await urlToGoogleGenerativePart(imageUrl);
      contentParts.push(imagePart);
    }
    
    const result = await model.generateContent({ contents: [{ role: "user", parts: contentParts }] });
    const aiResponseText = result.response.text();

    // Stap 3: Genereer de audio met OpenAI
    const mp3 = await openai.audio.speech.create({ model: "tts-1", voice: "nova", input: aiResponseText });
    const buffer = Buffer.from(await mp3.arrayBuffer());
    const aiAudioUrl = `data:audio/mpeg;base64,${buffer.toString('base64')}`;

    // Stap 4: Stuur het complete antwoord terug naar de front-end
    res.status(200).json({ aiResponseText, aiAudioUrl });
  } catch (error: any) {
    console.error("Fout in /api/chat route:", error);
    res.status(500).json({ error: 'Interne serverfout.', details: error.message });
  }
}

