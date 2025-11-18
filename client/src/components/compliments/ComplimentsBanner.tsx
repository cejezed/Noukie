/**
 * Compliments Banner Component
 *
 * Shows recent vocab-related compliments
 * Displays at top of study pages
 */

import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

async function getUid() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

interface Compliment {
  id: string;
  message: string;
  from_name: string;
  created_at: string;
  metadata: any;
}

export default function ComplimentsBanner() {
  const [userId, setUserId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    getUid().then(setUserId);
  }, []);

  // Fetch recent vocab compliments
  const compliments = useQuery({
    queryKey: ['vocab-compliments', userId],
    enabled: !!userId,
    refetchInterval: 60000, // Refresh every minute
    queryFn: async () => {
      const { data, error } = await supabase
        .from('compliments')
        .select('*')
        .eq('user_id', userId!)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24h
        .order('created_at', { ascending: false })
        .limit(3);

      if (error) throw error;

      // Filter for vocab-related compliments
      return (data || []).filter(
        (c: Compliment) =>
          c.metadata?.source === 'vocab_system' ||
          c.metadata?.type?.includes('vocab')
      );
    },
  });

  if (!userId || compliments.isLoading || compliments.isError) {
    return null;
  }

  const visibleCompliments = (compliments.data || []).filter(
    (c: Compliment) => !dismissed.has(c.id)
  );

  if (visibleCompliments.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {visibleCompliments.map((compliment: Compliment) => (
        <div
          key={compliment.id}
          className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-2xl p-4 shadow-sm"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">🎉</span>
                <span className="text-sm font-semibold text-purple-900">
                  {compliment.from_name || 'Study Coach'}
                </span>
              </div>
              <p className="text-purple-900">{compliment.message}</p>
            </div>
            <button
              onClick={() => {
                const newDismissed = new Set(dismissed);
                newDismissed.add(compliment.id);
                setDismissed(newDismissed);
              }}
              className="ml-4 text-purple-400 hover:text-purple-600"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
