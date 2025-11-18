import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import * as React from "react";
import { useState } from "react";
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Link2, Unlink, RefreshCw, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
export default function CalendarIntegration() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [isConnecting, setIsConnecting] = useState(false);
    // Get calendar status
    const { data: calendarStatus, isLoading } = useQuery({
        queryKey: ['/api/calendar/status', user?.id],
        enabled: !!user?.id,
    });
    // Connect calendar mutation
    const connectMutation = useMutation({
        mutationFn: async () => {
            setIsConnecting(true);
            return await apiRequest(`/api/calendar/connect/${user?.id}`);
        },
        onSuccess: (data) => {
            // Redirect to Google OAuth
            window.location.href = data.authUrl;
        },
        onError: (error) => {
            setIsConnecting(false);
            toast({
                title: "Fout bij koppelen",
                description: "Kon de kalender koppeling niet starten. Probeer het opnieuw.",
                variant: "destructive",
            });
        },
    });
    // Disconnect calendar mutation
    const disconnectMutation = useMutation({
        mutationFn: async () => {
            return await apiRequest(`/api/calendar/disconnect/${user?.id}`, 'POST');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/calendar/status', user?.id] });
            toast({
                title: "Kalender ontkoppeld",
                description: "Je Google Calendar is succesvol ontkoppeld.",
            });
        },
        onError: (error) => {
            toast({
                title: "Fout bij ontkoppelen",
                description: "Kon de kalender niet ontkoppelen. Probeer het opnieuw.",
                variant: "destructive",
            });
        },
    });
    // Manual sync mutation
    const syncMutation = useMutation({
        mutationFn: async () => {
            return await apiRequest(`/api/calendar/sync/${user?.id}`, 'POST');
        },
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: ['/api/calendar/status', user?.id] });
            queryClient.invalidateQueries({ queryKey: ['/api/schedule', user?.id] });
            toast({
                title: "Sync voltooid",
                description: `${result.imported} activiteiten geïmporteerd, ${result.skipped} overgeslagen`,
            });
        },
        onError: (error) => {
            toast({
                title: "Sync mislukt",
                description: "Kon de kalender niet synchroniseren. Probeer het opnieuw.",
                variant: "destructive",
            });
        },
    });
    if (isLoading) {
        return (_jsxs(Card, { "data-testid": "calendar-loading", children: [_jsx(CardHeader, { children: _jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(Calendar, { className: "w-5 h-5" }), "Google Calendar"] }) }), _jsx(CardContent, { children: _jsx("div", { className: "flex items-center justify-center py-4", children: _jsx("div", { className: "animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" }) }) })] }));
    }
    const formatLastSync = (lastSync) => {
        if (!lastSync)
            return 'Nog niet gesynchroniseerd';
        const date = new Date(lastSync);
        return `${date.toLocaleDateString('nl-NL')} om ${date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`;
    };
    return (_jsxs(Card, { "data-testid": "calendar-integration", children: [_jsxs(CardHeader, { children: [_jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(Calendar, { className: "w-5 h-5" }), "Google Calendar"] }), _jsx(CardDescription, { children: "Importeer automatisch afspraken uit je Google Calendar" })] }), _jsxs(CardContent, { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("div", { className: "flex items-center gap-2", children: calendarStatus?.connected ? (_jsxs(_Fragment, { children: [_jsx(CheckCircle, { className: "w-4 h-4 text-green-500" }), _jsx("span", { className: "font-medium", children: "Gekoppeld" }), _jsx(Badge, { variant: "secondary", children: calendarStatus.provider })] })) : (_jsxs(_Fragment, { children: [_jsx(XCircle, { className: "w-4 h-4 text-gray-400" }), _jsx("span", { className: "text-muted-foreground", children: "Niet gekoppeld" })] })) }), calendarStatus?.connected ? (_jsxs(Button, { variant: "outline", size: "sm", onClick: () => disconnectMutation.mutate(), disabled: disconnectMutation.isPending, "data-testid": "button-disconnect-calendar", children: [_jsx(Unlink, { className: "w-4 h-4 mr-2" }), "Ontkoppelen"] })) : (_jsxs(Button, { onClick: () => connectMutation.mutate(), disabled: connectMutation.isPending || isConnecting, "data-testid": "button-connect-calendar", children: [_jsx(Link2, { className: "w-4 h-4 mr-2" }), isConnecting ? "Koppelen..." : "Koppelen"] }))] }), calendarStatus?.connected && (_jsxs("div", { className: "space-y-3 pt-2 border-t", children: [_jsxs("div", { className: "flex items-center gap-2 text-sm text-muted-foreground", children: [_jsx(Clock, { className: "w-4 h-4" }), _jsxs("span", { children: ["Laatste sync: ", formatLastSync(calendarStatus.lastSync)] })] }), _jsxs(Button, { variant: "outline", size: "sm", onClick: () => syncMutation.mutate(), disabled: syncMutation.isPending, "data-testid": "button-sync-calendar", children: [_jsx(RefreshCw, { className: `w-4 h-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}` }), syncMutation.isPending ? "Synchroniseren..." : "Nu synchroniseren"] }), _jsx("div", { className: "text-xs text-muted-foreground bg-muted p-2 rounded", children: "\uD83D\uDCA1 Je kalender wordt automatisch elke dag om 6:00 gesynchroniseerd" })] })), !calendarStatus?.connected && (_jsxs("div", { className: "text-sm text-muted-foreground bg-blue-50 p-3 rounded border border-blue-200", children: [_jsx("p", { className: "font-medium mb-1", children: "Wat gebeurt er als je koppelt?" }), _jsxs("ul", { className: "space-y-1 text-xs", children: [_jsx("li", { children: "\u2022 Afspraken uit je Google Calendar worden automatisch ge\u00EFmporteerd" }), _jsx("li", { children: "\u2022 We herkennen sport, werk, school en andere activiteiten" }), _jsx("li", { children: "\u2022 Dagelijkse sync om 6:00 's ochtends" }), _jsx("li", { children: "\u2022 Alleen lezen - we wijzigen niets in je Google Calendar" })] })] }))] })] }));
}
