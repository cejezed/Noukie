import { Home, Calendar, Clock, HelpCircle } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { user, signOut } = useAuth();

  const tabs = [
    { id: "vandaag", label: "Vandaag", icon: Home, path: "/" },
    { id: "planning", label: "Planning", icon: Calendar, path: "/planning" },
    { id: "rooster", label: "Rooster", icon: Clock, path: "/rooster" },
    { id: "help", label: "Uitleg", icon: HelpCircle, path: "/help" },
  ];

  return (
    <div className="max-w-md mx-auto bg-white shadow-xl min-h-screen relative" data-testid="app-container">
      {/* Header */}
      <header className="bg-primary text-primary-foreground p-4 sticky top-0 z-50" data-testid="header">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-16 h-8 bg-white rounded-sm flex items-center justify-center p-1">
              <img 
                src="/noukie-logo.png" 
                alt="Noukie Logo" 
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Huiswerkcoach Anouk</h1>
              <p className="text-sm text-primary-foreground/80">
                {user?.user_metadata?.role === "parent" ? "Ouder" : "Student"}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => signOut()}
            className="text-primary-foreground hover:bg-primary/20"
            data-testid="button-logout"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="pb-20" data-testid="main-content">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-md bg-card border-t border-border" data-testid="bottom-navigation">
        <div className="grid grid-cols-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = location === tab.path;
            
            return (
              <Link key={tab.id} href={tab.path}>
                <button
                  className={`relative flex flex-col items-center justify-center py-3 px-2 transition-colors text-center ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}
                  data-testid={`tab-${tab.id}`}
                >
                  <Icon className="w-5 h-5 mb-1" />
                  <span className="text-xs font-medium">{tab.label}</span>
                  {isActive && (
                    <div className="tab-indicator" />
                  )}
                </button>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
