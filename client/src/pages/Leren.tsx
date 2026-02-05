import * as Accordion from "@radix-ui/react-accordion";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

type CheatItem = { term: string; uitleg: string };
type Chapter = {
  id: string;
  subject: string;
  topic?: string | null;
  chapter_title: string;
  summary?: string | null;
  cheat_sheet?: CheatItem[] | null;
  quiz_id?: string | null;
  is_published?: boolean;
};

export default function Leren() {
  const [q, setQ] = useState("");

  const chaptersQ = useQuery({
    queryKey: ["study_chapters"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("study_chapters")
        .select("*")
        .eq("is_published", true)
        .order("subject", { ascending: true })
        .order("sort_order", { ascending: true })
        .order("chapter_title", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Chapter[];
    },
  });

  if (chaptersQ.isLoading) return <main className="p-6">Laden…</main>;
  if (chaptersQ.isError) return <main className="p-6 text-red-600">Kon hoofdstukken niet laden.</main>;

  const list = chaptersQ.data || [];
  if (!list.length) return <main className="p-6">Nog geen hoofdstukken toegevoegd.</main>;

  // Filter
  const needle = q.trim().toLowerCase();
  const filtered = !needle
    ? list
    : list.filter((c) => {
        const hay1 = c.subject?.toLowerCase() ?? "";
        const hay2 = (c.topic ?? "").toLowerCase();
        const hay3 = c.chapter_title?.toLowerCase() ?? "";
        const hay4 = (c.summary ?? "").toLowerCase();
        const hay5 =
          Array.isArray(c.cheat_sheet)
            ? c.cheat_sheet.map((i) => (i.term + " " + i.uitleg).toLowerCase()).join(" ")
            : "";
        return (
          hay1.includes(needle) ||
          hay2.includes(needle) ||
          hay3.includes(needle) ||
          hay4.includes(needle) ||
          hay5.includes(needle)
        );
      });

  // Group: subject → topic → chapters
  type TopicGroup = Record<string, Chapter[]>;
  const groups: Record<string, TopicGroup> = {};
  for (const ch of filtered) {
    const subj = ch.subject || "Overig";
    const topic = ch.topic || "";
    if (!groups[subj]) groups[subj] = {};
    if (!groups[subj][topic]) groups[subj][topic] = [];
    groups[subj][topic].push(ch);
  }
  const subjectKeys = Object.keys(groups).sort();

  return (
    <main className="mx-auto max-w-[1000px] px-6 py-8 space-y-6">
      <h1 className="text-2xl font-semibold">Leren</h1>

      <div className="flex items-center gap-2">
        <input
          className="w-full border rounded-xl p-3"
          placeholder="Zoek in vak, onderwerp, hoofdstuk, samenvatting of spiekbriefje…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="space-y-4">
        {subjectKeys.map((subject) => {
          const topicGroups = groups[subject];
          const topicKeys = Object.keys(topicGroups).sort((a, b) => {
            if (!a && b) return 1;
            if (a && !b) return -1;
            return a.localeCompare(b);
          });
          const totalChapters = Object.values(topicGroups).reduce((s, arr) => s + arr.length, 0);

          return (
            <section key={subject} className="bg-white shadow rounded-2xl overflow-hidden">
              <div className="border-b px-5 py-4">
                <h2 className="text-lg font-semibold">{subject}</h2>
                <p className="text-xs text-gray-500">{totalChapters} hoofdstuk(ken)</p>
              </div>

              <Accordion.Root type="multiple" className="w-full">
                {topicKeys.map((topic) => {
                  const chapterList = topicGroups[topic];
                  return (
                    <div key={topic || "__no_topic__"}>
                      {topic && (
                        <div className="bg-gray-50 border-b px-5 py-2">
                          <h3 className="text-sm font-semibold text-gray-700">{topic}</h3>
                        </div>
                      )}
                      {chapterList.map((ch) => (
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
                    </div>
                  );
                })}
              </Accordion.Root>
            </section>
          );
        })}
      </div>
    </main>
  );
}
