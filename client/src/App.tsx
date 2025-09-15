import * as React from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "./components/ui/toaster";           // ← Gewijzigd
import { TooltipProvider } from "./components/ui/tooltip";   // ← Gewijzigd
import Layout from "./components/Layout";                    // ← Gewijzigd
import { useAuth } from "./lib/auth";                        // ← Gewijzigd
import Login from "./pages/Login";                           // ← Gewijzigd
import Vandaag from "./pages/Vandaag";                       // ← Gewijzigd
import Rooster from "./pages/Rooster";                       // ← Gewijzigd
import Planning from "./pages/Planning";                     // ← Gewijzigd
import LeerChat from "./pages/LeerChat";                     // ← Gewijzigd
import Instellingen from "./pages/Instellingen";             // ← Gewijzigd
import ParentDashboard from "./pages/ParentDashboard";       // ← Gewijzigd
import NotFound from "./pages/not-found";                    // ← Gewijzigd
import MentalPage from "./pages/Mental";                     // ← Gewijzigd
import ChatGeschiedenis from "./pages/ChatGeschiedenis";     // ← Gewijzigd
import { supabase } from "./lib/supabase";                   // ← Gewijzigd

function AuthenticatedApp() {
  const { user, loading } = useAuth();

  // Alleen voor debug/logs; verwijderd als je wilt
  React.useEffect(() => {
    if (loading) return;
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;
      await supabase.auth.getUser();
    })();
  }, [loading]);

  React.useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(() => {});
    return () => {
      // @ts-ignore sdk variaties
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" data-testid="loading-screen">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return <Login />;

  // Ouder-interface
  if (user.user_metadata?.role === "parent") {
    return (
      <Layout>
        <Switch>
          <Route path="/" component={ParentDashboard} />
          <Route path="/mental" component={MentalPage} />
          <Route component={NotFound} />
        </Switch>
      </Layout>
    );
  }

  // Student-interface — VOLGORDE EXACT VOLGENS JOUW WENS
  return (
    <Layout>
    <Switch>
    {/* 1) Vandaag */}
    <Route path="/" exact component={Vandaag} />

    {/* 2) Planning */}
    <Route path="/planning" component={Planning} />

    {/* 3) Mentaal */}
    <Route path="/mental" component={MentalPage} />

    {/* 4) Uitleg (LeerChat) */}
    <Route path="/leerchat" component={LeerChat} />

    {/* 5) Archief (ChatGeschiedenis) */}
    <Route path="/chatgeschiedenis" component={ChatGeschiedenis} />

    {/* 6) Instellingen */}
    <Route path="/instellingen" component={Instellingen} />

    {/* Fallback */}
    <Route component={NotFound} />
  </Switch>
    </Layout>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AuthenticatedApp />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
