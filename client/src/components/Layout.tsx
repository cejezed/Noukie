import * as Icons from "lucide-react";
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
    { id: "vandaag", label: "Vandaag", icon: Icons.Home, path: "/" },
    { id: "planning", label: "Planning", icon: Icons.Calendar, path: "/planning" },
    { id: "mental", label: "Mentaal", icon: Icons.Brain ?? Icons.HelpCircle, path: "/mental" },
    // ✅ Uitleg pad gecorrigeerd naar lowercase
    { id: "uitleg", label: "Uitleg", icon: Icons.HelpCircle, path: "/leerchat" },
    // ✅ Archief vervangen door Toets (quizlijst)
    { id: "toets", label: "Toets", icon: Icons.ClipboardList, path: "/toets" },
    { id: "instellingen", label: "Instellingen", icon: Icons.Settings, path: "/instellingen" },
  ];

  const isParent = user?.user_metadata?.role === "parent";

  // Eén plek waar je de container-breedte beheert (page + bottom-nav gelijk houden)
  const containerWidths =
    "w-full mx-auto max-w-md sm:max-w-2xl lg:max-w-5xl xl:max-w-7xl px-3 sm:px-4 md:px-6 lg:px-8";

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header (full-width background); inhoud in dezelfde responsive container */}
      <header className="bg-primary text-primary-foreground sticky top-0 z-50">
        <div className={`${containerWidths} py-3`}>
          <div className="flex items-center justify-between gap-3">
            <div className="w-28 h-14 bg-white rounded-sm flex items-center justify-center p-1 shrink-0">
              <img
                src="/noukie-logo.png"
                alt="Noukie Logo"
                className="w-full h-full object-contain"
              />
            </div>

            <div className="text-center flex-1 mx-2">
              <h1 className="text-lg font-semibold">
                Hi {user?.user_metadata?.name || "Anouk"}! 👋
              </h1>
              <p className="text-sm text-primary-foreground/80">
                {isParent ? "Ouder dashboard" : "Klaar voor vandaag?"}
              </p>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => signOut()}
              className="text-primary-foreground hover:bg-primary/20"
              data-testid="button-logout"
              title="Uitloggen"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </Button>
          </div>
        </div>
      </header>

      {/* Main content in dezelfde responsive container */}
      <main className={`${containerWidths} ${isParent ? "pb-6" : "pb-24"}`} data-testid="main-content">
        {children}
      </main>

      {/* Bottom Navigation - alleen voor studenten; volgt dezelfde containerbreedte */}
      {!isParent && (
        <nav
          className="fixed bottom-0 left-0 right-0 bg-card border-t border-border"
          data-testid="bottom-navigation"
        >
          <div className={`${containerWidths}`}>
            <div className="grid grid-cols-6 gap-0">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = location === tab.path;

                return (
                  <Link key={tab.id} href={tab.path}>
                    <div className="w-full flex justify-center">
                      <button
                        className={`relative flex flex-col items-center justify-center py-3 px-2 transition-colors ${
                          isActive ? "text-primary" : "text-muted-foreground"
                        }`}
                        data-testid={`tab-${tab.id}`}
                        aria-current={isActive ? "page" : undefined}
                        title={tab.label}
                      >
                        <Icon className="w-5 h-5 mb-1" />
                        <span className="text-xs font-medium">{tab.label}</span>
                        {isActive && <div className="tab-indicator" />}
                      </button>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>
      )}
    </div>
  );
}
