import OpenAI from "openai";
import fs from "fs";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

export async function transcribeAudio(audioFilePath: string): Promise<{ text: string }> {
  if (!openai) {
    // Dummy response when no API key
    return { text: "Vandaag moet ik wiskunde opgaven 5-10 maken en biologie presentatie voorbereiden." };
  }

  const audioReadStream = fs.createReadStream(audioFilePath);

  const transcription = await openai.audio.transcriptions.create({
    file: audioReadStream,
    model: "whisper-1",
  });

  return { text: transcription.text };
}

export async function generatePlan(transcript: string, date: string): Promise<{
  tasks: Array<{
    title: string;
    course: string;
    due_at: string;
    est_minutes: number;
    priority: number;
  }>;
  coach_text: string;
}> {
  if (!openai) {
    // Dummy response when no API key
    return {
      tasks: [
        {
          title: "Wiskunde opgaven 5-10",
          course: "Wiskunde A",
          due_at: new Date().toISOString(),
          est_minutes: 40,
          priority: 2
        }
      ],
      coach_text: "Vandaag pak je wiskunde opgaven 5-10. Neem je tijd en vraag hulp als je vastloopt."
    };
  }

  const response = await openai.chat.completions.create({
    model: "gpt-5",
    messages: [
      {
        role: "system",
        content: "Je bent een Nederlandse huiswerkcoach voor 5 havo. Beoordeel transcript, maak concrete taken (Titel, Vak, Deadline, Tijdinschatting), houd rekening met komende toetsen en rooster. Antwoord kort en actiegericht. Formatteer in JSON."
      },
      {
        role: "user",
        content: `Transcript: ${transcript}\nDatum: ${date}\n\nMaak een planning met taken en coach advies in JSON formaat.`
      }
    ],
    response_format: { type: "json_object" },
  });

  return JSON.parse(response.choices[0].message.content || "{}");
}

export async function generateExplanation(
  mode: "text" | "image",
  text?: string,
  ocrText?: string,
  course?: string
): Promise<{
  steps: string[];
  example: { prompt: string; solution: string };
  quiz: { question: string; choices: string[]; answer: string };
  coach_text: string;
}> {
  if (!openai) {
    // Dummy response when no API key
    return {
      steps: [
        "Identificeer de rechthoekige driehoek met de gegeven hoek",
        "Bepaal de overstaande zijde en de schuine zijde",
        "Gebruik de formule: sin(hoek) = overstaande zijde / schuine zijde"
      ],
      example: {
        prompt: "Gegeven: driehoek ABC met hoek A = 30°, overstaande zijde = 5 cm, schuine zijde = 10 cm",
        solution: "sin(30°) = 5/10 = 0.5"
      },
      quiz: {
        question: "Wat is sin(60°) in een driehoek waar de overstaande zijde 8 cm is en de schuine zijde 10 cm?",
        choices: ["A) 0.6", "B) 0.8", "C) 1.25"],
        answer: "B"
      },
      coach_text: "Probeer eerst stap 1 en 2. Zeg 'help' als je vastloopt."
    };
  }

  const content = text || ocrText || "Algemene uitleg";
  const subject = course || "algemeen";

  const response = await openai.chat.completions.create({
    model: "gpt-5",
    messages: [
      {
        role: "system",
        content: "Je bent een Nederlandse huiswerkcoach voor 5 havo. Voor 'Ik snap dit niet': geef 3–6 genummerde uitlegstappen, 1 uitgewerkt voorbeeld, en 1 controlevraag met meerkeuze opties. Formatteer in JSON."
      },
      {
        role: "user",
        content: `Onderwerp: ${content}\nVak: ${subject}\n\nGeef uitleg met stappen, voorbeeld en quiz in JSON formaat.`
      }
    ],
    response_format: { type: "json_object" },
  });

  return JSON.parse(response.choices[0].message.content || "{}");
}
