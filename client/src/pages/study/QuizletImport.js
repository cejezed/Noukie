import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
function useUserId() {
    const [id, setId] = useState(null);
    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => setId(data.user?.id ?? null));
    }, []);
    return id;
}
export default function QuizletImport() {
    const userId = useUserId();
    const [subject, setSubject] = useState("");
    const [chapter, setChapter] = useState("");
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [mode, setMode] = useState("open");
    const [generateMc, setGenerateMc] = useState(true);
    const [text, setText] = useState("");
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState(null);
    if (!userId) {
        return (_jsx("main", { className: "mx-auto max-w-[900px] px-6 py-8", children: _jsx("p", { className: "text-sm text-gray-500", children: "Inloggen vereist\u2026" }) }));
    }
    const canSubmit = subject && chapter && title && text;
    const onSubmit = async (e) => {
        e.preventDefault();
        if (!canSubmit)
            return;
        setBusy(true);
        setResult(null);
        try {
            const res = await fetch("/api/quizzes/quizlet", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-user-id": userId,
                },
                body: JSON.stringify({
                    subject,
                    chapter,
                    title,
                    description,
                    mode,
                    generateMc,
                    text,
                }),
            });
            const json = await res.json();
            if (!res.ok)
                throw new Error(json?.error || "Import mislukt");
            setResult(json);
        }
        catch (err) {
            setResult({ error: String(err.message || err) });
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs("main", { className: "mx-auto max-w-[900px] px-6 py-8", children: [_jsx("h1", { className: "text-2xl font-semibold mb-6", children: "Quizlet importeren" }), _jsxs("form", { onSubmit: onSubmit, className: "space-y-4 bg-white rounded-2xl shadow p-6", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsx("input", { className: "border rounded p-2", placeholder: "Vak (subject) \u2014 bv. Aardrijkskunde", value: subject, onChange: (e) => setSubject(e.target.value) }), _jsx("input", { className: "border rounded p-2", placeholder: "Hoofdstuk (chapter) \u2014 bv. Rijn & Maas", value: chapter, onChange: (e) => setChapter(e.target.value) }), _jsx("input", { className: "border rounded p-2 md:col-span-2", placeholder: "Titel \u2014 bv. Rijn & Maas \u2013 set 1", value: title, onChange: (e) => setTitle(e.target.value) }), _jsx("textarea", { className: "border rounded p-2 md:col-span-2", placeholder: "Omschrijving (optioneel)", value: description, onChange: (e) => setDescription(e.target.value) })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-4", children: [_jsxs("label", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-sm", children: "Modus:" }), _jsxs("select", { value: mode, onChange: (e) => setMode(e.target.value), className: "border rounded p-2", children: [_jsx("option", { value: "open", children: "Open vragen" }), _jsx("option", { value: "mc", children: "Meerkeuze" })] })] }), mode === "mc" && (_jsxs("label", { className: "flex items-center gap-2", children: [_jsx("input", { type: "checkbox", checked: generateMc, onChange: (e) => setGenerateMc(e.target.checked) }), _jsx("span", { className: "text-sm", children: "Genereer afleiders automatisch" })] }))] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm mb-1", children: "Plak hier je Quizlet export (TSV/CSV of gekopieerde regels \u201Cterm[TAB]def\u201D):" }), _jsx("textarea", { className: "w-full border rounded p-3 min-h-[200px]", placeholder: "voorbeeld:\nStroomgebied\tGebied waar water naar één rivier stroomt\nUiterwaard\tGebied tussen rivier en winterdijk dat kan overstromen", value: text, onChange: (e) => setText(e.target.value) })] }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("button", { disabled: !canSubmit || busy, className: `px-4 py-2 rounded ${canSubmit ? "bg-emerald-600 text-white" : "bg-gray-300 text-gray-600"}`, children: busy ? "Importeren…" : "Importeren" }), result?.ok && (_jsx("a", { className: "text-sky-700 underline", href: `/toets/spelen?quiz=${result.quiz_id}`, children: "Ga naar quiz" }))] }), result?.error && _jsx("p", { className: "text-red-600 text-sm", children: result.error }), result?.ok && (_jsxs("p", { className: "text-sm text-gray-700", children: ["Klaar: ", result.questions, " vragen toegevoegd. De quiz is nog ", _jsx("b", { children: "niet gepubliceerd" }), " \u2014 controleer en publiceer via je Admin (of maak het daar zichtbaar)."] }))] })] }));
}
