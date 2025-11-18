-- Add created_at column to quiz_results table for time-based queries
ALTER TABLE "quiz_results"
ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();

-- Create index for faster time-based queries
CREATE INDEX IF NOT EXISTS "quiz_results_created_at_idx" ON "quiz_results"("created_at");
CREATE INDEX IF NOT EXISTS "quiz_results_user_created_idx" ON "quiz_results"("user_id", "created_at");
