import React, { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

function useUserId() {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data }) => { if (alive) setId(data.user?.id ?? null); });
    return () => { alive = false; };
  }, []);
  return id;
}

function getQueryParam(name: string) {
  try { return new URLSearchParams(window.location.search).get(name); }
  catch { return null; }
}

function normalizeChoices(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return [];
    try {
      const parsed = JSON.parse(s);
      return Array.isArray(parsed) ? parsed.map(String) : [s];
    } catch {
      if (s.includes("\n")) return s.split("\n").map(t=>t.trim()).filter(Boolean);
      if (s.includes(";")) return s.split(";").map(t=>t.trim()).filter(Boolean);
      if (s.includes(",")) return s.split(",").map(t=>t.trim()).filter(Boolean);
      return [s];
    }
  }
  try { return JSON.parse(String(raw)); } catch { return [String(raw)]; }
}

function eq(a?: string | null, b?: string | null) {
  return String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();
}

export default function StudyPlay() {
  const userId = useUserId();
  const quizId = getQueryParam("quiz");

  const [resultId, setResultId] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(false);
  const [uiError, setUiError] = useState<string | null>(null);

  // Feedback state
  const [showFb, setShowFb] = useState(false);
  const [selected, setSelected] = useState<string>("");
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [correctAnswer, setCorrectAnswer] = useState<string>("");

  // Live score / progress
  const answeredSet = useRef<Set<number>>(new Set());
  const [answeredCount, setAnsweredCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);

  const questions = useQuery({
    queryKey: ["quiz-questions", quizId, userId],
    enabled: !!userId && !!quizId,
    queryFn: async () => {
      const res = await fetch(`/api/quizzes/questions?quiz_id=${encodeURIComponent(quizId!)}`, {
        headers: { "x-user-id": userId! },
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      return Array.isArray(json.data) ? json.data : [];
    },
  });

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

  // Start poging
  useEffect(() => {
    if (!userId || !quizId) return;
    let cancelled = false;
    play.mutate(
      { action: "start", quiz_id: quizId },
      { onSuccess: (r) => { if (!cancelled) setResultId(r?.result?.id ?? null); } }
    );
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, quizId]);

  const list = questions.data ?? [];
  const q = list[index];

  // Finish poging zodra alles beantwoord is
  const finishedRef = useRef(false);
  useEffect(() => {
    const allAnswered = index >= list.length && list.length > 0;
    if (allAnswered && resultId && !finishedRef.current) {
      finishedRef.current = true;
      play.mutate(
        { action: "finish", result_id: resultId },
        { onSuccess: () => setDone(true), onError: () => setDone(true) }
      );
    }
  }, [index, list.length, resultId, play]);

  const resetFeedback = () => {
    setShowFb(false);
    setSelected("");
    setIsCorrect(null);
    setCorrectAnswer("");
  };

  const next = () => {
    resetFeedback();
    setIndex((i) => i + 1);
  };

  function countThisAnswer(correct: boolean | null) {
    if (!answeredSet.current.has(index)) {
      answeredSet.current.add(index);
      setAnsweredCount((c) => c + 1);
      if (correct === true) setCorrectCount((c) => c + 1);
    }
  }

  const answerMC = (choice: string) => {
    if (!q || !resultId) return;
    const correct = eq(choice, q.answer);
    setSelected(choice);
    setIsCorrect(correct);
    setCorrectAnswer(q.answer ?? "");
    setShowFb(true);
    countThisAnswer(correct);
    play.mutate({ action: "answer", result_id: resultId, question_id: q.id, given_answer: choice });
  };

  const answerOpen = (value: string) => {
    if (!q || !resultId) return;
    const correct = q.answer ? eq(value, q.answer) : null;
    setSelected(value);
    setIsCorrect(correct);
    setCorrectAnswer(q.answer ?? "");
    setShowFb(true);
    countThisAnswer(correct);
    play.mutate({ action: "answer", result_id: resultId, question_id: q.id, given_answer: value });
  };

  // UI states
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

  // Klaar scherm
  if (done || (list.length > 0 && index >= list.length)) {
    const pctDone = list.length ? Math.round((correctCount / list.length) * 100) : 0;
    return (
      <main className="mx-auto max-w-[800px] px-6 py-8">
        <h1 className="text-2xl font-semibold mb-4">Klaar!</h1>
        <p className="mb-2">Je antwoorden zijn opgeslagen.</p>
        <p className="mb-6">Score: <b>{correctCount}</b> / {list.length} ({pctDone}%)</p>
        <a className="text-sky-700 underline" href="/toets">Terug naar Toetsen</a>
      </main>
    );
  }

  if (list.length === 0) {
    return (
      <main className="mx-auto max-w-[800px] px-6 py-8">
        <h1 className="text-xl font-semibold mb-4">Deze toets heeft nog geen vragen.</h1>
        <a className="text-sky-700 underline" href="/toets">Terug naar Toetsen</a>
      </main>
    );
  }

  // Header met voortgang + score
  const pct = list.length ? Math.round((answeredCount / list.length) * 100) : 0;

  const qtype: string = (q.qtype ?? "mc").toLowerCase();
  const prompt: string = q.prompt ?? "";
  const choices = normalizeChoices(q.choices);
  const explanation: string = q.explanation ?? "";

  return (
    <main className="mx-auto max-w-[800px] px-6 py-8">
      {/* Voortgang + Score */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
          <span>Voortgang</span>
          <span>{pct}% · {answeredCount}/{list.length}</span>
        </div>
        <div className="h-2 rounded bg-gray-200 overflow-hidden">
          <div
            className="h-full bg-sky-600 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-2 text-sm">
          <span className="text-gray-600">Score: </span>
          <span className="font-medium">{correctCount}</span>
          <span className="text-gray-600"> / {answeredCount}</span>
        </div>
      </div>

      <div className="mb-2 text-sm text-gray-500">Vraag {index + 1} van {list.length}</div>
      <h1 className="text-xl font-semibold mb-4">{prompt}</h1>

      {/* Vraag body */}
      {qtype === "mc" ? (
        choices.length ? (
          <div className="grid gap-3">
            {choices.map((c: string, i: number) => {
              const isChosen = showFb && c === selected;
              const isRight = showFb && eq(c, correctAnswer);

              // duidelijke feedback:
              // - gekozen + juist: stevig groen
              // - gekozen + fout: stevig rood
              // - niet gekozen maar juist: groene omlijning
              const base = "text-left border rounded-xl p-3 transition-colors";
              const hover = showFb ? "" : " hover:bg-gray-50";
              const chosenRight = isChosen && isRight ? " border-emerald-600 bg-emerald-50" : "";
              const chosenWrong = isChosen && !isRight ? " border-red-600 bg-red-50" : "";
              const notChosenButRight = !isChosen && isRight ? " border-emerald-500" : "";
              const classes = [base, hover, chosenRight, chosenWrong, notChosenButRight].join(" ").trim();

              return (
                <button
                  key={i}
                  onClick={() => (showFb ? undefined : answerMC(c))}
                  className={classes}
                  disabled={showFb}
                >
                  <div className="flex items-start gap-2">
                    {showFb && isRight && <span aria-hidden>✅</span>}
                    {showFb && isChosen && !isRight && <span aria-hidden>❌</span>}
                    <span>{c}</span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-red-600">Deze meerkeuzevraag heeft geen opties.</p>
        )
      ) : (
        !showFb ? (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const inp = (e.target as HTMLFormElement).elements.namedItem("open") as HTMLInputElement;
              answerOpen(inp.value);
            }}
          >
            <input name="open" className="flex-1 border rounded-xl p-3" placeholder="Jouw antwoord" />
            <button className="px-4 py-2 rounded-xl bg-sky-600 text-white">Bevestigen</button>
          </form>
        ) : null
      )}

      {/* Feedback */}
      {showFb && (
        <div className="mt-6 rounded-xl border p-4 bg-white">
          {isCorrect === true && <p className="text-emerald-700 font-medium">✅ Goed!</p>}
          {isCorrect === false && <p className="text-red-700 font-medium">❌ Niet helemaal. Het juiste antwoord is:</p>}
          {isCorrect === null && <p className="text-sky-700 font-medium">📌 Antwoord geregistreerd.</p>}

          <div className="mt-2 text-sm text-gray-800">
            {selected && <div><span className="text-gray-500">Jouw antwoord:</span> {selected}</div>}
            {correctAnswer && !eq(selected, correctAnswer) && (
              <div><span className="text-gray-500">Juiste antwoord:</span> {correctAnswer}</div>
            )}
          </div>

          {explanation && (
            <div className="mt-3 text-sm text-gray-700">
              <span className="text-gray-500">Uitleg:</span> {explanation}
            </div>
          )}

          <div className="mt-4">
            <button onClick={next} className="px-4 py-2 rounded-xl bg-sky-600 text-white">
              Volgende
            </button>
          </div>
        </div>
      )}

      {uiError && <p className="mt-4 text-xs text-red-600">{uiError}</p>}
    </main>
  );
}
