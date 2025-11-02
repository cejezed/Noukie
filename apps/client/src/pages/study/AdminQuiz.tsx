"use client";

import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// === Types (pas aan naar jouw eigen types indien nodig) ===
type Quiz = {
  id: string;
  user_id: string;
  subject: string;
  chapter: string;
  title: string;
  description?: string | null;
  is_published: boolean;
  created_at?: string;
};

type NewQuestion = {
  qtype: "mc" | "open";
  prompt: string;
  choices: string; // UI textarea (één optie per regel)
  answer: string;
  explanation?: string;
};

// === Kleine utils ===
function cx(...args: Array<string | false | null | undefined>) {
  return args.filter(Boolean).join(" ");
}

function fisherYates<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function normalizeText(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function dedupeCaseInsensitive(values: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const key = v.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(v);
    }
  }
  return out;
}

/**
 * Bouwt een geldige MC-keuzelijst:
 * - trimt & dedupliceert
 * - zorgt dat correctAnswer er precies 1x in zit
 * - kiest exact 3 afleiders (als er >3 zijn)
 * - shufflet de volgorde
 * Gooit een Error als er te weinig afleiders zijn.
 */
function buildShuffledChoices(
  rawChoicesLines: string[],
  correctAnswer: string
): string[] {
  const answer = normalizeText(correctAnswer);
  if (!answer) throw new Error("Juiste antwoord ontbreekt.");

  // 1) basis schoonmaak
  let options = rawChoicesLines
    .map(normalizeText)
    .filter(Boolean);

  // 2) dedupe
  options = dedupeCaseInsensitive(options);

  // 3) zorg dat correct answer erin zit precies 1x
  const hasAnswer = options.some((o) => o.toLowerCase() === answer.toLowerCase());
  if (!hasAnswer) {
    options.unshift(answer);
  } else {
    // als hij meerdere keren voorkomt (kan door andere schrijfwijze?) -> forceer naar 1x
    options = options.filter((o) => o.toLowerCase() !== answer.toLowerCase());
    options.unshift(answer);
  }

  // 4) kies exact 3 afleiders
  const distractors = options.slice(1); // alles behalve correct
  if (distractors.length < 3) {
    throw new Error("Je hebt minstens 3 plausibele afleiders nodig (naast het juiste antwoord).");
  }

  // als er meer dan 3 afleiders zijn, kies willekeurig 3
  const pickedDistractors = fisherYates(distractors).slice(0, 3);

  // 5) samenstellen + shuffle
  const finalChoices = fisherYates([answer, ...pickedDistractors]);

  // 6) laatste sanity: exact 4, correct 1x
  if (finalChoices.length !== 4) throw new Error("Interne fout: geen exact 4 opties.");
  const countAnswer = finalChoices.filter((o) => o.toLowerCase() === answer.toLowerCase()).length;
  if (countAnswer !== 1) throw new Error("Interne fout: correct antwoord niet exact 1× aanwezig.");

  return finalChoices;
}

// === API helpers (vervang evt. door jouw fetchers) ===
async function getUserId(): Promise<string | null> {
  // In jouw code haal je dit via Supabase auth; gebruik je eigen implementatie.
  const res = await fetch("/api/whoami");
  if (!res.ok) return null;
  const data = await res.json();
  return data?.user?.id ?? null;
}

async function fetchQuizzes(uid: string | null) {
  if (!uid) return [];
  const res = await fetch(`/api/quizzes?uid=${encodeURIComponent(uid)}`);
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as Quiz[];
}

