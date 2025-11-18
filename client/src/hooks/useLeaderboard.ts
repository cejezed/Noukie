import { useQuery } from '@tanstack/react-query';
import { useAuth } from './useAuth';

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  score: number;
  rank: number;
  levelReached?: number;
}

export function useLeaderboard(gameId: string, limit: number = 50) {
  const { user } = useAuth();

  const { data, isLoading, error, refetch } = useQuery<LeaderboardEntry[]>({
    queryKey: ['leaderboard', gameId, limit],
    queryFn: async () => {
      const response = await fetch(`/api/leaderboard?game=${gameId}&limit=${limit}`);

      if (!response.ok) {
        throw new Error('Failed to fetch leaderboard');
      }

      return response.json();
    },
    enabled: !!gameId,
  });

  // Find current user's rank
  const userEntry = data?.find(entry => entry.userId === user?.id);
  const userRank = userEntry?.rank || null;

  // Calculate user's percentile (if user is in leaderboard)
  const percentile = userRank && data ? Math.round(((data.length - userRank + 1) / data.length) * 100) : null;

  return {
    leaderboard: data || [],
    isLoading,
    error,
    refetch,
    userRank,
    userEntry,
    percentile,
  };
}

export function useHighScore(gameId: string) {
  const { user } = useAuth();

  const { data, isLoading, error, refetch } = useQuery<{ highScore: number }>({
    queryKey: ['highscore', user?.id, gameId],
    queryFn: async () => {
      const response = await fetch(`/api/user/highscore?gameId=${gameId}`, {
        headers: {
          'x-user-id': user?.id || '',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch high score');
      }

      return response.json();
    },
    enabled: !!user?.id && !!gameId,
  });

  return {
    highScore: data?.highScore || 0,
    isLoading,
    error,
    refetch,
  };
}
