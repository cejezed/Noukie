/**
 * Study Words List Page
 *
 * Learn/Test mode for a specific vocab list
 * Uses useVocabSession hook for state management
 */

import React, { useEffect, useState } from 'react';
import { useLocation, useRoute } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useVocabSession } from '@/hooks/useVocabSession';
import type { VocabItemWithProgress, VocabSessionMode } from '@/types/vocab';
import { getMasteryLabel, getMasteryColor } from '@/types/vocab';

/** Get current user ID */
async function getUid() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export default function StudyWordsList() {
  const [, navigate] = useLocation();
  const [, params] = useRoute('/study/words/list/:id');
  const listId = params?.id || '';

  const [userId, setUserId] = useState<string | null>(null);
  const [answerInput, setAnswerInput] = useState('');
  const [sessionStats, setSessionStats] = useState<any>(null);

  // Get mode from query params (default: learn)
  const searchParams = new URLSearchParams(window.location.search);
  const mode = (searchParams.get('mode') as VocabSessionMode) || 'learn';

  useEffect(() => {
    getUid().then(setUserId);
  }, []);

  // Fetch list with items and progress
  const listData = useQuery({
    queryKey: ['vocab-list', listId, userId],
    enabled: !!userId && !!listId,
    queryFn: async () => {
      const res = await fetch(`/api/vocab/list?id=${listId}`, {
        headers: { 'x-user-id': userId! },
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      return {
        list: json.list,
        items: json.items as VocabItemWithProgress[],
      };
    },
  });

  // Update progress mutation
  const updateProgress = useMutation({
    mutationFn: async ({ item_id, is_correct }: { item_id: string; is_correct: boolean }) => {
      const res = await fetch('/api/vocab/progress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId!,
        },
        body: JSON.stringify({ item_id, is_correct }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  // Initialize session hook
  const session = useVocabSession({
    listId,
    listTitle: listData.data?.list?.title || '',
    items: listData.data?.items || [],
    mode,
    onComplete: (stats) => {
      setSessionStats(stats);
    },
  });

  // Handle answer submission in test mode
  const handleSubmitAnswer = async () => {
    if (!answerInput.trim() || !session.state.currentItem) return;

    const result = session.submitAnswer(answerInput);

    // Update progress in backend
    await updateProgress.mutateAsync({
      item_id: session.state.currentItem.id,
      is_correct: result.isCorrect,
    });

    // Clear input for next question
    setAnswerInput('');
  };

  // Handle marking in learn mode
  const handleMarkKnown = async () => {
    if (!session.state.currentItem) return;

    session.markKnown();

    // Update progress
    await updateProgress.mutateAsync({
      item_id: session.state.currentItem.id,
      is_correct: true,
    });

    // Auto-advance after short delay
    setTimeout(() => {
      session.nextItem();
    }, 500);
  };

  const handleMarkUnknown = async () => {
    if (!session.state.currentItem) return;

    session.markUnknown();

    // Update progress
    await updateProgress.mutateAsync({
      item_id: session.state.currentItem.id,
      is_correct: false,
    });

    // Auto-advance after short delay
    setTimeout(() => {
      session.nextItem();
    }, 500);
  };

  // Loading state
  if (!userId || listData.isLoading) {
    return (
      <main className="mx-auto max-w-[800px] px-6 py-8">
        <p>Laden…</p>
      </main>
    );
  }

  // Error state
  if (listData.isError || !listData.data) {
    return (
      <main className="mx-auto max-w-[800px] px-6 py-8">
        <p className="text-red-600">Lijst niet gevonden of geen toegang.</p>
        <button
          onClick={() => navigate('/study/words')}
          className="mt-4 px-4 py-2 bg-gray-600 text-white rounded-lg"
        >
          Terug naar overzicht
        </button>
      </main>
    );
  }

  // No items
  if (listData.data.items.length === 0) {
    return (
      <main className="mx-auto max-w-[800px] px-6 py-8">
        <h1 className="text-2xl font-semibold mb-4">{listData.data.list.title}</h1>
        <p className="text-gray-600">Deze lijst heeft nog geen woorden.</p>
        <button
          onClick={() => navigate('/study/words')}
          className="mt-4 px-4 py-2 bg-gray-600 text-white rounded-lg"
        >
          Terug naar overzicht
        </button>
      </main>
    );
  }

  // Completion screen
  if (session.state.isComplete || sessionStats) {
    const stats = sessionStats || session.finishSession();

    return (
      <main className="mx-auto max-w-[800px] px-6 py-8">
        <div className="bg-white rounded-2xl shadow p-8 text-center">
          <h1 className="text-3xl font-bold mb-2">🎉 Sessie voltooid!</h1>
          <p className="text-gray-600 mb-6">{listData.data.list.title}</p>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-green-50 rounded-xl p-4">
              <div className="text-3xl font-bold text-green-600">{stats.correctAnswers}</div>
              <div className="text-sm text-gray-600">Goed</div>
            </div>
            <div className="bg-red-50 rounded-xl p-4">
              <div className="text-3xl font-bold text-red-600">{stats.incorrectAnswers}</div>
              <div className="text-sm text-gray-600">Fout</div>
            </div>
          </div>

          <div className="mb-6">
            <div className="text-4xl font-bold text-blue-600">{stats.accuracyPercentage}%</div>
            <div className="text-sm text-gray-600">Score</div>
          </div>

          <div className="text-sm text-gray-500 mb-6">
            Tijd: {Math.floor(stats.duration / 60)}m {stats.duration % 60}s
          </div>

          <div className="flex gap-3 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Opnieuw oefenen
            </button>
            <button
              onClick={() => navigate('/study/words')}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Terug naar overzicht
            </button>
          </div>
        </div>
      </main>
    );
  }

  const { currentItem } = session.state;
  if (!currentItem) return null;

  const masteryLevel = currentItem.progress?.mastery_level ?? 0;

  return (
    <main className="mx-auto max-w-[800px] px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-semibold">{listData.data.list.title}</h1>
          <button
            onClick={() => navigate('/study/words')}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>
            {mode === 'learn' ? '📖 Leren' : '✏️ Toetsen'} · {session.state.currentIndex + 1} /{' '}
            {session.state.totalItems}
          </span>
          <span className={`px-2 py-1 rounded-full text-xs ${getMasteryColor(masteryLevel)}`}>
            {getMasteryLabel(masteryLevel)}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-6 bg-gray-200 rounded-full h-2 overflow-hidden">
        <div
          className="bg-blue-600 h-full transition-all duration-300"
          style={{
            width: `${((session.state.currentIndex + 1) / session.state.totalItems) * 100}%`,
          }}
        />
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl shadow-lg p-8 mb-6 min-h-[300px] flex flex-col items-center justify-center">
        {mode === 'learn' ? (
          // LEARN MODE: Flashcard
          <div
            className="text-center cursor-pointer w-full"
            onClick={session.flipCard}
          >
            <div className="text-sm text-gray-500 mb-4">
              {session.state.isFlipped ? 'Vertaling' : 'Klik om te draaien'}
            </div>
            <div className="text-3xl font-bold mb-4">
              {session.state.isFlipped ? currentItem.translation : currentItem.term}
            </div>
            {session.state.isFlipped && currentItem.example_sentence && (
              <div className="text-sm text-gray-600 italic mt-4">
                "{currentItem.example_sentence}"
              </div>
            )}
          </div>
        ) : (
          // TEST MODE: Input answer
          <div className="w-full">
            <div className="text-center mb-6">
              <div className="text-sm text-gray-500 mb-2">Vertaal</div>
              <div className="text-3xl font-bold">{currentItem.term}</div>
            </div>

            {!session.state.showResult ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={answerInput}
                  onChange={(e) => setAnswerInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') handleSubmitAnswer();
                  }}
                  placeholder="Type je antwoord..."
                  className="flex-1 px-4 py-3 border rounded-lg text-lg"
                  autoFocus
                />
                <button
                  onClick={handleSubmitAnswer}
                  disabled={!answerInput.trim()}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
                >
                  Check
                </button>
              </div>
            ) : (
              <div className="text-center">
                <div
                  className={`text-xl font-semibold mb-4 ${
                    session.state.lastAnswerCorrect ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {session.state.lastAnswerCorrect ? '✓ Correct!' : '✗ Fout'}
                </div>
                <div className="text-lg text-gray-700 mb-6">
                  Juiste antwoord: <strong>{currentItem.translation}</strong>
                </div>
                <button
                  onClick={() => {
                    session.nextItem();
                    setAnswerInput('');
                  }}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Volgende →
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action buttons */}
      {mode === 'learn' && session.state.isFlipped && (
        <div className="flex gap-3 justify-center">
          <button
            onClick={handleMarkUnknown}
            className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
          >
            ✗ Weet ik niet
          </button>
          <button
            onClick={handleMarkKnown}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
          >
            ✓ Weet ik
          </button>
        </div>
      )}

      {/* Score display */}
      <div className="mt-6 flex justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-green-600 font-semibold">✓ {session.state.correctAnswers}</span>
          <span className="text-gray-400">Goed</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-red-600 font-semibold">✗ {session.state.incorrectAnswers}</span>
          <span className="text-gray-400">Fout</span>
        </div>
      </div>
    </main>
  );
}
