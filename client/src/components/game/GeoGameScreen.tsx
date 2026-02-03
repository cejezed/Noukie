/**
 * GeoGameScreen Component (MVP Version)
 *
 * Core game UI that renders questions in gameified format.
 * Uses useGameQuizEngine hook for state management.
 *
 * MVP Features:
 * - Display questions with game HUD
 * - Multiple choice answers
 * - XP/streak feedback
 * - Level progression
 * - Lives system
 *
 * TODO (future):
 * - Power-ups UI
 * - Time Rush mode
 * - Level transition animations
 * - Summary screen integration
 */

import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { GeoGameHUD } from "./GeoGameHUD";
import { useGameQuizEngine } from "@/hooks/useGameQuizEngine";
import { getSubjectConfig } from "@/config/gameSubjects";
import type { QuizItem } from "@/types/game";

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Normalize choices from API (can be string or array)
 */
function normalizeChoices(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return [];
    try {
      const parsed = JSON.parse(s);
      return Array.isArray(parsed) ? parsed.map(String) : [String(parsed)];
    } catch {
      if (s.includes("\n")) return s.split("\n").map((t) => t.trim()).filter(Boolean);
      if (s.includes(";")) return s.split(";").map((t) => t.trim()).filter(Boolean);
      if (s.includes(",")) return s.split(",").map((t) => t.trim()).filter(Boolean);
      return [s];
    }
  }
  return [String(raw)];
}

/**
 * Check if two answers match (case-insensitive, trimmed)
 */
function answersMatch(a?: string | null, b?: string | null): boolean {
  return String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();
}

// ============================================
// COMPONENT
// ============================================

interface GeoGameScreenProps {
  quizId: string;
  subject: "aardrijkskunde";
  userId: string;
}

