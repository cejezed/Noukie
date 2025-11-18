import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Brain, Calendar, CheckSquare, TrendingUp, Frown, AlertCircle, Battery, Moon, Zap, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface ChildDashboardProps {
  child: any;
  onBack: () => void;
}

export default function ChildDashboard({ child, onBack }: ChildDashboardProps) {
  const childId = child.child?.id;

  // Fetch mental checkins
  const { data: mentalCheckins, isLoading: checkinsLoading } = useQuery({
    queryKey: ['/api/parent/child', childId, 'mental-checkins'],
    enabled: !!childId,
  });

  // Fetch mental metrics
  const { data: mentalMetrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['/api/parent/child', childId, 'mental-metrics'],
    enabled: !!childId,
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Terug
        </Button>
        <div>
          <h2 className="text-2xl font-semibold">{child.relationship.childName}</h2>
          <p className="text-sm text-muted-foreground">{child.relationship.childEmail}</p>
        </div>
      </div>

      <Tabs defaultValue="mentaal" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="taken">
            <CheckSquare className="w-4 h-4 mr-2" />
            Taken
          </TabsTrigger>
          <TabsTrigger value="rooster">
            <Calendar className="w-4 h-4 mr-2" />
            Rooster
          </TabsTrigger>
          <TabsTrigger value="mentaal">
            <Brain className="w-4 h-4 mr-2" />
            Mentaal
          </TabsTrigger>
        </TabsList>

        <TabsContent value="taken" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Taken</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Taken functionaliteit wordt nog ontwikkeld...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rooster" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Rooster</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Rooster functionaliteit wordt nog ontwikkeld...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mentaal" className="space-y-4">
          {metricsLoading ? (
            <Card>
              <CardContent className="p-6 text-center">
                <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto" />
                <p className="text-muted-foreground mt-2">Mentale gegevens laden...</p>
              </CardContent>
            </Card>
          ) : mentalMetrics ? (
            <MentalTab
              metrics={mentalMetrics}
              checkins={mentalCheckins || []}
              loading={checkinsLoading}
            />
          ) : (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-muted-foreground">Geen mentale check-in gegevens beschikbaar</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface MentalTabProps {
  metrics: any;
  checkins: any[];
  loading: boolean;
}

function MentalTab({ metrics, checkins, loading }: MentalTabProps) {
  // Metrics tiles
  const metricsTiles = [
    {
      icon: CheckSquare,
      label: "Check-ins laatste 7 dagen",
      value: metrics.checkinsLast7d,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      icon: Moon,
      label: "Gem. Slaap (1-5)",
      value: metrics.avgSleepLast7d.toFixed(1),
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      icon: Zap,
      label: "Gem. Spanning (1-5)",
      value: metrics.avgStressLast7d.toFixed(1),
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
    {
      icon: Battery,
      label: "Gem. Energie (1-5)",
      value: metrics.avgEnergyLast7d.toFixed(1),
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      icon: Frown,
      label: '"Niet lekker" (30d)',
      value: metrics.daysNotFeelingWellLast30d,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
    },
    {
      icon: AlertCircle,
      label: '"Hulp nu" (30d)',
      value: metrics.helpNowCountLast30d,
      color: "text-red-600",
      bgColor: "bg-red-50",
    },
  ];

  // Prepare line chart data (last 30 days)
  const lineChartData = checkins.map((c) => ({
    date: new Date(c.date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }),
    Slaap: c.sleepScore,
    Spanning: c.stressScore,
    Energie: c.energyScore,
  }));

  // Prepare mood pie chart data
  const moodCounts = {
    ok: 0,
    niet_lekker: 0,
    hulp_nu: 0,
  };

  checkins.forEach((c) => {
    if (c.mood) {
      moodCounts[c.mood as keyof typeof moodCounts]++;
    }
  });

  const moodPieData = [
    { name: 'OK', value: moodCounts.ok, color: '#22c55e' },
    { name: 'Niet lekker', value: moodCounts.niet_lekker, color: '#f59e0b' },
    { name: 'Hulp nu', value: moodCounts.hulp_nu, color: '#ef4444' },
  ].filter(d => d.value > 0);

  return (
    <>
      {/* Metrics Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {metricsTiles.map((tile, idx) => {
          const Icon = tile.icon;
          return (
            <Card key={idx}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-lg ${tile.bgColor}`}>
                    <Icon className={`w-5 h-5 ${tile.color}`} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{tile.label}</p>
                    <p className="text-2xl font-bold">{tile.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Line Chart: 30-day trends */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Trends laatste 30 dagen
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : lineChartData.length === 0 ? (
            <div className="h-64 flex items-center justify-center">
              <p className="text-muted-foreground">Nog geen check-in data beschikbaar</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={lineChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 5]} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="Slaap" stroke="#8b5cf6" strokeWidth={2} />
                <Line type="monotone" dataKey="Spanning" stroke="#f97316" strokeWidth={2} />
                <Line type="monotone" dataKey="Energie" stroke="#22c55e" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Mood Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Mood overzicht (30 dagen)</CardTitle>
          </CardHeader>
          <CardContent>
            {moodPieData.length === 0 ? (
              <div className="h-48 flex items-center justify-center">
                <p className="text-muted-foreground">Nog geen mood data beschikbaar</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={moodPieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name}: ${entry.value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {moodPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Fun With List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Met wie had je lol?
            </CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.funWithTopList && metrics.funWithTopList.length > 0 ? (
              <div className="space-y-2">
                {metrics.funWithTopList.map((item: { label: string; count: number }, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                  >
                    <span className="text-sm font-medium">{item.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {item.count}x genoemd
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nog geen 'lol met' data beschikbaar
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
