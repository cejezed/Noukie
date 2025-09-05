import * as React from "react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, Plus, X, HelpCircle, CalendarX, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase"; // Importeer Supabase
import { useToast } from "@/components/ui/use-toast";
import type { Schedule, Course } from "@shared/schema";

interface ScheduleFormData {
  course_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  kind: "les" | "toets" | "sport" | "werk" | "afspraak" | "hobby" | "anders";
  title: string;
  date?: string;
  is_recurring: boolean;
}

export default function Rooster() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const userId = user?.id ?? "";

  const [formData, setFormData] = useState<ScheduleFormData>({
    course_id: "none",
    day_of_week: 1,
    start_time: "",
    end_time: "",
    kind: "les",
    title: "",
    is_recurring: false,
  });

  const [courseFormData, setCourseFormData] = useState({ name: "", color: "#4287f5" });
  const [showCourseForm, setShowCourseForm] = useState(false);

  // === QUERIES (direct naar Supabase) ===
  const { data: schedule = [], isLoading: scheduleLoading } = useQuery<Schedule[]>({
    queryKey: ['schedule', userId],
    queryFn: async () => {
      const { data, error } = await supabase.from('schedule').select('*').eq('user_id', userId);
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!userId,
  });

  const { data: courses = [], isLoading: coursesLoading } = useQuery<Course[]>({
    queryKey: ['courses', userId],
    queryFn: async () => {
      const { data, error } = await supabase.from('courses').select('*').eq('user_id', userId);
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!userId,
  });

  // === MUTATIONS (direct naar Supabase) ===
  const createMutation = useMutation({
    mutationFn: async (data: Omit<Schedule, 'id' | 'created_at' | 'user_id' | 'status'> & { user_id: string }) => {
      const { error } = await supabase.from('schedule').insert(data);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule', userId] });
      setFormData({ course_id: "none", day_of_week: 1, start_time: "", end_time: "", kind: "les", title: "", is_recurring: false });
      toast({ title: "Toegevoegd!", description: "Het roosteritem is succesvol toegevoegd." });
    },
    onError: (error) => {
      toast({ title: "Fout", description: `Kon roosteritem niet toevoegen: ${error.message}`, variant: "destructive" });
    }
  });

  const createCourseMutation = useMutation({
    mutationFn: async (data: { name: string; color: string; user_id: string }) => {
      const { error } = await supabase.from('courses').insert(data);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses', userId] });
      setCourseFormData({ name: "", color: "#4287f5" });
      setShowCourseForm(false);
      toast({ title: "Vak toegevoegd!", description: "Het vak is succesvol toegevoegd." });
    },
    onError: (error) => {
      toast({ title: "Fout", description: `Kon vak niet toevoegen: ${error.message}`, variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('schedule').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule', userId] });
      toast({ title: "Verwijderd", description: "Het roosteritem is verwijderd." });
    },
    onError: (error) => {
      toast({ title: "Fout", description: `Kon roosteritem niet verwijderen: ${error.message}`, variant: "destructive" });
    }
  });

  const cancelLessonMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('schedule').update({ status: 'cancelled' }).eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule', userId] });
      toast({ title: "Les afgezegd", description: "De les is gemarkeerd als uitgevallen." });
    },
    onError: (error) => {
      toast({ title: "Fout", description: `Kon les niet afzeggen: ${error.message}`, variant: "destructive" });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.start_time || !formData.end_time) {
      toast({ title: "Incomplete gegevens", description: "Vul een start- en eindtijd in.", variant: "destructive" });
      return;
    }
    createMutation.mutate({ ...formData, user_id: userId, course_id: formData.course_id === "none" ? null : formData.course_id });
  };

  const handleCourseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseFormData.name.trim()) {
      toast({ title: "Vak naam vereist", description: "Vul een vaknaam in.", variant: "destructive" });
      return;
    }
    createCourseMutation.mutate({ ...courseFormData, user_id: userId });
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const handleCancelLesson = (id: string) => {
    cancelLessonMutation.mutate(id);
  };

  // ... (rest van de UI helper functies zoals getCourseById, getDayName, etc. blijven hetzelfde)
  const getCourseById = (courseId: string | null) => courses.find(c => c.id === courseId);
  const getDayName = (dayOfWeek: number) => ["", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"][dayOfWeek] || "";
  const formatTime = (timeString: string) => timeString.slice(0, 5);
  const getKindLabel = (kind: string) => ({ les: "Les", toets: "Toets", sport: "Sport", werk: "Werk", afspraak: "Afspraak", hobby: "Hobby", anders: "Anders" }[kind] || kind);
  const getKindColor = (kind: string) => ({ les: "bg-blue-100 text-blue-800", toets: "bg-red-100 text-red-800", sport: "bg-green-100 text-green-800", werk: "bg-purple-100 text-purple-800", afspraak: "bg-orange-100 text-orange-800", hobby: "bg-pink-100 text-pink-800", anders: "bg-gray-100 text-gray-800" }[kind] || "bg-muted");

  const groupedSchedule = schedule.reduce((acc, item) => {
    const key = item.day_of_week || 0;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<number, Schedule[]>);

  return (
    <div className="p-6" data-testid="page-rooster">
      <h2 className="text-xl font-semibold mb-6">Activiteit toevoegen</h2>

      {/* Schedule Form */}
      <Card className="mb-6">
        <CardHeader><CardTitle>Nieuwe activiteit</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Formulier velden blijven grotendeels hetzelfde... */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="kind">Type activiteit</Label>
                <Select value={formData.kind} onValueChange={(value: any) => setFormData(prev => ({ ...prev, kind: value }))}>
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
                <Input id="title" value={formData.title} onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))} placeholder="Titel van activiteit" />
              </div>
            </div>

            {(formData.kind === 'les' || formData.kind === 'toets') && (
              <div>
                <Label htmlFor="course">Vak</Label>
                <Select value={formData.course_id} onValueChange={(value) => setFormData(prev => ({ ...prev, course_id: value }))}>
                  <SelectTrigger><SelectValue placeholder="Kies een vak" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Geen vak</SelectItem>
                    {courses.map((course) => <SelectItem key={course.id} value={course.id}>{course.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="day">Dag</Label>
                <Select value={formData.day_of_week.toString()} onValueChange={(value) => setFormData(prev => ({ ...prev, day_of_week: parseInt(value) }))}>
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
              <div>
                <Label htmlFor="startTime">Begintijd</Label>
                <Input id="startTime" type="time" value={formData.start_time} onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="endTime">Eindtijd</Label>
                <Input id="endTime" type="time" value={formData.end_time} onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))} />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox id="recurring" checked={formData.is_recurring} onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_recurring: checked === true }))}/>
              <Label htmlFor="recurring">Elke week herhalen</Label>
            </div>

            <Button type="submit" disabled={createMutation.isPending} className="w-full">
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {createMutation.isPending ? "Toevoegen..." : "Activiteit toevoegen"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Cursus Beheer */}
      <Card className="mb-6">
          <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Vakken beheren</CardTitle>
                <Button variant="outline" size="sm" onClick={() => setShowCourseForm(!showCourseForm)}><Plus className="w-4 h-4 mr-2" />Vak toevoegen</Button>
              </div>
          </CardHeader>
          <CardContent>
              {coursesLoading ? <div className="text-muted-foreground">Laden...</div> : courses.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
                      {courses.map(course => (
                          <div key={course.id} className="bg-muted rounded-lg p-3 text-sm relative group flex items-center gap-2" style={{ borderLeft: `4px solid ${course.color}`}}>
                              <div className="flex-grow">
                                <div className="font-medium">{course.name}</div>
                              </div>
                              <button onClick={() => deleteMutation.mutate(course.id)} className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                                <Trash2 className="w-4 h-4" />
                              </button>
                          </div>
                      ))}
                  </div>
              ) : (
                <Alert><HelpCircle className="h-4 w-4" /><AlertDescription>Geen vakken toegevoegd. Voeg vakken toe om lessen in te plannen.</AlertDescription></Alert>
              )}

              {showCourseForm && (
                  <form onSubmit={handleCourseSubmit} className="space-y-3 p-4 bg-muted/50 rounded-lg mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="md:col-span-2">
                          <Label htmlFor="courseName">Vaknaam</Label>
                          <Input id="courseName" value={courseFormData.name} onChange={e => setCourseFormData({...courseFormData, name: e.target.value})} placeholder="bv. Wiskunde"/>
                        </div>
                        <div>
                          <Label htmlFor="courseColor">Kleur</Label>
                          <Input id="courseColor" type="color" value={courseFormData.color} onChange={e => setCourseFormData({...courseFormData, color: e.target.value})} className="p-1 h-10"/>
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

      {/* Huidig Rooster */}
      <div>
        <h3 className="font-medium mb-4">Huidig rooster</h3>
        {scheduleLoading ? <div className="text-center"><Loader2 className="w-6 h-6 animate-spin"/></div> : Object.keys(groupedSchedule).length > 0 ? (
          <div className="space-y-4">
            {Object.entries(groupedSchedule).sort(([a], [b]) => parseInt(a) - parseInt(b)).map(([dayOfWeek, items]) => (
              <div key={dayOfWeek}>
                <h4 className="font-medium text-sm text-muted-foreground mb-2">{getDayName(parseInt(dayOfWeek))}</h4>
                <div className="space-y-2">
                  {items.map(item => {
                    const course = getCourseById(item.course_id);
                    const isCancelled = item.status === "cancelled";
                    return (
                      <div key={item.id} className={`bg-card border rounded-lg p-4 flex items-center justify-between ${isCancelled ? 'opacity-50' : ''}`}>
                        <div>
                          <div className="flex items-center space-x-2 mb-1">
                            <h5 className={`font-medium ${isCancelled ? 'line-through' : ''}`}>{item.title || course?.name || "Activiteit"}</h5>
                            <span className={`text-xs px-2 py-0.5 rounded font-medium ${getKindColor(item.kind || 'les')}`}>{getKindLabel(item.kind || 'les')}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">{item.start_time && item.end_time && `${formatTime(item.start_time)} - ${formatTime(item.end_time)}`}</p>
                        </div>
                        <div className="flex items-center">
                          {!isCancelled && (item.kind === "les" || item.kind === "toets") && (
                            <Button variant="ghost" size="icon" onClick={() => handleCancelLesson(item.id)} disabled={cancelLessonMutation.isPending} className="text-orange-600 hover:bg-orange-100" title="Les afzeggen">
                              <CalendarX className="w-4 h-4"/>
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)} disabled={deleteMutation.isPending} className="text-destructive hover:bg-destructive/10" title="Verwijderen">
                            <Trash2 className="w-4 h-4"/>
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
          <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">Geen roosteritems toegevoegd.</div>
        )}
      </div>
    </div>
  );
}

