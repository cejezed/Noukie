import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "./components/ui/toaster"; // ← Gewijzigd
import { TooltipProvider } from "./components/ui/tooltip"; // ← Gewijzigd
import Layout from "./components/Layout"; // ← Gewijzigd
import { useAuth } from "./lib/auth"; // ← Gewijzigd
import Login from "./pages/Login"; // ← Gewijzigd
import Vandaag from "./pages/Vandaag"; // ← Gewijzigd
import Planning from "./pages/Planning"; // ← Gewijzigd
import LeerChat from "./pages/LeerChat"; // ← Gewijzigd
import Instellingen from "./pages/Instellingen"; // ← Gewijzigd
import ParentDashboard from "./pages/ParentDashboard"; // ← Gewijzigd
import NotFound from "./pages/not-found"; // ← Gewijzigd
import MentalPage from "./pages/Mental"; // ← Gewijzigd
import ChatGeschiedenis from "./pages/ChatGeschiedenis"; // ← Gewijzigd
import { supabase } from "./lib/supabase"; // ← Gewijzigd
function AuthenticatedApp() {
    const { user, loading } = useAuth();
    // Alleen voor debug/logs; verwijderd als je wilt
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
    // Student-interface — VOLGORDE EXACT VOLGENS JOUW WENS
    return (_jsx(Layout, { children: _jsxs(Switch, { children: [_jsx(Route, { path: "/", exact: true, component: Vandaag }), _jsx(Route, { path: "/planning", component: Planning }), _jsx(Route, { path: "/mental", component: MentalPage }), _jsx(Route, { path: "/leerchat", component: LeerChat }), _jsx(Route, { path: "/chatgeschiedenis", component: ChatGeschiedenis }), _jsx(Route, { path: "/instellingen", component: Instellingen }), _jsx(Route, { component: NotFound })] }) }));
}
export default function App() {
    return (_jsx(QueryClientProvider, { client: queryClient, children: _jsxs(TooltipProvider, { children: [_jsx(Toaster, {}), _jsx(AuthenticatedApp, {})] }) }));
}
