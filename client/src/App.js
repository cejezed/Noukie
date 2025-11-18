import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "./components/ui/toaster";
import { TooltipProvider } from "./components/ui/tooltip";
import Layout from "./components/Layout";
import { useAuth } from "./lib/auth";
import Login from "./pages/Login";
import Vandaag from "./pages/Vandaag";
import Planning from "./pages/Planning";
import LeerChat from "./pages/LeerChat";
import Instellingen from "./pages/Instellingen";
import ParentDashboard from "./pages/ParentDashboard";
import NotFound from "./pages/not-found";
import MentalPage from "./pages/Mental";
import { supabase } from "./lib/supabase";
import Leren from "./pages/Leren";
import LerenAdmin from "./pages/LerenAdmin";
// ✅ NIEUW
import Toets from "./pages/Toets";
import StudyPlay from "./pages/study/StudyPlay";
import AdminQuiz from "./pages/study/AdminQuiz";
import { ErrorBoundary } from "./components/dev/ErrorBoundary";
function AuthenticatedApp() {
    const { user, loading } = useAuth();
    // sessie debug/keepalive
    React.useEffect(() => {
        if (loading)
            return;
        (async () => {
            const { data: sessionData } = await supabase.auth.getSession();
            if (!sessionData.session)
                return;
            await supabase.auth.getUser();
        })();
    }, [loading]);
    React.useEffect(() => {
        const { data: sub } = supabase.auth.onAuthStateChange(() => { });
        return () => {
            // @ts-ignore sdk variaties
            sub?.subscription?.unsubscribe?.();
        };
    }, []);
    if (loading) {
        return (_jsx("div", { className: "min-h-screen flex items-center justify-center bg-background", "data-testid": "loading-screen", children: _jsx("div", { className: "animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" }) }));
    }
    if (!user)
        return _jsx(Login, {});
    // Ouder-interface
    if (user.user_metadata?.role === "parent") {
        return (_jsx(Layout, { children: _jsxs(Switch, { children: [_jsx(Route, { path: "/", component: ParentDashboard }), _jsx(Route, { path: "/mental", component: MentalPage }), _jsx(Route, { component: NotFound })] }) }));
    }
    // Student-interface — volgorde volgens jouw wens
    return (_jsx(Layout, { children: _jsxs(Switch, { children: [_jsx(Route, { path: "/", exact: true, component: Vandaag }), _jsx(Route, { path: "/planning", component: Planning }), _jsx(Route, { path: "/mental", component: MentalPage }), _jsx(Route, { path: "/leerchat", component: LeerChat }), _jsx(Route, { path: "/leren", component: Leren }), _jsx(Route, { path: "/leren/admin", component: LerenAdmin }), _jsx(Route, { path: "/toets", component: Toets }), _jsx(Route, { path: "/toets/spelen", component: StudyPlay }), _jsx(Route, { path: "/study/admin", component: AdminQuiz }), _jsx(Route, { path: "/toets/admin", component: AdminQuiz }), _jsx(Route, { path: "/instellingen", component: Instellingen }), _jsx(Route, { component: NotFound })] }) }));
}
export default function App() {
    return (_jsx(QueryClientProvider, { client: queryClient, children: _jsxs(TooltipProvider, { children: [_jsx(Toaster, {}), _jsx(ErrorBoundary, { children: _jsx(AuthenticatedApp, {}) })] }) }));
}
