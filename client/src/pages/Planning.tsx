import * as React from "react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/lib/auth";
import type { Task, Course, Schedule } from "@shared/schema";

export default function Planning() {
  const { user } = useAuth();
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);

  // Calculate week dates
  const getWeekDates = (offset: number) => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + 1 + (offset * 7)); // Start from Monday
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    return { startOfWeek, endOfWeek };
  };

  const { startOfWeek, endOfWeek } = getWeekDates(currentWeekOffset);

  // Get tasks for the week (stable cache key using date strings)
  const weekKey = `${startOfWeek.toISOString().split('T')[0]}-${endOfWeek.toISOString().split('T')[0]}`;
  const { data: tasks = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ['/api/tasks', user?.id, 'week', weekKey],
    queryFn: async () => {
      const response = await fetch(`/api/tasks/${user?.id}/week/${startOfWeek.toISOString()}/${endOfWeek.toISOString()}`);
      return response.json();
    },
    enabled: !!user?.id,
  });

  // Get courses
  const { data: courses = [] } = useQuery<Course[]>({
    queryKey: ['/api/courses', user?.id],
    enabled: !!user?.id,
  });

  // Get schedule
  const { data: schedule = [] } = useQuery<Schedule[]>({
    queryKey: ['/api/schedule', user?.id],
    enabled: !!user?.id,
  });

  const formatWeekRange = (start: Date, end: Date) => {
    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' };
    return `${start.toLocaleDateString('nl-NL', options)} - ${end.toLocaleDateString('nl-NL', options)} ${end.getFullYear()}`;
  };

  const getDayName = (date: Date) => {
    const days = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
    return days[date.getDay()];
  };

  const getWeekDays = () => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      
      // Get tasks for this day
      const dayTasks = tasks.filter(task => {
        if (!task.dueAt) return false;
        const taskDate = new Date(task.dueAt);
        return taskDate.toDateString() === date.toDateString();
      });

      // Get schedule items for this day
      const daySchedule = schedule.filter(item => {
        if (item.date) {
          const itemDate = new Date(item.date);
          return itemDate.toDateString() === date.toDateString();
        }
        return item.dayOfWeek === (date.getDay() === 0 ? 7 : date.getDay());
      });

      days.push({
        date,
        name: getDayName(date),
        formattedDate: date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }),
        tasks: dayTasks,
        schedule: daySchedule,
      });
    }
    return days;
  };

  const getCourseById = (courseId: string | null) => {
    if (!courseId) return undefined;
    return courses.find(c => c.id === courseId);
  };

  const formatTime = (timeString: string) => {
    return timeString.slice(0, 5); // "HH:MM"
  };

  const getCompletionPercentage = () => {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(task => task.status === 'done').length;
    return totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  };

  const weekDays = getWeekDays();

  return (
    <div className="p-6" data-testid="page-planning">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Planning</h2>
        <div className="text-sm text-muted-foreground" data-testid="week-progress">
          Week {Math.ceil((startOfWeek.getTime() - new Date(startOfWeek.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000))} • {getCompletionPercentage()}% voltooid
        </div>
      </div>

      {/* Week Navigation */}
      <div className="flex items-center justify-between mb-6" data-testid="week-navigation">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCurrentWeekOffset(currentWeekOffset - 1)}
          data-testid="button-previous-week"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        
        <h3 className="text-lg font-medium" data-testid="text-current-week">
          {formatWeekRange(startOfWeek, endOfWeek)}
        </h3>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCurrentWeekOffset(currentWeekOffset + 1)}
          data-testid="button-next-week"
        >
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      {/* Weekly Schedule */}
      {tasksLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="border border-border rounded-lg overflow-hidden animate-pulse" data-testid={`day-skeleton-${i}`}>
              <div className="bg-muted/50 h-12" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-muted rounded w-1/2" />
                <div className="h-3 bg-muted rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {weekDays.map((day, index) => (
            <div key={index} className="border border-border rounded-lg overflow-hidden" data-testid={`day-card-${index}`}>
              <div className="bg-muted/50 px-4 py-2 border-b border-border">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium capitalize" data-testid={`day-name-${index}`}>
                    {day.name} {day.formattedDate}
                  </h4>
                  <span className="text-sm text-muted-foreground" data-testid={`task-count-${index}`}>
                    {day.tasks.length} taken
                  </span>
                </div>
              </div>
              
              <div className="p-4 space-y-3">
                {/* Schedule Items */}
                {day.schedule.map((item, scheduleIndex) => {
                  const course = getCourseById(item.courseId);
                  
                  const getKindLabel = (kind: string) => {
                    switch (kind) {
                      case "les": return "Les";
                      case "toets": return "TOETS";
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
                      case "les": return "bg-blue-500";
                      case "toets": return "bg-red-500";
                      case "sport": return "bg-green-500";
                      case "werk": return "bg-purple-500";
                      case "afspraak": return "bg-orange-500";
                      case "hobby": return "bg-pink-500";
                      case "anders": return "bg-gray-500";
                      default: return "bg-muted-foreground";
                    }
                  };
                  
                  return (
                    <div key={scheduleIndex} className="flex items-center space-x-3 text-sm" data-testid={`schedule-item-${index}-${scheduleIndex}`}>
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getKindColor(item.kind || 'les')}`} />
                      <span className="text-muted-foreground w-16">
                        {item.startTime && formatTime(item.startTime)}
                      </span>
                      <span>
                        {item.title || course?.name || 'Activiteit'} - {getKindLabel(item.kind || 'les')}
                      </span>
                      {course && item.title && (
                        <span className="text-xs text-muted-foreground">
                          ({course.name})
                        </span>
                      )}
                    </div>
                  );
                })}
                
                {/* Tasks */}
                {day.tasks.length > 0 && (
                  <div className="pt-2 border-t border-border space-y-2">
                    {day.tasks.map((task) => {
                      const course = getCourseById(task.courseId);
                      
                      return (
                        <div key={task.id} className="flex items-center space-x-3" data-testid={`task-item-${task.id}`}>
                          <Checkbox
                            checked={task.status === 'done'}
                            className="w-4 h-4"
                            data-testid={`checkbox-task-${task.id}`}
                          />
                          <span className={`flex-1 text-sm ${task.status === 'done' ? 'line-through opacity-60' : ''}`}>
                            {task.title}
                          </span>
                          {task.estMinutes && (
                            <span className="text-xs text-muted-foreground">
                              {task.estMinutes}m
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                
                {/* Empty State */}
                {day.schedule.length === 0 && day.tasks.length === 0 && (
                  <p className="text-sm text-muted-foreground italic" data-testid={`empty-day-${index}`}>
                    Geen activiteiten gepland
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
