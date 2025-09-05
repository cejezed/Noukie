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
  Users,
  Eye,
  Calendar,
  BookOpen,
  TrendingUp,
  Bell,
  Heart,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  UserPlus,
} from "lucide-react";

interface ParentIntroModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const parentIntroSteps = [
  {
    title: "Welkom Ouder! 👨 👩 👧 👦",
    content: (
      <div className="space-y-4">
        <p className="text-muted-foreground">
          Fijn dat je meedoet! Als ouder kun je je kind ondersteunen door hun voortgang te volgen en inzicht te krijgen in hun huiswerkgewoonten.
        </p>
        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-semibold text-blue-800 mb-2">Wat kun je als ouder doen?</h4>
          <ul className="space-y-2 text-sm text-blue-700">
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Je kind koppelen aan jouw account
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Huiswerk voortgang bekijken
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Komende toetsen en deadlines zien
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Inzicht in dagelijkse check-ins
            </li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    title: "👥 Je Kind Koppelen",
    content: (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
          <UserPlus className="w-8 h-8 text-green-600" />
          <div>
            <h4 className="font-semibold text-green-800">Account Koppeling</h4>
            <p className="text-sm text-green-600">
              Verbind met het account van je kind
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="font-semibold">Hoe werkt het koppelen?</h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-1">1</Badge>
              <p>Vul de email van je kind in bij "Kind Toevoegen"</p>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-1">2</Badge>
              <p>Je kind krijgt een notificatie om jou te bevestigen</p>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="mt-1">3</Badge>
              <p>Na bevestiging zie je hun voortgang hier</p>
            </div>
          </div>
        </div>

        <div className="bg-orange-50 p-3 rounded-lg">
          <p className="text-sm text-orange-800">
            💡 <strong>Tip:</strong> Je kind heeft controle en moet jou eerst bevestigen voor privacy.
          </p>
        </div>
      </div>
    ),
  },
  {
    title: "📊 Voortgang Bekijken",
    content: (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
          <TrendingUp className="w-8 h-8 text-purple-600" />
          <div>
            <h4 className="font-semibold text-purple-800">Inzicht & Overzicht</h4>
            <p className="text-sm text-purple-600">
              Volg hoe je kind het doet met huiswerk
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="font-semibold">Wat zie je allemaal?</h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="p-2 bg-gray-50 rounded">
              <h5 className="font-medium">✅ Voltooide Taken</h5>
              <p className="text-xs text-muted-foreground">Afgevinkte huiswerk</p>
            </div>
            <div className="p-2 bg-gray-50 rounded">
              <h5 className="font-medium">⏰ Komende Toetsen</h5>
              <p className="text-xs text-muted-foreground">Belangrijke deadlines</p>
            </div>
            <div className="p-2 bg-gray-50 rounded">
              <h5 className="font-medium">🎙️ Voice Check-ins</h5>
              <p className="text-xs text-muted-foreground">Dagelijkse reflecties</p>
            </div>
            <div className="p-2 bg-gray-50 rounded">
              <h5 className="font-medium">📈 Trends</h5>
              <p className="text-xs text-muted-foreground">Voortgang over tijd</p>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "🔔 Meldingen & Updates",
    content: (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg">
          <Bell className="w-8 h-8 text-yellow-600" />
          <div>
            <h4 className="font-semibold text-yellow-800">Automatische Updates</h4>
            <p className="text-sm text-yellow-600">
              Blijf op de hoogte zonder te bemoeien
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="font-semibold">Wanneer krijg je meldingen?</h4>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              Wanneer je kind een toets heeft voltooid
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              Bij belangrijke deadlines die dichtbij komen
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              Als je kind een paar dagen geen check-in heeft gedaan
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              Weekly summary van de voortgang
            </li>
          </ul>
        </div>

        <div className="bg-blue-50 p-3 rounded-lg">
          <p className="text-sm text-blue-800">
            📱 <strong>Privacy eerst:</strong> Je ziet voortgang, niet de inhoud van gesprekken.
          </p>
        </div>
      </div>
    ),
  },
  {
    title: "💡 Tips voor Ouders",
    content: (
      <div className="space-y-4">
        <div className="space-y-3">
          <div className="p-3 bg-green-50 rounded-lg">
            <h4 className="font-semibold text-green-800 mb-2">🎯 Stimuleer zelfstandigheid</h4>
            <p className="text-sm text-green-700">
              Laat je kind zelf de app gebruiken. Jij kijkt mee, zij doen het werk. Dit helpt hen zelfstandiger te worden.
            </p>
          </div>

          <div className="p-3 bg-blue-50 rounded-lg">
            <h4 className="font-semibold text-blue-800 mb-2">💬 Bespreek de voortgang</h4>
            <p className="text-sm text-blue-700">
              Gebruik wat je hier ziet als gespreksstarter. "Ik zag dat je veel wiskunde hebt gedaan deze week!"
            </p>
          </div>

          <div className="p-3 bg-purple-50 rounded-lg">
            <h4 className="font-semibold text-purple-800 mb-2">🏆 Vier successen</h4>
            <p className="text-sm text-purple-700">
              Complimenteer je kind wanneer je ziet dat ze consistent bezig zijn, ook met kleine stapjes.
            </p>
          </div>

          <div className="p-3 bg-orange-50 rounded-lg">
            <h4 className="font-semibold text-orange-800 mb-2">🤝 Ondersteun bij problemen</h4>
            <p className="text-sm text-orange-700">
              Als je ziet dat er weinig activiteit is, vraag hoe je kunt helpen in plaats van direct in te grijpen.
            </p>
          </div>
        </div>
      </div>
    ),
  },
];

export default function ParentIntroModal({ open, onOpenChange }: ParentIntroModalProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const nextStep = () => {
    if (currentStep < parentIntroSteps.length - 1) {
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
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto" data-testid="parent-intro-modal">
        <DialogHeader>
          <DialogTitle className="text-center">
            {parentIntroSteps[currentStep].title}
          </DialogTitle>
          <DialogDescription className="text-center">
            Stap {currentStep + 1} van {parentIntroSteps.length}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {parentIntroSteps[currentStep].content}
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
            {parentIntroSteps.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentStep ? 'bg-primary' : 'bg-muted'
                }`}
              />
            ))}
          </div>

          {currentStep < parentIntroSteps.length - 1 ? (
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
              Begin!
              <Heart className="w-4 h-4" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
