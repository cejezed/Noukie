/**
 * Game Session API (Multi-Subject Support)
 *
 * POST /api/game/session - Save completed game session and update user stats
 * Supports: aardrijkskunde, geschiedenis, wiskunde, duits, engels
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Subject configurations (synced with client/src/config/gameSubjects.ts)
 * Each subject has its own rank labels and thresholds
 */
type SubjectKey = "aardrijkskunde" | "geschiedenis" | "wiskunde" | "duits" | "engels";

interface SubjectRankConfig {
  rankLabels: string[];
  rankThresholds: number[];
}

const SUBJECT_RANK_CONFIGS: Record<SubjectKey, SubjectRankConfig> = {
  aardrijkskunde: {
    rankLabels: ["Local", "Regionaal", "Nationaal", "Europees", "Mondiaal Expert"],
    rankThresholds: [0, 100, 300, 600, 1000],
  },
  geschiedenis: {
    rankLabels: ["Novice", "Leerling", "Kenner", "Historicus", "Tijdreiziger"],
    rankThresholds: [0, 100, 300, 600, 1000],
  },
  wiskunde: {
    rankLabels: ["Beginner", "Rekenaar", "Analist", "Problem Solver", "Math Master"],
    rankThresholds: [0, 100, 300, 600, 1000],
  },
  duits: {
    rankLabels: ["A1", "A2", "B1", "B2", "C1"],
    rankThresholds: [0, 100, 300, 600, 1000],
  },
  engels: {
    rankLabels: ["A1", "A2", "B1", "B2", "C1"],
    rankThresholds: [0, 100, 300, 600, 1000],
  },
};

function getRankConfig(subject: string): SubjectRankConfig {
  return SUBJECT_RANK_CONFIGS[subject as SubjectKey] || SUBJECT_RANK_CONFIGS.aardrijkskunde;
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
    const {
      quiz_id,
      subject,
      total_questions,
      correct_answers,
      xp_earned,
      best_streak,
      levels_completed,
      duration,
      score_percentage,
    } = req.body;

    // Validate required fields
    if (!quiz_id || !subject || typeof total_questions !== 'number') {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // 1. Insert game session record
    const { data: session, error: sessionError } = await admin
      .from('game_sessions')
      .insert([
        {
          user_id: userId,
          quiz_id,
          subject,
          total_questions,
          correct_answers: correct_answers || 0,
          xp_earned: xp_earned || 0,
          best_streak: best_streak || 0,
          levels_completed: levels_completed || 0,
          powerups_used: {},  // TODO: Add when power-ups are implemented
          completed: true,
          completed_at: new Date().toISOString(),
        },
      ])
      .select('*')
      .single();

    if (sessionError) {
      console.error('Session insert error:', sessionError);
      return res.status(500).json({ error: sessionError.message });
    }

    // 2. Upsert or update user_game_profiles
    const { data: existingProfile } = await admin
      .from('user_game_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    const newTotalXp = (existingProfile?.total_xp || 0) + xp_earned;
    const newBestStreak = Math.max(
      existingProfile?.best_streak || 0,
      best_streak || 0
    );

    const { data: updatedProfile, error: profileError } = await admin
      .from('user_game_profiles')
      .upsert(
        {
          user_id: userId,
          total_xp: newTotalXp,
          current_streak: 0,  // Reset per-session
          best_streak: newBestStreak,
          last_played_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      .select('*')
      .single();

    if (profileError) {
      console.error('Profile upsert error:', profileError);
      return res.status(500).json({ error: profileError.message });
    }

    // 3. Upsert user_subject_stats
    const { data: existingSubjectStats } = await admin
      .from('user_subject_stats')
      .select('*')
      .eq('user_id', userId)
      .eq('subject', subject)
      .single();

    const newSubjectXp = (existingSubjectStats?.subject_xp || 0) + xp_earned;
    const newLevelsCompleted =
      (existingSubjectStats?.levels_completed || 0) + (levels_completed || 0);
    const newBestScore = Math.max(
      existingSubjectStats?.best_score || 0,
      score_percentage || 0
    );

    // Calculate new rank based on XP (using subject-specific config)
    const rankConfig = getRankConfig(subject);
    const { rankLabels, rankThresholds } = rankConfig;
    let newRankIndex = 0;
    for (let i = rankThresholds.length - 1; i >= 0; i--) {
      if (newSubjectXp >= rankThresholds[i]) {
        newRankIndex = i;
        break;
      }
    }
    const newRank = rankLabels[newRankIndex];

    const { data: updatedSubjectStats, error: subjectError } = await admin
      .from('user_subject_stats')
      .upsert(
        {
          user_id: userId,
          subject,
          subject_xp: newSubjectXp,
          subject_rank: newRank,
          levels_completed: newLevelsCompleted,
          best_score: newBestScore,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,subject' }
      )
      .select('*')
      .single();

    if (subjectError) {
      console.error('Subject stats upsert error:', subjectError);
      return res.status(500).json({ error: subjectError.message });
    }

    // 4. Compute rank info
    const nextRankXp = newRankIndex < rankThresholds.length - 1
      ? rankThresholds[newRankIndex + 1]
      : null;

    const xpToNextRank = nextRankXp ? nextRankXp - newSubjectXp : null;

    const currentThreshold = rankThresholds[newRankIndex];
    let progressPercent = 100;
    if (nextRankXp) {
      const xpInCurrentRank = newSubjectXp - currentThreshold;
      const xpNeededForRank = nextRankXp - currentThreshold;
      progressPercent = Math.min(
        100,
        Math.round((xpInCurrentRank / xpNeededForRank) * 100)
      );
    }

    const rankInfo = {
      rankLabel: newRank,
      rankIndex: newRankIndex,
      currentXp: newSubjectXp,
      nextRankXp,
      xpToNextRank,
      progressPercent,
    };

    // Return all updated data
    return res.status(200).json({
      session,
      updatedProfile,
      updatedSubjectStats,
      rankInfo,
    });
  } catch (error: any) {
    console.error('Unexpected error in game session handler:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
