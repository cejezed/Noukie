import type { Request, Response } from 'express';
import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import OpenAI from 'openai';
import { supabase } from '../../client/src/lib/supabase';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

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
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Geen autorisatie-token.' });
    
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return res.status(401).json({ error: 'Niet geautoriseerd.' });

    const { opgave, poging, course, imageUrl } = req.body;
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro-latest' });
    
    const promptText = `Je bent een AI-tutor voor een havo 5-leerling. Vak: ${course}. Vraag: "${opgave}". Poging: "${poging || 'N.v.t.'}". Analyseer de vraag/afbeelding en geef een Socratic-stijl hint en een wedervraag. Antwoord in het Nederlands.`;
    
    const contentParts: (string | Part)[] = [promptText];
    if (imageUrl) {
      contentParts.push(await urlToGoogleGenerativePart(imageUrl));
    }
    
    const result = await model.generateContent({ contents: [{ role: "user", parts: contentParts }] });
    const aiResponseText = result.response.text();

    const mp3 = await openai.audio.speech.create({ model: "tts-1", voice: "nova", input: aiResponseText });
    const buffer = Buffer.from(await mp3.arrayBuffer());
    const aiAudioUrl = `data:audio/mpeg;base64,${buffer.toString('base64')}`;

    res.status(200).json({ aiResponseText, aiAudioUrl });
  } catch (error: any) {
    console.error("Fout in /api/chat route:", error);
    res.status(500).json({ error: 'Interne serverfout.', details: error.message });
  }
}

