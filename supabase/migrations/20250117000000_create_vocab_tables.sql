-- =====================================================
-- WRTS-achtige Woordentrainer Feature
-- Tabellen voor woordenlijsten, items en voortgang
-- =====================================================

-- =====================================================
-- 1. vocab_lists - Metadata per woordenlijst
-- =====================================================

CREATE TABLE IF NOT EXISTS public.vocab_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  subject TEXT NOT NULL,
  grade INTEGER,
  title TEXT NOT NULL,
  language_from TEXT NOT NULL,
  language_to TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Prevent duplicate lists for same owner
  CONSTRAINT unique_user_list UNIQUE (owner_id, subject, grade, title)
);

-- Index for fast lookups
CREATE INDEX idx_vocab_lists_owner ON public.vocab_lists(owner_id);
CREATE INDEX idx_vocab_lists_subject ON public.vocab_lists(subject);

-- RLS Policies
ALTER TABLE public.vocab_lists ENABLE ROW LEVEL SECURITY;

-- Users can view their own lists
CREATE POLICY "Users can view own vocab lists"
  ON public.vocab_lists
  FOR SELECT
  USING (auth.uid() = owner_id);

-- Users can create their own lists
CREATE POLICY "Users can create own vocab lists"
  ON public.vocab_lists
  FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- Users can update their own lists
CREATE POLICY "Users can update own vocab lists"
  ON public.vocab_lists
  FOR UPDATE
  USING (auth.uid() = owner_id);

-- Users can delete their own lists
CREATE POLICY "Users can delete own vocab lists"
  ON public.vocab_lists
  FOR DELETE
  USING (auth.uid() = owner_id);

-- =====================================================
-- 2. vocab_items - Individual words/terms in a list
-- =====================================================

CREATE TABLE IF NOT EXISTS public.vocab_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES public.vocab_lists(id) ON DELETE CASCADE,
  term TEXT NOT NULL,
  translation TEXT NOT NULL,
  example_sentence TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Prevent exact duplicates in same list
  CONSTRAINT unique_term_in_list UNIQUE (list_id, term)
);

-- Index for fast lookups by list
CREATE INDEX idx_vocab_items_list ON public.vocab_items(list_id);

-- RLS Policies
ALTER TABLE public.vocab_items ENABLE ROW LEVEL SECURITY;

-- Users can view items from their own lists
CREATE POLICY "Users can view vocab items from own lists"
  ON public.vocab_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.vocab_lists
      WHERE vocab_lists.id = vocab_items.list_id
      AND vocab_lists.owner_id = auth.uid()
    )
  );

-- Users can insert items into their own lists
CREATE POLICY "Users can insert vocab items into own lists"
  ON public.vocab_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.vocab_lists
      WHERE vocab_lists.id = vocab_items.list_id
      AND vocab_lists.owner_id = auth.uid()
    )
  );

-- Users can update items in their own lists
CREATE POLICY "Users can update vocab items in own lists"
  ON public.vocab_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.vocab_lists
      WHERE vocab_lists.id = vocab_items.list_id
      AND vocab_lists.owner_id = auth.uid()
    )
  );

-- Users can delete items from their own lists
CREATE POLICY "Users can delete vocab items from own lists"
  ON public.vocab_items
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.vocab_lists
      WHERE vocab_lists.id = vocab_items.list_id
      AND vocab_lists.owner_id = auth.uid()
    )
  );

-- =====================================================
-- 3. vocab_progress - User progress per item (spaced repetition)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.vocab_progress (
  user_id UUID NOT NULL,
  item_id UUID NOT NULL REFERENCES public.vocab_items(id) ON DELETE CASCADE,
  mastery_level INTEGER NOT NULL DEFAULT 0 CHECK (mastery_level >= 0 AND mastery_level <= 5),
  last_seen_at TIMESTAMPTZ,
  next_due_at TIMESTAMPTZ,
  times_correct INTEGER NOT NULL DEFAULT 0,
  times_incorrect INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (user_id, item_id)
);

-- Index for "due today" queries
CREATE INDEX idx_vocab_progress_user_due ON public.vocab_progress(user_id, next_due_at);
CREATE INDEX idx_vocab_progress_item ON public.vocab_progress(item_id);

-- RLS Policies
ALTER TABLE public.vocab_progress ENABLE ROW LEVEL SECURITY;

-- Users can only view their own progress
CREATE POLICY "Users can view own vocab progress"
  ON public.vocab_progress
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own progress
CREATE POLICY "Users can insert own vocab progress"
  ON public.vocab_progress
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own progress
CREATE POLICY "Users can update own vocab progress"
  ON public.vocab_progress
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own progress
CREATE POLICY "Users can delete own vocab progress"
  ON public.vocab_progress
  FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- Helper function: Calculate next due date based on mastery
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_next_due_date(mastery INT)
RETURNS TIMESTAMPTZ AS $$
BEGIN
  RETURN CASE mastery
    WHEN 0 THEN now() + INTERVAL '1 hour'
    WHEN 1 THEN now() + INTERVAL '12 hours'
    WHEN 2 THEN now() + INTERVAL '1 day'
    WHEN 3 THEN now() + INTERVAL '3 days'
    WHEN 4 THEN now() + INTERVAL '7 days'
    WHEN 5 THEN now() + INTERVAL '14 days'
    ELSE now() + INTERVAL '1 hour'
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- Trigger: Auto-update updated_at on vocab_lists
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_vocab_lists_updated_at
  BEFORE UPDATE ON public.vocab_lists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vocab_progress_updated_at
  BEFORE UPDATE ON public.vocab_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Comments for documentation
-- =====================================================

COMMENT ON TABLE public.vocab_lists IS 'Woordenlijsten per gebruiker voor WRTS-achtige training';
COMMENT ON TABLE public.vocab_items IS 'Individuele woorden/termen binnen een lijst';
COMMENT ON TABLE public.vocab_progress IS 'Voortgang per gebruiker per woord met spaced repetition';
COMMENT ON FUNCTION calculate_next_due_date IS 'Berekent volgende herhaal-datum op basis van mastery level';
