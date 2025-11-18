import React, { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { usePlaytime } from "@/hooks/usePlaytime";

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
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return [];
    try {
      const parsed = JSON.parse(s);
      return Array.isArray(parsed) ? parsed.map(String) : [s];
    } catch {
      if (s.includes("\n")) return s.split("\n").map(t=>t.trim()).filter(Boolean);
      if (s.includes(";")) return s.split(";").map(t=>t.trim()).filter(Boolean);
      if (s.includes(",")) return s.split(",").map(t=>t.trim()).filter(Boolean);
      return [s];
    }
  }
  try { return JSON.parse(String(raw)); } catch { return [String(raw)]; }
}

function eq(a?: string | null, b?: string | null) {
  return String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();
}

export default function StudyPlay() {
  const userId = useUserId();
  const quizId = getQueryParam("quiz");
  const mode = getQueryParam("mode") || "practice"; // 'practice' or 'game'

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
  const { balanceMinutes, usePlaytime: deductPlaytime, isUsing } = usePlaytime();
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
    if (!userId || !quizId) return;
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
  }, [userId, quizId]);

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

  const next = () => {
    resetFeedback();
    setIndex((i) => i + 1);
  };

  function countThisAnswer(correct: boolean | null) {
    if (!answeredSet.current.has(index)) {
      answeredSet.current.add(index);
      setAnsweredCount((c) => c + 1);
      if (correct === true) setCorrectCount((c) => c + 1);
    }
  }

  const answerMC = (choice: string) => {
    if (!q || !resultId) return;
    const correct = eq(choice, q.answer);
    setSelected(choice);
    setIsCorrect(correct);
    setCorrectAnswer(q.answer ?? "");
    setShowFb(true);
    countThisAnswer(correct);
    play.mutate({ action: "answer", result_id: resultId, question_id: q.id, given_answer: choice });
  };

  const answerOpen = (value: string) => {
    if (!q || !resultId) return;
    const correct = q.answer ? eq(value, q.answer) : null;
    setSelected(value);
    setIsCorrect(correct);
    setCorrectAnswer(q.answer ?? "");
    setShowFb(true);
    countThisAnswer(correct);
    play.mutate({ action: "answer", result_id: resultId, question_id: q.id, given_answer: value });
  };

  // UI states
  if (!quizId) {
    return <main className="p-8"><p className="text-red-600">Geen quiz geselecteerd.</p></main>;
  }
  if (!userId) {
    return <main className="p-8"><p className="text-sm text-gray-500">Inloggen vereist…</p></main>;
  }
  if (questions.isLoading) {
    return <main className="p-8"><p>Laden…</p></main>;
  }
  if (questions.isError) {
    return (
      <main className="p-8">
        <p className="text-red-600">Kon vragen niet laden.</p>
        <pre className="mt-2 text-xs bg-gray-50 p-2 rounded">{String((questions.error as Error)?.message)}</pre>
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
                  <span className="text-4xl">🎊</span>
                  <div>
                    <p className="font-bold text-yellow-900 text-lg">Level Up!</p>
                    <p className="text-yellow-800">Je bent nu level {rewards.newLevel}!</p>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-purple-200">
              <a
                className="inline-block bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold px-6 py-3 rounded-lg transition-all"
                href="/study/games"
              >
                🎮 Ga naar Games →
              </a>
            </div>
          </div>
        )}

        <a className="text-sky-700 underline" href="/toets">Terug naar Toetsen</a>
      </main>
    );
  }

  if (list.length === 0) {
    return (
      <main className="mx-auto max-w-[800px] px-6 py-8">
        <h1 className="text-xl font-semibold mb-4">Deze toets heeft nog geen vragen.</h1>
        <a className="text-sky-700 underline" href="/toets">Terug naar Toetsen</a>
      </main>
    );
  }

  // Header met voortgang + score
  const pct = list.length ? Math.round((answeredCount / list.length) * 100) : 0;

  const qtype: string = (q.qtype ?? "mc").toLowerCase();
  const prompt: string = q.prompt ?? "";
  const choices = normalizeChoices(q.choices);
  const explanation: string = q.explanation ?? "";

  // Format timer display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <main className="mx-auto max-w-[800px] px-6 py-8">
      {/* Game Mode Header */}
      {isGameMode && (
        <div className={`mb-4 rounded-xl p-4 transition-all ${
          timeRemaining <= 30
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

      {/* Vraag body */}
      {qtype === "mc" ? (
        choices.length ? (
          <div className="grid gap-3">
            {choices.map((c: string, i: number) => {
              const isChosen = showFb && c === selected;
              const isRight = showFb && eq(c, correctAnswer);

              // duidelijke feedback:
              // - gekozen + juist: stevig groen
              // - gekozen + fout: stevig rood
              // - niet gekozen maar juist: groene omlijning
              const base = "text-left border rounded-xl p-3 transition-colors";
              const hover = showFb ? "" : " hover:bg-gray-50";
              const chosenRight = isChosen && isRight ? " border-emerald-600 bg-emerald-50" : "";
              const chosenWrong = isChosen && !isRight ? " border-red-600 bg-red-50" : "";
              const notChosenButRight = !isChosen && isRight ? " border-emerald-500" : "";
              const classes = [base, hover, chosenRight, chosenWrong, notChosenButRight].join(" ").trim();

              return (
                <button
                  key={i}
                  onClick={() => (showFb ? undefined : answerMC(c))}
                  className={classes}
                  disabled={showFb}
                >
                  <div className="flex items-start gap-2">
                    {showFb && isRight && <span aria-hidden>✅</span>}
                    {showFb && isChosen && !isRight && <span aria-hidden>❌</span>}
                    <span>{c}</span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-red-600">Deze meerkeuzevraag heeft geen opties.</p>
        )
      ) : (
        !showFb ? (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const inp = (e.target as HTMLFormElement).elements.namedItem("open") as HTMLInputElement;
              answerOpen(inp.value);
            }}
          >
            <input name="open" className="flex-1 border rounded-xl p-3" placeholder="Jouw antwoord" />
            <button className="px-4 py-2 rounded-xl bg-sky-600 text-white">Bevestigen</button>
          </form>
        ) : null
      )}

      {/* Feedback */}
      {showFb && (
        <div className="mt-6 rounded-xl border p-4 bg-white">
          {isCorrect === true && <p className="text-emerald-700 font-medium">✅ Goed!</p>}
          {isCorrect === false && <p className="text-red-700 font-medium">❌ Niet helemaal. Het juiste antwoord is:</p>}
          {isCorrect === null && <p className="text-sky-700 font-medium">📌 Antwoord geregistreerd.</p>}

          <div className="mt-2 text-sm text-gray-800">
            {selected && <div><span className="text-gray-500">Jouw antwoord:</span> {selected}</div>}
            {correctAnswer && !eq(selected, correctAnswer) && (
              <div><span className="text-gray-500">Juiste antwoord:</span> {correctAnswer}</div>
            )}
          </div>

          {explanation && (
            <div className="mt-3 text-sm text-gray-700">
              <span className="text-gray-500">Uitleg:</span> {explanation}
            </div>
          )}

          <div className="mt-4">
            <button onClick={next} className="px-4 py-2 rounded-xl bg-sky-600 text-white">
              Volgende
            </button>
          </div>
        </div>
      )}

      {uiError && <p className="mt-4 text-xs text-red-600">{uiError}</p>}
    </main>
  );
}
