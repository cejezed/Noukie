import OpenAI from "openai";
import fs from "fs";
// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
export async function transcribeAudio(audioFilePath) {
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
export async function generatePlan(transcript, date) {
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
        model: "gpt-4o",
        messages: [
            {
                role: "system",
                content: "Je bent een Nederlandse huiswerkcoach voor 5 havo. BELANGRIJKE REGEL: Maak ALLEEN taken die de leerling expliciet noemt. Verzin NIETS extra. Als de input vaag is, vraag om verduidelijking. Maak concrete taken (Titel, Vak, Deadline, Tijdinschatting) ALLEEN van wat letterlijk wordt genoemd. Formatteer in JSON."
            },
            {
                role: "user",
                content: `Transcript: ${transcript}\nDatum: ${date}\n\nMAAK ALLEEN TAKEN DIE EXPLICIET GENOEMD WORDEN. Verzin niets extra. Als de input te vaag is, antwoord dan met lege tasks array en coach_text die om verduidelijking vraagt. JSON formaat verwacht.`
            }
        ],
        response_format: { type: "json_object" },
    });
    return JSON.parse(response.choices[0].message.content || "{}");
}
export async function generateExplanation(mode, text, ocrText, course) {
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
            coach_text: "Probeer eerst stap 1 en 2. Zeg 'help' als je vastloopt.",
            resources: [
                {
                    title: "Khan Academy NL - Trigonometrie",
                    url: "https://nl.khanacademy.org/math/trigonometry"
                },
                {
                    title: "Wiskunde Online - Sinus en Cosinus",
                    url: "https://www.wiskundeonline.nl/sinus-cosinus"
                }
            ]
        };
    }
    const content = text || ocrText || "Algemene uitleg";
    const subject = course || "algemeen";
    const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
            {
                role: "system",
                content: "Je bent een Nederlandse huiswerkcoach voor 5 havo. BELANGRIJK: Geef alleen correcte, geverifieerde informatie. Als je iets niet zeker weet, zeg dan expliciet 'Hier ben ik niet zeker van' of 'Dit moet je nakijken bij je docent'. Verzin nooit feiten, formules of antwoorden. Voor 'Ik snap dit niet': geef 3–6 genummerde uitlegstappen, 1 uitgewerkt voorbeeld, 1 controlevraag met meerkeuze opties, en 2-3 nuttige links. Gebruik alleen echte, bestaande websites in je bronnen. Gebruik exact deze JSON structuur: {\"steps\": [\"stap1\", \"stap2\"], \"example\": {\"prompt\": \"opgave\", \"solution\": \"antwoord\"}, \"quiz\": {\"question\": \"vraag\", \"choices\": [\"A) optie1\", \"B) optie2\", \"C) optie3\"], \"answer\": \"A\"}, \"coach_text\": \"moedigend advies\", \"resources\": [{\"title\": \"Khan Academy NL\", \"url\": \"https://nl.khanacademy.org/...\"}]}"
            },
            {
                role: "user",
                content: `Onderwerp: ${content}\nVak: ${subject}\n\nLET OP: Geef alleen correcte informatie die je zeker weet. Als je twijfelt, vermeld dit expliciet. Verzin geen feiten, formules of URLs.\n\nGeef uitleg met exact deze JSON structuur: {\"steps\": [\"stap1\", \"stap2\"], \"example\": {\"prompt\": \"opgave\", \"solution\": \"antwoord\"}, \"quiz\": {\"question\": \"vraag\", \"choices\": [\"A) optie1\", \"B) optie2\", \"C) optie3\"], \"answer\": \"A\"}, \"coach_text\": \"moedigend advies\", \"resources\": [{\"title\": \"Website naam\", \"url\": \"https://echte-url.nl\"}]}. \n\nGebruik alleen echte Nederlandse onderwijswebsites zoals Khan Academy NL, Malmberg, ThiemeMeulenhoff, Noordhoff, of Wikipedia. Controleer dat de URLs bestaan - geef algemene domeinnamen zoals "https://nl.khanacademy.org" zonder specifieke paden als je onzeker bent.`
            }
        ],
        response_format: { type: "json_object" },
    });
    const rawResponse = JSON.parse(response.choices[0].message.content || "{}");
    console.log("Raw OpenAI response:", JSON.stringify(rawResponse, null, 2));
    // Normalize the response to expected format
    let steps = ["Geen stappen beschikbaar"];
    if (rawResponse.steps) {
        steps = rawResponse.steps;
    }
    else if (rawResponse.uitleg_stappen) {
        // Handle both array of strings and array of objects
        steps = rawResponse.uitleg_stappen.map((s) => {
            if (typeof s === 'string')
                return s;
            return s.stap ? `${s.stap}. ${s.beschrijving || s.omschrijving || s.uitleg}` : (s.beschrijving || s.omschrijving || s.uitleg || s);
        });
    }
    else if (rawResponse.stappenUitleg) {
        steps = rawResponse.stappenUitleg.map((s) => s.omschrijving || s.uitleg || s.beschrijving || `Stap ${s.stap}: ${s.omschrijving || s.beschrijving}`);
    }
    else if (rawResponse.stappen) {
        steps = rawResponse.stappen.map((s) => s.uitleg || s.omschrijving || s.beschrijving || s);
    }
    let example = { prompt: "Geen voorbeeld beschikbaar", solution: "Geen oplossing beschikbaar" };
    if (rawResponse.example) {
        example = rawResponse.example;
    }
    else if (rawResponse.voorbeeld) {
        const v = rawResponse.voorbeeld;
        example = {
            prompt: v.omschrijving || v.opgave || "Geen voorbeeld beschikbaar",
            solution: v.resultaat || v.oplossing || (v.berekening ? v.berekening.join('; ') : "Geen oplossing beschikbaar")
        };
    }
    let quiz = { question: "Geen vraag beschikbaar", choices: ["A) Optie niet beschikbaar"], answer: "A" };
    if (rawResponse.quiz) {
        quiz = rawResponse.quiz;
    }
    else if (rawResponse.controlevraag) {
        const c = rawResponse.controlevraag;
        const choices = [];
        if (c.opties) {
            // Convert object {A: "...", B: "..."} to array ["A) ...", "B) ..."]
            for (const [key, value] of Object.entries(c.opties)) {
                choices.push(`${key}) ${value}`);
            }
        }
        quiz = {
            question: c.vraag || "Geen vraag beschikbaar",
            choices: choices.length > 0 ? choices : ["A) Optie niet beschikbaar"],
            answer: c.correcteAntwoord || c.antwoord || "A"
        };
    }
    let resources = [
        { title: "Khan Academy NL", url: "https://nl.khanacademy.org" },
        { title: "Studiewijzer.nl", url: "https://www.studiewijzer.nl" }
    ];
    if (rawResponse.resources && Array.isArray(rawResponse.resources)) {
        resources = rawResponse.resources.filter((r) => r.title && r.url);
    }
    else if (rawResponse.bronnen && Array.isArray(rawResponse.bronnen)) {
        resources = rawResponse.bronnen.map((b) => ({
            title: b.naam || b.title || "Nuttige bron",
            url: b.link || b.url || "#"
        }));
    }
    const result = {
        steps,
        example,
        quiz,
        coach_text: rawResponse.coach_text || rawResponse.advies || rawResponse.feedback || "Goed gedaan! Probeer de stappen te volgen.",
        resources
    };
    console.log("Normalized result:", JSON.stringify(result, null, 2));
    return result;
}
export async function expandExplanation(originalExplanation, topic, course) {
    if (!openai) {
        // Dummy expanded response when no API key
        return {
            steps: [
                ...originalExplanation.steps,
                "Extra stap: Verdiep je kennis door de formule uit je hoofd te leren",
                "Extra stap: Oefen met verschillende voorbeelden tot je het automatisch kunt",
                "Extra stap: Leg het concept uit aan iemand anders - dat helpt je het beter te begrijpen"
            ],
            example: {
                prompt: originalExplanation.example.prompt + " (uitgebreid voorbeeld)",
                solution: originalExplanation.example.solution + " - Met meer detail: dit komt omdat de formule gebaseerd is op de verhouding tussen zijden in een rechthoekige driehoek."
            },
            quiz: originalExplanation.quiz,
            coach_text: "Je wilt meer leren - dat is geweldig! Probeer de extra stappen en daag jezelf uit met moeilijkere opgaven.",
            resources: originalExplanation.resources
        };
    }
    const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
            {
                role: "system",
                content: "Je bent een Nederlandse huiswerkcoach voor 5 havo. BELANGRIJK: Geef alleen correcte, geverifieerde informatie. Als je iets niet zeker weet, vermeld dit expliciet. Verzin nooit feiten of formules. Een student vraagt om MEER UITLEG over een onderwerp. Geef een uitgebreidere versie met: meer gedetailleerde stappen (5-8 stappen), uitgebreider voorbeeld met extra toelichting, nieuwe quiz vraag (iets moeilijker), en aanmoedigende coach tekst. Gebruik dezelfde JSON structuur maar met meer diepgang en detail."
            },
            {
                role: "user",
                content: `De student wil meer uitleg over: ${topic} (vak: ${course})

Huidige uitleg die ze al hebben:
Stappen: ${originalExplanation.steps.join('; ')}
Voorbeeld: ${originalExplanation.example.prompt} → ${originalExplanation.example.solution}

Geef een UITGEBREIDERE versie met:
- Meer gedetailleerde stappen (5-8 stappen met extra toelichting)
- Uitgebreider voorbeeld met meer stappen en uitleg
- Nieuwe, iets moeilijkere quiz vraag
- Motiverende coach tekst
- Zelfde nuttige links

JSON structuur: {"steps": ["gedetailleerde stap1", "stap2"], "example": {"prompt": "complexer voorbeeld", "solution": "uitgebreide oplossing"}, "quiz": {"question": "vraag", "choices": ["A) optie1", "B) optie2", "C) optie3"], "answer": "A"}, "coach_text": "motiverende tekst", "resources": [{"title": "titel", "url": "url"}]}`
            }
        ],
        response_format: { type: "json_object" },
    });
    const rawResponse = JSON.parse(response.choices[0].message.content || "{}");
    console.log("Expanded explanation response:", JSON.stringify(rawResponse, null, 2));
    // Use same normalization logic
    let steps = ["Geen uitgebreide stappen beschikbaar"];
    if (rawResponse.steps) {
        steps = rawResponse.steps;
    }
    else if (rawResponse.uitleg_stappen) {
        steps = rawResponse.uitleg_stappen.map((s) => {
            if (typeof s === 'string')
                return s;
            return s.stap ? `${s.stap}. ${s.beschrijving || s.omschrijving || s.uitleg}` : (s.beschrijving || s.omschrijving || s.uitleg || s);
        });
    }
    let example = { prompt: "Geen uitgebreid voorbeeld beschikbaar", solution: "Geen uitgebreide oplossing beschikbaar" };
    if (rawResponse.example) {
        example = rawResponse.example;
    }
    else if (rawResponse.voorbeeld) {
        const v = rawResponse.voorbeeld;
        example = {
            prompt: v.omschrijving || v.opgave || "Geen uitgebreid voorbeeld beschikbaar",
            solution: v.resultaat || v.oplossing || (v.berekening ? v.berekening.join('; ') : "Geen uitgebreide oplossing beschikbaar")
        };
    }
    let quiz = { question: "Geen uitgebreide vraag beschikbaar", choices: ["A) Optie niet beschikbaar"], answer: "A" };
    if (rawResponse.quiz) {
        quiz = rawResponse.quiz;
    }
    else if (rawResponse.controlevraag) {
        const c = rawResponse.controlevraag;
        const choices = [];
        if (c.opties) {
            for (const [key, value] of Object.entries(c.opties)) {
                choices.push(`${key}) ${value}`);
            }
        }
        quiz = {
            question: c.vraag || "Geen uitgebreide vraag beschikbaar",
            choices: choices.length > 0 ? choices : ["A) Optie niet beschikbaar"],
            answer: c.correcteAntwoord || c.antwoord || "A"
        };
    }
    let resources = originalExplanation.resources;
    if (rawResponse.resources && Array.isArray(rawResponse.resources)) {
        resources = rawResponse.resources.filter((r) => r.title && r.url);
    }
    return {
        steps,
        example,
        quiz,
        coach_text: rawResponse.coach_text || rawResponse.advies || rawResponse.feedback || "Geweldig dat je meer wilt leren! Blijf oefenen met deze uitgebreide stappen.",
        resources
    };
}
