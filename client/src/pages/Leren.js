import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as Accordion from "@radix-ui/react-accordion";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
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
                .order("chapter_title", { ascending: true });
            if (error)
                throw error;
            return (data ?? []);
        },
    });
    if (chaptersQ.isLoading)
        return _jsx("main", { className: "p-6", children: "Laden\u2026" });
    if (chaptersQ.isError)
        return _jsx("main", { className: "p-6 text-red-600", children: "Kon hoofdstukken niet laden." });
    const list = chaptersQ.data || [];
    if (!list.length)
        return _jsx("main", { className: "p-6", children: "Nog geen hoofdstukken toegevoegd." });
    // Filter (zonder useMemo voor absolute eenvoud/robustheid)
    const needle = q.trim().toLowerCase();
    const filtered = !needle
        ? list
        : list.filter((c) => {
            const hay1 = c.subject?.toLowerCase() ?? "";
            const hay2 = c.chapter_title?.toLowerCase() ?? "";
            const hay3 = (c.summary ?? "").toLowerCase();
            const hay4 = Array.isArray(c.cheat_sheet)
                ? c.cheat_sheet.map((i) => (i.term + " " + i.uitleg).toLowerCase()).join(" ")
                : "";
            return (hay1.includes(needle) ||
                hay2.includes(needle) ||
                hay3.includes(needle) ||
                hay4.includes(needle));
        });
    // Groepeer per vak (zonder useMemo)
    const groups = {};
    for (const ch of filtered) {
        const key = ch.subject || "Overig";
        if (!groups[key])
            groups[key] = [];
        groups[key].push(ch);
    }
    const grouped = Object.entries(groups); // [ [subject, Chapter[]], ... ]
    return (_jsxs("main", { className: "mx-auto max-w-[1000px] px-6 py-8 space-y-6", children: [_jsx("h1", { className: "text-2xl font-semibold", children: "Leren" }), _jsx("div", { className: "flex items-center gap-2", children: _jsx("input", { className: "w-full border rounded-xl p-3", placeholder: "Zoek in vak, hoofdstuk, samenvatting of spiekbriefje\u2026", value: q, onChange: (e) => setQ(e.target.value) }) }), _jsx("div", { className: "space-y-4", children: grouped.map(([subject, chapterList]) => (_jsxs("section", { className: "bg-white shadow rounded-2xl overflow-hidden", children: [_jsxs("div", { className: "border-b px-5 py-4", children: [_jsx("h2", { className: "text-lg font-semibold", children: subject }), _jsxs("p", { className: "text-xs text-gray-500", children: [chapterList.length, " hoofdstuk(ken)"] })] }), _jsx(Accordion.Root, { type: "multiple", className: "w-full", children: chapterList.map((ch) => (_jsxs(Accordion.Item, { value: ch.id, className: "border-b last:border-b-0", children: [_jsx(Accordion.Header, { children: _jsxs(Accordion.Trigger, { className: "w-full text-left px-5 py-4 flex items-center justify-between gap-3 hover:bg-gray-50", children: [_jsx("span", { className: "font-medium", children: ch.chapter_title }), _jsx("span", { className: "text-xs text-gray-500", children: "open/dicht" })] }) }), _jsxs(Accordion.Content, { className: "px-5 pb-5", children: [ch.summary && (_jsx("div", { className: "prose prose-sm max-w-none text-gray-800 whitespace-pre-line", children: ch.summary })), Array.isArray(ch.cheat_sheet) && ch.cheat_sheet.length > 0 && (_jsxs("div", { className: "mt-4 border-t pt-3", children: [_jsx("h3", { className: "text-sm font-medium mb-2 text-gray-600", children: "Spiekbriefje" }), _jsx("ul", { className: "text-sm space-y-1", children: ch.cheat_sheet.map((item, i) => (_jsxs("li", { children: [_jsx("b", { children: item.term }), ": ", item.uitleg] }, i))) })] })), ch.quiz_id && (_jsx("a", { href: `/toets/spelen?quiz=${ch.quiz_id}`, className: "inline-block mt-4 bg-sky-600 text-white text-sm px-4 py-2 rounded-xl", children: "Start bijbehorende toets" }))] })] }, ch.id))) })] }, subject))) })] }));
}
