import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
  Upload,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Camera,
  Trash2,
  Download,
  Info,
} from "lucide-react";

interface DetectedLesson {
  day_of_week: number | null;
  start_time: string;
  end_time: string;
  title: string;
  kind: "les" | "toets" | "sport" | "werk" | "afspraak" | "hobby" | "anders";
  course_name?: string;
  confidence: number;
  validation?: {
    valid: boolean;
    errors: string[];
  };
}

interface OcrResult {
  success: boolean;
  rawText?: string;
  lessons: DetectedLesson[];
  warnings: string[];
  stats?: {
    total: number;
    valid: number;
    invalid: number;
  };
}

export default function ScheduleScreenshotImport() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [processing, setProcessing] = useState(false);
  const [selectedLessons, setSelectedLessons] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);

  // Reset state
  const reset = () => {
    setFile(null);
    setPreview(null);
    setOcrResult(null);
    setSelectedLessons(new Set());
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

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
    if (!file || !user?.id) return;

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
        const validIndices = new Set(
          data.lessons
            .map((l: DetectedLesson, i: number) => (l.validation?.valid ? i : -1))
            .filter((i: number) => i >= 0)
        );
        setSelectedLessons(validIndices);
      }

      toast({
        title: "Screenshot verwerkt!",
        description: `${data.stats?.valid || 0} lessen gevonden`,
      });
    } catch (error) {
      console.error("OCR error:", error);
      toast({
        title: "Fout bij verwerken",
        description: error instanceof Error ? error.message : "Onbekende fout",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  // Toggle lesson selection
  const toggleLesson = (index: number) => {
    const newSelected = new Set(selectedLessons);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedLessons(newSelected);
  };

  // Import selected lessons
  const importLessons = async () => {
    if (!user?.id || !ocrResult || selectedLessons.size === 0) return;

    setImporting(true);
    try {
      const lessonsToImport = Array.from(selectedLessons)
        .map((i) => ocrResult.lessons[i])
        .filter((l) => l.validation?.valid);

      // Find or create courses and import lessons
      let importedCount = 0;
      const errors: string[] = [];

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
            } else {
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

              if (courseError) throw courseError;
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

          if (scheduleError) throw scheduleError;
          importedCount++;
        } catch (error) {
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
      } else {
        toast({
          title: "Import succesvol!",
          description: `${importedCount} lessen toegevoegd aan je rooster`,
        });
        reset();
      }
    } catch (error) {
      console.error("Import error:", error);
      toast({
        title: "Import mislukt",
        description: error instanceof Error ? error.message : "Onbekende fout",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const getDayName = (dow: number) =>
    ["", "Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"][dow] || "?";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5" />
              Rooster importeren via screenshot
            </CardTitle>
            <CardDescription>
              Upload een screenshot van je Somtoday rooster om automatisch lessen toe te voegen
            </CardDescription>
          </div>
          {(file || ocrResult) && (
            <Button variant="ghost" size="sm" onClick={reset}>
              <Trash2 className="w-4 h-4 mr-2" />
              Reset
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Step 1: Upload screenshot */}
        {!ocrResult && (
          <div className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Tips voor beste resultaten:</strong>
                <ul className="list-disc ml-4 mt-2 space-y-1">
                  <li>Maak een duidelijke, scherpe screenshot van je weekrooster</li>
                  <li>Zorg dat tijden en vakken goed leesbaar zijn</li>
                  <li>Vermijd schaduwen of reflecties</li>
                  <li>Screenshot kan meerdere dagen bevatten</li>
                </ul>
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="screenshot">Screenshot van rooster</Label>
              <Input
                id="screenshot"
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="cursor-pointer"
              />
            </div>

            {preview && (
              <div className="space-y-2">
                <Label>Voorbeeld</Label>
                <img
                  src={preview}
                  alt="Screenshot preview"
                  className="max-h-96 w-full object-contain border rounded-lg"
                />
              </div>
            )}

            {file && (
              <Button onClick={processScreenshot} disabled={processing} className="w-full">
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Rooster herkennen... (dit kan 10-30 seconden duren)
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Rooster herkennen
                  </>
                )}
              </Button>
            )}
          </div>
        )}

        {/* Step 2: Review detected lessons */}
        {ocrResult && (
          <div className="space-y-4">
            {/* Stats */}
            {ocrResult.stats && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  <strong>Resultaat:</strong> {ocrResult.stats.valid} geldige lessen gevonden
                  {ocrResult.stats.invalid > 0 && ` (${ocrResult.stats.invalid} fouten)`}
                </AlertDescription>
              </Alert>
            )}

            {/* Warnings */}
            {ocrResult.warnings.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Waarschuwingen:</strong>
                  <ul className="list-disc ml-4 mt-1">
                    {ocrResult.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Lessons list */}
            {ocrResult.lessons.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Gevonden lessen ({ocrResult.lessons.length})</Label>
                  <div className="text-sm text-muted-foreground">
                    {selectedLessons.size} geselecteerd
                  </div>
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {ocrResult.lessons.map((lesson, index) => {
                    const isValid = lesson.validation?.valid ?? true;
                    const isSelected = selectedLessons.has(index);

                    return (
                      <div
                        key={index}
                        className={`border rounded-lg p-3 ${
                          !isValid ? "bg-red-50 border-red-200" : "bg-white"
                        } ${isSelected && isValid ? "ring-2 ring-blue-500" : ""}`}
                      >
                        <div className="flex items-start gap-3">
                          {isValid && (
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleLesson(index)}
                              className="mt-1"
                            />
                          )}
                          <div className="flex-grow">
                            <div className="flex items-center gap-2 mb-1">
                              {lesson.day_of_week && (
                                <span className="text-xs font-medium bg-gray-100 px-2 py-1 rounded">
                                  {getDayName(lesson.day_of_week)}
                                </span>
                              )}
                              <span className="text-xs font-medium bg-blue-100 px-2 py-1 rounded">
                                {lesson.start_time} - {lesson.end_time}
                              </span>
                              <span className="text-xs font-medium bg-green-100 px-2 py-1 rounded">
                                {lesson.kind}
                              </span>
                            </div>
                            <div className="font-medium">{lesson.title}</div>
                            {lesson.course_name && (
                              <div className="text-sm text-muted-foreground">
                                Vak: {lesson.course_name}
                              </div>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              {isValid ? (
                                <div className="flex items-center gap-1 text-xs text-green-600">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Geldig
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 text-xs text-red-600">
                                  <XCircle className="w-3 h-3" />
                                  Ongeldig
                                </div>
                              )}
                              <span className="text-xs text-muted-foreground">
                                Zekerheid: {Math.round(lesson.confidence * 100)}%
                              </span>
                            </div>
                            {!isValid && lesson.validation?.errors && (
                              <div className="mt-2 text-xs text-red-600">
                                <ul className="list-disc ml-4">
                                  {lesson.validation.errors.map((err, i) => (
                                    <li key={i}>{err}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Import button */}
            {ocrResult.lessons.length > 0 && (
              <div className="flex gap-2">
                <Button
                  onClick={importLessons}
                  disabled={importing || selectedLessons.size === 0}
                  className="flex-grow"
                >
                  {importing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Importeren...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      {selectedLessons.size} {selectedLessons.size === 1 ? "les" : "lessen"}{" "}
                      importeren
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={reset}>
                  Annuleren
                </Button>
              </div>
            )}

            {ocrResult.lessons.length === 0 && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  Geen lessen gevonden. Probeer een andere screenshot of controleer of het rooster
                  duidelijk zichtbaar is.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
