/**
 * useGameQuizEngine Hook (DEEL 3 Version)
 *
 * Core game state machine for gameified quiz experience.
 * Manages levels, questions, XP, lives, streaks, power-ups, and Time Rush mode.
 *
 * Features:
 * - Split questions into levels
 * - Track XP, lives, streak
 * - Navigation: next question, next level
 * - Answer validation
 * - Power-ups: Hint, Joker, Extra Life
 * - Time Rush mode with timer and bonus XP
 * - Callbacks for level/quiz completion
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { QuizItem, GameState, SubjectGameConfig, GameScore, PowerUpType, SubjectKey } from "@/types/game";
import { calculateXP, SUBJECT_GAME_CONFIG } from "@/config/gameSubjects";

// ============================================
// TYPES
// ============================================

interface UseGameQuizEngineOptions {
  questions: QuizItem[];
  subject: SubjectKey;
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
  usePowerUp: (type: PowerUpType) => boolean;

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
  const { questions, subject, questionsPerLevel = 4 } = options;

  // Get config for this subject
  const config = SUBJECT_GAME_CONFIG[subject];

  // Split questions into levels (memoized)
  const allLevels = useMemo(
    () => splitIntoLevels(questions, questionsPerLevel),
    [questions, questionsPerLevel]
  );

  // Initialize game state
  const [state, setState] = useState<GameState>(() => {
    const firstLevel = allLevels[0] || [];

    return {
      // Subject
      subject,

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

      // Power-ups
      powerUps: {
        hint: config.startingPowerups.hint,
        joker: config.startingPowerups.joker,
        extra_life: config.startingPowerups.extra_life,
      },
      activePowerUps: [],
      weakenedOptionIndexes: [],
      hiddenOptionIndexes: [],

      // Time Rush mode
      mode: "normal",
      isTimeRushMode: false,
      timeRushTimer: null,
      questionStartedAt: null,

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
    // Quiz is only complete if we have levels AND we've passed the last one
    if (state.totalLevels === 0) return false;
    return state.currentLevel > state.totalLevels;
  }, [state.currentLevel, state.totalLevels]);

  // ============================================
  // ACTIONS
  // ============================================

  /**
   * Answer current question
   * Returns whether answer was correct and XP earned
   * Handles Time Rush bonuses for quick answers
   */
  const answerQuestion = useCallback(
    (givenAnswer: string): { isCorrect: boolean; xpEarned: number } => {
      if (!currentQuestion) {
        return { isCorrect: false, xpEarned: 0 };
      }

      const correctAnswer = currentQuestion.answer;
      const isCorrect = normalizeAnswer(givenAnswer) === normalizeAnswer(correctAnswer);

      let actualXpEarned = 0;

      setState((prev) => {
        let newXP = prev.xp;
        let newStreak = prev.streak;
        let newBestStreak = prev.bestStreak;
        let newLives = prev.lives;
        let xpEarned = 0;

        if (isCorrect) {
          // Check if answered quickly in Time Rush mode
          const answeredQuickly = prev.isTimeRushMode && prev.timeRushTimer !== null && prev.timeRushTimer > 0;

          // Correct answer: award XP, increment streak
          xpEarned = calculateXP({
            baseXP: config.baseXpPerQuestion,
            streak: prev.streak,
            streakMultiplier: config.streakBonusMultiplier,
            isTimeRush: prev.isTimeRushMode,
            timeRushBonus: config.timeRushBonusXp,
            answeredQuickly,
          });

          actualXpEarned = xpEarned;
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

      return { isCorrect, xpEarned: actualXpEarned };
    },
    [currentQuestion, config]
  );

  /**
   * Move to next question in current level
   * Resets power-up effects and starts timer for Time Rush
   */
  const nextQuestion = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentQuestionIndex: prev.currentQuestionIndex + 1,
      // Reset power-up effects for new question
      weakenedOptionIndexes: [],
      hiddenOptionIndexes: [],
      // Start timer for Time Rush mode
      questionStartedAt: prev.isTimeRushMode ? Date.now() : null,
      timeRushTimer: prev.isTimeRushMode ? config.timeRushSeconds : null,
    }));
  }, [config]);

  /**
   * Move to next level
   * Resets lives and loads next level's questions
   * Detects Time Rush mode for new level
   */
  const nextLevel = useCallback(() => {
    setState((prev) => {
      const newLevelNumber = prev.currentLevel + 1;
      const newLevelQuestions = allLevels[newLevelNumber - 1] || [];

      // Check if new level is Time Rush mode
      const isTimeRush = config.timeRushLevels.includes(newLevelNumber);

      return {
        ...prev,
        currentLevel: newLevelNumber,
        currentQuestionIndex: 0,
        questionsInLevel: newLevelQuestions,
        lives: config.livesPerLevel, // Reset lives for new level
        completedLevels: [...prev.completedLevels, prev.currentLevel],
        currentLevelStartedAt: Date.now(),
        // Time Rush detection
        isTimeRushMode: isTimeRush,
        mode: isTimeRush ? "timeRush" : "normal",
        questionStartedAt: isTimeRush ? Date.now() : null,
        timeRushTimer: isTimeRush ? config.timeRushSeconds : null,
        // Reset power-up effects
        weakenedOptionIndexes: [],
        hiddenOptionIndexes: [],
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
    setState((prev) => {
      const isTimeRush = config.timeRushLevels.includes(prev.currentLevel);

      return {
        ...prev,
        currentQuestionIndex: 0,
        lives: config.livesPerLevel,
        currentLevelStartedAt: Date.now(),
        // Reset Time Rush timer
        questionStartedAt: isTimeRush ? Date.now() : null,
        timeRushTimer: isTimeRush ? config.timeRushSeconds : null,
        // Reset power-up effects
        weakenedOptionIndexes: [],
        hiddenOptionIndexes: [],
      };
    });
  }, [config]);

  /**
   * Use a power-up
   * Returns true if power-up was used successfully, false if unavailable
   */
  const usePowerUp = useCallback(
    (type: PowerUpType): boolean => {
      if (!currentQuestion) return false;

      // Check if user has this power-up available
      if (state.powerUps[type] <= 0) return false;

      // Get current question's choices (need to normalize them)
      const rawChoices = currentQuestion.choices;
      let choices: string[] = [];

      if (Array.isArray(rawChoices)) {
        choices = rawChoices.map(String);
      } else if (typeof rawChoices === "string") {
        try {
          const parsed = JSON.parse(rawChoices);
          choices = Array.isArray(parsed) ? parsed.map(String) : [rawChoices];
        } catch {
          choices = rawChoices.split("\n").map((s) => s.trim()).filter(Boolean);
        }
      }

      if (choices.length === 0) return false;

      const correctAnswer = normalizeAnswer(currentQuestion.answer);

      setState((prev) => {
        const updates: Partial<GameState> = {
          powerUps: {
            ...prev.powerUps,
            [type]: prev.powerUps[type] - 1,
          },
        };

        // HINT: Weaken one wrong option (gray it out)
        if (type === "hint") {
          const wrongIndexes = choices
            .map((choice, i) => ({ choice, i }))
            .filter(({ choice }) => normalizeAnswer(choice) !== correctAnswer)
            .filter(({ i }) => !prev.weakenedOptionIndexes.includes(i))
            .filter(({ i }) => !prev.hiddenOptionIndexes.includes(i))
            .map(({ i }) => i);

          if (wrongIndexes.length > 0) {
            const randomWrongIndex = wrongIndexes[Math.floor(Math.random() * wrongIndexes.length)];
            updates.weakenedOptionIndexes = [...prev.weakenedOptionIndexes, randomWrongIndex];
          }
        }

        // JOKER: Hide two wrong options (50/50)
        if (type === "joker") {
          const wrongIndexes = choices
            .map((choice, i) => ({ choice, i }))
            .filter(({ choice }) => normalizeAnswer(choice) !== correctAnswer)
            .filter(({ i }) => !prev.hiddenOptionIndexes.includes(i))
            .map(({ i }) => i);

          if (wrongIndexes.length >= 2) {
            // Shuffle and take first 2
            const shuffled = wrongIndexes.sort(() => Math.random() - 0.5);
            const toHide = shuffled.slice(0, 2);
            updates.hiddenOptionIndexes = [...prev.hiddenOptionIndexes, ...toHide];
          } else if (wrongIndexes.length === 1) {
            // Only 1 wrong option left, hide it
            updates.hiddenOptionIndexes = [...prev.hiddenOptionIndexes, wrongIndexes[0]];
          }
        }

        // EXTRA LIFE: Add one life (max: maxLives + 1)
        if (type === "extra_life") {
          updates.lives = Math.min(prev.lives + 1, prev.maxLives + 1);
        }

        return { ...prev, ...updates };
      });

      return true;
    },
    [currentQuestion, state.powerUps]
  );

  // ============================================
  // EFFECTS
  // ============================================

  /**
   * Reset game state when questions change (e.g., when data loads)
   */
  useEffect(() => {
    if (questions.length > 0 && state.totalLevels === 0) {
      // Questions just loaded - reinitialize state
      const newLevels = splitIntoLevels(questions, questionsPerLevel);
      const firstLevel = newLevels[0] || [];

      // Check if level 1 is Time Rush mode
      const isTimeRush = config.timeRushLevels.includes(1);

      setState({
        subject,
        currentLevel: 1,
        totalLevels: newLevels.length,
        questionsPerLevel,
        currentQuestionIndex: 0,
        questionsInLevel: firstLevel,
        allLevels: newLevels,
        xp: 0,
        lives: config.livesPerLevel,
        maxLives: config.livesPerLevel,
        streak: 0,
        bestStreak: 0,
        powerUps: {
          hint: config.startingPowerups.hint,
          joker: config.startingPowerups.joker,
          extra_life: config.startingPowerups.extra_life,
        },
        activePowerUps: [],
        weakenedOptionIndexes: [],
        hiddenOptionIndexes: [],
        mode: isTimeRush ? "timeRush" : "normal",
        isTimeRushMode: isTimeRush,
        timeRushTimer: isTimeRush ? config.timeRushSeconds : null,
        questionStartedAt: isTimeRush ? Date.now() : null,
        completedLevels: [],
        score: { correct: 0, total: 0, percentage: 0 },
        sessionStartedAt: Date.now(),
        currentLevelStartedAt: Date.now(),
      });
    }
  }, [questions, questionsPerLevel, config, state.totalLevels, subject]);

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

  /**
   * Time Rush countdown timer
   * Decrements timer every second, auto-fails when time runs out
   */
  useEffect(() => {
    if (!state.isTimeRushMode || state.timeRushTimer === null || state.timeRushTimer <= 0) {
      return;
    }

    const interval = setInterval(() => {
      setState((prev) => {
        if (!prev.isTimeRushMode || prev.timeRushTimer === null || prev.timeRushTimer <= 0) {
          return prev;
        }

        const newTimer = prev.timeRushTimer - 1;

        // If timer hits 0, auto-fail the question
        if (newTimer <= 0) {
          // Lose life and reset streak
          const newLives = Math.max(0, prev.lives - 1);
          const newScore = calculateScore(prev.score.correct, prev.score.total + 1);

          return {
            ...prev,
            timeRushTimer: 0,
            lives: newLives,
            streak: 0,
            score: newScore,
          };
        }

        return {
          ...prev,
          timeRushTimer: newTimer,
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [state.isTimeRushMode, state.timeRushTimer]);

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
    usePowerUp,

    // Status
    isLevelComplete,
    isQuizComplete,
  };
}
