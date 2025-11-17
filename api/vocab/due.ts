/**
 * Vocab Due Items API
 *
 * GET /api/vocab/due - Get items due for review today
 * Includes items from all lists where next_due_at <= now()
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Auth check
  const userId = (req.headers['x-user-id'] as string) || null;
  if (!userId) {
    return res.status(401).json({ error: 'Missing x-user-id' });
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const { subject, list_id } = req.query;

    // Get all progress records for this user that are due
    const now = new Date().toISOString();

    let progressQuery = admin
      .from('vocab_progress')
      .select('*, vocab_items!inner(*)')
      .eq('user_id', userId)
      .lte('next_due_at', now)
      .order('next_due_at', { ascending: true });

    const { data: progressData, error: progressError } = await progressQuery;

    if (progressError) {
      console.error('Due items fetch error:', progressError);
      return res.status(500).json({ error: progressError.message });
    }

    // Get list info for each item
    const listIds = [...new Set(progressData.map((p: any) => p.vocab_items.list_id))];
    const { data: lists } = await admin
      .from('vocab_lists')
      .select('*')
      .in('id', listIds)
      .eq('owner_id', userId);

    const listsMap: Record<string, any> = {};
    if (lists) {
      lists.forEach((list) => {
        listsMap[list.id] = list;
      });
    }

    // Combine data
    let dueItems = progressData.map((progress: any) => ({
      item: progress.vocab_items,
      progress: {
        mastery_level: progress.mastery_level,
        last_seen_at: progress.last_seen_at,
        next_due_at: progress.next_due_at,
        times_correct: progress.times_correct,
        times_incorrect: progress.times_incorrect,
      },
      list: listsMap[progress.vocab_items.list_id] || null,
    }));

    // Apply filters
    if (subject) {
      dueItems = dueItems.filter((item) => item.list?.subject === subject);
    }

    if (list_id) {
      dueItems = dueItems.filter((item) => item.list?.id === list_id);
    }

    return res.status(200).json({
      data: dueItems,
      count: dueItems.length,
    });
  } catch (error: any) {
    console.error('Unexpected error fetching due items:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
