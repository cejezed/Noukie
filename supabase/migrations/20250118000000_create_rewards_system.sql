-- =====================================================
-- Study Rewards System Migration
-- Event-based reward tracking for vocab, quiz, and game activities
-- =====================================================

-- =====================================================
-- 1. study_reward_events - Event log for all reward activities
-- =====================================================

CREATE TABLE IF NOT EXISTS public.study_reward_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  source TEXT NOT NULL, -- 'vocab', 'quiz', 'game'
  event_type TEXT NOT NULL, -- 'vocab_correct', 'vocab_mastered', 'session_accuracy_bonus', 'spend', etc.
  points INTEGER NOT NULL, -- can be negative for spending
  metadata JSONB, -- optional extra info (list_id, item_id, quiz_id, accuracy, etc.)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Optional: add constraint to prevent future dates
  CONSTRAINT valid_created_at CHECK (created_at <= now())
);

-- Indexes for performance
CREATE INDEX idx_reward_events_user ON public.study_reward_events(user_id);
CREATE INDEX idx_reward_events_user_created ON public.study_reward_events(user_id, created_at DESC);
CREATE INDEX idx_reward_events_source ON public.study_reward_events(source);

-- RLS Policies
ALTER TABLE public.study_reward_events ENABLE ROW LEVEL SECURITY;

-- Users can only view their own reward events
CREATE POLICY "Users can view own reward events"
  ON public.study_reward_events
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own reward events (via API only)
CREATE POLICY "Users can insert own reward events"
  ON public.study_reward_events
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- No update or delete (events are immutable audit log)
-- If needed, admin can manually fix via service role

-- =====================================================
-- 2. Helper function: Get user's current reward balance
-- =====================================================

CREATE OR REPLACE FUNCTION get_user_reward_balance(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN COALESCE(
    (SELECT SUM(points) FROM public.study_reward_events WHERE user_id = p_user_id),
    0
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- 3. Helper function: Check if user has compliment today
-- =====================================================

CREATE OR REPLACE FUNCTION has_compliment_today(p_user_id UUID, p_compliment_type TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.compliments
    WHERE user_id = p_user_id
    AND metadata->>'type' = p_compliment_type
    AND created_at >= CURRENT_DATE
    AND created_at < CURRENT_DATE + INTERVAL '1 day'
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- Comments for documentation
-- =====================================================

COMMENT ON TABLE public.study_reward_events IS 'Event log for study rewards system - tracks points earned and spent';
COMMENT ON COLUMN public.study_reward_events.source IS 'Origin of event: vocab, quiz, game';
COMMENT ON COLUMN public.study_reward_events.event_type IS 'Type of event: vocab_correct, vocab_mastered, session_accuracy_bonus, spend, etc.';
COMMENT ON COLUMN public.study_reward_events.points IS 'Points earned (positive) or spent (negative)';
COMMENT ON COLUMN public.study_reward_events.metadata IS 'Optional JSON metadata: list_id, item_id, quiz_id, accuracy, reason, etc.';
COMMENT ON FUNCTION get_user_reward_balance IS 'Calculate total reward balance for a user';
COMMENT ON FUNCTION has_compliment_today IS 'Check if user already received a specific compliment type today';

-- =====================================================
-- 4. Sample data for testing (optional - remove in production)
-- =====================================================

-- Uncomment to add test data:
-- INSERT INTO public.study_reward_events (user_id, source, event_type, points, metadata)
-- VALUES
--   ('test-user-id'::uuid, 'vocab', 'vocab_correct', 1, '{"list_id": "abc", "item_id": "xyz"}'),
--   ('test-user-id'::uuid, 'vocab', 'vocab_mastered', 5, '{"list_id": "abc", "item_id": "xyz", "new_level": 3}');
