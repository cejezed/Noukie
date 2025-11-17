/**
 * Vocab List Detail API
 *
 * GET /api/vocab/list?id=<list_id> - Get specific list with items and progress
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
    const listId = req.query.id as string;

    if (!listId) {
      return res.status(400).json({ error: 'Missing list id parameter' });
    }

    // 1. Fetch list metadata and verify ownership
    const { data: list, error: listError } = await admin
      .from('vocab_lists')
      .select('*')
      .eq('id', listId)
      .eq('owner_id', userId)
      .single();

    if (listError) {
      console.error('List fetch error:', listError);
      return res.status(404).json({ error: 'List not found or access denied' });
    }

    // 2. Fetch all items for this list
    const { data: items, error: itemsError } = await admin
      .from('vocab_items')
      .select('*')
      .eq('list_id', listId)
      .order('created_at', { ascending: true });

    if (itemsError) {
      console.error('Items fetch error:', itemsError);
      return res.status(500).json({ error: itemsError.message });
    }

    // 3. Fetch user's progress for these items
    const itemIds = items.map((item) => item.id);
    let progressMap: Record<string, any> = {};

    if (itemIds.length > 0) {
      const { data: progressData, error: progressError } = await admin
        .from('vocab_progress')
        .select('*')
        .eq('user_id', userId)
        .in('item_id', itemIds);

      if (progressError) {
        console.error('Progress fetch error:', progressError);
        // Non-critical - continue without progress
      } else if (progressData) {
        // Create map: item_id -> progress
        progressData.forEach((p) => {
          progressMap[p.item_id] = p;
        });
      }
    }

    // 4. Combine items with progress
    const itemsWithProgress = items.map((item) => ({
      ...item,
      progress: progressMap[item.id] || null,
    }));

    return res.status(200).json({
      list,
      items: itemsWithProgress,
    });
  } catch (error: any) {
    console.error('Unexpected error fetching vocab list:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
