import React, { useMemo, useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

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

async function saveToSupabase(payload: any, userId: string) {
  // Save to old checkins table for backwards compatibility
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

  // Save to positives table
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

async function getCheckinCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('checkins')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error) {
    console.error('Error counting checkins:', error);
    return 0;
  }
  return count || 0;
}

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

  if (error && error.code !== 'PGRST116') {
    console.error('Error loading points:', error);
    return 0;
  }
  return data?.points || 0;
}

async function saveClaimedRewardToDatabase(userId: string, reward: { label: string; points: number }) {
  const { error } = await supabase
    .from('claimed_rewards')
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

async function loadRewardsFromDatabase(userId: string): Promise<{ label: string; points: number; dateIso: string }[]> {
  const { data, error } = await supabase
    .from('claimed_rewards')
    .select('reward_label, points_cost, claimed_at')
    .eq('user_id', userId)
    .order('claimed_at', { ascending: false });

  if (error) {
    console.error('Error loading rewards:', error);
    return [];
  }

  return data.map(r => ({
    label: r.reward_label,
    points: r.points_cost,
    dateIso: r.claimed_at,
  }));
}

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

async function getCheckinDates(userId: string, startDate: string, endDate: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('checkins')
    .select('date')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lt('date', endDate);

  if (error) {
    console.error('Error fetching checkin dates:', error);
    return new Set();
  }

  return new Set(data.map(row => row.date));
}

// Synchroniseer punten met aantal check-ins in database
async function syncPointsWithCheckins(userId: string): Promise<number> {
  const totalCheckins = await getCheckinCount(userId);
  const dbRewards = await loadRewardsFromDatabase(userId);

  // Trek totaal geclaimde punten af
  const totalClaimedPoints = dbRewards.reduce((sum, r) => sum + r.points, 0);
  const actualPoints = Math.max(0, totalCheckins - totalClaimedPoints);

  console.log(`📊 Sync: ${totalCheckins} check-ins, ${totalClaimedPoints} claimed → ${actualPoints} punten`);

  await savePointsToDatabase(userId, actualPoints);
  return actualPoints;
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
  const reconKey = useMemo(() => `mentalLastRecon:${userId}`, [userId]);

  // Load data from database on mount
  useEffect(() => {
    const loadUserData = async () => {
      if (!userId) return;

      try {
        console.log('🔄 Loading user data...');

        // Check of vandaag al ingevuld is
        const hasSubmittedToday = await checkinExistsToday(userId);
        setSubmitted(hasSubmittedToday);

        // Synchroniseer punten met check-ins
        const syncedPoints = await syncPointsWithCheckins(userId);
        setPoints(syncedPoints);

        // Laad geclaimde rewards
        const dbRewards = await loadRewardsFromDatabase(userId);
        setRedeemed(dbRewards);

        console.log('✅ Data loaded:', { points: syncedPoints, rewards: dbRewards.length });
      } catch (error) {
        console.error('❌ Error loading user data:', error);
        setError('Kon gegevens niet laden. Probeer de pagina te vernieuwen.');
      }
    };

    loadUserData();
  }, [userId]);

  // Reconcile missed days (optioneel - alleen als je strafpunten wilt)
  useEffect(() => {
    const reconcileMissedDays = async () => {
      if (!userId || !allowNegative) return; // Skip als strafpunten uit staan

      const today = startOfLocalDay(new Date());
      const lastReconStr = localStorage.getItem(reconKey);
      const lastRecon = parseYyyyMmDd(lastReconStr) || addDays(today, -7);

      let cur = startOfLocalDay(addDays(lastRecon, 1));
      let missedDays = 0;

      const checkinDates = await getCheckinDates(
        userId,
        yyyyMmDd(cur),
        yyyyMmDd(today)
      );

      while (cur < today) {
        const dateStr = yyyyMmDd(cur);
        if (!checkinDates.has(dateStr)) {
          missedDays += 1;
        }
        cur = addDays(cur, 1);
      }

      if (missedDays > 0) {
        console.log(`⚠️ ${missedDays} gemiste dag(en) gedetecteerd`);

        const currentPoints = await loadPointsFromDatabase(userId);
        const newPoints = Math.max(0, currentPoints - missedDays);

        await savePointsToDatabase(userId, newPoints);
        setPoints(newPoints);

        setOkMsg(`Let op: ${missedDays} punt(en) afgetrokken voor gemiste dag(en).`);
        setTimeout(() => setOkMsg(null), 5000);
      }

      localStorage.setItem(reconKey, yyyyMmDd(today));
    };

    reconcileMissedDays();
  }, [userId, reconKey, allowNegative]);

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

      // Sla check-in op
      await saveToSupabase(payload, userId);

      // Synchroniseer punten opnieuw (tel alle check-ins)
      const newPoints = await syncPointsWithCheckins(userId);
      setPoints(newPoints);

      // Award playtime for new check-ins
      let playtimeAwarded = 0;
      if (!hasAlreadyCheckedIn) {
        try {
          const response = await fetch('/api/playtime/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId,
              delta: 2,
              reason: 'daily_checkin',
              meta: { date: payload.date }
            }),
          });
          if (response.ok) {
            playtimeAwarded = 2;
          }
        } catch (err) {
          console.error('Failed to award playtime:', err);
        }
      }

      if (!hasAlreadyCheckedIn) {
        const playtimeMsg = playtimeAwarded > 0 ? ` en ${playtimeAwarded} speelminuten` : '';
        setOkMsg(`Bedankt! Je check-in is opgeslagen en je hebt een punt${playtimeMsg} verdiend! ✨`);
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
      alert("Melding opslaan mislukte.");
    }
  }

  async function claim(tier: RewardTier) {
    if (!canClaim(tier)) return;
    if (!confirm(`Beloning claimen: ${tier.label} voor ${tier.points} punten?`)) return;

    try {
      // Sla geclaimde beloning op
      await saveClaimedRewardToDatabase(userId, { label: tier.label, points: tier.points });

      // Update lokale state
      const newRecord = { ...tier, dateIso: new Date().toISOString() };
      setRedeemed(prev => [...prev, newRecord]);

      // Synchroniseer punten opnieuw (automatisch trekt claimed points af)
      const newPoints = await syncPointsWithCheckins(userId);
      setPoints(newPoints);

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
        {error && <div className="text-sm text-red-700">{error}</div>}
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

      {redeemed.length > 0 && (
        <div className="mt-3 pt-3 border-t">
          <div className="text-sm font-medium mb-2">Geclaimde beloningen:</div>
          <div className="space-y-1">
            {redeemed.map((r, i) => (
              <div key={i} className="text-xs text-gray-600">
                ✓ {r.label} ({r.points} punten) - {new Date(r.dateIso).toLocaleDateString('nl-NL')}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
