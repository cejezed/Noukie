/**
 * Subject Game Configurations
 *
 * Configuration for each subject's gameified quiz experience.
 * Implemented: HAVO 5 subjects (Aardrijkskunde, Geschiedenis, Wiskunde, Duits, Engels)
 *
 * Each subject has its own theme, ranks, XP settings, and power-ups.
 * To add a new subject, add the key to SubjectKey type and add an entry here.
 */

import type { SubjectKey, SubjectGameConfig, SubjectGameConfigMap } from "@/types/game";

/**
 * Configuration map for all game-enabled subjects
 *
 * Each subject has its own:
 * - Theme (colors, icon)
 * - Rank progression system
 * - XP and power-up settings
 * - Time Rush mode configuration
 *
 * To add a new subject:
 * 1. Add the subject key to SubjectKey type in types/game.ts
 * 2. Add a config entry here with the same structure
 * 3. No code changes needed in game engine or components!
 */
export const SUBJECT_GAME_CONFIG: SubjectGameConfigMap = {
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

    // Time Rush settings
    timeRushSeconds: 12,          // 12 seconds per question in Time Rush mode
    timeRushLevels: [2],          // Level 2 is Time Rush (can add more: [2, 4])

    // Lives system
    livesPerLevel: 3,             // Start each level with 3 hearts

    // Starting power-ups inventory
    startingPowerups: {
      hint: 2,          // 2 hints available at start
      joker: 1,         // 1 joker (50/50) available
      extra_life: 1,    // 1 extra life available
    },
  },

  geschiedenis: {
    subject: "geschiedenis",
    displayName: "HAVO 5 Geschiedenis",

    // Theming (brown/sepia colors for history)
    primaryColor: "#8b4513",       // Saddle brown
    secondaryColor: "#f5e6d3",     // Papyrus/parchment
    icon: "📜",

    // Rank system (history-themed progression)
    rankLabels: [
      "Novice",           // 0-99 XP
      "Leerling",         // 100-299 XP
      "Kenner",           // 300-599 XP
      "Historicus",       // 600-999 XP
      "Tijdreiziger",     // 1000+ XP
    ],
    rankThresholds: [0, 100, 300, 600, 1000],

    // Game settings
    enableTimeRush: false,        // No Time Rush for history (more thoughtful)
    baseXpPerQuestion: 10,
    streakBonusMultiplier: 1.5,
    timeRushBonusXp: 0,

    // Time Rush settings (not used, but required)
    timeRushSeconds: 12,
    timeRushLevels: [],           // No Time Rush levels

    // Lives system
    livesPerLevel: 3,

    // Starting power-ups inventory
    startingPowerups: {
      hint: 2,
      joker: 1,
      extra_life: 1,
    },
  },

  wiskunde: {
    subject: "wiskunde",
    displayName: "HAVO 5 Wiskunde",

    // Theming (blue colors for math/logic)
    primaryColor: "#1a4b82",       // Dark blue
    secondaryColor: "#e1ecf7",     // Light blue
    icon: "➗",

    // Rank system (math-themed progression)
    rankLabels: [
      "Beginner",         // 0-99 XP
      "Rekenaar",         // 100-299 XP
      "Analist",          // 300-599 XP
      "Problem Solver",   // 600-999 XP
      "Math Master",      // 1000+ XP
    ],
    rankThresholds: [0, 100, 300, 600, 1000],

    // Game settings
    enableTimeRush: true,         // Time Rush for speed calculations
    baseXpPerQuestion: 10,
    streakBonusMultiplier: 1.5,
    timeRushBonusXp: 5,

    // Time Rush settings
    timeRushSeconds: 12,
    timeRushLevels: [2],          // Level 2 is Time Rush

    // Lives system
    livesPerLevel: 3,

    // Starting power-ups inventory (more jokers for math)
    startingPowerups: {
      hint: 1,          // Fewer hints (math is about solving)
      joker: 2,         // More jokers (eliminate wrong formulas)
      extra_life: 1,
    },
  },

  duits: {
    subject: "duits",
    displayName: "HAVO 5 Duits",

    // Theming (red/white colors for Germany)
    primaryColor: "#b22222",       // Firebrick red
    secondaryColor: "#fde2e1",     // Light red/pink
    icon: "🇩🇪",

    // Rank system (language proficiency levels)
    rankLabels: [
      "A1",               // 0-99 XP
      "A2",               // 100-299 XP
      "B1",               // 300-599 XP
      "B2",               // 600-999 XP
      "C1",               // 1000+ XP
    ],
    rankThresholds: [0, 100, 300, 600, 1000],

    // Game settings
    enableTimeRush: false,        // No Time Rush for language (need time to think)
    baseXpPerQuestion: 10,
    streakBonusMultiplier: 1.5,
    timeRushBonusXp: 0,

    // Time Rush settings (not used, but required)
    timeRushSeconds: 12,
    timeRushLevels: [],           // No Time Rush levels

    // Lives system
    livesPerLevel: 3,

    // Starting power-ups inventory (more hints for vocabulary)
    startingPowerups: {
      hint: 3,          // More hints (helpful for vocabulary)
      joker: 1,
      extra_life: 0,    // No extra life (language is about learning)
    },
  },

  engels: {
    subject: "engels",
    displayName: "HAVO 5 Engels",

    // Theming (blue/red colors for UK)
    primaryColor: "#004080",       // Royal blue
    secondaryColor: "#e0f0ff",     // Light blue
    icon: "🇬🇧",

    // Rank system (language proficiency levels)
    rankLabels: [
      "A1",               // 0-99 XP
      "A2",               // 100-299 XP
      "B1",               // 300-599 XP
      "B2",               // 600-999 XP
      "C1",               // 1000+ XP
    ],
    rankThresholds: [0, 100, 300, 600, 1000],

    // Game settings
    enableTimeRush: true,         // Time Rush for quick vocab/grammar
    baseXpPerQuestion: 10,
    streakBonusMultiplier: 1.5,
    timeRushBonusXp: 5,

    // Time Rush settings
    timeRushSeconds: 12,
    timeRushLevels: [2],          // Level 2 is Time Rush

    // Lives system
    livesPerLevel: 3,

    // Starting power-ups inventory
    startingPowerups: {
      hint: 2,
      joker: 1,
      extra_life: 1,
    },
  },
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

