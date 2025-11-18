-- Create app_events table for tracking user activity
CREATE TABLE IF NOT EXISTS "app_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"event_type" text NOT NULL CHECK (event_type IN ('login', 'logout', 'task_completed', 'quiz_completed', 'mental_checkin', 'study_session', 'chat_session')),
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now()
);

-- Add foreign key constraint
ALTER TABLE "app_events"
ADD CONSTRAINT "app_events_user_id_users_id_fk"
FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE no action;

-- Enable Row Level Security
ALTER TABLE "app_events" ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can insert their own events
CREATE POLICY "Users can insert own app events"
ON "app_events"
AS PERMISSIVE
FOR INSERT
TO public
WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can read their own events
CREATE POLICY "Users can read own app events"
ON "app_events"
AS PERMISSIVE
FOR SELECT
TO public
USING (auth.uid() = user_id);

-- RLS Policy: Parents can read their confirmed children's events
CREATE POLICY "Parents can read confirmed children app events"
ON "app_events"
AS PERMISSIVE
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM parent_child_relationships pcr
    WHERE pcr.parent_id = auth.uid()
    AND pcr.child_id = app_events.user_id
    AND pcr.is_confirmed = true
  )
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS "app_events_user_id_idx" ON "app_events"("user_id");
CREATE INDEX IF NOT EXISTS "app_events_event_type_idx" ON "app_events"("event_type");
CREATE INDEX IF NOT EXISTS "app_events_created_at_idx" ON "app_events"("created_at");
CREATE INDEX IF NOT EXISTS "app_events_user_created_idx" ON "app_events"("user_id", "created_at");
