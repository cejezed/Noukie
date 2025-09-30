// server/handlers/chat.ts
import type { Request, Response } from "express";

/**
 * Bestaande chat-handler (ONGEWIJZIGD)
 */
export async function handleChatRequest(req: Request, res: Response) {
  try {
    // ... bestaande auth code ...

    const { opgave, poging, course, imageUrl, history } = req.body;

    console.log('Received chat request:', { opgave, course, historyLength: history?.length });
    console.log('History:', JSON.stringify(history, null, 2));

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Build conversation history
    let contents = [];

    if (history && Array.isArray(history) && history.length > 0) {
      // Convert frontend history to Gemini format
      contents = history.map((item: any) => ({
        role: item.role === 'user' ? 'user' : 'model',
        parts: [{ text: item.text }]
      }));
      console.log('Converted contents:', JSON.stringify(contents, null, 2));
    }

    // Add current prompt
    const currentPrompt = `
      Je bent een vriendelijke AI-tutor voor een havo 5-leerling.
      Het vak is: ${course}.
      De vraag van de leerling is: "${opgave}"
      De eigen poging van de leerling is: "${poging || 'Niet ingevuld.'}"

      Analyseer de vraag en begeleid de leerling met een Socratic-stijl hint.
      Geef geen directe antwoorden. Houd je antwoord beknopt en in het Nederlands.
    `;

    const userPromptParts: Part[] = [{ text: currentPrompt }];
    if (imageUrl) {
      const imagePart = await urlToGoogleGenerativePart(imageUrl);
      userPromptParts.push(imagePart);
    }

    contents.push({
      role: "user",
      parts: userPromptParts
    });

    console.log('Final contents being sent to Gemini:', JSON.stringify(contents, null, 2));

    // Call Gemini
    const result = await model.generateContent({ contents });
    const aiResponseText = result.response.text();

    console.log('Gemini response received:', aiResponseText.substring(0, 100) + '...');

    // Generate audio
    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: "nova",
      input: aiResponseText
    });
    const buffer = Buffer.from(await mp3.arrayBuffer());
    const aiAudioUrl = `data:audio/mpeg;base64,${buffer.toString('base64')}`;

    res.status(200).json({ aiResponseText, aiAudioUrl });
  } catch (error: any) {
    console.error("Chat error details:", error);
    res.status(500).json({ error: 'Interne serverfout.', details: error.message });
  }
}

/**
 * NIEUWE: uitleg-endpoint voor /api/explain
 * - accepteert { text } of { message } in JSON body
 * - geeft duidelijke 400 terug als input ontbreekt
 * - placeholder logic; vervang door je eigen LLM/uitleg-service wanneer gewenst
 */
export async function explain(req: Request, res: Response) {
  try {
    const body = req.body ?? {};
    const raw = (typeof body.text === "string" ? body.text : body.message) as string | undefined;
    const text = raw?.trim() ?? "";

    if (text.length < 3) {
      return res.status(400).json({
        error: "MISSING_TEXT",
        message: 'Stuur JSON met { "text": "<min. 3 tekens>" } (of "message").',
        example: { text: "Leg fotosynthese uit in simpele stappen." }
      });
    }

    const subject =
      typeof body.subject === "string" && body.subject.trim().length
        ? body.subject.trim()
        : undefined;

    // TODO: vervang dit blok door je echte uitleg/LLM-call
    const explanation =
      `Uitleg${subject ? ` (vak: ${subject})` : ""}:\n` +
      `• Samenvatting van je vraag: "${text}".\n` +
      `• Geef 2–3 korte, stapsgewijze hints (geen volledige oplossing).\n` +
      `• Voeg één concreet voorbeeld toe.\n`;

    return res.json({ explanation });
  } catch (e: any) {
    console.error("[explain] error", e);
    return res.status(500).json({ error: "internal_error", detail: String(e?.message || e) });
  }
}
