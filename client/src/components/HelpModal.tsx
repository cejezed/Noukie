import * as React from "react";
import { useState, useEffect } from "react";
import { Camera, Upload, Play, Volume2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAudio } from "@/hooks/use-audio";
import type { Task, Course } from "@shared/schema";

interface HelpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task;
  course?: Course;
  helpData?: {
    mode: string;
    text?: string;
    course?: string;
    file?: File;
  };
}

interface ExplanationResult {
  steps: string[];
  example: { prompt: string; solution: string };
  quiz: { question: string; choices: string[]; answer: string };
  coach_text: string;
  resources: { title: string; url: string }[];
}

export default function HelpModal({ open, onOpenChange, task, course, helpData }: HelpModalProps) {
  const { toast } = useToast();
  const { playAudio } = useAudio();
  const [textInput, setTextInput] = useState(helpData?.text || "");
  const [selectedCourse, setSelectedCourse] = useState(helpData?.course || course?.name || "");
  const [explanation, setExplanation] = useState<ExplanationResult | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [currentTopic, setCurrentTopic] = useState("");

  const courses = ["Wiskunde A", "Biologie", "Economie", "Nederlands"];

  // Auto-start help request when helpData is provided
  useEffect(() => {
    if (helpData && open && !explanation) {
      if (helpData.mode === "text" && helpData.text) {
        helpMutation.mutate({
          mode: "text",
          text: helpData.text,
          course: helpData.course,
        });
      }
    }
  }, [helpData, open, explanation]);

  // Reset explanation when modal closes
  useEffect(() => {
    if (!open) {
      setExplanation(null);
      setSelectedAnswer("");
    }
  }, [open]);

  const helpMutation = useMutation({
    mutationFn: async (data: { mode: string; text?: string; course?: string }) => {
      const response = await apiRequest("POST", "/api/explain", data);
      return await response.json();
    },
    onSuccess: (data: ExplanationResult) => {
      setExplanation(data);

      // If no currentTopic is set (edge case), use the first step as topic
      if (!currentTopic && data.steps.length > 0) {
        setCurrentTopic(data.steps[0].substring(0, 50)); // First 50 chars of first step
      }

      // Play coach audio
      if (data.coach_text) {
        playTTSAudio(data.coach_text);
      }
    },
    onError: (error) => {
      console.error("Help error:", error);
      toast({
        title: "Fout bij uitleg",
        description: "Probeer het opnieuw.",
        variant: "destructive",
      });
    }
  });

  const ttsAudioMutation = useMutation({
    mutationFn: async (text: string) => {
      const response = await apiRequest("POST", "/api/tts", { text });
      return await response.json();
    },
    onSuccess: (data) => {
      if (data.audioUrl) {
        playAudio(data.audioUrl);
      }
    }
  });

  const playTTSAudio = (text: string) => {
    if (text && text.trim()) {
      ttsAudioMutation.mutate(text);
    }
  };

  // Expand explanation mutation
  const expandMutation = useMutation({
    mutationFn: async () => {
      if (!explanation || !currentTopic || !selectedCourse) {
        throw new Error("Missing data for expansion");
      }

      console.log("Sending expand request:", {
        topic: currentTopic,
        course: selectedCourse,
        hasExplanation: !!explanation
      });

      const response = await apiRequest("POST", "/api/explain/expand", {
        originalExplanation: explanation,
        topic: currentTopic,
        course: selectedCourse
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error("Expand API error:", errorData);
        throw new Error(`Server error: ${response.status}`);
      }

      return await response.json();
    },
    onSuccess: (data: ExplanationResult) => {
      setExplanation(data);
      setSelectedAnswer(""); // Reset quiz answer

      // Play new coach audio
      if (data.coach_text) {
        playTTSAudio(data.coach_text);
      }

      toast({
        title: "Uitgebreide uitleg",
        description: "Je hebt nu meer gedetailleerde stappen en een moeilijkere vraag!"
      });
    },
    onError: (error) => {
      console.error("Expand error:", error);
      toast({
        title: "Fout",
        description: "Kon geen uitgebreide uitleg genereren. Probeer opnieuw.",
        variant: "destructive"
      });
    }
  });

  const handleTextHelp = () => {
    if (!textInput.trim()) {
      toast({
        title: "Geen tekst",
        description: "Typ eerst wat je niet snapt.",
        variant: "destructive",
      });
      return;
    }

    setCurrentTopic(textInput); // Store the topic for potential expansion
    helpMutation.mutate({
      mode: "text",
      text: textInput,
      course: selectedCourse,
    });
  };

  const handleMoreExplanation = () => {
    console.log("More explanation clicked:", { explanation: !!explanation, currentTopic, selectedCourse });
    if (explanation && currentTopic && selectedCourse) {
      expandMutation.mutate();
    } else {
      console.log("Missing data for expansion:", {
        hasExplanation: !!explanation,
        currentTopic,
        selectedCourse
      });
      toast({
        title: "Fout",
        description: "Kan geen uitgebreide uitleg genereren. Probeer eerst nieuwe hulp te vragen.",
        variant: "destructive"
      });
    }
  };

  const handleFileUpload = (type: "photo" | "pdf") => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = type === "photo" ? "image/*" : ".pdf";

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const formData = new FormData();
      formData.append("image", file);

      try {
        const ocrResponse = await apiRequest("POST", "/api/ocr", formData);
        const { text } = await ocrResponse.json();

        setCurrentTopic(text); // Store OCR text as topic for expansion
        helpMutation.mutate({
          mode: "image",
          text,
          course: selectedCourse,
        });
      } catch (error) {
        console.error("OCR error:", error);
        toast({
          title: "Fout bij verwerken",
          description: "Kon bestand niet verwerken.",
          variant: "destructive",
        });
      }
    };

    input.click();
  };

  const checkQuizAnswer = () => {
    if (!explanation || !selectedAnswer) return;

    const isCorrect = selectedAnswer === explanation.quiz.answer;

    toast({
      title: isCorrect ? "Goed gedaan!" : "Niet helemaal juist",
      description: isCorrect
        ? "Je hebt het goede antwoord gekozen."
        : `Het juiste antwoord is ${explanation.quiz.answer}.`,
      variant: isCorrect ? "default" : "destructive",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md mx-auto max-h-[90vh] overflow-y-auto" data-testid="help-modal">
        <DialogHeader>
          <DialogTitle>Ik snap dit niet</DialogTitle>
          {explanation && (
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mt-2">
              <p className="text-sm text-amber-800">
                ⚠️ <strong>Verificatie aanbevolen:</strong> Controleer belangrijke informatie altijd met je schoolboek of vraag het na bij je docent.
              </p>
            </div>
          )}
        </DialogHeader>

        {!explanation && !helpMutation.isPending ? (
          <div className="space-y-6">
            {/* Upload Options */}
            <div className="grid grid-cols-2 gap-4">
              <Button
                variant="outline"
                className="h-24 flex flex-col items-center justify-center space-y-2 border-dashed"
                onClick={() => handleFileUpload("photo")}
                data-testid="button-upload-photo"
              >
                <Camera className="w-6 h-6" />
                <div className="text-center">
                  <p className="text-sm font-medium">Foto maken</p>
                  <p className="text-xs text-muted-foreground">Van opgave of boek</p>
                </div>
              </Button>

              <Button
                variant="outline"
                className="h-24 flex flex-col items-center justify-center space-y-2 border-dashed"
                onClick={() => handleFileUpload("pdf")}
                data-testid="button-upload-pdf"
              >
                <Upload className="w-6 h-6" />
                <div className="text-center">
                  <p className="text-sm font-medium">PDF uploaden</p>
                  <p className="text-xs text-muted-foreground">Digitaal bestand</p>
                </div>
              </Button>
            </div>

            {/* Text Input */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Of beschrijf wat je niet snapt
                </label>
                <Textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Bijv. Ik snap niet hoe je de sinus van een hoek berekent..."
                  className="resize-none"
                  rows={3}
                  data-testid="textarea-help-text"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium mb-1">Vak</label>
                  <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                    <SelectTrigger className="w-32" data-testid="select-course">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {courses.map((courseName) => (
                        <SelectItem key={courseName} value={courseName}>
                          {courseName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={handleTextHelp}
                  disabled={helpMutation.isPending}
                  data-testid="button-get-help"
                >
                  {helpMutation.isPending ? "Bezig..." : "Help krijgen"}
                </Button>
              </div>
            </div>
          </div>
        ) : helpMutation.isPending ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
            <span className="ml-3">Bezig met uitleg genereren...</span>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Explanation Header */}
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Uitleg: {task?.title || "Algemene hulp"}</h3>
              <Button
                variant="outline"
                size="icon"
                onClick={() => playTTSAudio(explanation?.coach_text || '')}
                disabled={ttsAudioMutation.isPending}
                data-testid="button-play-explanation"
              >
                <Volume2 className="w-4 h-4" />
              </Button>
            </div>

            {/* Steps */}
            <div>
              <h4 className="text-sm font-medium mb-2">Stappen:</h4>
              <ol className="space-y-2 text-sm">
                {explanation?.steps?.map((step, index) => (
                  <li key={index} className="flex" data-testid={`step-${index}`}>
                    <span className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs mr-3 flex-shrink-0">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Example */}
            <div className="bg-muted/50 rounded-lg p-3" data-testid="example-section">
              <h4 className="text-sm font-medium mb-2">Voorbeeld:</h4>
              <p className="text-sm mb-2">{explanation?.example?.prompt || 'Geen voorbeeld beschikbaar'}</p>
              <p className="text-sm font-mono bg-background px-2 py-1 rounded">
                {explanation?.example?.solution || 'Geen oplossing beschikbaar'}
              </p>
            </div>

            {/* Quiz */}
            <div className="border border-border rounded-lg p-3" data-testid="quiz-section">
              <h4 className="text-sm font-medium mb-3">Controle vraag:</h4>
              <p className="text-sm mb-3">{explanation?.quiz?.question || 'Geen vraag beschikbaar'}</p>

              <div className="space-y-2 mb-4">
                {explanation?.quiz?.choices?.map((choice, index) => (
                  <label key={index} className="flex items-center space-x-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="quiz-answer"
                      value={choice.charAt(0)}
                      checked={selectedAnswer === choice.charAt(0)}
                      onChange={(e) => setSelectedAnswer(e.target.value)}
                      className="text-primary"
                      data-testid={`radio-answer-${choice.charAt(0)}`}
                    />
                    <span>{choice}</span>
                  </label>
                ))}
              </div>

              <div className="flex space-x-2">
                <Button
                  className="flex-1"
                  onClick={checkQuizAnswer}
                  disabled={!selectedAnswer}
                  data-testid="button-check-answer"
                >
                  Controleren
                </Button>
                <Button
                  variant="outline"
                  onClick={handleMoreExplanation}
                  disabled={expandMutation.isPending}
                  data-testid="button-more-explanation"
                >
                  {expandMutation.isPending ? "Bezig..." : "Meer uitleg"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  data-testid="button-understood"
                >
                  Snap ik nu
                </Button>
              </div>
            </div>

            {/* Nuttige Links */}
            {explanation?.resources && explanation.resources.length > 0 && (
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-3 flex items-center">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Meer leren:
                </h4>
                <div className="space-y-2">
                  {explanation.resources.map((resource, index) => (
                    <a
                      key={index}
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center text-sm text-primary hover:text-primary/80 underline transition-colors"
                      data-testid={`resource-link-${index}`}
                    >
                      <ExternalLink className="w-3 h-3 mr-1 flex-shrink-0" />
                      {resource.title}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
