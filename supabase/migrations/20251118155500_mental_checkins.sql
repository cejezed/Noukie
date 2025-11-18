-- Create mental_checkins table for parent mental health tracking
CREATE TABLE IF NOT EXISTS "mental_checkins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"date" date NOT NULL,
	"mood" text NOT NULL CHECK (mood IN ('ok', 'niet_lekker', 'hulp_nu')),
	"sleep_score" integer CHECK (sleep_score >= 1 AND sleep_score <= 5),
	"stress_score" integer CHECK (stress_score >= 1 AND stress_score <= 5),
	"energy_score" integer CHECK (energy_score >= 1 AND energy_score <= 5),
	"fun_with" text,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "mental_checkins_student_date_unique" UNIQUE("student_id", "date")
);

-- Add foreign key constraint
ALTER TABLE "mental_checkins"
ADD CONSTRAINT "mental_checkins_student_id_users_id_fk"
FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE no action;

-- Enable Row Level Security
ALTER TABLE "mental_checkins" ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Students can insert their own checkins
CREATE POLICY "Students can insert own mental checkins"
ON "mental_checkins"
AS PERMISSIVE
FOR INSERT
TO public
WITH CHECK (auth.uid() = student_id);

-- RLS Policy: Students can read their own checkins
CREATE POLICY "Students can read own mental checkins"
ON "mental_checkins"
AS PERMISSIVE
FOR SELECT
TO public
USING (auth.uid() = student_id);

-- RLS Policy: Students can update their own checkins
CREATE POLICY "Students can update own mental checkins"
ON "mental_checkins"
AS PERMISSIVE
FOR UPDATE
TO public
USING (auth.uid() = student_id);

-- RLS Policy: Parents can read their confirmed children's checkins
CREATE POLICY "Parents can read confirmed children mental checkins"
ON "mental_checkins"
AS PERMISSIVE
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM parent_child_relationships pcr
    WHERE pcr.parent_id = auth.uid()
    AND pcr.child_id = mental_checkins.student_id
    AND pcr.is_confirmed = true
  )
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS "mental_checkins_student_id_idx" ON "mental_checkins"("student_id");
CREATE INDEX IF NOT EXISTS "mental_checkins_date_idx" ON "mental_checkins"("date");
CREATE INDEX IF NOT EXISTS "mental_checkins_student_date_idx" ON "mental_checkins"("student_id", "date");
