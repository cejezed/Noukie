/**
 * Vocab List Detail/Edit Page
 *
 * View and manage a specific vocab list:
 * - View all items
 * - Add new items (bulk)
 * - Delete items
 * - Edit list metadata
 * - Start learn/test sessions
 */

import React, { useEffect, useState } from 'react';
import { useLocation, useRoute } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { VocabList, VocabItemWithProgress } from '@/types/vocab';
import { getMasteryLabel, getMasteryColor } from '@/types/vocab';

/** Get current user ID */
async function getUid() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/** Parse bulk words from textarea */
function parseBulkWords(text: string): Array<{ term: string; translation: string }> {
  const lines = text.split('\n').filter((line) => line.trim());
  const words: Array<{ term: string; translation: string }> = [];

  for (const line of lines) {
    const parts = line.split(/[|\t]/).map((p) => p.trim());
    if (parts.length >= 2 && parts[0] && parts[1]) {
      words.push({ term: parts[0], translation: parts[1] });
    }
  }

  return words;
}

export default function VocabListDetail() {
  const [, navigate] = useLocation();
  const [, params] = useRoute('/study/words/list/:id');
  const listId = params?.id || '';
  const queryClient = useQueryClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [showAddWords, setShowAddWords] = useState(false);
  const [bulkWords, setBulkWords] = useState('');

  useEffect(() => {
    getUid().then(setUserId);
  }, []);

  // Fetch list with items
  const listData = useQuery({
    queryKey: ['vocab-list-detail', listId, userId],
    enabled: !!userId && !!listId,
    queryFn: async () => {
      const res = await fetch(`/api/vocab/list?id=${listId}`, {
        headers: { 'x-user-id': userId! },
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      return {
        list: json.list as VocabList,
        items: json.items as VocabItemWithProgress[],
      };
    },
  });

  // Add items mutation
  const addItems = useMutation({
    mutationFn: async (items: Array<{ term: string; translation: string }>) => {
      const res = await fetch('/api/vocab/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId!,
        },
        body: JSON.stringify({
          list_id: listId,
          items,
        }),
      });

      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vocab-list-detail', listId] });
      queryClient.invalidateQueries({ queryKey: ['vocab-list', listId] });
      setBulkWords('');
      setShowAddWords(false);
    },
  });

  const handleAddWords = () => {
    const parsed = parseBulkWords(bulkWords);
    if (parsed.length === 0) {
      alert('Geen geldige woorden gevonden');
      return;
    }
    addItems.mutate(parsed);
  };

  if (!userId || listData.isLoading) {
    return (
      <main className="mx-auto max-w-[1000px] px-6 py-8">
        <p>Laden…</p>
      </main>
    );
  }

  if (listData.isError || !listData.data) {
    return (
      <main className="mx-auto max-w-[1000px] px-6 py-8">
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

  const { list, items } = listData.data;

  return (
    <main className="mx-auto max-w-[1000px] px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-semibold">{list.title}</h1>
          <button
            onClick={() => navigate('/study/words')}
            className="text-gray-500 hover:text-gray-700"
          >
            ← Terug
          </button>
        </div>
        <div className="text-sm text-gray-600">
          {list.subject}
          {list.grade && ` · Klas ${list.grade}`} · {list.language_from} → {list.language_to}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {items.length} {items.length === 1 ? 'woord' : 'woorden'}
        </div>
      </div>

      {/* Action buttons */}
      <div className="mb-6 flex flex-wrap gap-3">
        <button
          onClick={() => navigate(`/study/words/list/${listId}?mode=learn`)}
          disabled={items.length === 0}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 font-medium"
        >
          📖 Leren
        </button>
        <button
          onClick={() => navigate(`/study/words/list/${listId}?mode=test`)}
          disabled={items.length === 0}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 font-medium"
        >
          ✏️ Toetsen
        </button>
        <button
          onClick={() => setShowAddWords(!showAddWords)}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
        >
          + Woorden toevoegen
        </button>
      </div>

      {/* Add words section */}
      {showAddWords && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-2xl p-6">
          <h3 className="font-semibold text-green-900 mb-4">Woorden toevoegen</h3>
          <p className="text-xs text-gray-600 mb-2">
            Voer één woord per regel in, gescheiden door | of Tab
          </p>
          <textarea
            value={bulkWords}
            onChange={(e) => setBulkWords(e.target.value)}
            placeholder="cat | kat&#10;dog | hond&#10;bird | vogel"
            rows={8}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 font-mono text-sm mb-3"
          />
          <div className="flex gap-2">
            <button
              onClick={handleAddWords}
              disabled={addItems.isPending || !bulkWords.trim()}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300"
            >
              {addItems.isPending ? 'Bezig...' : 'Toevoegen'}
            </button>
            <button
              onClick={() => {
                setShowAddWords(false);
                setBulkWords('');
              }}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Annuleren
            </button>
          </div>
          {addItems.isError && (
            <div className="mt-3 text-sm text-red-600">
              Fout: {(addItems.error as Error).message}
            </div>
          )}
        </div>
      )}

      {/* Items list */}
      <div className="bg-white rounded-2xl shadow">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Woordenlijst</h2>
        </div>

        {items.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p className="mb-4">Nog geen woorden in deze lijst.</p>
            <button
              onClick={() => setShowAddWords(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Voeg woorden toe
            </button>
          </div>
        ) : (
          <div className="divide-y max-h-[600px] overflow-y-auto">
            {items.map((item) => {
              const masteryLevel = item.progress?.mastery_level ?? 0;
              const timesCorrect = item.progress?.times_correct ?? 0;
              const timesIncorrect = item.progress?.times_incorrect ?? 0;

              return (
                <div key={item.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-medium text-gray-900">{item.term}</span>
                        <span className="text-gray-400">→</span>
                        <span className="text-gray-700">{item.translation}</span>
                      </div>

                      {item.example_sentence && (
                        <div className="text-xs text-gray-500 italic mt-1">
                          "{item.example_sentence}"
                        </div>
                      )}

                      {item.progress && (
                        <div className="flex items-center gap-3 mt-2 text-xs">
                          <span className={`px-2 py-1 rounded-full ${getMasteryColor(masteryLevel)}`}>
                            {getMasteryLabel(masteryLevel)}
                          </span>
                          <span className="text-green-600">✓ {timesCorrect}</span>
                          <span className="text-red-600">✗ {timesIncorrect}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Stats */}
      {items.length > 0 && (
        <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-4">
          {[0, 1, 2, 3, 4, 5].map((level) => {
            const count = items.filter((item) => (item.progress?.mastery_level ?? 0) === level).length;
            return (
              <div key={level} className={`rounded-xl p-4 ${getMasteryColor(level)}`}>
                <div className="text-2xl font-bold">{count}</div>
                <div className="text-xs">{getMasteryLabel(level)}</div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
