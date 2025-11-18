/**
 * Rewards Spend API
 *
 * POST /api/rewards/spend - Spend reward points (e.g., for game time)
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

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const { points, reason } = req.body;

    // Validation
    if (typeof points !== 'number' || points <= 0) {
      return res.status(400).json({ error: 'points must be a positive number' });
    }

    if (!reason || typeof reason !== 'string') {
      return res.status(400).json({ error: 'reason is required' });
    }

    // 1. Check current balance
    const { data: currentBalance, error: balanceError } = await admin.rpc(
      'get_user_reward_balance',
      { p_user_id: userId }
    );

    if (balanceError) {
      console.error('Balance check error:', balanceError);
      return res.status(500).json({ error: balanceError.message });
    }

    const balance = currentBalance ?? 0;

    // 2. Validate sufficient balance
    if (balance < points) {
      return res.status(400).json({
        error: 'Insufficient balance',
        balance,
        requested: points,
      });
    }

    // 3. Create spend event (negative points)
    const { data: event, error: eventError } = await admin
      .from('study_reward_events')
      .insert([
        {
          user_id: userId,
          source: 'game',
          event_type: 'spend',
          points: -Math.abs(points),
          metadata: {
            reason,
            spent_at: new Date().toISOString(),
          },
        },
      ])
      .select('*')
      .single();

    if (eventError) {
      console.error('Spend event creation error:', eventError);
      return res.status(500).json({ error: eventError.message });
    }

    // 4. Calculate new balance
    const newBalance = balance - points;

    return res.status(200).json({
      success: true,
      event,
      previous_balance: balance,
      spent: points,
      new_balance: newBalance,
    });
  } catch (error: any) {
    console.error('Unexpected error spending rewards:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
