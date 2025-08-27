import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import VoiceRecorder from "@/components/VoiceRecorder";
import TaskCard from "@/components/TaskCard";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";
import { useAudio } from "@/hooks/use-audio";
import type { Task, Course, Session, Schedule } from "@shared/schema";

export default function Vandaag() {
  const { user } = useAuth();
  const { playAudio } = useAudio();

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

  // Check if reminder should be shown
  const shouldShowReminder = () => {
    if (!lastSession) return false;
    const today = new Date();
    const sessionDate = new Date(lastSession.happenedAt);
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
      playAudio("/api/tts/dummy.mp3");
    }
  };

  return (
    <div data-testid="page-vandaag">
      {/* Reminder Banner */}
      {shouldShowReminder() && (
        <div className="bg-accent text-accent-foreground p-4 m-4 rounded-lg flex items-center space-x-3" data-testid="reminder-banner">
          <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span className="text-sm font-medium">Je check-in voor vandaag ontbreekt</span>
        </div>
      )}

      {/* Voice Check-in */}
      <VoiceRecorder />

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
                    {formatRelativeTime(lastSession.happenedAt)}
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
        <h3 className="text-lg font-semibold mb-4">Vandaag</h3>
        
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

      {/* Today's Lessons */}
      <section className="px-6 pb-6" data-testid="today-lessons">
        <h3 className="text-lg font-semibold mb-4">Lessen Vandaag</h3>
        
        {todaySchedule.length > 0 ? (
          <div className="space-y-3">
            {todaySchedule.map((item) => {
              const course = getCourseById(item.courseId);
              const isTest = item.kind === "toets";
              
              return (
                <div
                  key={item.id}
                  className={`border rounded-lg p-4 ${
                    isTest ? 'bg-accent/10 border-accent/30' : 'bg-muted/50 border-border'
                  }`}
                  data-testid={`lesson-${item.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <h4 className="font-medium">{course?.name || "Onbekend vak"}</h4>
                        {isTest && (
                          <span className="text-xs font-medium text-accent bg-accent/20 px-2 py-0.5 rounded">
                            TOETS
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {item.title || `${isTest ? 'Toets' : 'Les'} ${course?.name || ''}`}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <div className="font-medium">
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
          <div className="text-center py-8 text-muted-foreground" data-testid="no-lessons">
            <p>Geen lessen vandaag</p>
            <p className="text-sm mt-1">Voeg lessen toe via het Rooster tabblad.</p>
          </div>
        )}
      </section>
    </div>
  );
}
