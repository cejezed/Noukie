import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
export default function LerenAdmin() {
    const qc = useQueryClient();
    const [me, setMe] = useState(null);
    useEffect(() => { supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null)); }, []);
    const chapters = useQuery({
        queryKey: ["chapters-admin", me],
        enabled: !!me,
        queryFn: async () => {
            const { data, error } = await supabase
                .from("study_chapters").select("*").order("created_at", { ascending: false });
            if (error)
                throw error;
            return (data ?? []);
        }
    });
    const quizzes = useQuery({
        queryKey: ["quizzes-for-link", me],
        enabled: !!me,
        queryFn: async () => {
            const { data, error } = await supabase
                .from("study_quizzes").select("id,subject,chapter,title").order("created_at", { ascending: false });
            if (error)
                throw error;
            return data;
        }
    });
    const [form, setForm] = useState({
        id: "",
        subject: "", chapter_title: "",
        summary: "",
        cheatSheetText: "", // 1 per regel: term - uitleg
        quiz_id: "",
        is_published: false,
    });
    useEffect(() => {
        if (!form.id)
            return;
        const found = chapters.data?.find(c => c.id === form.id);
        if (!found)
            return;
        setForm(f => ({
            ...f,
            subject: found.subject,
            chapter_title: found.chapter_title,
            summary: found.summary ?? "",
            cheatSheetText: Array.isArray(found.cheat_sheet)
                ? found.cheat_sheet.map(i => `${i.term} - ${i.uitleg}`).join("\n")
                : "",
            quiz_id: found.quiz_id ?? "",
            is_published: !!found.is_published
        }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [form.id]);
    function parseCheat(text) {
        return text.split("\n")
            .map(l => l.trim()).filter(Boolean)
            .map(l => {
            const [term, ...rest] = l.split(" - ");
            return { term: term?.trim() ?? "", uitleg: rest.join(" - ").trim() };
        })
            .filter(i => i.term && i.uitleg);
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
                if (error)
                    throw error;
            }
            else {
                const { error } = await supabase.from("study_chapters")
                    .insert([{ ...payload }]);
                if (error)
                    throw error;
            }
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["chapters-admin", me] });
            setForm({ id: "", subject: "", chapter_title: "", summary: "", cheatSheetText: "", quiz_id: "", is_published: false });
        }
    });
    const del = useMutation({
        mutationFn: async (id) => {
            const { error } = await supabase.from("study_chapters").delete().eq("id", id);
            if (error)
                throw error;
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: ["chapters-admin", me] })
    });
    return (_jsxs("main", { className: "mx-auto max-w-[1000px] px-6 py-8 space-y-8", children: [_jsx("h1", { className: "text-2xl font-semibold", children: "Leren \u2014 Beheer" }), _jsxs("section", { className: "bg-white rounded-2xl shadow p-6 space-y-4", children: [_jsx("h2", { className: "text-lg font-semibold", children: form.id ? "Hoofdstuk bewerken" : "Nieuw hoofdstuk" }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsx("input", { className: "border rounded p-2", placeholder: "Vak (subject)", value: form.subject, onChange: e => setForm({ ...form, subject: e.target.value }) }), _jsx("input", { className: "border rounded p-2", placeholder: "Hoofdstuk-titel", value: form.chapter_title, onChange: e => setForm({ ...form, chapter_title: e.target.value }) }), _jsx("textarea", { className: "border rounded p-2 md:col-span-2 min-h-[140px]", placeholder: "Samenvatting", value: form.summary, onChange: e => setForm({ ...form, summary: e.target.value }) })] }), _jsxs("div", { children: [_jsxs("label", { className: "block text-sm text-gray-600 mb-1", children: ["Spiekbriefje (\u00E9\u00E9n per regel: ", _jsx("code", { children: "term - uitleg" }), ")"] }), _jsx("textarea", { className: "w-full border rounded p-2 min-h-[140px]", value: form.cheatSheetText, onChange: e => setForm({ ...form, cheatSheetText: e.target.value }), placeholder: "Stroomgebied - Gebied waar neerslag naar één rivier stroomt\nUiterwaard - Gebied tussen rivier en winterdijk dat kan overstromen" })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-4", children: [_jsxs("label", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-sm", children: "Koppel quiz (optioneel):" }), _jsxs("select", { className: "border rounded p-2", value: form.quiz_id, onChange: e => setForm({ ...form, quiz_id: e.target.value }), children: [_jsx("option", { value: "", children: "\u2014 geen \u2014" }), quizzes.data?.map(q => (_jsxs("option", { value: q.id, children: [q.subject, " \u00B7 ", q.chapter, " \u00B7 ", q.title] }, q.id)))] })] }), _jsxs("label", { className: "flex items-center gap-2", children: [_jsx("input", { type: "checkbox", checked: form.is_published, onChange: e => setForm({ ...form, is_published: e.target.checked }) }), _jsx("span", { children: "Publiceren" })] })] }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("button", { className: "px-4 py-2 rounded bg-emerald-600 text-white", onClick: () => upsert.mutate(), children: form.id ? "Opslaan" : "Aanmaken" }), form.id && (_jsx("button", { className: "px-3 py-2 rounded border", onClick: () => setForm({ id: "", subject: "", chapter_title: "", summary: "", cheatSheetText: "", quiz_id: "", is_published: false }), children: "Reset" }))] })] }), _jsxs("section", { className: "bg-white rounded-2xl shadow p-6", children: [_jsx("h2", { className: "text-lg font-semibold mb-4", children: "Mijn hoofdstukken" }), chapters.isLoading ? _jsx("p", { children: "Laden\u2026" }) : (_jsx("ul", { className: "space-y-2", children: (chapters.data ?? []).map(ch => (_jsxs("li", { className: "border rounded p-3 flex items-center justify-between gap-3", children: [_jsxs("div", { children: [_jsx("div", { className: "text-sm text-gray-500", children: ch.subject }), _jsx("div", { className: "font-semibold", children: ch.chapter_title }), _jsxs("div", { className: "text-xs text-gray-600", children: [ch.is_published ? "Gepubliceerd" : "Concept", ch.quiz_id ? " · gekoppeld aan quiz" : ""] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { className: "px-3 py-2 rounded border", onClick: () => setForm(f => ({ ...f, id: ch.id })), children: "Bewerken" }), _jsx("button", { className: "px-3 py-2 rounded border border-red-300 text-red-700 hover:bg-red-50", onClick: () => { if (confirm("Hoofdstuk verwijderen?"))
                                                del.mutate(ch.id); }, children: "Verwijderen" })] })] }, ch.id))) }))] })] }));
}
