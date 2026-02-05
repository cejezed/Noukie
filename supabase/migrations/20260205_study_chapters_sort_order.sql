-- Add sort_order column to study_chapters for drag-and-drop ordering
ALTER TABLE "study_chapters" ADD COLUMN IF NOT EXISTS "sort_order" integer NOT NULL DEFAULT 0;

-- Set initial sort_order based on existing creation order within each subject
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY subject ORDER BY created_at ASC) - 1 AS rn
  FROM study_chapters
)
UPDATE study_chapters SET sort_order = ranked.rn
FROM ranked WHERE study_chapters.id = ranked.id;

-- Index for efficient ordering
CREATE INDEX IF NOT EXISTS "study_chapters_sort_order_idx" ON "study_chapters"("subject", "sort_order");
