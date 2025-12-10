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
    { id: "vandaag", label: "", icon: Icons.Home, path: "/" },
    { id: "planning", label: "Planning", icon: Icons.Calendar, path: "/planning" },
    { id: "mental", label: "Mentaal", icon: Icons.Brain ?? Icons.HelpCircle, path: "/mental" },
    { id: "compliments", label: "💌", icon: Icons.Heart, path: "/compliments" },
    { id: "uitleg", label: "Uitleg", icon: Icons.HelpCircle, path: "/leerchat" },
    { id: "leren", label: "Leren", icon: Icons.BookOpen, path: "/leren" },
    { id: "toets", label: "Toets", icon: Icons.ClipboardList, path: "/toets" },
    { id: "games", label: "Games", icon: Icons.Gamepad2, path: "/study/games" },
  ];

  const isParent = user?.user_metadata?.role === "parent";

  const containerWidths =
    "w-full mx-auto max-w-md sm:max-w-2xl lg:max-w-5xl xl:max-w-7xl px-3 sm:px-4 md:px-6 lg:px-8";

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header (full-width background); inhoud in dezelfde responsive container */}
      <header className="bg-white border-b border-border sticky top-0 z-50 shadow-sm">
        <div className={`${containerWidths} py-3`}>
          <div className="flex items-center justify-between gap-3">
            <div className="w-28 h-14 bg-slate-50 rounded-lg flex items-center justify-center p-1 shrink-0 border border-border">
              <img
                src="/noukie-logo.png"
                alt="Noukie Logo"
                className="w-full h-full object-contain"
              />
            </div>

            <div className="text-center flex-1 mx-2">
              <h1 className="text-lg font-semibold text-foreground">
                Hi {user?.user_metadata?.name || "Anouk"}! 👋
              </h1>
              <p className="text-sm text-muted-foreground">
                {isParent ? "Ouder dashboard" : "Klaar voor vandaag?"}
              </p>
            </div>

            <div className="flex gap-2">
              {!isParent && (
                <Link href="/instellingen">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-foreground hover:bg-accent"
                    data-testid="button-settings"
                    title="Instellingen"
                  >
                    <Icons.Settings className="w-6 h-6" />
                  </Button>
                </Link>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => signOut()}
                className="text-muted-foreground hover:text-foreground hover:bg-accent"
                data-testid="button-logout"
                title="Uitloggen"
              >
                <Icons.LogOut className="w-6 h-6" />
              </Button>
            </div>
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
          className="fixed bottom-0 left-0 right-0 bg-white border-t border-border shadow-lg"
          data-testid="bottom-navigation"
        >
          <div className={`${containerWidths}`}>
            <div className="grid grid-cols-8 gap-0">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = location === tab.path;

                return (
                  <Link key={tab.id} href={tab.path}>
                    <div className="w-full flex justify-center">
                      <button
                        className={`relative flex flex-col items-center justify-center py-3 px-2 transition-colors ${isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
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
