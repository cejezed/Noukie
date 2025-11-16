import Tesseract from "tesseract.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
/**
 * Extracts text from an image using Tesseract OCR
 */
async function extractTextFromImage(imagePath) {
    const worker = await Tesseract.createWorker("nld", 1, {
        logger: (m) => {
            if (m.status === "recognizing text") {
                console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
            }
        },
    });
    try {
        const { data: { text }, } = await worker.recognize(imagePath);
        return text;
    }
    finally {
        await worker.terminate();
    }
}
/**
 * Uses Gemini AI to parse schedule text into structured lesson data
 */
async function parseScheduleWithAI(rawText, apiKey) {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
    const prompt = `Je bent een expert in het herkennen van Nederlandse schoolroosters uit OCR tekst.
Analyseer de volgende OCR-tekst die afkomstig is van een screenshot van een schoolrooster (Somtoday).

OCR TEKST:
${rawText}

BELANGRIJKE INSTRUCTIES:
1. Identificeer alle lessen met hun tijden, vakken en dagen
2. Herken Nederlandse weekdagen (maandag=1, dinsdag=2, woensdag=3, donderdag=4, vrijdag=5, zaterdag=6, zondag=7)
3. Detecteer tijden in formaat HH:mm (bijvoorbeeld 08:30, 13:15)
4. Herken vakken (Nederlands, Wiskunde, Engels, etc.)
5. Bepaal het type activiteit:
   - "les" voor normale lessen
   - "toets" als het een toets/test/examen is
   - "sport" voor gym/lichamelijke opvoeding
   - "werk" voor stages/werk
   - "afspraak" voor afspraken
   - "hobby" voor hobby's
   - "anders" voor overige activiteiten

6. Geef elke les een "confidence" score tussen 0 en 1 (hoe zeker je bent)
7. Als tijden ontbreken of onduidelijk zijn, gebruik standaard lesuren (bijv. 08:30-09:20, 09:30-10:20, etc.)

OUTPUT FORMAT (JSON):
Retourneer ALLEEN een JSON object in dit exacte formaat, zonder extra tekst:
{
  "lessons": [
    {
      "day_of_week": 1,
      "start_time": "08:30",
      "end_time": "09:20",
      "title": "Wiskunde",
      "kind": "les",
      "course_name": "Wiskunde",
      "confidence": 0.95
    }
  ],
  "warnings": ["Eventuele waarschuwingen of onduidelijkheden"]
}

Let op: Als je GEEN rooster kunt herkennen, retourneer dan:
{
  "lessons": [],
  "warnings": ["Kon geen roosterinformatie herkennen in de tekst"]
}`;
    try {
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        // Extract JSON from response (might be wrapped in markdown code blocks)
        let jsonText = responseText.trim();
        if (jsonText.startsWith("```json")) {
            jsonText = jsonText.replace(/```json\n?/g, "").replace(/```\n?$/g, "");
        }
        else if (jsonText.startsWith("```")) {
            jsonText = jsonText.replace(/```\n?/g, "").replace(/```\n?$/g, "");
        }
        const parsed = JSON.parse(jsonText);
        return {
            lessons: parsed.lessons || [],
            warnings: parsed.warnings || [],
        };
    }
    catch (error) {
        console.error("AI parsing error:", error);
        return {
            lessons: [],
            warnings: [
                `AI kon de roostertekst niet verwerken: ${error instanceof Error ? error.message : "Onbekende fout"}`,
            ],
        };
    }
}
/**
 * Process a schedule screenshot and extract lesson data
 */
export async function processScheduleScreenshot(imagePath, geminiApiKey) {
    try {
        // Step 1: OCR to extract text
        console.log("🔍 Starting OCR for schedule...");
        const rawText = await extractTextFromImage(imagePath);
        if (!rawText || rawText.trim().length < 10) {
            return {
                success: false,
                error: "Geen tekst gevonden in de afbeelding. Zorg voor een duidelijke, scherpe screenshot.",
                lessons: [],
                warnings: [],
            };
        }
        console.log("📝 OCR text extracted:", rawText.substring(0, 200) + "...");
        // Step 2: Use AI to parse schedule structure
        console.log("🤖 Parsing schedule with AI...");
        const { lessons, warnings } = await parseScheduleWithAI(rawText, geminiApiKey);
        if (lessons.length === 0) {
            return {
                success: false,
                rawText,
                error: "Geen roosterinformatie gevonden. Controleer of de screenshot een rooster toont.",
                lessons: [],
                warnings,
            };
        }
        console.log(`✅ Found ${lessons.length} lessons`);
        return {
            success: true,
            rawText,
            lessons,
            warnings,
        };
    }
    catch (error) {
        console.error("Schedule OCR error:", error);
        return {
            success: false,
            error: `Fout bij verwerken: ${error instanceof Error ? error.message : "Onbekende fout"}`,
            lessons: [],
            warnings: [],
        };
    }
}
/**
 * Validate and normalize lesson data
 */
export function validateLesson(lesson) {
    const errors = [];
    // Validate day_of_week
    if (lesson.day_of_week && (lesson.day_of_week < 1 || lesson.day_of_week > 7)) {
        errors.push(`Ongeldige weekdag: ${lesson.day_of_week}`);
    }
    // Validate times
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(lesson.start_time)) {
        errors.push(`Ongeldige starttijd: ${lesson.start_time}`);
    }
    if (!timeRegex.test(lesson.end_time)) {
        errors.push(`Ongeldige eindtijd: ${lesson.end_time}`);
    }
    // Validate end_time > start_time
    if (lesson.start_time >= lesson.end_time) {
        errors.push(`Eindtijd moet na starttijd liggen (${lesson.start_time} - ${lesson.end_time})`);
    }
    // Validate title
    if (!lesson.title || lesson.title.trim().length === 0) {
        errors.push("Titel is verplicht");
    }
    // Validate kind
    const validKinds = ["les", "toets", "sport", "werk", "afspraak", "hobby", "anders"];
    if (!validKinds.includes(lesson.kind)) {
        errors.push(`Ongeldig type: ${lesson.kind}`);
    }
    return {
        valid: errors.length === 0,
        errors,
    };
}
