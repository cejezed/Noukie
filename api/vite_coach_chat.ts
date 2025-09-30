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
  if (!r.ok) throw new Error(`Supabase select failed: ${r.status} ${await r.text()}`);
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
async function sbInsertCommitment(payload: {
  user_id: string; title: string; due_at: string | null; course?: string | null; notes?: string | null; status?: "planned"|"accepted"|"rejected"|"expired";
}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/coach_commitments`, {
    method:"POST",
    headers:{ apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization:`Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type":"application/json" },
    body: JSON.stringify({ status: "planned", ...payload })
  });
  if (!r.ok) {
    // Niet crashen op UI; log server-side
    console.error("commitment insert failed:", r.status, await r.text());
  }
}

// === Extract JSON actions helpers ===
function extractActions(text: string): Array<{title:string; due?:string; course?:string; notes?:string}> {
  // 1) Probeer hele content als JSON
  try {
    const j = JSON.parse(text);
    if (Array.isArray(j)) return j;
    if (j && Array.isArray(j.actions)) return j.actions;
  } catch {}
  // 2) Zoek ```json ... ``` of ``` ... ```
  const block = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/```\s*([\s\S]*?)```/);
  if (block?.[1]) {
    try {
      const j = JSON.parse(block[1]);
      if (Array.isArray(j)) return j;
      if (j && Array.isArray(j.actions)) return j.actions;
    } catch {}
  }
  // 3) Beste gok: eerste JSON-array in de tekst
  const arr = text.match(/\[[\s\S]*\]/);
  if (arr) {
    try {
      const j = JSON.parse(arr[0]);
      if (Array.isArray(j)) return j;
    } catch {}
  }
  return [];
}

function toISOFromLocalYYYYMMDD_HHMM(s?: string): string | null {
  const due = (s ?? "").trim();
  if (!due) return null;
  const m = due.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}):(\d{2})$/);
  if (!m) return null;
  const date = new Date(`${m[1]}T${m[2]}:${m[3]}:00`);
  const t = date.getTime();
  return isNaN(t) ? null : date.toISOString();
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

[PLAN] Richtlijnen voor acties (heel belangrijk):
- Stel maximaal 3 concrete acties voor vandaag of morgen voor.
- Geef NA je normale tekst, een JSON-blok met "actions":
  [{"title":"Wiskunde oefenen §2.3","due":"2025-09-18 16:00","course":"Wiskunde","notes":"20 min, focus op breuken"}]
- Sleutels exact: title (string), due (YYYY-MM-DD HH:MM lokale tijd of leeg), course (string of leeg), notes (string of leeg).
- Schrijf GEEN extra tekst rondom het JSON-blok; alleen het JSON.
`.trim();
}

export default async function handler(req:VercelRequest,res:VercelResponse){
  if(req.method!=="POST") return res.status(405).json({error:"Method Not Allowed"});
  try{
    const body = typeof req.body==="string"? JSON.parse(req.body): req.body;
    const message:string = String(body?.message ?? "");
    const forceMode:Mode|undefined = body?.forceMode;
    const userId:string|undefined = body?.userId;

    if(!userId) return res.status(401).json({error:"Unauthorized"});
    if(!message.trim()) return res.status(400).json({error:"EMPTY_MESSAGE"});
    if(violates(message)) return res.json({mode:"blocked", answer:fallback()});

    const mode = forceMode ?? detectMode(message);
    const mem = (await sbSelectMemory(userId)) ?? {};
    const system = sysPrompt({
      profile: mem?.profile ?? {}, goalsPlan: mem?.goals_plan ?? [], goalsLearn: mem?.goals_learn ?? [],
      routines: mem?.routines ?? [], blockers: mem?.blockers ?? [],
      lastPlan: mem?.last_summary_plan || "", lastLearn: mem?.last_summary_learn || "", mode
    });

    // --- Chat ---
    const comp = await openai.chat.completions.create({
      model: CHAT_MODEL, temperature: 0.4, max_tokens: 400,
      messages: [{role:"system",content:system},{role:"user",content:message}]
    });
    let answer = comp.choices[0]?.message?.content?.trim() ?? "";
    answer = sanitize(answer);
    if(violates(answer)) answer = fallback();

    // --- NIEUW: parse actions & loggen als commitments (alleen in PLAN-modus zinvol, maar EXPLAIN kan genegeerd worden) ---
    try {
      const actions = extractActions(answer).slice(0, 3);
      if (actions.length) {
        for (const a of actions) {
          const title = String(a?.title ?? "").trim();
          if (!title) continue;
          const dueISO = toISOFromLocalYYYYMMDD_HHMM(a?.due);
          const course = a?.course ? String(a.course).trim() : null;
          const notes = a?.notes ? String(a.notes).trim() : null;
          await sbInsertCommitment({ user_id: userId, title, due_at: dueISO, course, notes, status: "planned" });
        }
      }
    } catch (e) {
      // We loggen alleen; geen hard fail voor de gebruiker
      console.error("actions/commitments parse or insert failed:", e);
    }

    // --- Samenvatting -> geheugen ---
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
      profile: mem?.profile ?? {}, goals_plan: mem?.goals_plan ?? [], goals_learn: mem?.goals_learn ?? [],
      routines: mem?.routines ?? [], blockers: mem?.blockers ?? [],
      last_summary_plan: mode==="plan" ? summary : (mem?.last_summary_plan ?? ""),
      last_summary_learn: mode==="explain" ? summary : (mem?.last_summary_learn ?? ""),
      updated_at: new Date().toISOString()
    });

    res.setHeader("Access-Control-Allow-Origin","*");
    res.setHeader("Access-Control-Allow-Headers","Content-Type, Authorization");
    return res.status(200).json({ mode, answer });
  }catch(e:any){
    console.error(e); return res.status(500).json({error:"coach_error", detail:e?.message});
  }
}
