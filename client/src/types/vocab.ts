/**
 * Vocabulary Trainer Type Definitions
 *
 * Types for WRTS-style vocabulary learning feature
 */

// ============================================
// DATABASE ENTITY TYPES
// ============================================

/**
 * Vocab List metadata
 */
export interface VocabList {
  id: string;
  owner_id: string;
  subject: string;
  grade: number | null;
  title: string;
  language_from: string;
  language_to: string;
  created_at: string;
  updated_at: string;
}

/**
 * Individual vocab item (word/term)
 */
export interface VocabItem {
  id: string;
  list_id: string;
  term: string;
  translation: string;
  example_sentence: string | null;
  notes: string | null;
  created_at: string;
}

/**
 * User progress for a vocab item (spaced repetition)
 */
export interface VocabProgress {
  user_id: string;
  item_id: string;
  mastery_level: number; // 0-5
  last_seen_at: string | null;
  next_due_at: string | null;
  times_correct: number;
  times_incorrect: number;
  created_at: string;
  updated_at: string;
}

/**
 * Vocab item with user progress attached
 */
export interface VocabItemWithProgress extends VocabItem {
  progress: VocabProgress | null;
}

// ============================================
// SESSION STATE TYPES
// ============================================

/**
 * Session mode
 */
export type VocabSessionMode = 'learn' | 'test';

/**
 * Session state for learning/testing
 */
export interface VocabSessionState {
  // List info
  listId: string;
  listTitle: string;
  mode: VocabSessionMode;

  // Items in session
  items: VocabItemWithProgress[];
  totalItems: number;

  // Current progress
  currentIndex: number;
  currentItem: VocabItemWithProgress | null;

  // Stats
  correctAnswers: number;
  incorrectAnswers: number;
  sessionStartedAt: number;

  // UI state
  isFlipped: boolean; // Learn mode: show translation
  showResult: boolean; // Test mode: show if answer was correct
  lastAnswerCorrect: boolean | null;

  // Completion
  isComplete: boolean;
}

/**
 * Answer result
 */
export interface AnswerResult {
  isCorrect: boolean;
  correctAnswer: string;
  givenAnswer: string;
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

/**
 * Request to create a new vocab list
 */
export interface CreateVocabListRequest {
  subject: string;
  grade?: number;
  title: string;
  language_from: string;
  language_to: string;
}

/**
 * Request to add items to a list
 */
export interface AddVocabItemsRequest {
  list_id: string;
  items: {
    term: string;
    translation: string;
    example_sentence?: string;
    notes?: string;
  }[];
}

/**
 * Request to update progress
 */
export interface UpdateProgressRequest {
  item_id: string;
  is_correct: boolean;
}

/**
 * Due item with list info
 */
export interface DueVocabItem {
  item: VocabItem;
  progress: {
    mastery_level: number;
    last_seen_at: string | null;
    next_due_at: string | null;
    times_correct: number;
    times_incorrect: number;
  };
  list: VocabList | null;
}

// ============================================
// HELPER TYPES
// ============================================

/**
 * Mastery level labels
 */
export const MASTERY_LABELS: Record<number, string> = {
  0: 'Nieuw',
  1: 'Herkenning',
  2: 'Bekend',
  3: 'Goed',
  4: 'Uitstekend',
  5: 'Gemastered',
};

/**
 * Mastery level colors (Tailwind classes)
 */
export const MASTERY_COLORS: Record<number, string> = {
  0: 'bg-gray-200 text-gray-700',
  1: 'bg-red-100 text-red-700',
  2: 'bg-orange-100 text-orange-700',
  3: 'bg-yellow-100 text-yellow-700',
  4: 'bg-green-100 text-green-700',
  5: 'bg-emerald-100 text-emerald-700',
};

/**
 * Get mastery label
 */
export function getMasteryLabel(level: number): string {
  return MASTERY_LABELS[level] || 'Onbekend';
}

/**
 * Get mastery color class
 */
export function getMasteryColor(level: number): string {
  return MASTERY_COLORS[level] || 'bg-gray-100 text-gray-700';
}

/**
 * Format due date for display
 */
export function formatDueDate(nextDueAt: string | null): string {
  if (!nextDueAt) return 'Nog niet geoefend';

  const due = new Date(nextDueAt);
  const now = new Date();

  if (due <= now) return 'Nu';

  const diffMs = due.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `Over ${diffDays} dag${diffDays > 1 ? 'en' : ''}`;
  if (diffHours > 0) return `Over ${diffHours} uur`;
  return 'Binnenkort';
}
