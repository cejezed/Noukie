import { useMemo, useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Upload as UploadIcon,
  Palette,
  GraduationCap,
  Bell,
  Clock,
  Calendar,
  Download,
  FileText,
  HelpCircle,
  Trash2,
  Plus,
  Loader2,
  Circle,
  CalendarX,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import type { Course, Schedule } from "@shared/schema";

// App kleur thema's
const colorThemes = [
  { id: "purple", name: "Paars", primary: "hsl(262.1, 83.3%, 57.8%)", preview: "bg-purple-500" },
  { id: "blue", name: "Blauw (Standaard)", primary: "hsl(217.2, 91.2%, 59.8%)", preview: "bg-blue-500" },
  { id: "green", name: "Groen", primary: "hsl(142.1, 76.2%, 36.3%)", preview: "bg-green-500" },
  { id: "pink", name: "Roze", primary: "hsl(330.1, 81.2%, 60.4%)", preview: "bg-pink-500" },
];

// Jaargang opties
const educationLevels = {
  vmbo: ["vmbo 1", "vmbo 2", "vmbo 3", "vmbo 4"],
  havo: ["havo 1", "havo 2", "havo 3", "havo 4", "havo 5"],
  vwo: ["vwo 1", "vwo 2", "vwo 3", "vwo 4", "vwo 5", "vwo 6"],
  mbo: ["mbo 1", "mbo 2", "mbo 3", "mbo 4"],
};

type Kind = "les" | "toets" | "sport" | "werk" | "afspraak" | "hobby" | "anders";

export default function Instellingen() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Naam zoals bovenaan
  const displayName =
    (user?.user_metadata?.full_name as string) ||
    (user?.user_metadata?.name as string) ||
    (user?.user_metadata?.display_name as string) ||
    (user?.user_metadata?.username as string) ||
    (user?.email ? String(user.email).split("@")[0] : "—");

  // UI states
  const [selectedTheme, setSelectedTheme] = useState("purple");
  const [selectedEducation, setSelectedEducation] = useState("havo");
  const [selectedGrade, setSelectedGrade] = useState("havo 5");
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [reminderTime, setReminderTime] = useState("18:00");
  const [icalUrl, setIcalUrl] = useState("");
  const [showIcalForm, setShowIcalForm] = useState(false);

  // Rooster: formulier
  const [formData, setFormData] = useState<{
    course_id: string | null;
    day_of_week: number | null;
    start_time: string;
    end_time: string;
    kind: Kind;
    title: string;
    is_recurring: boolean;
    date: string | null;
  }>({
    course_id: null,
    day_of_week: 1,
    start_time: "",
    end_time: "",
    kind: "les",
    title: "",
    is_recurring: true,
    date: null,
  });

  // Vakken beheren UI
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [courseFormData, setCourseFormData] = useState({ name: "", color: "#4287f5" });

  // Courses
  const { data: courses = [], isLoading: coursesLoading } = useQuery<Course[]>({
    queryKey: ["courses", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("*").eq("user_id", userId).order("name");
      if (error) throw new Error(error.message);
      return data as Course[];
    },
  });

  // Schedule (voor overzicht)
  const { data: schedule = [], isLoading: scheduleLoading } = useQuery<Schedule[]>({
    queryKey: ["schedule", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule")
        .select("*")
        .eq("user_id", userId)
        .order("is_recurring", { ascending: false })
        .order("day_of_week", { ascending: true, nullsFirst: false })
        .order("date", { ascending: true, nullsFirst: false })
        .order("start_time", { ascending: true });
      if (error) throw new Error(error.message);
      return data as Schedule[];
    },
  });

  // iCal import
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
      queryClient.invalidateQueries({ queryKey: ["schedule", userId] });
      queryClient.invalidateQueries({ queryKey: ["courses", userId] });
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

  // Rooster-item aanmaken
  const createScheduleMutation = useMutation({
    mutationFn: async (payload: Omit<Schedule, "id" | "created_at">) => {
      const { error } = await supabase.from("schedule").insert(payload);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule", userId] });
      setFormData({
        course_id: null, day_of_week: 1, start_time: "", end_time: "",
        kind: "les", title: "", is_recurring: true, date: null
      });
      toast({ title: "Toegevoegd!", description: "Het roosteritem is succesvol toegevoegd." });
    },
    onError: (e:any) => toast({ title: "Fout", description: e.message, variant: "destructive" }),
  });

  // Rooster: afzeggen & verwijderen
  const updateCancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("schedule").update({ status: "cancelled" }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule", userId] });
      toast({ title: "Les afgezegd", description: "De les is gemarkeerd als uitgevallen." });
    },
    onError: (e:any) => toast({ title: "Fout", description: e.message, variant: "destructive" }),
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("schedule").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule", userId] });
      toast({ title: "Verwijderd", description: "Het roosteritem is verwijderd." });
    },
    onError: (e:any) => toast({ title: "Fout", description: e.message, variant: "destructive" }),
  });

  // Vakken CRUD
  const createCourseMutation = useMutation({
    mutationFn: async (payload: { name: string; color: string; user_id: string }) => {
      const { error } = await supabase.from("courses").insert(payload);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses", userId] });
      setCourseFormData({ name: "", color: "#4287f5" });
      setShowCourseForm(false);
      toast({ title: "Vak toegevoegd!", description: "Het vak is succesvol toegevoegd." });
    },
    onError: (e:any) => toast({ title: "Fout", description: e.message, variant: "destructive" }),
  });

  const deleteCourseMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("courses").delete().eq("id", id);
      if (error) throw error as any;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses", userId] });
      toast({ title: "Vak verwijderd", description: "Het vak is verwijderd." });
    },
    onError: (error:any) => {
      const msg =
        error?.code === "23503"
          ? "Dit vak wordt gebruikt in het rooster. Verwijder eerst de gekoppelde lessen of zet FK op ON DELETE SET NULL."
          : `Kon vak niet verwijderen: ${error?.message ?? "Onbekende fout"}`;
      toast({ title: "Kan niet verwijderen", description: msg, variant: "destructive" });
    },
  });

  // Helpers
  const handleThemeChange = (themeId: string) => {
    setSelectedTheme(themeId);
    const theme = colorThemes.find(t => t.id === themeId);
    if (theme) {
      document.documentElement.style.setProperty('--primary', theme.primary);
      toast({ title: "Thema gewijzigd", description: `App kleur veranderd naar ${theme.name}` });
    }
  };

  const handleRosterImport = (file: File) => {
    const fileType = file.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'ics', 'ical'].includes(fileType || '')) {
      toast({ title: "Ongeldig bestand", description: "Upload een .csv of .ics bestand", variant: "destructive" });
      return;
    }
    toast({ title: "Rooster import gestart", description: `${file.name} wordt geïmporteerd...` });
    // TODO: implement bestandsimport
  };

  const exportRoster = () => {
    toast({ title: "Rooster export", description: "Je rooster wordt gedownload als CSV bestand" });
    // TODO: implement export
  };

  const submitSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    if (!formData.start_time || !formData.end_time) {
      toast({ title: "Incomplete gegevens", description: "Vul een start- en eindtijd in.", variant: "destructive" });
      return;
    }
    if (formData.end_time <= formData.start_time) {
      toast({ title: "Tijd klopt niet", description: "Eindtijd moet na begintijd liggen.", variant: "destructive" });
      return;
    }
    if (formData.is_recurring) {
      if (!formData.day_of_week) {
        toast({ title: "Kies een dag", description: "Selecteer een weekdag voor herhalen.", variant: "destructive" });
        return;
      }
    } else {
      if (!formData.date) {
        toast({ title: "Datum vereist", description: "Kies een datum voor eenmalige activiteit.", variant: "destructive" });
        return;
      }
    }
    const payload: Omit<Schedule, "id" | "created_at"> = {
      user_id: userId,
      course_id: formData.course_id || null,
      day_of_week: formData.is_recurring ? formData.day_of_week : null,
      date: formData.is_recurring ? null : (formData.date ?? null),
      start_time: formData.start_time,
      end_time: formData.end_time,
      kind: formData.kind,
      title: formData.title,
      is_recurring: formData.is_recurring,
      status: "active",
    } as any;
    createScheduleMutation.mutate(payload);
  };

  // Rooster-overzicht helpers
  const getCourseById = (courseId: string | null) => courses.find((c) => c.id === courseId);
  const getDayName = (dow: number) => ["", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"][dow] || "";
  const formatTime = (t?: string | null) => (t ? t.slice(0, 5) : "");
  const getKindLabel = (k?: string | null) =>
    ({ les: "Les", toets: "Toets", sport: "Sport", werk: "Werk", afspraak: "Afspraak", hobby: "Hobby", anders: "Anders" }[k || "les"]);
  const getKindColor = (k?: string | null) =>
    ({ les: "bg-blue-100 text-blue-800", toets: "bg-red-100 text-red-800", sport: "bg-green-100 text-green-800", werk: "bg-purple-100 text-purple-800", afspraak: "bg-orange-100 text-orange-800", hobby: "bg-pink-100 text-pink-800", anders: "bg-gray-100 text-gray-800" }[k || "les"]);

  const grouped = useMemo(() => {
    const weekly: Record<number, Schedule[]> = {};
    const single: Record<string, Schedule[]> = {};
    (schedule as Schedule[]).forEach((it) => {
      if (it.is_recurring && it.day_of_week) {
        (weekly[it.day_of_week] ||= []).push(it);
      } else if (!it.is_recurring && it.date) {
        (single[it.date] ||= []).push(it);
      }
    });
    Object.values(weekly).forEach((arr) => arr.sort((a, b) => (a.start_time || "").localeCompare(b.start_time || "")));
    Object.values(single).forEach((arr) => arr.sort((a, b) => (a.start_time || "").localeCompare(b.start_time || "")));
    return { weekly, single };
  }, [schedule]);

  return (
    <div className="p-4 space-y-6" data-testid="instellingen-page">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">Instellingen</h1>
        <p className="text-sm text-muted-foreground">Pas je app aan naar jouw wensen</p>
      </div>

      {/* BOVENAAN: Rooster — Items toevoegen */}
      <Card>
        <CardHeader>
          <CardTitle>Rooster — Items toevoegen</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submitSchedule} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Type activiteit</Label>
                <Select value={formData.kind} onValueChange={(v:any)=>setFormData(p=>({...p, kind:v}))}>
                  <SelectTrigger><SelectValue placeholder="Kies type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="les">Les</SelectItem>
                    <SelectItem value="toets">Toets</SelectItem>
                    <SelectItem value="sport">Sport/Training</SelectItem>
                    <SelectItem value="werk">Bijbaan/Werk</SelectItem>
                    <SelectItem value="afspraak">Afspraak</SelectItem>
                    <SelectItem value="hobby">Hobby/Activiteit</SelectItem>
                    <SelectItem value="anders">Anders</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="title">Titel</Label>
                <Input id="title" value={formData.title} onChange={(e)=>setFormData(p=>({...p, title:e.target.value}))} placeholder="Titel van activiteit" />
              </div>
            </div>

            {(formData.kind === "les" || formData.kind === "toets") && (
              <div>
                <Label>Vak</Label>
                <Select value={formData.course_id ?? "none"} onValueChange={(v)=>setFormData(p=>({...p, course_id: v==="none" ? null : v}))}>
                  <SelectTrigger><SelectValue placeholder="Kies een vak" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Geen vak</SelectItem>
                    {courses.map((c)=>(<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Herhaling</Label>
                <div className="flex items-center space-x-2">
                  <Checkbox checked={formData.is_recurring} onCheckedChange={(ch)=>setFormData(p=>({...p, is_recurring: ch===true}))}/>
                  <span>Elke week herhalen</span>
                </div>
              </div>

              {formData.is_recurring ? (
                <div>
                  <Label>Dag</Label>
                  <Select value={(formData.day_of_week ?? 1).toString()} onValueChange={(v)=>setFormData(p=>({...p, day_of_week: parseInt(v,10)}))}>
                    <SelectTrigger><SelectValue placeholder="Kies dag" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Maandag</SelectItem>
                      <SelectItem value="2">Dinsdag</SelectItem>
                      <SelectItem value="3">Woensdag</SelectItem>
                      <SelectItem value="4">Donderdag</SelectItem>
                      <SelectItem value="5">Vrijdag</SelectItem>
                      <SelectItem value="6">Zaterdag</SelectItem>
                      <SelectItem value="7">Zondag</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div>
                  <Label>Datum</Label>
                  <Input type="date" value={formData.date ?? ""} onChange={(e)=>setFormData(p=>({...p, date:e.target.value}))}/>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Begintijd</Label>
                  <Input type="time" value={formData.start_time} onChange={(e)=>setFormData(p=>({...p, start_time:e.target.value}))}/>
                </div>
                <div>
                  <Label>Eindtijd</Label>
                  <Input type="time" value={formData.end_time} onChange={(e)=>setFormData(p=>({...p, end_time:e.target.value}))}/>
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={createScheduleMutation.isPending || !userId}>
              {createScheduleMutation.isPending ? (<><Loader2 className="w-4 h-4 animate-spin mr-2" />Toevoegen…</>) : "Roosteritem toevoegen"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Rooster — Vakken beheren */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Rooster — Vakken beheren</CardTitle>
            <Button variant="outline" size="sm" onClick={()=>setShowCourseForm(!showCourseForm)}>
              <Plus className="w-4 h-4 mr-2" />Vak toevoegen
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {coursesLoading ? (
            <div className="text-muted-foreground">Laden…</div>
          ) : courses.length ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
              {courses.map((c)=>(
                <div key={c.id} className="bg-muted rounded-lg p-3 text-sm flex items-center gap-2" style={{ borderLeft: `4px solid ${c.color}` }}>
                  <Circle className="w-3 h-3" style={{ color: c.color }} />
                  <div className="flex-1 font-medium">{c.name}</div>
                  <Button
                    variant="ghost" size="icon" title="Verwijderen"
                    onClick={()=>{ if (confirm(`Vak "${c.name}" verwijderen?`)) deleteCourseMutation.mutate(c.id); }}
                    disabled={deleteCourseMutation.isPending}
                    className="text-destructive"
                  >
                    {deleteCourseMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <Alert><HelpCircle className="h-4 w-4" /><AlertDescription>Geen vakken toegevoegd. Voeg vakken toe om lessen in te plannen.</AlertDescription></Alert>
          )}

          {showCourseForm && (
            <form
              onSubmit={(e)=>{e.preventDefault();
                if (!courseFormData.name.trim()) {
                  toast({ title: "Vak naam vereist", description: "Vul een vaknaam in.", variant: "destructive" });
                  return;
                }
                createCourseMutation.mutate({ ...courseFormData, user_id: userId });
              }}
              className="space-y-3 p-4 bg-muted/50 rounded-lg mt-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <Label>Vaknaam</Label>
                  <Input value={courseFormData.name} onChange={(e)=>setCourseFormData({...courseFormData, name: e.target.value})} placeholder="bv. Wiskunde" />
                </div>
                <div>
                  <Label>Kleur</Label>
                  <Input type="color" value={courseFormData.color} onChange={(e)=>setCourseFormData({...courseFormData, color: e.target.value})} className="p-1 h-10" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={createCourseMutation.isPending}>
                  {createCourseMutation.isPending ? "Bezig…" : "Vak opslaan"}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={()=>setShowCourseForm(false)}>Annuleren</Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* 🔹 Rooster — Overzicht (zoals ingevoerd) */}
      <Card>
        <CardHeader>
          <CardTitle>Rooster — Overzicht</CardTitle>
        </CardHeader>
        <CardContent>
          {scheduleLoading ? (
            <div className="text-center py-6"><Loader2 className="w-6 h-6 animate-spin inline-block" /></div>
          ) : (
            <div className="space-y-8">
              {/* Wekelijks */}
              <div>
                <h4 className="font-semibold mb-2">Wekelijks</h4>
                {Object.keys(grouped.weekly).length ? (
                  <div className="space-y-4">
                    {Object.entries(grouped.weekly)
                      .sort(([a],[b]) => parseInt(a) - parseInt(b))
                      .map(([dayOfWeek, items]) => (
                        <div key={dayOfWeek}>
                          <h5 className="font-medium text-sm text-muted-foreground mb-2">{getDayName(parseInt(dayOfWeek))}</h5>
                          <div className="space-y-2">
                            {items.map((item) => {
                              const course = getCourseById(item.course_id);
                              const isCancelled = item.status === "cancelled";
                              return (
                                <div key={item.id} className={`bg-card border rounded-lg p-4 flex items-center justify-between ${isCancelled ? "opacity-50" : ""}`}>
                                  <div>
                                    <div className="flex items-center gap-2 mb-1">
                                      <h6 className={`font-medium ${isCancelled ? "line-through" : ""}`}>{item.title || course?.name || "Activiteit"}</h6>
                                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${getKindColor(item.kind)}`}>{getKindLabel(item.kind)}</span>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                      {item.start_time && item.end_time ? `${formatTime(item.start_time)} - ${formatTime(item.end_time)}` : ""}
                                    </p>
                                  </div>
                                  <div className="flex items-center">
                                    {!isCancelled && (item.kind === "les" || item.kind === "toets") && (
                                      <Button variant="ghost" size="icon" onClick={() => updateCancelMutation.mutate(item.id)} disabled={updateCancelMutation.isPending} className="text-orange-600 hover:bg-orange-100" title="Les afzeggen">
                                        <CalendarX className="w-4 h-4" />
                                      </Button>
                                    )}
                                    <Button variant="ghost" size="icon" onClick={() => deleteScheduleMutation.mutate(item.id)} disabled={deleteScheduleMutation.isPending} className="text-destructive hover:bg-destructive/10" title="Verwijderen">
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">Geen wekelijkse items.</div>
                )}
              </div>

              {/* Eenmalig */}
              <div>
                <h4 className="font-semibold mb-2">Eenmalig</h4>
                {Object.keys(grouped.single).length ? (
                  <div className="space-y-4">
                    {Object.entries(grouped.single)
                      .sort(([a],[b]) => a.localeCompare(b))
                      .map(([dateStr, items]) => (
                        <div key={dateStr}>
                          <h5 className="font-medium text-sm text-muted-foreground mb-2">
                            {new Date(dateStr).toLocaleDateString("nl-NL", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
                          </h5>
                          <div className="space-y-2">
                            {items.map((item) => {
                              const course = getCourseById(item.course_id);
                              const isCancelled = item.status === "cancelled";
                              return (
                                <div key={item.id} className={`bg-card border rounded-lg p-4 flex items-center justify-between ${isCancelled ? "opacity-50" : ""}`}>
                                  <div>
                                    <div className="flex items-center gap-2 mb-1">
                                      <h6 className={`font-medium ${isCancelled ? "line-through" : ""}`}>{item.title || course?.name || "Activiteit"}</h6>
                                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${getKindColor(item.kind)}`}>{getKindLabel(item.kind)}</span>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                      {item.start_time && item.end_time ? `${formatTime(item.start_time)} - ${formatTime(item.end_time)}` : ""}
                                    </p>
                                  </div>
                                  <div className="flex items-center">
                                    {!isCancelled && (item.kind === "les" || item.kind === "toets") && (
                                      <Button variant="ghost" size="icon" onClick={() => updateCancelMutation.mutate(item.id)} disabled={updateCancelMutation.isPending} className="text-orange-600 hover:bg-orange-100" title="Les afzeggen">
                                        <CalendarX className="w-4 h-4" />
                                      </Button>
                                    )}
                                    <Button variant="ghost" size="icon" onClick={() => deleteScheduleMutation.mutate(item.id)} disabled={deleteScheduleMutation.isPending} className="text-destructive hover:bg-destructive/10" title="Verwijderen">
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">Geen eenmalige items.</div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Overige instellingen hieronder */}
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
                className={`p-3 rounded-lg border-2 transition-all ${selectedTheme === theme.id ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}
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

      <Card data-testid="education-settings">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5" />
            Onderwijsniveau
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Onderwijstype</Label>
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
            <Label>Jaargang</Label>
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
            <p className="text-sm text-blue-800">💡 Deze instelling helpt bij het maken van gepaste taken en uitleg</p>
          </div>
        </CardContent>
      </Card>

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
              <Label>Dagelijkse herinneringen</Label>
              <p className="text-sm text-muted-foreground">Ontvang elke dag een herinnering om je huiswerk te checken</p>
            </div>
            <Switch
              checked={notificationsEnabled}
              onCheckedChange={setNotificationsEnabled}
              data-testid="switch-notifications"
            />
          </div>

          {notificationsEnabled && (
            <div className="space-y-2">
              <Label>Herinnering tijd</Label>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <Input
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

      <Card data-testid="roster-settings">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Rooster Beheer — Import/Export
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div>
              <Label htmlFor="roster-import">Rooster importeren (bestand)</Label>
              <p className="text-sm text-muted-foreground mb-2">Upload een .csv of .ics bestand van je schoolrooster</p>
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
              <Label>Rooster exporteren (CSV)</Label>
              <p className="text-sm text-muted-foreground mb-2">Download je huidige rooster als CSV</p>
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

      <Card data-testid="calendar-integration">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Rooster Import via iCal URL
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
                <strong>📚 SomToday:</strong> Rooster → Exporteren → Kopieer de iCal URL en plak hieronder.
              </AlertDescription>
            </Alert>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (icalUrl.trim()) {
                  importIcalMutation.mutate(icalUrl.trim());
                }
              }}
              className="space-y-3"
            >
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
                  Plak hier de iCal link van je schoolrooster (SomToday, Zermelo, etc.)
                </p>
              </div>

              <div className="flex space-x-2">
                <Button type="submit" size="sm" disabled={importIcalMutation.isPending || !icalUrl.trim()} data-testid="button-import-ical">
                  {importIcalMutation.isPending ? "Importeren..." : "Rooster importeren"}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setShowIcalForm(false)} data-testid="button-cancel-ical">
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
            <span className="text-sm">{displayName}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Email:</span>
            <span className="text-sm">{user?.email}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Rol:</span>
            <Badge variant="secondary">{(user?.user_metadata?.role as string) || "student"}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Opslaan */}
      <div className="flex justify-center pt-4">
        <Button
          className="w-full max-w-xs"
          onClick={() => {
            toast({ title: "Instellingen opgeslagen", description: "Je voorkeuren zijn succesvol opgeslagen" });
          }}
          data-testid="button-save-settings"
        >
          Instellingen Opslaan
        </Button>
      </div>
    </div>
  );
}
