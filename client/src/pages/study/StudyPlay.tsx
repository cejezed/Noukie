import React, { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { usePlaytime } from "@/hooks/usePlaytime";
import GeoGameScreen from "@/components/game/GeoGameScreen";
import { isGameEnabled } from "@/config/gameSubjects";

function useUserId() {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data }) => { if (alive) setId(data.user?.id ?? null); });
    return () => { alive = false; };
  }, []);
  return id;
}

function getQueryParam(name: string) {
  try { return new URLSearchParams(window.location.search).get(name); }
  catch { return null; }
}

function normalizeChoices(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(v => v != null && v !== "").map(String);
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return [];
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.filter(v => v != null && v !== "").map(String);
      if (parsed == null) return [];
      return [String(parsed)];
    } catch {
      if (s.includes("\n")) return s.split("\n").map(t => t.trim()).filter(Boolean);
      if (s.includes(";")) return s.split(";").map(t => t.trim()).filter(Boolean);
      if (s.includes(",")) return s.split(",").map(t => t.trim()).filter(Boolean);
      return [s];
    }
  }
  return [String(raw)];
}

function eq(a?: string | null, b?: string | null) {
  return String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();
}

/**
 * StandardQuizPlayer
 *
 * Bevat alle logica voor:
 * - Oefenmodus (practice)
 * - Standaard gamemodus (time rush)
 */
