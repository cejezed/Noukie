import * as React from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "./components/ui/toaster";
import { TooltipProvider } from "./components/ui/tooltip";
import Layout from "./components/Layout";
import { useAuth } from "./lib/auth";
import { useTheme } from "./hooks/use-theme";
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
import Leren from "./pages/Leren";
import LerenAdmin from "./pages/LerenAdmin";

// ✅ NIEUW
import Toets from "./pages/Toets";
import StudyPlay from "./pages/study/StudyPlay";
import AdminQuiz from "./pages/study/AdminQuiz";
import { ErrorBoundary } from "./components/dev/ErrorBoundary";

function AuthenticatedApp() {
  const { user, loading } = useAuth();

  // Load user's theme preference on app start
  useTheme();

  // sessie debug/keepalive
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

  // Student-interface — volgorde volgens jouw wens
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

       <Route path="/leren" component={Leren} />
<Route path="/leren/admin" component={LerenAdmin} />


        {/* 5) Toets (lijst) */}
        <Route path="/toets" component={Toets} />

        {/* 5b) Toetsspeler (deeplink) */}
        <Route path="/toets/spelen" component={StudyPlay} />

        {/* Admin voor toetsen (voor jou); beide paden werken */}
        <Route path="/study/admin" component={AdminQuiz} />
        <Route path="/toets/admin" component={AdminQuiz} />

        {/* 6) Instellingen */}
        <Route path="/instellingen" component={Instellingen} />

        {/* (optioneel) Rooster - als je ‘m weer zichtbaar wilt maken */}
        {/* <Route path="/rooster" component={Rooster} /> */}

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
        <ErrorBoundary>
          <AuthenticatedApp />
        </ErrorBoundary>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
