/**
 * Game Profile API
 *
 * GET /api/game/profile?subject=aardrijkskunde (optional)
 * Returns user's game profile and subject stats
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
    const subject = req.query.subject as string | undefined;

    // 1. Fetch or create user_game_profiles
    let { data: profile, error: profileError } = await admin
      .from('user_game_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    // If profile doesn't exist, create it
    if (!profile) {
      const { data: newProfile, error: createError } = await admin
        .from('user_game_profiles')
        .insert([
          {
            user_id: userId,
            total_xp: 0,
            current_streak: 0,
            best_streak: 0,
            last_played_at: null,
          },
        ])
        .select('*')
        .single();

      if (createError) {
        console.error('Profile creation error:', createError);
        return res.status(500).json({ error: createError.message });
      }

      profile = newProfile;
    }

    // 2. Fetch subject stats
    let subjectStatsQuery = admin
      .from('user_subject_stats')
      .select('*')
      .eq('user_id', userId);

    // Filter by subject if specified
    if (subject) {
      subjectStatsQuery = subjectStatsQuery.eq('subject', subject);
    }

    const { data: subjectStats, error: statsError } = await subjectStatsQuery;

    if (statsError) {
      console.error('Subject stats fetch error:', statsError);
      return res.status(500).json({ error: statsError.message });
    }

    // 3. Compute rank info if specific subject requested
    let rankInfo = undefined;
    if (subject && subjectStats && subjectStats.length > 0) {
      const stats = subjectStats[0];
      const subjectXp = stats.subject_xp || 0;

      // Hardcoded for aardrijkskunde - should match config
      const rankThresholds = [0, 100, 300, 600, 1000];
      const rankLabels = ['Local', 'Regionaal', 'Nationaal', 'Europees', 'Mondiaal Expert'];

      let rankIndex = 0;
      for (let i = rankThresholds.length - 1; i >= 0; i--) {
        if (subjectXp >= rankThresholds[i]) {
          rankIndex = i;
          break;
        }
      }

      const nextRankXp =
        rankIndex < rankThresholds.length - 1 ? rankThresholds[rankIndex + 1] : null;
      const xpToNextRank = nextRankXp ? nextRankXp - subjectXp : null;

      const currentThreshold = rankThresholds[rankIndex];
      let progressPercent = 100;
      if (nextRankXp) {
        const xpInCurrentRank = subjectXp - currentThreshold;
        const xpNeededForRank = nextRankXp - currentThreshold;
        progressPercent = Math.min(
          100,
          Math.round((xpInCurrentRank / xpNeededForRank) * 100)
        );
      }

      rankInfo = {
        rankLabel: rankLabels[rankIndex],
        rankIndex,
        currentXp: subjectXp,
        nextRankXp,
        xpToNextRank,
        progressPercent,
      };
    }

    // Return profile + stats
    return res.status(200).json({
      profile,
      subjectStats: subjectStats || [],
      rankInfo,
    });
  } catch (error: any) {
    console.error('Unexpected error in game profile handler:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
