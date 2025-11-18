import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { usePlaytime } from '../../hooks/usePlaytime';
import { useProfile } from '../../hooks/useProfile';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { X, Trophy, Star, Clock, Zap } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface MiniGameShellProps {
  gameId: string;
  name: string;
  costMinutes: number;
  durationSeconds: number;
  onClose: () => void;
  children: (props: GameChildProps) => React.ReactNode;
}

export interface GameChildProps {
  onScoreChange: (score: number) => void;
  onGameOver: () => void;
  timeRemaining: number;
  isActive: boolean;
}

export function MiniGameShell({
  gameId,
  name,
  costMinutes,
  durationSeconds,
  onClose,
  children,
}: MiniGameShellProps) {
  const { user } = useAuth();
  const { usePlaytime: deductPlaytime, balanceMinutes, refetch: refetchPlaytime } = usePlaytime();
  const { refetch: refetchProfile } = useProfile();
  const queryClient = useQueryClient();

  const [gameState, setGameState] = useState<'loading' | 'playing' | 'finished' | 'error'>('loading');
  const [score, setScore] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(durationSeconds);
  const [errorMessage, setErrorMessage] = useState('');
  const [reward, setReward] = useState<{ xp: number; leveledUp: boolean; newLevel: number } | null>(null);

  // Submit score mutation
  const submitScoreMutation = useMutation({
    mutationFn: async (finalScore: number) => {
      const response = await fetch('/api/score/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user?.id || '',
        },
        body: JSON.stringify({
          gameId,
          score: finalScore,
          levelReached: null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit score');
      }

      return response.json();
    },
    onSuccess: (data) => {
      setReward({
        xp: data.xpAwarded || 0,
        leveledUp: data.leveledUp || false,
        newLevel: data.newLevel || 1,
      });

      // Refresh playtime and profile
      refetchPlaytime();
      refetchProfile();

      // Invalidate leaderboard queries
      queryClient.invalidateQueries({ queryKey: ['leaderboard', gameId] });
      queryClient.invalidateQueries({ queryKey: ['highscore', user?.id, gameId] });
    },
  });

  // Initialize game: deduct playtime
  useEffect(() => {
    const initGame = async () => {
      try {
        if (balanceMinutes < costMinutes) {
          setErrorMessage(`Je hebt ${costMinutes} speelminuten nodig om dit spel te spelen.`);
          setGameState('error');
          return;
        }

        // Deduct playtime
        await deductPlaytime(costMinutes);

        // Start game
        setGameState('playing');
      } catch (error: any) {
        setErrorMessage(error.message || 'Fout bij starten van spel');
        setGameState('error');
      }
    };

    initGame();
  }, []); // Run once on mount

  // Timer countdown
  useEffect(() => {
    if (gameState !== 'playing') return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleGameOver();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState]);

  const handleScoreChange = useCallback((newScore: number) => {
    setScore(newScore);
  }, []);

  const handleGameOver = useCallback(() => {
    if (gameState === 'finished') return; // Prevent double submission

    setGameState('finished');

    // Submit score
    submitScoreMutation.mutate(score);
  }, [gameState, score, submitScoreMutation]);

  const handleClose = () => {
    // If game is still playing, submit score before closing
    if (gameState === 'playing') {
      handleGameOver();
    }
    onClose();
  };

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-auto">
        <CardHeader className="flex flex-row items-center justify-between border-b">
          <CardTitle className="text-xl">{name}</CardTitle>
          <div className="flex items-center gap-4">
            {gameState === 'playing' && (
              <>
                <div className="flex items-center gap-2 text-gray-700">
                  <Clock className="w-5 h-5" />
                  <span className="font-mono text-lg">{formatTime(timeRemaining)}</span>
                </div>
                <div className="flex items-center gap-2 text-blue-600">
                  <Trophy className="w-5 h-5" />
                  <span className="font-mono text-lg">{score}</span>
                </div>
              </>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {gameState === 'loading' && (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Spel laden...</p>
              </div>
            </div>
          )}

          {gameState === 'error' && (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="text-6xl mb-4">😞</div>
                <p className="text-red-600 mb-4">{errorMessage}</p>
                <Button onClick={onClose}>Sluiten</Button>
              </div>
            </div>
          )}

          {gameState === 'playing' && (
            <div className="relative">
              {children({
                onScoreChange: handleScoreChange,
                onGameOver: handleGameOver,
                timeRemaining,
                isActive: true,
              })}
            </div>
          )}

          {gameState === 'finished' && (
            <div className="flex items-center justify-center py-20">
              <div className="text-center max-w-md">
                <div className="text-6xl mb-4">🎉</div>
                <h3 className="text-2xl font-bold mb-2">Spel afgelopen!</h3>
                <div className="bg-blue-50 rounded-lg p-6 mb-6">
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <Trophy className="w-8 h-8 text-amber-500" />
                    <span className="text-4xl font-bold">{score}</span>
                  </div>
                  <p className="text-gray-700">Je score</p>
                </div>

                {reward && (
                  <div className="bg-gradient-to-r from-purple-100 to-blue-100 rounded-lg p-6 mb-6">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Star className="w-6 h-6 text-purple-600" />
                      <span className="text-2xl font-bold text-purple-700">+{reward.xp} XP</span>
                    </div>
                    {reward.leveledUp && (
                      <div className="flex items-center justify-center gap-2 mt-3 text-green-600">
                        <Zap className="w-5 h-5" />
                        <span className="font-semibold">Level {reward.newLevel}! 🎉</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Button onClick={onClose} className="w-full">
                    Terug naar Speelhal
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
