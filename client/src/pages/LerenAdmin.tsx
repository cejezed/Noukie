import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

type CheatItem = { term: string; uitleg: string };
type Chapter = {
  id: string; subject: string; chapter_title: string;
  summary?: string | null; cheat_sheet?: CheatItem[] | null; quiz_id?: string | null;
  is_published: boolean;
};

export default function LerenAdmin() {
  const qc = useQueryClient();
  const [me, setMe] = useState<string | null>(null);
  useEffect(() => { supabase.auth.getUser().then(({data})=>setMe(data.user?.id ?? null)); }, []);

  const chapters = useQuery({
    queryKey: ["chapters-admin", me],
    enabled: !!me,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("study_chapters").select("*").order("created_at",{ascending:false});
      if (error) throw error;
      return (data ?? []) as Chapter[];
    }
  });

  const quizzes = useQuery({
    queryKey: ["quizzes-for-link", me],
    enabled: !!me,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("study_quizzes").select("id,subject,chapter,title").order("created_at",{ascending:false});
      if (error) throw error;
      return data as Array<{id:string;subject:string;chapter:string;title:string}>;
    }
  });

  const [form, setForm] = useState({
    id: "" as string | "",
    subject: "", chapter_title: "",
    summary: "",
    cheatSheetText: "", // 1 per regel: term - uitleg
    quiz_id: "" as string | "",
    is_published: false,
  });

  useEffect(() => {
    if (!form.id) return;
    const found = chapters.data?.find(c=>c.id===form.id);
    if (!found) return;
    setForm(f => ({
      ...f,
      subject: found.subject,
      chapter_title: found.chapter_title,
      summary: found.summary ?? "",
      cheatSheetText: Array.isArray(found.cheat_sheet)
        ? found.cheat_sheet.map(i=>`${i.term} - ${i.uitleg}`).join("\n")
        : "",
      quiz_id: found.quiz_id ?? "",
      is_published: !!found.is_published
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.id]);

  function parseCheat(text: string): CheatItem[] {
    return text.split("\n")
      .map(l=>l.trim()).filter(Boolean)
      .map(l=>{
        const [term, ...rest] = l.split(" - ");
        return { term: term?.trim() ?? "", uitleg: rest.join(" - ").trim() };
      })
      .filter(i=>i.term && i.uitleg);
  }

  const upsert = useMutation({
    mutationFn: async () => {
      const payload = {
        subject: form.subject.trim(),
        chapter_title: form.chapter_title.trim(),
        summary: form.summary,
        cheat_sheet: parseCheat(form.cheatSheetText),
        quiz_id: form.quiz_id || null,
        is_published: form.is_published,
      };
      if (form.id) {
        const { error } = await supabase.from("study_chapters")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("study_chapters")
          .insert([{ ...payload }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chapters-admin", me] });
      setForm({ id:"", subject:"", chapter_title:"", summary:"", cheatSheetText:"", quiz_id:"", is_published:false });
    }
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("study_chapters").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chapters-admin", me] })
  });

  return (
    <main className="mx-auto max-w-[1000px] px-6 py-8 space-y-8">
      <h1 className="text-2xl font-semibold">Leren — Beheer</h1>

      {/* Form */}
      <section className="bg-white rounded-2xl shadow p-6 space-y-4">
        <h2 className="text-lg font-semibold">{form.id ? "Hoofdstuk bewerken" : "Nieuw hoofdstuk"}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input className="border rounded p-2" placeholder="Vak (subject)" value={form.subject}
                 onChange={e=>setForm({...form, subject:e.target.value})}/>
          <input className="border rounded p-2" placeholder="Hoofdstuk-titel" value={form.chapter_title}
                 onChange={e=>setForm({...form, chapter_title:e.target.value})}/>
          <textarea className="border rounded p-2 md:col-span-2 min-h-[140px]" placeholder="Samenvatting"
                    value={form.summary} onChange={e=>setForm({...form, summary:e.target.value})}/>
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">
            Spiekbriefje (één per regel: <code>term - uitleg</code>)
          </label>
          <textarea className="w-full border rounded p-2 min-h-[140px]" value={form.cheatSheetText}
                    onChange={e=>setForm({...form, cheatSheetText:e.target.value})}
                    placeholder={"Stroomgebied - Gebied waar neerslag naar één rivier stroomt\nUiterwaard - Gebied tussen rivier en winterdijk dat kan overstromen"}/>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2">
            <span className="text-sm">Koppel quiz (optioneel):</span>
            <select className="border rounded p-2" value={form.quiz_id}
                    onChange={e=>setForm({...form, quiz_id:e.target.value})}>
              <option value="">— geen —</option>
              {quizzes.data?.map(q=>(
                <option key={q.id} value={q.id}>
                  {q.subject} · {q.chapter} · {q.title}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.is_published}
                   onChange={e=>setForm({...form, is_published:e.target.checked})}/>
            <span>Publiceren</span>
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button className="px-4 py-2 rounded bg-emerald-600 text-white" onClick={()=>upsert.mutate()}>
            {form.id ? "Opslaan" : "Aanmaken"}
          </button>
          {form.id && (
            <button className="px-3 py-2 rounded border"
                    onClick={()=>setForm({ id:"", subject:"", chapter_title:"", summary:"", cheatSheetText:"", quiz_id:"", is_published:false })}>
              Reset
            </button>
          )}
        </div>
      </section>

      {/* Overzicht */}
      <section className="bg-white rounded-2xl shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Mijn hoofdstukken</h2>
        {chapters.isLoading ? <p>Laden…</p> : (
          <ul className="space-y-2">
            {(chapters.data ?? []).map(ch=>(
              <li key={ch.id} className="border rounded p-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm text-gray-500">{ch.subject}</div>
                  <div className="font-semibold">{ch.chapter_title}</div>
                  <div className="text-xs text-gray-600">
                    {ch.is_published ? "Gepubliceerd" : "Concept"}
                    {ch.quiz_id ? " · gekoppeld aan quiz" : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="px-3 py-2 rounded border"
                          onClick={()=>setForm(f=>({ ...f, id: ch.id }))}>
                    Bewerken
                  </button>
                  <button className="px-3 py-2 rounded border border-red-300 text-red-700 hover:bg-red-50"
                          onClick={()=>{ if(confirm("Hoofdstuk verwijderen?")) del.mutate(ch.id); }}>
                    Verwijderen
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
