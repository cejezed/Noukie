import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

function useUserId() {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setId(data.user?.id ?? null));
  }, []);
  return id;
}

export default function QuizletImport() {
  const userId = useUserId();
  const [subject, setSubject] = useState("");
  const [chapter, setChapter] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<"open" | "mc">("open");
  const [generateMc, setGenerateMc] = useState(true);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok?: boolean; quiz_id?: string; questions?: number; error?: string } | null>(null);

  if (!userId) {
    return (
      <main className="mx-auto max-w-[900px] px-6 py-8">
        <p className="text-sm text-gray-500">Inloggen vereist…</p>
      </main>
    );
  }

  const canSubmit = subject && chapter && title && text;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/quizzes/quizlet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
        },
        body: JSON.stringify({
          subject,
          chapter,
          title,
          description,
          mode,
          generateMc,
          text,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Import mislukt");
      setResult(json);
    } catch (err: any) {
      setResult({ error: String(err.message || err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-[900px] px-6 py-8">
      <h1 className="text-2xl font-semibold mb-6">Quizlet importeren</h1>
      <form onSubmit={onSubmit} className="space-y-4 bg-white rounded-2xl shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            className="border rounded p-2"
            placeholder="Vak (subject) — bv. Aardrijkskunde"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
          <input
            className="border rounded p-2"
            placeholder="Hoofdstuk (chapter) — bv. Rijn & Maas"
            value={chapter}
            onChange={(e) => setChapter(e.target.value)}
          />
          <input
            className="border rounded p-2 md:col-span-2"
            placeholder="Titel — bv. Rijn & Maas – set 1"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className="border rounded p-2 md:col-span-2"
            placeholder="Omschrijving (optioneel)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2">
            <span className="text-sm">Modus:</span>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as any)}
              className="border rounded p-2"
            >
              <option value="open">Open vragen</option>
              <option value="mc">Meerkeuze</option>
            </select>
          </label>

          {mode === "mc" && (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={generateMc}
                onChange={(e) => setGenerateMc(e.target.checked)}
              />
              <span className="text-sm">Genereer afleiders automatisch</span>
            </label>
          )}
        </div>

        <div>
          <label className="block text-sm mb-1">Plak hier je Quizlet export (TSV/CSV of gekopieerde regels “term[TAB]def”):</label>
          <textarea
            className="w-full border rounded p-3 min-h-[200px]"
            placeholder={"voorbeeld:\nStroomgebied\tGebied waar water naar één rivier stroomt\nUiterwaard\tGebied tussen rivier en winterdijk dat kan overstromen"}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            disabled={!canSubmit || busy}
            className={`px-4 py-2 rounded ${canSubmit ? "bg-emerald-600 text-white" : "bg-gray-300 text-gray-600"}`}
          >
            {busy ? "Importeren…" : "Importeren"}
          </button>
          {result?.ok && (
            <a className="text-sky-700 underline" href={`/toets/spelen?quiz=${result.quiz_id}`}>
              Ga naar quiz
            </a>
          )}
        </div>

        {result?.error && <p className="text-red-600 text-sm">{result.error}</p>}
        {result?.ok && (
          <p className="text-sm text-gray-700">
            Klaar: {result.questions} vragen toegevoegd. De quiz is nog <b>niet gepubliceerd</b> — controleer en publiceer via je Admin (of maak het daar zichtbaar).
          </p>
        )}
      </form>
    </main>
  );
}
