import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ChevronRight, FolderClosed, FolderOpen } from "lucide-react";

type CheatItem = { term: string; uitleg: string };
type Chapter = {
  id: string;
  subject: string;
  topic?: string | null;
  chapter_title: string;
  summary?: string | null;
  cheat_sheet?: CheatItem[] | null;
  quiz_id?: string | null;
  is_published: boolean;
  sort_order: number;
};

// ─── Sortable chapter row ───────────────────────────────────────────

function SortableChapterRow({
  ch,
  onEdit,
  onDelete,
}: {
  ch: Chapter;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: ch.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="border rounded-xl p-3 flex items-center gap-3 bg-white"
    >
      <button
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-5 h-5" />
      </button>

      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{ch.chapter_title}</div>
        <div className="text-xs text-gray-500">
          {ch.is_published ? "Gepubliceerd" : "Concept"}
          {ch.quiz_id ? " · quiz gekoppeld" : ""}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button className="px-3 py-1.5 rounded border text-sm" onClick={onEdit}>
          Bewerken
        </button>
        <button
          className="px-3 py-1.5 rounded border border-red-300 text-red-700 hover:bg-red-50 text-sm"
          onClick={onDelete}
        >
          Verwijderen
        </button>
      </div>
    </li>
  );
}

// ─── Main component ─────────────────────────────────────────────────

