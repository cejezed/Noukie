/**
 * Game Layer Type Definitions
 *
 * For gameified quiz experience across multiple HAVO 5 subjects
 * Config-driven architecture allows easy addition of new subjects
 */

// ============================================
// SUBJECT & CONFIG TYPES
// ============================================

/**
 * Supported subjects for game mode
 * Each subject has its own config in SUBJECT_GAME_CONFIG
 */
export type SubjectKey =
  | "aardrijkskunde"
  | "geschiedenis"
  | "wiskunde"
  | "duits"
  | "engels";

/**
 * Power-up types available in game mode
 */
export type PowerUpType = "hint" | "joker" | "extra_life";

/**
 * Game mode variants
 */
export type GameMode = "normal" | "timeRush";

/**
 * Configuration for a subject's game experience
 */
export interface SubjectGameConfig {
  subject: SubjectKey;
  displayName: string;

  // Theming
  primaryColor: string;
  secondaryColor: string;
  icon: string;

  // Rank system
  rankLabels: string[];        // ["Local", "Regionaal", "Nationaal", "Europees", "Mondiaal Expert"]
  rankThresholds: number[];    // XP thresholds for each rank [0, 100, 300, 600, 1000]

  // Game settings
  enableTimeRush: boolean;
  baseXpPerQuestion: number;
  streakBonusMultiplier: number;  // XP multiplier at 3+ streak
  timeRushBonusXp: number;        // Extra XP for fast answers in Time Rush mode

  // Time Rush settings
  timeRushSeconds: number;      // Seconds per question in Time Rush mode
  timeRushLevels: number[];     // Which level numbers are Time Rush (e.g., [2, 4])

  // Lives
  livesPerLevel: number;

  // Power-ups (starting inventory)
  startingPowerups: {
    hint: number;
    joker: number;
    extra_life: number;
  };
}

/**
 * Map of all subject configs
 * Used by SUBJECT_GAME_CONFIG
 */
export type SubjectGameConfigMap = Record<SubjectKey, SubjectGameConfig>;

// ============================================
// QUIZ TYPES (from existing system)
// ============================================

/**
 * Quiz item from existing quiz system
 * Matches the response from /api/quizzes/questions
 */
export interface QuizItem {
  id: string;
  quiz_id: string;
  qtype: "mc" | "open";
  prompt: string;
  choices?: string | string[] | null;  // Can be JSON string or array
  answer?: string | null;
  explanation?: string | null;
}

// ============================================
// GAME STATE TYPES
// ============================================

/**
 * Power-ups inventory during game session
 */
export interface PowerUpsInventory {
  hint: number;
  joker: number;
  extra_life: number;
}

/**
 * Active power-up effects
 */
export interface ActivePowerUp {
  type: PowerUpType;
  appliedAt: number;  // Timestamp when applied
}

/**
 * Score tracking
 */
export interface GameScore {
  correct: number;
  total: number;
  percentage: number;
}

/**
 * Main game state object
 * Managed by useGameQuizEngine hook
 */
export interface GameState {
  // Subject
  subject: SubjectKey;            // Which subject this game is for

  // Level system
  currentLevel: number;           // 1-based (Level 1, 2, 3...)
  totalLevels: number;
  questionsPerLevel: number;      // Usually 3-5

  // Question navigation
  currentQuestionIndex: number;   // Within current level (0-based)
  questionsInLevel: QuizItem[];   // Questions for current level
  allLevels: QuizItem[][];        // All levels (array of question arrays)

  // Game mechanics
  xp: number;                     // Total XP this session
  lives: number;                  // Remaining lives (reset per level)
  maxLives: number;               // Max lives per level
  streak: number;                 // Current streak (reset on wrong answer)
  bestStreak: number;             // Best streak this session

  // Power-ups
  powerUps: PowerUpsInventory;
  activePowerUps: ActivePowerUp[];

  // Power-up effects on current question
  weakenedOptionIndexes: number[];  // Hint: which options are grayed out
  hiddenOptionIndexes: number[];    // Joker: which options are hidden

  // Special modes
  mode: GameMode;
  isTimeRushMode: boolean;          // Is current level in Time Rush mode
  timeRushTimer: number | null;     // Seconds remaining (null = no timer)
  questionStartedAt: number | null; // Timestamp when current question started (for Time Rush)

