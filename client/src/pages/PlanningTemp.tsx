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
import { supabase } from "@/lib/supabase";
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

  // === MUTATIONS ===
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

  // helpers
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

      {/* Form voor nieuwe activiteit */}
      <Card className="mb-6">
        <CardHeader><CardTitle>Nieuwe activiteit</CardTitle></CardHeader>
        <CardContent>
          {/* ...form fields... */}
        </CardContent>
      </Card>

      {/* Vakken beheren */}
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
          {/* ...vakkenlijst en form... */}
        </CardContent>
      </Card>

      {/* Huidig rooster */}
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
                            <Button variant="ghost" size="icon" onClick={() => cancelLessonMutation.mutate(item.id)} disabled={cancelLessonMutation.isPending} className="text-orange-600 hover:bg-orange-100" title="Les afzeggen">
                              <CalendarX className="w-4 h-4"/>
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(item.id)} disabled={deleteMutation.isPending} className="text-destructive hover:bg-destructive/10" title="Verwijderen">
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
