import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

type CheatItem = { term: string; uitleg: string };
type Chapter = {
  id: string;
  subject: string;
  chapter_title: string;
  summary?: string | null;
  cheat_sheet?: CheatItem[] | null;
  quiz_id?: string | null;
};

export default function Leren() {
  const chapters = useQuery({
    queryKey: ["study_chapters"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("study_chapters")
        .select("*")
        .order("subject", { ascending: true })
        .order("chapter_title", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Chapter[];
    },
  });

  if (chapters.isLoading) return <main className="p-6">Laden…</main>;
  if (chapters.isError) return <main className="p-6 text-red-600">Kon hoofdstukken niet laden.</main>;

  const list = chapters.data || [];
  if (!list.length) return <main className="p-6">Nog geen hoofdstukken toegevoegd.</main>;

  return (
    <main className="mx-auto max-w-[1000px] px-6 py-8 space-y-8">
      <h1 className="text-2xl font-semibold">Leren</h1>

      {list.map((ch) => (
        <section key={ch.id} className="bg-white shadow rounded-2xl p-6">
          <div className="text-sm text-gray-500">{ch.subject}</div>
          <h2 className="text-lg font-semibold mb-3">{ch.chapter_title}</h2>

          {ch.summary && (
            <div className="prose prose-sm max-w-none text-gray-800 whitespace-pre-line">
              {ch.summary}
            </div>
          )}

          {Array.isArray(ch.cheat_sheet) && ch.cheat_sheet.length > 0 && (
            <div className="mt-4 border-t pt-3">
              <h3 className="text-sm font-medium mb-2 text-gray-600">Spiekbriefje</h3>
              <ul className="text-sm space-y-1">
                {ch.cheat_sheet.map((item, i) => (
                  <li key={i}>
                    <b>{item.term}</b>: {item.uitleg}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {ch.quiz_id && (
            <a
              href={`/toets/spelen?quiz=${ch.quiz_id}`}
              className="inline-block mt-4 bg-sky-600 text-white text-sm px-4 py-2 rounded-xl"
            >
              Start bijbehorende toets
            </a>
          )}
        </section>
      ))}
    </main>
  );
}
