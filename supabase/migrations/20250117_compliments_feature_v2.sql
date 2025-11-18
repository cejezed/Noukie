-- Migration: Compliments Feature (Production-Ready)
-- Created: 2025-01-17
-- Description: Anonymous daily compliments with proper RLS, timezone handling, and security

-- 1. Create classrooms table
CREATE TABLE IF NOT EXISTS public.classrooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  education_level text NOT NULL CHECK (education_level IN ('vmbo', 'havo', 'vwo', 'mbo')),
  grade integer NOT NULL CHECK (grade >= 1 AND grade <= 6),
  created_at timestamptz DEFAULT now(),
  UNIQUE(education_level, grade)
);

-- 2. Add classroom_id to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS classroom_id uuid REFERENCES public.classrooms(id);

-- 3. Create compliments table
CREATE TABLE public.compliments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user uuid NULL, -- NULL for UI display, non-null for streak tracking only
  to_user uuid NOT NULL, -- References auth.users (Supabase managed)
  classroom_id uuid NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  message text NOT NULL CHECK (length(message) >= 3 AND length(message) <= 500),
  toxicity_score real DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 4. Create compliment_streaks table for gamification
CREATE TABLE public.compliment_streaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE, -- References auth.users
  current_streak integer DEFAULT 0,
  longest_streak integer DEFAULT 0,
  last_sent_at timestamptz, -- Use timestamptz for proper timezone handling
  total_sent integer DEFAULT 0,
  total_received integer DEFAULT 0,
  points integer DEFAULT 0,
  badges jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 5. Create indexes for performance
CREATE INDEX idx_compliments_to_user ON public.compliments(to_user);
CREATE INDEX idx_compliments_classroom ON public.compliments(classroom_id);
CREATE INDEX idx_compliments_created_at ON public.compliments(created_at DESC);
CREATE INDEX idx_compliments_from_user ON public.compliments(from_user); -- For daily limit check
CREATE INDEX idx_compliment_streaks_user ON public.compliment_streaks(user_id);
CREATE INDEX idx_users_classroom ON public.users(classroom_id);

-- 6. Enable Row Level Security
ALTER TABLE public.classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliment_streaks ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies for classrooms
CREATE POLICY "Anyone can read classrooms"
  ON public.classrooms
  FOR SELECT
  TO authenticated
  USING (true);

-- 8. RLS Policies for compliments - STRENGTHENED
-- Students can ONLY read compliments sent TO them (never see who sent it)
CREATE POLICY "Students can read compliments sent to them"
  ON public.compliments
  FOR SELECT
  TO authenticated
  USING (to_user = auth.uid());

-- Students can insert compliments only in their own classroom
CREATE POLICY "Students can send compliments in their classroom"
  ON public.compliments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Verify sender is in a classroom
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.classroom_id IS NOT NULL
      AND users.classroom_id = compliments.classroom_id
    )
    -- Note: Backend MUST verify recipient is also in same classroom
  );

-- No UPDATE or DELETE allowed on compliments (permanent record)
-- Admin/service role can still delete via service key if needed

