"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";

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
  const { toast } = useToast();
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
  const [bulkPreview, setBulkPreview] = useState<
    { prompt: string; answer: string; choices?: string[] }[]
  >([]);
  const [bulkParsingError, setBulkParsingError] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

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

  function toLocalInputValue(iso?: string | null) {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}`;
  }

  // ----- Mutations -----
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
        toast({ title: "Toets aangemaakt", description: "Je kunt nu vragen toevoegen." });
      }
      setIsDirty(false);
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Opslaan mislukt", description: String(e?.message || e) }),
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
      toast({ title: "Wijzigingen bewaard" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Bewaren mislukt", description: String(e?.message || e) }),
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
      toast({ title: "Toets verwijderd" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Verwijderen mislukt", description: String(e?.message || e) }),
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
      toast({ title: "Vraag toegevoegd" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Vraag toevoegen mislukt", description: String(e?.message || e) }),
  });

  // ===== BULK: client-side parsing en direct posten =====

  function parseBulk(raw: string): { prompt: string; answer: string }[] {
    setBulkParsingError(null);
    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const out: { prompt: string; answer: string }[] = [];
    for (const line of lines) {
      if (!line || line.startsWith("#")) continue;
      // TSV (primair), anders CSV, anders " - " of ":" als scheiding
      let q = "";
      let a = "";

      if (line.includes("\t")) {
        const [p, ...rest] = line.split("\t");
        q = (p ?? "").trim();
        a = rest.join("\t").trim();
      } else if (line.includes(";")) {
        const [p, ...rest] = line.split(";");
        q = (p ?? "").trim();
        a = rest.join(";").trim();
      } else if (line.includes(",")) {
        // CSV kan komma in tekst hebben; voor simpelheid: eerste komma
        const idx = line.indexOf(",");
        q = line.slice(0, idx).trim();
        a = line.slice(idx + 1).trim();
      } else if (line.includes(" - ")) {
        const idx = line.indexOf(" - ");
        q = line.slice(0, idx).trim();
        a = line.slice(idx + 3).trim();
      } else if (line.includes(":")) {
        const idx = line.indexOf(":");
        q = line.slice(0, idx).trim();
        a = line.slice(idx + 1).trim();
      } else {
        // fallback: hele regel = prompt; antwoord leeg (wordt dan geskipt)
        q = line;
        a = "";
      }

      if (q && a) out.push({ prompt: q, answer: a });
    }
    if (!out.length) setBulkParsingError("Geen geldige regels gevonden. Gebruik bijv. 'vraag[TAB]antwoord' per regel.");
    return out;
  }

  function makeMcItems(rows: { prompt: string; answer: string }[]) {
    // verzamel alle antwoorden als pool voor afleiders
    const pool = rows.map(r => r.answer).filter(Boolean);
    const items = rows.map(r => {
      let choices = [r.answer];
      if (bulkAutoDistractors) {
        const others = pool.filter(a => a !== r.answer);
        // kies tot 3 afleiders
        const shuffled = [...others].sort(() => Math.random() - 0.5).slice(0, 3);
        choices = [...choices, ...shuffled];
      }
      // unieke en beperkt tot max 4
      const uniq = Array.from(new Set(choices)).slice(0, 4);
      // shuffle final
      const final = [...uniq].sort(() => Math.random() - 0.5);
      return {
        qtype: "mc" as const,
        prompt: r.prompt,
        choices: final,
        answer: r.answer,
        explanation: "",
      };
    });
    return items;
  }

  function makeOpenItems(rows: { prompt: string; answer: string }[]) {
    return rows.map(r => ({
      qtype: "open" as const,
      prompt: r.prompt,
      answer: r.answer,
      explanation: "",
    }));
  }

  function refreshPreview(text: string, mode: "open" | "mc") {
    const rows = parseBulk(text);
    if (!rows.length) { setBulkPreview([]); return; }
    if (mode === "open") {
      setBulkPreview(rows.map(r => ({ prompt: r.prompt, answer: r.answer })));
    } else {
      const mc = makeMcItems(rows);
      setBulkPreview(mc.map(m => ({ prompt: m.prompt, answer: m.answer!, choices: m.choices })));
    }
  }

  useEffect(() => {
    refreshPreview(bulkText, bulkMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bulkText, bulkMode, bulkAutoDistractors]);

  async function handleBulkImport() {
    if (!selectedId) {
      toast({ variant: "destructive", title: "Geen toets geselecteerd", description: "Sla eerst de toets op en selecteer hem." });
      return;
    }
    const rows = parseBulk(bulkText);
    if (!rows.length) {
      toast({ variant: "destructive", title: "Geen vragen gevonden", description: bulkParsingError ?? "Controleer je invoer." });
      return;
    }
    const items = bulkMode === "open" ? makeOpenItems(rows) : makeMcItems(rows);
    setBulkBusy(true);
    try {
      const res = await fetch("/api/quizzes/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": me! },
        body: JSON.stringify({ quiz_id: selectedId, items }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
      setBulkText("");
      setBulkPreview([]);
      qc.invalidateQueries({ queryKey: ["quiz-questions", selectedId, me] });
      setTab("QUESTIONS");
      toast({ title: "Bulk import gelukt", description: `${items.length} vragen toegevoegd.` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Bulk import mislukt", description: String(e?.message || e) });
    } finally {
      setBulkBusy(false);
    }
  }

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
                    if (!selectedQuiz) return;
                    setForm({
                      subject: selectedQuiz.subject ?? "",
                      chapter: selectedQuiz.chapter ?? "",
                      title: selectedQuiz.title ?? "",
                      description: selectedQuiz.description ?? "",
                      is_published: !!selectedQuiz.is_published,
                      assigned_to: selectedQuiz.assigned_to ?? "",
                      available_from: selectedQuiz.available_from
                        ?
