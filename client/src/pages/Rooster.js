import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, Plus, HelpCircle, CalendarX, Loader2, Circle } from "lucide-react";
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
export default function Rooster() {
    const { user } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const userId = user?.id;
    const [formData, setFormData] = useState({
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
    const { data: schedule = [], isLoading: scheduleLoading } = useQuery({
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
            if (error)
                throw new Error(error.message);
            return data;
        },
        enabled: !!userId,
    });
    const { data: courses = [], isLoading: coursesLoading } = useQuery({
        queryKey: ["courses", userId],
        queryFn: async () => {
            const { data, error } = await supabase.from("courses").select("*").eq("user_id", userId).order("name");
            if (error)
                throw new Error(error.message);
            return data;
        },
        enabled: !!userId,
    });
    // === MUTATIONS ===
    const createScheduleMutation = useMutation({
        mutationFn: async (payload) => {
            const { error } = await supabase.from("schedule").insert(payload);
            if (error)
                throw new Error(error.message);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["schedule", userId] });
            setFormData({ course_id: null, day_of_week: 1, start_time: "", end_time: "", kind: "les", title: "", is_recurring: true, date: null });
            toast({ title: "Toegevoegd!", description: "Het roosteritem is succesvol toegevoegd." });
        },
        onError: (error) => {
            toast({ title: "Fout", description: `Kon roosteritem niet toevoegen: ${error.message}`, variant: "destructive" });
        },
    });
    const updateCancelMutation = useMutation({
        mutationFn: async (id) => {
            const { error } = await supabase.from("schedule").update({ status: "cancelled" }).eq("id", id);
            if (error)
                throw new Error(error.message);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["schedule", userId] });
            toast({ title: "Les afgezegd", description: "De les is gemarkeerd als uitgevallen." });
        },
        onError: (error) => {
            toast({ title: "Fout", description: `Kon les niet afzeggen: ${error.message}`, variant: "destructive" });
        },
    });
    const deleteScheduleMutation = useMutation({
        mutationFn: async (id) => {
            const { error } = await supabase.from("schedule").delete().eq("id", id);
            if (error)
                throw new Error(error.message);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["schedule", userId] });
            toast({ title: "Verwijderd", description: "Het roosteritem is verwijderd." });
        },
        onError: (error) => {
            toast({ title: "Fout", description: `Kon roosteritem niet verwijderen: ${error.message}`, variant: "destructive" });
        },
    });
    const createCourseMutation = useMutation({
        mutationFn: async (payload) => {
            const { error } = await supabase.from("courses").insert(payload);
            if (error)
                throw new Error(error.message);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["courses", userId] });
            setCourseFormData({ name: "", color: "#4287f5" });
            setShowCourseForm(false);
            toast({ title: "Vak toegevoegd!", description: "Het vak is succesvol toegevoegd." });
        },
        onError: (error) => {
            toast({ title: "Fout", description: `Kon vak niet toevoegen: ${error.message}`, variant: "destructive" });
        },
    });
    // ✅ FIX: apart mutation voor courses verwijderen i.p.v. schedule.delete()
    const deleteCourseMutation = useMutation({
        mutationFn: async (id) => {
            const { error } = await supabase.from("courses").delete().eq("id", id);
            if (error)
                throw error; // kan FK 23503 opleveren als course in gebruik is
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["courses", userId] });
            toast({ title: "Vak verwijderd", description: "Het vak is verwijderd." });
        },
        onError: (error) => {
            // 23503 = foreign key violation
            const msg = error?.code === "23503"
                ? "Dit vak wordt gebruikt in het rooster. Verwijder eerst die lessen."
                : `Kon vak niet verwijderen: ${error.message}`;
            toast({ title: "Kan niet verwijderen", description: msg, variant: "destructive" });
        },
    });
    // === HANDLERS ===
    const handleSubmit = (e) => {
        e.preventDefault();
        if (!userId) {
            toast({ title: "Niet ingelogd", description: "Je moet ingelogd zijn om een roosteritem toe te voegen.", variant: "destructive" });
            return;
        }
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
        }
        else {
            if (!formData.date) {
                toast({ title: "Datum vereist", description: "Kies een datum voor eenmalige activiteit.", variant: "destructive" });
                return;
            }
        }
        const payload = {
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
        };
        createScheduleMutation.mutate(payload);
    };
    const handleCourseSubmit = (e) => {
        e.preventDefault();
        if (!userId) {
            toast({ title: "Niet ingelogd", description: "Je moet ingelogd zijn om een vak toe te voegen.", variant: "destructive" });
            return;
        }
        if (!courseFormData.name.trim()) {
            toast({ title: "Vak naam vereist", description: "Vul een vaknaam in.", variant: "destructive" });
            return;
        }
        createCourseMutation.mutate({ ...courseFormData, user_id: userId });
    };
    // === HELPERS ===
    const getCourseById = (courseId) => courses.find((c) => c.id === courseId);
    const getDayName = (dow) => ["", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"][dow] || "";
    const formatTime = (t) => t?.slice(0, 5);
    const getKindLabel = (k) => ({ les: "Les", toets: "Toets", sport: "Sport", werk: "Werk", afspraak: "Afspraak", hobby: "Hobby", anders: "Anders" }[k] || k);
    const getKindColor = (k) => ({ les: "bg-blue-100 text-blue-800", toets: "bg-red-100 text-red-800", sport: "bg-green-100 text-green-800", werk: "bg-purple-100 text-purple-800", afspraak: "bg-orange-100 text-orange-800", hobby: "bg-pink-100 text-pink-800", anders: "bg-gray-100 text-gray-800" }[k] || "bg-muted");
    // ✅ Groepering: herhalend per week (day_of_week) en eenmalig (date)
    const grouped = useMemo(() => {
        const weekly = {};
        const single = {};
        for (const it of schedule) {
            if (it.is_recurring && it.day_of_week) {
                weekly[it.day_of_week] ||= [];
                weekly[it.day_of_week].push(it);
            }
            else if (!it.is_recurring && it.date) {
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
    if (!userId) {
        return (_jsx("div", { className: "p-6", "data-testid": "page-rooster", children: _jsxs(Alert, { children: [_jsx(HelpCircle, { className: "h-4 w-4" }), _jsx(AlertDescription, { children: "Je moet ingelogd zijn om je rooster te beheren." })] }) }));
    }
    return (_jsxs("div", { className: "p-6", "data-testid": "page-rooster", children: [_jsx("h2", { className: "text-xl font-semibold mb-6", children: "Activiteit toevoegen" }), _jsxs(Card, { className: "mb-6", children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Nieuwe activiteit" }) }), _jsx(CardContent, { children: _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx(Label, { htmlFor: "kind", children: "Type activiteit" }), _jsxs(Select, { value: formData.kind, onValueChange: (value) => setFormData((p) => ({ ...p, kind: value })), children: [_jsx(SelectTrigger, { children: _jsx(SelectValue, {}) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "les", children: "Les" }), _jsx(SelectItem, { value: "toets", children: "Toets" }), _jsx(SelectItem, { value: "sport", children: "Sport/Training" }), _jsx(SelectItem, { value: "werk", children: "Bijbaan/Werk" }), _jsx(SelectItem, { value: "afspraak", children: "Afspraak" }), _jsx(SelectItem, { value: "hobby", children: "Hobby/Activiteit" }), _jsx(SelectItem, { value: "anders", children: "Anders" })] })] })] }), _jsxs("div", { children: [_jsx(Label, { htmlFor: "title", children: "Titel" }), _jsx(Input, { id: "title", value: formData.title, onChange: (e) => setFormData((p) => ({ ...p, title: e.target.value })), placeholder: "Titel van activiteit" })] })] }), (formData.kind === "les" || formData.kind === "toets") && (_jsxs("div", { children: [_jsx(Label, { htmlFor: "course", children: "Vak" }), _jsxs(Select, { value: formData.course_id ?? "none", onValueChange: (value) => setFormData((p) => ({ ...p, course_id: value === "none" ? null : value })), children: [_jsx(SelectTrigger, { children: _jsx(SelectValue, { placeholder: "Kies een vak" }) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "none", children: "Geen vak" }), courses.map((course) => (_jsx(SelectItem, { value: course.id, children: course.name }, course.id)))] })] })] })), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: [_jsxs("div", { children: [_jsx(Label, { htmlFor: "repeat", children: "Herhaling" }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Checkbox, { id: "repeat", checked: formData.is_recurring, onCheckedChange: (checked) => setFormData((p) => ({ ...p, is_recurring: checked === true })) }), _jsx("span", { children: "Elke week herhalen" })] })] }), formData.is_recurring ? (_jsxs("div", { children: [_jsx(Label, { htmlFor: "day", children: "Dag" }), _jsxs(Select, { value: (formData.day_of_week ?? 1).toString(), onValueChange: (v) => setFormData((p) => ({ ...p, day_of_week: parseInt(v, 10) })), children: [_jsx(SelectTrigger, { children: _jsx(SelectValue, {}) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "1", children: "Maandag" }), _jsx(SelectItem, { value: "2", children: "Dinsdag" }), _jsx(SelectItem, { value: "3", children: "Woensdag" }), _jsx(SelectItem, { value: "4", children: "Donderdag" }), _jsx(SelectItem, { value: "5", children: "Vrijdag" }), _jsx(SelectItem, { value: "6", children: "Zaterdag" }), _jsx(SelectItem, { value: "7", children: "Zondag" })] })] })] })) : (_jsxs("div", { children: [_jsx(Label, { htmlFor: "date", children: "Datum" }), _jsx(Input, { id: "date", type: "date", value: formData.date ?? "", onChange: (e) => setFormData((p) => ({ ...p, date: e.target.value })) })] })), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx(Label, { htmlFor: "startTime", children: "Begintijd" }), _jsx(Input, { id: "startTime", type: "time", value: formData.start_time, onChange: (e) => setFormData((p) => ({ ...p, start_time: e.target.value })) })] }), _jsxs("div", { children: [_jsx(Label, { htmlFor: "endTime", children: "Eindtijd" }), _jsx(Input, { id: "endTime", type: "time", value: formData.end_time, onChange: (e) => setFormData((p) => ({ ...p, end_time: e.target.value })) })] })] })] }), _jsxs(Button, { type: "submit", disabled: createScheduleMutation.isPending, className: "w-full", children: [createScheduleMutation.isPending ? _jsx(Loader2, { className: "w-4 h-4 animate-spin mr-2" }) : null, createScheduleMutation.isPending ? "Toevoegen..." : "Activiteit toevoegen"] })] }) })] }), _jsxs(Card, { className: "mb-6", children: [_jsx(CardHeader, { children: _jsxs("div", { className: "flex justify-between items-center", children: [_jsx(CardTitle, { children: "Vakken beheren" }), _jsxs(Button, { variant: "outline", size: "sm", onClick: () => setShowCourseForm(!showCourseForm), children: [_jsx(Plus, { className: "w-4 h-4 mr-2" }), "Vak toevoegen"] })] }) }), _jsxs(CardContent, { children: [coursesLoading ? (_jsx("div", { className: "text-muted-foreground", children: "Laden..." })) : courses.length > 0 ? (_jsx("div", { className: "grid grid-cols-2 md:grid-cols-3 gap-2 mb-4", children: courses.map((course) => (_jsxs("div", { className: "bg-muted rounded-lg p-3 text-sm relative group flex items-center gap-2", style: { borderLeft: `4px solid ${course.color}` }, children: [_jsx(Circle, { className: "w-3 h-3", style: { color: course.color } }), _jsx("div", { className: "flex-grow", children: _jsx("div", { className: "font-medium", children: course.name }) }), _jsx("button", { onClick: () => deleteCourseMutation.mutate(course.id), className: "text-destructive opacity-0 group-hover:opacity-100 transition-opacity", title: "Vak verwijderen", children: _jsx(Trash2, { className: "w-4 h-4" }) })] }, course.id))) })) : (_jsxs(Alert, { children: [_jsx(HelpCircle, { className: "h-4 w-4" }), _jsx(AlertDescription, { children: "Geen vakken toegevoegd. Voeg vakken toe om lessen in te plannen." })] })), showCourseForm && (_jsxs("form", { onSubmit: handleCourseSubmit, className: "space-y-3 p-4 bg-muted/50 rounded-lg mt-4", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-3", children: [_jsxs("div", { className: "md:col-span-2", children: [_jsx(Label, { htmlFor: "courseName", children: "Vaknaam" }), _jsx(Input, { id: "courseName", value: courseFormData.name, onChange: (e) => setCourseFormData({ ...courseFormData, name: e.target.value }), placeholder: "bv. Wiskunde" })] }), _jsxs("div", { children: [_jsx(Label, { htmlFor: "courseColor", children: "Kleur" }), _jsx(Input, { id: "courseColor", type: "color", value: courseFormData.color, onChange: (e) => setCourseFormData({ ...courseFormData, color: e.target.value }), className: "p-1 h-10" })] })] }), _jsxs("div", { className: "flex space-x-2", children: [_jsx(Button, { type: "submit", size: "sm", disabled: createCourseMutation.isPending, children: createCourseMutation.isPending ? "Bezig..." : "Vak Opslaan" }), _jsx(Button, { type: "button", variant: "outline", size: "sm", onClick: () => setShowCourseForm(false), children: "Annuleren" })] })] }))] })] }), _jsxs("div", { children: [_jsx("h3", { className: "font-medium mb-4", children: "Huidig rooster" }), scheduleLoading ? (_jsx("div", { className: "text-center", children: _jsx(Loader2, { className: "w-6 h-6 animate-spin" }) })) : (_jsxs("div", { className: "space-y-8", children: [_jsxs("div", { children: [_jsx("h4", { className: "font-semibold mb-2", children: "Wekelijks" }), Object.keys(grouped.weekly).length ? (_jsx("div", { className: "space-y-4", children: Object.entries(grouped.weekly)
                                            .sort(([a], [b]) => parseInt(a) - parseInt(b))
                                            .map(([dayOfWeek, items]) => (_jsxs("div", { children: [_jsx("h5", { className: "font-medium text-sm text-muted-foreground mb-2", children: getDayName(parseInt(dayOfWeek)) }), _jsx("div", { className: "space-y-2", children: items.map((item) => {
                                                        const course = getCourseById(item.course_id);
                                                        const isCancelled = item.status === "cancelled";
                                                        return (_jsxs("div", { className: `bg-card border rounded-lg p-4 flex items-center justify-between ${isCancelled ? "opacity-50" : ""}`, children: [_jsxs("div", { children: [_jsxs("div", { className: "flex items-center space-x-2 mb-1", children: [_jsx("h6", { className: `font-medium ${isCancelled ? "line-through" : ""}`, children: item.title || course?.name || "Activiteit" }), _jsx("span", { className: `text-xs px-2 py-0.5 rounded font-medium ${getKindColor(item.kind || "les")}`, children: getKindLabel(item.kind || "les") })] }), _jsx("p", { className: "text-sm text-muted-foreground", children: item.start_time && item.end_time && `${formatTime(item.start_time)} - ${formatTime(item.end_time)}` })] }), _jsxs("div", { className: "flex items-center", children: [!isCancelled && (item.kind === "les" || item.kind === "toets") && (_jsx(Button, { variant: "ghost", size: "icon", onClick: () => updateCancelMutation.mutate(item.id), disabled: updateCancelMutation.isPending, className: "text-orange-600 hover:bg-orange-100", title: "Les afzeggen", children: _jsx(CalendarX, { className: "w-4 h-4" }) })), _jsx(Button, { variant: "ghost", size: "icon", onClick: () => deleteScheduleMutation.mutate(item.id), disabled: deleteScheduleMutation.isPending, className: "text-destructive hover:bg-destructive/10", title: "Verwijderen", children: _jsx(Trash2, { className: "w-4 h-4" }) })] })] }, item.id));
                                                    }) })] }, dayOfWeek))) })) : (_jsx("div", { className: "text-sm text-muted-foreground", children: "Geen wekelijkse items." }))] }), _jsxs("div", { children: [_jsx("h4", { className: "font-semibold mb-2", children: "Eenmalig" }), Object.keys(grouped.single).length ? (_jsx("div", { className: "space-y-4", children: Object.entries(grouped.single)
                                            .sort(([a], [b]) => a.localeCompare(b))
                                            .map(([dateStr, items]) => (_jsxs("div", { children: [_jsx("h5", { className: "font-medium text-sm text-muted-foreground mb-2", children: new Date(dateStr).toLocaleDateString("nl-NL", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }) }), _jsx("div", { className: "space-y-2", children: items.map((item) => {
                                                        const course = getCourseById(item.course_id);
                                                        const isCancelled = item.status === "cancelled";
                                                        return (_jsxs("div", { className: `bg-card border rounded-lg p-4 flex items-center justify-between ${isCancelled ? "opacity-50" : ""}`, children: [_jsxs("div", { children: [_jsxs("div", { className: "flex items-center space-x-2 mb-1", children: [_jsx("h6", { className: `font-medium ${isCancelled ? "line-through" : ""}`, children: item.title || course?.name || "Activiteit" }), _jsx("span", { className: `text-xs px-2 py-0.5 rounded font-medium ${getKindColor(item.kind || "les")}`, children: getKindLabel(item.kind || "les") })] }), _jsx("p", { className: "text-sm text-muted-foreground", children: item.start_time && item.end_time && `${formatTime(item.start_time)} - ${formatTime(item.end_time)}` })] }), _jsxs("div", { className: "flex items-center", children: [!isCancelled && (item.kind === "les" || item.kind === "toets") && (_jsx(Button, { variant: "ghost", size: "icon", onClick: () => updateCancelMutation.mutate(item.id), disabled: updateCancelMutation.isPending, className: "text-orange-600 hover:bg-orange-100", title: "Les afzeggen", children: _jsx(CalendarX, { className: "w-4 h-4" }) })), _jsx(Button, { variant: "ghost", size: "icon", onClick: () => deleteScheduleMutation.mutate(item.id), disabled: deleteScheduleMutation.isPending, className: "text-destructive hover:bg-destructive/10", title: "Verwijderen", children: _jsx(Trash2, { className: "w-4 h-4" }) })] })] }, item.id));
                                                    }) })] }, dateStr))) })) : (_jsx("div", { className: "text-sm text-muted-foreground", children: "Geen eenmalige items." }))] })] }))] })] }));
}
