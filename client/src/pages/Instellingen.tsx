import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Upload, 
  Palette, 
  GraduationCap, 
  Bell, 
  Clock,
  Calendar,
  Download,
  Upload as UploadIcon,
  FileText,
  HelpCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// App kleur thema's
const colorThemes = [
  { 
    id: "purple", 
    name: "Paars", 
    primary: "hsl(262.1, 83.3%, 57.8%)",
    preview: "bg-purple-500"
  },
  { 
    id: "blue", 
    name: "Blauw (Standaard)", 
    primary: "hsl(217.2, 91.2%, 59.8%)",
    preview: "bg-blue-500"
  },
  { 
    id: "green", 
    name: "Groen", 
    primary: "hsl(142.1, 76.2%, 36.3%)",
    preview: "bg-green-500"
  },
  { 
    id: "pink", 
    name: "Roze", 
    primary: "hsl(330.1, 81.2%, 60.4%)",
    preview: "bg-pink-500"
  }
];

// Jaargang opties per onderwijstype
const educationLevels = {
  vmbo: ["vmbo 1", "vmbo 2", "vmbo 3", "vmbo 4"],
  havo: ["havo 3", "havo 2", "havo 3", "havo 4", "havo 5"],
  vwo: ["vwo 1", "vwo 2", "vwo 3", "vwo 4", "vwo 5", "vwo 6"],
  mbo: ["mbo 1", "mbo 2", "mbo 3", "mbo 4"]
};

