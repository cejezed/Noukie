import * as React from "react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import TextCheckin from "@/components/TextCheckin";
import TaskCard from "@/components/TaskCard";
import AppIntroModal from "@/components/AppIntroModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Play, Plus, UserCheck, X, Info } from "lucide-react";
import { useAudio } from "@/hooks/use-audio";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Task, Course, Session, Schedule } from "@shared/schema";

export default function Vandaag() {
  const { user } = useAuth();
  const { playAudio } = useAudio();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Task form state
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showIntroModal, setShowIntroModal] = useState(false);
  const [hasSeenIntro, setHasSeenIntro] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: "",
    courseId: "",
    estMinutes: 30,
    priority: 1,
    dueAt: new Date().toISOString().split('T')[0] // Today's date
  });

  // Check if this is the first time visiting the app
  React.useEffect(() => {
    const hasSeenIntroKey = `hasSeenIntro_${user?.id}`;
    const hasSeenBefore = localStorage.getItem(hasSeenIntroKey);
    
    if (!hasSeenBefore && user?.id) {
      // First time visit - show intro automatically
      setShowIntroModal(true);
      setHasSeenIntro(false);
    } else {
      setHasSeenIntro(true);
    }
  }, [user?.id]);

  // Handle intro modal close
  const handleIntroModalClose = (open: boolean) => {
    setShowIntroModal(open);
    if (!open && user?.id) {
      // Mark as seen when modal is closed
      const hasSeenIntroKey = `hasSeenIntro_${user?.id}`;
      localStorage.setItem(hasSeenIntroKey, 'true');
      setHasSeenIntro(true);
    }
  };

  // Get today's tasks
  const { data: tasks = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ['/api/tasks', user?.id, 'today'],
    enabled: !!user?.id,
  });

  // Get user's courses
  const { data: courses = [] } = useQuery<Course[]>({
    queryKey: ['/api/courses', user?.id],
    enabled: !!user?.id,
  });

  // Get last session
  const { data: lastSession } = useQuery<Session>({
    queryKey: ['/api/sessions', user?.id, 'last'],
    enabled: !!user?.id,
  });

  // Get today's schedule
  const { data: todaySchedule = [] } = useQuery<Schedule[]>({
    queryKey: ['/api/schedule', user?.id, 'today'],
    enabled: !!user?.id,
  });

  // Get pending parent requests (for students only)
  const { data: parentRequests = [] } = useQuery({
    queryKey: ['/api/student', user?.id, 'parent-requests'],
    enabled: !!user?.id && user?.user_metadata?.role === 'student',
  });

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async () => {
      if (!taskForm.title.trim()) {
        throw new Error("Taak titel is verplicht");
      }
      
      const response = await apiRequest("POST", "/api/tasks", {
        userId: user?.id,
        courseId: taskForm.courseId || null,
        title: taskForm.title,
        dueAt: new Date(taskForm.dueAt).toISOString(),
        estMinutes: taskForm.estMinutes,
        priority: taskForm.priority,
        source: "manual",
        status: "todo"
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      setTaskForm({
        title: "",
        courseId: "",
        estMinutes: 30,
        priority: 1,
        dueAt: new Date().toISOString().split('T')[0]
      });
      setShowTaskForm(false);
      toast({
        title: "Taak toegevoegd!",
        description: "Je nieuwe taak is succesvol toegevoegd."
      });
    },
    onError: (error) => {
      console.error("Create task error:", error);
      toast({
        title: "Fout bij toevoegen",
        description: "Kon taak niet toevoegen. Probeer opnieuw.",
        variant: "destructive"
      });
    }
  });

  // Confirm parent relationship mutation
  const confirmParentMutation = useMutation({
    mutationFn: async (relationshipId: string) => {
      return await apiRequest('POST', '/api/parent/confirm', { relationshipId });
    },
    onSuccess: () => {
      toast({
        title: "Ouder bevestigd",
        description: "Je ouder kan nu je voortgang bekijken.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/student'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Kon ouder niet bevestigen",
        description: error.message || "Probeer het later opnieuw.",
        variant: "destructive",
      });
    }
  });

  // Check if reminder should be shown
  const shouldShowReminder = () => {
    if (!lastSession) return false;
    const today = new Date();
    const sessionDate = new Date(lastSession.happenedAt || new Date());
    const reminderHour = parseInt(import.meta.env.VITE_APP_REMINDER_HOUR || "16", 10);
    
    return (
      sessionDate.toDateString() !== today.toDateString() &&
      today.getHours() >= reminderHour
    );
  };

  const getCourseById = (courseId: string | null) => {
    if (!courseId) return undefined;
    return courses.find(c => c.id === courseId);
  };

  const formatTime = (timeString: string) => {
    return timeString.slice(0, 5); // "HH:MM"
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffHours < 1) return "Zojuist";
    if (diffHours === 1) return "1 uur geleden";
    return `${diffHours} uur geleden`;
  };

  const playLastCoachAudio = () => {
    if (lastSession?.coachText) {
      // In production, this would play the actual TTS audio
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
      playAudio(`${apiBaseUrl}/api/tts/dummy.mp3`);
    }
  };

  return (
    <div data-testid="page-vandaag">
      {/* Parent Request Notifications (for students only) */}
      {user?.user_metadata?.role === 'student' && Array.isArray(parentRequests) && parentRequests.length > 0 && (
        <div className="p-4 space-y-2">
          {parentRequests.map((request: any) => (
            <Alert key={request.id} className="border-blue-200 bg-blue-50">
              <UserCheck className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <div>
                  <strong>{request.parentName}</strong> wil je ouder worden.
                  <br />
                  <span className="text-sm text-muted-foreground">{request.parentEmail}</span>
                </div>
                <div className="flex gap-2 ml-4">
                  <Button
                    size="sm"
                    onClick={() => confirmParentMutation.mutate(request.id)}
                    disabled={confirmParentMutation.isPending}
                    data-testid={`button-confirm-parent-${request.id}`}
                  >
                    Bevestigen
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      toast({
                        title: "Binnenkort beschikbaar",
                        description: "Afwijzen functionaliteit wordt nog ontwikkeld."
                      });
                    }}
                    data-testid={`button-reject-parent-${request.id}`}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}
    
      {/* Reminder Banner */}
      {shouldShowReminder() && (
        <div className="bg-accent text-accent-foreground p-4 m-4 rounded-lg flex items-center space-x-3" data-testid="reminder-banner">
          <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span className="text-sm font-medium">Je check-in voor vandaag ontbreekt</span>
        </div>
      )}

      {/* Text Check-in */}
      <TextCheckin />

      {/* Last Coach Audio */}
      {lastSession && (
        <section className="px-6 pb-4" data-testid="last-coach-message">
          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="font-medium text-sm text-muted-foreground mb-3">Laatste Coach Bericht</h3>
            <div className="flex items-center space-x-3">
              <Button
                size="icon"
                className="w-10 h-10 bg-primary text-primary-foreground rounded-full"
                onClick={playLastCoachAudio}
                data-testid="button-play-last-audio"
              >
                <Play className="w-5 h-5" />
              </Button>
              <div className="flex-1">
                <p className="text-sm" data-testid="text-last-coach-message">
                  {lastSession.coachText || lastSession.summary || "Geen bericht beschikbaar"}
                </p>
                <div className="flex items-center space-x-2 mt-1">
                  <div className="text-xs text-muted-foreground" data-testid="text-last-message-time">
                    {lastSession.happenedAt ? formatRelativeTime(lastSession.happenedAt.toString()) : 'Onbekend'}
                  </div>
                  <div className="w-1 h-1 bg-muted-foreground rounded-full" />
                  <div className="text-xs text-muted-foreground">0:24</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Today's Tasks */}
      <section className="px-6 pb-4" data-testid="today-tasks">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold">Vandaag</h3>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-primary relative"
              onClick={() => setShowIntroModal(true)}
              data-testid="button-app-intro"
            >
              <Info className="w-4 h-4" />
              {!hasSeenIntro && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full border-2 border-white animate-pulse" />
              )}
            </Button>
          </div>
          <Button 
            size="sm" 
            className="h-8 w-8 p-0" 
            onClick={() => setShowTaskForm(!showTaskForm)}
            data-testid="button-add-task"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        
        {/* Inline Task Form */}
        {showTaskForm && (
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-lg">Nieuwe taak toevoegen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="task-title">Taak titel</Label>
                <Input
                  id="task-title"
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({...taskForm, title: e.target.value})}
                  placeholder="Bijv. Wiskunde hoofdstuk 3 lezen"
                  data-testid="input-task-title"
                />
              </div>
              
              <div>
                <Label htmlFor="task-course">Vak</Label>
                <select 
                  id="task-course"
                  value={taskForm.courseId} 
                  onChange={(e) => setTaskForm({...taskForm, courseId: e.target.value})}
                  className="w-full p-2 border rounded"
                  data-testid="select-task-course"
                >
                  <option value="">Geen vak</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="task-time">Geschatte tijd (min)</Label>
                  <Input
                    id="task-time"
                    type="number"
                    value={taskForm.estMinutes}
                    onChange={(e) => setTaskForm({...taskForm, estMinutes: parseInt(e.target.value) || 30})}
                    min="5"
                    max="240"
                    data-testid="input-task-time"
                  />
                </div>
                
                <div>
                  <Label htmlFor="task-priority">Prioriteit</Label>
                  <select 
                    value={taskForm.priority.toString()} 
                    onChange={(e) => setTaskForm({...taskForm, priority: parseInt(e.target.value)})}
                    className="w-full p-2 border rounded"
                    data-testid="select-task-priority"
                  >
                    <option value="0">Laag</option>
                    <option value="1">Normaal</option>
                    <option value="2">Hoog</option>
                  </select>
                </div>
              </div>

              <div>
                <Label htmlFor="task-due">Deadline</Label>
                <Input
                  id="task-due"
                  type="date"
                  value={taskForm.dueAt}
                  onChange={(e) => setTaskForm({...taskForm, dueAt: e.target.value})}
                  data-testid="input-task-due"
                />
              </div>

              <div className="flex space-x-2 pt-4">
                <Button
                  onClick={() => createTaskMutation.mutate()}
                  disabled={createTaskMutation.isPending || !taskForm.title.trim()}
                  className="flex-1"
                  data-testid="button-save-task"
                >
                  {createTaskMutation.isPending ? "Bezig..." : "Toevoegen"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowTaskForm(false)}
                  data-testid="button-cancel-task"
                >
                  Annuleren
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        
        {tasksLoading ? (
          <div className="space-y-3">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-lg p-4 animate-pulse" data-testid={`task-skeleton-${i}`}>
                <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                <div className="h-5 bg-muted rounded w-2/3 mb-1" />
                <div className="h-3 bg-muted rounded w-1/4" />
              </div>
            ))}
          </div>
        ) : tasks.length > 0 ? (
          <div className="space-y-3">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                course={getCourseById(task.courseId)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground" data-testid="no-tasks">
            <p>Geen taken voor vandaag!</p>
            <p className="text-sm mt-1">Doe een check-in om taken toe te voegen.</p>
          </div>
        )}
      </section>

      {/* Today's Schedule */}
      <section className="px-6 pb-6" data-testid="today-schedule">
        <h3 className="text-lg font-semibold mb-4">Vandaag op de planning</h3>
        
        {todaySchedule.length > 0 ? (
          <div className="space-y-3">
            {todaySchedule.map((item) => {
              const course = getCourseById(item.courseId);
              
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
                  case "les": return "bg-blue-100 text-blue-800 border-blue-200";
                  case "toets": return "bg-red-100 text-red-800 border-red-200";
                  case "sport": return "bg-green-100 text-green-800 border-green-200";
                  case "werk": return "bg-purple-100 text-purple-800 border-purple-200";
                  case "afspraak": return "bg-orange-100 text-orange-800 border-orange-200";
                  case "hobby": return "bg-pink-100 text-pink-800 border-pink-200";
                  case "anders": return "bg-gray-100 text-gray-800 border-gray-200";
                  default: return "bg-muted text-muted-foreground border-border";
                }
              };
              
              return (
                <div
                  key={item.id}
                  className={`border rounded-lg p-4 ${getKindColor(item.kind || 'les')}`}
                  data-testid={`schedule-item-${item.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <h4 className="font-medium">
                          {item.title || course?.name || "Activiteit"}
                        </h4>
                        <span className="text-xs font-medium px-2 py-0.5 rounded bg-white/50">
                          {getKindLabel(item.kind || 'les')}
                        </span>
                      </div>
                      {course && (
                        <p className="text-sm opacity-75">
                          Vak: {course.name}
                        </p>
                      )}
                    </div>
                    <div className="text-right text-sm">
                      <div className="font-medium opacity-90">
                        {item.startTime && item.endTime && 
                          `${formatTime(item.startTime)} - ${formatTime(item.endTime)}`
                        }
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground" data-testid="no-schedule">
            <p>Geen activiteiten vandaag</p>
            <p className="text-sm mt-1">Voeg activiteiten toe via het Rooster tabblad.</p>
          </div>
        )}
      </section>

      {/* App Introduction Modal */}
      <AppIntroModal
        open={showIntroModal}
        onOpenChange={handleIntroModalClose}
      />
    </div>
  );
}
