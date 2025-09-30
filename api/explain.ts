// api/explain.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";

// Optioneel: zet OPENAI_API_KEY in je env voor betere hints.
// Zonder key werkt de rule-based fallback.
const openaiKey = process.env.OPENAI_API_KEY || "";
const openai = openaiKey ? new OpenAI({ apiKey: openaiKey }) : null;

type HistoryMsg = { role: "user" | "assistant"; text: string };

// -------- Helpers --------

// signaal-score in plaats van hard cutoff
function scoreSignal(s?: string) {
  const t = (s || "").toLowerCase().trim();
  if (!t) return 0;

  let score = 0;
  const len = t.length;
  const words = t.split(/\s+/).filter(Boolean);

  if (len >= 12) score += 2;
  if (words.length >= 3) score += 2;

  if (/[0-9]/.test(t)) score += 2;
  if (/[=<>±√πβ]/.test(t)) score += 2;
  if (/(->|→|⇌|≤|≥|\/)/.test(t)) score += 1;

  if (/\b(tijdvak|oorzaak|gevolg|bron|revolutie|industrialisatie|middeleeuwen|verlichting)\b/.test(t)) score += 3; // geschiedenis
  if (/\b(formule|vergelijking|functie|hoek|vector|differentieer|integreer|stelsel)\b/.test(t)) score += 3;        // wiskunde
  if (/\b(kracht|snelheid|versnelling|energie|impuls|veld|spanning|stroom)\b/.test(t)) score += 3;               // natuurkunde
  if (/\b(reactie|mol|molariteit|zuur|base|redox|stoichiometrie)\b/.test(t)) score += 3;                          // scheikunde
  if (/\b(cel|osmose|mitose|enzym|homeostase|ecologie)\b/.test(t)) score += 3;                                    // biologie
  if (/\b(aanbod|vraag|elasticiteit|marginaal|bbp|inflatie)\b/.test(t)) score += 3;                               // economie

  if (/(weet\s*ik\s*niet|idk|geen\s*idee|help\s*mij)/.test(t)) score -= 3;
  if (/^\W+$/.test(t)) score -= 2;

  return score;
}

function isLowSignal({ text, hasImage, hasPoging, historyLen }: { text?: string; hasImage?: boolean; hasPoging?: boolean; historyLen?: number }) {
  if (hasImage) return false;
  if (hasPoging) return false;
  if ((historyLen ?? 0) >= 2) return false;

  const sc = scoreSignal(text);
  return sc <= 1;
}

function normCourse(c?: string) {
  const t = (c || "").toLowerCase();
  if (/wiskunde|math/.test(t)) return "wiskunde";
  if (/natuurkunde|physics/.test(t)) return "natuurkunde";
  if (/scheikunde|chemie/.test(t)) return "scheikunde";
  if (/biologie|biology/.test(t)) return "biologie";
  if (/geschiedenis|history/.test(t)) return "geschiedenis";
  if (/economie|economics/.test(t)) return "economie";
  if (/nederlands|dutch/.test(t)) return "nederlands";
  if (/engels|english/.test(t)) return "engels";
  if (/frans|français/.test(t)) return "frans";
  if (/duits|german/.test(t)) return "duits";
  if (/aardrijkskunde|geografie|geography/.test(t)) return "aardrijkskunde";
  return t || "algemeen";
}

function lowSignalReply(course: string, poging?: string) {
  const base = "Geen stress 🙂";
  const promptAsk = "Kun je de exacte opdracht (of een foto/fragment) delen en zeggen waar je vastloopt?";
  const tryAsk = poging?.trim()
    ? "Wat was je bedoeling met je poging, en waar liep je vast?"
    : "Wat heb je al geprobeerd of waar twijfel je precies over?";

  switch (course) {
    case "geschiedenis":
      return `${base} Gaat het om een gebeurtenis, een oorzaak-gevolg redenering of een bronvraag? ${promptAsk} ${tryAsk}`;
    case "wiskunde":
      return `${base} Welke soort vraag is het (algebra, functies, kansrekening, meetkunde)? ${promptAsk} ${tryAsk}`;
    case "biologie":
      return `${base} Gaat het om een proces (bijv. osmose, vertering) of het aflezen van een grafiek? ${promptAsk} ${tryAsk}`;
    case "natuurkunde":
      return `${base} Welke grootheden spelen mee (F, v, a, E…)? ${promptAsk} ${tryAsk}`;
    case "scheikunde":
      return `${base} Is het een reactievergelijking/stoichiometrie of zuur-base/redox? ${promptAsk} ${tryAsk}`;
    case "economie":
      return `${base} Is dit vraag/aanbod, elasticiteit of kosten/opbrengsten? ${promptAsk} ${tryAsk}`;
    case "nederlands":
      return `${base} Gaat het om tekstverklaring, argumentatie of samenvatten? ${promptAsk} ${tryAsk}`;
    default:
      return `${base} Kun je iets meer context geven over de opdracht? ${promptAsk} ${tryAsk}`;
  }
}