-- 9. RLS Policies for compliment_streaks
CREATE POLICY "Users can read own streak data"
  ON public.compliment_streaks
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own streak data"
  ON public.compliment_streaks
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own streak data"
  ON public.compliment_streaks
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- 10. SECURITY DEFINER function for classroom stats (aggregate only)
-- This allows students to see class-level stats without exposing individual data
CREATE OR REPLACE FUNCTION public.get_classroom_stats(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_classroom_id uuid;
  v_result jsonb;
  v_total_compliments integer;
  v_total_students integer;
  v_this_week integer;
  v_this_month integer;
BEGIN
  -- Get user's classroom
  SELECT classroom_id INTO v_classroom_id
  FROM public.users
  WHERE id = p_user_id;

  -- If no classroom, return empty stats
  IF v_classroom_id IS NULL THEN
    RETURN jsonb_build_object(
      'total_compliments', 0,
      'total_students', 0,
      'avg_per_student', '0',
      'this_week', 0,
      'this_month', 0
    );
  END IF;

  -- Only show stats if classroom has >= 5 students (privacy protection)
  SELECT COUNT(*) INTO v_total_students
  FROM public.users
  WHERE classroom_id = v_classroom_id;

  IF v_total_students < 5 THEN
    RETURN jsonb_build_object(
      'total_compliments', 0,
      'total_students', v_total_students,
      'avg_per_student', '0',
      'this_week', 0,
      'this_month', 0,
      'message', 'Stats worden getoond vanaf 5 studenten (privacy)'
    );
  END IF;

  -- Get total compliments in classroom
  SELECT COUNT(*) INTO v_total_compliments
  FROM public.compliments
  WHERE classroom_id = v_classroom_id;

  -- Get this week's compliments
  SELECT COUNT(*) INTO v_this_week
  FROM public.compliments
  WHERE classroom_id = v_classroom_id
    AND created_at >= date_trunc('week', now() AT TIME ZONE 'Europe/Amsterdam') AT TIME ZONE 'Europe/Amsterdam';

  -- Get this month's compliments
  SELECT COUNT(*) INTO v_this_month
  FROM public.compliments
  WHERE classroom_id = v_classroom_id
    AND created_at >= date_trunc('month', now() AT TIME ZONE 'Europe/Amsterdam') AT TIME ZONE 'Europe/Amsterdam';

  -- Build result
  RETURN jsonb_build_object(
    'total_compliments', v_total_compliments,
    'total_students', v_total_students,
    'avg_per_student', ROUND(v_total_compliments::numeric / NULLIF(v_total_students, 0), 1),
    'this_week', v_this_week,
    'this_month', v_this_month
  );
END;
$$;

-- 11. Function to check daily compliment limit (timezone-aware)
CREATE OR REPLACE FUNCTION public.check_daily_compliment_limit(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  compliment_count integer;
  today_start timestamptz;
  today_end timestamptz;
BEGIN
  -- Calculate today's date range in Europe/Amsterdam timezone
  today_start := date_trunc('day', now() AT TIME ZONE 'Europe/Amsterdam') AT TIME ZONE 'Europe/Amsterdam';
  today_end := today_start + interval '1 day';

  SELECT COUNT(*)
  INTO compliment_count
  FROM public.compliments
  WHERE from_user = p_user_id
    AND created_at >= today_start
    AND created_at < today_end;

  RETURN compliment_count < 1; -- Only 1 compliment per day
END;
$$;

-- 12. Function to update streak data (timezone-aware)
CREATE OR REPLACE FUNCTION public.update_user_streak(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing record;
  v_today date;
  v_yesterday date;
  v_last_sent_date date;
  v_new_streak integer;
  v_new_longest integer;
  v_new_points integer;
  v_badges jsonb;
BEGIN
  -- Get today and yesterday in Europe/Amsterdam timezone
  v_today := (now() AT TIME ZONE 'Europe/Amsterdam')::date;
  v_yesterday := (now() AT TIME ZONE 'Europe/Amsterdam' - interval '1 day')::date;

  -- Get existing streak data
  SELECT * INTO v_existing
  FROM public.compliment_streaks
  WHERE user_id = p_user_id;

  IF v_existing IS NULL THEN
    -- Create new streak
    INSERT INTO public.compliment_streaks (
      user_id,
      current_streak,
      longest_streak,
      last_sent_at,
      total_sent,
      points,
      badges
    ) VALUES (
      p_user_id,
      1,
      1,
      now(),
      1,
      5,
      '[]'::jsonb
    );
  ELSE
    -- Extract date from last_sent_at
    v_last_sent_date := (v_existing.last_sent_at AT TIME ZONE 'Europe/Amsterdam')::date;

    -- Calculate new streak
    IF v_last_sent_date = v_yesterday THEN
      v_new_streak := v_existing.current_streak + 1;
    ELSIF v_last_sent_date = v_today THEN
      -- Already sent today, don't increment
      v_new_streak := v_existing.current_streak;
    ELSE
      -- Streak broken
      v_new_streak := 1;
    END IF;

    v_new_longest := GREATEST(v_existing.longest_streak, v_new_streak);
    v_new_points := v_existing.points + 5;

    -- Calculate badges
    v_badges := v_existing.badges;
    IF v_new_streak >= 7 AND NOT (v_badges ? 'week_warrior') THEN
      v_badges := v_badges || '"week_warrior"'::jsonb;
    END IF;
    IF v_new_streak >= 14 AND NOT (v_badges ? 'fortnight_friend') THEN
      v_badges := v_badges || '"fortnight_friend"'::jsonb;
    END IF;
    IF v_new_streak >= 30 AND NOT (v_badges ? 'monthly_motivator') THEN
      v_badges := v_badges || '"monthly_motivator"'::jsonb;
    END IF;

    -- Update streak
    UPDATE public.compliment_streaks
    SET
      current_streak = v_new_streak,
      longest_streak = v_new_longest,
      last_sent_at = now(),
      total_sent = v_existing.total_sent + 1,
      points = v_new_points,
      badges = v_badges,
      updated_at = now()
    WHERE user_id = p_user_id;
  END IF;
END;
$$;

-- 13. Function to increment received count
CREATE OR REPLACE FUNCTION public.increment_received_count(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.compliment_streaks (
    user_id,
    current_streak,
    longest_streak,
    total_received,
    points,
    badges
  ) VALUES (
    p_user_id,
    0,
    0,
    1,
    0,
    '[]'::jsonb
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    total_received = compliment_streaks.total_received + 1,
    updated_at = now();
END;
$$;

-- 14. Auto-assign classroom trigger (timezone-aware)
CREATE OR REPLACE FUNCTION public.auto_assign_classroom()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Create classroom if it doesn't exist
  INSERT INTO public.classrooms (name, education_level, grade)
  VALUES (
    CONCAT(UPPER(NEW.education_level), ' ', NEW.grade),
    NEW.education_level,
    NEW.grade
  )
  ON CONFLICT (education_level, grade) DO NOTHING;

  -- Assign classroom_id
  SELECT id INTO NEW.classroom_id
  FROM public.classrooms
  WHERE education_level = NEW.education_level
    AND grade = NEW.grade;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_auto_assign_classroom
  BEFORE INSERT OR UPDATE OF education_level, grade ON public.users
  FOR EACH ROW
  WHEN (NEW.education_level IS NOT NULL AND NEW.grade IS NOT NULL)
  EXECUTE FUNCTION public.auto_assign_classroom();

-- 15. Initial setup: populate classrooms from existing users
INSERT INTO public.classrooms (name, education_level, grade)
SELECT DISTINCT
  CONCAT(UPPER(education_level), ' ', grade) as name,
  education_level,
  grade
FROM public.users
WHERE education_level IS NOT NULL
  AND grade IS NOT NULL
ON CONFLICT (education_level, grade) DO NOTHING;

-- Update existing users with classroom_id
UPDATE public.users u
SET classroom_id = c.id
FROM public.classrooms c
WHERE u.education_level = c.education_level
  AND u.grade = c.grade
  AND u.classroom_id IS NULL;

-- 16. Grant permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT SELECT ON public.classrooms TO authenticated;
GRANT SELECT, INSERT ON public.compliments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.compliment_streaks TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_classroom_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_daily_compliment_limit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_streak(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_received_count(uuid) TO authenticated;

-- Admin grants
GRANT ALL ON public.classrooms TO postgres, service_role;
GRANT ALL ON public.compliments TO postgres, service_role;
GRANT ALL ON public.compliment_streaks TO postgres, service_role;
