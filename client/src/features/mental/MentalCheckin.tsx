import React, { useMemo, useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

/**
 * MentalCheckin with Rewards (Supabase variant)
 * ---------------------------------------------
 * - +1 punt bij invullen (max 1 per dag)
 * - −1 punt per overgeslagen dag (bij eerstvolgend bezoek verrekend)
 * - Beloningen claimen uit database punten
 * - Slaat check-ins/positives/punten op in Supabase (RLS: eigen data)
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
  { points: 100, label: "Dagje Walibi" },
  { points: 200, label: "Phantasialand" },
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

// ---- Database helpers --------------------------------------------------------

// Deze functie was al correct.
async function saveToSupabase(payload: any, userId: string) {
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

// Deze functies voor punten waren al correct.
async function savePointsToDatabase(userId: string, points: number) {
  const { error } = await supabase
    .from('user_points')
    .upsert({ user_id: userId, points: points }, { onConflict: 'user_id' });

  if (error) {
    console.error('Error saving points:', error);
    throw error;
  }
}

async function loadPointsFromDatabase(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('user_points')
    .select('points')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') { // 'PGRST116' = no rows found, which is not an error here.
    console.error('Error loading points:', error);
    return 0;
  }
  return data?.points || 0;
}


// ---- ✅ VERNIEUWDE FUNCTIES VOOR BELONINGEN ----

// Sla een ENKELE geclaimde beloning op in de nieuwe tabel.
async function saveClaimedRewardToDatabase(userId: string, reward: { label: string; points: number }) {
  const { error } = await supabase
    .from('claimed_rewards') // <-- Gebruikt de nieuwe tabel
    .insert({
      user_id: userId,
      reward_label: reward.label,
      points_cost: reward.points,
    });

  if (error) {
    console.error('Error saving claimed reward:', error);
    throw error;
  }
}

// Laad alle geclaimde beloningen voor een gebruiker uit de nieuwe tabel.
async function loadRewardsFromDatabase(userId: string): Promise<{ label: string; points: number; dateIso: string }[]> {
  const { data, error } = await supabase
    .from('claimed_rewards') // <-- Gebruikt de nieuwe tabel
    .select('reward_label, points_cost, claimed_at')
    .eq('user_id', userId)
    .order('claimed_at', { ascending: false });

  if (error) {
    console.error('Error loading rewards:', error);
    return [];
  }

  // Zet de database resultaten om naar het formaat dat de component verwacht.
  return data.map(r => ({
    label: r.reward_label,
    points: r.points_cost,
    dateIso: r.claimed_at,
  }));
}

// Deze functie was al correct.
async function checkinExistsToday(userId: string): Promise<boolean> {
  const todayStr = yyyyMmDd(new Date());
  const { data, error } = await supabase
    .from('checkins')
    .select('date')
    .eq('user_id', userId)
    .eq('date', todayStr)
    .limit(1);

  if (error) {
    console.error('Error checking for existing checkin:', error);
    return false;
  }
  return data && data.length > 0;
}

// -----------------------------------------------------------------------------

export default function MentalCheckin({
  userId,
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
  // UI state
  const [submitted, setSubmitted] = useState(false);
  const [mood, setMood] = useState<number | null>(null);
  const [sleep, setSleep] = useState<number | null>(null);
  const [tension, setTension] = useState<number | null>(null);
  const [eating, setEating] = useState<number | null>(null);
  const [medication, setMedication] = useState<boolean>(false);
  const [pIdx, setPIdx] = useState(0);
  const [pText, setPText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  // Rewards state
  const [points, setPoints] = useState<number>(0);
  const [redeemed, setRedeemed] = useState<{ label: string; points: number; dateIso: string }[]>([]);

  // Keys
  const pointsKey = useMemo(() => `mentalPoints:${userId}`, [userId]);
  const reconKey = useMemo(() => `mentalLastRecon:${userId}`, [userId]);
  const rewardsKey = useMemo(() => `mentalRewards:${userId}`, [userId]);

  // Load data from database and check for daily submission on mount
  useEffect(() => {
    const loadUserData = async () => {
      if (!userId) return;

      try {
        const hasSubmittedToday = await checkinExistsToday(userId);
        setSubmitted(hasSubmittedToday);

        // De nieuwe, correcte functies worden hier aangeroepen.
        const dbPoints = await loadPointsFromDatabase(userId);
        setPoints(dbPoints);
        
        const dbRewards = await loadRewardsFromDatabase(userId);
        setRedeemed(dbRewards);
      } catch (error) {
        console.error('Error loading user data from DB, falling back to localStorage:', error);
        // Fallback naar localStorage als DB faalt
        const localPoints = parseInt(localStorage.getItem(pointsKey) || '0');
        const localRewards = JSON.parse(localStorage.getItem(rewardsKey) || '[]');
        setPoints(localPoints);
        setRedeemed(localRewards);
      }
    };

    loadUserData();
  }, [userId, pointsKey, rewardsKey]);

  // Reconcile missed days -> decrement points per dag zonder checkin
  useEffect(() => {
    const today = startOfLocalDay(new Date());
    const lastRecon = parseYyyyMmDd(localStorage.getItem(reconKey)) || today;
    let cur = startOfLocalDay(addDays(lastRecon, 1));
    let decrements = 0;

    while (cur < today) {
      const key = `mentalCheckin:${userId}:${yyyyMmDd(cur)}`;
      const had = !!localStorage.getItem(key);
      if (!had) decrements += 1;
      cur = addDays(cur, 1);
    }

    if (decrements > 0) {
      setPoints((prev) => {
        const next = allowNegative ? prev - decrements : Math.max(0, prev - decrements);
        savePointsToDatabase(userId, next).catch((error) => {
          console.error('Failed to save decremented points to database:', error);
        });
        return next;
      });
    }
    localStorage.setItem(reconKey, yyyyMmDd(today));
  }, [userId, reconKey, pointsKey, allowNegative]);

  const isComplete =
    mood !== null &&
    sleep !== null &&
    tension !== null &&
    eating !== null;

  async function onSave() {
    try {
      if (!isComplete) {
        setError("Vul alle velden in voordat je opslaat.");
        return;
      }
      setSaving(true);
      setError(null);
      setOkMsg(null);

      const hasAlreadyCheckedIn = await checkinExistsToday(userId);
      const payload = {
        date: yyyyMmDd(new Date()),
        mood,
        sleep,
        tension,
        eating,
        medication,
        positives: pText ? [{ category: POSITIVE_PROMPTS[pIdx].category, text: pText }] : [],
      };
      
      await saveToSupabase(payload, userId);

      if (!hasAlreadyCheckedIn) {
        setPoints(prev => {
          const next = prev + 1;
          savePointsToDatabase(userId, next).catch((e) => {
            console.error('Failed to save points after checkin:', e);
            setError('Checkin opgeslagen, maar punten konden niet worden bijgewerkt.');
          });
          return next;
        });
        setOkMsg("Bedankt! Je check-in is opgeslagen en je hebt een punt verdiend! ✨");
      } else {
        setOkMsg("Je check-in is bijgewerkt. Je hebt vandaag al een punt verdiend. 🌟");
      }
      setSubmitted(true);
    } catch (e: any) {
      console.error('Error saving checkin:', e);
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
      // Fallback naar webhook...
      alert("Melding opslaan mislukte.");
    }
  }

  // ---- ✅ VERNIEUWDE `claim` FUNCTIE ----
  async function claim(tier: RewardTier) {
    if (!canClaim(tier)) return;
    if (!confirm(`Beloning claimen: ${tier.label} voor ${tier.points} punten?`)) return;

    try {
      // Stap 1: Sla de zojuist geclaimde beloning op in de database.
      await saveClaimedRewardToDatabase(userId, { label: tier.label, points: tier.points });

      // Stap 2: Werk de lokale state bij voor een directe UI update.
      const newRecord = { ...tier, dateIso: new Date().toISOString() };
      setRedeemed(prev => [...prev, newRecord]);

      // Stap 3: Werk de punten van de gebruiker bij.
      setPoints(prev => {
        const next = allowNegative ? prev - tier.points : Math.max(0, prev - tier.points);
        savePointsToDatabase(userId, next).catch(error => {
          console.error('Failed to save points after reward claim:', error);
          // Optioneel: implementeer logica om de transactie terug te draaien.
        });
        return next;
      });

      alert(`Gefeliciteerd! Je hebt '${tier.label}' geclaimd.`);
    } catch (error) {
      console.error('Error claiming reward:', error);
      alert('Er ging iets mis bij het claimen van je beloning. Probeer het opnieuw.');
    }
  }

  function canClaim(tier: RewardTier) {
    return points >= tier.points;
  }

  const nextTier = rewardTiers.find(t => points < t.points) || null;
  const progressToNext = nextTier ? Math.min(1, points / nextTier.points) : 1;
  
  // De rest van het bestand (de JSX voor de UI) is ongewijzigd en kan hieronder.
  // ... (de volledige return (...) met JSX blijft hier hetzelfde als in jouw originele code)
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
          <span>Extra Medicatie</span>
        </label>
      </div>

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
    </div>
  );
<<<<<<< HEAD
}
=======
}
>>>>>>> voice-chat
