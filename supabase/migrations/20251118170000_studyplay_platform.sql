-- StudyPlay Game Platform Migration
-- Creates tables for: playtime system, XP/profile system, scores/leaderboards

-- ============================================================================
-- 1. PLAYTIME SYSTEM (Focus → Fun)
-- ============================================================================

-- Study Playtime Balance Table
-- Tracks how many minutes each user has available to play games
CREATE TABLE IF NOT EXISTS "study_playtime" (
  "user_id" uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "balance_minutes" integer NOT NULL DEFAULT 0 CHECK (balance_minutes >= 0),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- Study Playtime Log Table
-- Records all playtime transactions (earned and spent)
CREATE TABLE IF NOT EXISTS "study_playtime_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "delta" integer NOT NULL, -- positive = earned, negative = spent
  "reason" text NOT NULL, -- 'quiz_completed', 'mental_checkin', 'game_session', etc.
  "meta" jsonb, -- optional metadata (quiz_id, game_id, etc.)
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 2. GLOBAL XP + LEVEL SYSTEM
-- ============================================================================

-- Study Profile Table
-- Tracks global progression for each user across all study activities
CREATE TABLE IF NOT EXISTS "study_profile" (
  "user_id" uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "xp_total" integer NOT NULL DEFAULT 0 CHECK (xp_total >= 0),
  "level" integer NOT NULL DEFAULT 1 CHECK (level >= 1),
  "games_played" integer NOT NULL DEFAULT 0 CHECK (games_played >= 0),
  "tests_completed" integer NOT NULL DEFAULT 0 CHECK (tests_completed >= 0),
  "streak_days" integer NOT NULL DEFAULT 0 CHECK (streak_days >= 0),
  "last_activity_date" date,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- Study XP Log Table (optional but recommended for audit trail)
CREATE TABLE IF NOT EXISTS "study_xp_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "delta" integer NOT NULL, -- XP change
  "reason" text NOT NULL, -- 'quiz_completed', 'game_session', 'mental_checkin', etc.
  "meta" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 3. SCORES & LEADERBOARDS
-- ============================================================================

-- Study Scores Table
-- Records all game/quiz scores for leaderboards
CREATE TABLE IF NOT EXISTS "study_scores" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "game_id" text NOT NULL, -- 'snake', 'brickwall', 'flappy', '2048', 'geo_quiz', etc.
  "score" integer NOT NULL CHECK (score >= 0),
  "level_reached" integer,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Playtime indexes
CREATE INDEX IF NOT EXISTS "study_playtime_log_user_id_idx" ON "study_playtime_log"("user_id");
CREATE INDEX IF NOT EXISTS "study_playtime_log_created_at_idx" ON "study_playtime_log"("created_at");
CREATE INDEX IF NOT EXISTS "study_playtime_log_reason_idx" ON "study_playtime_log"("reason");

-- XP log indexes
CREATE INDEX IF NOT EXISTS "study_xp_log_user_id_idx" ON "study_xp_log"("user_id");
CREATE INDEX IF NOT EXISTS "study_xp_log_created_at_idx" ON "study_xp_log"("created_at");

-- Scores indexes
CREATE INDEX IF NOT EXISTS "study_scores_user_id_idx" ON "study_scores"("user_id");
CREATE INDEX IF NOT EXISTS "study_scores_game_id_idx" ON "study_scores"("game_id");
CREATE INDEX IF NOT EXISTS "study_scores_game_score_idx" ON "study_scores"("game_id", "score" DESC);
CREATE INDEX IF NOT EXISTS "study_scores_created_at_idx" ON "study_scores"("created_at");

-- Profile indexes
CREATE INDEX IF NOT EXISTS "study_profile_level_idx" ON "study_profile"("level" DESC);
CREATE INDEX IF NOT EXISTS "study_profile_xp_idx" ON "study_profile"("xp_total" DESC);

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE "study_playtime" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "study_playtime_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "study_profile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "study_xp_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "study_scores" ENABLE ROW LEVEL SECURITY;

-- Study Playtime Policies
-- Users can read their own playtime balance
CREATE POLICY "Users can read own playtime" ON "study_playtime"
AS PERMISSIVE FOR SELECT TO public
USING (auth.uid() = user_id);

-- Users can read their own playtime log
CREATE POLICY "Users can read own playtime log" ON "study_playtime_log"
AS PERMISSIVE FOR SELECT TO public
USING (auth.uid() = user_id);

-- Parents can read confirmed children's playtime
CREATE POLICY "Parents can read children playtime" ON "study_playtime"
AS PERMISSIVE FOR SELECT TO public
USING (
  EXISTS (
    SELECT 1 FROM "parent_child_relationships" pcr
    WHERE pcr.parent_id = auth.uid()
      AND pcr.child_id = user_id
      AND pcr.status = 'confirmed'
  )
);

-- Parents can read confirmed children's playtime log
CREATE POLICY "Parents can read children playtime log" ON "study_playtime_log"
AS PERMISSIVE FOR SELECT TO public
USING (
  EXISTS (
    SELECT 1 FROM "parent_child_relationships" pcr
    WHERE pcr.parent_id = auth.uid()
      AND pcr.child_id = user_id
      AND pcr.status = 'confirmed'
  )
);

-- Study Profile Policies
-- Users can read their own profile
CREATE POLICY "Users can read own profile" ON "study_profile"
AS PERMISSIVE FOR SELECT TO public
USING (auth.uid() = user_id);

-- Users can read their own XP log
CREATE POLICY "Users can read own xp log" ON "study_xp_log"
AS PERMISSIVE FOR SELECT TO public
USING (auth.uid() = user_id);

-- Parents can read confirmed children's profile
CREATE POLICY "Parents can read children profile" ON "study_profile"
AS PERMISSIVE FOR SELECT TO public
USING (
  EXISTS (
    SELECT 1 FROM "parent_child_relationships" pcr
    WHERE pcr.parent_id = auth.uid()
      AND pcr.child_id = user_id
      AND pcr.status = 'confirmed'
  )
);

-- Study Scores Policies
-- Users can read their own scores
CREATE POLICY "Users can read own scores" ON "study_scores"
AS PERMISSIVE FOR SELECT TO public
USING (auth.uid() = user_id);

-- Users can read all scores for leaderboards (public data)
-- Note: We'll anonymize display names in the API layer
CREATE POLICY "Public can read all scores for leaderboards" ON "study_scores"
AS PERMISSIVE FOR SELECT TO public
USING (true);

-- Parents can read confirmed children's scores
CREATE POLICY "Parents can read children scores" ON "study_scores"
AS PERMISSIVE FOR SELECT TO public
USING (
  EXISTS (
    SELECT 1 FROM "parent_child_relationships" pcr
    WHERE pcr.parent_id = auth.uid()
      AND pcr.child_id = user_id
      AND pcr.status = 'confirmed'
  )
);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to calculate level from XP
-- Level formula: floor(sqrt(xp_total / 10)) with minimum 1
CREATE OR REPLACE FUNCTION calculate_level_from_xp(xp integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT GREATEST(1, FLOOR(SQRT(xp / 10.0))::integer);
$$;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_study_playtime_updated_at
  BEFORE UPDATE ON "study_playtime"
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_study_profile_updated_at
  BEFORE UPDATE ON "study_profile"
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE "study_playtime" IS 'Tracks available game playtime minutes for each user (Focus → Fun system)';
COMMENT ON TABLE "study_playtime_log" IS 'Audit log of all playtime transactions (earned and spent)';
COMMENT ON TABLE "study_profile" IS 'Global user progression profile with XP, level, and statistics';
COMMENT ON TABLE "study_xp_log" IS 'Audit log of all XP transactions';
COMMENT ON TABLE "study_scores" IS 'All game and quiz scores for leaderboards and personal records';

COMMENT ON COLUMN "study_playtime_log"."delta" IS 'Positive = minutes earned, negative = minutes spent';
COMMENT ON COLUMN "study_playtime_log"."reason" IS 'Source of transaction: quiz_completed, mental_checkin, game_session, etc.';
COMMENT ON COLUMN "study_profile"."level" IS 'Calculated from xp_total using formula: floor(sqrt(xp_total / 10))';
COMMENT ON COLUMN "study_scores"."game_id" IS 'Game identifier: snake, brickwall, flappy, 2048, geo_quiz, etc.';
