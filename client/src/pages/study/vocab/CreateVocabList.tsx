/**
 * Create Vocab List Page
 *
 * Admin UI for creating new vocabulary lists with bulk word import
 */

import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/** Get current user ID */
async function getUid() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/** Parse bulk words from textarea (term | translation format) */
function parseBulkWords(text: string): Array<{ term: string; translation: string }> {
  const lines = text.split('\n').filter((line) => line.trim());
  const words: Array<{ term: string; translation: string }> = [];

  for (const line of lines) {
    // Support both | and tab as separator
    const parts = line.split(/[|\t]/).map((p) => p.trim());

    if (parts.length >= 2 && parts[0] && parts[1]) {
      words.push({
        term: parts[0],
        translation: parts[1],
      });
    }
  }

  return words;
}

export default function CreateVocabList() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('Engels');
  const [grade, setGrade] = useState<number | ''>('');
  const [languageFrom, setLanguageFrom] = useState('Engels');
  const [languageTo, setLanguageTo] = useState('Nederlands');
  const [bulkWords, setBulkWords] = useState('');

  // Preview
  const [wordPreview, setWordPreview] = useState<Array<{ term: string; translation: string }>>([]);

  useEffect(() => {
    getUid().then(setUserId);
  }, []);

  // Parse words preview
  useEffect(() => {
    if (bulkWords.trim()) {
      const parsed = parseBulkWords(bulkWords);
      setWordPreview(parsed);
    } else {
      setWordPreview([]);
    }
  }, [bulkWords]);

  // Create list mutation
  const createList = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Not authenticated');

      // 1. Create list
      const listRes = await fetch('/api/vocab/lists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({
          subject,
          grade: grade || null,
          title,
          language_from: languageFrom,
          language_to: languageTo,
        }),
      });

      if (!listRes.ok) {
        const error = await listRes.text();
        throw new Error(error);
      }

      const { data: list } = await listRes.json();

      // 2. Add items (if any)
      if (wordPreview.length > 0) {
        const itemsRes = await fetch('/api/vocab/items', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': userId,
          },
          body: JSON.stringify({
            list_id: list.id,
            items: wordPreview,
          }),
        });

        if (!itemsRes.ok) {
          console.warn('Failed to add some items:', await itemsRes.text());
        }
      }

      return list;
    },
    onSuccess: (list) => {
      // Invalidate lists cache
      queryClient.invalidateQueries({ queryKey: ['vocab-lists'] });

      // Navigate to overview
      navigate('/study/words');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !subject.trim() || !languageFrom.trim() || !languageTo.trim()) {
      alert('Vul alle verplichte velden in');
      return;
    }

    createList.mutate();
  };

  if (!userId) {
    return (
      <main className="mx-auto max-w-[1000px] px-6 py-8">
        <p>Inloggen vereist…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1000px] px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Nieuwe woordenlijst</h1>
        <button
          onClick={() => navigate('/study/words')}
          className="text-gray-500 hover:text-gray-700"
        >
          ← Terug
        </button>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow p-6">
        {/* List metadata */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Titel *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Bijv: Animals - Set 1"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Vak *
            </label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="Engels">Engels</option>
              <option value="Duits">Duits</option>
              <option value="Frans">Frans</option>
              <option value="Spaans">Spaans</option>
              <option value="Nederlands">Nederlands</option>
              <option value="Algemeen">Algemeen</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Klas (optioneel)
            </label>
            <input
              type="number"
              value={grade}
              onChange={(e) => setGrade(e.target.value ? parseInt(e.target.value) : '')}
              placeholder="Bijv: 5"
              min="1"
              max="6"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Van taal *
            </label>
            <select
              value={languageFrom}
              onChange={(e) => setLanguageFrom(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="Engels">Engels</option>
              <option value="Duits">Duits</option>
              <option value="Frans">Frans</option>
              <option value="Spaans">Spaans</option>
              <option value="Nederlands">Nederlands</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Naar taal *
            </label>
            <select
              value={languageTo}
              onChange={(e) => setLanguageTo(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="Nederlands">Nederlands</option>
              <option value="Engels">Engels</option>
              <option value="Duits">Duits</option>
              <option value="Frans">Frans</option>
              <option value="Spaans">Spaans</option>
            </select>
          </div>
        </div>

        {/* Bulk words input */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Woorden toevoegen (optioneel)
          </label>
          <p className="text-xs text-gray-500 mb-2">
            Voer één woord per regel in, gescheiden door | of Tab
            <br />
            Bijvoorbeeld: <code className="bg-gray-100 px-1">cat | kat</code>
          </p>
          <textarea
            value={bulkWords}
            onChange={(e) => setBulkWords(e.target.value)}
            placeholder="cat | kat&#10;dog | hond&#10;bird | vogel"
            rows={10}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
          />
        </div>

        {/* Preview */}
        {wordPreview.length > 0 && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h3 className="font-semibold text-blue-900 mb-2">
              Preview ({wordPreview.length} woorden)
            </h3>
            <div className="space-y-1 max-h-[200px] overflow-y-auto">
              {wordPreview.slice(0, 10).map((word, idx) => (
                <div key={idx} className="text-sm text-blue-800">
                  <span className="font-medium">{word.term}</span> →{' '}
                  <span>{word.translation}</span>
                </div>
              ))}
              {wordPreview.length > 10 && (
                <div className="text-xs text-blue-600">
                  ... en nog {wordPreview.length - 10} woorden
                </div>
              )}
            </div>
          </div>
        )}

        {/* Submit */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={createList.isPending}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 font-medium"
          >
            {createList.isPending ? 'Bezig...' : 'Lijst aanmaken'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/study/words')}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            Annuleren
          </button>
        </div>

        {createList.isError && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            Fout: {(createList.error as Error).message}
          </div>
        )}
      </form>

      {/* Help section */}
      <section className="mt-6 bg-gray-50 border border-gray-200 rounded-2xl p-6">
        <h3 className="font-semibold text-gray-900 mb-2">💡 Tips</h3>
        <ul className="text-sm text-gray-700 space-y-1">
          <li>• Je kunt woorden ook later toevoegen via de lijst-detail pagina</li>
          <li>• Gebruik Tab of | om term en vertaling te scheiden</li>
          <li>• Kopieer makkelijk uit Excel: selecteer 2 kolommen en plak hier</li>
          <li>• Lege regels worden genegeerd</li>
        </ul>
      </section>
    </main>
  );
}
