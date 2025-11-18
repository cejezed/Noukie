import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
function useUserId() {
    const [id, setId] = useState(null);
    useEffect(() => {
        let alive = true;
        supabase.auth.getUser().then(({ data }) => { if (alive)
            setId(data.user?.id ?? null); });
        return () => { alive = false; };
    }, []);
    return id;
}
function getQueryParam(name) {
    try {
        return new URLSearchParams(window.location.search).get(name);
    }
    catch {
        return null;
    }
}
function normalizeChoices(raw) {
    if (!raw)
        return [];
    if (Array.isArray(raw))
        return raw.map(String);
    if (typeof raw === "string") {
        const s = raw.trim();
        if (!s)
            return [];
        try {
            const parsed = JSON.parse(s);
            return Array.isArray(parsed) ? parsed.map(String) : [s];
        }
        catch {
            if (s.includes("\n"))
                return s.split("\n").map(t => t.trim()).filter(Boolean);
            if (s.includes(";"))
                return s.split(";").map(t => t.trim()).filter(Boolean);
            if (s.includes(","))
                return s.split(",").map(t => t.trim()).filter(Boolean);
            return [s];
        }
    }
    try {
        return JSON.parse(String(raw));
    }
    catch {
        return [String(raw)];
    }
}
function eq(a, b) {
    return String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();
}
export default function StudyPlay() {
    const userId = useUserId();
    const quizId = getQueryParam("quiz");
    const [resultId, setResultId] = useState(null);
    const [index, setIndex] = useState(0);
    const [done, setDone] = useState(false);
    const [uiError, setUiError] = useState(null);
    // Feedback state
    const [showFb, setShowFb] = useState(false);
    const [selected, setSelected] = useState("");
    const [isCorrect, setIsCorrect] = useState(null);
    const [correctAnswer, setCorrectAnswer] = useState("");
    // Live score / progress
    const answeredSet = useRef(new Set());
    const [answeredCount, setAnsweredCount] = useState(0);
    const [correctCount, setCorrectCount] = useState(0);
    const questions = useQuery({
        queryKey: ["quiz-questions", quizId, userId],
        enabled: !!userId && !!quizId,
        queryFn: async () => {
            const res = await fetch(`/api/quizzes/questions?quiz_id=${encodeURIComponent(quizId)}`, {
                headers: { "x-user-id": userId },
            });
            if (!res.ok)
                throw new Error(await res.text());
            const json = await res.json();
            return Array.isArray(json.data) ? json.data : [];
        },
    });
    const play = useMutation({
        mutationFn: async (payload) => {
            const res = await fetch("/api/quizzes/play", {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-user-id": userId },
                body: JSON.stringify(payload),
            });
            if (!res.ok)
                throw new Error(await res.text());
            return res.json();
        },
        onError: (e) => setUiError(String(e?.message || e)),
    });
    // Start poging
    useEffect(() => {
        if (!userId || !quizId)
            return;
        let cancelled = false;
        play.mutate({ action: "start", quiz_id: quizId }, { onSuccess: (r) => { if (!cancelled)
                setResultId(r?.result?.id ?? null); } });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId, quizId]);
    const list = questions.data ?? [];
    const q = list[index];
    // Finish poging zodra alles beantwoord is
    const finishedRef = useRef(false);
    useEffect(() => {
        const allAnswered = index >= list.length && list.length > 0;
        if (allAnswered && resultId && !finishedRef.current) {
            finishedRef.current = true;
            play.mutate({ action: "finish", result_id: resultId }, { onSuccess: () => setDone(true), onError: () => setDone(true) });
        }
    }, [index, list.length, resultId, play]);
    const resetFeedback = () => {
        setShowFb(false);
        setSelected("");
        setIsCorrect(null);
        setCorrectAnswer("");
    };
    const next = () => {
        resetFeedback();
        setIndex((i) => i + 1);
    };
    function countThisAnswer(correct) {
        if (!answeredSet.current.has(index)) {
            answeredSet.current.add(index);
            setAnsweredCount((c) => c + 1);
            if (correct === true)
                setCorrectCount((c) => c + 1);
        }
    }
    const answerMC = (choice) => {
        if (!q || !resultId)
            return;
        const correct = eq(choice, q.answer);
        setSelected(choice);
        setIsCorrect(correct);
        setCorrectAnswer(q.answer ?? "");
        setShowFb(true);
        countThisAnswer(correct);
        play.mutate({ action: "answer", result_id: resultId, question_id: q.id, given_answer: choice });
    };
    const answerOpen = (value) => {
        if (!q || !resultId)
            return;
        const correct = q.answer ? eq(value, q.answer) : null;
        setSelected(value);
        setIsCorrect(correct);
        setCorrectAnswer(q.answer ?? "");
        setShowFb(true);
        countThisAnswer(correct);
        play.mutate({ action: "answer", result_id: resultId, question_id: q.id, given_answer: value });
    };
    // UI states
    if (!quizId) {
        return _jsx("main", { className: "p-8", children: _jsx("p", { className: "text-red-600", children: "Geen quiz geselecteerd." }) });
    }
    if (!userId) {
        return _jsx("main", { className: "p-8", children: _jsx("p", { className: "text-sm text-gray-500", children: "Inloggen vereist\u2026" }) });
    }
    if (questions.isLoading) {
        return _jsx("main", { className: "p-8", children: _jsx("p", { children: "Laden\u2026" }) });
    }
    if (questions.isError) {
        return (_jsxs("main", { className: "p-8", children: [_jsx("p", { className: "text-red-600", children: "Kon vragen niet laden." }), _jsx("pre", { className: "mt-2 text-xs bg-gray-50 p-2 rounded", children: String(questions.error?.message) })] }));
    }
    // Klaar scherm
    if (done || (list.length > 0 && index >= list.length)) {
        const pctDone = list.length ? Math.round((correctCount / list.length) * 100) : 0;
        return (_jsxs("main", { className: "mx-auto max-w-[800px] px-6 py-8", children: [_jsx("h1", { className: "text-2xl font-semibold mb-4", children: "Klaar!" }), _jsx("p", { className: "mb-2", children: "Je antwoorden zijn opgeslagen." }), _jsxs("p", { className: "mb-6", children: ["Score: ", _jsx("b", { children: correctCount }), " / ", list.length, " (", pctDone, "%)"] }), _jsx("a", { className: "text-sky-700 underline", href: "/toets", children: "Terug naar Toetsen" })] }));
    }
    if (list.length === 0) {
        return (_jsxs("main", { className: "mx-auto max-w-[800px] px-6 py-8", children: [_jsx("h1", { className: "text-xl font-semibold mb-4", children: "Deze toets heeft nog geen vragen." }), _jsx("a", { className: "text-sky-700 underline", href: "/toets", children: "Terug naar Toetsen" })] }));
    }
    // Header met voortgang + score
    const pct = list.length ? Math.round((answeredCount / list.length) * 100) : 0;
    const qtype = (q.qtype ?? "mc").toLowerCase();
    const prompt = q.prompt ?? "";
    const choices = normalizeChoices(q.choices);
    const explanation = q.explanation ?? "";
    return (_jsxs("main", { className: "mx-auto max-w-[800px] px-6 py-8", children: [_jsxs("div", { className: "mb-4", children: [_jsxs("div", { className: "flex items-center justify-between text-sm text-gray-600 mb-1", children: [_jsx("span", { children: "Voortgang" }), _jsxs("span", { children: [pct, "% \u00B7 ", answeredCount, "/", list.length] })] }), _jsx("div", { className: "h-2 rounded bg-gray-200 overflow-hidden", children: _jsx("div", { className: "h-full bg-sky-600 transition-all", style: { width: `${pct}%` } }) }), _jsxs("div", { className: "mt-2 text-sm", children: [_jsx("span", { className: "text-gray-600", children: "Score: " }), _jsx("span", { className: "font-medium", children: correctCount }), _jsxs("span", { className: "text-gray-600", children: [" / ", answeredCount] })] })] }), _jsxs("div", { className: "mb-2 text-sm text-gray-500", children: ["Vraag ", index + 1, " van ", list.length] }), _jsx("h1", { className: "text-xl font-semibold mb-4", children: prompt }), qtype === "mc" ? (choices.length ? (_jsx("div", { className: "grid gap-3", children: choices.map((c, i) => {
                    const isChosen = showFb && c === selected;
                    const isRight = showFb && eq(c, correctAnswer);
                    // duidelijke feedback:
                    // - gekozen + juist: stevig groen
                    // - gekozen + fout: stevig rood
                    // - niet gekozen maar juist: groene omlijning
                    const base = "text-left border rounded-xl p-3 transition-colors";
                    const hover = showFb ? "" : " hover:bg-gray-50";
                    const chosenRight = isChosen && isRight ? " border-emerald-600 bg-emerald-50" : "";
                    const chosenWrong = isChosen && !isRight ? " border-red-600 bg-red-50" : "";
                    const notChosenButRight = !isChosen && isRight ? " border-emerald-500" : "";
                    const classes = [base, hover, chosenRight, chosenWrong, notChosenButRight].join(" ").trim();
                    return (_jsx("button", { onClick: () => (showFb ? undefined : answerMC(c)), className: classes, disabled: showFb, children: _jsxs("div", { className: "flex items-start gap-2", children: [showFb && isRight && _jsx("span", { "aria-hidden": true, children: "\u2705" }), showFb && isChosen && !isRight && _jsx("span", { "aria-hidden": true, children: "\u274C" }), _jsx("span", { children: c })] }) }, i));
                }) })) : (_jsx("p", { className: "text-red-600", children: "Deze meerkeuzevraag heeft geen opties." }))) : (!showFb ? (_jsxs("form", { className: "flex gap-2", onSubmit: (e) => {
                    e.preventDefault();
                    const inp = e.target.elements.namedItem("open");
                    answerOpen(inp.value);
                }, children: [_jsx("input", { name: "open", className: "flex-1 border rounded-xl p-3", placeholder: "Jouw antwoord" }), _jsx("button", { className: "px-4 py-2 rounded-xl bg-sky-600 text-white", children: "Bevestigen" })] })) : null), showFb && (_jsxs("div", { className: "mt-6 rounded-xl border p-4 bg-white", children: [isCorrect === true && _jsx("p", { className: "text-emerald-700 font-medium", children: "\u2705 Goed!" }), isCorrect === false && _jsx("p", { className: "text-red-700 font-medium", children: "\u274C Niet helemaal. Het juiste antwoord is:" }), isCorrect === null && _jsx("p", { className: "text-sky-700 font-medium", children: "\uD83D\uDCCC Antwoord geregistreerd." }), _jsxs("div", { className: "mt-2 text-sm text-gray-800", children: [selected && _jsxs("div", { children: [_jsx("span", { className: "text-gray-500", children: "Jouw antwoord:" }), " ", selected] }), correctAnswer && !eq(selected, correctAnswer) && (_jsxs("div", { children: [_jsx("span", { className: "text-gray-500", children: "Juiste antwoord:" }), " ", correctAnswer] }))] }), explanation && (_jsxs("div", { className: "mt-3 text-sm text-gray-700", children: [_jsx("span", { className: "text-gray-500", children: "Uitleg:" }), " ", explanation] })), _jsx("div", { className: "mt-4", children: _jsx("button", { onClick: next, className: "px-4 py-2 rounded-xl bg-sky-600 text-white", children: "Volgende" }) })] })), uiError && _jsx("p", { className: "mt-4 text-xs text-red-600", children: uiError })] }));
}
