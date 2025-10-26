"use client";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

async function uid() {
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
};

export default function AdminQuiz() {
  const qc = useQueryClient();
  const [me, setMe] = useState<string | null>(null);
  const [selectedQuizId, setSelectedQuizId] = useState<string>("");

  // --- Nieuw/Update & klaarzetten form ---
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

  // --- Vragen-form (single add) ---
  const [qForm, setQForm] = useState<{
    qtype: "mc" | "open";
    prompt: string;
    choices: string; // newline separated
    answer: string;
    explanation: string;
  }>({
    qtype: "mc",
    prompt: "",
    choices: "",
    answer: "",
    explanation: "",
  });

  // --- Bulk plakken (term[TAB]def of CSV/TSV) ---
  const [bulkText, setBulkText] = useState("");
  const [bulkMode, setBulkMode] = useState<"open" | "mc">("open");
  const [bulkAutoDistractors, setBulkAutoDistractors] = useState(true);

  useEffect(() => {
    uid().then(setMe);
  }, []);

  const quizzes = useQuery({
    queryKey: ["quizzes-admin", me],
    enabled: !!me,
    queryFn: async () => {
      const res = await fetch("/api/quizzes", { headers: { "x-user-id": me! } });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      const list = (json.data as Quiz[]).filter((q) => q.user_id === me || q.is_published);
      return list;
    },
  });

  const myQuizzes = useMemo(
    () => quizzes.data?.filter((q) => q.user_id === me) ?? [],
    [quizzes.data, me]
  );

  const saveQuiz = useMutation({
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
      // selecteer meteen de net aangemaakte quiz
      const id = r?.data?.id;
      if (id) setSelectedQuizId(id);
    },
  });

  const addSingleQuestion = useMutation({
    mutationFn: async () => {
      if (!selectedQuizId) throw new Error("Kies eerst een quiz.");
      const item = {
        qtype: qForm.qtype,
        prompt: qForm.prompt,
        choices: qForm.qtype === "mc"
          ? qForm.choices.split("\n").map((s) => s.trim()).filter(Boolean)
          : undefined,
        answer: qForm.answer,
        explanation: qForm.explanation,
      };
      const res = await fetch("/api/quizzes/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": me! },
        body: JSON.stringify({ quiz_id: selectedQuizId, items: [item] }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      setQForm({ qtype: "mc", prompt: "", choices: "", answer: "", explanation: "" });
      qc.invalidateQueries({ queryKey: ["quiz-questions", selectedQuizId, me] });
    },
  });

  const addBulk = useMutation({
    mutationFn: async () => {
      if (!selectedQuizId) throw new Error("Kies eerst een quiz.");
      // gebruik de quizlet-import endpoint zodat afleiders automatisch kunnen
      const res = await fetch("/api/quizzes/quizlet", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": me! },
        body: JSON.stringify({
          subject: myQuizzes.find((q) => q.id === selectedQuizId)?.subject ?? "",
          chapter: myQuizzes.find((q) => q.id === selectedQuizId)?.chapter ?? "",
          title: myQuizzes.find((q) => q.id === selectedQuizId)?.title ?? "",
          description: myQuizzes.find((q) => q.id === selectedQuizId)?.description ?? "",
          mode: bulkMode,
          generateMc: bulkAutoDistractors,
          text: bulkText,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Bulk import mislukt");
      return json;
    },
    onSuccess: () => {
      setBulkText("");
      qc.invalidateQueries({ queryKey: ["quiz-questions", selectedQuizId, me] });
    },
  });

  const questions = useQuery({
    queryKey: ["quiz-questions", selectedQuizId, me],
    enabled: !!me && !!selectedQuizId,
    queryFn: async () => {
      const res = await fetch(`/api/quizzes/questions?quiz_id=${selectedQuizId}`, {
        headers: { "x-user-id": me! },
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      return json.data as Array<any>;
    },
  });

  return (
    <main className="mx-auto max-w-[1100px] px-6 py-8">
      <h1 className="text-2xl font-semibold mb-6">Quiz Admin — klaarzetten & vragen invoeren</h1>

      {/* A) Nieuwe quiz aanmaken / klaarzetten */}
      <section className="mb-10 bg-white p-5 rounded-2xl shadow">
        <h2 className="font-semibold mb-4">Nieuwe quiz</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input className="border p-2 rounded" placeholder="Vak (subject)" value={form.subject} onChange={(e)=>setForm({...form, subject:e.target.value})}/>
          <input className="border p-2 rounded" placeholder="Hoofdstuk (chapter)" value={form.chapter} onChange={(e)=>setForm({...form, chapter:e.target.value})}/>
          <input className="border p-2 rounded md:col-span-2" placeholder="Titel" value={form.title} onChange={(e)=>setForm({...form, title:e.target.value})}/>
          <textarea className="border p-2 rounded md:col-span-2" placeholder="Omschrijving (optioneel)" value={form.description} onChange={(e)=>setForm({...form, description:e.target.value})}/>
          <div className="border p-3 rounded">
            <label className="block text-sm font-medium mb-2">Beschikbaar vanaf</label>
            <input type="datetime-local" className="border p-2 rounded w-full" value={form.available_from} onChange={(e)=>setForm({...form, available_from:e.target.value})}/>
          </div>
          <div className="border p-3 rounded">
            <label className="block text-sm font-medium mb-2">Beschikbaar tot (optioneel)</label>
            <input type="datetime-local" className="border p-2 rounded w-full" value={form.available_until} onChange={(e)=>setForm({...form, available_until:e.target.value})}/>
          </div>
          <div className="md:col-span-2 border p-3 rounded">
            <label className="block text-sm font-medium mb-1">Toewijzen aan (optioneel)</label>
            <p className="text-xs text-gray-500 mb-2">Leeg = zichtbaar voor iedereen binnen het venster. Vul Anouks user-id (UUID) in om exclusief klaar te zetten.</p>
            <input className="border p-2 rounded w-full" placeholder="assigned_to (UUID) — leeg = iedereen" value={form.assigned_to} onChange={(e)=>setForm({...form, assigned_to:e.target.value})}/>
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.is_published} onChange={(e)=>setForm({...form, is_published:e.target.checked})}/>
            <span>Publiceren</span>
          </label>
          <button className="bg-emerald-600 text-white px-4 py-2 rounded" onClick={()=>saveQuiz.mutate()}>
            Opslaan / Klaarzetten
          </button>
        </div>
      </section>

      {/* B) Kies een quiz om vragen aan toe te voegen */}
      <section className="mb-10 bg-white p-5 rounded-2xl shadow">
        <h2 className="font-semibold mb-4">Vragen toevoegen</h2>
        <div className="mb-3">
          <select className="border p-2 rounded min-w-[280px]" value={selectedQuizId} onChange={(e)=>setSelectedQuizId(e.target.value)}>
            <option value="">— Kies jouw quiz —</option>
            {myQuizzes.map((q)=>(
              <option key={q.id} value={q.id}>
                {q.subject} · {q.chapter} · {q.title}
              </option>
            ))}
          </select>
        </div>

        {/* B1) Eén vraag invoeren */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <select className="border p-2 rounded" value={qForm.qtype} onChange={(e)=>setQForm({...qForm, qtype: e.target.value as "mc"|"open"})}>
            <option value="mc">Meerkeuze</option>
            <option value="open">Open vraag</option>
          </select>
          <input className="border p-2 rounded" placeholder="Juiste antwoord" value={qForm.answer} onChange={(e)=>setQForm({...qForm, answer:e.target.value})}/>
          <textarea className="border p-2 rounded md:col-span-2" placeholder="Vraag (prompt)" value={qForm.prompt} onChange={(e)=>setQForm({...qForm, prompt:e.target.value})}/>
          {qForm.qtype === "mc" && (
            <textarea className="border p-2 rounded md:col-span-2" placeholder={"Meerkeuze-opties (één per regel, incl. het juiste antwoord)"} value={qForm.choices} onChange={(e)=>setQForm({...qForm, choices:e.target.value})}/>
          )}
          <textarea className="border p-2 rounded md:col-span-2" placeholder="Uitleg/feedback (optioneel)" value={qForm.explanation} onChange={(e)=>setQForm({...qForm, explanation:e.target.value})}/>
          <button className="bg-sky-600 text-white px-4 py-2 rounded" onClick={()=>addSingleQuestion.mutate()} disabled={!selectedQuizId}>
            Vraag toevoegen
          </button>
        </div>

        {/* B2) Bulk plakken */}
        <div className="mt-8">
          <h3 className="font-medium mb-2">Bulk import (plakken)</h3>
          <p className="text-sm text-gray-600 mb-2">
            Elke regel: <code>term[TAB]definitie</code> of CSV/TSV. Wij zetten dit om naar vragen.
          </p>
          <div className="flex flex-wrap items-center gap-4 mb-3">
            <label className="flex items-center gap-2">
              <span className="text-sm">Modus:</span>
              <select className="border p-2 rounded" value={bulkMode} onChange={(e)=>setBulkMode(e.target.value as "open"|"mc")}>
                <option value="open">Open vragen</option>
                <option value="mc">Meerkeuze</option>
              </select>
            </label>
            {bulkMode === "mc" && (
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={bulkAutoDistractors} onChange={(e)=>setBulkAutoDistractors(e.target.checked)}/>
                <span className="text-sm">Afleiders automatisch genereren</span>
              </label>
            )}
          </div>
          <textarea className="w-full border rounded p-3 min-h-[180px]" placeholder={"voorbeeld:\nStroomgebied\tGebied waar water naar één rivier stroomt\nUiterwaard\tGebied tussen rivier en winterdijk dat kan overstromen"} value={bulkText} onChange={(e)=>setBulkText(e.target.value)}/>
          <div className="mt-3">
            <button className="px-4 py-2 rounded bg-emerald-600 text-white disabled:opacity-50" onClick={()=>addBulk.mutate()} disabled={!selectedQuizId || !bulkText.trim()}>
              Bulk importeren
            </button>
          </div>
        </div>

        {/* C) Overzicht van vragen in de geselecteerde quiz */}
        {selectedQuizId && (
          <div className="mt-8">
            <h3 className="font-medium mb-2">Vragen in deze quiz</h3>
            {questions.isLoading ? (
              <p>Laden…</p>
            ) : questions.data?.length ? (
              <ol className="list-decimal pl-5 space-y-2">
                {questions.data.map((qq: any, i: number) => (
                  <li key={qq.id}>
                    <div className="font-medium">{qq.prompt}</div>
                    {qq.qtype === "mc" && qq.choices && (
                      <ul className="list-disc pl-5 text-sm text-gray-700">
                        {JSON.parse(qq.choices).map((c: string, idx: number) => (
                          <li key={idx}>{c}</li>
                        ))}
                      </ul>
                    )}
                    {qq.answer && <div className="text-sm text-emerald-700">Antwoord: {qq.answer}</div>}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-gray-600">Nog geen vragen.</p>
            )}
          </div>
        )}
      </section>

      {/* D) Mijn quizzes overzicht */}
      <section className="bg-white p-5 rounded-2xl shadow">
        <h2 className="font-semibold mb-4">Mijn quizzes</h2>
        {quizzes.isLoading ? (
          <p>Laden…</p>
        ) : (
          <ul className="space-y-2">
            {myQuizzes.map((q) => (
              <li key={q.id} className="border rounded p-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm text-gray-500">
                    {q.subject} · {q.chapter}
                  </div>
                  <div className="font-semibold">{q.title}</div>
                  <div className="text-xs text-gray-600">
                    {q.is_published ? "Gepubliceerd" : "Concept"}{" "}
                    {q.assigned_to ? "· Toegewezen (specifiek)" : "· Open"}
                    {q.available_from ? ` · Vanaf: ${new Date(q.available_from).toLocaleString()}` : ""}
                    {q.available_until ? ` · Tot: ${new Date(q.available_until).toLocaleString()}` : ""}
                  </div>
                </div>
                <button
                  className="px-3 py-2 rounded border"
                  onClick={() => setSelectedQuizId(q.id)}
                  title="Vragen toevoegen"
                >
                  Bewerken
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
