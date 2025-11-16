import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
/** Hulpje om huidige userId op te halen */
async function getUid() {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
}
export default function Toets() {
    const [, navigate] = useLocation();
    const [userId, setUserId] = useState(null);
    // --- Import formulier state ---
    const [subject, setSubject] = useState("");
    const [chapter, setChapter] = useState("");
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [mode, setMode] = useState("open");
    const [generateMc, setGenerateMc] = useState(true);
    const [text, setText] = useState("");
    const [busy, setBusy] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);
    useEffect(() => {
        getUid().then(setUserId);
    }, []);
    // --- Gepubliceerde quizzes ophalen ---
    const quizzes = useQuery({
        queryKey: ["quizzes", userId],
        enabled: !!userId,
        queryFn: async () => {
            const res = await fetch("/api/quizzes", {
                headers: { "x-user-id": userId },
            });
            if (!res.ok)
                throw new Error(await res.text());
            const json = await res.json();
            // Alleen gepubliceerde tonen in lijst
            return json.data.filter((q) => q.is_published);
        },
    });
    const canImport = subject.trim() && chapter.trim() && title.trim() && text.trim();
    async function handleImport(e) {
        e.preventDefault();
        if (!userId || !canImport)
            return;
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
            if (!res.ok)
                throw new Error(json?.error || "Import mislukt");
            // Direct door naar spelen:
            navigate(`/toets/spelen?quiz=${json.quiz_id}`);
        }
        catch (err) {
            setErrorMsg(String(err?.message || err));
        }
        finally {
            setBusy(false);
        }
    }
    return (_jsxs("main", { className: "mx-auto max-w-[1000px] px-6 py-8", children: [_jsx("h1", { className: "text-2xl font-semibold mb-6", children: "Toetsen" }), _jsxs("section", { className: "mb-8 bg-white rounded-2xl shadow p-6", children: [_jsx("h2", { className: "text-lg font-semibold mb-4", children: "Beschikbare toetsen" }), !userId ? (_jsx("p", { className: "text-sm text-gray-500", children: "Inloggen vereist\u2026" })) : quizzes.isLoading ? (_jsx("p", { children: "Laden\u2026" })) : quizzes.isError ? (_jsx("p", { className: "text-red-600", children: "Er ging iets mis bij het laden." })) : quizzes.data?.length ? (_jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: quizzes.data.map((q) => (_jsxs("button", { onClick: () => navigate(`/toets/spelen?quiz=${q.id}`), className: "text-left bg-white border rounded-2xl p-4 hover:shadow", children: [_jsxs("div", { className: "text-sm text-gray-500", children: [q.subject, " \u00B7 ", q.chapter] }), _jsx("div", { className: "font-semibold", children: q.title }), q.description && (_jsx("div", { className: "text-sm text-gray-600 line-clamp-2", children: q.description }))] }, q.id))) })) : (_jsx("p", { className: "text-gray-600", children: "Nog geen gepubliceerde toetsen." }))] }), _jsxs("section", { className: "bg-white rounded-2xl shadow p-6", children: [_jsx("h2", { className: "text-lg font-semibold mb-4", children: "Maak je eigen toets van een lijstje" }), _jsxs("p", { className: "text-sm text-gray-600 mb-4", children: ["Plak hier jouw lijst (bijv. uit Quizlet). Elke regel:", " ", _jsx("code", { children: "term[TAB]definitie" }), " of CSV/TSV. Wij maken er automatisch een toets van."] }), _jsxs("form", { onSubmit: handleImport, className: "space-y-4", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsx("input", { className: "border rounded p-2", placeholder: "Vak (bv. Aardrijkskunde)", value: subject, onChange: (e) => setSubject(e.target.value) }), _jsx("input", { className: "border rounded p-2", placeholder: "Hoofdstuk (bv. Rijn & Maas)", value: chapter, onChange: (e) => setChapter(e.target.value) }), _jsx("input", { className: "border rounded p-2 md:col-span-2", placeholder: "Titel (bv. Rijn & Maas \u2013 set 1)", value: title, onChange: (e) => setTitle(e.target.value) }), _jsx("textarea", { className: "border rounded p-2 md:col-span-2", placeholder: "Omschrijving (optioneel)", value: description, onChange: (e) => setDescription(e.target.value) })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-4", children: [_jsxs("label", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-sm", children: "Modus:" }), _jsxs("select", { value: mode, onChange: (e) => setMode(e.target.value), className: "border rounded p-2", children: [_jsx("option", { value: "open", children: "Open vragen (invullen)" }), _jsx("option", { value: "mc", children: "Meerkeuze" })] })] }), mode === "mc" && (_jsxs("label", { className: "flex items-center gap-2", children: [_jsx("input", { type: "checkbox", checked: generateMc, onChange: (e) => setGenerateMc(e.target.checked) }), _jsx("span", { className: "text-sm", children: "Afleiders automatisch genereren" })] }))] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm mb-1", children: "Lijst (bijv. \u201Cterm[TAB]definitie\u201D per regel):" }), _jsx("textarea", { className: "w-full border rounded p-3 min-h-[200px]", placeholder: "voorbeeld:\nStroomgebied\tGebied waar water naar één rivier stroomt\nUiterwaard\tGebied tussen rivier en winterdijk dat kan overstromen", value: text, onChange: (e) => setText(e.target.value) })] }), errorMsg && _jsx("p", { className: "text-red-600 text-sm", children: errorMsg }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("button", { disabled: !canImport || busy || !userId, className: `px-4 py-2 rounded ${canImport && userId && !busy
                                            ? "bg-emerald-600 text-white"
                                            : "bg-gray-300 text-gray-600"}`, children: busy ? "Bezig…" : "Toets aanmaken en starten" }), _jsx("span", { className: "text-xs text-gray-500", children: "Je gaat direct naar de toets na importeren." })] })] })] })] }));
}
