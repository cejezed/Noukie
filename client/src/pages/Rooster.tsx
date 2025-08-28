import * as React from "react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, Plus, X, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import CalendarIntegration from "@/components/CalendarIntegration";
import type { Schedule, Course } from "@shared/schema";

interface ScheduleFormData {
  courseId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  kind: "les" | "toets" | "sport" | "werk" | "afspraak" | "hobby" | "anders";
  title: string;
  date?: string;
  isRecurring: boolean;
}

export default function Rooster() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState<ScheduleFormData>({
    courseId: "none",
    dayOfWeek: 1,
    startTime: "",
    endTime: "",
    kind: "les",
    title: "",
    isRecurring: false,
  });

  const [courseFormData, setCourseFormData] = useState({
    name: "",
    level: "havo5",
  });

  const [showCourseForm, setShowCourseForm] = useState(false);
  const [icalUrl, setIcalUrl] = useState("");
  const [showIcalForm, setShowIcalForm] = useState(false);

  // Get user's schedule
  const { data: schedule = [], isLoading: scheduleLoading } = useQuery<Schedule[]>({
    queryKey: ['/api/schedule', user?.id],
    enabled: !!user?.id,
  });

  // Get user's courses
  const { data: courses = [], isLoading: coursesLoading } = useQuery<Course[]>({
    queryKey: ['/api/courses', user?.id],
    enabled: !!user?.id,
  });

  // Create schedule item mutation
  const createMutation = useMutation({
    mutationFn: async (data: ScheduleFormData) => {
      const response = await apiRequest("POST", "/api/schedule", {
        userId: user?.id,
        courseId: data.courseId === "none" ? null : data.courseId || null,
        dayOfWeek: data.dayOfWeek,
        startTime: data.startTime,
        endTime: data.endTime,
        kind: data.kind,
        title: data.title || null,
        date: data.date || null,
        isRecurring: data.isRecurring,
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/schedule'] });
      setFormData({
        courseId: "none",
        dayOfWeek: 1,
        startTime: "",
        endTime: "",
        kind: "les",
        title: "",
        isRecurring: false,
      });
      toast({
        title: "Toegevoegd!",
        description: "Het roosteritem is succesvol toegevoegd.",
      });
    },
    onError: (error) => {
      console.error("Create schedule error:", error);
      toast({
        title: "Fout",
        description: "Kon roosteritem niet toevoegen.",
        variant: "destructive",
      });
    }
  });

  // Create course mutation
  const createCourseMutation = useMutation({
    mutationFn: async (data: { name: string; level: string }) => {
      const response = await apiRequest("POST", "/api/courses", {
        userId: user?.id,
        name: data.name,
        level: data.level,
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/courses'] });
      setCourseFormData({ name: "", level: "havo5" });
      setShowCourseForm(false);
      toast({
        title: "Vak toegevoegd!",
        description: "Het vak is succesvol toegevoegd.",
      });
    },
    onError: (error) => {
      console.error("Create course error:", error);
      toast({
        title: "Fout",
        description: "Kon vak niet toevoegen.",
        variant: "destructive",
      });
    }
  });

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

  // Delete course mutation
  const deleteCourseMutation = useMutation({
    mutationFn: async (courseId: string) => {
      const response = await apiRequest("DELETE", `/api/courses/${courseId}`);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/courses'] });
      toast({
        title: "Vak verwijderd!",
        description: "Het vak is succesvol verwijderd.",
      });
    },
    onError: (error) => {
      console.error("Delete course error:", error);
      toast({
        title: "Fout",
        description: "Kon vak niet verwijderen.",
        variant: "destructive",
      });
    }
  });

  // Delete schedule item mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/schedule/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/schedule'] });
      toast({
        title: "Verwijderd",
        description: "Het roosteritem is verwijderd.",
      });
    },
    onError: (error) => {
      console.error("Delete schedule error:", error);
      toast({
        title: "Fout",
        description: "Kon roosteritem niet verwijderen.",
        variant: "destructive",
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.startTime || !formData.endTime || !formData.title.trim()) {
      toast({
        title: "Incomplete gegevens",
        description: "Vul alle verplichte velden in (titel, start- en eindtijd).",
        variant: "destructive",
      });
      return;
    }
    
    createMutation.mutate(formData);
  };

  const handleCourseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!courseFormData.name.trim()) {
      toast({
        title: "Vak naam vereist",
        description: "Vul een vaknaam in.",
        variant: "destructive",
      });
      return;
    }
    
    createCourseMutation.mutate(courseFormData);
  };

  const handleDelete = (id: string) => {
    if (confirm("Weet je zeker dat je dit roosteritem wilt verwijderen?")) {
      deleteMutation.mutate(id);
    }
  };

  const getCourseById = (courseId: string | null) => {
    if (!courseId) return undefined;
    return courses.find(c => c.id === courseId);
  };

  const getDayName = (dayOfWeek: number) => {
    const days = ["", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"];
    return days[dayOfWeek] || "";
  };

  const formatTime = (timeString: string) => {
    return timeString.slice(0, 5); // "HH:MM"
  };

  const getKindLabel = (kind: string) => {
    switch (kind) {
      case "les": return "Les";
      case "toets": return "Toets";
      case "sport": return "Sport/Training";
      case "werk": return "Bijbaan/Werk";
      case "afspraak": return "Afspraak";
      case "hobby": return "Hobby/Activiteit";
      case "anders": return "Anders";
      default: return kind;
    }
  };

  const getKindColor = (kind: string) => {
    switch (kind) {
      case "les": return "bg-blue-100 text-blue-800";
      case "toets": return "bg-red-100 text-red-800";
      case "sport": return "bg-green-100 text-green-800";
      case "werk": return "bg-purple-100 text-purple-800";
      case "afspraak": return "bg-orange-100 text-orange-800";
      case "hobby": return "bg-pink-100 text-pink-800";
      case "anders": return "bg-gray-100 text-gray-800";
      default: return "bg-muted text-muted-foreground";
    }
  };

  // Group schedule by day for better display
  const groupedSchedule = schedule.reduce((acc, item) => {
    const key = item.dayOfWeek || 0;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<number, Schedule[]>);

  return (
    <div className="p-6" data-testid="page-rooster">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Activiteit toevoegen</h2>
      </div>

      {/* Schedule Form */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Nieuwe activiteit</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" data-testid="schedule-form">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="kind">Type activiteit</Label>
                <Select 
                  value={formData.kind} 
                  onValueChange={(value: "les" | "toets" | "sport" | "werk" | "afspraak" | "hobby" | "anders") => 
                    setFormData(prev => ({ ...prev, kind: value }))
                  }
                >
                  <SelectTrigger data-testid="select-kind">
                    <SelectValue />
                  </SelectTrigger>
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
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder={formData.kind === 'sport' ? 'bijv. Hockeytraining AHC' : formData.kind === 'werk' ? 'bijv. Albert Heijn' : 'Titel van activiteit'}
                  data-testid="input-title"
                />
              </div>
            </div>

            {/* Only show course selection for lessons and tests */}
            {(formData.kind === 'les' || formData.kind === 'toets') && (
              <div>
                <Label htmlFor="course">Vak</Label>
                <Select 
                  value={formData.courseId} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, courseId: value }))}
                >
                  <SelectTrigger data-testid="select-course">
                    <SelectValue placeholder="Kies een vak" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Geen vak</SelectItem>
                    {courses.map((course) => (
                      <SelectItem key={course.id} value={course.id}>
                        {course.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="day">Dag</Label>
                <Select 
                  value={formData.dayOfWeek.toString()} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, dayOfWeek: parseInt(value) }))}
                >
                  <SelectTrigger data-testid="select-day">
                    <SelectValue />
                  </SelectTrigger>
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
                <Input
                  id="startTime"
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                  data-testid="input-start-time"
                />
              </div>
              
              <div>
                <Label htmlFor="endTime">Eindtijd</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                  data-testid="input-end-time"
                />
              </div>
            </div>

            {/* Recurring checkbox (only for non-lesson activities) */}
            {formData.kind !== 'les' && formData.kind !== 'toets' && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="recurring"
                  checked={formData.isRecurring}
                  onCheckedChange={(checked) => 
                    setFormData(prev => ({ ...prev, isRecurring: checked === true }))
                  }
                  data-testid="checkbox-recurring"
                />
                <Label htmlFor="recurring">Elke week herhalen</Label>
              </div>
            )}

            <Button 
              type="submit" 
              disabled={createMutation.isPending}
              className="w-full"
              data-testid="button-create-schedule"
            >
              {createMutation.isPending ? "Toevoegen..." : "Activiteit toevoegen"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Add Courses Section */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Vakken beheren</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCourseForm(!showCourseForm)}
              data-testid="button-toggle-course-form"
            >
              <Plus className="w-4 h-4 mr-2" />
              Vak toevoegen
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Current Courses */}
          {coursesLoading ? (
            <div className="text-sm text-muted-foreground">Laden...</div>
          ) : courses.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
              {courses.map((course) => (
                <div
                  key={course.id}
                  className="bg-muted rounded-lg p-3 text-sm relative group"
                  data-testid={`course-${course.id}`}
                >
                  <div className="font-medium">{course.name}</div>
                  <div className="text-xs text-muted-foreground">{course.level}</div>
                  <button
                    onClick={() => {
                      if (confirm(`Weet je zeker dat je het vak "${course.name}" wilt verwijderen?`)) {
                        deleteCourseMutation.mutate(course.id);
                      }
                    }}
                    disabled={deleteCourseMutation.isPending}
                    className="absolute top-1 right-1 text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                    data-testid={`button-delete-course-${course.id}`}
                    title="Vak verwijderen"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground mb-4">
              Geen vakken toegevoegd. Voeg eerst vakken toe voordat je lessen kunt inplannen.
            </div>
          )}

          {/* Add Course Form */}
          {showCourseForm && (
            <form onSubmit={handleCourseSubmit} className="space-y-3 p-4 bg-muted/50 rounded-lg" data-testid="course-form">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="courseName">Vaknaam</Label>
                  <Input
                    id="courseName"
                    value={courseFormData.name}
                    onChange={(e) => setCourseFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Bijv. Wiskunde, Nederlands"
                    data-testid="input-course-name"
                  />
                </div>
                <div>
                  <Label htmlFor="courseLevel">Niveau</Label>
                  <Select
                    value={courseFormData.level}
                    onValueChange={(value) => setCourseFormData(prev => ({ ...prev, level: value }))}
                  >
                    <SelectTrigger data-testid="select-course-level">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="havo4">Havo 4</SelectItem>
                      <SelectItem value="havo5">Havo 5</SelectItem>
                      <SelectItem value="vwo5">VWO 5</SelectItem>
                      <SelectItem value="vwo6">VWO 6</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex space-x-2">
                <Button
                  type="submit"
                  size="sm"
                  disabled={createCourseMutation.isPending}
                  data-testid="button-add-course"
                >
                  {createCourseMutation.isPending ? "Bezig..." : "Vak toevoegen"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCourseForm(false)}
                  data-testid="button-cancel-course"
                >
                  Annuleren
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>


      {/* Current Schedule */}
      <div>
        <h3 className="font-medium mb-4">Huidig rooster</h3>
        
        {scheduleLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-lg p-4 animate-pulse" data-testid={`schedule-skeleton-${i}`}>
                <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                <div className="h-3 bg-muted rounded w-1/2 mb-1" />
                <div className="h-3 bg-muted rounded w-1/4" />
              </div>
            ))}
          </div>
        ) : Object.keys(groupedSchedule).length > 0 ? (
          <div className="space-y-4">
            {Object.entries(groupedSchedule)
              .sort(([a], [b]) => parseInt(a) - parseInt(b))
              .map(([dayOfWeek, items]) => (
                <div key={dayOfWeek}>
                  <h4 className="font-medium text-sm text-muted-foreground mb-2" data-testid={`day-header-${dayOfWeek}`}>
                    {getDayName(parseInt(dayOfWeek))}
                  </h4>
                  <div className="space-y-2">
                    {items.map((item) => {
                      const course = getCourseById(item.courseId);
                      
                      return (
                        <div
                          key={item.id}
                          className="bg-card border border-border rounded-lg p-4 flex items-center justify-between"
                          data-testid={`schedule-item-${item.id}`}
                        >
                          <div>
                            <div className="flex items-center space-x-2 mb-1">
                              <h5 className="font-medium">
                                {item.title || course?.name || "Activiteit"}
                              </h5>
                              <span className={`text-xs px-2 py-0.5 rounded font-medium ${getKindColor(item.kind || 'les')}`}>
                                {getKindLabel(item.kind || 'les')}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {item.startTime && item.endTime && 
                                `${formatTime(item.startTime)} - ${formatTime(item.endTime)}`
                              }
                            </p>
                            {course && (
                              <p className="text-sm text-muted-foreground">
                                Vak: {course.name}
                              </p>
                            )}
                          </div>
                          
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(item.id)}
                            className="text-destructive hover:bg-destructive/10"
                            disabled={deleteMutation.isPending}
                            data-testid={`button-delete-${item.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground" data-testid="empty-schedule">
            <p>Nog geen roosteritems toegevoegd</p>
            <p className="text-sm mt-1">Voeg je eerste les of toets toe met het formulier hierboven.</p>
          </div>
        )}
      </div>

      {/* Settings Section */}
      <div className="mt-8 pt-6 border-t border-border">
        <h3 className="font-medium mb-4 text-muted-foreground">Instellingen</h3>
        
        {/* Google Calendar Integration */}
        <div className="mb-6">
          <CalendarIntegration />
        </div>
        
        {/* iCal Import Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Rooster importeren</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowIcalForm(!showIcalForm)}
                data-testid="button-toggle-ical-form"
              >
                <Calendar className="w-4 h-4 mr-2" />
                iCal URL
              </Button>
            </div>
          </CardHeader>
          
          {showIcalForm && (
            <CardContent>
              <form onSubmit={(e) => {
                e.preventDefault();
                if (icalUrl.trim()) {
                  importIcalMutation.mutate(icalUrl);
                }
              }} className="space-y-4">
                <div>
                  <Label htmlFor="ical-url">iCal/ICS URL</Label>
                  <Input
                    id="ical-url"
                    type="url"
                    value={icalUrl}
                    onChange={(e) => setIcalUrl(e.target.value)}
                    placeholder="https://example.com/calendar.ics"
                    data-testid="input-ical-url"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Plak hier de iCal URL van je school/studierooster
                  </p>
                </div>
                
                <div className="flex space-x-2">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={importIcalMutation.isPending || !icalUrl.trim()}
                    data-testid="button-import-ical"
                  >
                    {importIcalMutation.isPending ? "Importeren..." : "Importeren"}
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
      </div>
    </div>
  );
}