function StandardQuizPlayer({
  userId,
  quizId,
  mode,
  subject
}: {
  userId: string,
  quizId: string,
  mode: string,
  subject: string | null
}) {
  const [resultId, setResultId] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(false);
  const [uiError, setUiError] = useState<string | null>(null);
  const [rewards, setRewards] = useState<{
    xpAwarded: number;
    playtimeAwarded: number;
    leveledUp: boolean;
    newLevel: number;
  } | null>(null);

  // Feedback state
  const [showFb, setShowFb] = useState(false);
  const [selected, setSelected] = useState<string>("");
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [correctAnswer, setCorrectAnswer] = useState<string>("");

  // Live score / progress
  const answeredSet = useRef<Set<number>>(new Set());
  const [answeredCount, setAnsweredCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);

  // Game mode: playtime & timer
  const isGameMode = mode === "game";
  const GAME_COST_MINUTES = 2;
  const GAME_DURATION_SECONDS = 120;
  const { balanceMinutes, usePlaytime: deductPlaytime } = usePlaytime();
  const [timeRemaining, setTimeRemaining] = useState(GAME_DURATION_SECONDS);
  const [gameStarted, setGameStarted] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const questions = useQuery({
    queryKey: ["quiz-questions", quizId, userId],
    enabled: !!userId && !!quizId,
    queryFn: async () => {
      const res = await fetch(`/api/quizzes/questions?quiz_id=${encodeURIComponent(quizId!)}`, {
        headers: { "x-user-id": userId! },
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      return Array.isArray(json.data) ? json.data : [];
    },
  });

  const play = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/quizzes/play", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": userId! },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onError: (e: any) => setUiError(String(e?.message || e)),
  });

  // Start quiz (with playtime deduction for game mode)
  useEffect(() => {
    let cancelled = false;

    const startQuiz = async () => {
      // If game mode, deduct playtime first
      if (isGameMode) {
        if ((balanceMinutes ?? 0) < GAME_COST_MINUTES) {
          setUiError(`Je hebt ${GAME_COST_MINUTES} minuten speeltijd nodig voor game mode.`);
          return;
        }

        try {
          await deductPlaytime(GAME_COST_MINUTES);
          setGameStarted(true);
        } catch (e) {
          setUiError("Kon speeltijd niet aftrekken. Probeer het opnieuw.");
          return;
        }
      } else {
        setGameStarted(true);
      }

      // Start the quiz
      play.mutate(
        { action: "start", quiz_id: quizId },
        { onSuccess: (r) => { if (!cancelled) setResultId(r?.result?.id ?? null); } }
      );
    };

    startQuiz();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Timer countdown for game mode
  useEffect(() => {
    if (!isGameMode || !gameStarted || done) return;

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          // Time's up! Force finish
          setDone(true);
          if (resultId) {
            play.mutate({ action: "finish", result_id: resultId });
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isGameMode, gameStarted, done, resultId, play]);

  const list = questions.data ?? [];
  const q = list[index];

  // Finish poging zodra alles beantwoord is
  const finishedRef = useRef(false);
  useEffect(() => {
    const allAnswered = index >= list.length && list.length > 0;
    if (allAnswered && resultId && !finishedRef.current) {
      finishedRef.current = true;
      play.mutate(
        { action: "finish", result_id: resultId, mode: mode, time_remaining: timeRemaining },
        {
          onSuccess: (data) => {
            setDone(true);
            // Save rewards data if available
            if (data?.rewards) {
              setRewards(data.rewards);
            }
          },
          onError: () => setDone(true)
        }
      );
    }
  }, [index, list.length, resultId, play, mode, timeRemaining]);

  const resetFeedback = () => {
    setShowFb(false);
    setSelected("");
    setIsCorrect(null);
    setCorrectAnswer("");
  };

  const handleAnswer = (ans: string) => {
    if (showFb) return;
    setSelected(ans);

    const correct = eq(ans, q.answer);
    setIsCorrect(correct);
    setCorrectAnswer(q.answer ?? "");
    setShowFb(true);

    if (!answeredSet.current.has(index)) {
      answeredSet.current.add(index);
      setAnsweredCount((c) => c + 1);
      if (correct) setCorrectCount((c) => c + 1);
    }

    if (resultId) {
      play.mutate({
        action: "answer",
        result_id: resultId,
        question_id: q.id,
        given_answer: ans,
      });
    }
  };

  const advance = () => {
    resetFeedback();
    setIndex((i) => i + 1);
  };

  const pct = list.length ? Math.round((index / list.length) * 100) : 0;

  // Format timer display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Error states
  if (uiError) {
    return (
      <main className="mx-auto max-w-[800px] px-6 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">{uiError}</p>
          <a href="/toets" className="text-blue-600 underline mt-2 inline-block">
            Terug naar toetsen
          </a>
        </div>
      </main>
    );
  }

  if (questions.isLoading) {
    return (
      <main className="p-8">
        <p className="text-sm text-gray-500">Vragen laden…</p>
      </main>
    );
  }

  if (questions.isError) {
    return (
      <main className="p-8">
        <p className="text-red-600">Fout bij laden: {String(questions.error)}</p>
      </main>
    );
  }

  // Klaar scherm
  if (done || (list.length > 0 && index >= list.length)) {
    const pctDone = list.length ? Math.round((correctCount / list.length) * 100) : 0;
    return (
      <main className="mx-auto max-w-[800px] px-6 py-8">
        {isGameMode && (
          <div className="mb-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl p-4 text-center">
            <div className="text-4xl mb-2">🎮</div>
            <div className="text-xl font-bold">Game Mode Voltooid!</div>
            {timeRemaining > 0 ? (
              <div className="text-sm opacity-90 mt-1">Met nog {formatTime(timeRemaining)} over</div>
            ) : (
              <div className="text-sm opacity-90 mt-1">Tijd is op!</div>
            )}
          </div>
        )}
        <h1 className="text-2xl font-semibold mb-4">Klaar! 🎉</h1>
        <p className="mb-2">Je antwoorden zijn opgeslagen.</p>
        <p className="mb-6">Score: <b>{correctCount}</b> / {list.length} ({pctDone}%)</p>

        {/* StudyPlay Rewards Display */}
        {rewards && (rewards.xpAwarded > 0 || rewards.playtimeAwarded > 0) && (
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-purple-900 mb-4">✨ Beloningen verdiend!</h2>

            {rewards.xpAwarded > 0 && (
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">⭐</span>
                <div>
                  <p className="font-semibold text-purple-800">+{rewards.xpAwarded} XP</p>
                  <p className="text-sm text-gray-600">
                    {isGameMode
                      ? `Ervaring verdiend! (inclusief game mode bonus ${rewards.xpAwarded > 75 ? '+speed bonus' : ''})`
                      : 'Ervaring verdiend!'}
                  </p>
                </div>
              </div>
            )}

            {rewards.playtimeAwarded > 0 && (
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">🎮</span>
                <div>
                  <p className="font-semibold text-blue-800">+{rewards.playtimeAwarded} minuten</p>
                  <p className="text-sm text-gray-600">
                    {isGameMode
                      ? `Speeltijd verdiend! (netto +${rewards.playtimeAwarded - GAME_COST_MINUTES} na kosten)`
                      : 'Speeltijd verdiend!'}
                  </p>
                </div>
              </div>
            )}

            {rewards.leveledUp && (
              <div className="mt-4 bg-gradient-to-r from-yellow-100 to-yellow-200 border-2 border-yellow-400 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <span className="text-4xl">🏆</span>
                  <div>
                    <p className="font-bold text-yellow-800">Level Up!</p>
                    <p className="text-sm text-yellow-700">Je bent nu level {rewards.newLevel}!</p>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-purple-200">
              <a
                href="/study/games"
                className="inline-block bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold px-6 py-3 rounded-lg transition-all shadow-md hover:shadow-lg"
              >
                🎮 Ga naar Games →
              </a>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <a href="/toets" className="bg-gray-200 px-4 py-2 rounded">
            Terug naar overzicht
          </a>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            Opnieuw proberen
          </button>
        </div>
      </main>
    );
  }

  if (!q) {
    return (
      <main className="p-8">
        <p className="text-sm text-gray-500">Geen vragen gevonden.</p>
        <a className="text-blue-600 underline" href="/toets">Ga naar Toetsen</a>
      </main>
    );
  }

  // Safely handle potentially object-like values to prevent React crashes
  const promptValue = q.prompt;
  const prompt: string = typeof promptValue === 'object' ? JSON.stringify(promptValue) : String(promptValue ?? "");

  const choices = normalizeChoices(q.choices);

  const explValue = q.explanation;
  const explanation: string = typeof explValue === 'object' ? JSON.stringify(explValue) : String(explValue ?? "");

  return (
    <main className="mx-auto max-w-[800px] px-6 py-8">
      {/* Game Mode Header */}
      {isGameMode && (
        <div className={`mb-4 rounded-xl p-4 transition-all ${timeRemaining <= 30
            ? 'bg-gradient-to-r from-red-500 to-orange-500 animate-pulse'
            : 'bg-gradient-to-r from-purple-500 to-pink-500'
          } text-white`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{timeRemaining <= 30 ? '⏰' : '🎮'}</span>
              <div>
                <div className="font-bold text-lg">Game Mode</div>
                <div className="text-sm opacity-90">
                  {timeRemaining <= 30 ? 'Snel! Tijd loopt af!' : 'Race tegen de klok!'}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold font-mono">{formatTime(timeRemaining)}</div>
              <div className="text-xs opacity-75">Tijd over</div>
            </div>
          </div>
        </div>
      )}

      {/* Practice Mode Indicator */}
      {!isGameMode && (
        <div className="mb-4 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl p-3 text-sm flex items-center gap-2">
          <span>📚</span>
          <span>Oefen modus - Neem de tijd!</span>
        </div>
      )}

      {/* Voortgang + Score */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
          <span>Voortgang</span>
          <span>{pct}% · {answeredCount}/{list.length}</span>
        </div>
        <div className="h-2 rounded bg-gray-200 overflow-hidden">
          <div
            className={`h-full transition-all ${isGameMode ? 'bg-gradient-to-r from-purple-600 to-pink-600' : 'bg-sky-600'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-2 text-sm">
          <span className="text-gray-600">Score: </span>
          <span className="font-medium">{correctCount}</span>
          <span className="text-gray-600"> / {answeredCount}</span>
        </div>
      </div>

      <div className="mb-2 text-sm text-gray-500">Vraag {index + 1} van {list.length}</div>
      <h1 className="text-xl font-semibold mb-4">{prompt}</h1>

      {choices.length > 0 ? (
        <div className="space-y-2 mb-4">
          {choices.map((ch, i) => {
            let base = "w-full text-left px-4 py-3 border rounded-lg transition";
            if (!showFb) {
              base += " hover:bg-gray-100";
            } else if (eq(ch, q.answer)) {
              base += " bg-emerald-100 border-emerald-500";
            } else if (ch === selected) {
              base += " bg-red-100 border-red-500";
            } else {
              base += " opacity-50";
            }
            return (
              <button key={i} onClick={() => handleAnswer(ch)} className={base} disabled={showFb}>
                {ch}
              </button>
            );
          })}
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const input = (e.target as HTMLFormElement).elements.namedItem("ans") as HTMLInputElement;
            if (input.value.trim()) handleAnswer(input.value.trim());
          }}
          className="mb-4"
        >
          <input
            name="ans"
            className="border rounded px-3 py-2 w-full"
            placeholder="Typ je antwoord…"
            autoFocus
            disabled={showFb}
          />
          {!showFb && (
            <button type="submit" className="mt-2 bg-blue-600 text-white px-4 py-2 rounded">
              Bevestig
            </button>
          )}
        </form>
      )}

      {showFb && (
        <div className={`p-4 rounded mb-4 ${isCorrect ? "bg-emerald-50" : "bg-red-50"}`}>
          <p className="font-medium">{isCorrect ? "Goed! 🎉" : "Helaas, fout 😕"}</p>
          {!isCorrect && <p className="text-sm mt-1">Het juiste antwoord was: <b>{correctAnswer}</b></p>}
          {explanation && <p className="text-sm mt-2 text-gray-700">{explanation}</p>}
          <button onClick={advance} className="mt-3 bg-sky-600 text-white px-4 py-2 rounded">
            Volgende vraag →
          </button>
        </div>
      )}
    </main>
  );
}

export default function StudyPlay() {
  const userId = useUserId();
  const quizId = getQueryParam("quiz");
  const mode = getQueryParam("mode") || "practice";
  const subject = getQueryParam("subject");

  // Check if this is a GeoGame subject (Aardrijkskunde with game mode)
  const isGeoGame = mode === "game" && subject && isGameEnabled(subject) && quizId;

  if (!userId) {
    return (
      <main className="p-8">
        <p className="text-sm text-gray-500">Inloggen vereist…</p>
      </main>
    );
  }

  if (isGeoGame) {
    return (
      <main className="p-8">
        <GeoGameScreen quizId={quizId!} subject={subject as any} userId={userId} />
      </main>
    );
  }

  // For standard mode, ensure we have a quizId
  if (!quizId) {
    return (
      <main className="p-8">
        <p className="text-red-600">Geen quiz geselecteerd.</p>
        <a className="text-blue-600 underline" href="/toets">Ga naar Toetsen</a>
      </main>
    );
  }

  return (
    <StandardQuizPlayer
      userId={userId}
      quizId={quizId}
      mode={mode}
      subject={subject}
    />
  );
}
