import * as React from "react";
import { useState } from "react";
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Calendar, Link2, Unlink, RefreshCw, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CalendarStatus {
  connected: boolean;
  syncEnabled: boolean;
  lastSync: string | null;
  provider: string | null;
}

export default function CalendarIntegration() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isConnecting, setIsConnecting] = useState(false);

  // Get calendar status
  const { data: calendarStatus, isLoading } = useQuery<CalendarStatus>({
    queryKey: ['/api/calendar/status', user?.id],
    enabled: !!user?.id,
  });

  // Connect calendar mutation
  const connectMutation = useMutation({
    mutationFn: async () => {
      setIsConnecting(true);
      return await apiRequest(`/api/calendar/connect/${user?.id}`);
    },
    onSuccess: (data: any) => {
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
    onSuccess: (result: any) => {
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
    return (
      <Card data-testid="calendar-loading">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Google Calendar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatLastSync = (lastSync: string | null) => {
    if (!lastSync) return 'Nog niet gesynchroniseerd';
    const date = new Date(lastSync);
    return `${date.toLocaleDateString('nl-NL')} om ${date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <Card data-testid="calendar-integration">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Google Calendar
        </CardTitle>
        <CardDescription>
          Importeer automatisch afspraken uit je Google Calendar
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Connection Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {calendarStatus?.connected ? (
              <>
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="font-medium">Gekoppeld</span>
                <Badge variant="secondary">{calendarStatus.provider}</Badge>
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4 text-gray-400" />
                <span className="text-muted-foreground">Niet gekoppeld</span>
              </>
            )}
          </div>

          {calendarStatus?.connected ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
              data-testid="button-disconnect-calendar"
            >
              <Unlink className="w-4 h-4 mr-2" />
              Ontkoppelen
            </Button>
          ) : (
            <Button
              onClick={() => connectMutation.mutate()}
              disabled={connectMutation.isPending || isConnecting}
              data-testid="button-connect-calendar"
            >
              <Link2 className="w-4 h-4 mr-2" />
              {isConnecting ? "Koppelen..." : "Koppelen"}
            </Button>
          )}
        </div>

        {/* Last Sync Info */}
        {calendarStatus?.connected && (
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>Laatste sync: {formatLastSync(calendarStatus.lastSync)}</span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              data-testid="button-sync-calendar"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
              {syncMutation.isPending ? "Synchroniseren..." : "Nu synchroniseren"}
            </Button>

            <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
              💡 Je kalender wordt automatisch elke dag om 6:00 gesynchroniseerd
            </div>
          </div>
        )}

        {/* Help Text */}
        {!calendarStatus?.connected && (
          <div className="text-sm text-muted-foreground bg-blue-50 p-3 rounded border border-blue-200">
            <p className="font-medium mb-1">Wat gebeurt er als je koppelt?</p>
            <ul className="space-y-1 text-xs">
              <li>• Afspraken uit je Google Calendar worden automatisch geïmporteerd</li>
              <li>• We herkennen sport, werk, school en andere activiteiten</li>
              <li>• Dagelijkse sync om 6:00 's ochtends</li>
              <li>• Alleen lezen - we wijzigen niets in je Google Calendar</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
