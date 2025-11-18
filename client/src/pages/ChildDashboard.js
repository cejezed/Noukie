import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Brain, Calendar, CheckSquare, TrendingUp, Frown, AlertCircle, Battery, Moon, Zap, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
export default function ChildDashboard({ child, onBack }) {
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
    return (_jsxs("div", { className: "p-6 space-y-6", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsxs(Button, { variant: "ghost", size: "sm", onClick: onBack, children: [_jsx(ArrowLeft, { className: "w-4 h-4 mr-2" }), "Terug"] }), _jsxs("div", { children: [_jsx("h2", { className: "text-2xl font-semibold", children: child.relationship.childName }), _jsx("p", { className: "text-sm text-muted-foreground", children: child.relationship.childEmail })] })] }), _jsxs(Tabs, { defaultValue: "mentaal", className: "w-full", children: [_jsxs(TabsList, { className: "grid w-full grid-cols-3", children: [_jsxs(TabsTrigger, { value: "taken", children: [_jsx(CheckSquare, { className: "w-4 h-4 mr-2" }), "Taken"] }), _jsxs(TabsTrigger, { value: "rooster", children: [_jsx(Calendar, { className: "w-4 h-4 mr-2" }), "Rooster"] }), _jsxs(TabsTrigger, { value: "mentaal", children: [_jsx(Brain, { className: "w-4 h-4 mr-2" }), "Mentaal"] })] }), _jsx(TabsContent, { value: "taken", className: "space-y-4", children: _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Taken" }) }), _jsx(CardContent, { children: _jsx("p", { className: "text-muted-foreground", children: "Taken functionaliteit wordt nog ontwikkeld..." }) })] }) }), _jsx(TabsContent, { value: "rooster", className: "space-y-4", children: _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Rooster" }) }), _jsx(CardContent, { children: _jsx("p", { className: "text-muted-foreground", children: "Rooster functionaliteit wordt nog ontwikkeld..." }) })] }) }), _jsx(TabsContent, { value: "mentaal", className: "space-y-4", children: metricsLoading ? (_jsx(Card, { children: _jsxs(CardContent, { className: "p-6 text-center", children: [_jsx("div", { className: "animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto" }), _jsx("p", { className: "text-muted-foreground mt-2", children: "Mentale gegevens laden..." })] }) })) : mentalMetrics ? (_jsx(MentalTab, { metrics: mentalMetrics, checkins: mentalCheckins || [], loading: checkinsLoading })) : (_jsx(Card, { children: _jsx(CardContent, { className: "p-6 text-center", children: _jsx("p", { className: "text-muted-foreground", children: "Geen mentale check-in gegevens beschikbaar" }) }) })) })] })] }));
}
function MentalTab({ metrics, checkins, loading }) {
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
            moodCounts[c.mood]++;
        }
    });
    const moodPieData = [
        { name: 'OK', value: moodCounts.ok, color: '#22c55e' },
        { name: 'Niet lekker', value: moodCounts.niet_lekker, color: '#f59e0b' },
        { name: 'Hulp nu', value: moodCounts.hulp_nu, color: '#ef4444' },
    ].filter(d => d.value > 0);
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4", children: metricsTiles.map((tile, idx) => {
                    const Icon = tile.icon;
                    return (_jsx(Card, { children: _jsx(CardContent, { className: "p-4", children: _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: `p-3 rounded-lg ${tile.bgColor}`, children: _jsx(Icon, { className: `w-5 h-5 ${tile.color}` }) }), _jsxs("div", { children: [_jsx("p", { className: "text-sm text-muted-foreground", children: tile.label }), _jsx("p", { className: "text-2xl font-bold", children: tile.value })] })] }) }) }, idx));
                }) }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(TrendingUp, { className: "w-5 h-5" }), "Trends laatste 30 dagen"] }) }), _jsx(CardContent, { children: loading ? (_jsx("div", { className: "h-64 flex items-center justify-center", children: _jsx("div", { className: "animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" }) })) : lineChartData.length === 0 ? (_jsx("div", { className: "h-64 flex items-center justify-center", children: _jsx("p", { className: "text-muted-foreground", children: "Nog geen check-in data beschikbaar" }) })) : (_jsx(ResponsiveContainer, { width: "100%", height: 300, children: _jsxs(LineChart, { data: lineChartData, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3" }), _jsx(XAxis, { dataKey: "date", tick: { fontSize: 12 } }), _jsx(YAxis, { domain: [0, 5], tick: { fontSize: 12 } }), _jsx(Tooltip, {}), _jsx(Legend, {}), _jsx(Line, { type: "monotone", dataKey: "Slaap", stroke: "#8b5cf6", strokeWidth: 2 }), _jsx(Line, { type: "monotone", dataKey: "Spanning", stroke: "#f97316", strokeWidth: 2 }), _jsx(Line, { type: "monotone", dataKey: "Energie", stroke: "#22c55e", strokeWidth: 2 })] }) })) })] }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-4", children: [_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Mood overzicht (30 dagen)" }) }), _jsx(CardContent, { children: moodPieData.length === 0 ? (_jsx("div", { className: "h-48 flex items-center justify-center", children: _jsx("p", { className: "text-muted-foreground", children: "Nog geen mood data beschikbaar" }) })) : (_jsx(ResponsiveContainer, { width: "100%", height: 200, children: _jsxs(PieChart, { children: [_jsx(Pie, { data: moodPieData, cx: "50%", cy: "50%", labelLine: false, label: (entry) => `${entry.name}: ${entry.value}`, outerRadius: 80, fill: "#8884d8", dataKey: "value", children: moodPieData.map((entry, index) => (_jsx(Cell, { fill: entry.color }, `cell-${index}`))) }), _jsx(Tooltip, {})] }) })) })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(Users, { className: "w-5 h-5" }), "Met wie had je lol?"] }) }), _jsx(CardContent, { children: metrics.funWithTopList && metrics.funWithTopList.length > 0 ? (_jsx("div", { className: "space-y-2", children: metrics.funWithTopList.map((item, idx) => (_jsxs("div", { className: "flex items-center justify-between p-2 rounded-lg bg-muted/50", children: [_jsx("span", { className: "text-sm font-medium", children: item.label }), _jsxs("span", { className: "text-xs text-muted-foreground", children: [item.count, "x genoemd"] })] }, idx))) })) : (_jsx("p", { className: "text-sm text-muted-foreground", children: "Nog geen 'lol met' data beschikbaar" })) })] })] })] }));
}
