import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

function useUserId() {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setId(data.user?.id ?? null));
  }, []);
  return id;
}

function getQueryParam(name: string) {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
  } catch {
    return null;
  }
}

function normalizeChoices(raw: unknown): string[] {
  // ondersteunt: null/undefined, string (JSON of plain), array
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return [];
    try {
      const parsed = JSON.parse(s);
      return Array.isArray(parsed) ? parsed.map(String) : [s];
    } catch {
      // geen JSON: splits op newline of ; of ,
      if (s.includes("\n")) return s.split("\n").map(t => t.trim()).filter(Boolean);
      if (s.includes(";")) return s.split(";").map(t => t.trim()).filter(Boolean);
      if (s.includes(",")) return s.split(",").map(t => t.trim()).filter(Boolean);
      return [s];
    }
  }
  // fallback
  try { return JSON.parse(String(raw)); } catch { return [String(raw)]; }
}

export default function StudyPlay() {
  const userId = useUserId();
  const quizId = getQueryParam("quiz");

  const [resultId, setResultId] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(false);
  const [uiError, setUiError] = useState<string | null>(null);

  // Haal vragen op
  const questions = useQuery({
    queryKey: ["quiz-questions", quizId, userId],
    enabled: !!userId && !!quizId,
    queryFn: async () => {
      const res = await fetch(`/api/quizzes/questions?quiz_id=${encodeURIComponent(quizId!)}`, {
        headers: { "x-user-id": userId! },
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      // verwacht array
      return Array.isArray(json.data) ? json.data : [];
    }
  });

  // Start poging als we ingelogd zijn + quizId hebben
  const play = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/quizzes/play", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": userId! },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onError: (e: any) => setUiError(String(e?.message || e)),
  });

  useEffect(() => {
    if (userId && quizId) {
      play.mutate(
        { action: "start", quiz_id: quizId },
        { onSuccess: (r) => setResultId(r?.result?.id ?? null) }
      );
    }
  }, [userId, quizId]);

  // ——— UI STATES ———
  if (!quizId) {
    return <main className="p-8"><p className="text-red-600">Geen quiz geselecteerd.</p></main>;
  }
  if (!userId) {
    return <main className="p-8"><p className="text-sm text-gray-500">Inloggen vereist…</p></main>;
  }
  if (questions.isLoading) {
    return <main className="p-8"><p>Laden…</p></main>;
  }
  if (questions.isError) {
    return (
      <main className="p-8">
        <p className="text-red-600">Kon vragen niet laden.</p>
        <pre className="mt-2 text-xs bg-gray-50 p-2 rounded">{String((questions.error as Error)?.message)}</pre>
      </main>
    );
  }

  const list = questions.data ?? [];
  const q = list[index];

  // Alle vragen afgewerkt -> finish
  if (!q) {
    if (!done && resultId) {
      play.mutate(
        { action: "finish", result_id: resultId },
        { onSuccess: () => setDone(true) }
      );
    }
    return (
      <main className="mx-auto max-w-[800px] px-6 py-8">
        <h1 className="text-2xl font-semibold mb-4">Klaar!</h1>
        <p>Je antwoorden zijn opgeslagen.</p>
        <a className="text-sky-700 underline" href="/toets">Terug naar Toetsen</a>
      </main>
    );
  }

  const qtype: string = (q.qtype ?? "mc").toLowerCase();
  const prompt: string = q.prompt ?? "";
  const answer: string = q.answer ?? "";
  const choices = normalizeChoices(q.choices);

  const submit = (value: string) => {
    try {
      if (resultId) {
        play.mutate({ action: "answer", result_id: resultId, question_id: q.id, given_answer: value });
      }
      setIndex((i) => i + 1);
    } catch (e: any) {
      setUiError(String(e?.message || e));
    }
  };

  return (
    <main className="mx-auto max-w-[800px] px-6 py-8">
      <div className="mb-6 text-sm text-gray-500">
        Vraag {index + 1} van {list.length}
      </div>
      <h1 className="text-xl font-semibold mb-4">{prompt}</h1>

      {qtype === "mc" ? (
        (choices.length ? (
          <div className="grid gap-3">
            {choices.map((c: string, i: number) => (
              <button
                key={i}
                onClick={() => submit(c)}
                className="text-left border rounded-xl p-3 hover:bg-gray-50"
              >
                {c}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-red-600">Deze meerkeuzevraag heeft geen opties.</p>
        ))
      ) : (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const inp = (e.target as HTMLFormElement).elements.namedItem("open") as HTMLInputElement;
            submit(inp.value);
          }}
        >
          <input name="open" className="flex-1 border rounded-xl p-3" placeholder="Jouw antwoord" defaultValue="" />
          <button className="px-4 py-2 rounded-xl bg-sky-600 text-white">Volgende</button>
        </form>
      )}

      {uiError && <p className="mt-4 text-xs text-red-600">{uiError}</p>}
    </main>
  );
}
