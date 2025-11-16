import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Camera, Send } from "lucide-react";
/**
 * UploadOcrExplain
 * - Maakt een foto of kiest een bestand
 * - Stuur naar /api/ocr om tekst te herkennen
 * - Optioneel: stuur herkende tekst door naar /api/explain (aardrijkskunde)
 *
 * Vereisten backend:
 * - POST /api/ocr  (form field: "image")
 * - POST /api/explain  (JSON: { text, subject })
 */
export default function UploadOcrExplain() {
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [text, setText] = useState("");
    const [loadingOcr, setLoadingOcr] = useState(false);
    const [loadingExplain, setLoadingExplain] = useState(false);
    const [err, setErr] = useState(null);
    const [explainResult, setExplainResult] = useState(null);
    const onSelect = (e) => {
        const f = e.target.files?.[0] || null;
        setFile(f);
        setErr(null);
        setExplainResult(null);
        if (f)
            setPreview(URL.createObjectURL(f));
    };
    const runOcr = async () => {
        if (!file)
            return;
        setLoadingOcr(true);
        setErr(null);
        setExplainResult(null);
        try {
            const fd = new FormData();
            fd.append("image", file);
            const r = await fetch("/api/ocr", { method: "POST", body: fd });
            const j = await r.json();
            if (!r.ok)
                throw new Error(j?.error || "OCR mislukt");
            setText(j.text || "");
            if (!j.text)
                setErr("Geen tekst herkend. Probeer een scherpere, rechtere foto.");
        }
        catch (e) {
            setErr(e.message || "Er ging iets mis bij OCR");
        }
        finally {
            setLoadingOcr(false);
        }
    };
    const runExplain = async () => {
        if (!text.trim()) {
            setErr("Er is nog geen tekst om uit te leggen.");
            return;
        }
        setLoadingExplain(true);
        setErr(null);
        try {
            const r = await fetch("/api/explain", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    text,
                    subject: "aardrijkskunde",
                    mode: "explain",
                }),
            });
            const j = await r.json();
            if (!r.ok)
                throw new Error(j?.error || "Uitleg mislukt");
            setExplainResult(j);
        }
        catch (e) {
            setErr(e.message || "Er ging iets mis bij uitleg");
        }
        finally {
            setLoadingExplain(false);
        }
    };
    return (_jsxs(Card, { className: "w-full", children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Tekst uit foto \u2192 Uitleg" }) }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { className: "text-sm", children: "Maak/kies een duidelijke foto van de boekpagina" }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("input", { type: "file", accept: "image/*", capture: "environment", onChange: onSelect, className: "block text-sm" }), _jsxs(Button, { variant: "outline", size: "sm", onClick: runOcr, disabled: !file || loadingOcr, children: [loadingOcr ? _jsx(Loader2, { className: "w-4 h-4 animate-spin mr-2" }) : _jsx(Camera, { className: "w-4 h-4 mr-2" }), "Tekst herkennen"] })] }), preview && (_jsx("img", { src: preview, alt: "Voorbeeld", className: "mt-2 max-h-64 rounded border object-contain" }))] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "ocr-text", className: "text-sm", children: "Herkende tekst" }), _jsx(Textarea, { id: "ocr-text", value: text, onChange: (e) => setText(e.target.value), rows: 8, placeholder: "Hier komt de herkende tekst uit de foto..." })] }), _jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsx("div", { className: "text-xs text-muted-foreground", children: "Tip: controleer even of de OCR-tekst klopt (accenten, kopjes)." }), _jsxs(Button, { onClick: runExplain, disabled: !text.trim() || loadingExplain, children: [loadingExplain ? _jsx(Loader2, { className: "w-4 h-4 animate-spin mr-2" }) : _jsx(Send, { className: "w-4 h-4 mr-2" }), "Leg uit (Aardrijkskunde)"] })] }), err && _jsx("p", { className: "text-sm text-red-600", children: err }), explainResult && (_jsxs("div", { className: "mt-2 space-y-3 rounded border p-3 bg-slate-50", children: ["explanation" in explainResult && (_jsxs(_Fragment, { children: [_jsx("h3", { className: "font-semibold", children: "Uitleg" }), _jsx("p", { className: "whitespace-pre-wrap", children: explainResult.explanation })] })), Array.isArray(explainResult.key_terms) && explainResult.key_terms.length > 0 && (_jsxs(_Fragment, { children: [_jsx("h3", { className: "font-semibold", children: "Kernbegrippen" }), _jsx("ul", { className: "list-disc ml-5", children: explainResult.key_terms.map((k, i) => _jsx("li", { children: k }, i)) })] })), Array.isArray(explainResult.steps) && explainResult.steps.length > 0 && (_jsxs(_Fragment, { children: [_jsx("h3", { className: "font-semibold", children: "Stappen" }), _jsx("ol", { className: "list-decimal ml-5", children: explainResult.steps.map((s, i) => _jsx("li", { children: s }, i)) })] })), Array.isArray(explainResult.examples) && explainResult.examples.length > 0 && (_jsxs(_Fragment, { children: [_jsx("h3", { className: "font-semibold", children: "Voorbeelden" }), _jsx("ul", { className: "list-disc ml-5", children: explainResult.examples.map((s, i) => _jsx("li", { children: s }, i)) })] })), "summary" in explainResult && explainResult.summary && (_jsxs(_Fragment, { children: [_jsx("h3", { className: "font-semibold", children: "Kort samengevat" }), _jsx("p", { className: "whitespace-pre-wrap", children: explainResult.summary })] })), Array.isArray(explainResult.quiz) && explainResult.quiz.length > 0 && (_jsxs(_Fragment, { children: [_jsx("h3", { className: "font-semibold", children: "Oefenvragen" }), _jsx("ul", { className: "list-disc ml-5", children: explainResult.quiz.map((q, i) => (_jsxs("li", { children: [_jsx("span", { className: "font-medium", children: q.q }), Array.isArray(q.choices) && q.choices.length > 0 && (_jsx("ul", { className: "list-disc ml-5", children: q.choices.map((c, j) => _jsx("li", { children: c }, j)) })), q.answer && _jsxs("div", { className: "text-xs mt-1", children: ["Antwoord: ", q.answer] })] }, i))) })] }))] }))] })] }));
}
