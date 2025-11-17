/**
 * useGameQuizEngine Hook (MVP Version)
 *
 * Core game state machine for gameified quiz experience.
 * Manages levels, questions, XP, lives, and streaks.
 *
 * MVP Features:
 * - Split questions into levels
 * - Track XP, lives, streak
 * - Navigation: next question, next level
 * - Answer validation
 *
 * TODO (later iterations):
 * - Power-ups (hint, joker, extra_life)
 * - Time Rush mode
 * - Supabase persistence
 * - Callbacks for level/quiz completion
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import type { QuizItem, GameState, SubjectGameConfig, GameScore } from "@/types/game";
import { calculateXP } from "@/config/gameSubjects";

// ============================================
// TYPES
// ============================================

interface UseGameQuizEngineOptions {
  questions: QuizItem[];
  config: SubjectGameConfig;
  questionsPerLevel?: number;
  onLevelComplete?: (level: number, stats: any) => void;
  onQuizComplete?: (stats: any) => void;
}

interface GameEngineAPI {
  state: GameState;
  currentQuestion: QuizItem | null;

  // Actions
  answerQuestion: (givenAnswer: string) => {
    isCorrect: boolean;
    xpEarned: number;
  };
  nextQuestion: () => void;
  nextLevel: () => void;
  resetLevel: () => void;

  // Status checks
  isLevelComplete: boolean;
  isQuizComplete: boolean;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Split questions into levels (chunks)
 */
function splitIntoLevels(questions: QuizItem[], questionsPerLevel: number): QuizItem[][] {
  const levels: QuizItem[][] = [];

  for (let i = 0; i < questions.length; i += questionsPerLevel) {
    levels.push(questions.slice(i, i + questionsPerLevel));
  }

  return levels;
}

/**
 * Normalize answer for comparison
 */
function normalizeAnswer(answer: string | null | undefined): string {
  return String(answer ?? "").trim().toLowerCase();
}

/**
 * Calculate score percentage
 */
function calculateScore(correct: number, total: number): GameScore {
  const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;
  return { correct, total, percentage };
}

// ============================================
// HOOK
// ============================================

