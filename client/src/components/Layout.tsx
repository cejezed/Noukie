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
    <div className="min-h-screen">
      {/* Header with Glass Effect */}
      <header className="glass sticky top-0 z-50 border-b-0">
        <div className={`${containerWidths} py-3`}>
          <div className="flex items-center justify-between gap-3">
            <div className="w-28 h-14 bg-white/90 backdrop-blur-sm rounded-xl flex items-center justify-center p-1 shrink-0 shadow-sm">
              <img
                src="/noukie-logo.png"
                alt="Noukie Logo"
                className="w-full h-full object-contain"
              />
            </div>

            <div className="text-center flex-1 mx-2">
              <h1 className="text-lg font-semibold text-white">
                Hi {user?.user_metadata?.name || "Anouk"}! 👋
              </h1>
              <p className="text-sm text-white/80">
                {isParent ? "Ouder dashboard" : "Klaar voor vandaag?"}
              </p>
            </div>

            <div className="flex gap-2">
              {!isParent && (
                <Link href="/instellingen">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/20"
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
                className="text-white hover:bg-white/20"
                data-testid="button-logout"
                title="Uitloggen"
              >
                <Icons.LogOut className="w-6 h-6" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className={`${containerWidths} pt-6 ${isParent ? "pb-6" : "pb-24"}`} data-testid="main-content">
        {children}
      </main>

      {/* Bottom Navigation with Glass Effect */}
      {!isParent && (
        <nav
          className="fixed bottom-4 left-4 right-4 glass rounded-2xl border border-white/10 shadow-lg z-50"
          data-testid="bottom-navigation"
        >
          <div className="max-w-md mx-auto px-2">
            <div className="flex justify-between items-center">
              {tabs.map((tab) => {
                // Show fewer tabs on mobile or handle overflow if needed. 
                // For now, rendering all but checking overflow might be needed.
                // Given the design, maybe we only show main ones? 
                // The original code showed all in a grid. Let's keep the grid but make it fit.
                // Actually, 8 tabs is a lot for a bottom bar. 
                // Let's stick to the original grid logic but styled better.
                return null;
              })}
              {/* Re-implementing the grid logic properly inside the glass container */}
              <div className="grid grid-cols-8 gap-0 w-full">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = location === tab.path;

                  return (
                    <Link key={tab.id} href={tab.path}>
                      <div className="w-full flex justify-center">
                        <button
                          className={`relative flex flex-col items-center justify-center py-3 px-1 transition-all duration-200 ${isActive ? "text-accent scale-110" : "text-white/60 hover:text-white/90"
                            }`}
                          data-testid={`tab-${tab.id}`}
                          aria-current={isActive ? "page" : undefined}
                          title={tab.label}
                        >
                          <Icon className="w-5 h-5 mb-1" />
                          {/* Hide label on small screens if too crowded, or keep small */}
                          {/* <span className="text-[10px] font-medium truncate max-w-full">{tab.label}</span> */}
                          {isActive && (
                            <div className="absolute -bottom-1 w-1 h-1 bg-accent rounded-full shadow-[0_0_8px_var(--accent)]" />
                          )}
                        </button>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </nav>
      )}
    </div>
  );
}
