import * as React from "react";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, Plus, X, HelpCircle, CalendarX, Loader2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import type { Schedule, Course } from "@shared/schema";

interface ScheduleFormData {
  course_id: string | null; // "none" → null vóór insert
  day_of_week: number | null; // 1..7 voor herhalend
  start_time: string; // "HH:mm"
  end_time: string;   // "HH:mm"
  kind: "les" | "toets" | "sport" | "werk" | "afspraak" | "hobby" | "anders";
  title: string;
  date?: string | null;       // YYYY-MM-DD voor eenmalig
  is_recurring: boolean;      // true = gebruik day_of_week; false = gebruik date
}

export default function Rooster() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const userId = user?.id ?? "";

  const [formData, setFormData] = useState<ScheduleFormData>({
    course_id: null,
    day_of_week: 1,
    start_time: "",
    end_time: "",
    kind: "les",
    title: "",
    is_recurring: true,
    date: null,
  });

  const [courseFormData, setCourseFormData] = useState({ name: "", color: "#4287f5" });
  const [showCourseForm, setShowCourseForm] = useState(false);

  // === QUERIES ===
  const { data: schedule = [], isLoading: scheduleLoading } = useQuery<Schedule[]>({
    queryKey: ["schedule", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule")
        .select("*")
        .eq("user_id", userId)
        // Sorteer logisch: herhalend per week eerst op weekdag + tijd, daarna losse datums
        .order("is_recurring", { ascending: false })
        .order("day_of_week", { ascending: true, nullsFirst: false })
        .order("date", { ascending: true, nullsFirst: false })
        .order("start_time", { ascending: true });
      if (error) throw new Error(error.message);
      return data as Schedule[];
    },
    enabled: !!userId,
  });

  const { data: courses = [], isLoading: coursesLoading } = useQuery<Course[]>({
    queryKey: ["courses", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("*").eq("user_id", userId).order("name");
      if (error) throw new Error(error.message);
      return data as Course[];
    },
    enabled: !!userId,
  });

  // === MUTATIONS ===
  const createScheduleMutation = useMutation({
    mutationFn: async (payload: Omit<Schedule, "id" | "created_at">) => {
      const { error } = await supabase.from("schedule").insert(payload);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule", userId] });
      setFormData({ course_id: null, day_of_week: 1, start_time: "", end_time: "", kind: "les", title: "", is_recurring: true, date: null });
      toast({ title: "Toegevoegd!", description: "Het roosteritem is succesvol toegevoegd." });
    },
    onError: (error: any) => {
      toast({ title: "Fout", description: `Kon roosteritem niet toevoegen: ${error.message}`, variant: "destructive" });
    },
  });

  const updateCancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("schedule").update({ status: "cancelled" }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule", userId] });
      toast({ title: "Les afgezegd", description: "De les is gemarkeerd als uitgevallen." });
    },
    onError: (error: any) => {
      toast({ title: "Fout", description: `Kon les niet afzeggen: ${error.message}`, variant: "destructive" });
    },
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
    onError: (error: any) => {
      toast({ title: "Fout", description: `Kon roosteritem niet verwijderen: ${error.message}`, variant: "destructive" });
    },
  });

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
    onError: (error: any) => {
      toast({ title: "Fout", description: `Kon vak niet toevoegen: ${error.message}`, variant: "destructive" });
    },
  });

  // ✅ FIX: apart mutation voor courses verwijderen i.p.v. schedule.delete()
  const deleteCourseMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("courses").delete().eq("id", id);
      if (error) throw error; // kan FK 23503 opleveren als course in gebruik is
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses", userId] });
      toast({ title: "Vak verwijderd", description: "Het vak is verwijderd." });
    },
    onError: (error: any) => {
      // 23503 = foreign key violation
      const msg = (error as any)?.code === "23503"
        ? "Dit vak wordt gebruikt in het rooster. Verwijder eerst die lessen."
        : `Kon vak niet verwijderen: ${error.message}`;
      toast({ title: "Kan niet verwijderen", description: msg, variant: "destructive" });
    },
  });

  // === HANDLERS ===
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.start_time || !formData.end_time) {
      toast({ title: "Incomplete gegevens", description: "Vul een start- en eindtijd in.", variant: "destructive" });
      return;
    }
    // simpele tijd-validatie HH:mm
    if (formData.end_time <= formData.start_time) {
      toast({ title: "Tijd klopt niet", description: "Eindtijd moet na begintijd liggen.", variant: "destructive" });
      return;
    }

    // Validatie herhalend vs eenmalig
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

  const handleCourseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseFormData.name.trim()) {
      toast({ title: "Vak naam vereist", description: "Vul een vaknaam in.", variant: "destructive" });
      return;
    }
    createCourseMutation.mutate({ ...courseFormData, user_id: userId });
  };

  // === HELPERS ===
  const getCourseById = (courseId: string | null) => courses.find((c) => c.id === courseId);
  const getDayName = (dow: number) => ["", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"][dow] || "";
  const formatTime = (t: string) => t?.slice(0, 5);
  const getKindLabel = (k: string) => ({ les: "Les", toets: "Toets", sport: "Sport", werk: "Werk", afspraak: "Afspraak", hobby: "Hobby", anders: "Anders" }[k] || k);
  const getKindColor = (k: string) => ({ les: "bg-blue-100 text-blue-800", toets: "bg-red-100 text-red-800", sport: "bg-green-100 text-green-800", werk: "bg-purple-100 text-purple-800", afspraak: "bg-orange-100 text-orange-800", hobby: "bg-pink-100 text-pink-800", anders: "bg-gray-100 text-gray-800" }[k] || "bg-muted");

  // ✅ Groepering: herhalend per week (day_of_week) en eenmalig (date)
  const grouped = useMemo(() => {
    const weekly: Record<number, Schedule[]> = {};
    const single: Record<string, Schedule[]> = {};

    for (const it of schedule) {
      if (it.is_recurring && it.day_of_week) {
        weekly[it.day_of_week] ||= [];
        weekly[it.day_of_week].push(it);
      } else if (!it.is_recurring && it.date) {
        single[it.date] ||= [];
        single[it.date].push(it);
      }
    }

    // sorteer elke groep op start_time
    Object.values(weekly).forEach((arr) => arr.sort((a, b) => (a.start_time || "").localeCompare(b.start_time || "")));
    Object.values(single).forEach((arr) => arr.sort((a, b) => (a.start_time || "").localeCompare(b.start_time || "")));

    return { weekly, single };
  }, [schedule]);

  // === RENDER ===
  return (
    <div className="p-6" data-testid="page-rooster">
      <h2 className="text-xl font-semibold mb-6">Activiteit toevoegen</h2>

      {/* FORM NIEUWE ACTIVITEIT */}
      <Card className="mb-6">
        <CardHeader><CardTitle>Nieuwe activiteit</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="kind">Type activiteit</Label>
                <Select value={formData.kind} onValueChange={(value: any) => setFormData((p) => ({ ...p, kind: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
                <Input id="title" value={formData.title} onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))} placeholder="Titel van activiteit" />
              </div>
            </div>

            {(formData.kind === "les" || formData.kind === "toets") && (
              <div>
                <Label htmlFor="course">Vak</Label>
                <Select value={formData.course_id ?? "none"} onValueChange={(value) => setFormData((p) => ({ ...p, course_id: value === "none" ? null : value }))}>
                  <SelectTrigger><SelectValue placeholder="Kies een vak" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Geen vak</SelectItem>
                    {courses.map((course) => (
                      <SelectItem key={course.id} value={course.id}>{course.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="repeat">Herhaling</Label>
                <div className="flex items-center space-x-2">
                  <Checkbox id="repeat" checked={formData.is_recurring} onCheckedChange={(checked) => setFormData((p) => ({ ...p, is_recurring: checked === true }))} />
                  <span>Elke week herhalen</span>
                </div>
              </div>
              {formData.is_recurring ? (
                <div>
                  <Label htmlFor="day">Dag</Label>
                  <Select value={(formData.day_of_week ?? 1).toString()} onValueChange={(v) => setFormData((p) => ({ ...p, day_of_week: parseInt(v, 10) }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
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
                  <Label htmlFor="date">Datum</Label>
                  <Input id="date" type="date" value={formData.date ?? ""} onChange={(e) => setFormData((p) => ({ ...p, date: e.target.value }))} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startTime">Begintijd</Label>
                  <Input id="startTime" type="time" value={formData.start_time} onChange={(e) => setFormData((p) => ({ ...p, start_time: e.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="endTime">Eindtijd</Label>
                  <Input id="endTime" type="time" value={formData.end_time} onChange={(e) => setFormData((p) => ({ ...p, end_time: e.target.value }))} />
                </div>
              </div>
            </div>

            <Button type="submit" disabled={createScheduleMutation.isPending} className="w-full">
              {createScheduleMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {createScheduleMutation.isPending ? "Toevoegen..." : "Activiteit toevoegen"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* VAKKEN BEHEREN */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Vakken beheren</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setShowCourseForm(!showCourseForm)}>
              <Plus className="w-4 h-4 mr-2" />Vak toevoegen
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {coursesLoading ? (
            <div className="text-muted-foreground">Laden...</div>
          ) : courses.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
              {courses.map((course) => (
                <div key={course.id} className="bg-muted rounded-lg p-3 text-sm relative group flex items-center gap-2" style={{ borderLeft: `4px solid ${course.color}` }}>
                  <Circle className="w-3 h-3" style={{ color: course.color }} />
                  <div className="flex-grow">
                    <div className="font-medium">{course.name}</div>
                  </div>
                  <button onClick={() => deleteCourseMutation.mutate(course.id)} className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity" title="Vak verwijderen">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <Alert>
              <HelpCircle className="h-4 w-4" />
              <AlertDescription>Geen vakken toegevoegd. Voeg vakken toe om lessen in te plannen.</AlertDescription>
            </Alert>
          )}

          {showCourseForm && (
            <form onSubmit={handleCourseSubmit} className="space-y-3 p-4 bg-muted/50 rounded-lg mt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <Label htmlFor="courseName">Vaknaam</Label>
                  <Input id="courseName" value={courseFormData.name} onChange={(e) => setCourseFormData({ ...courseFormData, name: e.target.value })} placeholder="bv. Wiskunde" />
                </div>
                <div>
                  <Label htmlFor="courseColor">Kleur</Label>
                  <Input id="courseColor" type="color" value={courseFormData.color} onChange={(e) => setCourseFormData({ ...courseFormData, color: e.target.value })} className="p-1 h-10" />
                </div>
              </div>
              <div className="flex space-x-2">
                <Button type="submit" size="sm" disabled={createCourseMutation.isPending}>
                  {createCourseMutation.isPending ? "Bezig..." : "Vak Opslaan"}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setShowCourseForm(false)}>Annuleren</Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* HUIDIG ROOSTER */}
      <div>
        <h3 className="font-medium mb-4">Huidig rooster</h3>
        {scheduleLoading ? (
          <div className="text-center"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <div className="space-y-8">
            {/* Wekelijks */}
            <div>
              <h4 className="font-semibold mb-2">Wekelijks</h4>
              {Object.keys(grouped.weekly).length ? (
                <div className="space-y-4">
                  {Object.entries(grouped.weekly)
                    .sort(([a], [b]) => parseInt(a) - parseInt(b))
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
                                  <div className="flex items-center space-x-2 mb-1">
                                    <h6 className={`font-medium ${isCancelled ? "line-through" : ""}`}>{item.title || course?.name || "Activiteit"}</h6>
                                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${getKindColor(item.kind || "les")}`}>{getKindLabel(item.kind || "les")}</span>
                                  </div>
                                  <p className="text-sm text-muted-foreground">{item.start_time && item.end_time && `${formatTime(item.start_time)} - ${formatTime(item.end_time)}`}</p>
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
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([dateStr, items]) => (
                      <div key={dateStr}>
                        <h5 className="font-medium text-sm text-muted-foreground mb-2">{new Date(dateStr).toLocaleDateString("nl-NL", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</h5>
                        <div className="space-y-2">
                          {items.map((item) => {
                            const course = getCourseById(item.course_id);
                            const isCancelled = item.status === "cancelled";
                            return (
                              <div key={item.id} className={`bg-card border rounded-lg p-4 flex items-center justify-between ${isCancelled ? "opacity-50" : ""}`}>
                                <div>
                                  <div className="flex items-center space-x-2 mb-1">
                                    <h6 className={`font-medium ${isCancelled ? "line-through" : ""}`}>{item.title || course?.name || "Activiteit"}</h6>
                                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${getKindColor(item.kind || "les")}`}>{getKindLabel(item.kind || "les")}</span>
                                  </div>
                                  <p className="text-sm text-muted-foreground">{item.start_time && item.end_time && `${formatTime(item.start_time)} - ${formatTime(item.end_time)}`}</p>
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
      </div>
    </div>
  );
}
