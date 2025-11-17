/**
 * useVocabSession Hook
 *
 * Manages learning/testing session state for vocabulary practice
 *
 * Features:
 * - Learn mode: Flashcards (flip to see translation)
 * - Test mode: Input answer and validate
 * - Progress tracking per item
 * - Session completion handling
 */

import { useState, useCallback, useMemo } from 'react';
import type {
  VocabItemWithProgress,
  VocabSessionState,
  VocabSessionMode,
  AnswerResult,
} from '@/types/vocab';

// ============================================
// TYPES
// ============================================

interface UseVocabSessionOptions {
  listId: string;
  listTitle: string;
  items: VocabItemWithProgress[];
  mode: VocabSessionMode;
  onComplete?: (stats: SessionStats) => void;
}

interface SessionStats {
  totalItems: number;
  correctAnswers: number;
  incorrectAnswers: number;
  duration: number; // seconds
  accuracyPercentage: number;
}

interface VocabSessionAPI {
  state: VocabSessionState;

  // Learn mode actions
  flipCard: () => void;
  markKnown: () => void;
  markUnknown: () => void;

  // Test mode actions
  submitAnswer: (givenAnswer: string) => AnswerResult;

  // Navigation
  nextItem: () => void;
  previousItem: () => void;
  goToItem: (index: number) => void;

  // Completion
  finishSession: () => SessionStats;

  // Status
  canGoBack: boolean;
  canGoNext: boolean;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Normalize answer for comparison (lowercase, trim, remove accents)
 */
function normalizeAnswer(answer: string): string {
  return answer
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Remove accents
}

/**
 * Check if two answers match
 */
function answersMatch(given: string, correct: string): boolean {
  const normalizedGiven = normalizeAnswer(given);
  const normalizedCorrect = normalizeAnswer(correct);

  // Exact match
  if (normalizedGiven === normalizedCorrect) return true;

  // Check if answer contains multiple options (e.g., "cat / feline")
  const correctOptions = normalizedCorrect.split(/[\/,;]/).map((s) => s.trim());
  return correctOptions.some((option) => normalizedGiven === option);
}

// ============================================
// HOOK
// ============================================

export function useVocabSession(options: UseVocabSessionOptions): VocabSessionAPI {
  const { listId, listTitle, items, mode, onComplete } = options;

  // Initialize session state
  const [state, setState] = useState<VocabSessionState>(() => ({
    listId,
    listTitle,
    mode,
    items,
    totalItems: items.length,
    currentIndex: 0,
    currentItem: items[0] || null,
    correctAnswers: 0,
    incorrectAnswers: 0,
    sessionStartedAt: Date.now(),
    isFlipped: false,
    showResult: false,
    lastAnswerCorrect: null,
    isComplete: false,
  }));

  // Current item (derived)
  const currentItem = useMemo(() => {
    return state.items[state.currentIndex] || null;
  }, [state.items, state.currentIndex]);

  // Navigation status
  const canGoBack = state.currentIndex > 0;
  const canGoNext = state.currentIndex < state.items.length - 1;

  // ============================================
  // LEARN MODE ACTIONS
  // ============================================

  /**
   * Flip flashcard (learn mode)
   */
  const flipCard = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isFlipped: !prev.isFlipped,
    }));
  }, []);

  /**
   * Mark item as known (learn mode)
   */
  const markKnown = useCallback(() => {
    setState((prev) => ({
      ...prev,
      correctAnswers: prev.correctAnswers + 1,
      isFlipped: false,
    }));
  }, []);

  /**
   * Mark item as unknown (learn mode)
   */
  const markUnknown = useCallback(() => {
    setState((prev) => ({
      ...prev,
      incorrectAnswers: prev.incorrectAnswers + 1,
      isFlipped: false,
    }));
  }, []);

  // ============================================
  // TEST MODE ACTIONS
  // ============================================

  /**
   * Submit answer (test mode)
   * Returns whether answer was correct
   */
  const submitAnswer = useCallback(
    (givenAnswer: string): AnswerResult => {
      if (!currentItem) {
        return {
          isCorrect: false,
          correctAnswer: '',
          givenAnswer,
        };
      }

      const isCorrect = answersMatch(givenAnswer, currentItem.translation);

      setState((prev) => ({
        ...prev,
        correctAnswers: prev.correctAnswers + (isCorrect ? 1 : 0),
        incorrectAnswers: prev.incorrectAnswers + (isCorrect ? 0 : 1),
        showResult: true,
        lastAnswerCorrect: isCorrect,
      }));

      return {
        isCorrect,
        correctAnswer: currentItem.translation,
        givenAnswer,
      };
    },
    [currentItem]
  );

  // ============================================
  // NAVIGATION
  // ============================================

  /**
   * Move to next item
   */
  const nextItem = useCallback(() => {
    setState((prev) => {
      const nextIndex = prev.currentIndex + 1;

      // Check if session is complete
      if (nextIndex >= prev.items.length) {
        return {
          ...prev,
          isComplete: true,
        };
      }

      return {
        ...prev,
        currentIndex: nextIndex,
        currentItem: prev.items[nextIndex],
        isFlipped: false,
        showResult: false,
        lastAnswerCorrect: null,
      };
    });
  }, []);

  /**
   * Move to previous item
   */
  const previousItem = useCallback(() => {
    setState((prev) => {
      if (prev.currentIndex <= 0) return prev;

      const prevIndex = prev.currentIndex - 1;

      return {
        ...prev,
        currentIndex: prevIndex,
        currentItem: prev.items[prevIndex],
        isFlipped: false,
        showResult: false,
        lastAnswerCorrect: null,
      };
    });
  }, []);

  /**
   * Jump to specific item
   */
  const goToItem = useCallback((index: number) => {
    setState((prev) => {
      if (index < 0 || index >= prev.items.length) return prev;

      return {
        ...prev,
        currentIndex: index,
        currentItem: prev.items[index],
        isFlipped: false,
        showResult: false,
        lastAnswerCorrect: null,
      };
    });
  }, []);

  // ============================================
  // COMPLETION
  // ============================================

  /**
   * Finish session and return stats
   */
  const finishSession = useCallback((): SessionStats => {
    const duration = Math.floor((Date.now() - state.sessionStartedAt) / 1000);
    const totalAnswered = state.correctAnswers + state.incorrectAnswers;
    const accuracyPercentage =
      totalAnswered > 0 ? Math.round((state.correctAnswers / totalAnswered) * 100) : 0;

    const stats: SessionStats = {
      totalItems: state.totalItems,
      correctAnswers: state.correctAnswers,
      incorrectAnswers: state.incorrectAnswers,
      duration,
      accuracyPercentage,
    };

    // Trigger callback
    if (onComplete) {
      onComplete(stats);
    }

    return stats;
  }, [state, onComplete]);

  // ============================================
  // RETURN API
  // ============================================

  return {
    state,

    // Learn mode actions
    flipCard,
    markKnown,
    markUnknown,

    // Test mode actions
    submitAnswer,

    // Navigation
    nextItem,
    previousItem,
    goToItem,

    // Completion
    finishSession,

    // Status
    canGoBack,
    canGoNext,
  };
}
