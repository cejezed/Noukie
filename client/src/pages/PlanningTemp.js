import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, Plus, CalendarX, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
export default function Rooster() {
    const { user } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const userId = user?.id ?? "";
    const [formData, setFormData] = useState({
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
    const { data: schedule = [], isLoading: scheduleLoading } = useQuery({
        queryKey: ['schedule', userId],
        queryFn: async () => {
            const { data, error } = await supabase.from('schedule').select('*').eq('user_id', userId);
            if (error)
                throw new Error(error.message);
            return data;
        },
        enabled: !!userId,
    });
    const { data: courses = [], isLoading: coursesLoading } = useQuery({
        queryKey: ['courses', userId],
        queryFn: async () => {
            const { data, error } = await supabase.from('courses').select('*').eq('user_id', userId);
            if (error)
                throw new Error(error.message);
            return data;
        },
        enabled: !!userId,
    });
    // === MUTATIONS ===
    const createMutation = useMutation({
        mutationFn: async (data) => {
            const { error } = await supabase.from('schedule').insert(data);
            if (error)
                throw new Error(error.message);
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
        mutationFn: async (data) => {
            const { error } = await supabase.from('courses').insert(data);
            if (error)
                throw new Error(error.message);
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
        mutationFn: async (id) => {
            const { error } = await supabase.from('schedule').delete().eq('id', id);
            if (error)
                throw new Error(error.message);
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
        mutationFn: async (id) => {
            const { error } = await supabase.from('schedule').update({ status: 'cancelled' }).eq('id', id);
            if (error)
                throw new Error(error.message);
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
    const getCourseById = (courseId) => courses.find(c => c.id === courseId);
    const getDayName = (dayOfWeek) => ["", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"][dayOfWeek] || "";
    const formatTime = (timeString) => timeString.slice(0, 5);
    const getKindLabel = (kind) => ({ les: "Les", toets: "Toets", sport: "Sport", werk: "Werk", afspraak: "Afspraak", hobby: "Hobby", anders: "Anders" }[kind] || kind);
    const getKindColor = (kind) => ({ les: "bg-blue-100 text-blue-800", toets: "bg-red-100 text-red-800", sport: "bg-green-100 text-green-800", werk: "bg-purple-100 text-purple-800", afspraak: "bg-orange-100 text-orange-800", hobby: "bg-pink-100 text-pink-800", anders: "bg-gray-100 text-gray-800" }[kind] || "bg-muted");
    const groupedSchedule = schedule.reduce((acc, item) => {
        const key = item.day_of_week || 0;
        if (!acc[key])
            acc[key] = [];
        acc[key].push(item);
        return acc;
    }, {});
    return (_jsxs("div", { className: "p-6", "data-testid": "page-rooster", children: [_jsx("h2", { className: "text-xl font-semibold mb-6", children: "Activiteit toevoegen" }), _jsxs(Card, { className: "mb-6", children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Nieuwe activiteit" }) }), _jsx(CardContent, {})] }), _jsxs(Card, { className: "mb-6", children: [_jsx(CardHeader, { children: _jsxs("div", { className: "flex justify-between items-center", children: [_jsx(CardTitle, { children: "Vakken beheren" }), _jsxs(Button, { variant: "outline", size: "sm", onClick: () => setShowCourseForm(!showCourseForm), children: [_jsx(Plus, { className: "w-4 h-4 mr-2" }), "Vak toevoegen"] })] }) }), _jsx(CardContent, {})] }), _jsxs("div", { children: [_jsx("h3", { className: "font-medium mb-4", children: "Huidig rooster" }), scheduleLoading ? _jsx("div", { className: "text-center", children: _jsx(Loader2, { className: "w-6 h-6 animate-spin" }) }) : Object.keys(groupedSchedule).length > 0 ? (_jsx("div", { className: "space-y-4", children: Object.entries(groupedSchedule).sort(([a], [b]) => parseInt(a) - parseInt(b)).map(([dayOfWeek, items]) => (_jsxs("div", { children: [_jsx("h4", { className: "font-medium text-sm text-muted-foreground mb-2", children: getDayName(parseInt(dayOfWeek)) }), _jsx("div", { className: "space-y-2", children: items.map(item => {
                                        const course = getCourseById(item.course_id);
                                        const isCancelled = item.status === "cancelled";
                                        return (_jsxs("div", { className: `bg-card border rounded-lg p-4 flex items-center justify-between ${isCancelled ? 'opacity-50' : ''}`, children: [_jsxs("div", { children: [_jsxs("div", { className: "flex items-center space-x-2 mb-1", children: [_jsx("h5", { className: `font-medium ${isCancelled ? 'line-through' : ''}`, children: item.title || course?.name || "Activiteit" }), _jsx("span", { className: `text-xs px-2 py-0.5 rounded font-medium ${getKindColor(item.kind || 'les')}`, children: getKindLabel(item.kind || 'les') })] }), _jsx("p", { className: "text-sm text-muted-foreground", children: item.start_time && item.end_time && `${formatTime(item.start_time)} - ${formatTime(item.end_time)}` })] }), _jsxs("div", { className: "flex items-center", children: [!isCancelled && (item.kind === "les" || item.kind === "toets") && (_jsx(Button, { variant: "ghost", size: "icon", onClick: () => cancelLessonMutation.mutate(item.id), disabled: cancelLessonMutation.isPending, className: "text-orange-600 hover:bg-orange-100", title: "Les afzeggen", children: _jsx(CalendarX, { className: "w-4 h-4" }) })), _jsx(Button, { variant: "ghost", size: "icon", onClick: () => deleteMutation.mutate(item.id), disabled: deleteMutation.isPending, className: "text-destructive hover:bg-destructive/10", title: "Verwijderen", children: _jsx(Trash2, { className: "w-4 h-4" }) })] })] }, item.id));
                                    }) })] }, dayOfWeek))) })) : (_jsx("div", { className: "text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg", children: "Geen roosteritems toegevoegd." }))] })] }));
}
