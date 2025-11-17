/**
 * Vocab Progress API
 *
 * POST /api/vocab/progress - Update user progress after answering (learn/test)
 *
 * Implements spaced repetition algorithm:
 * - Level 0 → +1 hour
 * - Level 1 → +12 hours
 * - Level 2 → +1 day
 * - Level 3 → +3 days
 * - Level 4 → +7 days
 * - Level 5 → +14 days
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Calculate next due date based on mastery level
 */
function calculateNextDueDate(masteryLevel: number): Date {
  const now = new Date();

  switch (masteryLevel) {
    case 0:
      return new Date(now.getTime() + 1 * 60 * 60 * 1000); // +1 hour
    case 1:
      return new Date(now.getTime() + 12 * 60 * 60 * 1000); // +12 hours
    case 2:
      return new Date(now.getTime() + 24 * 60 * 60 * 1000); // +1 day
    case 3:
      return new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // +3 days
    case 4:
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // +7 days
    case 5:
      return new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // +14 days
    default:
      return new Date(now.getTime() + 1 * 60 * 60 * 1000); // fallback: +1 hour
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Auth check
  const userId = (req.headers['x-user-id'] as string) || null;
  if (!userId) {
    return res.status(401).json({ error: 'Missing x-user-id' });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const { item_id, is_correct } = req.body;

    // Validation
    if (!item_id) {
      return res.status(400).json({ error: 'Missing item_id' });
    }

    if (typeof is_correct !== 'boolean') {
      return res.status(400).json({ error: 'is_correct must be a boolean' });
    }

    // Verify item exists and user has access
    const { data: item, error: itemError } = await admin
      .from('vocab_items')
      .select('id, list_id')
      .eq('id', item_id)
      .single();

    if (itemError || !item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Verify list ownership
    const { data: list, error: listError } = await admin
      .from('vocab_lists')
      .select('id, owner_id')
      .eq('id', item.list_id)
      .single();

    if (listError || !list || list.owner_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get existing progress (if any)
    const { data: existingProgress } = await admin
      .from('vocab_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('item_id', item_id)
      .single();

    let newMasteryLevel: number;
    let newTimesCorrect: number;
    let newTimesIncorrect: number;

    if (existingProgress) {
      // Update existing progress
      newTimesCorrect = existingProgress.times_correct + (is_correct ? 1 : 0);
      newTimesIncorrect = existingProgress.times_incorrect + (is_correct ? 0 : 1);

      if (is_correct) {
        // Correct answer: increase mastery (max 5)
        newMasteryLevel = Math.min(5, existingProgress.mastery_level + 1);
      } else {
        // Wrong answer: decrease mastery (min 0)
        newMasteryLevel = Math.max(0, existingProgress.mastery_level - 1);
      }
    } else {
      // First time seeing this item
      newTimesCorrect = is_correct ? 1 : 0;
      newTimesIncorrect = is_correct ? 0 : 1;
      newMasteryLevel = is_correct ? 1 : 0;
    }

    const nextDueAt = calculateNextDueDate(newMasteryLevel);

    // Upsert progress
    const { data: updatedProgress, error: progressError } = await admin
      .from('vocab_progress')
      .upsert(
        {
          user_id: userId,
          item_id,
          mastery_level: newMasteryLevel,
          last_seen_at: new Date().toISOString(),
          next_due_at: nextDueAt.toISOString(),
          times_correct: newTimesCorrect,
          times_incorrect: newTimesIncorrect,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,item_id' }
      )
      .select('*')
      .single();

    if (progressError) {
      console.error('Progress upsert error:', progressError);
      return res.status(500).json({ error: progressError.message });
    }

    return res.status(200).json({
      data: updatedProgress,
    });
  } catch (error: any) {
    console.error('Unexpected error updating vocab progress:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
