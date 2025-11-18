/**
 * Rewards Events API
 *
 * GET /api/rewards/events - Get user's reward event history
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
    // Optional query params
    const limitParam = req.query.limit as string;
    const offsetParam = req.query.offset as string;
    const sourceParam = req.query.source as string; // Filter by source (vocab, quiz, game)

    const limit = limitParam ? parseInt(limitParam) : 50;
    const offset = offsetParam ? parseInt(offsetParam) : 0;

    // Build query
    let query = admin
      .from('study_reward_events')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Optional source filter
    if (sourceParam) {
      query = query.eq('source', sourceParam);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Events fetch error:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({
      events: data,
      count: data.length,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error('Unexpected error fetching reward events:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