export function useGameQuizEngine(options: UseGameQuizEngineOptions): GameEngineAPI {
  const { questions, config, questionsPerLevel = 4 } = options;

  // Split questions into levels (memoized)
  const allLevels = useMemo(
    () => splitIntoLevels(questions, questionsPerLevel),
    [questions, questionsPerLevel]
  );

  // Initialize game state
  const [state, setState] = useState<GameState>(() => {
    const firstLevel = allLevels[0] || [];

    return {
      // Level system
      currentLevel: 1,
      totalLevels: allLevels.length,
      questionsPerLevel,

      // Question navigation
      currentQuestionIndex: 0,
      questionsInLevel: firstLevel,
      allLevels,

      // Game mechanics
      xp: 0,
      lives: config.livesPerLevel,
      maxLives: config.livesPerLevel,
      streak: 0,
      bestStreak: 0,

      // Power-ups (not implemented in MVP)
      powerUps: {
        hint: config.startingPowerups.hint,
        joker: config.startingPowerups.joker,
        extra_life: config.startingPowerups.extra_life,
      },
      activePowerUps: [],

      // Special modes (not implemented in MVP)
      mode: "normal",
      timeRushTimer: null,

      // Progress
      completedLevels: [],
      score: { correct: 0, total: 0, percentage: 0 },

      // Session tracking
      sessionStartedAt: Date.now(),
      currentLevelStartedAt: Date.now(),
    };
  });

  // Current question (derived)
  const currentQuestion = useMemo(() => {
    const { questionsInLevel, currentQuestionIndex } = state;
    return questionsInLevel[currentQuestionIndex] || null;
  }, [state.questionsInLevel, state.currentQuestionIndex]);

  // Status checks
  const isLevelComplete = useMemo(() => {
    return state.currentQuestionIndex >= state.questionsInLevel.length;
  }, [state.currentQuestionIndex, state.questionsInLevel.length]);

  const isQuizComplete = useMemo(() => {
    return state.currentLevel > state.totalLevels;
  }, [state.currentLevel, state.totalLevels]);

  // ============================================
  // ACTIONS
  // ============================================

  /**
   * Answer current question
   * Returns whether answer was correct and XP earned
   */
  const answerQuestion = useCallback(
    (givenAnswer: string): { isCorrect: boolean; xpEarned: number } => {
      if (!currentQuestion) {
        return { isCorrect: false, xpEarned: 0 };
      }

      const correctAnswer = currentQuestion.answer;
      const isCorrect = normalizeAnswer(givenAnswer) === normalizeAnswer(correctAnswer);

      setState((prev) => {
        let newXP = prev.xp;
        let newStreak = prev.streak;
        let newBestStreak = prev.bestStreak;
        let newLives = prev.lives;
        let xpEarned = 0;

        if (isCorrect) {
          // Correct answer: award XP, increment streak
          xpEarned = calculateXP({
            baseXP: config.baseXpPerQuestion,
            streak: prev.streak,
            streakMultiplier: config.streakBonusMultiplier,
          });

          newXP = prev.xp + xpEarned;
          newStreak = prev.streak + 1;
          newBestStreak = Math.max(prev.bestStreak, newStreak);
        } else {
          // Wrong answer: lose life, reset streak
          newLives = Math.max(0, prev.lives - 1);
          newStreak = 0;
        }

        // Update score
        const newScore = calculateScore(
          prev.score.correct + (isCorrect ? 1 : 0),
          prev.score.total + 1
        );

        return {
          ...prev,
          xp: newXP,
          streak: newStreak,
          bestStreak: newBestStreak,
          lives: newLives,
          score: newScore,
        };
      });

      return { isCorrect, xpEarned: isCorrect ? config.baseXpPerQuestion : 0 };
    },
    [currentQuestion, config]
  );

  /**
   * Move to next question in current level
   */
  const nextQuestion = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentQuestionIndex: prev.currentQuestionIndex + 1,
    }));
  }, []);

  /**
   * Move to next level
   * Resets lives and loads next level's questions
   */
  const nextLevel = useCallback(() => {
    setState((prev) => {
      const newLevelNumber = prev.currentLevel + 1;
      const newLevelQuestions = allLevels[newLevelNumber - 1] || [];

      return {
        ...prev,
        currentLevel: newLevelNumber,
        currentQuestionIndex: 0,
        questionsInLevel: newLevelQuestions,
        lives: config.livesPerLevel, // Reset lives for new level
        completedLevels: [...prev.completedLevels, prev.currentLevel],
        currentLevelStartedAt: Date.now(),
      };
    });

    // Trigger callback (if provided)
    if (options.onLevelComplete) {
      options.onLevelComplete(state.currentLevel, {
        xp: state.xp,
        streak: state.streak,
        lives: state.lives,
      });
    }
  }, [allLevels, config, options, state]);

  /**
   * Reset current level (when out of lives)
   * Reloads current level questions and resets lives
   */
  const resetLevel = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentQuestionIndex: 0,
      lives: config.livesPerLevel,
      currentLevelStartedAt: Date.now(),
    }));
  }, [config]);

  // ============================================
  // EFFECTS
  // ============================================

  /**
   * Trigger quiz complete callback when all levels done
   */
  useEffect(() => {
    if (isQuizComplete && options.onQuizComplete) {
      const duration = Math.floor((Date.now() - state.sessionStartedAt) / 1000);

      options.onQuizComplete({
        quizId: questions[0]?.quiz_id || "",
        subject: config.subject,
        totalQuestions: state.score.total,
        correctAnswers: state.score.correct,
        totalXpEarned: state.xp,
        bestStreak: state.bestStreak,
        levelsCompleted: state.completedLevels.length,
        scorePercentage: state.score.percentage,
        duration,
      });
    }
  }, [isQuizComplete]); // eslint-disable-line react-hooks/exhaustive-deps

  // ============================================
  // RETURN API
  // ============================================

  return {
    state,
    currentQuestion,

    // Actions
    answerQuestion,
    nextQuestion,
    nextLevel,
    resetLevel,

    // Status
    isLevelComplete,
    isQuizComplete,
  };
}
