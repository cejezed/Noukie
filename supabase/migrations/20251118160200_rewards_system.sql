-- Create reward_points table for tracking student points
CREATE TABLE IF NOT EXISTS "reward_points" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL UNIQUE,
	"points_total" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);

-- Add foreign key constraint
ALTER TABLE "reward_points"
ADD CONSTRAINT "reward_points_student_id_users_id_fk"
FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE no action;

-- Enable Row Level Security
ALTER TABLE "reward_points" ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Students can read their own points
CREATE POLICY "Students can read own reward points"
ON "reward_points"
AS PERMISSIVE
FOR SELECT
TO public
USING (auth.uid() = student_id);

-- RLS Policy: Students can upsert their own points
CREATE POLICY "Students can upsert own reward points"
ON "reward_points"
AS PERMISSIVE
FOR INSERT
TO public
WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can update own reward points"
ON "reward_points"
AS PERMISSIVE
FOR UPDATE
TO public
USING (auth.uid() = student_id);

-- RLS Policy: Parents can read their confirmed children's points
CREATE POLICY "Parents can read confirmed children reward points"
ON "reward_points"
AS PERMISSIVE
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM parent_child_relationships pcr
    WHERE pcr.parent_id = auth.uid()
    AND pcr.child_id = reward_points.student_id
    AND pcr.is_confirmed = true
  )
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS "reward_points_student_id_idx" ON "reward_points"("student_id");

-- Create rewards table for parent-configurable rewards
CREATE TABLE IF NOT EXISTS "rewards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid NOT NULL,
	"label" text NOT NULL,
	"points_required" integer NOT NULL,
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now()
);

-- Add foreign key constraint
ALTER TABLE "rewards"
ADD CONSTRAINT "rewards_parent_id_users_id_fk"
FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE no action;

-- Enable Row Level Security
ALTER TABLE "rewards" ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Parents can manage their own rewards
CREATE POLICY "Parents can insert own rewards"
ON "rewards"
AS PERMISSIVE
FOR INSERT
TO public
WITH CHECK (auth.uid() = parent_id);

CREATE POLICY "Parents can read own rewards"
ON "rewards"
AS PERMISSIVE
FOR SELECT
TO public
USING (auth.uid() = parent_id);

CREATE POLICY "Parents can update own rewards"
ON "rewards"
AS PERMISSIVE
FOR UPDATE
TO public
USING (auth.uid() = parent_id);

CREATE POLICY "Parents can delete own rewards"
ON "rewards"
AS PERMISSIVE
FOR DELETE
TO public
USING (auth.uid() = parent_id);

-- RLS Policy: Students can read rewards from their confirmed parents
CREATE POLICY "Students can read parent rewards"
ON "rewards"
AS PERMISSIVE
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM parent_child_relationships pcr
    WHERE pcr.child_id = auth.uid()
    AND pcr.parent_id = rewards.parent_id
    AND pcr.is_confirmed = true
  )
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS "rewards_parent_id_idx" ON "rewards"("parent_id");
CREATE INDEX IF NOT EXISTS "rewards_is_active_idx" ON "rewards"("is_active");
CREATE INDEX IF NOT EXISTS "rewards_parent_active_idx" ON "rewards"("parent_id", "is_active");

-- Insert default rewards for existing parents
INSERT INTO "rewards" ("parent_id", "label", "points_required", "sort_order", "is_active")
SELECT
  u.id,
  r.label,
  r.points_required,
  r.sort_order,
  true
FROM "users" u
CROSS JOIN (
  VALUES
    ('Samen shoppen', 25, 1),
    ('Dagje Walibi', 100, 2),
    ('Phantasialand', 200, 3)
) AS r(label, points_required, sort_order)
WHERE u.role = 'parent';