function subjectStyle(course: string) {
  switch (course) {
    case "geschiedenis": return `- Focus op tijd, plaats, actoren, oorzaken/gevolgen.\n- 1 hint + 1 vraag.`;
    case "wiskunde": return `- Noem 1 richtinggevende stap (formule/definitie) + 1 vraag.`;
    case "biologie": return `- Koppel aan kernbegrippen; 1 hint + 1 verduidelijkende vraag.`;
    case "natuurkunde": return `- Benoem relevante grootheden/verbanden; 1 hint + 1 vraag.`;
    case "scheikunde": return `- Vraag naar type opgave (reactie/stoichiometrie/zuur-base).`;
    case "economie": return `- Verwijs naar concept (vraag/aanbod/elasticiteit/kosten).`;
    case "nederlands": return `- Vraag naar tekstsoort/doel/argumentatie.`;
    default: return `- Geef 1 korte hint + 1 vraag.`;
  }
}

function buildSystemPrompt(course: string) {
  return `
Je bent een vriendelijke AI-tutor voor een havo/vwo-leerling. Antwoord in het Nederlands, natuurlijk en beknopt (max 2–3 zinnen).
Gebruik Socratische stijl: 1 hint + 1 verdiepende vraag.
Vak: ${course.toUpperCase()}
${subjectStyle(course)}
`.trim();
}

// -------- Handler --------

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const { opgave, poging, course, imageUrl, history } = (req.body ?? {}) as {
      opgave?: string;
      poging?: string;
      course?: string;
      imageUrl?: string;
      history?: HistoryMsg[];
    };

    const norm = normCourse(course);
    const opg = (opgave || "").trim();
    const hasImage = !!(imageUrl && imageUrl.trim());
    const hasPoging = !!(poging && poging.trim());
    const histLen = (history?.length ?? 0);

    // Low-signal guard → alleen fallback als er écht te weinig info is
    if (isLowSignal({ text: opg, hasImage, hasPoging, historyLen: histLen })) {
      const reply = lowSignalReply(norm, poging);
      return res.status(200).json({ reply, audioUrl: null });
    }

    // Model-call als OpenAI beschikbaar
    if (openai) {
      const system = buildSystemPrompt(norm);

      const hist = (history || [])
        .slice(-4)
        .map(h => ({ role: h.role === "user" ? "user" as const : "assistant" as const, content: h.text }));

      const userParts = [
        opg ? `Opgave: "${opg.slice(0, 1600)}"` : null,
        hasPoging ? `Mijn poging: "${(poging || "").slice(0, 800)}"` : null,
        hasImage ? `Er is ook een afbeelding bijgevoegd.` : null,
        `Geef 1 korte hint + 1 vraag.`,
      ].filter(Boolean).join("\n");

      const resp = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.2,
        max_tokens: 200,
        messages: [
          { role: "system", content: system },
          ...hist,
          { role: "user", content: userParts },
        ],
      });

      let reply = resp.choices?.[0]?.message?.content?.trim();
      if (!reply || reply.length < 8) {
        reply = lowSignalReply(norm, poging);
      } else {
        reply = reply.replace(/\n{3,}/g, "\n\n").trim();
        if (reply.split(" ").length > 80) {
          reply = reply.split(". ").slice(0, 2).join(". ") + ".";
        }
      }

      return res.status(200).json({ reply, audioUrl: null });
    }

    // Fallback zonder OpenAI
    const generic =
      norm === "geschiedenis"
        ? `Kijk naar tijd, plaats en actoren. Is het een oorzaak-gevolg, broninterpretatie of periodisering?`
        : norm === "wiskunde"
        ? `Welke gegevens heb je en wat moet je vinden? Welke definitie of formule past hierbij?`
        : norm === "biologie"
        ? `Welk proces of welke begrippen spelen hier? Kun je 1 stap benoemen?`
        : norm === "natuurkunde"
        ? `Welke grootheden spelen mee en wat is de relatie?`
        : norm === "scheikunde"
        ? `Is dit stoichiometrie, zuur-base of redox? Welke gegevens heb je?`
        : `Welke begrippen horen hierbij en wat is de eerstvolgende stap?`;

    const reply =
      `${norm === "algemeen" ? "" : `(${norm}) `}` +
      (opg ? `Je beschreef: “${opg.slice(0, 160)}”. ` : "") +
      generic + ` Wat voelt nu als eerste stap?`;

    return res.status(200).json({ reply, audioUrl: null });
  } catch (e: any) {
    console.error("explain error:", e);
    return res.status(500).json({ error: "Interne serverfout.", details: e?.message || String(e) });
  }
}
