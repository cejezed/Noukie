import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL ?? "gpt-4.1-mini";

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

type Mode = "plan" | "explain";
const banned = [/medic/i,/pillen/i,/dokter/i,/diagnos/i,/zelfmoord/i,/suicid/i,/seks/i,/porn/i,/bedreig/i,/geweld/i,/adres/i,/woonplaats/i,/contact/i];
const violates = (s:string) => banned.some(rx => rx.test((s||"").toLowerCase()));
const fallback = () => "Daar kan ik niet mee helpen. Bespreek dit met je ouders of een leraar.";
const sanitize = (a:string) => (!a ? "Kun je je vraag over school of planning iets concreter maken?" : (a.length>800? a.slice(0,800)+" …": a));
const detectMode = (t:string):Mode => /(leg uit|uitleg|hoe werkt|samenvatting|oefening|begrijpen|verklaar)/i.test(t) ? "explain" : "plan";

async function sbSelectMemory(userId:string){
  const r = await fetch(`${SUPABASE_URL}/rest/v1/coach_memory?user_id=eq.${userId}&limit=1`, {
    headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization:`Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
  });
  const rows = await r.json(); return rows?.[0] ?? null;
}
async function sbUpsertMemory(payload:any){
  const r = await fetch(`${SUPABASE_URL}/rest/v1/coach_memory`, {
    method:"POST",
    headers:{ apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization:`Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type":"application/json", Prefer:"resolution=merge-duplicates" },
    body: JSON.stringify(payload)
  });
  if(!r.ok){ throw new Error(`Supabase upsert failed: ${r.status} ${await r.text()}`); }
}

function sysPrompt(p:{profile:any;goalsPlan:any;goalsLearn:any;routines:any;blockers:any;lastPlan:string;lastLearn:string;mode:Mode;}){
  return `
Je bent “Noukie”, een warme, nuchtere studiecoach (10–14 jaar).
Vaardigheden:
- [PLAN] plannen/gewonten/motivatie/commitments.
- [EXPLAIN] leeruitleg in simpele stappen + 1 oefenvraag met korte oplossing.

GEHEUGEN (feitelijk, niet raden):
- Profiel: ${JSON.stringify(p.profile??{})}
- PLAN: doelen ${JSON.stringify(p.goalsPlan??[])}, routines ${JSON.stringify(p.routines??[])}, blokkades ${JSON.stringify(p.blockers??[])}, last ${JSON.stringify(p.lastPlan??"")}
- EXPLAIN: leerdoelen ${JSON.stringify(p.goalsLearn??[])}, last ${JSON.stringify(p.lastLearn??"")}

REGELS:
- Geen medisch/privé/geld/relatie-advies. Bij twijfel: weiger + verwijs naar ouder/leraar.
- Antwoorden natuurlijk, kort (max 6 zinnen).
- MODE = ${p.mode}.
- [PLAN] eindig met 1 mini-actie voor vandaag.
- [EXPLAIN] geef 1 micro-voorbeeld + 1 oefenvraag met korte oplossing.
`.trim();
}

export default async function handler(req:VercelRequest,res:VercelResponse){
  if(req.method!=="POST") return res.status(405).json({error:"Method Not Allowed"});
  try{
    const body = typeof req.body==="string"? JSON.parse(req.body): req.body;
    const message:string = String(body?.message ?? "");
    const forceMode:Mode|undefined = body?.forceMode;
    const userId:string|undefined = body?.userId; // of verifieer via Bearer token als je dat meestuurt

    if(!userId) return res.status(401).json({error:"Unauthorized"});
    if(!message.trim()) return res.status(400).json({error:"EMPTY_MESSAGE"});
    if(violates(message)) return res.json({mode:"blocked", answer:fallback()});

    const mode = forceMode ?? detectMode(message);
    const mem = (await sbSelectMemory(userId)) ?? {};
    const system = sysPrompt({
      profile: mem.profile, goalsPlan: mem.goals_plan, goalsLearn: mem.goals_learn,
      routines: mem.routines, blockers: mem.blockers,
      lastPlan: mem.last_summary_plan || "", lastLearn: mem.last_summary_learn || "", mode
    });

    const comp = await openai.chat.completions.create({
      model: CHAT_MODEL, temperature: 0.4, max_tokens: 400,
      messages: [{role:"system",content:system},{role:"user",content:message}]
    });
    let answer = comp.choices[0]?.message?.content?.trim() ?? "";
    answer = sanitize(answer);
    if(violates(answer)) answer = fallback();

    // korte samenvatting → geheugen bijwerken
    const hist = `User: ${message}\nAssistant: ${answer}`;
    const sum = await openai.chat.completions.create({
      model: CHAT_MODEL, temperature: 0.1, max_tokens: 150,
      messages: [
        {role:"system",content:"Vat kort samen (3–5 zinnen) voor coach-geheugen. Focus op nieuwe doelen/commitments, routines, blokkades, voortgang."},
        {role:"user",content:hist}
      ]
    });
    const summary = sum.choices[0]?.message?.content?.trim() ?? "";
    await sbUpsertMemory({
      user_id: userId,
      profile: mem.profile ?? {}, goals_plan: mem.goals_plan ?? [], goals_learn: mem.goals_learn ?? [],
      routines: mem.routines ?? [], blockers: mem.blockers ?? [],
      last_summary_plan: mode==="plan" ? summary : (mem.last_summary_plan ?? ""),
      last_summary_learn: mode==="explain" ? summary : (mem.last_summary_learn ?? ""),
      updated_at: new Date().toISOString()
    });

    res.setHeader("Access-Control-Allow-Origin","*");
    res.setHeader("Access-Control-Allow-Headers","Content-Type, Authorization");
    return res.status(200).json({ mode, answer });
  }catch(e:any){
    console.error(e); return res.status(500).json({error:"coach_error", detail:e?.message});
  }
}
