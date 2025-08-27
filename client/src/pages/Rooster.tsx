import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Schedule, Course } from "@shared/schema";

interface ScheduleFormData {
  courseId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  kind: "les" | "toets";
  title: string;
  date?: string;
}

export default function Rooster() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState<ScheduleFormData>({
    courseId: "",
    dayOfWeek: 1,
    startTime: "",
    endTime: "",
    kind: "les",
    title: "",
  });

  const [courseFormData, setCourseFormData] = useState({
    name: "",
    level: "havo5",
  });

  const [showCourseForm, setShowCourseForm] = useState(false);

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
        courseId: data.courseId || null,
        dayOfWeek: data.dayOfWeek,
        startTime: data.startTime,
        endTime: data.endTime,
        kind: data.kind,
        title: data.title || null,
        date: data.date || null,
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/schedule'] });
      setFormData({
        courseId: "",
        dayOfWeek: 1,
        startTime: "",
        endTime: "",
        kind: "les",
        title: "",
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
    
    if (!formData.startTime || !formData.endTime) {
      toast({
        title: "Incomplete gegevens",
        description: "Vul alle verplichte velden in.",
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
        <h2 className="text-xl font-semibold">Rooster</h2>
      </div>

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
                  className="bg-muted rounded-lg p-3 text-sm"
                  data-testid={`course-${course.id}`}
                >
                  <div className="font-medium">{course.name}</div>
                  <div className="text-xs text-muted-foreground">{course.level}</div>
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

      {/* Add Schedule Form */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Nieuwe les/toets toevoegen</CardTitle>
          {courses.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Voeg eerst vakken toe om lessen te kunnen inplannen.
            </p>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" data-testid="schedule-form">
            {courses.length === 0 && (
              <div className="text-center py-4 text-muted-foreground bg-muted/50 rounded-lg">
                <p>Geen vakken beschikbaar</p>
                <p className="text-xs mt-1">Voeg eerst vakken toe hierboven.</p>
              </div>
            )}
            <div>
              <Label htmlFor="course">Vak</Label>
              <Select
                value={formData.courseId}
                onValueChange={(value) => setFormData(prev => ({ ...prev, courseId: value }))}
              >
                <SelectTrigger data-testid="select-course">
                  <SelectValue placeholder="Selecteer een vak" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="dayOfWeek">Dag</Label>
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
                <Label htmlFor="kind">Type</Label>
                <Select
                  value={formData.kind}
                  onValueChange={(value: "les" | "toets") => setFormData(prev => ({ ...prev, kind: value }))}
                >
                  <SelectTrigger data-testid="select-kind">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="les">Les</SelectItem>
                    <SelectItem value="toets">Toets</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startTime">Start tijd</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                  data-testid="input-start-time"
                />
              </div>
              
              <div>
                <Label htmlFor="endTime">Eind tijd</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                  data-testid="input-end-time"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="title">Titel (optioneel)</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Bijv. Hoofdstuk 3 - Goniometrie"
                data-testid="input-title"
              />
            </div>
            
            <Button
              type="submit"
              className="w-full"
              disabled={createMutation.isPending || courses.length === 0}
              data-testid="button-add-schedule"
            >
              {createMutation.isPending ? "Bezig..." : "Toevoegen aan rooster"}
            </Button>
          </form>
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
                      const isTest = item.kind === 'toets';
                      
                      return (
                        <div
                          key={item.id}
                          className="bg-card border border-border rounded-lg p-4 flex items-center justify-between"
                          data-testid={`schedule-item-${item.id}`}
                        >
                          <div>
                            <div className="flex items-center space-x-2 mb-1">
                              <h5 className="font-medium">
                                {course?.name || "Onbekend vak"}
                              </h5>
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                isTest 
                                  ? 'bg-accent/20 text-accent' 
                                  : 'bg-muted text-muted-foreground'
                              }`}>
                                {isTest ? 'Toets' : 'Les'}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {item.startTime && item.endTime && 
                                `${formatTime(item.startTime)} - ${formatTime(item.endTime)}`
                              }
                            </p>
                            {item.title && (
                              <p className="text-sm text-muted-foreground">
                                {item.title}
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
    </div>
  );
}
