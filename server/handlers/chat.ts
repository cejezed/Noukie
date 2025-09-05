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