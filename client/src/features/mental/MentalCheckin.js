import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
const DEFAULT_TIERS = [
    { points: 25, label: "Samen shoppen" },
    { points: 100, label: "Dagje Walibi" },
    { points: 200, label: "Phantasialand" },
];
const POSITIVE_PROMPTS = [
    { category: "FUN_WITH_SOMEONE", label: "Met wie had je vandaag lol?" },
    { category: "CHALLENGE_SUCCEEDED", label: "Wat was spannend maar tóch gelukt?" },
    { category: "PROUD", label: "Waar ben je trots op vandaag?" },
    { category: "ENERGY", label: "Wat gaf je energie?" },
];
function yyyyMmDd(date) {
    return date.toISOString().slice(0, 10);
}
function startOfLocalDay(d = new Date()) {
    const dt = new Date(d);
    dt.setHours(0, 0, 0, 0);
    return dt;
}
function addDays(d, n) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
}
function parseYyyyMmDd(s) {
    if (!s)
        return null;
    const m = /^\d{4}-\d{2}-\d{2}$/.exec(s);
    if (!m)
        return null;
    const [y, mo, da] = s.split("-").map(Number);
    return new Date(y, mo - 1, da);
}
// ---- Database helpers --------------------------------------------------------
async function saveToSupabase(payload, userId) {
    const { error } = await supabase
        .from("checkins")
        .upsert({
        user_id: userId,
        date: payload.date,
        mood_color: payload.mood,
        sleep: payload.sleep ?? null,
        tension: payload.tension ?? null,
        eating: payload.eating ?? null,
        medication: payload.medication ?? null,
        notes: null,
    }, { onConflict: "user_id,date" });
    if (error)
        throw error;
    if (payload.positives?.length) {
        const rows = payload.positives.map((p) => ({
            user_id: userId,
            date: payload.date,
            category: p.category,
            text: (p.text ?? "").slice(0, 500),
        }));
        const { error: ep } = await supabase.from("positives").insert(rows);
        if (ep)
            throw ep;
    }
}
async function getCheckinCount(userId) {
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
async function savePointsToDatabase(userId, points) {
    const { error } = await supabase
        .from('user_points')
        .upsert({ user_id: userId, points: points }, { onConflict: 'user_id' });
    if (error) {
        console.error('Error saving points:', error);
        throw error;
    }
}
async function loadPointsFromDatabase(userId) {
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
async function saveClaimedRewardToDatabase(userId, reward) {
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
async function loadRewardsFromDatabase(userId) {
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
async function checkinExistsToday(userId) {
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
async function getCheckinDates(userId, startDate, endDate) {
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
async function syncPointsWithCheckins(userId) {
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
export default function MentalCheckin({ userId, webhookUrl, helpWebhookUrl, rewardTiers = DEFAULT_TIERS, allowNegative = false, }) {
    // UI state
    const [submitted, setSubmitted] = useState(false);
    const [mood, setMood] = useState(null);
    const [sleep, setSleep] = useState(null);
    const [tension, setTension] = useState(null);
    const [eating, setEating] = useState(null);
    const [medication, setMedication] = useState(false);
    const [pIdx, setPIdx] = useState(0);
    const [pText, setPText] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [okMsg, setOkMsg] = useState(null);
    // Rewards state
    const [points, setPoints] = useState(0);
    const [redeemed, setRedeemed] = useState([]);
    // Keys
    const reconKey = useMemo(() => `mentalLastRecon:${userId}`, [userId]);
    // Load data from database on mount
    useEffect(() => {
        const loadUserData = async () => {
            if (!userId)
                return;
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
            }
            catch (error) {
                console.error('❌ Error loading user data:', error);
                setError('Kon gegevens niet laden. Probeer de pagina te vernieuwen.');
            }
        };
        loadUserData();
    }, [userId]);
    // Reconcile missed days (optioneel - alleen als je strafpunten wilt)
    useEffect(() => {
        const reconcileMissedDays = async () => {
            if (!userId || !allowNegative)
                return; // Skip als strafpunten uit staan
            const today = startOfLocalDay(new Date());
            const lastReconStr = localStorage.getItem(reconKey);
            const lastRecon = parseYyyyMmDd(lastReconStr) || addDays(today, -7);
            let cur = startOfLocalDay(addDays(lastRecon, 1));
            let missedDays = 0;
            const checkinDates = await getCheckinDates(userId, yyyyMmDd(cur), yyyyMmDd(today));
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
    const isComplete = mood !== null &&
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
            if (!hasAlreadyCheckedIn) {
                setOkMsg("Bedankt! Je check-in is opgeslagen en je hebt een punt verdiend! ✨");
            }
            else {
                setOkMsg("Je check-in is bijgewerkt. Je hebt vandaag al een punt verdiend. 🌟");
            }
            setSubmitted(true);
        }
        catch (e) {
            console.error('Error saving checkin:', e);
            setError(e?.message ?? "Opslaan mislukt");
        }
        finally {
            setSaving(false);
        }
    }
    async function onHelp(now = false) {
        try {
            const { error: helpErr } = await supabase.from("help_events").insert([
                { user_id: userId, type: now ? "help_now" : "help_feeling_bad" },
            ]);
            if (helpErr)
                throw helpErr;
            alert("We hebben je melding opgeslagen.");
        }
        catch (e) {
            alert("Melding opslaan mislukte.");
        }
    }
    async function claim(tier) {
        if (!canClaim(tier))
            return;
        if (!confirm(`Beloning claimen: ${tier.label} voor ${tier.points} punten?`))
            return;
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
        }
        catch (error) {
            console.error('Error claiming reward:', error);
            alert('Er ging iets mis bij het claimen van je beloning. Probeer het opnieuw.');
        }
    }
    function canClaim(tier) {
        return points >= tier.points;
    }
    const nextTier = rewardTiers.find(t => points < t.points) || null;
    const progressToNext = nextTier ? Math.min(1, points / nextTier.points) : 1;
    if (submitted) {
        return (_jsxs("div", { className: "rounded-2xl shadow p-4 bg-white space-y-4", children: [_jsx("p", { className: "text-base", children: "Je hebt vandaag al ingevuld. Dankjewel! \uD83C\uDF1F" }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: () => onHelp(false), className: "text-sm px-3 py-1 rounded-full bg-amber-100 hover:bg-amber-200", children: "Ik voel me niet lekker" }), _jsx("button", { onClick: () => onHelp(true), className: "text-sm px-3 py-1 rounded-full bg-red-100 hover:bg-red-200", children: "Hulp nodig nu" })] }), _jsx(RewardsPanel, { points: points, rewardTiers: rewardTiers, nextTier: nextTier, progressToNext: progressToNext, onClaim: claim, redeemed: redeemed }), okMsg && _jsx("div", { className: "text-sm text-green-700", children: okMsg }), error && _jsx("div", { className: "text-sm text-red-700", children: error })] }));
    }
    return (_jsxs("div", { className: "rounded-2xl shadow p-4 bg-white space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h2", { className: "text-lg font-semibold", children: "Hoe voel je je vandaag?" }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: () => onHelp(false), className: "text-sm px-3 py-1 rounded-full bg-amber-100 hover:bg-amber-200", children: "Ik voel me niet lekker" }), _jsx("button", { onClick: () => onHelp(true), className: "text-sm px-3 py-1 rounded-full bg-red-100 hover:bg-red-200", children: "Hulp nu" })] })] }), _jsx("div", { className: "flex gap-3", children: [1, 2, 3, 4, 5].map((v) => (_jsx("button", { className: `w-10 h-10 rounded-full ring-2 ${mood === v ? "ring-black" : "ring-transparent"}`, onClick: () => setMood(v), "aria-label": `Mood ${v}`, style: {
                        background: ["#d32f2f", "#f57c00", "#fbc02d", "#7cb342", "#388e3c"][v - 1],
                    } }, v))) }), _jsxs("div", { className: "flex flex-col gap-3", children: [_jsx(QuickScale, { label: "Slaap", value: sleep, onChange: setSleep }), _jsx(QuickScale, { label: "Spanning", value: tension, onChange: setTension }), _jsx(QuickScale, { label: "Energie", value: eating, onChange: setEating }), _jsxs("label", { className: "flex items-center gap-2 text-sm select-none", children: [_jsx("input", { id: "extra-med", type: "checkbox", className: "h-4 w-4", checked: medication, onChange: (e) => setMedication(e.target.checked) }), _jsx("span", { children: "Extra Medicatie" })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("label", { className: "text-sm font-medium", children: POSITIVE_PROMPTS[pIdx].label }), _jsx("button", { className: "text-xs underline", onClick: () => setPIdx((pIdx + 1) % POSITIVE_PROMPTS.length), children: "Andere vraag" })] }), _jsx("textarea", { className: "w-full border rounded-xl p-2 text-sm", rows: 3, placeholder: "Typ hier je lichtpuntje\u2026", value: pText, onChange: (e) => setPText(e.target.value), maxLength: 500 })] }), error && _jsx("div", { className: "text-sm text-red-700", children: error }), okMsg && _jsx("div", { className: "text-sm text-green-700", children: okMsg }), _jsx("button", { className: "w-full rounded-xl py-2 bg-black text-white disabled:opacity-50", disabled: !isComplete || saving, onClick: onSave, children: saving ? "Opslaan…" : "Klaar 🎉" }), !isComplete && (_jsx("div", { className: "text-xs text-gray-500 mt-1", children: "Vul alle velden in om door te gaan." })), _jsx(RewardsPanel, { points: points, rewardTiers: rewardTiers, nextTier: nextTier, progressToNext: progressToNext, onClaim: claim, redeemed: redeemed })] }));
}
function QuickScale({ label, value, onChange, }) {
    return (_jsxs("div", { children: [_jsx("div", { className: "text-sm mb-1", children: label }), _jsx("div", { className: "flex gap-2", children: [1, 2, 3, 4, 5].map((v) => (_jsx("button", { className: `w-8 h-8 rounded-lg border ${value === v ? "border-black" : "border-gray-300"}`, onClick: () => onChange(v), children: v }, v))) })] }));
}
function RewardsPanel({ points, rewardTiers, nextTier, progressToNext, onClaim, redeemed, }) {
    return (_jsxs("div", { className: "mt-2 border rounded-2xl p-3 bg-gray-50", children: [_jsxs("div", { className: "flex items-baseline justify-between mb-2", children: [_jsxs("div", { className: "text-base font-semibold", children: ["Punten: ", points] }), nextTier ? (_jsxs("div", { className: "text-sm text-gray-600", children: ["Volgende beloning: ", _jsx("span", { className: "font-medium", children: nextTier.label }), " bij ", nextTier.points] })) : (_jsx("div", { className: "text-sm text-gray-600", children: "Je hebt alle beloningen binnen bereik \uD83C\uDF89" }))] }), _jsx("div", { className: "w-full h-2 bg-white rounded-full overflow-hidden mb-3", children: _jsx("div", { className: "h-2", style: { width: `${Math.round(progressToNext * 100)}%`, background: "black" } }) }), _jsx("div", { className: "space-y-2", children: rewardTiers.map((tier) => {
                    const pct = Math.min(1, points / tier.points);
                    const can = points >= tier.points;
                    return (_jsx("div", { className: "rounded-xl bg-white p-2 border", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "text-sm font-medium", children: [tier.label, " \u00B7 ", tier.points, " punten"] }), _jsx("button", { onClick: () => onClaim(tier), disabled: !can, className: `text-xs px-2 py-1 rounded-lg border ${can ? "bg-black text-white" : "bg-gray-200 text-gray-600"}`, children: can ? "Claim" : `${Math.floor(pct * 100)}%` })] }) }, tier.label));
                }) }), redeemed.length > 0 && (_jsxs("div", { className: "mt-3 pt-3 border-t", children: [_jsx("div", { className: "text-sm font-medium mb-2", children: "Geclaimde beloningen:" }), _jsx("div", { className: "space-y-1", children: redeemed.map((r, i) => (_jsxs("div", { className: "text-xs text-gray-600", children: ["\u2713 ", r.label, " (", r.points, " punten) - ", new Date(r.dateIso).toLocaleDateString('nl-NL')] }, i))) })] }))] }));
}