export default function LerenAdmin() {
  const qc = useQueryClient();
  const [me, setMe] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
  }, []);

  // ─── Data queries ───

  const chapters = useQuery({
    queryKey: ["chapters-admin", me],
    enabled: !!me,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("study_chapters")
        .select("*")
        .order("subject", { ascending: true })
        .order("sort_order", { ascending: true })
        .order("chapter_title", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Chapter[];
    },
  });

  const quizzes = useQuery({
    queryKey: ["quizzes-for-link", me],
    enabled: !!me,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("study_quizzes")
        .select("id,subject,chapter,title")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Array<{ id: string; subject: string; chapter: string; title: string }>;
    },
  });

  // ─── Group by subject → topic ───

  type TopicGroup = Record<string, Chapter[]>; // topic → chapters
  const grouped: Record<string, TopicGroup> = {}; // subject → topic → chapters

  for (const ch of chapters.data ?? []) {
    const subj = ch.subject || "Overig";
    const topic = ch.topic || "";
    if (!grouped[subj]) grouped[subj] = {};
    if (!grouped[subj][topic]) grouped[subj][topic] = [];
    grouped[subj][topic].push(ch);
  }
  const subjects = Object.keys(grouped).sort();

  // ─── Form state ───

  const [form, setForm] = useState({
    id: "" as string | "",
    subject: "",
    topic: "",
    chapter_title: "",
    summary: "",
    cheatSheetText: "",
    quiz_id: "" as string | "",
    is_published: false,
  });

  const [newSubject, setNewSubject] = useState("");
  const [openTopics, setOpenTopics] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!form.id) return;
    const found = chapters.data?.find((c) => c.id === form.id);
    if (!found) return;
    setForm((f) => ({
      ...f,
      subject: found.subject,
      topic: found.topic ?? "",
      chapter_title: found.chapter_title,
      summary: found.summary ?? "",
      cheatSheetText: Array.isArray(found.cheat_sheet)
        ? found.cheat_sheet.map((i) => `${i.term} - ${i.uitleg}`).join("\n")
        : "",
      quiz_id: found.quiz_id ?? "",
      is_published: !!found.is_published,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.id]);

  function parseCheat(text: string): CheatItem[] {
    return text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [term, ...rest] = l.split(" - ");
        return { term: term?.trim() ?? "", uitleg: rest.join(" - ").trim() };
      })
      .filter((i) => i.term && i.uitleg);
  }

  function resetForm() {
    setForm({
      id: "",
      subject: "",
      topic: "",
      chapter_title: "",
      summary: "",
      cheatSheetText: "",
      quiz_id: "",
      is_published: false,
    });
  }

  // ─── Mutations ───

  const [saveMsg, setSaveMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const upsert = useMutation({
    mutationFn: async () => {
      const subj = form.subject.trim();
      const topic = form.topic.trim() || null;
      const payload = {
        subject: subj,
        topic,
        chapter_title: form.chapter_title.trim(),
        summary: form.summary,
        cheat_sheet: parseCheat(form.cheatSheetText),
        quiz_id: form.quiz_id || null,
        is_published: form.is_published,
      };
      if (form.id) {
        const { error } = await supabase
          .from("study_chapters")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", form.id);
        if (error) throw error;
      } else {
        // New chapter: set sort_order to end of its subject+topic group
        const existing = (chapters.data ?? []).filter(
          (c) => c.subject === subj && (c.topic || "") === (topic || "")
        );
        const maxSort = existing.length
          ? Math.max(...existing.map((c) => c.sort_order ?? 0))
          : -1;
        const { error } = await supabase
          .from("study_chapters")
          .insert([{ ...payload, sort_order: maxSort + 1 }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chapters-admin", me] });
      resetForm();
      setSaveMsg({ type: "ok", text: form.id ? "Opgeslagen!" : "Hoofdstuk aangemaakt!" });
      setTimeout(() => setSaveMsg(null), 3000);
    },
    onError: (err: Error) => {
      setSaveMsg({ type: "err", text: `Opslaan mislukt: ${err.message}` });
      setTimeout(() => setSaveMsg(null), 6000);
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("study_chapters").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chapters-admin", me] }),
  });

  // ─── Drag & drop ───

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // dragKey = "subject::topic" to identify the group
  async function handleDragEnd(dragKey: string, event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const [subject, topic] = dragKey.split("::");
    const items = grouped[subject]?.[topic ?? ""];
    if (!items) return;

    const oldIndex = items.findIndex((c) => c.id === active.id);
    const newIndex = items.findIndex((c) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(items, oldIndex, newIndex);

    // Optimistic update
    qc.setQueryData(["chapters-admin", me], (old: Chapter[] | undefined) => {
      if (!old) return old;
      const updated = old.map((ch) => {
        if (ch.subject !== subject || (ch.topic || "") !== (topic ?? "")) return ch;
        const idx = reordered.findIndex((r) => r.id === ch.id);
        return idx >= 0 ? { ...ch, sort_order: idx } : ch;
      });
      return updated.sort((a, b) => {
        const sc = a.subject.localeCompare(b.subject);
        if (sc !== 0) return sc;
        return (a.sort_order ?? 0) - (b.sort_order ?? 0);
      });
    });

    // Persist to database
    const updates = reordered.map((ch, idx) => ({ id: ch.id, sort_order: idx }));
    for (const u of updates) {
      await supabase
        .from("study_chapters")
        .update({ sort_order: u.sort_order })
        .eq("id", u.id);
    }
  }

  // ─── Collect all known subjects and topics ───

  const allSubjects = Array.from(
    new Set([...subjects, ...(form.subject.trim() ? [form.subject.trim()] : [])])
  ).sort();

  // Topics for the currently selected subject
  const topicsForSubject = form.subject.trim() && grouped[form.subject.trim()]
    ? Object.keys(grouped[form.subject.trim()]).filter(Boolean).sort()
    : [];

  // ─── Render ───

  return (
    <main className="mx-auto max-w-[1000px] px-6 py-8 space-y-8">
      <h1 className="text-2xl font-semibold">Leren — Beheer</h1>

      {/* ── Nieuw vak toevoegen ── */}
      <section className="bg-white rounded-2xl shadow p-6">
        <h2 className="text-lg font-semibold mb-3">Nieuw vak toevoegen</h2>
        <div className="flex items-center gap-3">
          <input
            className="border rounded p-2 flex-1"
            placeholder="Naam van het vak (bijv. Aardrijkskunde)"
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)}
          />
          <button
            className="px-4 py-2 rounded bg-emerald-600 text-white disabled:opacity-50"
            disabled={!newSubject.trim() || allSubjects.includes(newSubject.trim())}
            onClick={() => {
              setForm((f) => ({ ...f, subject: newSubject.trim() }));
              setNewSubject("");
              document.getElementById("chapter-form")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            + Vak aanmaken
          </button>
        </div>
        {newSubject.trim() && allSubjects.includes(newSubject.trim()) && (
          <p className="text-xs text-amber-600 mt-1">Dit vak bestaat al.</p>
        )}
      </section>

      {/* ── Hoofdstuk formulier ── */}
      <section id="chapter-form" className="bg-white rounded-2xl shadow p-6 space-y-4">
        <h2 className="text-lg font-semibold">
          {form.id ? "Hoofdstuk bewerken" : "Nieuw hoofdstuk"}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Vak</label>
            {allSubjects.length > 0 ? (
              <select
                className="border rounded p-2 w-full"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value, topic: "" })}
              >
                <option value="">— kies een vak —</option>
                {allSubjects.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="border rounded p-2 w-full"
                placeholder="Vak (subject)"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
              />
            )}
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Onderwerp <span className="text-gray-400">(optioneel)</span>
            </label>
            <input
              className="border rounded p-2 w-full"
              placeholder="bijv. Brazilië"
              value={form.topic}
              onChange={(e) => setForm({ ...form, topic: e.target.value })}
              list="topic-suggestions"
            />
            {topicsForSubject.length > 0 && (
              <datalist id="topic-suggestions">
                {topicsForSubject.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            )}
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Hoofdstuk-titel</label>
            <input
              className="border rounded p-2 w-full"
              placeholder="Hoofdstuk-titel"
              value={form.chapter_title}
              onChange={(e) => setForm({ ...form, chapter_title: e.target.value })}
            />
          </div>
          <div className="md:col-span-3">
            <label className="block text-sm text-gray-600 mb-1">Samenvatting</label>
            <textarea
              className="border rounded p-2 w-full min-h-[140px]"
              placeholder="Samenvatting"
              value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">
            Spiekbriefje (een per regel: <code>term - uitleg</code>)
          </label>
          <textarea
            className="w-full border rounded p-2 min-h-[140px]"
            value={form.cheatSheetText}
            onChange={(e) => setForm({ ...form, cheatSheetText: e.target.value })}
            placeholder={
              "Stroomgebied - Gebied waar neerslag naar een rivier stroomt\nUiterwaard - Gebied tussen rivier en winterdijk"
            }
          />
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2">
            <span className="text-sm">Koppel quiz (optioneel):</span>
            <select
              className="border rounded p-2"
              value={form.quiz_id}
              onChange={(e) => setForm({ ...form, quiz_id: e.target.value })}
            >
              <option value="">— geen —</option>
              {quizzes.data?.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.subject} · {q.chapter} · {q.title}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.is_published}
              onChange={(e) => setForm({ ...form, is_published: e.target.checked })}
            />
            <span>Publiceren</span>
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button
            className="px-4 py-2 rounded bg-emerald-600 text-white disabled:opacity-50"
            onClick={() => upsert.mutate()}
            disabled={!form.subject.trim() || !form.chapter_title.trim() || upsert.isPending}
          >
            {upsert.isPending ? "Bezig…" : form.id ? "Opslaan" : "Aanmaken"}
          </button>
          {form.id && (
            <button className="px-3 py-2 rounded border" onClick={resetForm}>
              Reset
            </button>
          )}
          {saveMsg && (
            <span className={`text-sm ${saveMsg.type === "ok" ? "text-emerald-600" : "text-red-600"}`}>
              {saveMsg.text}
            </span>
          )}
        </div>
      </section>

      {/* ── Overzicht per vak → onderwerp ── */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Hoofdstukken per vak</h2>
        <p className="text-sm text-gray-500">Sleep hoofdstukken om de volgorde te wijzigen.</p>

        {chapters.isLoading ? (
          <p>Laden…</p>
        ) : subjects.length === 0 ? (
          <p className="text-gray-500">Nog geen hoofdstukken. Maak eerst een vak en hoofdstuk aan.</p>
        ) : (
          subjects.map((subject) => {
            const topicGroups = grouped[subject] ?? {};
            const topicKeys = Object.keys(topicGroups).sort((a, b) => {
              // Empty topic (no topic) last
              if (!a && b) return 1;
              if (a && !b) return -1;
              return a.localeCompare(b);
            });
            const totalChapters = Object.values(topicGroups).reduce((s, arr) => s + arr.length, 0);

            return (
              <div key={subject} className="bg-white rounded-2xl shadow overflow-hidden">
                <div className="border-b px-5 py-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">{subject}</h3>
                    <p className="text-xs text-gray-500">
                      {totalChapters} hoofdstuk{totalChapters !== 1 ? "ken" : ""}
                    </p>
                  </div>
                  <button
                    className="px-3 py-1.5 rounded bg-sky-600 text-white text-sm"
                    onClick={() => {
                      resetForm();
                      setForm((f) => ({ ...f, subject }));
                      document
                        .getElementById("chapter-form")
                        ?.scrollIntoView({ behavior: "smooth" });
                    }}
                  >
                    + Hoofdstuk
                  </button>
                </div>

                {topicKeys.map((topic) => {
                  const items = topicGroups[topic] ?? [];
                  const dragKey = `${subject}::${topic}`;
                  const topicKey = `${subject}::${topic}`;
                  const isOpen = !topic || openTopics.has(topicKey);

                  const dndContent = (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={(e) => handleDragEnd(dragKey, e)}
                    >
                      <SortableContext
                        items={items.map((c) => c.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <ul className="p-3 space-y-2">
                          {items.map((ch) => (
                            <SortableChapterRow
                              key={ch.id}
                              ch={ch}
                              onEdit={() => setForm((f) => ({ ...f, id: ch.id }))}
                              onDelete={() => {
                                if (confirm("Hoofdstuk verwijderen?")) del.mutate(ch.id);
                              }}
                            />
                          ))}
                        </ul>
                      </SortableContext>
                    </DndContext>
                  );

                  // Chapters without a topic: show directly (no folder)
                  if (!topic) {
                    return <div key="__no_topic__">{dndContent}</div>;
                  }

                  // Topics: collapsible folder
                  return (
                    <div key={topic}>
                      <div className="border-b bg-gray-50 px-5 py-2 flex items-center justify-between">
                        <button
                          className="flex items-center gap-2 hover:text-gray-900"
                          onClick={() => {
                            setOpenTopics((prev) => {
                              const next = new Set(prev);
                              if (next.has(topicKey)) next.delete(topicKey);
                              else next.add(topicKey);
                              return next;
                            });
                          }}
                        >
                          <ChevronRight
                            className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? "rotate-90" : ""}`}
                          />
                          {isOpen ? (
                            <FolderOpen className="w-4 h-4 text-sky-600" />
                          ) : (
                            <FolderClosed className="w-4 h-4 text-gray-500" />
                          )}
                          <h4 className="text-sm font-semibold text-gray-700">{topic}</h4>
                          <span className="text-xs text-gray-400">
                            {items.length} hoofdstuk{items.length !== 1 ? "ken" : ""}
                          </span>
                        </button>
                        <button
                          className="text-xs px-2 py-1 rounded bg-sky-100 text-sky-700 hover:bg-sky-200"
                          onClick={() => {
                            resetForm();
                            setForm((f) => ({ ...f, subject, topic }));
                            document
                              .getElementById("chapter-form")
                              ?.scrollIntoView({ behavior: "smooth" });
                          }}
                        >
                          + Hoofdstuk in {topic}
                        </button>
                      </div>

                      {isOpen && dndContent}
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </section>
    </main>
  );
}
