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
import PlanningTemp from "@/pages/PlanningTemp";
import Rooster from "@/pages/Rooster";
import LeerChat from "@/pages/LeerChat";
import Instellingen from "@/pages/Instellingen";
import ParentDashboard from "@/pages/ParentDashboard";
import NotFound from "@/pages/not-found";
import MentalPage from "@/pages/Mental";
import { supabase } from "@/lib/supabase";

function AuthenticatedApp() {
  const { user, loading } = useAuth();

  // ✔ Eerst getSession; alleen getUser() als er een sessie is
  React.useEffect(() => {
    if (loading) return;
    (async () => {
      const { data: sessionData, error: sessErr } = await supabase.auth.getSession();
      console.log("🪪 getSession ->", sessionData?.session?.user?.id ?? null, sessErr ?? null);

      if (!sessionData.session) {
        console.log("⏳ Nog geen sessie beschikbaar; getUser() overslaan.");
        return;
      }

      const { data: { user: u }, error } = await supabase.auth.getUser();
      console.log("🔎 Supabase auth.getUser ->", u, error);
    })();
  }, [loading]);

  // ✔ Auth events (handig bij login/logout/refresh)
  React.useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("🔔 auth event:", event, "user:", session?.user?.id ?? null);
    });
    return () => {
      // @ts-ignore: types wisselen per sdk-versie
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

  if (!user) {
    return <Login />;
  }

  // Parent interface
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

  // Student interface
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Vandaag} />
        <Route path="/rooster" component={PlanningTemp} />
        <Route path="/mental" component={MentalPage} />
        <Route path="/toevoegen" component={Rooster} />
        <Route path="/help" component={LeerChat} />
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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
