"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

/** ===========================================
 *  Auth helper
 *  =========================================== */
async function getUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/** ===========================================
 *  Types
 *  =========================================== */
type Quiz = {
  id: string;
  user_id: string;
  subject: string;
  chapter: string;
  title: string;
  description?: string | null;
  is_published: boolean;
  assigned_to?: string | null;
  available_from?: string | null;
  available_until?: string | null;
  created_at?: string;
};

type Question = {
  id: string;
  quiz_id: string;
  qtype: "mc" | "open";
  prompt: string;
  choices?: string | null; // JSON string of string[]
  answer?: string | null;
  explanation?: string | null;
};

type Mode = "NEW" | "EDIT";

/** ===========================================
 *  Small utils
 *  =========================================== */
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = arr.slice();
  let s = (seed >>> 0) + 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (1103515245 * s + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function toLocalInputValue(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

/** ===========================================
 *  Flexible parsers
 *  Doel: alles slikken wat jij plakt:
 *   - "Vraag? Antwoord"
 *   - "Vraag | Antwoord | mc | Optie1;Optie2;Optie3" (jij levert de keuzes)
 *   - TSV: Vraag \t A \t B \t C \t D \t correct
 *   - Pipes: Vraag | A | B | C | D | correct
 *   - Chat-stijl blokken met A/B/C/D regels + "Antwoord:" (wordt doorgestuurd naar /api/quizlet)
 *  =========================================== */

type ParsedRow = {
  prompt: string;
  answer: string;
  qtype?: "mc" | "open";
  choices?: string[]; // alleen wanneer jij ze opgeeft; geen auto-generation
};

/** Herkent per REGEL simpele Q/A of expliciet MC met jouw keuzes */
function parseBulkLines(text: string): ParsedRow[] {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const rows: ParsedRow[] = [];

  for (const line of lines) {
    // 0) Chat-achtige “Antwoord:” niet hier verwerken (die doen we in bulkImport direct via /api/quizlet)
    if (/^antwo(ord)?\s*:/i.test(line)) continue;

    // 1) MC met pipes: Vraag | A | B | C | D | correct
    if (line.includes("|")) {
      const parts = line.split("|").map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        // Varianten:
        // a) Vraag | Antwoord (open)
        // b) Vraag | Antwoord | mc | A;B;C   (jij geeft correcte + afleiders)
        // c) Vraag | A | B | C | D | correct (MC met volledige kolommen)
        if (parts.length >= 6) {
          const [prompt, a, b, c, d, correctRaw] = parts;
          const choices = [a, b, c, d];
          let correct = correctRaw;

          // "correct" mag A/B/C/D of exact tekst zijn
          const letter = correct.toUpperCase();
          if (["A", "B", "C", "D"].includes(letter)) {
            const idx = { A: 0, B: 1, C: 2, D: 3 }[letter as "A" | "B" | "C" | "D"]!;
            correct = choices[idx];
          }
          // geen shuffle hier: jij bepaalt de volgorde. We bewaren exact.
          rows.push({ prompt, answer: correct, qtype: "mc", choices });
          continue;
        }

        if (parts.length >= 3 && parts[2].toLowerCase() === "mc") {
          const prompt = parts[0];
          const correct = parts[1];
          const rest = parts.slice(3).join("|"); // “A;B;C” kan ook pijp bevatten in tekst → join en split op ';'
          const choices =
            rest
              .split(";")
              .map((s) => s.trim())
              .filter(Boolean) || [];
          // zorg dat het juiste antwoord er in zit
          if (!choices.some((c) => c.toLowerCase() === correct.toLowerCase())) {
            choices.unshift(correct);
          }
          rows.push({ prompt, answer: correct, qtype: "mc", choices });
          continue;
        }

        // Anders: simpele Q/A met pipe
        if (parts.length >= 2) {
          rows.push({ prompt: parts[0], answer: parts[1] });
          continue;
        }
      }
    }

    // 2) TSV MC: Vraag \t A \t B \t C \t D \t correct
    if (line.includes("\t")) {
      const t = line.split("\t").map((p) => p.trim());
      if (t.length >= 6) {
        const [prompt, A, B, C, D, correctRaw] = t;
        const choices = [A, B, C, D];
        let correct = correctRaw;
        const letter = correct.toUpperCase();
        if (["A", "B", "C", "D"].includes(letter)) {
          const idx = { A: 0, B: 1, C: 2, D: 3 }[letter as "A" | "B" | "C" | "D"]!;
          correct = choices[idx];
        }
        rows.push({ prompt, answer: correct, qtype: "mc", choices });
        continue;
      }
      if (t.length >= 2) {
        rows.push({ prompt: t[0], answer: t[1] });
        continue;
      }
    }

    // 3) Comma: Vraag,Antwoord (alleen als er precies één komma staat en de vraag eindigt met '?')
    const commaParts = line.split(",").map((p) => p.trim());
    if (commaParts.length === 2 && /[?¿]$/.test(commaParts[0])) {
      rows.push({ prompt: commaParts[0], answer: commaParts[1] });
      continue;
    }

    // 4) “Vraag? Antwoord” (geen expliciete scheiding)
    const m = line.match(/^(.+?\?)\s+(.+)$/);
    if (m) {
      const prompt = m[1].trim();
      const answer = m[2].trim();
      rows.push({ prompt, answer });
      continue;
    }

    // Anders: negeren
  }

  return rows;
}

/** ===========================================
 *  Admin pagina
 *  =========================================== */
export default function AdminQuiz() {
  const qc = useQueryClient();
  const [me, setMe] = useState<string | null>(null);

  // master list state
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | "">("");

  // editor state
  const [mode, setMode] = useState<Mode>("NEW");
  const [tab, setTab] = useState<"DETAILS" | "QUESTIONS" | "BULK">("DETAILS");
  const [isDirty, setIsDirty] = useState(false);

  // quiz form
  const [form, setForm] = useState({
    subject: "",
    chapter: "",
    title: "",
    description: "",
    is_published: false,
    assigned_to: "" as string | "",
    available_from: "" as string | "",
    available_until: "" as string | "",
  });

  // question single add form
  const [qForm, setQForm] = useState<{
    qtype: "mc" | "open";
    prompt: string;
    choices: string; // 1 per regel (alle opties incl. juiste)
    answer: string;
    explanation: string;
  }>({
    qtype: "mc",
    prompt: "",
    choices: "",
    answer: "",
    explanation: "",
  });

  // bulk import state
  const [bulkText, setBulkText] = useState("");
  const [bulkMode, setBulkMode] = useState<"open" | "mc">("open");
  const [bulkAutoDistractors, setBulkAutoDistractors] = useState(true);

  // init user
  useEffect(() => {
    getUserId().then(setMe);
  }, []);

  /** ---------------- Data ---------------- */
  const quizzes = useQuery({
    queryKey: ["quizzes-admin", me],
    enabled: !!me,
    queryFn: async () => {
      const res = await fetch("/api/quizzes", { headers: { "x-user-id": me! } });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      const list = (json.data as Quiz[]) ?? [];
      return list.filter((q) => q.user_id === me);
    },
  });

  const selectedQuiz: Quiz | undefined = useMemo(
    () => quizzes.data?.find((q) => q.id === selectedId),
    [quizzes.data, selectedId]
  );

  const questions = useQuery({
    queryKey: ["quiz-questions", selectedId, me],
    enabled: !!me && !!selectedId,
    queryFn: async () => {
      const res = await fetch(`/api/quizzes/questions?quiz_id=${selectedId}`, {
        headers: { "x-user-id": me! },
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      return (json.data as Question[]) ?? [];
    },
  });

  /** ------------- Mode & form sync ------------- */
  useEffect(() => {
    if (selectedQuiz) {
      setMode("EDIT");
      setTab("DETAILS");
      setForm({
        subject: selectedQuiz.subject ?? "",
        chapter: selectedQuiz.chapter ?? "",
        title: selectedQuiz.title ?? "",
        description: selectedQuiz.description ?? "",
        is_published: !!selectedQuiz.is_published,
        assigned_to: selectedQuiz.assigned_to ?? "",
        available_from: selectedQuiz.available_from
          ? toLocalInputValue(selectedQuiz.available_from)
          : "",
        available_until: selectedQuiz.available_until
          ? toLocalInputValue(selectedQuiz.available_until)
          : "",
      });
      setIsDirty(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedQuiz?.id]);

  /** ----------------- Mutations ----------------- */
  const createQuiz = useMutation({
    mutationFn: async () => {
      const payload = {
        subject: form.subject.trim(),
        chapter: form.chapter.trim(),
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        is_published: form.is_published,
        assigned_to: form.assigned_to.trim() || null,
        available_from: form.available_from || null,
        available_until: form.available_until || null,
      };
      const res = await fetch("/api/quizzes", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": me! },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["quizzes-admin", me] });
      const id = r?.data?.id;
      if (id) {
        setSelectedId(id);
        setMode("EDIT");
      }
      setIsDirty(false);
    },
  });

  const updateQuiz = useMutation({
    mutationFn: async () => {
      if (!selectedId) throw new Error("Geen geselecteerde toets.");
      const payload = {
        id: selectedId,
        subject: form.subject.trim(),
        chapter: form.chapter.trim(),
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        is_published: form.is_published,
        assigned_to: form.assigned_to.trim() || null,
        available_from: form.available_from || null,
        available_until: form.available_until || null,
      };
      const res = await fetch("/api/quizzes", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": me! },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quizzes-admin", me] });
      setIsDirty(false);
    },
  });

  const deleteQuiz = useMutation({
    mutationFn: async () => {
      if (!selectedId) return;
      const res = await fetch(`/api/quizzes?id=${encodeURIComponent(selectedId)}`, {
        method: "DELETE",
        headers: { "x-user-id": me! },
      });
      if (!res.ok && res.status !== 204) {
        const text = await res.text();
        throw new Error(text || "Verwijderen mislukt");
      }
    },
    onSuccess: () => {
      setSelectedId("");
      setMode("NEW");
      setTab("DETAILS");
      resetForm();
      qc.invalidateQueries({ queryKey: ["quizzes-admin", me] });
    },
  });

  const addQuestion = useMutation({
    mutationFn: async () => {
      if (!selectedId) throw new Error("Kies eerst een toets.");
      const item = {
        qtype: qForm.qtype,
        prompt: qForm.prompt.trim(),
        choices:
          qForm.qtype === "mc"
            ? qForm.choices
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean)
            : undefined,
        answer: qForm.answer.trim(),
        explanation: qForm.explanation.trim(),
      };
      const res = await fetch("/api/quizzes/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": me! },
        body: JSON.stringify({ quiz_id: selectedId, items: [item] }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      setQForm({ qtype: "mc", prompt: "", choices: "", answer: "", explanation: "" });
      qc.invalidateQueries({ queryKey: ["quiz-questions", selectedId, me] });
      setTab("QUESTIONS");
    },
  });

  /** ---------- BULK IMPORT met chat-MC ---------- */
  const bulkImport = useMutation({
    mutationFn: async () => {
      if (!selectedId) throw new Error("Kies eerst een toets.");
      const raw = (bulkText || "").trim();
      if (!raw) throw new Error("Geen tekst.");

      // A–D blokken met "Antwoord:" → laat server endpoint alles doen
      if (/^\s*Antwoord\s*:/im.test(raw)) {
        const title = selectedQuiz?.title || "Toets";
        const subject = selectedQuiz?.subject || "Algemeen";
        const res = await fetch("/api/quizlet", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-user-id": me! },
          body: JSON.stringify({ text: raw, title, subject }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || "Quizlet-import mislukt");
        return { via: "quizlet", ...json };
      }

      // Anders: per-regel parsing (incl. MC die jij hier in de chat opstelt)
      const rows = parseBulkLines(raw);
      if (!rows.length) throw new Error("Geen geldige regels gevonden.");

      // Jij levert bij MC de choices → wij NIET genereren
      const items = rows.map((r) => {
        const qtype: "mc" | "open" =
          r.qtype ? r.qtype : bulkMode === "mc" && r.choices?.length ? "mc" : "open";

        let choices: string[] | undefined = r.choices;

        // Als jij alleen "Vraag? Antwoord" levert en bulkMode=mc staat AAN, dan maken we simpele MC
        // maar om jij te bepalen: zet bulkMode op "open" als je géén MC wil.
        if (qtype === "mc" && (!choices || choices.length === 0)) {
          // Minimale fallback: alleen het juiste antwoord als enige keuze (geen auto-afleiders)
          choices = [r.answer];
        }

        // geen shuffle → jouw volgorde blijft gerespecteerd
        return {
          qtype,
          prompt: r.prompt,
          answer: r.answer,
          choices: qtype === "mc" ? choices : undefined,
          explanation: undefined,
        };
      });

      const res = await fetch("/api/quizzes/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": me! },
        body: JSON.stringify({ quiz_id: selectedId, items }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Bulk import mislukt");
      return { via: "bulk", ...json };
    },
    onSuccess: () => {
      setBulkText("");
      qc.invalidateQueries({ queryKey: ["quiz-questions", selectedId, me] });
      setTab("QUESTIONS");
      alert("Vragen geïmporteerd ✅");
    },
  });

  /** ----------------- UI helpers ----------------- */
  function resetForm() {
    setForm({
      subject: "",
      chapter: "",
      title: "",
      description: "",
      is_published: false,
      assigned_to: "",
      available_from: "",
      available_until: "",
    });
    setIsDirty(false);
  }

  function startNewQuiz() {
    if (isDirty && !confirm("Niet-opgeslagen wijzigingen gaan verloren. Doorgaan?")) return;
    setSelectedId("");
    setMode("NEW");
    setTab("DETAILS");
    resetForm();
  }

  const filtered = (quizzes.data ?? []).filter((q) => {
    const n = search.trim().toLowerCase();
    if (!n) return true;
    return (
      q.title.toLowerCase().includes(n) ||
      q.subject.toLowerCase().includes(n) ||
      (q.chapter ?? "").toLowerCase().includes(n)
    );
  });

  const drafts = filtered.filter((q) => !q.is_published);
  const published = filtered.filter((q) => q.is_published);

  /** ----------------- Render ----------------- */
  return (
    <main className="mx-auto max-w-[1200px] px-4 md:px-6 py-6">
      <h1 className="text-2xl font-semibold mb-4">Toetsen — Beheer</h1>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT: list */}
        <aside className="lg:col-span-4 bg-white rounded-2xl shadow border">
          <div className="p-4 border-b flex items-center gap-2">
            <input
              className="w-full border rounded-xl p-2"
              placeholder="Zoeken (titel, vak, hoofdstuk)…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button
              className="px-3 py-2 rounded-xl bg-emerald-600 text-white"
              onClick={startNewQuiz}
              title="Nieuwe toets"
            >
              + Nieuw
            </button>
          </div>

          <div className="p-4 space-y-6 max-h-[70vh] overflow-auto">
            <section>
              <h2 className="text-xs font-semibold text-gray-500 mb-2">GEPUBLICEERD</h2>
              <ul className="space-y-1">
                {published.length ? (
                  published.map((q) => (
                    <li key={q.id}>
                      <button
                        onClick={() => setSelectedId(q.id)}
                        className={`w-full text-left p-3 rounded-xl border hover:bg-gray-50 ${
                          selectedId === q.id ? "border-sky-600 bg-sky-50" : ""
                        }`}
                      >
                        <div className="text-sm font-medium">{q.title}</div>
                        <div className="text-xs text-gray-600">
                          {q.subject} · {q.chapter}
                        </div>
                      </button>
                    </li>
                  ))
                ) : (
                  <p className="text-xs text-gray-500">Geen gepubliceerde toetsen</p>
                )}
              </ul>
            </section>

            <section>
              <h2 className="text-xs font-semibold text-gray-500 mb-2">CONCEPTEN</h2>
              <ul className="space-y-1">
                {drafts.length ? (
                  drafts.map((q) => (
                    <li key={q.id}>
                      <button
                        onClick={() => setSelectedId(q.id)}
                        className={`w-full text-left p-3 rounded-xl border hover:bg-gray-50 ${
                          selectedId === q.id ? "border-sky-600 bg-sky-50" : ""
                        }`}
                      >
                        <div className="text-sm font-medium">{q.title}</div>
                        <div className="text-xs text-gray-600">
                          {q.subject} · {q.chapter}
                        </div>
                      </button>
                    </li>
                  ))
                ) : (
                  <p className="text-xs text-gray-500">Geen concepten</p>
                )}
              </ul>
            </section>
          </div>
        </aside>

        {/* RIGHT: editor */}
        <section className="lg:col-span-8 bg-white rounded-2xl shadow border p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <span
                className={`text-xs px-2 py-1 rounded ${
                  mode === "NEW" ? "bg-gray-100 text-gray-700" : "bg-sky-100 text-sky-700"
                }`}
              >
                {mode === "NEW" ? "Modus: Nieuwe toets" : "Modus: Bewerken"}
              </span>
              {selectedQuiz && (
                <span className="text-xs text-gray-500">
                  Aangemaakt: {new Date(selectedQuiz.created_at ?? "").toLocaleString()}
                </span>
              )}
            </div>

            {mode === "EDIT" && (
              <div className="flex items-center gap-2">
                <button
                  className="px-3 py-2 rounded border"
                  onClick={() => {
                    if (isDirty && !confirm("Niet-opgeslagen wijzigingen gaan verloren. Weet je het zeker?")) return;
                    if (!selectedQuiz) return;
                    setForm({
                      subject: selectedQuiz.subject ?? "",
                      chapter: selectedQuiz.chapter ?? "",
                      title: selectedQuiz.title ?? "",
                      description: selectedQuiz.description ?? "",
                      is_published: !!selectedQuiz.is_published,
                      assigned_to: selectedQuiz.assigned_to ?? "",
                      available_from: selectedQuiz.available_from
                        ? toLocalInputValue(selectedQuiz.available_from)
                        : "",
                      available_until: selectedQuiz.available_until
                        ? toLocalInputValue(selectedQuiz.available_until)
                        : "",
                    });
                    setIsDirty(false);
                  }}
                >
                  Reset
                </button>

                <button
                  className="px-3 py-2 rounded border border-red-300 text-red-700 hover:bg-red-50"
                  onClick={() => {
                    if (confirm("Deze toets en alle bijbehorende data verwijderen?")) {
                      deleteQuiz.mutate();
                    }
                  }}
                >
                  Verwijderen
                </button>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-2 border-b mb-4">
            <button
              className={`px-3 py-2 text-sm ${
                tab === "DETAILS" ? "border-b-2 border-sky-600 text-sky-700" : "text-gray-600"
              }`}
              onClick={() => setTab("DETAILS")}
            >
              Details
            </button>
            <button
              className={`px-3 py-2 text-sm ${
                tab === "QUESTIONS" ? "border-b-2 border-sky-600 text-sky-700" : "text-gray-600"
              }`}
              onClick={() => {
                if (!selectedId) return alert("Sla eerst de toets op.");
                setTab("QUESTIONS");
              }}
            >
              Vragen
            </button>
            <button
              className={`px-3 py-2 text-sm ${
                tab === "BULK" ? "border-b-2 border-sky-600 text-sky-700" : "text-gray-600"
              }`}
              onClick={() => {
                if (!selectedId) return alert("Sla eerst de toets op.");
                setTab("BULK");
              }}
            >
              Bulk import
            </button>
          </div>

          {/* DETAILS */}
          {tab === "DETAILS" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  className="border p-2 rounded"
                  placeholder="Vak (subject)"
                  value={form.subject}
                  onChange={(e) => {
                    setForm({ ...form, subject: e.target.value });
                    setIsDirty(true);
                  }}
                />
                <input
                  className="border p-2 rounded"
                  placeholder="Hoofdstuk (chapter)"
                  value={form.chapter}
                  onChange={(e) => {
                    setForm({ ...form, chapter: e.target.value });
                    setIsDirty(true);
                  }}
                />
                <input
                  className="border p-2 rounded md:col-span-2"
                  placeholder="Titel"
                  value={form.title}
                  onChange={(e) => {
                    setForm({ ...form, title: e.target.value });
                    setIsDirty(true);
                  }}
                />
                <textarea
                  className="border p-2 rounded md:col-span-2 min-h-[120px]"
                  placeholder="Omschrijving (optioneel)"
                  value={form.description}
                  onChange={(e) => {
                    setForm({ ...form, description: e.target.value });
                    setIsDirty(true);
                  }}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border p-3 rounded">
                  <label className="block text-sm font-medium mb-2">Beschikbaar vanaf</label>
                  <input
                    type="datetime-local"
                    className="border p-2 rounded w-full"
                    value={form.available_from}
                    onChange={(e) => {
                      setForm({ ...form, available_from: e.target.value });
                      setIsDirty(true);
                    }}
                  />
                </div>
                <div className="border p-3 rounded">
                  <label className="block text-sm font-medium mb-2">Beschikbaar tot (optioneel)</label>
                  <input
                    type="datetime-local"
                    className="border p-2 rounded w-full"
                    value={form.available_until}
                    onChange={(e) => {
                      setForm({ ...form, available_until: e.target.value });
                      setIsDirty(true);
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border p-3 rounded md:col-span-2">
                  <label className="block text-sm font-medium mb-1">Toewijzen aan (optioneel)</label>
                  <p className="text-xs text-gray-500 mb-2">
                    Laat leeg voor iedereen. Vul een user-id (UUID) in om exclusief toe te wijzen.
                  </p>
                  <input
                    className="border p-2 rounded w-full"
                    placeholder="assigned_to (UUID)"
                    value={form.assigned_to}
                    onChange={(e) => {
                      setForm({ ...form, assigned_to: e.target.value });
                      setIsDirty(true);
                    }}
                  />
                </div>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.is_published}
                    onChange={(e) => {
                      setForm({ ...form, is_published: e.target.checked });
                      setIsDirty(true);
                    }}
                  />
                  <span>Publiceren</span>
                </label>
              </div>

              <div className="pt-2 flex items-center gap-3">
                {mode === "NEW" ? (
                  <button
                    className="bg-emerald-600 text-white px-4 py-2 rounded"
                    onClick={() => createQuiz.mutate()}
                    disabled={!form.title.trim() || !form.subject.trim()}
                    title={!form.title.trim() || !form.subject.trim() ? "Vul minimaal Vak en Titel in" : "Opslaan"}
                  >
                    Opslaan (aanmaken)
                  </button>
                ) : (
                  <button
                    className="bg-emerald-600 text-white px-4 py-2 rounded"
                    onClick={() => updateQuiz.mutate()}
                    disabled={!isDirty}
                    title={isDirty ? "Wijzigingen bewaren" : "Geen wijzigingen"}
                  >
                    Bewaren (bijwerken)
                  </button>
                )}

                <button
                  className="px-3 py-2 rounded border"
                  onClick={() => {
                    if (isDirty && !confirm("Niet-opgeslagen wijzigingen gaan verloren. Doorgaan?")) return;
                    if (mode === "EDIT" && selectedQuiz) {
                      setForm({
                        subject: selectedQuiz.subject ?? "",
                        chapter: selectedQuiz.chapter ?? "",
                        title: selectedQuiz.title ?? "",
                        description: selectedQuiz.description ?? "",
                        is_published: !!selectedQuiz.is_published,
                        assigned_to: selectedQuiz.assigned_to ?? "",
                        available_from: selectedQuiz.available_from
                          ? toLocalInputValue(selectedQuiz.available_from)
                          : "",
                        available_until: selectedQuiz.available_until
                          ? toLocalInputValue(selectedQuiz.available_until)
                          : "",
                      });
                    } else {
                      resetForm();
                    }
                    setIsDirty(false);
                  }}
                >
                  Reset wijzigingen
                </button>
              </div>
            </div>
          )}

          {/* QUESTIONS */}
          {tab === "QUESTIONS" && (
            <div className="space-y-6">
              {!selectedId ? (
                <p className="text-sm text-gray-600">Sla eerst de toets op voordat je vragen toevoegt.</p>
              ) : (
                <>
                  {/* Add single */}
                  <div className="border rounded-2xl p-4">
                    <h3 className="font-semibold mb-3">Nieuwe vraag</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <select
                        className="border p-2 rounded"
                        value={qForm.qtype}
                        onChange={(e) => setQForm({ ...qForm, qtype: e.target.value as "mc" | "open" })}
                      >
                        <option value="mc">Meerkeuze</option>
                        <option value="open">Open vraag</option>
                      </select>
                      <input
                        className="border p-2 rounded"
                        placeholder="Juiste antwoord"
                        value={qForm.answer}
                        onChange={(e) => setQForm({ ...qForm, answer: e.target.value })}
                      />
                      <textarea
                        className="border p-2 rounded md:col-span-2"
                        placeholder="Vraag (prompt)"
                        value={qForm.prompt}
                        onChange={(e) => setQForm({ ...qForm, prompt: e.target.value })}
                      />
                      {qForm.qtype === "mc" && (
                        <textarea
                          className="border p-2 rounded md:col-span-2"
                          placeholder={"Meerkeuze-opties (één per regel, incl. het juiste antwoord)"}
                          value={qForm.choices}
                          onChange={(e) => setQForm({ ...qForm, choices: e.target.value })}
                        />
                      )}
                      <textarea
                        className="border p-2 rounded md:col-span-2"
                        placeholder="Uitleg/feedback (optioneel)"
                        value={qForm.explanation}
                        onChange={(e) => setQForm({ ...qForm, explanation: e.target.value })}
                      />
                      <div className="md:col-span-2">
                        <button
                          className="bg-sky-600 text-white px-4 py-2 rounded"
                          onClick={() => addQuestion.mutate()}
                          disabled={!qForm.prompt.trim() || !qForm.answer.trim()}
                        >
                          Vraag toevoegen
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* List */}
                  <div className="border rounded-2xl p-4">
                    <h3 className="font-semibold mb-3">Vragen in deze toets</h3>
                    {questions.isLoading ? (
                      <p>Laden…</p>
                    ) : (questions.data ?? []).length ? (
                      <ol className="list-decimal pl-5 space-y-3">
                        {(questions.data ?? []).map((qq) => {
                          let choices: string[] = [];
                          try {
                            if (qq.qtype === "mc" && qq.choices) {
                              const raw = typeof qq.choices === "string" ? qq.choices : String(qq.choices);
                              choices = Array.isArray(qq.choices) ? (qq.choices as any) : JSON.parse(raw);
                            }
                          } catch {
                            choices = [];
                          }
                          return (
                            <li key={qq.id}>
                              <div className="font-medium">{qq.prompt}</div>
                              {qq.qtype === "mc" && choices.length > 0 && (
                                <ul className="list-disc pl-5 text-sm text-gray-700">
                                  {choices.map((c, i) => (
                                    <li key={i}>{c}</li>
                                  ))}
                                </ul>
                              )}
                              {qq.answer && (
                                <div className="text-xs text-emerald-700">Antwoord: {qq.answer}</div>
                              )}
                              {qq.explanation && (
                                <div className="text-xs text-gray-600">Uitleg: {qq.explanation}</div>
                              )}
                            </li>
                          );
                        })}
                      </ol>
                    ) : (
                      <p className="text-gray-600">Nog geen vragen.</p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* BULK */}
          {tab === "BULK" && (
            <div className="space-y-4">
              {!selectedId ? (
                <p className="text-sm text-gray-600">Sla eerst de toets op voordat je bulk importeert.</p>
              ) : (
                <>
                  <p className="text-sm text-gray-600">
                    Ondersteunde formaten per regel:<br />
                    <code>Vraag | Antwoord | mc | A;B;C</code> · <code>Vraag | A | B | C | D | correct</code> ·{" "}
                    <code>Vraag[TAB]Antwoord</code> · <code>Vraag? Antwoord</code>.<br />
                    Plak je een **chat-blok** met A–D + <code>Antwoord:</code> → we sturen het automatisch naar{" "}
                    <code>/api/quizlet</code>.
                  </p>

                  <div className="flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-2">
                      <span className="text-sm">Standaardmodus voor regels zonder keuzes:</span>
                      <select
                        className="border p-2 rounded"
                        value={bulkMode}
                        onChange={(e) => setBulkMode(e.target.value as "open" | "mc")}
                      >
                        <option value="open">Open vragen (aanbevolen)</option>
                        <option value="mc">Meerkeuze (alleen juist, géén auto-afleiders)</option>
                      </select>
                    </label>
                    {bulkMode === "mc" && (
                      <span className="text-xs text-gray-500">
                        Let op: afleiders worden <u>niet</u> automatisch gegenereerd (jij levert keuzes).
                      </span>
                    )}
                  </div>

                  <textarea
                    className="w-full border rounded p-3 min-h-[220px]"
                    placeholder={
                      "Voorbeelden:\n" +
                      "Wat is de hoofdstad van Frankrijk? | Parijs | mc | Parijs;Lyon;Marseille;Nice\n" +
                      "Wat is 2 + 2? | 4\n" +
                      "Vraag met tab\tAntwoord met tab\n" +
                      "Wat betekent globalisering? Wereldwijde economische, politieke en culturele verbondenheid."
                    }
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                  />

                  <div>
                    <button
                      className="px-4 py-2 rounded bg-emerald-600 text-white disabled:opacity-50"
                      onClick={() => bulkImport.mutate()}
                      disabled={!bulkText.trim()}
                    >
                      Bulk importeren
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