export default function GeoGameScreen(props: GeoGameScreenProps) {
  const { quizId, subject, userId } = props;

  // Get subject config
  // Get subject config
  const config = getSubjectConfig(subject);

  // Fetch quiz questions (reuse existing API)
  const questionsQuery = useQuery({
    queryKey: ["quiz-questions", quizId, userId],
    enabled: !!userId && !!quizId,
    queryFn: async () => {
      const res = await fetch(`/api/quizzes/questions?quiz_id=${encodeURIComponent(quizId)}`, {
        headers: { "x-user-id": userId },
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      return Array.isArray(json.data) ? json.data : [];
    },
  });

  // Feedback state (after answering)
  const [showFeedback, setShowFeedback] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [isCorrect, setIsCorrect] = useState(false);
  const [xpEarned, setXpEarned] = useState(0);

  // Initialize game engine
  // Safely provide a fallback config if missing so hook doesn't crash before we return
  const safeConfig = config || { primaryColor: '', secondaryColor: '', icon: '' };

  const engine = useGameQuizEngine({
    questions: questionsQuery.data || [],
    config: safeConfig as any,
    questionsPerLevel: 4,
    onLevelComplete: (level, stats) => {
      console.log("Level complete:", level, stats);
      // TODO: Show level summary modal
    },
    onQuizComplete: (stats) => {
      console.log("Quiz complete:", stats);
      // TODO: Navigate to summary screen
    },
  });

  const { state, currentQuestion, isLevelComplete, isQuizComplete, answerQuestion, nextQuestion, nextLevel, resetLevel } = engine;

  // Reset feedback when question changes
  useEffect(() => {
    setShowFeedback(false);
    setSelectedAnswer("");
    setIsCorrect(false);
    setXpEarned(0);
  }, [currentQuestion?.id]);

  // Auto-progress to next level when current level is complete
  useEffect(() => {
    if (isLevelComplete && !isQuizComplete) {
      // Small delay before progressing
      const timer = setTimeout(() => {
        nextLevel();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isLevelComplete, isQuizComplete, nextLevel]);

  // Early return if config is missing - NOW SAFE after hooks
  if (!config) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">Subject "{subject}" is niet geconfigureerd voor game mode.</p>
      </div>
    );
  }

  // ============================================
  // HANDLERS
  // ============================================

  const handleAnswerClick = (choice: string) => {
    if (showFeedback) return; // Already answered

    const result = answerQuestion(choice);

    setSelectedAnswer(choice);
    setIsCorrect(result.isCorrect);
    setXpEarned(result.xpEarned);
    setShowFeedback(true);
  };

  const handleNext = () => {
    if (state.lives <= 0) {
      // Out of lives - reset level
      resetLevel();
    } else {
      // Move to next question
      nextQuestion();
    }
  };

  // ============================================
  // RENDER: LOADING & ERROR STATES
  // ============================================

  if (!userId) {
    return (
      <main className="p-8">
        <p className="text-sm text-gray-500">Inloggen vereist…</p>
      </main>
    );
  }

  if (questionsQuery.isLoading) {
    return (
      <main className="p-8">
        <p>Vragen laden…</p>
      </main>
    );
  }

  if (questionsQuery.isError) {
    return (
      <main className="p-8">
        <p className="text-red-600">Kon vragen niet laden.</p>
        <pre className="mt-2 text-xs bg-gray-50 p-2 rounded">
          {String((questionsQuery.error as Error)?.message)}
        </pre>
      </main>
    );
  }

  if (!questionsQuery.data || questionsQuery.data.length === 0) {
    return (
      <main className="mx-auto max-w-[800px] px-6 py-8">
        <h1 className="text-xl font-semibold mb-4">Deze toets heeft nog geen vragen.</h1>
        <a className="text-sky-700 underline" href="/toets">
          Terug naar Toetsen
        </a>
      </main>
    );
  }

  // ============================================
  // RENDER: QUIZ COMPLETE
  // ============================================

  if (isQuizComplete) {
    return (
      <main className="mx-auto max-w-[800px] px-6 py-8">
        <div className="text-center space-y-6">
          <h1 className="text-3xl font-bold">🎉 Quiz Voltooid!</h1>

          <div className="bg-white border rounded-2xl p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-3xl font-bold text-blue-600">{state.score.percentage}%</div>
                <div className="text-sm text-gray-600">Score</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-purple-600">{state.xp} XP</div>
                <div className="text-sm text-gray-600">Verdiend</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-orange-600">{state.bestStreak}</div>
                <div className="text-sm text-gray-600">Beste Streak</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-green-600">{state.completedLevels.length}</div>
                <div className="text-sm text-gray-600">Levels</div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-teal-500 to-blue-500 text-white font-semibold hover:opacity-90"
            >
              Speel Opnieuw
            </button>
            <br />
            <a className="text-sky-700 underline" href="/toets">
              Terug naar Toetsen
            </a>
          </div>
        </div>
      </main>
    );
  }

  // ============================================
  // RENDER: LEVEL COMPLETE (transition screen)
  // ============================================

  if (isLevelComplete) {
    return (
      <main className="mx-auto max-w-[800px] px-6 py-8">
        <div className="text-center space-y-6">
          <h1 className="text-3xl font-bold">⭐ Level {state.currentLevel} Voltooid!</h1>
          <div className="bg-white border rounded-2xl p-6">
            <p className="text-gray-600">Bezig met laden van volgend level...</p>
          </div>
        </div>
      </main>
    );
  }

  // ============================================
  // RENDER: OUT OF LIVES
  // ============================================

  if (state.lives <= 0 && !showFeedback) {
    return (
      <main className="mx-auto max-w-[800px] px-6 py-8">
        <div className="text-center space-y-6">
          <h1 className="text-3xl font-bold">💔 Geen Levens Meer</h1>

          <div className="bg-white border rounded-2xl p-6 space-y-4">
            <p className="text-gray-700">Je bent door je levens heen gegaan.</p>
            <p className="text-gray-700">Probeer Level {state.currentLevel} opnieuw!</p>

            <button
              onClick={resetLevel}
              className="px-6 py-3 rounded-xl bg-orange-500 text-white font-semibold hover:opacity-90"
            >
              Probeer Level Opnieuw
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ============================================
  // RENDER: ACTIVE QUESTION
  // ============================================

  if (!currentQuestion) {
    return (
      <main className="p-8">
        <p className="text-gray-600">Geen vraag beschikbaar.</p>
      </main>
    );
  }

  const qtype: string = (currentQuestion.qtype ?? "mc").toLowerCase();

  const promptValue = currentQuestion.prompt;
  const prompt: string = typeof promptValue === 'object' ? JSON.stringify(promptValue) : String(promptValue ?? "");

  const choices = normalizeChoices(currentQuestion.choices);

  const answerValue = currentQuestion.answer;
  const correctAnswer = typeof answerValue === 'object' ? JSON.stringify(answerValue) : String(answerValue ?? "");

  return (
    <main>
      {/* HUD */}
      <GeoGameHUD
        currentLevel={state.currentLevel}
        totalLevels={state.totalLevels}
        lives={state.lives}
        maxLives={state.maxLives}
        streak={state.streak}
        xp={state.xp}
        timer={state.timeRushTimer}
      />

      {/* Question Content */}
      <div className="mx-auto max-w-[800px] px-6 py-8">
        {/* Question number */}
        <div className="mb-2 text-sm text-gray-500">
          Vraag {state.currentQuestionIndex + 1} van {state.questionsInLevel.length}
        </div>

        {/* Question prompt */}
        <h1
          className="text-2xl font-semibold mb-6 p-4 rounded-xl"
          style={{ backgroundColor: config.secondaryColor }}
        >
          {prompt}
        </h1>

        {/* Multiple choice answers */}
        {qtype === "mc" && choices.length > 0 ? (
          <div className="grid gap-3 mb-6">
            {choices.map((choice: string, i: number) => {
              const isChosen = showFeedback && choice === selectedAnswer;
              const isRight = showFeedback && answersMatch(choice, correctAnswer);

              // Styling logic
              const base = "text-left border-2 rounded-xl p-4 transition-all font-medium";
              const hover = showFeedback ? "" : " hover:bg-gray-50 hover:border-gray-400 cursor-pointer";
              const chosenRight = isChosen && isRight ? " border-emerald-600 bg-emerald-50" : "";
              const chosenWrong = isChosen && !isRight ? " border-red-600 bg-red-50" : "";
              const notChosenButRight = !isChosen && isRight ? " border-emerald-500 bg-emerald-50" : "";
              const defaultBorder = !showFeedback ? " border-gray-300" : "";

              const classes = [base, hover, chosenRight, chosenWrong, notChosenButRight, defaultBorder]
                .join(" ")
                .trim();

              return (
                <button
                  key={i}
                  onClick={() => handleAnswerClick(choice)}
                  className={classes}
                  disabled={showFeedback}
                >
                  <div className="flex items-start gap-3">
                    {showFeedback && isRight && <span className="text-2xl">✅</span>}
                    {showFeedback && isChosen && !isRight && <span className="text-2xl">❌</span>}
                    <span>{choice}</span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-red-600 mb-6">
            Deze vraag heeft geen opties (type: {qtype}).
          </p>
        )}

        {/* Feedback panel */}
        {showFeedback && (
          <div className="rounded-xl border-2 p-6 bg-white space-y-4">
            {/* Feedback message */}
            {isCorrect ? (
              <div className="flex items-center gap-2">
                <span className="text-3xl">✅</span>
                <div>
                  <p className="text-emerald-700 font-bold text-lg">Goed gedaan!</p>
                  <p className="text-sm text-emerald-600">+{xpEarned} XP</p>
                  {state.streak >= 3 && (
                    <p className="text-sm text-orange-600 flex items-center gap-1">
                      <span>⚡</span> Streak Bonus! ({state.streak} op rij)
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-3xl">❌</span>
                <div>
                  <p className="text-red-700 font-bold text-lg">Niet helemaal...</p>
                  <p className="text-sm text-red-600">-1 leven</p>
                  <p className="text-sm text-gray-600 mt-1">
                    Juiste antwoord: <span className="font-semibold">{correctAnswer}</span>
                  </p>
                </div>
              </div>
            )}

            {/* Explanation (if available) */}
            {currentQuestion.explanation && (
              <div className="border-t pt-3">
                <p className="text-sm text-gray-500 mb-1">Uitleg:</p>
                <p className="text-sm text-gray-700">{typeof currentQuestion.explanation === 'object' ? JSON.stringify(currentQuestion.explanation) : String(currentQuestion.explanation)}</p>
              </div>
            )}

            {/* Next button */}
            <div className="pt-2">
              <button
                onClick={handleNext}
                className="px-6 py-3 rounded-xl font-semibold text-white"
                style={{ backgroundColor: config.primaryColor }}
              >
                {state.lives <= 0 ? "Probeer Level Opnieuw" : "Volgende Vraag →"}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
