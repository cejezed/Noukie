import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload as UploadIcon, Palette, GraduationCap, Bell, Clock, Calendar, Download, FileText, HelpCircle, Trash2, Plus, Loader2, Circle, CalendarX, } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
// ✅ Stap 1: Kleurthema's bijgewerkt met Geel en Rood. Geel is de nieuwe standaard.
const colorThemes = [
    { id: "yellow", name: "Geel (Standaard)", primary: "hsl(47.9, 95.8%, 53.1%)", preview: "bg-yellow-500" },
    { id: "blue", name: "Blauw", primary: "hsl(217.2, 91.2%, 59.8%)", preview: "bg-blue-500" },
    { id: "green", name: "Groen", primary: "hsl(142.1, 76.2%, 36.3%)", preview: "bg-green-500" },
    { id: "red", name: "Rood", primary: "hsl(0, 84.2%, 60.2%)", preview: "bg-red-500" },
    { id: "purple", name: "Paars", primary: "hsl(262.1, 83.3%, 57.8%)", preview: "bg-purple-500" },
    { id: "pink", name: "Roze", primary: "hsl(330.1, 81.2%, 60.4%)", preview: "bg-pink-500" },
];
// Jaargang opties
const educationLevels = {
    vmbo: ["vmbo 1", "vmbo 2", "vmbo 3", "vmbo 4"],
    havo: ["havo 1", "havo 2", "havo 3", "havo 4", "havo 5"],
    vwo: ["vwo 1", "vwo 2", "vwo 3", "vwo 4", "vwo 5", "vwo 6"],
    mbo: ["mbo 1", "mbo 2", "mbo 3", "mbo 4"],
};
export default function Instellingen() {
    const { user } = useAuth();
    const userId = user?.id ?? "";
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const displayName = user?.user_metadata?.full_name ||
        user?.user_metadata?.name ||
        user?.user_metadata?.display_name ||
        user?.user_metadata?.username ||
        (user?.email ? String(user.email).split("@")[0] : "—");
    // UI states
    const [selectedTheme, setSelectedTheme] = useState("yellow"); // ✅ Standaard UI state is nu 'yellow'
    const [selectedEducation, setSelectedEducation] = useState("havo");
    const [selectedGrade, setSelectedGrade] = useState("havo 5");
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const [reminderTime, setReminderTime] = useState("18:00");
    const [icalUrl, setIcalUrl] = useState("");
    const [showIcalForm, setShowIcalForm] = useState(false);
    // Rooster: formulier
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
    // Vakken beheren UI
    const [showCourseForm, setShowCourseForm] = useState(false);
    const [courseFormData, setCourseFormData] = useState({ name: "", color: "#4287f5" });
    // ✅ Stap 2: Functie om het thema toe te passen (zowel UI als CSS variabele)
    const applyTheme = (themeId) => {
        const theme = colorThemes.find((t) => t.id === themeId) || colorThemes[0]; // Fallback naar de eerste (geel)
        setSelectedTheme(theme.id);
        if (typeof window !== "undefined") {
            document.documentElement.style.setProperty('--primary', theme.primary);
        }
    };
    // ✅ Stap 2: Laad de opgeslagen kleur van de gebruiker bij het laden van de component
    useEffect(() => {
        if (user?.user_metadata?.app_theme) {
            applyTheme(user.user_metadata.app_theme);
        }
        else {
            applyTheme('yellow'); // Pas standaardthema toe als er geen is opgeslagen
        }
    }, [user]);
    // ✅ Stap 3: Mutatie om gebruikersinstellingen (zoals thema) op te slaan
    const updateProfileMutation = useMutation({
        mutationFn: async (metadata) => {
            const { data, error } = await supabase.auth.updateUser({ data: metadata });
            if (error)
                throw new Error(error.message);
            return data.user;
        },
        onSuccess: (updatedUser) => {
            // Vernieuw de user data in de app zodat de wijziging overal zichtbaar is
            queryClient.invalidateQueries({ queryKey: ["user"] });
            const themeName = colorThemes.find(t => t.id === updatedUser.user_metadata.app_theme)?.name || "Nieuw thema";
            toast({
                title: "Thema opgeslagen!",
                description: `Je kleurvoorkeur is bijgewerkt naar ${themeName}.`,
            });
        },
        onError: (error) => {
            toast({
                title: "Fout bij opslaan",
                description: `Kon het thema niet opslaan: ${error.message}`,
                variant: "destructive",
            });
        },
    });
    // ✅ Stap 3: Functie om thema te wijzigen en op te slaan
    const handleThemeChange = (themeId) => {
        applyTheme(themeId); // Pas direct toe op de UI voor een snelle respons
        updateProfileMutation.mutate({ app_theme: themeId }); // Sla op in de database
    };
    // Courses
    const { data: courses = [], isLoading: coursesLoading } = useQuery({
        queryKey: ["courses", userId],
        enabled: !!userId,
        queryFn: async () => {
            const { data, error } = await supabase.from("courses").select("*").eq("user_id", userId).order("name");
            if (error)
                throw new Error(error.message);
            return data;
        },
    });
    // Schedule (voor overzicht)
    const { data: schedule = [], isLoading: scheduleLoading } = useQuery({
        queryKey: ["schedule", userId],
        enabled: !!userId,
        queryFn: async () => {
            const { data, error } = await supabase
                .from("schedule")
                .select("*")
                .eq("user_id", userId)
                .order("is_recurring", { ascending: false })
                .order("day_of_week", { ascending: true, nullsFirst: false })
                .order("date", { ascending: true, nullsFirst: false })
                .order("start_time", { ascending: true });
            if (error)
                throw new Error(error.message);
            return data;
        },
    });
    // iCal import
    const importIcalMutation = useMutation({
        mutationFn: async (url) => {
            const response = await apiRequest("POST", "/api/schedule/import-ical", {
                userId: user?.id,
                icalUrl: url.trim(),
            });
            return await response.json();
        },
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: ['/api/schedule'] });
            queryClient.invalidateQueries({ queryKey: ['/api/courses'] });
            queryClient.invalidateQueries({ queryKey: ["schedule", userId] });
            queryClient.invalidateQueries({ queryKey: ["courses", userId] });
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
    // Rooster-item aanmaken
    const createScheduleMutation = useMutation({
        mutationFn: async (payload) => {
            const { error } = await supabase.from("schedule").insert(payload);
            if (error)
                throw new Error(error.message);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["schedule", userId] });
            setFormData({
                course_id: null, day_of_week: 1, start_time: "", end_time: "",
                kind: "les", title: "", is_recurring: true, date: null
            });
            toast({ title: "Toegevoegd!", description: "Het roosteritem is succesvol toegevoegd." });
        },
        onError: (e) => toast({ title: "Fout", description: e.message, variant: "destructive" }),
    });
    // Rooster: afzeggen & verwijderen
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
        onError: (e) => toast({ title: "Fout", description: e.message, variant: "destructive" }),
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
        onError: (e) => toast({ title: "Fout", description: e.message, variant: "destructive" }),
    });
    // Vakken CRUD
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
        onError: (e) => toast({ title: "Fout", description: e.message, variant: "destructive" }),
    });
    const deleteCourseMutation = useMutation({
        mutationFn: async (id) => {
            const { error } = await supabase.from("courses").delete().eq("id", id);
            if (error)
                throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["courses", userId] });
            toast({ title: "Vak verwijderd", description: "Het vak is verwijderd." });
        },
        onError: (error) => {
            const msg = error?.code === "23503"
                ? "Dit vak wordt gebruikt in het rooster. Verwijder eerst de gekoppelde lessen of zet FK op ON DELETE SET NULL."
                : `Kon vak niet verwijderen: ${error?.message ?? "Onbekende fout"}`;
            toast({ title: "Kan niet verwijderen", description: msg, variant: "destructive" });
        },
    });
    // Helpers
    const handleRosterImport = (file) => {
        const fileType = file.name.split('.').pop()?.toLowerCase();
        if (!['csv', 'ics', 'ical'].includes(fileType || '')) {
            toast({ title: "Ongeldig bestand", description: "Upload een .csv of .ics bestand", variant: "destructive" });
            return;
        }
        toast({ title: "Rooster import gestart", description: `${file.name} wordt geïmporteerd...` });
        // TODO: implement bestandsimport
    };
    const exportRoster = () => {
        toast({ title: "Rooster export", description: "Je rooster wordt gedownload als CSV bestand" });
        // TODO: implement export
    };
    const submitSchedule = (e) => {
        e.preventDefault();
        if (!userId)
            return;
        if (!formData.start_time || !formData.end_time) {
            toast({ title: "Incomplete gegevens", description: "Vul een start- en eindtijd in.", variant: "destructive" });
            return;
        }
        if (formData.end_time <= formData.start_time) {
            toast({ title: "Tijd klopt niet", description: "Eindtijd moet na begintijd liggen.", variant: "destructive" });
            return;
        }
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
    // Rooster-overzicht helpers
    const getCourseById = (courseId) => courses.find((c) => c.id === courseId);
    const getDayName = (dow) => ["", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"][dow] || "";
    const formatTime = (t) => (t ? t.slice(0, 5) : "");
    const getKindLabel = (k) => ({ les: "Les", toets: "Toets", sport: "Sport", werk: "Werk", afspraak: "Afspraak", hobby: "Hobby", anders: "Anders" }[k || "les"]);
    const getKindColor = (k) => ({ les: "bg-blue-100 text-blue-800", toets: "bg-red-100 text-red-800", sport: "bg-green-100 text-green-800", werk: "bg-purple-100 text-purple-800", afspraak: "bg-orange-100 text-orange-800", hobby: "bg-pink-100 text-pink-800", anders: "bg-gray-100 text-gray-800" }[k || "les"]);
    const grouped = useMemo(() => {
        const weekly = {};
        const single = {};
        schedule.forEach((it) => {
            if (it.is_recurring && it.day_of_week) {
                (weekly[it.day_of_week] ||= []).push(it);
            }
            else if (!it.is_recurring && it.date) {
                (single[it.date] ||= []).push(it);
            }
        });
        Object.values(weekly).forEach((arr) => arr.sort((a, b) => (a.start_time || "").localeCompare(b.start_time || "")));
        Object.values(single).forEach((arr) => arr.sort((a, b) => (a.start_time || "").localeCompare(b.start_time || "")));
        return { weekly, single };
    }, [schedule]);
    return (_jsxs("div", { className: "p-4 space-y-6", "data-testid": "instellingen-page", children: [_jsxs("div", { className: "text-center mb-6", children: [_jsx("h1", { className: "text-2xl font-bold text-foreground mb-2", children: "Instellingen" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Pas je app aan naar jouw wensen" })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Rooster \u2014 Items toevoegen" }) }), _jsx(CardContent, { children: _jsxs("form", { onSubmit: submitSchedule, className: "space-y-4", children: [_jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx(Label, { children: "Type activiteit" }), _jsxs(Select, { value: formData.kind, onValueChange: (v) => setFormData(p => ({ ...p, kind: v })), children: [_jsx(SelectTrigger, { children: _jsx(SelectValue, { placeholder: "Kies type" }) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "les", children: "Les" }), _jsx(SelectItem, { value: "toets", children: "Toets" }), _jsx(SelectItem, { value: "sport", children: "Sport/Training" }), _jsx(SelectItem, { value: "werk", children: "Bijbaan/Werk" }), _jsx(SelectItem, { value: "afspraak", children: "Afspraak" }), _jsx(SelectItem, { value: "hobby", children: "Hobby/Activiteit" }), _jsx(SelectItem, { value: "anders", children: "Anders" })] })] })] }), _jsxs("div", { children: [_jsx(Label, { htmlFor: "title", children: "Titel" }), _jsx(Input, { id: "title", value: formData.title, onChange: (e) => setFormData(p => ({ ...p, title: e.target.value })), placeholder: "Titel van activiteit" })] })] }), (formData.kind === "les" || formData.kind === "toets") && (_jsxs("div", { children: [_jsx(Label, { children: "Vak" }), _jsxs(Select, { value: formData.course_id ?? "none", onValueChange: (v) => setFormData(p => ({ ...p, course_id: v === "none" ? null : v })), children: [_jsx(SelectTrigger, { children: _jsx(SelectValue, { placeholder: "Kies een vak" }) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "none", children: "Geen vak" }), courses.map((c) => (_jsx(SelectItem, { value: c.id, children: c.name }, c.id)))] })] })] })), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: [_jsxs("div", { children: [_jsx(Label, { children: "Herhaling" }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Checkbox, { checked: formData.is_recurring, onCheckedChange: (ch) => setFormData(p => ({ ...p, is_recurring: ch === true })) }), _jsx("span", { children: "Elke week herhalen" })] })] }), formData.is_recurring ? (_jsxs("div", { children: [_jsx(Label, { children: "Dag" }), _jsxs(Select, { value: (formData.day_of_week ?? 1).toString(), onValueChange: (v) => setFormData(p => ({ ...p, day_of_week: parseInt(v, 10) })), children: [_jsx(SelectTrigger, { children: _jsx(SelectValue, { placeholder: "Kies dag" }) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "1", children: "Maandag" }), _jsx(SelectItem, { value: "2", children: "Dinsdag" }), _jsx(SelectItem, { value: "3", children: "Woensdag" }), _jsx(SelectItem, { value: "4", children: "Donderdag" }), _jsx(SelectItem, { value: "5", children: "Vrijdag" }), _jsx(SelectItem, { value: "6", children: "Zaterdag" }), _jsx(SelectItem, { value: "7", children: "Zondag" })] })] })] })) : (_jsxs("div", { children: [_jsx(Label, { children: "Datum" }), _jsx(Input, { type: "date", value: formData.date ?? "", onChange: (e) => setFormData(p => ({ ...p, date: e.target.value })) })] })), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx(Label, { children: "Begintijd" }), _jsx(Input, { type: "time", value: formData.start_time, onChange: (e) => setFormData(p => ({ ...p, start_time: e.target.value })) })] }), _jsxs("div", { children: [_jsx(Label, { children: "Eindtijd" }), _jsx(Input, { type: "time", value: formData.end_time, onChange: (e) => setFormData(p => ({ ...p, end_time: e.target.value })) })] })] })] }), _jsx(Button, { type: "submit", className: "w-full", disabled: createScheduleMutation.isPending || !userId, children: createScheduleMutation.isPending ? (_jsxs(_Fragment, { children: [_jsx(Loader2, { className: "w-4 h-4 animate-spin mr-2" }), "Toevoegen\u2026"] })) : "Roosteritem toevoegen" })] }) })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsx(CardTitle, { children: "Rooster \u2014 Vakken beheren" }), _jsxs(Button, { variant: "outline", size: "sm", onClick: () => setShowCourseForm(!showCourseForm), children: [_jsx(Plus, { className: "w-4 h-4 mr-2" }), "Vak toevoegen"] })] }) }), _jsxs(CardContent, { children: [coursesLoading ? (_jsx("div", { className: "text-muted-foreground", children: "Laden\u2026" })) : courses.length ? (_jsx("div", { className: "grid grid-cols-2 md:grid-cols-3 gap-2 mb-4", children: courses.map((c) => (_jsxs("div", { className: "bg-muted rounded-lg p-3 text-sm flex items-center gap-2", style: { borderLeft: `4px solid ${c.color}` }, children: [_jsx(Circle, { className: "w-3 h-3", style: { color: c.color } }), _jsx("div", { className: "flex-1 font-medium", children: c.name }), _jsx(Button, { variant: "ghost", size: "icon", title: "Verwijderen", onClick: () => { if (confirm(`Vak "${c.name}" verwijderen?`))
                                                deleteCourseMutation.mutate(c.id); }, disabled: deleteCourseMutation.isPending, className: "text-destructive", children: deleteCourseMutation.isPending ? _jsx(Loader2, { className: "w-4 h-4 animate-spin" }) : _jsx(Trash2, { className: "w-4 h-4" }) })] }, c.id))) })) : (_jsxs(Alert, { children: [_jsx(HelpCircle, { className: "h-4 w-4" }), _jsx(AlertDescription, { children: "Geen vakken toegevoegd. Voeg vakken toe om lessen in te plannen." })] })), showCourseForm && (_jsxs("form", { onSubmit: (e) => {
                                    e.preventDefault();
                                    if (!courseFormData.name.trim()) {
                                        toast({ title: "Vak naam vereist", description: "Vul een vaknaam in.", variant: "destructive" });
                                        return;
                                    }
                                    createCourseMutation.mutate({ ...courseFormData, user_id: userId });
                                }, className: "space-y-3 p-4 bg-muted/50 rounded-lg mt-4", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-3", children: [_jsxs("div", { className: "md:col-span-2", children: [_jsx(Label, { children: "Vaknaam" }), _jsx(Input, { value: courseFormData.name, onChange: (e) => setCourseFormData({ ...courseFormData, name: e.target.value }), placeholder: "bv. Wiskunde" })] }), _jsxs("div", { children: [_jsx(Label, { children: "Kleur" }), _jsx(Input, { type: "color", value: courseFormData.color, onChange: (e) => setCourseFormData({ ...courseFormData, color: e.target.value }), className: "p-1 h-10" })] })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { type: "submit", size: "sm", disabled: createCourseMutation.isPending, children: createCourseMutation.isPending ? "Bezig…" : "Vak opslaan" }), _jsx(Button, { type: "button", variant: "outline", size: "sm", onClick: () => setShowCourseForm(false), children: "Annuleren" })] })] }))] })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Rooster \u2014 Overzicht" }) }), _jsx(CardContent, { children: scheduleLoading ? (_jsx("div", { className: "text-center py-6", children: _jsx(Loader2, { className: "w-6 h-6 animate-spin inline-block" }) })) : (_jsxs("div", { className: "space-y-8", children: [_jsxs("div", { children: [_jsx("h4", { className: "font-semibold mb-2", children: "Wekelijks" }), Object.keys(grouped.weekly).length ? (_jsx("div", { className: "space-y-4", children: Object.entries(grouped.weekly)
                                                .sort(([a], [b]) => parseInt(a) - parseInt(b))
                                                .map(([dayOfWeek, items]) => (_jsxs("div", { children: [_jsx("h5", { className: "font-medium text-sm text-muted-foreground mb-2", children: getDayName(parseInt(dayOfWeek)) }), _jsx("div", { className: "space-y-2", children: items.map((item) => {
                                                            const course = getCourseById(item.course_id);
                                                            const isCancelled = item.status === "cancelled";
                                                            return (_jsxs("div", { className: `bg-card border rounded-lg p-4 flex items-center justify-between ${isCancelled ? "opacity-50" : ""}`, children: [_jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-2 mb-1", children: [_jsx("h6", { className: `font-medium ${isCancelled ? "line-through" : ""}`, children: item.title || course?.name || "Activiteit" }), _jsx("span", { className: `text-xs px-2 py-0.5 rounded font-medium ${getKindColor(item.kind)}`, children: getKindLabel(item.kind) })] }), _jsx("p", { className: "text-sm text-muted-foreground", children: item.start_time && item.end_time ? `${formatTime(item.start_time)} - ${formatTime(item.end_time)}` : "" })] }), _jsxs("div", { className: "flex items-center", children: [!isCancelled && (item.kind === "les" || item.kind === "toets") && (_jsx(Button, { variant: "ghost", size: "icon", onClick: () => updateCancelMutation.mutate(item.id), disabled: updateCancelMutation.isPending, className: "text-orange-600 hover:bg-orange-100", title: "Les afzeggen", children: _jsx(CalendarX, { className: "w-4 h-4" }) })), _jsx(Button, { variant: "ghost", size: "icon", onClick: () => deleteScheduleMutation.mutate(item.id), disabled: deleteScheduleMutation.isPending, className: "text-destructive hover:bg-destructive/10", title: "Verwijderen", children: _jsx(Trash2, { className: "w-4 h-4" }) })] })] }, item.id));
                                                        }) })] }, dayOfWeek))) })) : (_jsx("div", { className: "text-sm text-muted-foreground", children: "Geen wekelijkse items." }))] }), _jsxs("div", { children: [_jsx("h4", { className: "font-semibold mb-2", children: "Eenmalig" }), Object.keys(grouped.single).length ? (_jsx("div", { className: "space-y-4", children: Object.entries(grouped.single)
                                                .sort(([a], [b]) => a.localeCompare(b))
                                                .map(([dateStr, items]) => (_jsxs("div", { children: [_jsx("h5", { className: "font-medium text-sm text-muted-foreground mb-2", children: new Date(dateStr).toLocaleDateString("nl-NL", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }) }), _jsx("div", { className: "space-y-2", children: items.map((item) => {
                                                            const course = getCourseById(item.course_id);
                                                            const isCancelled = item.status === "cancelled";
                                                            return (_jsxs("div", { className: `bg-card border rounded-lg p-4 flex items-center justify-between ${isCancelled ? "opacity-50" : ""}`, children: [_jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-2 mb-1", children: [_jsx("h6", { className: `font-medium ${isCancelled ? "line-through" : ""}`, children: item.title || course?.name || "Activiteit" }), _jsx("span", { className: `text-xs px-2 py-0.5 rounded font-medium ${getKindColor(item.kind)}`, children: getKindLabel(item.kind) })] }), _jsx("p", { className: "text-sm text-muted-foreground", children: item.start_time && item.end_time ? `${formatTime(item.start_time)} - ${formatTime(item.end_time)}` : "" })] }), _jsxs("div", { className: "flex items-center", children: [!isCancelled && (item.kind === "les" || item.kind === "toets") && (_jsx(Button, { variant: "ghost", size: "icon", onClick: () => updateCancelMutation.mutate(item.id), disabled: updateCancelMutation.isPending, className: "text-orange-600 hover:bg-orange-100", title: "Les afzeggen", children: _jsx(CalendarX, { className: "w-4 h-4" }) })), _jsx(Button, { variant: "ghost", size: "icon", onClick: () => deleteScheduleMutation.mutate(item.id), disabled: deleteScheduleMutation.isPending, className: "text-destructive hover:bg-destructive/10", title: "Verwijderen", children: _jsx(Trash2, { className: "w-4 h-4" }) })] })] }, item.id));
                                                        }) })] }, dateStr))) })) : (_jsx("div", { className: "text-sm text-muted-foreground", children: "Geen eenmalige items." }))] })] })) })] }), _jsxs(Card, { "data-testid": "theme-settings", children: [_jsx(CardHeader, { children: _jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(Palette, { className: "w-5 h-5" }), "App Kleur"] }) }), _jsx(CardContent, { className: "space-y-4", children: _jsxs("div", { className: "grid grid-cols-2 md:grid-cols-3 gap-3", children: [" ", colorThemes.map((theme) => (_jsx("button", { onClick: () => handleThemeChange(theme.id), className: `p-3 rounded-lg border-2 transition-all ${selectedTheme === theme.id ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`, "data-testid": `theme-${theme.id}`, children: _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: `w-6 h-6 rounded-full ${theme.preview}` }), _jsx("span", { className: "text-sm font-medium", children: theme.name })] }) }, theme.id)))] }) })] }), _jsxs(Card, { "data-testid": "education-settings", children: [_jsx(CardHeader, { children: _jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(GraduationCap, { className: "w-5 h-5" }), "Onderwijsniveau"] }) }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: "Onderwijstype" }), _jsxs(Select, { value: selectedEducation, onValueChange: setSelectedEducation, children: [_jsx(SelectTrigger, { "data-testid": "select-education", children: _jsx(SelectValue, { placeholder: "Kies onderwijstype" }) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "vmbo", children: "VMBO" }), _jsx(SelectItem, { value: "havo", children: "HAVO" }), _jsx(SelectItem, { value: "vwo", children: "VWO" }), _jsx(SelectItem, { value: "mbo", children: "MBO" })] })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: "Jaargang" }), _jsxs(Select, { value: selectedGrade, onValueChange: setSelectedGrade, children: [_jsx(SelectTrigger, { "data-testid": "select-grade", children: _jsx(SelectValue, { placeholder: "Kies jaargang" }) }), _jsx(SelectContent, { children: educationLevels[selectedEducation].map((grade) => (_jsx(SelectItem, { value: grade, children: grade }, grade))) })] })] }), _jsx("div", { className: "bg-blue-50 p-3 rounded-lg", children: _jsx("p", { className: "text-sm text-blue-800", children: "\uD83D\uDCA1 Deze instelling helpt bij het maken van gepaste taken en uitleg" }) })] })] }), _jsxs(Card, { "data-testid": "notification-settings", children: [_jsx(CardHeader, { children: _jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(Bell, { className: "w-5 h-5" }), "Meldingen"] }) }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "space-y-1", children: [_jsx(Label, { children: "Dagelijkse herinneringen" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Ontvang elke dag een herinnering om je huiswerk te checken" })] }), _jsx(Switch, { checked: notificationsEnabled, onCheckedChange: setNotificationsEnabled, "data-testid": "switch-notifications" })] }), notificationsEnabled && (_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { children: "Herinnering tijd" }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Clock, { className: "w-4 h-4 text-muted-foreground" }), _jsx(Input, { type: "time", value: reminderTime, onChange: (e) => setReminderTime(e.target.value), className: "w-32", "data-testid": "input-reminder-time" })] })] }))] })] }), _jsxs(Card, { "data-testid": "roster-settings", children: [_jsx(CardHeader, { children: _jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(Calendar, { className: "w-5 h-5" }), "Rooster Beheer \u2014 Import/Export"] }) }), _jsx(CardContent, { className: "space-y-4", children: _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { children: [_jsx(Label, { htmlFor: "roster-import", children: "Rooster importeren (bestand)" }), _jsx("p", { className: "text-sm text-muted-foreground mb-2", children: "Upload een .csv of .ics bestand van je schoolrooster" }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Input, { id: "roster-import", type: "file", accept: ".csv,.ics,.ical", onChange: (e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file)
                                                            handleRosterImport(file);
                                                    }, className: "hidden", "data-testid": "input-roster-import" }), _jsxs(Button, { onClick: () => document.getElementById('roster-import')?.click(), variant: "outline", size: "sm", className: "flex items-center gap-2", "data-testid": "button-import-roster", children: [_jsx(UploadIcon, { className: "w-4 h-4" }), "Bestand kiezen"] })] })] }), _jsx(Separator, {}), _jsxs("div", { children: [_jsx(Label, { children: "Rooster exporteren (CSV)" }), _jsx("p", { className: "text-sm text-muted-foreground mb-2", children: "Download je huidige rooster als CSV" }), _jsxs(Button, { onClick: exportRoster, variant: "outline", size: "sm", className: "flex items-center gap-2", "data-testid": "button-export-roster", children: [_jsx(Download, { className: "w-4 h-4" }), "Download Rooster"] })] })] }) })] }), _jsxs(Card, { "data-testid": "calendar-integration", children: [_jsx(CardHeader, { children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(Calendar, { className: "w-5 h-5" }), "Rooster Import via iCal URL"] }), _jsxs(Button, { variant: "outline", size: "sm", onClick: () => setShowIcalForm(!showIcalForm), "data-testid": "button-toggle-ical-form", children: [_jsx(FileText, { className: "w-4 h-4 mr-2" }), "iCal URL"] })] }) }), showIcalForm && (_jsxs(CardContent, { children: [_jsxs(Alert, { className: "mb-4", children: [_jsx(HelpCircle, { className: "h-4 w-4" }), _jsxs(AlertDescription, { children: [_jsx("strong", { children: "\uD83D\uDCDA SomToday:" }), " Rooster \u2192 Exporteren \u2192 Kopieer de iCal URL en plak hieronder."] })] }), _jsxs("form", { onSubmit: (e) => {
                                    e.preventDefault();
                                    if (icalUrl.trim()) {
                                        importIcalMutation.mutate(icalUrl.trim());
                                    }
                                }, className: "space-y-3", children: [_jsxs("div", { children: [_jsx(Label, { htmlFor: "icalUrl", children: "iCal URL" }), _jsx(Input, { id: "icalUrl", value: icalUrl, onChange: (e) => setIcalUrl(e.target.value), placeholder: "https://example.com/calendar.ics", "data-testid": "input-ical-url" }), _jsx("p", { className: "text-xs text-muted-foreground mt-1", children: "Plak hier de iCal link van je schoolrooster (SomToday, Zermelo, etc.)" })] }), _jsxs("div", { className: "flex space-x-2", children: [_jsx(Button, { type: "submit", size: "sm", disabled: importIcalMutation.isPending || !icalUrl.trim(), "data-testid": "button-import-ical", children: importIcalMutation.isPending ? "Importeren..." : "Rooster importeren" }), _jsx(Button, { type: "button", variant: "outline", size: "sm", onClick: () => setShowIcalForm(false), "data-testid": "button-cancel-ical", children: "Annuleren" })] })] })] }))] }), _jsxs(Card, { "data-testid": "account-info", children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Account Informatie" }) }), _jsxs(CardContent, { className: "space-y-3", children: [_jsxs("div", { className: "flex justify-between items-center", children: [_jsx("span", { className: "text-sm font-medium", children: "Naam:" }), _jsx("span", { className: "text-sm", children: displayName })] }), _jsxs("div", { className: "flex justify-between items-center", children: [_jsx("span", { className: "text-sm font-medium", children: "Email:" }), _jsx("span", { className: "text-sm", children: user?.email })] }), _jsxs("div", { className: "flex justify-between items-center", children: [_jsx("span", { className: "text-sm font-medium", children: "Rol:" }), _jsx(Badge, { variant: "secondary", children: user?.user_metadata?.role || "student" })] })] })] }), _jsx("div", { className: "flex justify-center pt-4", children: _jsx(Button, { className: "w-full max-w-xs", onClick: () => {
                        toast({ title: "Instellingen opgeslagen", description: "Je voorkeuren zijn bijgewerkt." });
                    }, "data-testid": "button-save-settings", children: "Wijzigingen Opslaan" }) })] }));
}
