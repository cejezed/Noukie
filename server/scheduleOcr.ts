import OpenAI from "openai";
import fs from "fs";

/**
 * Schedule OCR Service
 * Extracts schedule data from screenshots using OpenAI Vision API
 */

export interface DetectedLesson {
  day_of_week: number | null; // 1-7 (Monday-Sunday)
  start_time: string; // HH:mm
  end_time: string; // HH:mm
  title: string; // Subject/activity name
  kind: "les" | "toets" | "sport" | "werk" | "afspraak" | "hobby" | "anders";
  course_name?: string; // For mapping to existing courses
  confidence: number; // 0-1
}

export interface ScheduleOcrResult {
  success: boolean;
  rawText?: string;
  lessons: DetectedLesson[];
  warnings: string[];
  error?: string;
}

/**
 * Uses OpenAI Vision API to analyze schedule screenshot and extract structured lesson data
 */
async function analyzeScheduleWithVision(
  imagePath: string,
  apiKey: string
): Promise<{ lessons: DetectedLesson[]; warnings: string[]; rawDescription: string }> {
  const openai = new OpenAI({ apiKey });

  // Read image and convert to base64
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString("base64");
  const mimeType = imagePath.endsWith(".png") ? "image/png" : "image/jpeg";

  const prompt = `Je bent een expert in het analyseren van Nederlandse schoolroosters.
Analyseer deze screenshot van een schoolrooster (Somtoday) en extraheer alle lessen.

BELANGRIJKE INSTRUCTIES:
1. Identificeer alle lessen met hun tijden, vakken en dagen
2. Herken Nederlandse weekdagen (maandag=1, dinsdag=2, woensdag=3, donderdag=4, vrijdag=5, zaterdag=6, zondag=7)
3. Detecteer tijden in formaat HH:mm (bijvoorbeeld 08:30, 13:15)
4. Herken vakken (Nederlands, Wiskunde, Engels, Biologie, Scheikunde, etc.)
5. Bepaal het type activiteit:
   - "les" voor normale lessen
   - "toets" als het een toets/test/examen is
   - "sport" voor gym/lichamelijke opvoeding/bewegingsonderwijs
   - "werk" voor stages/werk
   - "afspraak" voor afspraken/mentorgesprekken
   - "hobby" voor hobby's
   - "anders" voor overige activiteiten

6. Geef elke les een "confidence" score tussen 0 en 1 (hoe zeker je bent van de detectie)
7. Als je een rooster in tabelformaat ziet, lees dan elke dag en elk tijdslot zorgvuldig
8. Als tijden niet expliciet vermeld staan, gebruik dan standaard lesuren (08:30-09:20, 09:30-10:20, 10:40-11:30, 11:40-12:30, 13:00-13:50, 14:00-14:50, 15:00-15:50)

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
  "warnings": ["Eventuele waarschuwingen of onduidelijkheden"],
  "description": "Korte beschrijving van wat je ziet in de afbeelding"
}

Let op: Als je GEEN rooster kunt herkennen, retourneer dan:
{
  "lessons": [],
  "warnings": ["Kon geen roosterinformatie herkennen in de afbeelding"],
  "description": "Beschrijving van wat je wel ziet"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      max_tokens: 4000,
      temperature: 0.1, // Low temperature for more consistent parsing
    });

    const responseText = response.choices[0]?.message?.content || "";

    // Extract JSON from response (might be wrapped in markdown code blocks)
    let jsonText = responseText.trim();
    if (jsonText.startsWith("```json")) {
      jsonText = jsonText.replace(/```json\n?/g, "").replace(/```\n?$/g, "");
    } else if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/```\n?/g, "").replace(/```\n?$/g, "");
    }

    const parsed = JSON.parse(jsonText);

    return {
      lessons: parsed.lessons || [],
      warnings: parsed.warnings || [],
      rawDescription: parsed.description || "",
    };
  } catch (error) {
    console.error("OpenAI Vision parsing error:", error);
    return {
      lessons: [],
      warnings: [
        `AI kon het rooster niet verwerken: ${error instanceof Error ? error.message : "Onbekende fout"}`,
      ],
      rawDescription: "",
    };
  }
}

/**
 * Process a schedule screenshot and extract lesson data using OpenAI Vision
 */
export async function processScheduleScreenshot(
  imagePath: string,
  openaiApiKey: string
): Promise<ScheduleOcrResult> {
  try {
    console.log("🔍 Analyzing schedule screenshot with OpenAI Vision...");

    const { lessons, warnings, rawDescription } = await analyzeScheduleWithVision(
      imagePath,
      openaiApiKey
    );

    if (lessons.length === 0) {
      return {
        success: false,
        rawText: rawDescription,
        error: "Geen roosterinformatie gevonden. Controleer of de screenshot een rooster toont.",
        lessons: [],
        warnings,
      };
    }

    console.log(`✅ Found ${lessons.length} lessons`);

    return {
      success: true,
      rawText: rawDescription,
      lessons,
      warnings,
    };
  } catch (error) {
    console.error("Schedule analysis error:", error);
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
export function validateLesson(lesson: DetectedLesson): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

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
