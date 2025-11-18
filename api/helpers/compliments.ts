/**
 * Compliments Helper Functions
 *
 * Utility functions for creating vocab-related compliments
 */

import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Create a compliment for a user
 *
 * @param userId - User UUID
 * @param message - Compliment message text
 * @param metadata - Optional metadata (type, source, etc.)
 * @returns Created compliment or null if failed
 */
export async function createComplimentForUser(
  userId: string,
  message: string,
  metadata: Record<string, any> = {}
): Promise<any | null> {
  try {
    // Check if user has a classroom (needed for compliments)
    const { data: classrooms } = await admin
      .from('classrooms')
      .select('id')
      .eq('owner_id', userId)
      .limit(1);

    let classroomId: string | null = null;

    if (classrooms && classrooms.length > 0) {
      classroomId = classrooms[0].id;
    } else {
      // Create a default classroom for this user if none exists
      const { data: newClassroom, error: classroomError } = await admin
        .from('classrooms')
        .insert([
          {
            owner_id: userId,
            name: 'Mijn Klas',
            code: `USER-${userId.substring(0, 8)}`,
          },
        ])
        .select('id')
        .single();

      if (classroomError) {
        console.error('Failed to create classroom for compliment:', classroomError);
        return null;
      }

      classroomId = newClassroom.id;
    }

    // Create the compliment
    const { data: compliment, error: complimentError } = await admin
      .from('compliments')
      .insert([
        {
          user_id: userId,
          classroom_id: classroomId,
          from_name: 'Study Coach', // Automated compliment
          message,
          metadata: {
            ...metadata,
            source: 'vocab_system',
            created_by: 'auto',
          },
        },
      ])
      .select('*')
      .single();

    if (complimentError) {
      console.error('Failed to create compliment:', complimentError);
      return null;
    }

    return compliment;
  } catch (error) {
    console.error('Unexpected error creating compliment:', error);
    return null;
  }
}

/**
 * Check if user already received a specific compliment type today
 *
 * @param userId - User UUID
 * @param complimentType - Type identifier (e.g., 'vocab_mastery_milestone', 'vocab_accuracy_bonus')
 * @returns true if already received today, false otherwise
 */
export async function hasComplimentToday(
  userId: string,
  complimentType: string
): Promise<boolean> {
  try {
    // Use the helper function from SQL migration
    const { data, error } = await admin.rpc('has_compliment_today', {
      p_user_id: userId,
      p_compliment_type: complimentType,
    });

    if (error) {
      console.error('Error checking compliment:', error);
      return false; // Fail safe: if error, allow compliment
    }

    return data === true;
  } catch (error) {
    console.error('Unexpected error checking compliment:', error);
    return false;
  }
}

/**
 * Check mastery milestone and create compliment if threshold reached
 *
 * @param userId - User UUID
 * @param listId - Vocab list UUID
 * @param listTitle - Vocab list title (for message)
 * @returns true if compliment was created, false otherwise
 */
export async function checkMasteryMilestone(
  userId: string,
  listId: string,
  listTitle: string
): Promise<boolean> {
  try {
    const MILESTONE_THRESHOLD = 20; // 20 words at mastery ≥3
    const MASTERY_LEVEL = 3;

    // Check if user already got this compliment today
    const alreadyReceived = await hasComplimentToday(userId, 'vocab_mastery_milestone');
    if (alreadyReceived) {
      return false;
    }

    // Count how many words in this list are at mastery ≥3
    const { data: items } = await admin
      .from('vocab_items')
      .select('id')
      .eq('list_id', listId);

    if (!items || items.length === 0) {
      return false;
    }

    const itemIds = items.map((item) => item.id);

    const { data: progress } = await admin
      .from('vocab_progress')
      .select('mastery_level')
      .eq('user_id', userId)
      .in('item_id', itemIds)
      .gte('mastery_level', MASTERY_LEVEL);

    const masteredCount = progress?.length || 0;

    if (masteredCount >= MILESTONE_THRESHOLD) {
      // Create compliment
      const message = `Je hebt al ${masteredCount} woorden van lijst "${listTitle}" echt onder de knie. Super bezig!`;

      const compliment = await createComplimentForUser(userId, message, {
        type: 'vocab_mastery_milestone',
        list_id: listId,
        list_title: listTitle,
        mastered_count: masteredCount,
      });

      return compliment !== null;
    }

    return false;
  } catch (error) {
    console.error('Error checking mastery milestone:', error);
    return false;
  }
}

/**
 * Check session accuracy and create compliment if high enough
 *
 * @param userId - User UUID
 * @param sessionStats - Session statistics (total, correct, accuracy)
 * @returns true if compliment was created, false otherwise
 */
export async function checkAccuracyBonus(
  userId: string,
  sessionStats: { total: number; correct: number; accuracy: number }
): Promise<boolean> {
  try {
    const MIN_QUESTIONS = 15;
    const MIN_ACCURACY = 90; // 90%

    // Check if user already got this compliment today
    const alreadyReceived = await hasComplimentToday(userId, 'vocab_accuracy_bonus');
    if (alreadyReceived) {
      return false;
    }

    if (sessionStats.total >= MIN_QUESTIONS && sessionStats.accuracy >= MIN_ACCURACY) {
      // Create compliment
      const message = `Wat een score! Meer dan ${sessionStats.accuracy}% goed in jouw vocab-toets. Ga zo door!`;

      const compliment = await createComplimentForUser(userId, message, {
        type: 'vocab_accuracy_bonus',
        total_questions: sessionStats.total,
        correct_answers: sessionStats.correct,
        accuracy: sessionStats.accuracy,
      });

      return compliment !== null;
    }

    return false;
  } catch (error) {
    console.error('Error checking accuracy bonus:', error);
    return false;
  }
}