export default function AdminQuiz() {
  const qc = useQueryClient();
  const [uid, setUid] = useState<string | null>(null);

  React.useEffect(() => {
    getUserId().then(setUid).catch(() => setUid(null));
  }, []);

  // === State ===
  const [form, setForm] = useState({
    subject: "",
    chapter: "",
    title: "",
    description: "",
    is_published: false,
  });

  const [selectedQuiz, setSelectedQuiz] = useState<string | null>(null);
  const [newQ, setNewQ] = useState<NewQuestion>({
    qtype: "mc",
    prompt: "",
    choices: "",
    answer: "",
    explanation: "",
  });

  // Bulk-import (optioneel)
  const [bulkInput, setBulkInput] = useState<string>("");

  // === Queries ===
  const quizzes = useQuery({
    queryKey: ["quizzes-admin", uid],
    queryFn: () => fetchQuizzes(uid),
    enabled: !!uid,
  });

  // === Mutations ===
  const saveQuiz = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/quizzes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": uid ?? "",
        },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quizzes-admin", uid] });
      setForm({
        subject: "",
        chapter: "",
        title: "",
        description: "",
        is_published: false,
      });
    },
  });

  const addQuestions = useMutation({
    mutationFn: async () => {
      if (!selectedQuiz) throw new Error("Kies eerst een quiz.");
      if (!newQ.prompt.trim()) throw new Error("Vraag ontbreekt.");
      if (newQ.qtype === "mc" && !newQ.answer.trim()) {
        throw new Error("Juiste antwoord ontbreekt.");
      }

      let payloadChoices: string[] | undefined;
      if (newQ.qtype === "mc") {
        const rawLines = newQ.choices.split("\n");
        // === HIER gebeurt de MAGIC SHUFFLE ===
        const shuffled = buildShuffledChoices(rawLines, newQ.answer);
        payloadChoices = shuffled;
      }

      const payload = {
        quiz_id: selectedQuiz,
        items: [
          {
            qtype: newQ.qtype,
            prompt: normalizeText(newQ.prompt),
            choices: newQ.qtype === "mc" ? payloadChoices : undefined,
            answer: newQ.qtype === "mc" ? normalizeText(newQ.answer) : normalizeText(newQ.answer || ""),
            explanation: normalizeText(newQ.explanation || ""),
          },
        ],
      };

      const res = await fetch("/api/quizzes/questions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": uid ?? "",
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      setNewQ({ qtype: "mc", prompt: "", choices: "", answer: "", explanation: "" });
    },
  });

  // === Bulk import (optioneel) ===
  const addBulk = useMutation({
    mutationFn: async () => {
      if (!selectedQuiz) throw new Error("Kies eerst een quiz.");
      const lines = bulkInput
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      if (lines.length === 0) throw new Error("Geen regels gevonden.");

      const items = lines.map((line, idx) => {
        // Verwacht formaat: Vraag | Juiste | mc | A;B;C;D
        const parts = line.split("|").map((p) => p.trim());
        if (parts.length !== 4) {
          throw new Error(`Regel ${idx + 1}: verwacht 4 velden gescheiden door |`);
        }
        const [promptRaw, answerRaw, qtypeRaw, optionsRaw] = parts;
        const qtype = (qtypeRaw || "").toLowerCase() as "mc" | "open";
        if (qtype !== "mc") {
          throw new Error(`Regel ${idx + 1}: derde kolom moet 'mc' zijn voor meerkeuze.`);
        }
        const rawOptions = optionsRaw.split(";").map((s) => s.trim()).filter(Boolean);

        const shuffled = buildShuffledChoices(rawOptions, answerRaw);

        return {
          qtype: "mc" as const,
          prompt: normalizeText(promptRaw),
          choices: shuffled,
          answer: normalizeText(answerRaw),
          explanation: "",
        };
      });

      const payload = { quiz_id: selectedQuiz, items };
      const res = await fetch("/api/quizzes/questions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": uid ?? "",
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      setBulkInput("");
    },
  });

  return (
    <main className="mx-auto max-w-[1000px] px-6 py-8">
      <h1 className="text-2xl font-semibold mb-6">Quiz Admin</h1>

      {/* Nieuwe quiz */}
      <section className="mb-10 bg-white p-5 rounded-2xl shadow">
        <h2 className="font-semibold mb-4">Nieuwe quiz</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            className="border p-2 rounded"
            placeholder="Vak (subject)"
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
          />
          <input
            className="border p-2 rounded"
            placeholder="Hoofdstuk (chapter)"
            value={form.chapter}
            onChange={(e) => setForm({ ...form, chapter: e.target.value })}
          />
          <input
            className="border p-2 rounded md:col-span-2"
            placeholder="Titel"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <textarea
            className="border p-2 rounded md:col-span-2"
            placeholder="Omschrijving (kort)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.is_published}
              onChange={(e) => setForm({ ...form, is_published: e.target.checked })}
            />
            Publiceren
          </label>
          <button
            className="bg-emerald-600 text-white px-4 py-2 rounded"
            onClick={() => saveQuiz.mutate()}
          >
            Opslaan
          </button>
        </div>
      </section>

      {/* Vragen toevoegen (enkel) */}
      <section className="mb-10 bg-white p-5 rounded-2xl shadow">
        <h2 className="font-semibold mb-4">Vragen toevoegen aan quiz</h2>
        <div className="mb-3">
          <select
            className="border p-2 rounded"
            value={selectedQuiz ?? ""}
            onChange={(e) => setSelectedQuiz(e.target.value)}
          >
            <option value="">— Kies quiz —</option>
            {quizzes.data?.map((q) => (
              <option key={q.id} value={q.id}>
                {q.subject} · {q.chapter} · {q.title}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <select
            className="border p-2 rounded"
            value={newQ.qtype}
            onChange={(e) => setNewQ({ ...newQ, qtype: e.target.value as any })}
          >
            <option value="mc">Meerkeuze</option>
            <option value="open">Open vraag</option>
          </select>

          <input
            className="border p-2 rounded"
            placeholder="Juiste antwoord"
            value={newQ.answer}
            onChange={(e) => setNewQ({ ...newQ, answer: e.target.value })}
          />

          <textarea
            className="border p-2 rounded md:col-span-2"
            placeholder="Vraag"
            value={newQ.prompt}
            onChange={(e) => setNewQ({ ...newQ, prompt: e.target.value })}
          />

          {newQ.qtype === "mc" && (
            <textarea
              className="border p-2 rounded md:col-span-2"
              placeholder={"Meerkeuze-opties (één per regel, incl. het juiste antwoord of alleen de 3 afleiders)"}
              value={newQ.choices}
              onChange={(e) => setNewQ({ ...newQ, choices: e.target.value })}
            />
          )}

          <textarea
            className="border p-2 rounded md:col-span-2"
            placeholder="Uitleg (optioneel)"
            value={newQ.explanation}
            onChange={(e) => setNewQ({ ...newQ, explanation: e.target.value })}
          />

          <button
            className="bg-sky-600 text-white px-4 py-2 rounded"
            onClick={() => addQuestions.mutate()}
          >
            Vraag toevoegen (met shuffle)
          </button>
        </div>
      </section>

      {/* Bulk import (optioneel) */}
      <section className="mb-10 bg-white p-5 rounded-2xl shadow">
        <h2 className="font-semibold mb-4">Bulk import (| en ;) — Shuffle in app</h2>
        <p className="text-sm text-gray-600 mb-2">
          Formaat: <code>Vraag | JuisteAntwoord | mc | Optie1;Optie2;Optie3;Optie4</code>
        </p>
        <textarea
          className="border p-2 rounded w-full h-48 mb-3"
          placeholder="Plak hier je bulkregels..."
          value={bulkInput}
          onChange={(e) => setBulkInput(e.target.value)}
        />
        <div className="flex gap-2">
          <button
            className="bg-indigo-600 text-white px-4 py-2 rounded"
            onClick={() => addBulk.mutate()}
          >
            Bulk importeren (met shuffle)
          </button>
        </div>
      </section>
    </main>
  );
}
