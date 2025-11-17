/**
 * Subject Game Configurations
 *
 * Configuration for each subject's gameified quiz experience.
 * Currently implemented: HAVO 5 Aardrijkskunde
 *
 * TODO: Add other subjects (geschiedenis, wiskunde, duits, engels, etc.)
 * by adding entries to SUBJECT_GAME_CONFIG with the same structure.
 */

import type { SubjectKey, SubjectGameConfig } from "@/types/game";

/**
 * Configuration map for all game-enabled subjects
 *
 * To add a new subject:
 * 1. Add the subject key to SubjectKey type in types/game.ts
 * 2. Add a config entry here with the same structure
 * 3. No code changes needed in game engine or components!
 */
export const SUBJECT_GAME_CONFIG: Record<SubjectKey, SubjectGameConfig> = {
  aardrijkskunde: {
    subject: "aardrijkskunde",
    displayName: "HAVO 5 Aardrijkskunde",

    // Theming (teal/water colors for geography)
    primaryColor: "#1b7f8c",       // Teal
    secondaryColor: "#e0f4f7",     // Light cyan
    icon: "🌍",

    // Rank system (geography-themed progression)
    rankLabels: [
      "Local",              // 0-99 XP
      "Regionaal",          // 100-299 XP
      "Nationaal",          // 300-599 XP
      "Europees",           // 600-999 XP
      "Mondiaal Expert",    // 1000+ XP
    ],
    rankThresholds: [0, 100, 300, 600, 1000],

    // Game settings
    enableTimeRush: true,         // Enable Time Rush rounds for quick-fire questions
    baseXpPerQuestion: 10,        // Base XP for correct answer
    streakBonusMultiplier: 1.5,   // XP multiplier when streak >= 3
    timeRushBonusXp: 5,           // Extra XP for answering within time limit

    // Lives system
    livesPerLevel: 3,             // Start each level with 3 hearts

    // Starting power-ups inventory
    startingPowerups: {
      hint: 2,          // 2 hints available at start
      joker: 1,         // 1 joker (50/50) available
      extra_life: 1,    // 1 extra life available
    },
  },

  // TODO: Add more subjects here following the same pattern
  // Example for geschiedenis (commented out until implemented):
  /*
  geschiedenis: {
    subject: "geschiedenis",
    displayName: "HAVO 5 Geschiedenis",
    primaryColor: "#8b4513",
    secondaryColor: "#f5e6d3",
    icon: "📜",
    rankLabels: ["Novice", "Leerling", "Scholar", "Historicus", "Tijdreiziger"],
    rankThresholds: [0, 100, 300, 600, 1000],
    enableTimeRush: false,
    baseXpPerQuestion: 10,
    streakBonusMultiplier: 1.5,
    timeRushBonusXp: 0,
    livesPerLevel: 3,
    startingPowerups: { hint: 2, joker: 1, extra_life: 1 },
  },
  */
};

/**
 * Get config for a specific subject
 * Returns undefined if subject is not game-enabled
 */
export function getSubjectConfig(subject: string): SubjectGameConfig | undefined {
  return SUBJECT_GAME_CONFIG[subject as SubjectKey];
}

/**
 * Check if a subject has game mode available
 */
export function isGameEnabled(subject: string): subject is SubjectKey {
  return subject in SUBJECT_GAME_CONFIG;
}

/**
 * Get current rank based on XP
 */
export function getRankForXP(xp: number, config: SubjectGameConfig): string {
  const { rankLabels, rankThresholds } = config;

  for (let i = rankThresholds.length - 1; i >= 0; i--) {
    if (xp >= rankThresholds[i]) {
      return rankLabels[i] || rankLabels[0];
    }
  }

  return rankLabels[0];
}

/**
 * Get XP needed for next rank
 * Returns null if already at max rank
 */
export function getXPForNextRank(xp: number, config: SubjectGameConfig): number | null {
  const { rankThresholds } = config;

  for (let i = 0; i < rankThresholds.length; i++) {
    if (xp < rankThresholds[i]) {
      return rankThresholds[i];
    }
  }

  return null; // Already at max rank
}

/**
 * Calculate XP reward for a correct answer
 */
export function calculateXP(params: {
  baseXP: number;
  streak: number;
  streakMultiplier: number;
  isTimeRush?: boolean;
  timeRushBonus?: number;
  answeredQuickly?: boolean;
}): number {
  let xp = params.baseXP;

  // Streak bonus (applies at 3+ streak)
  if (params.streak >= 3) {
    xp = Math.floor(xp * params.streakMultiplier);
  }

  // Time Rush bonus
  if (params.isTimeRush && params.answeredQuickly && params.timeRushBonus) {
    xp += params.timeRushBonus;
  }

  return xp;
}
