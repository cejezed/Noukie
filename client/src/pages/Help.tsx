import * as React from "react";
import { useState } from "react";
import { Camera, Upload, Mic, Square } from "lucide-react";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import HelpModal from "@/components/HelpModal";

export default function Help() {
  const [textInput, setTextInput] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("");
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [helpData, setHelpData] = useState<any>(null);

  const courses = ["Wiskunde A", "Biologie", "Economie", "Nederlands"];

  const handleVoiceRecording = (audioBlob: Blob) => {
    // Convert audio to help data
    setHelpData({
      mode: "voice",
      audioBlob,
      course: selectedCourse,
    });
    setShowHelpModal(true);
  };
  
  // Voice recording
  const { 
    isRecording, 
    startRecording, 
    stopRecording, 
    recordingTime
  } = useVoiceRecorder({
    maxDuration: 60,
    onRecordingComplete: handleVoiceRecording,
    onStatusChange: (status) => {
      console.log("Voice recording status:", status);
    }
  });

  const handleFileUpload = (type: "photo" | "pdf") => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = type === "photo" ? "image/*" : ".pdf";
    
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        // Set up help modal with file data
        setHelpData({
          mode: "image",
          file,
          course: selectedCourse,
        });
        setShowHelpModal(true);
      }
    };

    input.click();
  };

  const handleTextHelp = () => {
    if (!textInput.trim()) {
      return;
    }

    setHelpData({
      mode: "text",
      text: textInput,
      course: selectedCourse,
    });
    setShowHelpModal(true);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')} / 1:00`;
  };

  return (
    <div className="p-6" data-testid="page-help">
      <h2 className="text-xl font-semibold mb-6">Ik snap dit niet</h2>
      
      {/* Upload Options */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Button
          variant="outline"
          className="h-24 flex flex-col items-center justify-center space-y-1 border-dashed hover:border-primary transition-colors"
          onClick={() => handleFileUpload("photo")}
          data-testid="button-upload-photo"
        >
          <Camera className="w-5 h-5" />
          <div className="text-center">
            <p className="text-xs font-medium">Foto</p>
            <p className="text-xs text-muted-foreground">Opgave</p>
          </div>
        </Button>

        <Button
          variant="outline"
          className="h-24 flex flex-col items-center justify-center space-y-1 border-dashed hover:border-primary transition-colors"
          onClick={isRecording ? stopRecording : startRecording}
          data-testid="button-voice-help"
        >
          {isRecording ? <Square className="w-5 h-5 text-destructive" /> : <Mic className="w-5 h-5" />}
          <div className="text-center">
            <p className="text-xs font-medium">{isRecording ? "Stop" : "Vraag"}</p>
            <p className="text-xs text-muted-foreground">
              {isRecording ? formatTime(recordingTime) : "Inspreek"}
            </p>
          </div>
        </Button>

        <Button
          variant="outline"
          className="h-24 flex flex-col items-center justify-center space-y-1 border-dashed hover:border-primary transition-colors"
          onClick={() => handleFileUpload("pdf")}
          data-testid="button-upload-pdf"
        >
          <Upload className="w-5 h-5" />
          <div className="text-center">
            <p className="text-xs font-medium">PDF</p>
            <p className="text-xs text-muted-foreground">Document</p>
          </div>
        </Button>
      </div>

      {/* Text Input */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Of beschrijf wat je niet snapt</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="help-text">Beschrijving</Label>
            <Textarea
              id="help-text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Bijv. Ik snap niet hoe je de sinus van een hoek berekent..."
              className="resize-none"
              rows={4}
              data-testid="textarea-help-text"
            />
          </div>

          <div className="flex items-end justify-between">
            <div className="space-y-1">
              <Label htmlFor="course">Vak</Label>
              <Select
                value={selectedCourse}
                onValueChange={setSelectedCourse}
              >
                <SelectTrigger className="w-40" data-testid="select-course">
                  <SelectValue placeholder="Selecteer vak" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((course) => (
                    <SelectItem key={course} value={course}>
                      {course}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleTextHelp}
              disabled={!textInput.trim()}
              data-testid="button-get-help"
            >
              Help krijgen
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tips Card */}
      <Card className="mt-6">
        <CardContent className="pt-6">
          <h3 className="font-medium mb-3">Tips voor betere hulp:</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start space-x-2">
              <span className="text-primary">•</span>
              <span>Wees zo specifiek mogelijk over wat je niet snapt</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-primary">•</span>
              <span>Bij foto's: zorg voor goede belichting en scherpte</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-primary">•</span>
              <span>Selecteer het juiste vak voor betere uitleg</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-primary">•</span>
              <span>Probeer eerst zelf te begrijpen voordat je de uitleg vraagt</span>
            </li>
          </ul>
          
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
            <p className="text-sm text-amber-800">
              <strong>⚠️ Belangrijk:</strong> Controleer belangrijke informatie altijd met je schoolboek, docent of andere betrouwbare bronnen. AI kan soms fouten maken.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Help Modal */}
      <HelpModal
        open={showHelpModal}
        onOpenChange={setShowHelpModal}
        helpData={helpData}
      />
    </div>
  );
}
