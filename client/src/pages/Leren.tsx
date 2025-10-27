import * as Accordion from "@radix-ui/react-accordion";
import { useMemo, useState } from "react";
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
  const [q, setQ] = useState("");

  const chapters = useQuery({
    queryKey: ["study_chapters"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("study_chapters")
        .select("*")
        .eq("is_published", true)
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

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter(
      (c) =>
        c.subject.toLowerCase().includes(needle) ||
        c.chapter_title.toLowerCase().includes(needle) ||
        (c.summary ?? "").toLowerCase().includes(needle) ||
        (Array.isArray(c.cheat_sheet) &&
          c.cheat_sheet.some((i) =>
            (i.term + " " + i.uitleg).toLowerCase().includes(needle)
          ))
    );
  }, [list, q]);

  // groepeer per vak
  const bySubject = useMemo(() => {
    const m = new Map<string, Chapter[]>();
    for (const ch of filtered) {
      if (!m.has(ch.subject)) m.set(ch.subject, []);
      m.get(ch.subject)!.push(ch);
    }
    return Array.from(m.entries()); // [ [subject, Chapter[]], ... ]
  }, [filtered]);

  return (
    <main className="mx-auto max-w-[1000px] px-6 py-8 space-y-6">
      <h1 className="text-2xl font-semibold">Leren</h1>

      <div className="flex items-center gap-2">
        <input
          className="w-full border rounded-xl p-3"
          placeholder="Zoek in vak, hoofdstuk, samenvatting of spiekbriefje…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="space-y-4">
        {bySubject.map(([subject, chapters]) => (
          <section key={subject} className="bg-white shadow rounded-2xl overflow-hidden">
            <div className="border-b px-5 py-4">
              <h2 className="text-lg font-semibold">{subject}</h2>
              <p className="text-xs text-gray-500">{chapters.length} hoofdstuk(ken)</p>
            </div>

            <Accordion.Root type="multiple" className="w-full">
              {chapters.map((ch) => (
                <Accordion.Item key={ch.id} value={ch.id} className="border-b last:border-b-0">
                  <Accordion.Header>
                    <Accordion.Trigger className="w-full text-left px-5 py-4 flex items-center justify-between gap-3 hover:bg-gray-50">
                      <span className="font-medium">{ch.chapter_title}</span>
                      <span className="text-xs text-gray-500">open/dicht</span>
                    </Accordion.Trigger>
                  </Accordion.Header>
                  <Accordion.Content className="px-5 pb-5">
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
                  </Accordion.Content>
                </Accordion.Item>
              ))}
            </Accordion.Root>
          </section>
        ))}
      </div>
    </main>
  );
}
