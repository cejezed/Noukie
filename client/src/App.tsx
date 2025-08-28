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
import Help from "@/pages/Help";
import ParentDashboard from "@/pages/ParentDashboard";
import NotFound from "@/pages/not-found";

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
        <Route path="/planning" component={Planning} />
        <Route path="/rooster" component={Rooster} />
        <Route path="/help" component={Help} />
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
