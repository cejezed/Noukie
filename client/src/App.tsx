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
import Rooster from "./pages/Rooster";
import Planning from "./pages/Planning";
import LeerChat from "./pages/LeerChat";
import Instellingen from "./pages/Instellingen";
import ParentDashboard from "./pages/ParentDashboard";
import NotFound from "./pages/not-found";
import MentalPage from "./pages/Mental";
import { supabase } from "./lib/supabase";
import QuizletImport from "./pages/study/QuizletImport";

// ✅ NIEUW
import Toets from "./pages/Toets";
import StudyPlay from "./pages/study/StudyPlay";

function AuthenticatedApp() {
  const { user, loading } = useAuth();

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
      <div
        className="min-h-screen flex items-center justify-center bg-background"
        data-testid="loading-screen"
      >
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

        {/* 5) Toets (i.p.v. Archief/ChatGeschiedenis) */}
        <Route path="/toets" component={Toets} />
        {/* Speler route (directe deeplink) */}
        <Route path="/toets/spelen" component={StudyPlay} />

        {/* 6) Instellingen */}
        <Route path="/instellingen" component={Instellingen} />

        <Route path="/toets/import" component={QuizletImport} />

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
