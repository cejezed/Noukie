import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { ChevronRight, FolderClosed, FolderOpen } from "lucide-react";

/** Hulpje om huidige userId op te halen */
async function getUid() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

function safe(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export default function Toets() {
  const [, navigate] = useLocation();
  const [userId, setUserId] = useState<string | null>(null);
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());

  // --- Import formulier state ---
  const [subject, setSubject] = useState("");
  const [chapter, setChapter] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<"open" | "mc">("open");
  const [generateMc, setGenerateMc] = useState(true);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    getUid().then(setUserId);
  }, []);

  // --- Gepubliceerde quizzes ophalen ---
  const quizzes = useQuery({
    queryKey: ["quizzes", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("study_quizzes")
        .select("*")
        .eq("is_published", true)
        .order("subject", { ascending: true })
        .order("chapter", { ascending: true })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // --- Group by subject → chapter ---
  type ChapterGroup = Record<string, any[]>;
  const grouped: Record<string, ChapterGroup> = {};
  for (const q of quizzes.data ?? []) {
    const subj = safe(q.subject) || "Overig";
    const ch = safe(q.chapter) || "";
    if (!grouped[subj]) grouped[subj] = {};
    if (!grouped[subj][ch]) grouped[subj][ch] = [];
    grouped[subj][ch].push(q);
  }
  const subjectKeys = Object.keys(grouped).sort();

  function toggleFolder(key: string) {
    setOpenFolders((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const canImport = subject.trim() && chapter.trim() && title.trim() && text.trim();

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !canImport) return;

    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/quizzes/quizlet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
        },
        body: JSON.stringify({
          subject: subject.trim(),
          chapter: chapter.trim(),
          title: title.trim(),
          description: description.trim(),
          mode,
          generateMc,
          text, // geplakte Quizlet/CSV/TSV content
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Import mislukt");
      // Direct door naar spelen:
      navigate(`/toets/spelen?quiz=${json.quiz_id}`);
    } catch (err: any) {
      setErrorMsg(String(err?.message || err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-[1000px] px-6 py-8">
      <h1 className="text-2xl font-semibold mb-6">Toetsen</h1>

      {/* Lijst met gepubliceerde toetsen */}
      <section className="mb-8 space-y-4">
        <h2 className="text-lg font-semibold">Beschikbare toetsen</h2>

        {!userId ? (
          <p className="text-sm text-gray-500">Inloggen vereist…</p>
        ) : quizzes.isLoading ? (
          <p>Laden…</p>
        ) : quizzes.isError ? (
          <p className="text-red-600">Er ging iets mis bij het laden.</p>
        ) : subjectKeys.length === 0 ? (
          <p className="text-gray-600">Nog geen gepubliceerde toetsen.</p>
        ) : (
          subjectKeys.map((subj) => {
            const chapterGroups = grouped[subj];
            const chapterKeys = Object.keys(chapterGroups).sort((a, b) => {
              if (!a && b) return 1;
              if (a && !b) return -1;
              return a.localeCompare(b);
            });
            const totalQuizzes = Object.values(chapterGroups).reduce((s, arr) => s + arr.length, 0);

            return (
              <div key={subj} className="bg-white rounded-2xl shadow overflow-hidden">
                <div className="border-b px-5 py-4">
                  <h3 className="text-lg font-semibold">{subj}</h3>
                  <p className="text-xs text-gray-500">
                    {totalQuizzes} toets{totalQuizzes !== 1 ? "en" : ""}
                  </p>
                </div>

                {chapterKeys.map((ch) => {
                  const quizList = chapterGroups[ch];
                  const folderKey = `${subj}::${ch}`;
                  const isOpen = !ch || openFolders.has(folderKey);

                  // Quizzes without a chapter: show directly
                  if (!ch) {
                    return (
                      <div key="__no_chapter__" className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {quizList.map((q: any) => (
                          <QuizCard key={q.id} q={q} navigate={navigate} />
                        ))}
                      </div>
                    );
                  }

                  // Chapters: collapsible folder
                  return (
                    <div key={ch}>
                      <button
                        className="w-full text-left bg-gray-50 border-b px-5 py-3 flex items-center gap-3 hover:bg-gray-100 transition-colors"
                        onClick={() => toggleFolder(folderKey)}
                      >
                        <ChevronRight
                          className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? "rotate-90" : ""}`}
                        />
                        {isOpen ? (
                          <FolderOpen className="w-4 h-4 text-sky-600" />
                        ) : (
                          <FolderClosed className="w-4 h-4 text-gray-500" />
                        )}
                        <span className="text-sm font-semibold text-gray-700">{ch}</span>
                        <span className="text-xs text-gray-400 ml-auto">
                          {quizList.length} toets{quizList.length !== 1 ? "en" : ""}
                        </span>
                      </button>

                      {isOpen && (
                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                          {quizList.map((q: any) => (
                            <QuizCard key={q.id} q={q} navigate={navigate} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </section>

      {/* Import direct op Toets-pagina (voor Anouk ook toegankelijk) */}
      <section className="bg-white rounded-2xl shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Maak je eigen toets van een lijstje</h2>
        <p className="text-sm text-gray-600 mb-4">
          Plak hier jouw lijst (bijv. uit Quizlet). Elke regel:{" "}
          <code>term[TAB]definitie</code> of CSV/TSV. Wij maken er automatisch een toets van.
        </p>

        <form onSubmit={handleImport} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              className="border rounded p-2"
              placeholder="Vak (bv. Aardrijkskunde)"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
            <input
              className="border rounded p-2"
              placeholder="Hoofdstuk (bv. Rijn & Maas)"
              value={chapter}
              onChange={(e) => setChapter(e.target.value)}
            />
            <input
              className="border rounded p-2 md:col-span-2"
              placeholder="Titel (bv. Rijn & Maas – set 1)"
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
                onChange={(e) => setMode(e.target.value as "open" | "mc")}
                className="border rounded p-2"
              >
                <option value="open">Open vragen (invullen)</option>
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
                <span className="text-sm">Afleiders automatisch genereren</span>
              </label>
            )}
          </div>

          <div>
            <label className="block text-sm mb-1">
              Lijst (bijv. "term[TAB]definitie" per regel):
            </label>
            <textarea
              className="w-full border rounded p-3 min-h-[200px]"
              placeholder={
                "voorbeeld:\nStroomgebied\tGebied waar water naar één rivier stroomt\nUiterwaard\tGebied tussen rivier en winterdijk dat kan overstromen"
              }
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>

          {errorMsg && <p className="text-red-600 text-sm">{errorMsg}</p>}

          <div className="flex items-center gap-3">
            <button
              disabled={!canImport || busy || !userId}
              className={`px-4 py-2 rounded ${
                canImport && userId && !busy
                  ? "bg-emerald-600 text-white"
                  : "bg-gray-300 text-gray-600"
              }`}
            >
              {busy ? "Bezig…" : "Toets aanmaken en starten"}
            </button>
            <span className="text-xs text-gray-500">
              Je gaat direct naar de toets na importeren.
            </span>
          </div>
        </form>
      </section>
    </main>
  );
}

function QuizCard({ q, navigate }: { q: any; navigate: (path: string) => void }) {
  const qTitle = safe(q.title);
  const desc = safe(q.description);

  return (
    <div className="bg-white border rounded-2xl p-4 hover:shadow">
      <div className="font-semibold mb-1">{qTitle}</div>
      {desc && (
        <div className="text-sm text-gray-600 line-clamp-2 mb-3">{desc}</div>
      )}

      <div className="flex gap-2 mt-3">
        <button
          onClick={() => navigate(`/toets/spelen?quiz=${q.id}&mode=practice`)}
          className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Oefenen
        </button>
        <button
          onClick={() => navigate(`/toets/spelen?quiz=${q.id}&mode=game`)}
          className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Game (2 min)
        </button>
      </div>
    </div>
  );
}
