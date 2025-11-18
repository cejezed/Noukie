import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Brain, Calendar, TrendingUp, Frown, AlertCircle, Battery, Moon, Zap, Users, Trophy, BookOpen, Activity, LogIn, Target, Award } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from "recharts";

interface ChildDashboardProps {
  child: any;
  onBack: () => void;
}

export default function ChildDashboard({ child, onBack }: ChildDashboardProps) {
  const childId = child.child?.id;

  // Fetch mental data
  const { data: mentalCheckins, isLoading: checkinsLoading } = useQuery({
    queryKey: ['/api/parent/child', childId, 'mental-checkins'],
    enabled: !!childId,
  });

  const { data: mentalMetrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['/api/parent/child', childId, 'mental-metrics'],
    enabled: !!childId,
  });

  // Fetch progress data (quiz, study, usage)
  const { data: quizMetrics, isLoading: quizLoading } = useQuery({
    queryKey: ['/api/parent/child', childId, 'quiz-metrics'],
    enabled: !!childId,
  });

  const { data: studyMetrics, isLoading: studyLoading } = useQuery({
    queryKey: ['/api/parent/child', childId, 'study-metrics'],
    enabled: !!childId,
  });

  const { data: usageMetrics, isLoading: usageLoading } = useQuery({
    queryKey: ['/api/parent/child', childId, 'usage-metrics'],
    enabled: !!childId,
  });

  // Fetch tasks and schedule
  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ['/api/parent/child', childId, 'tasks'],
    enabled: !!childId,
  });

  const { data: schedule, isLoading: scheduleLoading } = useQuery({
    queryKey: ['/api/parent/child', childId, 'schedule'],
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

      <Tabs defaultValue="voortgang" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="voortgang">
            <TrendingUp className="w-4 h-4 mr-2" />
            Voortgang
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

        {/* VOORTGANG TAB */}
        <TabsContent value="voortgang" className="space-y-6">
          {/* A. Taken & Planning Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Taken & Planning</h3>
            {tasksLoading || scheduleLoading ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto" />
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-lg bg-blue-50">
                        <Target className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Open taken</p>
                        <p className="text-2xl font-bold">
                          {tasks?.filter((t: any) => t.status === 'todo').length || 0}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-lg bg-green-50">
                        <Award className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Voltooide taken</p>
                        <p className="text-2xl font-bold">
                          {tasks?.filter((t: any) => t.status === 'done').length || 0}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-lg bg-purple-50">
                        <Calendar className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Rooster items</p>
                        <p className="text-2xl font-bold">{schedule?.length || 0}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>

          {/* B. Toets & Leeractiviteit Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Toets & Leeractiviteit</h3>
            {quizLoading || studyLoading ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto" />
                </CardContent>
              </Card>
            ) : quizMetrics && studyMetrics ? (
              <>
                {/* Quiz Metrics Tiles */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-3 rounded-lg bg-indigo-50">
                          <Trophy className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Toetsen (7d)</p>
                          <p className="text-2xl font-bold">{quizMetrics.quizzesCompletedLast7d}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-3 rounded-lg bg-cyan-50">
                          <TrendingUp className="w-5 h-5 text-cyan-600" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Gem. score</p>
                          <p className="text-2xl font-bold">{quizMetrics.avgQuizScoreLast7d}%</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-3 rounded-lg bg-emerald-50">
                          <Award className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Beste score</p>
                          <p className="text-2xl font-bold">{quizMetrics.bestQuizScoreLast7d}%</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-3 rounded-lg bg-amber-50">
                          <BookOpen className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Studie sessies (7d)</p>
                          <p className="text-2xl font-bold">{studyMetrics.studySessionsLast7d}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Subject Performance Table */}
                {quizMetrics.subjectsMostPracticedLast30d && quizMetrics.subjectsMostPracticedLast30d.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Meest geoefende vakken (laatste 30 dagen)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {quizMetrics.subjectsMostPracticedLast30d.map((item: { subject: string; count: number }, idx: number) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold">
                                {idx + 1}
                              </div>
                              <span className="font-medium">{item.subject}</span>
                            </div>
                            <span className="text-sm text-muted-foreground">
                              {item.count} {item.count === 1 ? 'toets' : 'toetsen'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-muted-foreground">Geen toets gegevens beschikbaar</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* C. Appgebruik Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Appgebruik</h3>
            {usageLoading ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto" />
                </CardContent>
              </Card>
            ) : usageMetrics ? (
              <>
                {/* Usage Metrics Tiles */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-3 rounded-lg bg-violet-50">
                          <LogIn className="w-5 h-5 text-violet-600" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Logins (7d)</p>
                          <p className="text-2xl font-bold">{usageMetrics.loginsLast7d}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-3 rounded-lg bg-pink-50">
                          <Activity className="w-5 h-5 text-pink-600" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Actieve dagen</p>
                          <p className="text-2xl font-bold">{usageMetrics.activeDaysLast7d}/7</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="md:col-span-2">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-3 rounded-lg bg-slate-50">
                          <Calendar className="w-5 h-5 text-slate-600" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Laatst actief</p>
                          <p className="text-lg font-bold">
                            {usageMetrics.lastActiveAt
                              ? new Date(usageMetrics.lastActiveAt).toLocaleDateString('nl-NL', {
                                  day: 'numeric',
                                  month: 'long',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : 'Nooit'}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Activity Heatmap */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Activiteit laatste 30 dagen</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {usageMetrics.dailyActivityLast30d && usageMetrics.dailyActivityLast30d.length > 0 ? (
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={usageMetrics.dailyActivityLast30d}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="date"
                            tick={{ fontSize: 10 }}
                            tickFormatter={(value) => {
                              const date = new Date(value);
                              return `${date.getDate()}/${date.getMonth() + 1}`;
                            }}
                          />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip
                            labelFormatter={(value) =>
                              new Date(value).toLocaleDateString('nl-NL', {
                                day: 'numeric',
                                month: 'long',
                              })
                            }
                            formatter={(value: any) => [`${value} activiteiten`, 'Aantal']}
                          />
                          <Bar dataKey="count" fill="#8b5cf6" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        Geen activiteitsgegevens beschikbaar
                      </p>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-muted-foreground">Geen gebruiksgegevens beschikbaar</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ROOSTER TAB */}
        <TabsContent value="rooster" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Rooster</CardTitle>
            </CardHeader>
            <CardContent>
              {scheduleLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto" />
                </div>
              ) : schedule && schedule.length > 0 ? (
                <div className="space-y-2">
                  {schedule.map((item: any) => (
                    <div key={item.id} className="p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{item.title || item.kind}</p>
                          <p className="text-sm text-muted-foreground">
                            {item.startTime} - {item.endTime}
                          </p>
                        </div>
                        <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                          {item.dayOfWeek ? `Dag ${item.dayOfWeek}` : item.date}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">Geen rooster items</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* MENTAAL TAB */}
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

  const lineChartData = checkins.map((c) => ({
    date: new Date(c.date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }),
    Slaap: c.sleepScore,
    Spanning: c.stressScore,
    Energie: c.energyScore,
  }));

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

// Missing icon imports fix
import { CheckSquare } from "lucide-react";
