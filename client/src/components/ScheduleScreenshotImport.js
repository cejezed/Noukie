import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Upload, Loader2, CheckCircle2, XCircle, AlertCircle, Camera, Trash2, Download, Info, } from "lucide-react";
export default function ScheduleScreenshotImport() {
    const { user } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [ocrResult, setOcrResult] = useState(null);
    const [processing, setProcessing] = useState(false);
    const [selectedLessons, setSelectedLessons] = useState(new Set());
    const [importing, setImporting] = useState(false);
    // Reset state
    const reset = () => {
        setFile(null);
        setPreview(null);
        setOcrResult(null);
        setSelectedLessons(new Set());
    };
    // Handle file selection
    const handleFileSelect = (e) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile)
            return;
        // Validate file type
        if (!selectedFile.type.startsWith("image/")) {
            toast({
                title: "Ongeldig bestand",
                description: "Selecteer een afbeelding (PNG, JPEG, WebP)",
                variant: "destructive",
            });
            return;
        }
        // Validate file size (10MB max)
        if (selectedFile.size > 10 * 1024 * 1024) {
            toast({
                title: "Bestand te groot",
                description: "Maximale bestandsgrootte is 10MB",
                variant: "destructive",
            });
            return;
        }
        setFile(selectedFile);
        setPreview(URL.createObjectURL(selectedFile));
        setOcrResult(null);
        setSelectedLessons(new Set());
    };
    // Process screenshot with OCR
    const processScreenshot = async () => {
        if (!file || !user?.id)
            return;
        setProcessing(true);
        try {
            const formData = new FormData();
            formData.append("screenshot", file);
            formData.append("userId", user.id);
            const response = await fetch("/api/schedule/import-screenshot", {
                method: "POST",
                body: formData,
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || "Fout bij verwerken screenshot");
            }
            setOcrResult(data);
            // Auto-select all valid lessons
            if (data.lessons) {
                const validIndices = new Set(data.lessons
                    .map((l, i) => (l.validation?.valid ? i : -1))
                    .filter((i) => i >= 0));
                setSelectedLessons(validIndices);
            }
            toast({
                title: "Screenshot verwerkt!",
                description: `${data.stats?.valid || 0} lessen gevonden`,
            });
        }
        catch (error) {
            console.error("OCR error:", error);
            toast({
                title: "Fout bij verwerken",
                description: error instanceof Error ? error.message : "Onbekende fout",
                variant: "destructive",
            });
        }
        finally {
            setProcessing(false);
        }
    };
    // Toggle lesson selection
    const toggleLesson = (index) => {
        const newSelected = new Set(selectedLessons);
        if (newSelected.has(index)) {
            newSelected.delete(index);
        }
        else {
            newSelected.add(index);
        }
        setSelectedLessons(newSelected);
    };
    // Import selected lessons
    const importLessons = async () => {
        if (!user?.id || !ocrResult || selectedLessons.size === 0)
            return;
        setImporting(true);
        try {
            const lessonsToImport = Array.from(selectedLessons)
                .map((i) => ocrResult.lessons[i])
                .filter((l) => l.validation?.valid);
            // Find or create courses and import lessons
            let importedCount = 0;
            const errors = [];
            for (const lesson of lessonsToImport) {
                try {
                    // Find or create course if needed
                    let courseId = null;
                    if (lesson.course_name && (lesson.kind === "les" || lesson.kind === "toets")) {
                        const { data: courses } = await supabase
                            .from("courses")
                            .select("*")
                            .eq("user_id", user.id)
                            .eq("name", lesson.course_name);
                        if (courses && courses.length > 0) {
                            courseId = courses[0].id;
                        }
                        else {
                            // Create new course
                            const { data: newCourse, error: courseError } = await supabase
                                .from("courses")
                                .insert({
                                user_id: user.id,
                                name: lesson.course_name,
                                color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
                            })
                                .select()
                                .single();
                            if (courseError)
                                throw courseError;
                            courseId = newCourse.id;
                        }
                    }
                    // Create schedule item
                    const { error: scheduleError } = await supabase.from("schedule").insert({
                        user_id: user.id,
                        course_id: courseId,
                        day_of_week: lesson.day_of_week,
                        start_time: lesson.start_time + ":00",
                        end_time: lesson.end_time + ":00",
                        kind: lesson.kind,
                        title: lesson.title,
                        is_recurring: true,
                        status: "active",
                    });
                    if (scheduleError)
                        throw scheduleError;
                    importedCount++;
                }
                catch (error) {
                    console.error("Error importing lesson:", error);
                    errors.push(`${lesson.title}: ${error instanceof Error ? error.message : "Fout"}`);
                }
            }
            // Refresh schedule data
            queryClient.invalidateQueries({ queryKey: ["schedule", user.id] });
            queryClient.invalidateQueries({ queryKey: ["courses", user.id] });
            if (errors.length > 0) {
                toast({
                    title: "Gedeeltelijk geïmporteerd",
                    description: `${importedCount} lessen toegevoegd, ${errors.length} fouten`,
                    variant: "destructive",
                });
            }
            else {
                toast({
                    title: "Import succesvol!",
                    description: `${importedCount} lessen toegevoegd aan je rooster`,
                });
                reset();
            }
        }
        catch (error) {
            console.error("Import error:", error);
            toast({
                title: "Import mislukt",
                description: error instanceof Error ? error.message : "Onbekende fout",
                variant: "destructive",
            });
        }
        finally {
            setImporting(false);
        }
    };
    const getDayName = (dow) => ["", "Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"][dow] || "?";
    return (_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(Camera, { className: "w-5 h-5" }), "Rooster importeren via screenshot"] }), _jsx(CardDescription, { children: "Upload een screenshot van je Somtoday rooster om automatisch lessen toe te voegen" })] }), (file || ocrResult) && (_jsxs(Button, { variant: "ghost", size: "sm", onClick: reset, children: [_jsx(Trash2, { className: "w-4 h-4 mr-2" }), "Reset"] }))] }) }), _jsxs(CardContent, { className: "space-y-4", children: [!ocrResult && (_jsxs("div", { className: "space-y-4", children: [_jsxs(Alert, { children: [_jsx(Info, { className: "h-4 w-4" }), _jsxs(AlertDescription, { children: [_jsx("strong", { children: "Tips voor beste resultaten:" }), _jsxs("ul", { className: "list-disc ml-4 mt-2 space-y-1", children: [_jsx("li", { children: "Maak een duidelijke, scherpe screenshot van je weekrooster" }), _jsx("li", { children: "Zorg dat tijden en vakken goed leesbaar zijn" }), _jsx("li", { children: "Vermijd schaduwen of reflecties" }), _jsx("li", { children: "Screenshot kan meerdere dagen bevatten" })] })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "screenshot", children: "Screenshot van rooster" }), _jsx(Input, { id: "screenshot", type: "file", accept: "image/*", onChange: handleFileSelect, className: "cursor-pointer" })] }), preview && (_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: "Voorbeeld" }), _jsx("img", { src: preview, alt: "Screenshot preview", className: "max-h-96 w-full object-contain border rounded-lg" })] })), file && (_jsx(Button, { onClick: processScreenshot, disabled: processing, className: "w-full", children: processing ? (_jsxs(_Fragment, { children: [_jsx(Loader2, { className: "w-4 h-4 mr-2 animate-spin" }), "Rooster herkennen... (dit kan 10-30 seconden duren)"] })) : (_jsxs(_Fragment, { children: [_jsx(Upload, { className: "w-4 h-4 mr-2" }), "Rooster herkennen"] })) }))] })), ocrResult && (_jsxs("div", { className: "space-y-4", children: [ocrResult.stats && (_jsxs(Alert, { children: [_jsx(CheckCircle2, { className: "h-4 w-4" }), _jsxs(AlertDescription, { children: [_jsx("strong", { children: "Resultaat:" }), " ", ocrResult.stats.valid, " geldige lessen gevonden", ocrResult.stats.invalid > 0 && ` (${ocrResult.stats.invalid} fouten)`] })] })), ocrResult.warnings.length > 0 && (_jsxs(Alert, { variant: "destructive", children: [_jsx(AlertCircle, { className: "h-4 w-4" }), _jsxs(AlertDescription, { children: [_jsx("strong", { children: "Waarschuwingen:" }), _jsx("ul", { className: "list-disc ml-4 mt-1", children: ocrResult.warnings.map((w, i) => (_jsx("li", { children: w }, i))) })] })] })), ocrResult.lessons.length > 0 && (_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs(Label, { children: ["Gevonden lessen (", ocrResult.lessons.length, ")"] }), _jsxs("div", { className: "text-sm text-muted-foreground", children: [selectedLessons.size, " geselecteerd"] })] }), _jsx("div", { className: "space-y-2 max-h-96 overflow-y-auto", children: ocrResult.lessons.map((lesson, index) => {
                                            const isValid = lesson.validation?.valid ?? true;
                                            const isSelected = selectedLessons.has(index);
                                            return (_jsx("div", { className: `border rounded-lg p-3 ${!isValid ? "bg-red-50 border-red-200" : "bg-white"} ${isSelected && isValid ? "ring-2 ring-blue-500" : ""}`, children: _jsxs("div", { className: "flex items-start gap-3", children: [isValid && (_jsx(Checkbox, { checked: isSelected, onCheckedChange: () => toggleLesson(index), className: "mt-1" })), _jsxs("div", { className: "flex-grow", children: [_jsxs("div", { className: "flex items-center gap-2 mb-1", children: [lesson.day_of_week && (_jsx("span", { className: "text-xs font-medium bg-gray-100 px-2 py-1 rounded", children: getDayName(lesson.day_of_week) })), _jsxs("span", { className: "text-xs font-medium bg-blue-100 px-2 py-1 rounded", children: [lesson.start_time, " - ", lesson.end_time] }), _jsx("span", { className: "text-xs font-medium bg-green-100 px-2 py-1 rounded", children: lesson.kind })] }), _jsx("div", { className: "font-medium", children: lesson.title }), lesson.course_name && (_jsxs("div", { className: "text-sm text-muted-foreground", children: ["Vak: ", lesson.course_name] })), _jsxs("div", { className: "flex items-center gap-2 mt-1", children: [isValid ? (_jsxs("div", { className: "flex items-center gap-1 text-xs text-green-600", children: [_jsx(CheckCircle2, { className: "w-3 h-3" }), "Geldig"] })) : (_jsxs("div", { className: "flex items-center gap-1 text-xs text-red-600", children: [_jsx(XCircle, { className: "w-3 h-3" }), "Ongeldig"] })), _jsxs("span", { className: "text-xs text-muted-foreground", children: ["Zekerheid: ", Math.round(lesson.confidence * 100), "%"] })] }), !isValid && lesson.validation?.errors && (_jsx("div", { className: "mt-2 text-xs text-red-600", children: _jsx("ul", { className: "list-disc ml-4", children: lesson.validation.errors.map((err, i) => (_jsx("li", { children: err }, i))) }) }))] })] }) }, index));
                                        }) })] })), ocrResult.lessons.length > 0 && (_jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { onClick: importLessons, disabled: importing || selectedLessons.size === 0, className: "flex-grow", children: importing ? (_jsxs(_Fragment, { children: [_jsx(Loader2, { className: "w-4 h-4 mr-2 animate-spin" }), "Importeren..."] })) : (_jsxs(_Fragment, { children: [_jsx(Download, { className: "w-4 h-4 mr-2" }), selectedLessons.size, " ", selectedLessons.size === 1 ? "les" : "lessen", " ", "importeren"] })) }), _jsx(Button, { variant: "outline", onClick: reset, children: "Annuleren" })] })), ocrResult.lessons.length === 0 && (_jsxs(Alert, { variant: "destructive", children: [_jsx(XCircle, { className: "h-4 w-4" }), _jsx(AlertDescription, { children: "Geen lessen gevonden. Probeer een andere screenshot of controleer of het rooster duidelijk zichtbaar is." })] }))] }))] })] }));
}
