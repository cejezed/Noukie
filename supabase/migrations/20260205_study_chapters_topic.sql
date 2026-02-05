-- Add topic column to study_chapters for 3-level hierarchy: subject > topic > chapter
ALTER TABLE "study_chapters" ADD COLUMN IF NOT EXISTS "topic" text;

-- Index for efficient grouping
CREATE INDEX IF NOT EXISTS "study_chapters_topic_idx" ON "study_chapters"("subject", "topic", "sort_order");
