/**
 * Study Words Overview Page
 *
 * Lists all vocab lists for the user
 * Allows navigation to learn/test modes
 */

import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { VocabList, DueVocabItem } from '@/types/vocab';
import { formatDueDate } from '@/types/vocab';
import RewardsBadge from '@/components/rewards/RewardsBadge';
import ComplimentsBanner from '@/components/compliments/ComplimentsBanner';

/** Get current user ID */
async function getUid() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export default function StudyWordsOverview() {
  const [, navigate] = useLocation();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    getUid().then(setUserId);
  }, []);

  // Fetch vocab lists
  const vocabLists = useQuery({
    queryKey: ['vocab-lists', userId],
    enabled: !!userId,
    queryFn: async () => {
      const res = await fetch('/api/vocab/lists', {
        headers: { 'x-user-id': userId! },
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      return json.data as VocabList[];
    },
  });

  // Fetch due items count
  const dueItems = useQuery({
    queryKey: ['vocab-due', userId],
    enabled: !!userId,
    queryFn: async () => {
      const res = await fetch('/api/vocab/due', {
        headers: { 'x-user-id': userId! },
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      return json.data as DueVocabItem[];
    },
  });

  return (
    <main className="mx-auto max-w-[1000px] px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Woordentrainer</h1>
        <RewardsBadge />
      </div>

      {/* Compliments banner */}
      <ComplimentsBanner />

      {/* Due items banner */}
      {dueItems.data && dueItems.data.length > 0 && (
        <section className="mb-6 bg-emerald-50 border border-emerald-200 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-emerald-900">
                Vandaag te oefenen
              </h2>
              <p className="text-sm text-emerald-700">
                {dueItems.data.length} {dueItems.data.length === 1 ? 'woord' : 'woorden'}{' '}
                wacht op jou!
              </p>
            </div>
            <button
              onClick={() => navigate('/study/words/due')}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
            >
              Start oefenen
            </button>
          </div>
        </section>
      )}

      {/* Lists section */}
      <section className="bg-white rounded-2xl shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Mijn lijsten</h2>
          <button
            onClick={() => navigate('/study/words/create')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            + Nieuwe lijst
          </button>
        </div>

        {!userId ? (
          <p className="text-sm text-gray-500">Inloggen vereist…</p>
        ) : vocabLists.isLoading ? (
          <p>Laden…</p>
        ) : vocabLists.isError ? (
          <p className="text-red-600">Er ging iets mis bij het laden.</p>
        ) : vocabLists.data?.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {vocabLists.data.map((list) => {
              const listDueItems = dueItems.data?.filter(
                (item) => item.list?.id === list.id
              );
              const dueCount = listDueItems?.length || 0;

              return (
                <div
                  key={list.id}
                  className="bg-white border rounded-2xl p-4 hover:shadow transition-shadow"
                >
                  {/* List info */}
                  <div className="mb-3">
                    <div className="text-sm text-gray-500">
                      {list.subject}
                      {list.grade && ` · Klas ${list.grade}`}
                    </div>
                    <div className="font-semibold">{list.title}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {list.language_from} → {list.language_to}
                    </div>
                  </div>

                  {/* Due items badge */}
                  {dueCount > 0 && (
                    <div className="mb-3 inline-block px-2 py-1 bg-emerald-100 text-emerald-700 text-xs rounded-full">
                      {dueCount} te oefenen
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => navigate(`/study/words/list/${list.id}?mode=learn`)}
                      className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                      📖 Leren
                    </button>
                    <button
                      onClick={() => navigate(`/study/words/list/${list.id}?mode=test`)}
                      className="flex-1 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                    >
                      ✏️ Toetsen
                    </button>
                  </div>

                  {/* View details link */}
                  <button
                    onClick={() => navigate(`/study/words/list/${list.id}/detail`)}
                    className="mt-2 w-full text-center text-xs text-gray-500 hover:text-gray-700"
                  >
                    Details bekijken
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-600 mb-4">Je hebt nog geen woordenlijsten.</p>
            <button
              onClick={() => navigate('/study/words/create')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Maak je eerste lijst
            </button>
          </div>
        )}
      </section>

      {/* Help section */}
      <section className="mt-6 bg-blue-50 border border-blue-200 rounded-2xl p-6">
        <h3 className="font-semibold text-blue-900 mb-2">Hoe werkt het?</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• <strong>Leren</strong>: Flashcards, flip om de vertaling te zien</li>
          <li>• <strong>Toetsen</strong>: Type het antwoord, test jezelf</li>
          <li>
            • <strong>Spaced repetition</strong>: Woorden komen terug op basis van je
            mastery
          </li>
          <li>• Oefen elke dag voor het beste resultaat!</li>
        </ul>
      </section>
    </main>
  );
}
