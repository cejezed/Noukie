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
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [text, setText] = useState<string>("");
  const [loadingOcr, setLoadingOcr] = useState(false);
  const [loadingExplain, setLoadingExplain] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [explainResult, setExplainResult] = useState<any>(null);

  const onSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setErr(null);
    setExplainResult(null);
    if (f) setPreview(URL.createObjectURL(f));
  };

  const runOcr = async () => {
    if (!file) return;
    setLoadingOcr(true);
    setErr(null);
    setExplainResult(null);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const r = await fetch("/api/ocr", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "OCR mislukt");
      setText(j.text || "");
      if (!j.text) setErr("Geen tekst herkend. Probeer een scherpere, rechtere foto.");
    } catch (e: any) {
      setErr(e.message || "Er ging iets mis bij OCR");
    } finally {
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
      if (!r.ok) throw new Error(j?.error || "Uitleg mislukt");
      setExplainResult(j);
    } catch (e: any) {
      setErr(e.message || "Er ging iets mis bij uitleg");
    } finally {
      setLoadingExplain(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Tekst uit foto → Uitleg</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-sm">Maak/kies een duidelijke foto van de boekpagina</Label>
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onSelect}
              className="block text-sm"
            />
            <Button variant="outline" size="sm" onClick={runOcr} disabled={!file || loadingOcr}>
              {loadingOcr ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Camera className="w-4 h-4 mr-2" />}
              Tekst herkennen
            </Button>
          </div>
          {preview && (
            <img
              src={preview}
              alt="Voorbeeld"
              className="mt-2 max-h-64 rounded border object-contain"
            />
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="ocr-text" className="text-sm">Herkende tekst</Label>
          <Textarea
            id="ocr-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder="Hier komt de herkende tekst uit de foto..."
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">
            Tip: controleer even of de OCR-tekst klopt (accenten, kopjes).
          </div>
          <Button onClick={runExplain} disabled={!text.trim() || loadingExplain}>
            {loadingExplain ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
            Leg uit (Aardrijkskunde)
          </Button>
        </div>

        {err && <p className="text-sm text-red-600">{err}</p>}

        {explainResult && (
          <div className="mt-2 space-y-3 rounded border p-3 bg-slate-50">
            {"explanation" in explainResult && (
              <>
                <h3 className="font-semibold">Uitleg</h3>
                <p className="whitespace-pre-wrap">{explainResult.explanation}</p>
              </>
            )}
            {Array.isArray(explainResult.key_terms) && explainResult.key_terms.length > 0 && (
              <>
                <h3 className="font-semibold">Kernbegrippen</h3>
                <ul className="list-disc ml-5">
                  {explainResult.key_terms.map((k: string, i: number) => <li key={i}>{k}</li>)}
                </ul>
              </>
            )}
            {Array.isArray(explainResult.steps) && explainResult.steps.length > 0 && (
              <>
                <h3 className="font-semibold">Stappen</h3>
                <ol className="list-decimal ml-5">
                  {explainResult.steps.map((s: string, i: number) => <li key={i}>{s}</li>)}
                </ol>
              </>
            )}
            {Array.isArray(explainResult.examples) && explainResult.examples.length > 0 && (
              <>
                <h3 className="font-semibold">Voorbeelden</h3>
                <ul className="list-disc ml-5">
                  {explainResult.examples.map((s: string, i: number) => <li key={i}>{s}</li>)}
                </ul>
              </>
            )}
            {"summary" in explainResult && explainResult.summary && (
              <>
                <h3 className="font-semibold">Kort samengevat</h3>
                <p className="whitespace-pre-wrap">{explainResult.summary}</p>
              </>
            )}
            {Array.isArray(explainResult.quiz) && explainResult.quiz.length > 0 && (
              <>
                <h3 className="font-semibold">Oefenvragen</h3>
                <ul className="list-disc ml-5">
                  {explainResult.quiz.map((q: any, i: number) => (
                    <li key={i}>
                      <span className="font-medium">{q.q}</span>
                      {Array.isArray(q.choices) && q.choices.length > 0 && (
                        <ul className="list-disc ml-5">
                          {q.choices.map((c: string, j: number) => <li key={j}>{c}</li>)}
                        </ul>
                      )}
                      {q.answer && <div className="text-xs mt-1">Antwoord: {q.answer}</div>}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
