import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Check, Trash2, Info, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import CoachChat from "@/features/chat/CoachChat";
import SmartVoiceInput from "@/features/chat/SmartVoiceInput";
const fmtTime = (t) => (t ? t.slice(0, 5) : "");
function getLocalDayBounds(dateLike) {
    const d = typeof dateLike === "string" ? new Date(dateLike) : new Date(dateLike);
    const start = new Date(d);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { startISO: start.toISOString(), endISO: end.toISOString() };
}
export default function Vandaag() {
    const { user } = useAuth();
    const userId = user?.id ?? "";
    const { toast } = useToast();
    const qc = useQueryClient();
    const today = useMemo(() => {
        const d = new Date();
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        const iso = `${yyyy}-${mm}-${dd}`;
        const js = d.getDay();
        const dow = js === 0 ? 7 : js;
        return { date: d, iso, dow };
    }, []);
    const { data: courses = [] } = useQuery({
        queryKey: ["courses", userId],
        enabled: !!userId,
        queryFn: async () => {
            const { data, error } = await supabase.from("courses").select("*").eq("user_id", userId).order("name");
            if (error)
                throw new Error(error.message);
            return data;
        },
    });
    const { data: schedule = [], isLoading: scheduleLoading } = useQuery({
        queryKey: ["schedule", userId],
        enabled: !!userId,
        queryFn: async () => {
            const { data, error } = await supabase.from("schedule").select("*").eq("user_id", userId);
            if (error)
                throw new Error(error.message);
            return data;
        },
    });
    const todayItems = useMemo(() => {
        const arr = schedule.filter((it) => {
            const notCancelled = (it.status || "active") !== "cancelled";
            const isWeeklyToday = it.is_recurring && it.day_of_week === today.dow;
            const isSingleToday = !it.is_recurring && it.date === today.iso;
            return notCancelled && (isWeeklyToday || isSingleToday);
        });
        return arr.sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));
    }, [schedule, today]);
    const getCourseById = (courseId) => courses.find((c) => c.id === courseId);
    const { data: tasksToday = [], isLoading: tasksLoading } = useQuery({
        queryKey: ["tasks-today", userId, today.iso],
        enabled: !!userId,
        queryFn: async () => {
            const { startISO, endISO } = getLocalDayBounds(today.iso);
            const { data, error } = await supabase
                .from("tasks")
                .select("*")
                .eq("user_id", userId)
                .gte("due_at", startISO)
                .lt("due_at", endISO)
                .order("due_at", { ascending: true });
            if (error)
                throw new Error(error.message);
            return data;
        },
    });
    const { data: coachMemory = [] } = useQuery({
        queryKey: ["coach-memory", userId],
        enabled: !!userId,
        queryFn: async () => {
            const { data, error } = await supabase.from("coach_memory").select("*").eq("user_id", userId);
            if (error)
                throw new Error(error.message);
            return data;
        },
    });
    const qcKey = ["tasks-today", userId, today.iso];
    const addTaskMutation = useMutation({
        mutationFn: async (input) => {
            const { startISO } = getLocalDayBounds(today.iso);
            const dueLocal = new Date(startISO);
            dueLocal.setHours(20, 0, 0, 0);
            const { error } = await supabase.from("tasks").insert({
                user_id: userId,
                title: input.title,
                status: "todo",
                due_at: dueLocal.toISOString(),
                course_id: input.courseId,
                est_minutes: input.estMinutes,
            });
            if (error)
                throw new Error(error.message);
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: qcKey });
            toast({ title: "Taak toegevoegd" });
        },
        onError: (e) => {
            toast({ title: "Toevoegen mislukt", variant: "destructive", description: e?.message ?? "Onbekende fout" });
        },
    });
    const toggleDone = useMutation({
        mutationFn: async (task) => {
            const next = task.status === "done" ? "todo" : "done";
            const { error } = await supabase.from("tasks").update({ status: next }).eq("id", task.id);
            if (error)
                throw new Error(error.message);
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: qcKey }),
    });
    const delTask = useMutation({
        mutationFn: async (taskId) => {
            const res = await supabase.from("tasks").delete().eq("id", taskId);
            if (res.error)
                throw new Error(res.error.message);
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: qcKey }),
    });
    const [title, setTitle] = useState("");
    const [courseId, setCourseId] = useState(null);
    const [estMinutes, setEstMinutes] = useState("");
    const onAddTask = (e) => {
        e.preventDefault();
        if (!title.trim()) {
            toast({ title: "Titel is verplicht", variant: "destructive" });
            return;
        }
        addTaskMutation.mutate({
            title: title.trim(),
            courseId,
            estMinutes: estMinutes ? Number(estMinutes) : null,
        });
        setTitle("");
        setCourseId(null);
        setEstMinutes("");
    };
    const coachRef = useRef(null);
    const [msg, setMsg] = useState("");
    const [sending, setSending] = useState(false);
    async function handleSend(e) {
        if (e)
            e.preventDefault();
        const text = msg.trim();
        if (!text) {
            toast({ title: "Leeg bericht", description: "Typ eerst je bericht.", variant: "destructive" });
            return;
        }
        if (!coachRef.current?.sendMessage) {
            toast({ title: "Chat niet klaar", description: "CoachChat is nog niet geladen.", variant: "destructive" });
            return;
        }
        try {
            setSending(true);
            const p = coachRef.current.sendMessage(text);
            if (p && typeof p.then === "function")
                await p;
            setMsg("");
        }
        catch (err) {
            toast({ title: "Versturen mislukt", description: err?.message ?? "Onbekende fout", variant: "destructive" });
        }
        finally {
            setSending(false);
        }
    }
    const coachContext = {
        todayDate: today.iso,
        todaySchedule: todayItems.map((i) => ({
            kind: i.kind,
            course: getCourseById(i.course_id)?.name ?? i.title ?? "Activiteit",
            start: i.start_time,
            end: i.end_time,
        })),
        openTasks: tasksToday.map((t) => ({ id: t.id, title: t.title, status: t.status, courseId: t.course_id })),
        difficulties: coachMemory.map((m) => ({
            course: m.course,
            status: m.status,
            note: m.note,
            lastUpdate: m.last_update,
        })),
    };
    const coachSystemHint = `
Je bent Noukie, een vriendelijke studiecoach. Reageer kort, natuurlijk en in het Nederlands.
- Gebruik context (rooster/taken/memory) alleen als het helpt; noem het niet expliciet tenzij relevant.
- Bied GEEN vaste blokken of schema's aan, tenzij de gebruiker daar duidelijk om vraagt.
- Max 2-3 zinnen. Hoogstens 1 vraag terug als dat nodig is.
- Vier kleine successen. Als de gebruiker planning vraagt: doe 1-2 concrete vervolgstappen (geen sjablonen).
`.trim();
    return (_jsx("div", { className: "min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20", children: _jsxs("div", { className: "max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6", children: [_jsx("div", { className: "text-center text-xs text-slate-400", children: "v2.1.0" }), _jsxs("section", { className: "bg-white/80 backdrop-blur-sm rounded-3xl shadow-sm border border-slate-200/50 p-6 space-y-4", children: [_jsxs("div", { className: "flex items-start justify-between mb-2", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-lg font-medium text-slate-700", children: "Praat met Noukie" }), _jsx("p", { className: "text-sm text-slate-500 mt-1", children: "Je studiecoach helpt je graag met planning en motivatie" })] }), _jsxs(Dialog, { children: [_jsx(DialogTrigger, { asChild: true, children: _jsx(Button, { variant: "ghost", size: "icon", className: "text-slate-400 hover:text-slate-600", children: _jsx(Info, { className: "h-5 w-5" }) }) }), _jsxs(DialogContent, { className: "rounded-2xl", children: [_jsx(DialogHeader, { children: _jsx(DialogTitle, { children: "Tips voor Vandaag" }) }), _jsxs("div", { className: "space-y-4 pt-2 text-sm text-slate-600", children: [_jsxs("div", { className: "flex gap-3", children: [_jsx("div", { className: "w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-blue-600 font-semibold", children: "1" }), _jsxs("div", { children: [_jsx("div", { className: "font-medium text-slate-700", children: "Start klein" }), _jsx("div", { children: "Kies \u00E9\u00E9n ding om nu te doen" })] })] }), _jsxs("div", { className: "flex gap-3", children: [_jsx("div", { className: "w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 text-indigo-600 font-semibold", children: "2" }), _jsxs("div", { children: [_jsx("div", { className: "font-medium text-slate-700", children: "Chat voor planning" }), _jsx("div", { children: "Vraag om 1-2 concrete vervolgstappen" })] })] }), _jsxs("div", { className: "flex gap-3", children: [_jsx("div", { className: "w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 text-purple-600 font-semibold", children: "3" }), _jsxs("div", { children: [_jsx("div", { className: "font-medium text-slate-700", children: "Leren of uitleg?" }), _jsx("div", { children: "Ga naar de Uitleg-tab voor stap-voor-stap begeleiding" })] })] })] })] })] })] }), _jsx(CoachChat, { ref: coachRef, systemHint: coachSystemHint, context: coachContext, size: "large", hideComposer: true, threadKey: `today:${userId || "anon"}` }), _jsxs("form", { onSubmit: handleSend, className: "space-y-3", children: [_jsx(Textarea, { placeholder: "Hoe ging het op school? Waar kan ik je mee helpen?", value: msg, onChange: (e) => setMsg(e.target.value), rows: 3, className: "min-h-24 text-base border-slate-200 focus:border-blue-300 focus:ring-blue-200 rounded-xl" }), _jsxs("div", { className: "flex flex-col sm:flex-row gap-2", children: [_jsx(SmartVoiceInput, { onTranscript: (text) => {
                                                setMsg(text);
                                                handleSend();
                                            }, lang: "nl-NL" }), _jsxs(Button, { type: "submit", disabled: sending, className: "bg-slate-800 hover:bg-slate-700 rounded-xl", children: [sending ? _jsx(Loader2, { className: "w-4 h-4 mr-2 animate-spin" }) : null, sending ? "Versturen..." : "Stuur"] })] }), _jsxs("div", { className: "text-sm text-slate-500", children: ["Zoek je hulp bij leren of studeren?", _jsx("a", { href: "/LeerChat", className: "text-blue-600 hover:underline ml-1", children: "Ga naar Uitleg" })] })] })] }), _jsxs("div", { className: "grid lg:grid-cols-2 gap-6", children: [_jsxs("section", { className: "bg-white/80 backdrop-blur-sm rounded-3xl shadow-sm border border-slate-200/50 p-6", children: [_jsxs("div", { className: "flex items-center gap-2 mb-4", children: [_jsx(Clock, { className: "w-5 h-5 text-slate-400" }), _jsx("h2", { className: "text-lg font-medium text-slate-700", children: "Je rooster" })] }), scheduleLoading ? (_jsx("div", { className: "text-center py-8", children: _jsx(Loader2, { className: "w-6 h-6 animate-spin inline-block text-slate-400" }) })) : todayItems.length ? (_jsx("div", { className: "space-y-2", children: todayItems.map((item) => {
                                        const course = getCourseById(item.course_id);
                                        return (_jsxs("div", { className: "bg-slate-50/50 rounded-xl p-4 border border-slate-100", children: [_jsx("div", { className: "font-medium text-slate-700", children: item.title || course?.name || "Activiteit" }), _jsxs("div", { className: "flex items-center gap-2 mt-1", children: [_jsxs("span", { className: "text-sm text-slate-500", children: [fmtTime(item.start_time), item.end_time ? ` - ${fmtTime(item.end_time)}` : ""] }), _jsx("span", { className: "text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full", children: item.kind || "les" })] })] }, item.id));
                                    }) })) : (_jsx("div", { className: "text-center py-8 text-slate-400", children: "Geen activiteiten gepland" }))] }), _jsxs("section", { className: "bg-white/80 backdrop-blur-sm rounded-3xl shadow-sm border border-slate-200/50 p-6", children: [_jsx("h2", { className: "text-lg font-medium text-slate-700 mb-4", children: "Je taken" }), tasksLoading ? (_jsx("div", { className: "text-center py-8", children: _jsx(Loader2, { className: "w-6 h-6 animate-spin inline-block text-slate-400" }) })) : (_jsx("div", { className: "space-y-2", children: tasksToday.length === 0 ? (_jsx("div", { className: "text-center py-8 text-slate-400", children: "Geen taken voor vandaag" })) : (tasksToday.map((task) => {
                                        const isDone = task.status === "done";
                                        return (_jsxs("div", { className: "bg-slate-50/50 rounded-xl p-4 border border-slate-100 flex items-center justify-between gap-3", children: [_jsx("div", { className: `flex-1 text-sm ${isDone ? "line-through text-slate-400" : "text-slate-700"}`, children: task.title }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx(Button, { variant: "ghost", size: "icon", className: "h-8 w-8 text-slate-400 hover:text-green-600 hover:bg-green-50", onClick: () => toggleDone.mutate(task), children: _jsx(Check, { className: "w-4 h-4" }) }), _jsx(Button, { variant: "ghost", size: "icon", className: "h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50", onClick: () => delTask.mutate(task.id), children: _jsx(Trash2, { className: "w-4 h-4" }) })] })] }, task.id));
                                    })) }))] })] }), _jsxs("section", { className: "bg-white/80 backdrop-blur-sm rounded-3xl shadow-sm border border-slate-200/50 p-6", children: [_jsx("h2", { className: "text-lg font-medium text-slate-700 mb-4", children: "Nieuwe taak toevoegen" }), _jsxs("form", { onSubmit: onAddTask, className: "space-y-4", children: [_jsxs("div", { children: [_jsx(Label, { htmlFor: "t-title", className: "text-slate-600", children: "Wat moet je doen?" }), _jsx(Textarea, { id: "t-title", placeholder: "Bijv. Wiskunde \u00A72.3 oefenen, Engelse woordjes H2, samenvatting H4", value: title, onChange: (e) => setTitle(e.target.value), rows: 2, className: "mt-1.5 border-slate-200 focus:border-blue-300 focus:ring-blue-200 rounded-xl" })] }), _jsxs("div", { className: "grid sm:grid-cols-3 gap-4", children: [_jsxs("div", { children: [_jsx(Label, { htmlFor: "t-course", className: "text-slate-600", children: "Vak (optioneel)" }), _jsxs(Select, { value: courseId ?? "none", onValueChange: (v) => setCourseId(v === "none" ? null : v), children: [_jsx(SelectTrigger, { id: "t-course", className: "mt-1.5 border-slate-200 rounded-xl", children: _jsx(SelectValue, { placeholder: "Kies vak" }) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "none", children: "Geen vak" }), courses.map((c) => (_jsx(SelectItem, { value: c.id, children: c.name }, c.id)))] })] })] }), _jsxs("div", { children: [_jsx(Label, { htmlFor: "t-min", className: "text-slate-600", children: "Duur (min)" }), _jsx(Input, { id: "t-min", type: "number", min: 5, step: 5, placeholder: "30", value: estMinutes, onChange: (e) => setEstMinutes(e.target.value), className: "mt-1.5 border-slate-200 rounded-xl" })] }), _jsx("div", { className: "flex items-end", children: _jsxs(Button, { type: "submit", disabled: addTaskMutation.isPending, className: "w-full bg-slate-800 hover:bg-slate-700 rounded-xl", children: [addTaskMutation.isPending ? _jsx(Loader2, { className: "w-4 h-4 mr-2 animate-spin" }) : null, addTaskMutation.isPending ? "Toevoegen..." : "Toevoegen"] }) })] })] })] })] }) }));
}
