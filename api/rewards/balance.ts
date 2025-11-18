/**
 * Rewards Balance API
 *
 * GET /api/rewards/balance - Get user's current reward balance
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
    // Use helper function to calculate balance
    const { data, error } = await admin.rpc('get_user_reward_balance', {
      p_user_id: userId,
    });

    if (error) {
      console.error('Balance calculation error:', error);
      return res.status(500).json({ error: error.message });
    }

    const balance = data ?? 0;

    return res.status(200).json({
      balance,
      user_id: userId,
    });
  } catch (error: any) {
    console.error('Unexpected error fetching reward balance:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
