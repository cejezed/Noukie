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
import Planning from "@/pages/Planning";
import Rooster from "@/pages/Rooster";
// --- DEZE REGEL IS VERVANGEN ---
import LeerChat from "@/pages/LeerChat"; // Was: import Help from "@/pages/Help";
// --- EINDE VERVANGING ---
import Instellingen from "@/pages/Instellingen";
import ParentDashboard from "@/pages/ParentDashboard";
import NotFound from "@/pages/not-found";
import MentalPage from "@/pages/Mental";

function AuthenticatedApp() {
  const { user, loading } = useAuth();

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

  // Different interface for parents
  if (user.user_metadata?.role === 'parent') {
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

// Student interface (default)
return (
  <Layout>
    <Switch>
      <Route path="/" component={Vandaag} />
      <Route path="/rooster" component={Planning} />
      <Route path="/mental" component={MentalPage} />
      <Route path="/toevoegen" component={Rooster} />
      <Route path="/help" component={LeerChat} /> {/* Deze regel was al correct */}
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
