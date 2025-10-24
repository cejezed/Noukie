import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as Icons from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
export default function Layout({ children }) {
    const [location] = useLocation();
    const { user, signOut } = useAuth();
    const tabs = [
        { id: "vandaag", label: "Vandaag", icon: Icons.Home, path: "/" },
        { id: "planning", label: "Planning", icon: Icons.Calendar, path: "/planning" },
        { id: "mental", label: "Mentaal", icon: Icons.Brain ?? Icons.HelpCircle, path: "/mental" },
        { id: "uitleg", label: "Uitleg", icon: Icons.HelpCircle, path: "/LeerChat" },
        { id: "archief", label: "archief", icon: Icons.CalendarCheck ?? Icons.Calendar, path: "/ChatGeschiedenis" },
        { id: "instellingen", label: "Instellingen", icon: Icons.Settings, path: "/instellingen" },
    ];
    const isParent = user?.user_metadata?.role === "parent";
    // Eén plek waar je de container-breedte beheert (page + bottom-nav gelijk houden)
    const containerWidths = "w-full mx-auto max-w-md sm:max-w-2xl lg:max-w-5xl xl:max-w-7xl px-3 sm:px-4 md:px-6 lg:px-8";
    return (_jsxs("div", { className: "min-h-screen bg-slate-50", children: [_jsx("header", { className: "bg-primary text-primary-foreground sticky top-0 z-50", children: _jsx("div", { className: `${containerWidths} py-3`, children: _jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsx("div", { className: "w-28 h-14 bg-white rounded-sm flex items-center justify-center p-1 shrink-0", children: _jsx("img", { src: "/noukie-logo.png", alt: "Noukie Logo", className: "w-full h-full object-contain" }) }), _jsxs("div", { className: "text-center flex-1 mx-2", children: [_jsxs("h1", { className: "text-lg font-semibold", children: ["Hi ", user?.user_metadata?.name || "Anouk", "! \uD83D\uDC4B"] }), _jsx("p", { className: "text-sm text-primary-foreground/80", children: isParent ? "Ouder dashboard" : "Klaar voor vandaag?" })] }), _jsx(Button, { variant: "ghost", size: "icon", onClick: () => signOut(), className: "text-primary-foreground hover:bg-primary/20", "data-testid": "button-logout", title: "Uitloggen", children: _jsx("svg", { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", d: "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" }) }) })] }) }) }), _jsx("main", { className: `${containerWidths} ${isParent ? "pb-6" : "pb-24"}`, "data-testid": "main-content", children: children }), !isParent && (_jsx("nav", { className: "fixed bottom-0 left-0 right-0 bg-card border-t border-border", "data-testid": "bottom-navigation", children: _jsx("div", { className: `${containerWidths}`, children: _jsx("div", { className: "grid grid-cols-6 gap-0", children: tabs.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = location === tab.path;
                            return (_jsx(Link, { href: tab.path, children: _jsx("div", { className: "w-full flex justify-center", children: _jsxs("button", { className: `relative flex flex-col items-center justify-center py-3 px-2 transition-colors ${isActive ? "text-primary" : "text-muted-foreground"}`, "data-testid": `tab-${tab.id}`, "aria-current": isActive ? "page" : undefined, title: tab.label, children: [_jsx(Icon, { className: "w-5 h-5 mb-1" }), _jsx("span", { className: "text-xs font-medium", children: tab.label }), isActive && _jsx("div", { className: "tab-indicator" })] }) }) }, tab.id));
                        }) }) }) }))] }));
}
