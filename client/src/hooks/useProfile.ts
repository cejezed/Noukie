import { useQuery } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { useState, useEffect } from 'react';

export interface ProfileData {
  xpTotal: number;
  level: number;
  gamesPlayed: number;
  testsCompleted: number;
  streakDays: number;
  lastActivityDate: string | null;
}

export function useProfile() {
  const { user } = useAuth();
  const [previousLevel, setPreviousLevel] = useState<number | null>(null);
  const [showLevelUp, setShowLevelUp] = useState(false);

  const { data, isLoading, error, refetch } = useQuery<ProfileData>({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const response = await fetch('/api/profile', {
        headers: {
          'x-user-id': user?.id || '',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch profile');
      }

      return response.json();
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // Refetch every 30 seconds to catch level changes
  });

  // Detect level changes and show level-up notification
  useEffect(() => {
    if (data && previousLevel !== null && data.level > previousLevel) {
      setShowLevelUp(true);
      // Auto-hide after 5 seconds
      setTimeout(() => setShowLevelUp(false), 5000);
    }

    if (data && previousLevel === null) {
      setPreviousLevel(data.level);
    } else if (data && data.level !== previousLevel) {
      setPreviousLevel(data.level);
    }
  }, [data, previousLevel]);

  // Calculate XP needed for next level
  // Level formula: level = floor(sqrt(xp_total / 10))
  // Inverse: xp_for_level = (level^2) * 10
  const currentLevel = data?.level || 1;
  const currentXp = data?.xpTotal || 0;
  const xpForCurrentLevel = (currentLevel ** 2) * 10;
  const xpForNextLevel = ((currentLevel + 1) ** 2) * 10;
  const xpNeededForNextLevel = xpForNextLevel - currentXp;
  const xpProgressInCurrentLevel = currentXp - xpForCurrentLevel;
  const xpRequiredForCurrentLevel = xpForNextLevel - xpForCurrentLevel;
  const progressPercent = Math.min(100, Math.round((xpProgressInCurrentLevel / xpRequiredForCurrentLevel) * 100));

  return {
    profile: data,
    xpTotal: data?.xpTotal || 0,
    level: data?.level || 1,
    gamesPlayed: data?.gamesPlayed || 0,
    testsCompleted: data?.testsCompleted || 0,
    streakDays: data?.streakDays || 0,
    lastActivityDate: data?.lastActivityDate || null,

    // XP progress calculations
    xpNeededForNextLevel,
    xpProgressInCurrentLevel,
    xpRequiredForCurrentLevel,
    progressPercent,

    // Level-up notification state
    showLevelUp,
    dismissLevelUp: () => setShowLevelUp(false),

    isLoading,
    error,
    refetch,
  };
}