/**
 * Compute complete rank information for a subject
 *
 * @param subjectXp - User's current XP for this subject
 * @param config - Subject configuration
 * @returns Complete rank info including progress to next rank
 */
export function computeRank(
  subjectXp: number,
  config: SubjectGameConfig
): import("@/types/game").RankInfo {
  const { rankLabels, rankThresholds } = config;

  // Find current rank index
  let rankIndex = 0;
  for (let i = rankThresholds.length - 1; i >= 0; i--) {
    if (subjectXp >= rankThresholds[i]) {
      rankIndex = i;
      break;
    }
  }

  const rankLabel = rankLabels[rankIndex] || rankLabels[0];
  const currentThreshold = rankThresholds[rankIndex];
  const nextRankXp = rankIndex < rankThresholds.length - 1 ? rankThresholds[rankIndex + 1] : null;

  let xpToNextRank: number | null = null;
  let progressPercent = 0;

  if (nextRankXp !== null) {
    xpToNextRank = nextRankXp - subjectXp;
    const xpInCurrentRank = subjectXp - currentThreshold;
    const xpNeededForRank = nextRankXp - currentThreshold;
    progressPercent = Math.min(100, Math.round((xpInCurrentRank / xpNeededForRank) * 100));
  } else {
    // Max rank reached
    progressPercent = 100;
  }

  return {
    rankLabel,
    rankIndex,
    currentXp: subjectXp,
    nextRankXp,
    xpToNextRank,
    progressPercent,
  };
}
