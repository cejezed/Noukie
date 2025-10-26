"use client";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

async function uid() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export default function AdminQuiz() {
  const qc = useQueryClient();
  const [me, setMe] = useState<string | null>(null);

  // form state
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

  const [selectedQuiz, setSelectedQuiz] = useState<string | null>(null);

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
      // owner ziet ook zijn ongepubliceerde
      return (json.data as Array<any>).filter((q) => q.user_id === me || q.is_published);
    },
  });

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
    onSuccess: () => {
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
    },
  });

  return (
    <main className="mx-auto max-w-[1000px] px-6 py-8">
      <h1 className="text-2xl font-semibold mb-6">Quiz Admin — klaarzetten</h1>

      {/* Nieuwe quiz */}
      <section className="mb-10 bg-white p-5 rounded-2xl shadow">
        <h2 className="font-semibold mb-4">Nieuwe quiz / klaarzetten</h2>
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
            placeholder="Omschrijving (kort, optioneel)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />

          {/* Beschikbaarheidsvenster */}
          <div className="border p-3 rounded">
            <label className="block text-sm font-medium mb-2">Beschikbaar vanaf</label>
            <input
              type="datetime-local"
              className="border p-2 rounded w-full"
              value={form.available_from}
              onChange={(e) => setForm({ ...form, available_from: e.target.value })}
            />
          </div>
          <div className="border p-3 rounded">
            <label className="block text-sm font-medium mb-2">Beschikbaar tot (optioneel)</label>
            <input
              type="datetime-local"
              className="border p-2 rounded w-full"
              value={form.available_until}
              onChange={(e) => setForm({ ...form, available_until: e.target.value })}
            />
          </div>

          {/* Assign */}
          <div className="md:col-span-2 border p-3 rounded">
            <label className="block text-sm font-medium mb-1">Toewijzen aan (optioneel)</label>
            <p className="text-xs text-gray-500 mb-2">
              Laat leeg voor iedereen. Vul <b>Anouks</b> user-id (UUID) in om exclusief voor haar klaar te zetten
              (Supabase &rarr; Authentication &rarr; Users &rarr; ID).
            </p>
            <input
              className="border p-2 rounded w-full"
              placeholder="assigned_to (UUID) — leeg = iedereen"
              value={form.assigned_to}
              onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
            />
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.is_published}
              onChange={(e) => setForm({ ...form, is_published: e.target.checked })}
            />
            <span>Publiceren</span>
          </label>

          <button
            className="bg-emerald-600 text-white px-4 py-2 rounded"
            onClick={() => saveQuiz.mutate()}
          >
            Opslaan / Klaarzetten
          </button>
        </div>
      </section>

      {/* Overzicht */}
      <section className="bg-white p-5 rounded-2xl shadow">
        <h2 className="font-semibold mb-4">Mijn quizzes</h2>
        {quizzes.isLoading ? (
          <p>Laden…</p>
        ) : quizzes.isError ? (
          <p className="text-red-600">Fout bij laden.</p>
        ) : (
          <ul className="space-y-2">
            {quizzes.data?.map((q: any) => (
              <li key={q.id} className="border rounded p-3">
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
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
