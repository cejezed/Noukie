import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
const formatTime = (t) => (t ? t.slice(0, 5) : "");
const sameYMD = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
export default function Planning() {
    const { user } = useAuth();
    const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
    // Weekberekening (ma → zo) in lokale tijd
    const getWeekDates = (offset) => {
        const today = new Date();
        const startOfWeek = new Date(today);
        const js = today.getDay(); // 0=zo..6=za
        const mondayShift = (js === 0 ? -6 : 1 - js) + offset * 7;
        startOfWeek.setHours(0, 0, 0, 0);
        startOfWeek.setDate(today.getDate() + mondayShift);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
        return { startOfWeek, endOfWeek };
    };
    const { startOfWeek, endOfWeek } = getWeekDates(currentWeekOffset);
    const weekKey = `${startOfWeek.toISOString().split("T")[0]}-${endOfWeek.toISOString().split("T")[0]}`;
    // TAKEN - Direct Supabase call
    const { data: tasks = [], isLoading: tasksLoading, error: tasksError, } = useQuery({
        queryKey: ["tasks", user?.id, weekKey],
        enabled: !!user?.id,
        queryFn: async () => {
            console.log('Fetching tasks for week:', { startOfWeek, endOfWeek, userId: user?.id });
            const { data, error } = await supabase
                .from('tasks')
                .select('*')
                .eq('user_id', user.id)
                .gte('due_at', startOfWeek.toISOString())
                .lte('due_at', endOfWeek.toISOString())
                .order('due_at', { ascending: true });
            if (error) {
                console.error('Tasks query error:', error);
                throw error;
            }
            console.log('Tasks fetched:', data?.length || 0);
            // Convert from snake_case to camelCase
            const tasks = (data || []).map((row) => ({
                id: row.id,
                title: row.title,
                status: row.status,
                dueAt: row.due_at,
                courseId: row.course_id,
                estMinutes: row.est_minutes,
            }));
            return tasks;
        },
    });
    // VAKKEN - Direct Supabase call
    const { data: courses = [], isLoading: coursesLoading, error: coursesError, } = useQuery({
        queryKey: ["courses", user?.id],
        enabled: !!user?.id,
        queryFn: async () => {
            console.log('Fetching courses for user:', user?.id);
            const { data, error } = await supabase
                .from('courses')
                .select('*')
                .eq('user_id', user.id)
                .order('name', { ascending: true });
            if (error) {
                console.error('Courses query error:', error);
                throw error;
            }
            console.log('Courses fetched:', data?.length || 0);
            return data || [];
        },
    });
    // ROOSTER - Direct Supabase call
    const { data: schedule = [], isLoading: scheduleLoading, error: scheduleError, } = useQuery({
        queryKey: ["schedule", user?.id, weekKey],
        enabled: !!user?.id,
        queryFn: async () => {
            console.log('Fetching schedule for week:', { startOfWeek, endOfWeek, userId: user?.id });
            // Get both recurring (day_of_week based) and one-time (date based) schedule items
            const { data, error } = await supabase
                .from('schedule')
                .select('*')
                .eq('user_id', user.id)
                .or(`date.is.null,date.gte.${startOfWeek.toISOString().split('T')[0]},date.lte.${endOfWeek.toISOString().split('T')[0]}`);
            if (error) {
                console.error('Schedule query error:', error);
                throw error;
            }
            console.log('Schedule items fetched:', data?.length || 0);
            // Convert from snake_case to camelCase
            const scheduleItems = (data || []).map((row) => ({
                id: row.id,
                date: row.date,
                dayOfWeek: row.day_of_week,
                startTime: row.start_time,
                endTime: row.end_time,
                courseId: row.course_id,
                kind: row.kind || row.type || 'les',
                title: row.title || row.note,
            }));
            return scheduleItems;
        },
    });
    const formatWeekRange = (start, end) => {
        const opts = { day: "numeric", month: "long" };
        return `${start.toLocaleDateString("nl-NL", opts)} - ${end.toLocaleDateString("nl-NL", opts)} ${end.getFullYear()}`;
    };
    const getDayName = (date) => {
        const days = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];
        return days[date.getDay()];
    };
    const getWeekDays = () => {
        const days = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date(startOfWeek);
            date.setDate(startOfWeek.getDate() + i);
            // Tasks op de dag
            const dayTasks = tasks.filter((task) => {
                if (!task.dueAt)
                    return false;
                const taskDate = new Date(task.dueAt);
                return sameYMD(taskDate, date);
            });
            // Rooster op de dag (datum of weekdag)
            const daySchedule = schedule.filter((item) => {
                // Check for specific date match
                if (item.date) {
                    const scheduleDate = new Date(item.date);
                    return sameYMD(scheduleDate, date);
                }
                // Check for recurring day of week match
                if (item.dayOfWeek) {
                    const js = date.getDay(); // 0=Sunday, 1=Monday, etc.
                    const dow = js === 0 ? 7 : js; // Convert to 1=Monday, 7=Sunday
                    return item.dayOfWeek === dow;
                }
                return false;
            });
            days.push({
                date,
                name: getDayName(date),
                formattedDate: date.toLocaleDateString("nl-NL", { day: "numeric", month: "short" }),
                tasks: dayTasks,
                schedule: daySchedule,
            });
        }
        return days;
    };
    const getCourseById = (courseId) => {
        if (!courseId)
            return undefined;
        return courses.find((c) => c.id === courseId);
    };
    const getCompletionPercentage = () => {
        const total = tasks.length;
        const done = tasks.filter((t) => t.status === "done").length;
        return total > 0 ? Math.round((done / total) * 100) : 0;
    };
    const calcWeekNumber = (d) => {
        const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        const dayNum = date.getUTCDay() || 7;
        date.setUTCDate(date.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
        return Math.ceil(((+date - +yearStart) / 86400000 + 1) / 7);
    };
    const weekDays = getWeekDays();
    const isLoading = tasksLoading || scheduleLoading || coursesLoading;
    const hasError = tasksError || scheduleError || coursesError;
    // Debug logging
    console.log('Planning render:', {
        user: user?.id,
        weekKey,
        isLoading,
        hasError,
        tasksCount: tasks.length,
        scheduleCount: schedule.length,
        coursesCount: courses.length,
    });
    return (_jsxs("div", { className: "p-6", "data-testid": "page-planning", children: [_jsxs("div", { className: "flex items-center justify-between mb-6", children: [_jsx("h2", { className: "text-xl font-semibold", children: "Planning" }), _jsxs("div", { className: "text-sm text-muted-foreground", "data-testid": "week-progress", children: ["Week ", calcWeekNumber(startOfWeek), " \u2022 ", getCompletionPercentage(), "% voltooid"] })] }), _jsxs("div", { className: "flex items-center justify-between mb-6", "data-testid": "week-navigation", children: [_jsx(Button, { variant: "ghost", size: "icon", onClick: () => setCurrentWeekOffset((n) => n - 1), "data-testid": "button-previous-week", children: _jsx(ChevronLeft, { className: "w-5 h-5" }) }), _jsx("h3", { className: "text-lg font-medium", "data-testid": "text-current-week", children: formatWeekRange(startOfWeek, endOfWeek) }), _jsx(Button, { variant: "ghost", size: "icon", onClick: () => setCurrentWeekOffset((n) => n + 1), "data-testid": "button-next-week", children: _jsx(ChevronRight, { className: "w-5 h-5" }) })] }), hasError && (_jsxs("div", { className: "mb-4 text-sm text-red-600", children: ["Er ging iets mis bij het ophalen van data: ", String(tasksError || scheduleError || coursesError)] })), process.env.NODE_ENV === 'development' && (_jsxs("div", { className: "mb-4 p-2 bg-gray-100 text-xs", children: ["Debug: ", tasks.length, " taken, ", schedule.length, " rooster items, ", courses.length, " vakken"] })), isLoading ? (_jsx("div", { className: "space-y-4", children: [...Array(3)].map((_, i) => (_jsxs("div", { className: "border border-border rounded-lg overflow-hidden animate-pulse", "data-testid": `day-skeleton-${i}`, children: [_jsx("div", { className: "bg-muted/50 h-12" }), _jsxs("div", { className: "p-4 space-y-2", children: [_jsx("div", { className: "h-4 bg-muted rounded w-1/2" }), _jsx("div", { className: "h-3 bg-muted rounded w-1/3" })] })] }, i))) })) : (_jsx("div", { className: "space-y-4", children: weekDays.map((day, index) => (_jsxs("div", { className: "border border-border rounded-lg overflow-hidden", "data-testid": `day-card-${index}`, children: [_jsx("div", { className: "bg-muted/50 px-4 py-2 border-b border-border", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("h4", { className: "font-medium capitalize", "data-testid": `day-name-${index}`, children: [day.name, " ", day.formattedDate] }), _jsxs("span", { className: "text-sm text-muted-foreground", "data-testid": `task-count-${index}`, children: [day.tasks.length, " taken, ", day.schedule.length, " activiteiten"] })] }) }), _jsxs("div", { className: "p-4 space-y-3", children: [day.schedule.map((item, scheduleIndex) => {
                                    const course = getCourseById(item.courseId ?? undefined);
                                    const kindLabels = {
                                        les: "Les",
                                        toets: "TOETS",
                                        sport: "Sport/Training",
                                        werk: "Bijbaan/Werk",
                                        afspraak: "Afspraak",
                                        hobby: "Hobby/Activiteit",
                                        anders: "Anders",
                                    };
                                    const kindColors = {
                                        les: "bg-blue-500",
                                        toets: "bg-red-500",
                                        sport: "bg-green-500",
                                        werk: "bg-purple-500",
                                        afspraak: "bg-orange-500",
                                        hobby: "bg-pink-500",
                                        anders: "bg-gray-500",
                                    };
                                    const kind = (item.kind ?? "les").toLowerCase();
                                    const kindLabel = kindLabels[kind] || item.kind || "Activiteit";
                                    const dotColor = kindColors[kind] || "bg-muted-foreground";
                                    return (_jsxs("div", { className: "flex items-center space-x-3 text-sm", "data-testid": `schedule-item-${index}-${scheduleIndex}`, children: [_jsx("div", { className: `w-2 h-2 rounded-full flex-shrink-0 ${dotColor}` }), _jsx("span", { className: "text-muted-foreground w-16", children: formatTime(item.startTime) }), _jsxs("span", { children: [item.title || course?.name || "Activiteit", " - ", kindLabel] }), course && item.title && (_jsxs("span", { className: "text-xs text-muted-foreground", children: ["(", course.name, ")"] }))] }, scheduleIndex));
                                }), day.tasks.length > 0 && (_jsx("div", { className: "pt-2 border-t border-border space-y-2", children: day.tasks.map((task) => {
                                        const course = getCourseById(task.courseId ?? undefined);
                                        return (_jsxs("div", { className: "flex items-center space-x-3 group", "data-testid": `task-item-${task.id}`, children: [_jsx(Checkbox, { checked: task.status === "done", className: "w-4 h-4", "data-testid": `checkbox-task-${task.id}`, onCheckedChange: async (checked) => {
                                                        const newStatus = checked ? "done" : "todo";
                                                        try {
                                                            const { error } = await supabase
                                                                .from('tasks')
                                                                .update({ status: newStatus })
                                                                .eq('id', task.id);
                                                            if (error)
                                                                throw error;
                                                            // Refetch data to update UI
                                                            window.location.reload();
                                                        }
                                                        catch (error) {
                                                            console.error('Error updating task:', error);
                                                        }
                                                    } }), _jsx("span", { className: `flex-1 text-sm ${task.status === "done" ? "line-through opacity-60" : ""}`, children: task.title }), task.estMinutes ? (_jsxs("span", { className: "text-xs text-muted-foreground", children: [task.estMinutes, "m"] })) : null, course && _jsxs("span", { className: "text-xs text-muted-foreground", children: ["\u2022 ", course.name] }), _jsx("button", { onClick: async () => {
                                                        if (confirm('Weet je zeker dat je deze taak wilt verwijderen?')) {
                                                            try {
                                                                const { error } = await supabase
                                                                    .from('tasks')
                                                                    .delete()
                                                                    .eq('id', task.id);
                                                                if (error)
                                                                    throw error;
                                                                // Refetch data to update UI
                                                                window.location.reload();
                                                            }
                                                            catch (error) {
                                                                console.error('Error deleting task:', error);
                                                            }
                                                        }
                                                    }, className: "opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700 text-xs px-2 py-1", title: "Taak verwijderen", children: "\u00D7" })] }, task.id));
                                    }) })), day.schedule.length === 0 && day.tasks.length === 0 && (_jsx("p", { className: "text-sm text-muted-foreground italic", "data-testid": `empty-day-${index}`, children: "Geen activiteiten gepland" }))] })] }, index))) }))] }));
}
