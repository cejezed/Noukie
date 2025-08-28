import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Mic,
  Calendar,
  Plus,
  HelpCircle,
  Settings,
  CheckCircle,
  Clock,
  BookOpen,
  Users,
  Smartphone,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface AppIntroModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const introSteps = [
  {
    title: "Welkom bij Huiswerkcoach Noukie! 👋",
    content: (
      <div className="space-y-4">
        <p className="text-muted-foreground">
          Ik ben je persoonlijke huiswerkcoach en help je elke dag om je huiswerk goed te plannen en uit te voeren.
        </p>
        <div className="bg-purple-50 p-4 rounded-lg">
          <h4 className="font-semibold text-purple-800 mb-2">Wat kan ik voor je doen?</h4>
          <ul className="space-y-2 text-sm text-purple-700">
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Dagelijkse voice check-ins voor takenplanning
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Huiswerkuitleg met foto's en stap-voor-stap hulp
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Slimme roosterplanning en herinneringen
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Ouders kunnen je voortgang volgen
            </li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    title: "🎙️ Vandaag Tab - Je Dagelijkse Check-in",
    content: (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
          <Mic className="w-8 h-8 text-blue-600" />
          <div>
            <h4 className="font-semibold text-blue-800">Voice Check-ins</h4>
            <p className="text-sm text-blue-600">
              Vertel elke dag wat je hebt gedaan en wat er nog moet gebeuren
            </p>
          </div>
        </div>
        
        <div className="space-y-3">
          <h4 className="font-semibold">Hoe werkt het?</h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-1">1</Badge>
              <p>Klik op de microfoon en vertel over je dag</p>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-1">2</Badge>
              <p>Ik maak automatisch taken aan van wat je zegt</p>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-1">3</Badge>
              <p>Je ziet je prioriteiten en planning voor vandaag</p>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "📅 Rooster Tab - Je Planning Overzicht",
    content: (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
          <Calendar className="w-8 h-8 text-green-600" />
          <div>
            <h4 className="font-semibold text-green-800">Wekelijks Overzicht</h4>
            <p className="text-sm text-green-600">
              Alle taken, toetsen en deadlines in één overzicht
            </p>
          </div>
        </div>
        
        <div className="space-y-3">
          <h4 className="font-semibold">Handige functies:</h4>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              Taken afvinken als je ze af hebt
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              Prioriteit aanpassen (hoog, normaal, laag)
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              Deadline bijhouden voor belangrijke dingen
            </li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    title: "➕ Toevoegen Tab - Handmatig Invoeren",
    content: (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg">
          <Plus className="w-8 h-8 text-orange-600" />
          <div>
            <h4 className="font-semibold text-orange-800">Rooster & Taken</h4>
            <p className="text-sm text-orange-600">
              Voeg lessen, toetsen en huiswerk handmatig toe
            </p>
          </div>
        </div>
        
        <div className="space-y-3">
          <h4 className="font-semibold">Wat kun je toevoegen?</h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="p-2 bg-gray-50 rounded">
              <h5 className="font-medium">📚 Lessen</h5>
              <p className="text-xs text-muted-foreground">Wiskunde, Nederlands, etc.</p>
            </div>
            <div className="p-2 bg-gray-50 rounded">
              <h5 className="font-medium">📝 Toetsen</h5>
              <p className="text-xs text-muted-foreground">Met datum en tijd</p>
            </div>
            <div className="p-2 bg-gray-50 rounded">
              <h5 className="font-medium">📋 Huiswerk</h5>
              <p className="text-xs text-muted-foreground">Taken en opdrachten</p>
            </div>
            <div className="p-2 bg-gray-50 rounded">
              <h5 className="font-medium">⚽ Activiteiten</h5>
              <p className="text-xs text-muted-foreground">Sport, hobby's, etc.</p>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "❓ Uitleg Tab - Je Huiswerkassistent",
    content: (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
          <HelpCircle className="w-8 h-8 text-purple-600" />
          <div>
            <h4 className="font-semibold text-purple-800">OCR + AI Hulp</h4>
            <p className="text-sm text-purple-600">
              Maak een foto van je huiswerk en krijg uitleg
            </p>
          </div>
        </div>
        
        <div className="space-y-3">
          <h4 className="font-semibold">Hoe gebruik je dit?</h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-1">1</Badge>
              <p>Maak een foto van je huiswerk of upload een PDF</p>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-1">2</Badge>
              <p>Ik lees de tekst en begrijp de vraag</p>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-1">3</Badge>
              <p>Je krijgt stap-voor-stap uitleg en voorbeelden</p>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-1">4</Badge>
              <p>Test jezelf met een kleine quiz</p>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "⚙️ Instellingen Tab - Maak Het Jouw App",
    content: (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
          <Settings className="w-8 h-8 text-gray-600" />
          <div>
            <h4 className="font-semibold text-gray-800">Personalisatie</h4>
            <p className="text-sm text-gray-600">
              Stel de app in zoals jij het fijn vindt
            </p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="space-y-2">
            <h5 className="font-medium">🎨 App Kleuren</h5>
            <p className="text-xs text-muted-foreground">Paars, blauw, groen of roze</p>
          </div>
          <div className="space-y-2">
            <h5 className="font-medium">📚 Jaargang</h5>
            <p className="text-xs text-muted-foreground">VMBO, HAVO, VWO, MBO</p>
          </div>
          <div className="space-y-2">
            <h5 className="font-medium">🔔 Meldingen</h5>
            <p className="text-xs text-muted-foreground">Dagelijkse herinneringen</p>
          </div>
          <div className="space-y-2">
            <h5 className="font-medium">📅 Import</h5>
            <p className="text-xs text-muted-foreground">iCal rooster import</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "💡 Tips voor Optimaal Gebruik",
    content: (
      <div className="space-y-4">
        <div className="space-y-3">
          <div className="p-3 bg-yellow-50 rounded-lg">
            <h4 className="font-semibold text-yellow-800 mb-2">🌅 Begin je dag goed</h4>
            <p className="text-sm text-yellow-700">
              Doe elke ochtend een voice check-in. Vertel wat je gisteren hebt gedaan en wat je vandaag wilt bereiken.
            </p>
          </div>
          
          <div className="p-3 bg-blue-50 rounded-lg">
            <h4 className="font-semibold text-blue-800 mb-2">📱 Gebruik foto's</h4>
            <p className="text-sm text-blue-700">
              Als je ergens niet uitkomt, maak een foto van de opdracht. Ik geef je dan stap-voor-stap uitleg.
            </p>
          </div>
          
          <div className="p-3 bg-indigo-50 rounded-lg">
            <h4 className="font-semibold text-indigo-800 mb-2">📅 SomToday rooster</h4>
            <p className="text-sm text-indigo-700">
              Gebruik je SomToday? Exporteer je rooster als iCal URL en importeer het in één keer via het Rooster tabblad!
            </p>
          </div>
          
          <div className="p-3 bg-green-50 rounded-lg">
            <h4 className="font-semibold text-green-800 mb-2">👨‍👩‍👧‍👦 Betrek je ouders</h4>
            <p className="text-sm text-green-700">
              Je ouders kunnen een eigen account maken om je voortgang te volgen. Vraag het ze!
            </p>
          </div>
          
          <div className="p-3 bg-purple-50 rounded-lg">
            <h4 className="font-semibold text-purple-800 mb-2">🔄 Wees consistent</h4>
            <p className="text-sm text-purple-700">
              Hoe meer je de app gebruikt, hoe beter ik je kan helpen. Probeer het elke dag even te checken.
            </p>
          </div>
        </div>
      </div>
    ),
  },
];

export default function AppIntroModal({ open, onOpenChange }: AppIntroModalProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const nextStep = () => {
    if (currentStep < introSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleClose = () => {
    setCurrentStep(0);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto" data-testid="app-intro-modal">
        <DialogHeader>
          <DialogTitle className="text-center">
            {introSteps[currentStep].title}
          </DialogTitle>
          <DialogDescription className="text-center">
            Stap {currentStep + 1} van {introSteps.length}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {introSteps[currentStep].content}
        </div>

        <Separator />

        <div className="flex items-center justify-between pt-4">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 0}
            className="flex items-center gap-2"
            data-testid="button-prev-step"
          >
            <ChevronLeft className="w-4 h-4" />
            Vorige
          </Button>

          <div className="flex gap-2">
            {introSteps.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentStep ? 'bg-primary' : 'bg-muted'
                }`}
              />
            ))}
          </div>

          {currentStep < introSteps.length - 1 ? (
            <Button
              onClick={nextStep}
              className="flex items-center gap-2"
              data-testid="button-next-step"
            >
              Volgende
              <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={handleClose}
              className="flex items-center gap-2"
              data-testid="button-close-intro"
            >
              Start!
              <CheckCircle className="w-4 h-4" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}