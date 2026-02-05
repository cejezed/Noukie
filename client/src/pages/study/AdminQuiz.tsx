"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

// Helpers
async function getUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

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

  // ----- Data -----
  const quizzes = useQuery({
    queryKey: ["quizzes-admin", me],
    enabled: !!me,
    queryFn: async () => {
      const res = await fetch("/api/quizzes", { headers: { "x-user-id": me! } });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      const list = (json.data as Quiz[]) ?? [];
      // toon alleen eigen toetsen in de admin
      return list.filter((q) => q.user_id === me);
    },
  });

  const selectedQuiz: Quiz | undefined = useMemo(
    () => quizzes.data?.find((q) => q.id === selectedId),
    [quizzes.data, selectedId]
  );

  // vragen voor geselecteerde quiz
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

  // ---- Mode & form sync ----
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
  }, [selectedQuiz?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // helpers voor datetime-local (bewaar/lees in ISO UTC maar toon lokaal)
  function toLocalInputValue(iso?: string | null) {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}`;
  }

  // ----- Mutations -----
  const [saveMsg, setSaveMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const createQuiz = useMutation({
    mutationFn: async () => {
      if (!me) throw new Error("Niet ingelogd.");
      const payload = {
        subject: form.subject.trim(),
        chapter: form.chapter.trim(),
        title: form.title.trim(),
        description: form.description.trim() || null,
        is_published: form.is_published,
        assigned_to: form.assigned_to.trim() || null,
        available_from: form.available_from || null,
        available_until: form.available_until || null,
      };
      const res = await fetch("/api/quizzes", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": me },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Fout ${res.status}`);
      }
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
      setSaveMsg({ type: "ok", text: "Toets aangemaakt!" });
      setTimeout(() => setSaveMsg(null), 3000);
    },
    onError: (err: Error) => {
      setSaveMsg({ type: "err", text: `Aanmaken mislukt: ${err.message}` });
      setTimeout(() => setSaveMsg(null), 6000);
    },
  });

  const updateQuiz = useMutation({
    mutationFn: async () => {
      if (!selectedId) throw new Error("Geen geselecteerde toets.");
      if (!me) throw new Error("Niet ingelogd.");
      const payload = {
        id: selectedId,
        subject: form.subject.trim(),
        chapter: form.chapter.trim(),
        title: form.title.trim(),
        description: form.description.trim() || null,
        is_published: form.is_published,
        assigned_to: form.assigned_to.trim() || null,
        available_from: form.available_from || null,
        available_until: form.available_until || null,
      };
      const res = await fetch("/api/quizzes", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": me },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Fout ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quizzes-admin", me] });
      setIsDirty(false);
      setSaveMsg({ type: "ok", text: "Opgeslagen!" });
      setTimeout(() => setSaveMsg(null), 3000);
    },
    onError: (err: Error) => {
      setSaveMsg({ type: "err", text: `Opslaan mislukt: ${err.message}` });
      setTimeout(() => setSaveMsg(null), 6000);
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

  // ---------- BULK IMPORT (WERKEND) ----------
  function parseBulkLines(text: string): Array<{
    prompt: string;
    answer: string;
    qtype?: "mc" | "open";
    choices?: string[];
  }> {
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const rows: Array<{ prompt: string; answer: string; qtype?: "mc" | "open"; choices?: string[] }> = [];

    for (const line of lines) {
      // Ondersteun pipes, tabs of komma's als scheiding
      // Vorm: Vraag | Antwoord | mc | Keuze1;Keuze2;Keuze3
      const parts = line.split("|").map((p) => p.trim());
      if (parts.length >= 2) {
        const prompt = parts[0];
        const answer = parts[1];
        const qtype = (parts[2]?.toLowerCase() as "mc" | "open") || undefined;
        const choices = parts[3] ? parts[3].split(";").map((s) => s.trim()).filter(Boolean) : undefined;
        rows.push({ prompt, answer, qtype, choices });
        continue;
      }

      // TAB (tsv) fallback: Vraag \t Antwoord
      const t = line.split("\t").map((p) => p.trim());
      if (t.length >= 2) {
        rows.push({ prompt: t[0], answer: t[1] });
        continue;
      }

      // Comma fallback: Vraag,Antwoord
      const c = line.split(",").map((p) => p.trim());
      if (c.length >= 2) {
        rows.push({ prompt: c[0], answer: c[1] });
        continue;
      }
    }

    return rows;
  }

  function buildDistractors(allAnswers: string[], correct: string, need: number): string[] {
    const pool = Array.from(
      new Set(
        allAnswers
          .map((a) => a.trim())
          .filter((a) => a && a.toLowerCase() !== correct.trim().toLowerCase())
      )
    );
    const out: string[] = [];
    for (const a of pool) {
      if (out.length >= need) break;
      out.push(a);
    }
    // als niet genoeg, vul aan met eenvoudige placeholders (zeldzaam geval)
    while (out.length < need) out.push(`Optie ${out.length + 2}`);
    return out.slice(0, need);
  }

  const bulkImport = useMutation({
    mutationFn: async () => {
      if (!selectedId) throw new Error("Kies eerst een toets.");
      const rows = parseBulkLines(bulkText);
      if (!rows.length) throw new Error("Geen geldige regels gevonden.");

      // Bepaal modus per regel: expliciet in regel > UI-keuze
      const allAnswers = rows.map((r) => r.answer).filter(Boolean);

      // Maak items voor API
      const items = rows.map((r) => {
        const qtype: "mc" | "open" = (r.qtype ?? bulkMode) === "mc" ? "mc" : "open";
        let choices: string[] | undefined = r.choices;

        if (qtype === "mc") {
          if (!choices || choices.length === 0) {
            if (bulkAutoDistractors) {
              // Minimaal 4 opties: juist + 3 afleiders (zoveel mogelijk uit andere antwoorden)
              const distractors = buildDistractors(allAnswers, r.answer, 3);
              choices = [r.answer, ...distractors];
            } else {
              // Alleen juiste antwoord als enige optie (minder mooi, maar valide)
              choices = [r.answer];
            }
          } else {
            // zorg dat juist antwoord erin zit
            if (!choices.some((c) => c.toLowerCase() === r.answer.toLowerCase())) {
              choices = [r.answer, ...choices];
            }
          }
        }

        return {
          qtype,
          prompt: r.prompt,
          answer: r.answer,
          choices: qtype === "mc" ? choices : undefined,
          explanation: undefined,
        };
      });

      // POST in één call naar je bestaande endpoint
      const res = await fetch("/api/quizzes/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": me! },
        body: JSON.stringify({ quiz_id: selectedId, items }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Bulk import mislukt");
      return json;
    },
    onSuccess: () => {
      setBulkText("");
      qc.invalidateQueries({ queryKey: ["quiz-questions", selectedId, me] });
      setTab("QUESTIONS");
      alert("Vragen geïmporteerd ✅");
    },
  });

  // ----- UI helpers -----
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

  // ----- Render -----
  return (
    <main className="mx-auto max-w-[1200px] px-4 md:px-6 py-6">
      <h1 className="text-2xl font-semibold mb-4">Toetsen — Beheer</h1>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT: master list */}
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
                  mode === "NEW"
                    ? "bg-gray-100 text-gray-700"
                    : "bg-sky-100 text-sky-700"
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
                    // herladen vanaf bron (selectedQuiz)
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
              className={`px-3 py-2 text-sm ${tab === "DETAILS" ? "border-b-2 border-sky-600 text-sky-700" : "text-gray-600"}`}
              onClick={() => setTab("DETAILS")}
            >
              Details
            </button>
            <button
              className={`px-3 py-2 text-sm ${tab === "QUESTIONS" ? "border-b-2 border-sky-600 text-sky-700" : "text-gray-600"}`}
              onClick={() => {
                if (!selectedId) return alert("Sla eerst de toets op.");
                setTab("QUESTIONS");
              }}
            >
              Vragen
            </button>
            <button
              className={`px-3 py-2 text-sm ${tab === "BULK" ? "border-b-2 border-sky-600 text-sky-700" : "text-gray-600"}`}
              onClick={() => {
                if (!selectedId) return alert("Sla eerst de toets op.");
                setTab("BULK");
              }}
            >
              Bulk import
            </button>
          </div>

          {/* Tab panes */}
          {tab === "DETAILS" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  className="border p-2 rounded"
                  placeholder="Vak (subject)"
                  value={form.subject}
                  onChange={(e) => { setForm({ ...form, subject: e.target.value }); setIsDirty(true); }}
                />
                <input
                  className="border p-2 rounded"
                  placeholder="Hoofdstuk (chapter)"
                  value={form.chapter}
                  onChange={(e) => { setForm({ ...form, chapter: e.target.value }); setIsDirty(true); }}
                />
                <input
                  className="border p-2 rounded md:col-span-2"
                  placeholder="Titel"
                  value={form.title}
                  onChange={(e) => { setForm({ ...form, title: e.target.value }); setIsDirty(true); }}
                />
                <textarea
                  className="border p-2 rounded md:col-span-2 min-h-[120px]"
                  placeholder="Omschrijving (optioneel)"
                  value={form.description}
                  onChange={(e) => { setForm({ ...form, description: e.target.value }); setIsDirty(true); }}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border p-3 rounded">
                  <label className="block text-sm font-medium mb-2">Beschikbaar vanaf</label>
                  <input
                    type="datetime-local"
                    className="border p-2 rounded w-full"
                    value={form.available_from}
                    onChange={(e) => { setForm({ ...form, available_from: e.target.value }); setIsDirty(true); }}
                  />
                </div>
                <div className="border p-3 rounded">
                  <label className="block text-sm font-medium mb-2">Beschikbaar tot (optioneel)</label>
                  <input
                    type="datetime-local"
                    className="border p-2 rounded w-full"
                    value={form.available_until}
                    onChange={(e) => { setForm({ ...form, available_until: e.target.value }); setIsDirty(true); }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border p-3 rounded md:col-span-2">
                  <label className="block text-sm font-medium mb-1">Toewijzen aan (optioneel)</label>
                  <p className="text-xs text-gray-500 mb-2">
                    Laat leeg voor iedereen. Vul Anouks user-id (UUID) in om exclusief toe te wijzen.
                  </p>
                  <input
                    className="border p-2 rounded w-full"
                    placeholder="assigned_to (UUID)"
                    value={form.assigned_to}
                    onChange={(e) => { setForm({ ...form, assigned_to: e.target.value }); setIsDirty(true); }}
                  />
                </div>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.is_published}
                    onChange={(e) => { setForm({ ...form, is_published: e.target.checked }); setIsDirty(true); }}
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
                    className="bg-emerald-600 text-white px-4 py-2 rounded disabled:opacity-50"
                    onClick={() => updateQuiz.mutate()}
                    disabled={!isDirty || updateQuiz.isPending}
                    title={isDirty ? "Wijzigingen bewaren" : "Geen wijzigingen"}
                  >
                    {updateQuiz.isPending ? "Bezig…" : "Bewaren (bijwerken)"}
                  </button>
                )}

                {saveMsg && (
                  <span className={`text-sm ${saveMsg.type === "ok" ? "text-emerald-600" : "text-red-600"}`}>
                    {saveMsg.text}
                  </span>
                )}

                <button
                  className="px-3 py-2 rounded border"
                  onClick={() => {
                    if (isDirty && !confirm("Niet-opgeslagen wijzigingen gaan verloren. Doorgaan?")) return;
                    // reload uit bron
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
                    }
                    setIsDirty(false);
                  }}
                >
                  Reset wijzigingen
                </button>
              </div>
            </div>
          )}

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

          {tab === "BULK" && (
            <div className="space-y-4">
              {!selectedId ? (
                <p className="text-sm text-gray-600">Sla eerst de toets op voordat je bulk importeert.</p>
              ) : (
                <>
                  <p className="text-sm text-gray-600">
                    Ondersteunde formaten per regel:<br />
                    <code>Vraag | Antwoord | mc | Keuze1;Keuze2;Keuze3</code> of <code>Vraag[TAB]Antwoord</code>.<br />
                    Kies hieronder de standaardmodus voor regels zonder expliciet type.
                  </p>

                  <div className="flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-2">
                      <span className="text-sm">Modus:</span>
                      <select
                        className="border p-2 rounded"
                        value={bulkMode}
                        onChange={(e) => setBulkMode(e.target.value as "open" | "mc")}
                      >
                        <option value="open">Open vragen</option>
                        <option value="mc">Meerkeuze</option>
                      </select>
                    </label>
                    {bulkMode === "mc" && (
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={bulkAutoDistractors}
                          onChange={(e) => setBulkAutoDistractors(e.target.checked)}
                        />
                        <span className="text-sm">Afleiders automatisch genereren</span>
                      </label>
                    )}
                  </div>

                  <textarea
                    className="w-full border rounded p-3 min-h-[220px]"
                    placeholder={
                      "Voorbeelden:\n" +
                      "Wat is de hoofdstad van Frankrijk? | Parijs | mc | Parijs;Lyon;Marseille;Nice\n" +
                      "Wat is 2 + 2? | 4 | mc | 3;4;5\n" +
                      "Noem een kenmerk van een rivier. | Stromend water | open\n" +
                      "Stroomgebied\tGebied waar water naar één rivier stroomt"
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
