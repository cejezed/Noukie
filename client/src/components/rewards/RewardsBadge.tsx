/**
 * Rewards Badge Component
 *
 * Small widget showing user's current reward balance
 * Can be placed in header or study pages
 */

import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { RewardBalance } from '@/types/rewards';

async function getUid() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

interface RewardsBadgeProps {
  onClick?: () => void;
  className?: string;
}

export default function RewardsBadge({ onClick, className = '' }: RewardsBadgeProps) {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    getUid().then(setUserId);
  }, []);

  const balance = useQuery({
    queryKey: ['reward-balance', userId],
    enabled: !!userId,
    refetchInterval: 30000, // Refresh every 30 seconds
    queryFn: async () => {
      const res = await fetch('/api/rewards/balance', {
        headers: { 'x-user-id': userId! },
      });
      if (!res.ok) throw new Error(await res.text());
      const json: RewardBalance = await res.json();
      return json;
    },
  });

  if (!userId || balance.isLoading) {
    return null; // Silent loading
  }

  if (balance.isError) {
    return null; // Silent error
  }

  const points = balance.data?.balance ?? 0;

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-medium text-sm shadow hover:shadow-lg transition-all hover:scale-105 ${className}`}
      title="Study Rewards - Verdien punten door te oefenen!"
    >
      <span className="text-lg">⭐</span>
      <span>{points}</span>
      <span className="text-xs opacity-90">pts</span>
    </button>
  );
}
