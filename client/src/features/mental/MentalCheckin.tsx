import React, { useMemo, useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

/**
 * MentalCheckin with Rewards (Supabase variant)
 * ---------------------------------------------
 * - +1 punt bij invullen (max 1 per dag)
 * - −1 punt per overgeslagen dag (bij eerstvolgend bezoek verrekend)
 * - Beloningen claimen uit lokale punten
 * - Slaat check-ins/positives op in Supabase (RLS: eigen data)
 */

export type PositiveCategory =
  | "FUN_WITH_SOMEONE"
  | "PROUD"
  | "CHALLENGE_SUCCEEDED"
  | "ENERGY"
  | "OTHER";

export type RewardTier = { points: number; label: string };

const DEFAULT_TIERS: RewardTier[] = [
  { points: 25, label: "Samen shoppen" },
  { points: 50, label: "Dagje Walibi" },
  { points: 100, label: "Phantasialand" },
];

const POSITIVE_PROMPTS: { category: PositiveCategory; label: string }[] = [
  { category: "FUN_WITH_SOMEONE", label: "Met wie had je vandaag lol?" },
  { category: "CHALLENGE_SUCCEEDED", label: "Wat was spannend maar tóch gelukt?" },
  { category: "PROUD", label: "Waar ben je trots op vandaag?" },
  { category: "ENERGY", label: "Wat gaf je energie?" },
];

function yyyyMmDd(date: Date) {
  return date.toISOString().slice(0, 10);
}
function startOfLocalDay(d = new Date()) {
  const dt = new Date(d);
  dt.setHours(0, 0, 0, 0);
  return dt;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function parseYyyyMmDd(s?: string | null): Date | null {
  if (!s) return null;
  const m = /^\d{4}-\d{2}-\d{2}$/.exec(s);
  if (!m) return null;
  const [y, mo, da] = s.split("-").map(Number);
  return new Date(y, mo - 1, da);
}

// ---- Supabase helper --------------------------------------------------------
async function saveToSupabase(payload: any, userId: string) {
  // 1) Upsert checkin (uniek op user_id + date)
  const { error } = await supabase
    .from("checkins")
    .upsert(
      {
        user_id: userId,
        date: payload.date,
        mood_color: payload.mood,
        sleep: payload.sleep ?? null,
        tension: payload.tension ?? null,
        eating: payload.eating ?? null,
        medication: payload.medication ?? null,
        notes: null,
      },
      { onConflict: "user_id,date" }
    );

  if (error) throw error;

  // 2) Positives (optioneel)
  if (payload.positives?.length) {
    const rows = payload.positives.map((p: any) => ({
      user_id: userId,
      date: payload.date,
      category: p.category,
      text: (p.text ?? "").slice(0, 500),
    }));
    const { error: ep } = await supabase.from("positives").insert(rows);
    if (ep) throw ep;
  }
}

// -----------------------------------------------------------------------------

export default function MentalCheckin({
  userId,
  // webhooks zijn optioneel/ongebruikt in deze Supabase-variant
  webhookUrl,
  helpWebhookUrl,
  rewardTiers = DEFAULT_TIERS,
  allowNegative = false,
}: {
  userId: string;
  webhookUrl?: string;
  helpWebhookUrl?: string;
  rewardTiers?: RewardTier[];
  allowNegative?: boolean;
}) {
  // DEBUG: Check if userId is received correctly
  console.log('MentalCheckin received userId:', userId);

  // Daily key for "already submitted today"
  const todayStr = yyyyMmDd(new Date());
  const dayKey = useMemo(() => `mentalCheckin:${userId}:${todayStr}`, [userId, todayStr]);

  // Rewards keys
  const pointsKey = useMemo(() => `mentalPoints:${userId}`, [userId]);
  const reconKey = useMemo(() => `mentalLastRecon:${userId}`, [userId]);
  const rewardsKey = useMemo(() => `mentalRewards:${userId}`, [userId]);

  // UI state
  const [submitted, setSubmitted] = useState(false);
  const [mood, setMood] = useState<number | null>(null); // 1..5 (1=rood, 5=groen)
  const [sleep, setSleep] = useState<number | null>(null);
  const [tension, setTension] = useState<number | null>(null);
  const [eating, setEating] = useState<number | null>(null);
  const [medication, setMedication] = useState<boolean>(false); // checkbox: Extra Medicatie
  const [pIdx, setPIdx] = useState(0);
  const [pText, setPText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  // Rewards state
  const [points, setPoints] = useState<number>(() => {
    const raw = localStorage.getItem(pointsKey);
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) ? n : 0;
  });
  const [redeemed, setRedeemed] = useState<{ label: string; points: number; dateIso: string }[]>(() => {
    const raw = localStorage.getItem(rewardsKey);
    try {
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Init: submitted today? reconcile points for missed days
  useEffect(() => {
    const done = localStorage.getItem(dayKey);
    if (done) setSubmitted(true);

    // Reconcile missed days → decrement points per dag zonder checkin
    const today = startOfLocalDay(new Date());
    const lastRecon = parseYyyyMmDd(localStorage.getItem(reconKey)) || today;

    let cur = startOfLocalDay(addDays(lastRecon, 1));
    let decrements = 0;

    // loop tot gisteren (exclusief vandaag)
    while (cur < today) {
      const key = `mentalCheckin:${userId}:${yyyyMmDd(cur)}`;
      const had = !!localStorage.getItem(key);
      if (!had) decrements += 1;
      cur = addDays(cur, 1);
    }

    if (decrements > 0) {
      setPoints((prev) => {
        const next = allowNegative ? prev - decrements : Math.max(0, prev - decrements);
        localStorage.setItem(pointsKey, String(next));
        return next;
      });
    }

    // Markeer reconciliatie op vandaag zodat we niet opnieuw aftrekken
    localStorage.setItem(reconKey, yyyyMmDd(today));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Alles ingevuld?
  const isComplete =
    mood !== null &&
    sleep !== null &&
    tension !== null &&
    eating !== null; // medication is checkbox (altijd boolean)

  async function onSave() {
    try {
      if (!isComplete) {
        setError("Vul alle velden in voordat je opslaat.");
        return;
      }

      setSaving(true);
      setError(null);
      setOkMsg(null);

      const now = new Date();
      const payload = {
        type: "checkin",
        userId,
        date: yyyyMmDd(now),
        dateIso: now.toISOString(),
        mood,
        sleep,
        tension,
        eating,
        medication,
        positives: pText ? [{ category: POSITIVE_PROMPTS[pIdx].category, text: pText }] : [],
        points, // current before increment
        redeemed,
        source: "app",
      };

      // Supabase opslag
      await saveToSupabase(payload, userId);

      // Mark today submitted
      const wasSubmitted = !!localStorage.getItem(dayKey);
      localStorage.setItem(dayKey, "1");
      setSubmitted(true);

      // +1 punt bij invullen (eenmalig per dag)
      if (!wasSubmitted) {
        setPoints((prev) => {
          const next = prev + 1;
          localStorage.setItem(pointsKey, String(next));
          return next;
        });
      }

      setOkMsg("Bedankt! Je check-in is opgeslagen ✨");
    } catch (e: any) {
      setError(e?.message ?? "Opslaan mislukt");
    } finally {
      setSaving(false);
    }
  }

  async function onHelp(now = false) {
    try {
      const { error: helpErr } = await supabase.from("help_events").insert([
        { user_id: userId, type: now ? "help_now" : "help_feeling_bad" },
      ]);
      if (helpErr) throw helpErr;
      alert("We hebben je melding opgeslagen.");
    } catch (e) {
      // Fallback op webhook als die wél is meegegeven
      if (helpWebhookUrl) {
        try {
          await fetch(helpWebhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: now ? "help_now" : "help_feeling_bad",
              userId,
              dateIso: new Date().toISOString(),
              points,
            }),
          });
          alert("We hebben je melding verzonden.");
          return;
        } catch {}
      }
      alert("Verzenden van melding mislukte.");
    }
  }

  function canClaim(tier: RewardTier) {
    return points >= tier.points;
  }
  function claim(tier: RewardTier) {
    if (!canClaim(tier)) return;
    if (!confirm(`Beloning claimen: ${tier.label} voor ${tier.points} punten?`)) return;
    const now = new Date();
    const record = { label: tier.label, points: tier.points, dateIso: now.toISOString() };
    const nextRedeemed = [...redeemed, record];
    setRedeemed(nextRedeemed);
    localStorage.setItem(rewardsKey, JSON.stringify(nextRedeemed));

    setPoints((prev) => {
      const next = allowNegative ? prev - tier.points : Math.max(0, prev - tier.points);
      localStorage.setItem(pointsKey, String(next));
      return next;
    });

    alert(`Gefeliciteerd! Je hebt '${tier.label}' geclaimd.`);
  }

  const nextTier = rewardTiers.find((t) => points < t.points) || null;
  const progressToNext = nextTier ? Math.min(1, points / nextTier.points) : 1;

  if (submitted) {
    return (
      <div className="rounded-2xl shadow p-4 bg-white space-y-4">
        <p className="text-base">Je hebt vandaag al ingevuld. Dankjewel! 🌟</p>
        <div className="flex gap-2">
          <button
            onClick={() => onHelp(false)}
            className="text-sm px-3 py-1 rounded-full bg-amber-100 hover:bg-amber-200"
          >
            Ik voel me niet lekker
          </button>
          <button
            onClick={() => onHelp(true)}
            className="text-sm px-3 py-1 rounded-full bg-red-100 hover:bg-red-200"
          >
            Hulp nodig nu
          </button>
        </div>
        <RewardsPanel
          points={points}
          rewardTiers={rewardTiers}
          nextTier={nextTier}
          progressToNext={progressToNext}
          onClaim={claim}
          redeemed={redeemed}
        />
        {okMsg && <div className="text-sm text-green-700">{okMsg}</div>}
      </div>
    );
  }

  return (
    <div className="rounded-2xl shadow p-4 bg-white space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Hoe voel je je vandaag?</h2>
        <div className="flex gap-2">
          <button
            onClick={() => onHelp(false)}
            className="text-sm px-3 py-1 rounded-full bg-amber-100 hover:bg-amber-200"
          >
            Ik voel me niet lekker
          </button>
          <button
            onClick={() => onHelp(true)}
            className="text-sm px-3 py-1 rounded-full bg-red-100 hover:bg-red-200"
          >
            Hulp nu
          </button>
        </div>
      </div>

      {/* Mood picker 5 bollen (1 = rood, 5 = groen) */}
      <div className="flex gap-3">
        {[1, 2, 3, 4, 5].map((v) => (
          <button
            key={v}
            className={`w-10 h-10 rounded-full ring-2 ${mood === v ? "ring-black" : "ring-transparent"}`}
            onClick={() => setMood(v)}
            aria-label={`Mood ${v}`}
            style={{
              background: ["#d32f2f", "#f57c00", "#fbc02d", "#7cb342", "#388e3c"][v - 1],
            }}
          />
        ))}
      </div>

      {/* Quick inputs (onder elkaar) */}
      <div className="flex flex-col gap-3">
        <QuickScale label="Slaap" value={sleep} onChange={setSleep} />
        <QuickScale label="Spanning" value={tension} onChange={setTension} />
        <QuickScale label="Energie" value={eating} onChange={setEating} />

        <label className="flex items-center gap-2 text-sm select-none">
          <input
            id="extra-med"
            type="checkbox"
            className="h-4 w-4"
            checked={medication}
            onChange={(e) => setMedication(e.target.checked)}
          />
          <span>Extra Medicatie nodig gehad?</span>
        </label>
      </div>

      {/* Positieve prompt */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">{POSITIVE_PROMPTS[pIdx].label}</label>
          <button
            className="text-xs underline"
            onClick={() => setPIdx((pIdx + 1) % POSITIVE_PROMPTS.length)}
          >
            Andere vraag
          </button>
        </div>
        <textarea
          className="w-full border rounded-xl p-2 text-sm"
          rows={3}
          placeholder="Typ hier je lichtpuntje…"
          value={pText}
          onChange={(e) => setPText(e.target.value)}
          maxLength={500}
        />
      </div>

      {error && <div className="text-sm text-red-700">{error}</div>}
      {okMsg && <div className="text-sm text-green-700">{okMsg}</div>}

      <button
        className="w-full rounded-xl py-2 bg-black text-white disabled:opacity-50"
        disabled={!isComplete || saving}
        onClick={onSave}
      >
        {saving ? "Opslaan…" : "Klaar 🎉"}
      </button>
      {!isComplete && (
        <div className="text-xs text-gray-500 mt-1">Vul alle velden in om door te gaan.</div>
      )}

      <RewardsPanel
        points={points}
        rewardTiers={rewardTiers}
        nextTier={nextTier}
        progressToNext={progressToNext}
        onClaim={claim}
        redeemed={redeemed}
      />
    </div>
  );
}

function QuickScale({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <div className="text-sm mb-1">{label}</div>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((v) => (
          <button
            key={v}
            className={`w-8 h-8 rounded-lg border ${
              value === v ? "border-black" : "border-gray-300"
            }`}
            onClick={() => onChange(v)}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}

function RewardsPanel({
  points,
  rewardTiers,
  nextTier,
  progressToNext,
  onClaim,
  redeemed,
}: {
  points: number;
  rewardTiers: RewardTier[];
  nextTier: RewardTier | null;
  progressToNext: number;
  onClaim: (t: RewardTier) => void;
  redeemed: { label: string; points: number; dateIso: string }[];
}) {
  return (
    <div className="mt-2 border rounded-2xl p-3 bg-gray-50">
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-base font-semibold">Punten: {points}</div>
        {nextTier ? (
          <div className="text-sm text-gray-600">
            Volgende beloning: <span className="font-medium">{nextTier.label}</span> bij {nextTier.points}
          </div>
        ) : (
          <div className="text-sm text-gray-600">Je hebt alle beloningen binnen bereik 🎉</div>
        )}
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-white rounded-full overflow-hidden mb-3">
        <div
          className="h-2"
          style={{ width: `${Math.round(progressToNext * 100)}%`, background: "black" }}
        />
      </div>

      <div className="space-y-2">
        {rewardTiers.map((tier) => {
          const pct = Math.min(1, points / tier.points);
          const can = points >= tier.points;
          return (
            <div key={tier.label} className="rounded-xl bg-white p-2 border">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">
                  {tier.label} · {tier.points} punten
                </div>
                <button
                  onClick={() => onClaim(tier)}
                  disabled={!can}
                  className={`text-xs px-2 py-1 rounded-lg border ${
                    can ? "bg-black text-white" : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {can ? "Claim" : `${Math.floor(pct * 100)}%`}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {redeemed.length > 0 && (
        <div className="mt-3">
          <div className="text-sm font-semibold mb-1">Geclaimd</div>
          <ul className="text-sm list-disc pl-5 space-y-1">
            {redeemed
              .slice()
              .reverse()
              .map((r, i) => (
                <li key={i}>
                  {r.label} ({r.points}) · {new Date(r.dateIso).toLocaleDateString()}
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}