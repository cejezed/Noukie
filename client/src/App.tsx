import * as React from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Vandaag from "@/pages/Vandaag";
import Rooster from "@/pages/Rooster";
import PlanningTemp from "@/pages/PlanningTemp"; // ← alleen als je deze pagina wilt tonen
import LeerChat from "@/pages/LeerChat";
import Instellingen from "@/pages/Instellingen";
import ParentDashboard from "@/pages/ParentDashboard";
import NotFound from "@/pages/not-found";
import MentalPage from "@/pages/Mental";
import { supabase } from "@/lib/supabase";

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
      // @ts-ignore
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

  // Student-interface
  return (
    <Layout>
   <Switch>
  <Route path="/" component={Vandaag} />
  <Route path="/rooster" component={Rooster} />
  <Route path="/mental" component={MentalPage} />
  <Route path="/help" component={LeerChat} />
  <Route path="/planning" component={PlanningTemp} />
  <Route path="/instellingen" component={Instellingen} />
  <Route component={NotFound} />
</Switch>
    </Layout>
  );
}

function Router() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
