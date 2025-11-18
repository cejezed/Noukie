/**
 * Rewards System Type Definitions
 *
 * Types for study rewards system (vocab, quiz, game)
 */

// ============================================
// DATABASE ENTITY TYPES
// ============================================

/**
 * Reward event from database
 */
export interface RewardEvent {
  id: string;
  user_id: string;
  source: 'vocab' | 'quiz' | 'game';
  event_type: string; // 'vocab_correct', 'vocab_mastered', 'session_accuracy_bonus', 'spend', etc.
  points: number; // can be negative for spending
  metadata: Record<string, any> | null;
  created_at: string;
}

/**
 * Reward balance response
 */
export interface RewardBalance {
  balance: number;
  user_id: string;
}

/**
 * Reward events list response
 */
export interface RewardEventsResponse {
  events: RewardEvent[];
  count: number;
  limit: number;
  offset: number;
}

/**
 * Spend request
 */
export interface SpendRewardRequest {
  points: number;
  reason: string;
}

/**
 * Spend response
 */
export interface SpendRewardResponse {
  success: boolean;
  event: RewardEvent;
  previous_balance: number;
  spent: number;
  new_balance: number;
}

// ============================================
// UI HELPER TYPES
// ============================================

/**
 * Event type display config
 */
export interface EventTypeConfig {
  label: string;
  icon: string;
  color: string;
}

/**
 * Event type configurations
 */
export const EVENT_TYPE_CONFIG: Record<string, EventTypeConfig> = {
  vocab_correct: {
    label: 'Correct antwoord',
    icon: '✓',
    color: 'text-green-600',
  },
  vocab_mastered: {
    label: 'Woord gemastered',
    icon: '🎯',
    color: 'text-purple-600',
  },
  session_accuracy_bonus: {
    label: 'Accuracy bonus',
    icon: '⭐',
    color: 'text-yellow-600',
  },
  quiz_completed: {
    label: 'Quiz voltooid',
    icon: '📝',
    color: 'text-blue-600',
  },
  quiz_perfect: {
    label: 'Perfect score',
    icon: '💯',
    color: 'text-purple-600',
  },
  spend: {
    label: 'Punten gebruikt',
    icon: '🎮',
    color: 'text-red-600',
  },
};

/**
 * Get event type config
 */
export function getEventTypeConfig(eventType: string): EventTypeConfig {
  return (
    EVENT_TYPE_CONFIG[eventType] || {
      label: eventType,
      icon: '•',
      color: 'text-gray-600',
    }
  );
}

/**
 * Format event description
 */
export function formatEventDescription(event: RewardEvent): string {
  const config = getEventTypeConfig(event.event_type);

  if (event.event_type === 'spend' && event.metadata?.reason) {
    return `${config.label}: ${event.metadata.reason}`;
  }

  if (event.event_type === 'vocab_mastered' && event.metadata?.mastered_level) {
    return `${config.label} (level ${event.metadata.mastered_level})`;
  }

  if (event.event_type === 'session_accuracy_bonus' && event.metadata?.accuracy) {
    return `${config.label} (${event.metadata.accuracy}%)`;
  }

  return config.label;
}

/**
 * Format points display
 */
export function formatPoints(points: number): string {
  if (points > 0) {
    return `+${points}`;
  }
  return `${points}`;
}

/**
 * Format timestamp for display
 */
export function formatEventDate(created_at: string): string {
  const date = new Date(created_at);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Zojuist';
  if (diffMins < 60) return `${diffMins} min geleden`;
  if (diffHours < 24) return `${diffHours} uur geleden`;
  if (diffDays < 7) return `${diffDays} dag${diffDays > 1 ? 'en' : ''} geleden`;

  return date.toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'short',
  });
}
