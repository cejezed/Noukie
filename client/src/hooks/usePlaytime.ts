import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';

export interface PlaytimeData {
  balanceMinutes: number;
}

export function usePlaytime() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery<PlaytimeData>({
    queryKey: ['playtime', user?.id],
    queryFn: async () => {
      const response = await fetch('/api/playtime', {
        headers: {
          'x-user-id': user?.id || '',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch playtime');
      }

      return response.json();
    },
    enabled: !!user?.id,
  });

  const usePlaytimeMutation = useMutation({
    mutationFn: async (costMinutes: number) => {
      const response = await fetch('/api/playtime/use', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user?.id || '',
        },
        body: JSON.stringify({ costMinutes }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to use playtime');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playtime', user?.id] });
    },
  });

  return {
    balanceMinutes: data?.balanceMinutes || 0,
    isLoading,
    error,
    refetch,
    usePlaytime: usePlaytimeMutation.mutateAsync,
    isUsing: usePlaytimeMutation.isPending,
  };
}