export default function Instellingen() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTheme, setSelectedTheme] = useState("purple");
  const [selectedEducation, setSelectedEducation] = useState("havo");
  const [selectedGrade, setSelectedGrade] = useState("havo 5");
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [reminderTime, setReminderTime] = useState("18:00");
  const [icalUrl, setIcalUrl] = useState("");
  const [showIcalForm, setShowIcalForm] = useState(false);

  // Import iCal mutation
  const importIcalMutation = useMutation({
    mutationFn: async (url: string) => {
      const response = await apiRequest("POST", "/api/schedule/import-ical", {
        userId: user?.id,
        icalUrl: url.trim(),
      });
      return await response.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['/api/schedule'] });
      queryClient.invalidateQueries({ queryKey: ['/api/courses'] });
      setIcalUrl("");
      setShowIcalForm(false);
      toast({
        title: "iCal geïmporteerd!",
        description: `${result.scheduleCount || 0} roosteritems en ${result.courseCount || 0} vakken toegevoegd.`,
      });
    },
    onError: (error) => {
      console.error("iCal import error:", error);
      toast({
        title: "Import mislukt",
        description: "Kon iCal URL niet importeren. Controleer de URL en probeer opnieuw.",
        variant: "destructive",
      });
    }
  });

  const handleThemeChange = (themeId: string) => {
    setSelectedTheme(themeId);
    const theme = colorThemes.find(t => t.id === themeId);
    if (theme) {
      // Update CSS custom property for primary color
      document.documentElement.style.setProperty('--primary', theme.primary);
      toast({
        title: "Thema gewijzigd",
        description: `App kleur veranderd naar ${theme.name}`,
      });
    }
  };

  const handleRosterImport = (file: File) => {
    // Handle roster file import (CSV/iCal)
    const fileType = file.name.split('.').pop()?.toLowerCase();
    
    if (!['csv', 'ics', 'ical'].includes(fileType || '')) {
      toast({
        title: "Ongeldig bestand",
        description: "Upload een .csv of .ics bestand",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Rooster import gestart",
      description: `${file.name} wordt geïmporteerd...`,
    });
    
    // TODO: Implement actual import logic
  };

  const exportRoster = () => {
    toast({
      title: "Rooster export",
      description: "Je rooster wordt gedownload als CSV bestand",
    });
    // TODO: Implement export logic
  };

  return (
    <div className="p-4 space-y-6" data-testid="instellingen-page">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">Instellingen</h1>
        <p className="text-sm text-muted-foreground">
          Pas je app aan naar jouw wensen
        </p>
      </div>

      {/* App Thema */}
      <Card data-testid="theme-settings">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5" />
            App Kleur
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {colorThemes.map((theme) => (
              <button
                key={theme.id}
                onClick={() => handleThemeChange(theme.id)}
                className={`p-3 rounded-lg border-2 transition-all ${
                  selectedTheme === theme.id 
                    ? 'border-primary bg-primary/10' 
                    : 'border-border hover:border-primary/50'
                }`}
                data-testid={`theme-${theme.id}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full ${theme.preview}`} />
                  <span className="text-sm font-medium">{theme.name}</span>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Onderwijsniveau & Jaargang */}
      <Card data-testid="education-settings">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5" />
            Onderwijsniveau
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="education-level">Onderwijstype</Label>
            <Select value={selectedEducation} onValueChange={setSelectedEducation}>
              <SelectTrigger data-testid="select-education">
                <SelectValue placeholder="Kies onderwijstype" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vmbo">VMBO</SelectItem>
                <SelectItem value="havo">HAVO</SelectItem>
                <SelectItem value="vwo">VWO</SelectItem>
                <SelectItem value="mbo">MBO</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="grade-level">Jaargang</Label>
            <Select value={selectedGrade} onValueChange={setSelectedGrade}>
              <SelectTrigger data-testid="select-grade">
                <SelectValue placeholder="Kies jaargang" />
              </SelectTrigger>
              <SelectContent>
                {educationLevels[selectedEducation as keyof typeof educationLevels].map((grade) => (
                  <SelectItem key={grade} value={grade}>{grade}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-sm text-blue-800">
              💡 Deze instelling helpt bij het maken van gepaste taken en uitleg
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Notificaties */}
      <Card data-testid="notification-settings">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Meldingen
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="notifications">Dagelijkse herinneringen</Label>
              <p className="text-sm text-muted-foreground">
                Ontvang elke dag een herinnering om je huiswerk te checken
              </p>
            </div>
            <Switch
              id="notifications"
              checked={notificationsEnabled}
              onCheckedChange={setNotificationsEnabled}
              data-testid="switch-notifications"
            />
          </div>

          {notificationsEnabled && (
            <div className="space-y-2">
              <Label htmlFor="reminder-time">Herinnering tijd</Label>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <Input
                  id="reminder-time"
                  type="time"
                  value={reminderTime}
                  onChange={(e) => setReminderTime(e.target.value)}
                  className="w-32"
                  data-testid="input-reminder-time"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rooster Import/Export */}
      <Card data-testid="roster-settings">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Rooster Beheer
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div>
              <Label htmlFor="roster-import">Rooster Importeren</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Upload een .csv of .ics bestand van je schoolrooster
              </p>
              <div className="flex gap-2">
                <Input
                  id="roster-import"
                  type="file"
                  accept=".csv,.ics,.ical"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleRosterImport(file);
                  }}
                  className="hidden"
                  data-testid="input-roster-import"
                />
                <Button
                  onClick={() => document.getElementById('roster-import')?.click()}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                  data-testid="button-import-roster"
                >
                  <UploadIcon className="w-4 h-4" />
                  Bestand kiezen
                </Button>
              </div>
            </div>

            <Separator />

            <div>
              <Label>Rooster Exporteren</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Download je huidige rooster als CSV bestand
              </p>
              <Button
                onClick={exportRoster}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
                data-testid="button-export-roster"
              >
                <Download className="w-4 h-4" />
                Download Rooster
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rooster Import via iCal URL */}
      <Card data-testid="calendar-integration">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Rooster Import via iCal
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowIcalForm(!showIcalForm)}
              data-testid="button-toggle-ical-form"
            >
              <FileText className="w-4 h-4 mr-2" />
              iCal URL
            </Button>
          </div>
        </CardHeader>
        
        {showIcalForm && (
          <CardContent>
            <Alert className="mb-4">
              <HelpCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>📚 SomToday gebruikers:</strong> Log in op SomToday → Rooster → Exporteren → Kopieer de iCal URL. 
                Plak deze hieronder om je hele rooster in één keer te importeren!
              </AlertDescription>
            </Alert>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              if (icalUrl.trim()) {
                importIcalMutation.mutate(icalUrl.trim());
              }
            }} className="space-y-3">
              <div>
                <Label htmlFor="icalUrl">iCal URL</Label>
                <Input
                  id="icalUrl"
                  value={icalUrl}
                  onChange={(e) => setIcalUrl(e.target.value)}
                  placeholder="https://example.com/calendar.ics"
                  data-testid="input-ical-url"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Plak hier de iCal link van je school rooster (SomToday, Zermelo, etc.)
                </p>
              </div>
              
              <div className="flex space-x-2">
                <Button
                  type="submit"
                  size="sm"
                  disabled={importIcalMutation.isPending || !icalUrl.trim()}
                  data-testid="button-import-ical"
                >
                  {importIcalMutation.isPending ? "Importeren..." : "Rooster importeren"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowIcalForm(false)}
                  data-testid="button-cancel-ical"
                >
                  Annuleren
                </Button>
              </div>
            </form>
          </CardContent>
        )}
      </Card>

      {/* Account Info */}
      <Card data-testid="account-info">
        <CardHeader>
          <CardTitle>Account Informatie</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Naam:</span>
            <span className="text-sm">{user?.user_metadata?.full_name || 'Anouk'}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Email:</span>
            <span className="text-sm">{user?.email}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Rol:</span>
            <Badge variant="secondary">{user?.user_metadata?.role || 'student'}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-center pt-4">
        <Button 
          className="w-full max-w-xs"
          onClick={() => {
            toast({
              title: "Instellingen opgeslagen",
              description: "Je voorkeuren zijn succesvol opgeslagen",
            });
          }}
          data-testid="button-save-settings"
        >
          Instellingen Opslaan
        </Button>
      </div>
    </div>
  );
}