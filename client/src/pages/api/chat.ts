import type { NextApiRequest, NextApiResponse } from 'next';
import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import OpenAI from 'openai';

// Initialiseer de AI clients met je API-sleutels uit de environment variabelen
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// Helper functie om een afbeelding van een URL op te halen en om te zetten naar het formaat dat Gemini begrijpt
async function urlToGoogleGenerativePart(url: string): Promise<Part> {
  const response = await fetch(url);
  const contentType = response.headers.get("content-type") || 'image/jpeg'; // Standaardwaarde als mime-type niet wordt gevonden
  const buffer = await response.arrayBuffer();
  return {
    inlineData: {
      data: Buffer.from(buffer).toString("base64"),
      mimeType: contentType,
    },
  };
}

// De response die we terugsturen naar de front-end
type ChatApiResponse = {
  aiResponseText: string;
  aiAudioUrl: string; // Dit wordt een base64 data URL
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ChatApiResponse | { error: string }>
) {
  // Accepteer alleen POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { opgave, poging, course, imageUrl } = req.body;

    // --- Stap 1: Genereer de tekst met Gemini (nu met optionele afbeelding) ---
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro-latest' });

    // Bouw de prompt voor de AI
    const promptText = `
      Je bent een vriendelijke en behulpzame AI-tutor voor een havo 5-leerling.
      Het vak is: ${course}.
      De vraag van de leerling is: "${opgave}"
      De eigen poging van de leerling is: "${poging || 'De leerling heeft nog niets geprobeerd.'}"
      
      Analyseer de vraag en de eventuele afbeelding.
      Je taak is om de leerling te begeleiden, niet om het antwoord voor te kauwen.
      - Geef een stapsgewijze, Socratic-stijl hint.
      - Stel een wedervraag die de leerling aan het denken zet.
      - Leg het onderliggende concept kort en helder uit als dat nodig is.
      - Houd je antwoord beknopt en direct gericht op de vraag.
      - Antwoord in het Nederlands.
    `;

    let generationResult;
    if (imageUrl) {
      // Als er een afbeelding is, maak een multimodale request
      const imagePart = await urlToGoogleGenerativePart(imageUrl);
      generationResult = await model.generateContent([promptText, imagePart]);
    } else {
      // Anders, een standaard tekst request
      generationResult = await model.generateContent(promptText);
    }

    const aiResponseText = generationResult.response.text();

    // --- Stap 2: Zet de tekst om naar spraak met OpenAI ---
    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: "nova",
      input: aiResponseText,
    });
    
    const buffer = Buffer.from(await mp3.arrayBuffer());
    const aiAudioUrl = `data:audio/mpeg;base64,${buffer.toString('base64')}`;

    // --- Stap 3: Stuur het complete antwoord terug naar de front-end ---
    res.status(200).json({ aiResponseText, aiAudioUrl });

  } catch (error) {
    console.error("Fout in de /api/chat route:", error);
    res.status(500).json({ error: 'Interne serverfout bij het verwerken van de AI-vraag.' });
  }
}
