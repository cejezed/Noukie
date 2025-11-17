-- Migration: Compliments Feature
-- Created: 2025-01-17
-- Description: Add anonymous daily compliments feature for students

-- 1. Create classrooms table (if not exists)
-- Classrooms group students by education level + grade
CREATE TABLE IF NOT EXISTS public.classrooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  education_level text NOT NULL CHECK (education_level IN ('vmbo', 'havo', 'vwo', 'mbo')),
  grade integer NOT NULL CHECK (grade >= 1 AND grade <= 6),
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(education_level, grade)
);

-- 2. Add classroom_id to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS classroom_id uuid REFERENCES public.classrooms(id);

-- 3. Create compliments table
CREATE TABLE public.compliments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user uuid NULL, -- NULL for anonymous, or user id for tracking streaks
  to_user uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  classroom_id uuid NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  message text NOT NULL CHECK (length(message) >= 3 AND length(message) <= 500),
  toxicity_score float DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

-- 4. Create compliment_streaks table for gamification
CREATE TABLE public.compliment_streaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  current_streak integer DEFAULT 0,
  longest_streak integer DEFAULT 0,
  last_sent_date date,
  total_sent integer DEFAULT 0,
  total_received integer DEFAULT 0,
  points integer DEFAULT 0,
  badges jsonb DEFAULT '[]'::jsonb, -- Array of badge names
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 5. Create indexes for performance
CREATE INDEX idx_compliments_to_user ON public.compliments(to_user);
CREATE INDEX idx_compliments_classroom ON public.compliments(classroom_id);
CREATE INDEX idx_compliments_created_at ON public.compliments(created_at DESC);
CREATE INDEX idx_compliment_streaks_user ON public.compliment_streaks(user_id);

-- 6. Enable Row Level Security
ALTER TABLE public.classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliment_streaks ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies for classrooms
-- Everyone can read classrooms
CREATE POLICY "Anyone can read classrooms"
  ON public.classrooms
  FOR SELECT
  TO public
  USING (true);

-- 8. RLS Policies for compliments
-- Students can insert compliments only in their own classroom
CREATE POLICY "Students can send compliments in their classroom"
  ON public.compliments
  FOR INSERT
  TO public
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.classroom_id = compliments.classroom_id
    )
  );

-- Students can only read compliments sent TO them
CREATE POLICY "Students can read compliments sent to them"
  ON public.compliments
  FOR SELECT
  TO public
  USING (to_user = auth.uid());

-- Teachers can read all compliments in their classrooms (future enhancement)
-- For now, we'll handle this in the backend with service role

-- 9. RLS Policies for compliment_streaks
-- Users can read their own streak data
CREATE POLICY "Users can read own streak data"
  ON public.compliment_streaks
  FOR SELECT
  TO public
  USING (user_id = auth.uid());

-- Users can insert their own streak data
CREATE POLICY "Users can insert own streak data"
  ON public.compliment_streaks
  FOR INSERT
  TO public
  WITH CHECK (user_id = auth.uid());

-- Users can update their own streak data
CREATE POLICY "Users can update own streak data"
  ON public.compliment_streaks
  FOR UPDATE
  TO public
  USING (user_id = auth.uid());

-- 10. Create function to automatically populate classrooms based on users
CREATE OR REPLACE FUNCTION public.create_classrooms_from_users()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.classrooms (name, education_level, grade)
  SELECT
    DISTINCT
    CONCAT(UPPER(education_level), ' ', grade) as name,
    education_level,
    grade
  FROM public.users
  WHERE education_level IS NOT NULL
    AND grade IS NOT NULL
  ON CONFLICT (education_level, grade) DO NOTHING;
END;
$$;

-- 11. Create function to update user classroom_id based on education_level and grade
CREATE OR REPLACE FUNCTION public.update_user_classrooms()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.users u
  SET classroom_id = c.id
  FROM public.classrooms c
  WHERE u.education_level = c.education_level
    AND u.grade = c.grade
    AND u.classroom_id IS NULL;
END;
$$;

-- 12. Run initial setup
SELECT public.create_classrooms_from_users();
SELECT public.update_user_classrooms();

-- 13. Create trigger to auto-assign classroom when user is created/updated
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

-- 14. Create function to check daily compliment limit
CREATE OR REPLACE FUNCTION public.check_daily_compliment_limit(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  compliment_count integer;
BEGIN
  SELECT COUNT(*)
  INTO compliment_count
  FROM public.compliments
  WHERE from_user = p_user_id
    AND DATE(created_at) = CURRENT_DATE;

  RETURN compliment_count < 1; -- Only 1 compliment per day
END;
$$;

-- 15. Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON public.classrooms TO postgres, service_role;
GRANT SELECT ON public.classrooms TO anon, authenticated;
GRANT ALL ON public.compliments TO postgres, service_role;
GRANT SELECT, INSERT ON public.compliments TO authenticated;
GRANT ALL ON public.compliment_streaks TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON public.compliment_streaks TO authenticated;