  // Progress
  completedLevels: number[];      // Level numbers that are completed
  score: GameScore;

  // Session tracking
  sessionStartedAt: number;       // Timestamp
  currentLevelStartedAt: number;  // Timestamp
}

/**
 * Stats after completing a level
 */
export interface LevelCompletionStats {
  level: number;
  questionsAnswered: number;
  correctAnswers: number;
  xpEarned: number;
  streakAchieved: number;
  livesRemaining: number;
  powerUpsUsed: Partial<PowerUpsInventory>;
}

/**
 * Stats after completing entire quiz/game session
 */
export interface GameSessionStats {
  quizId: string;
  subject: SubjectKey;

  totalQuestions: number;
  correctAnswers: number;
  totalXpEarned: number;
  bestStreak: number;
  levelsCompleted: number;

  powerUpsUsed: Partial<PowerUpsInventory>;

  completedAt: number;  // Timestamp
  duration: number;     // Seconds

  // For summary screen
  scorePercentage: number;
  previousRank?: string;
  newRank?: string;
  earnedCards?: string[];  // Geo card IDs (optional feature)
}

// ============================================
// DATABASE TYPES (matches SQL schema)
// ============================================

/**
 * user_game_profiles table
 */
export interface UserGameProfile {
  id: string;
  user_id: string;
  total_xp: number;
  current_streak: number;
  best_streak: number;
  last_played_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * user_subject_stats table
 */
export interface UserSubjectStats {
  id: string;
  user_id: string;
  subject: SubjectKey;
  subject_xp: number;
  subject_rank: string;
  levels_completed: number;
  best_score: number;
  created_at: string;
  updated_at: string;
}

/**
 * user_powerups table
 */
export interface UserPowerUp {
  id: string;
  user_id: string;
  subject: SubjectKey | null;
  powerup_type: PowerUpType;
  amount: number;
  created_at: string;
  updated_at: string;
}

/**
 * game_sessions table
 */
export interface GameSessionRecord {
  id: string;
  user_id: string;
  quiz_id: string;
  subject: SubjectKey;
  total_questions: number;
  correct_answers: number;
  xp_earned: number;
  best_streak: number;
  levels_completed: number;
  powerups_used: Record<string, number>;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
}

/**
 * user_geo_cards table (optional collectibles)
 */
export interface UserGeoCard {
  id: string;
  user_id: string;
  card_id: string;
  card_category: string | null;
  obtained_at: string;
}

// ============================================
// API TYPES
// ============================================

/**
 * Request to save game session
 */
export interface SaveGameSessionRequest {
  quiz_id: string;
  subject: SubjectKey;
  total_questions: number;
  correct_answers: number;
  xp_earned: number;
  best_streak: number;
  levels_completed: number;
  duration: number;  // in seconds
  score_percentage: number;
}

/**
 * Response after saving game session
 */
export interface SaveGameSessionResponse {
  session: GameSessionRecord;
  updatedProfile: UserGameProfile;
  updatedSubjectStats: UserSubjectStats;
  rankInfo: RankInfo;
}

/**
 * Request to get user's game profile
 */
export interface GetGameProfileRequest {
  subject?: SubjectKey;  // Optional: filter by subject
}

/**
 * Response with user's current game profile
 */
export interface GetGameProfileResponse {
  profile: UserGameProfile;
  subjectStats: UserSubjectStats[];
  rankInfo?: RankInfo;  // For specific subject if requested
}

/**
 * Request to update power-ups
 */
export interface UpdatePowerUpsRequest {
  subject: SubjectKey;
  powerup_type: PowerUpType;
  delta: number;  // +1 to add, -1 to use
}

/**
 * Response with user's current game progress (legacy, for backwards compat)
 */
export interface UserGameProgress {
  profile: UserGameProfile;
  subjectStats: UserSubjectStats[];
  powerUps: UserPowerUp[];
}

// ============================================
// RANK TYPES
// ============================================

/**
 * Computed rank information
 */
export interface RankInfo {
  rankLabel: string;      // "Regionaal", "Nationaal", etc.
  rankIndex: number;      // 0-based index in rankLabels array
  currentXp: number;      // User's current XP for this subject
  nextRankXp: number | null;  // XP needed for next rank (null = max rank)
  xpToNextRank: number | null;  // XP remaining to next rank
  progressPercent: number;  // % progress to next rank (0-100)
}
