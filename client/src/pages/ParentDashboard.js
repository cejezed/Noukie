import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, User, Calendar, BookOpen, CheckCircle2, Info } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import ParentIntroModal from "@/components/ParentIntroModal";
export default function ParentDashboard() {
    const { user } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [showAddChild, setShowAddChild] = useState(false);
    const [showIntroModal, setShowIntroModal] = useState(false);
    const [hasSeenIntro, setHasSeenIntro] = useState(false);
    const [childData, setChildData] = useState({
        email: "",
        name: "",
    });
    // Check if this is the first time visiting the parent dashboard
    useEffect(() => {
        const hasSeenIntroKey = `hasSeenParentIntro_${user?.id}`;
        const hasSeenBefore = localStorage.getItem(hasSeenIntroKey);
        if (!hasSeenBefore && user?.id) {
            // First time visit - show intro automatically
            setShowIntroModal(true);
            setHasSeenIntro(false);
        }
        else {
            setHasSeenIntro(true);
        }
    }, [user?.id]);
    // Handle intro modal close
    const handleIntroModalClose = (open) => {
        setShowIntroModal(open);
        if (!open && user?.id) {
            // Mark as seen when modal is closed
            const hasSeenIntroKey = `hasSeenParentIntro_${user?.id}`;
            localStorage.setItem(hasSeenIntroKey, 'true');
            setHasSeenIntro(true);
        }
    };
    // Fetch children relationships
    const { data: children, isLoading } = useQuery({
        queryKey: ['/api/parent', user?.id, 'children'],
        enabled: !!user?.id,
    });
    // Add child mutation
    const addChildMutation = useMutation({
        mutationFn: async (childInfo) => {
            return await apiRequest('POST', '/api/parent/add-child', {
                parentId: user?.id,
                childEmail: childInfo.childEmail,
                childName: childInfo.childName,
            });
        },
        onSuccess: () => {
            toast({
                title: "Kind toegevoegd",
                description: "Je kind ontvangt een bevestigingsverzoek.",
            });
            setChildData({ email: "", name: "" });
            setShowAddChild(false);
            queryClient.invalidateQueries({ queryKey: ['/api/parent'] });
        },
        onError: (error) => {
            toast({
                title: "Kon kind niet toevoegen",
                description: error.message || "Controleer het emailadres en probeer opnieuw.",
                variant: "destructive",
            });
        }
    });
    const handleAddChild = (e) => {
        e.preventDefault();
        if (!childData.email.trim() || !childData.name.trim()) {
            toast({
                title: "Vul alle velden in",
                description: "Voer zowel de naam als het emailadres van je kind in.",
                variant: "destructive",
            });
            return;
        }
        addChildMutation.mutate({
            childEmail: childData.email.trim(),
            childName: childData.name.trim(),
        });
    };
    const getStatusBadge = (isConfirmed) => {
        return isConfirmed ? (_jsxs(Badge, { variant: "default", className: "gap-1", children: [_jsx(CheckCircle2, { className: "w-3 h-3" }), "Bevestigd"] })) : (_jsx(Badge, { variant: "secondary", children: "Wacht op bevestiging" }));
    };
    return (_jsxs("div", { className: "p-6 space-y-6", "data-testid": "parent-dashboard", children: [_jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-3 mb-2", children: [_jsx("h2", { className: "text-2xl font-semibold", children: "Mijn kinderen" }), _jsxs(Button, { size: "sm", variant: "ghost", className: "h-8 w-8 p-0 text-muted-foreground hover:text-primary relative", onClick: () => setShowIntroModal(true), "data-testid": "button-parent-intro", children: [_jsx(Info, { className: "w-4 h-4" }), !hasSeenIntro && (_jsx("div", { className: "absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full border-2 border-white animate-pulse" }))] })] }), _jsx("p", { className: "text-muted-foreground", children: "Voeg je kinderen toe om hun voortgang te volgen" })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsx(CardTitle, { className: "text-lg", children: "Kind toevoegen" }), !showAddChild && (_jsxs(Button, { onClick: () => setShowAddChild(true), size: "sm", "data-testid": "button-add-child", children: [_jsx(Plus, { className: "w-4 h-4 mr-2" }), "Voeg kind toe"] }))] }) }), showAddChild && (_jsx(CardContent, { children: _jsxs("form", { onSubmit: handleAddChild, className: "space-y-4", children: [_jsxs("div", { children: [_jsx(Label, { htmlFor: "child-name", children: "Naam van je kind" }), _jsx(Input, { id: "child-name", type: "text", value: childData.name, onChange: (e) => setChildData(prev => ({ ...prev, name: e.target.value })), placeholder: "Volledige naam", required: true, "data-testid": "input-child-name" })] }), _jsxs("div", { children: [_jsx(Label, { htmlFor: "child-email", children: "Emailadres van je kind" }), _jsx(Input, { id: "child-email", type: "email", value: childData.email, onChange: (e) => setChildData(prev => ({ ...prev, email: e.target.value })), placeholder: "kind@example.com", required: true, "data-testid": "input-child-email" }), _jsx("p", { className: "text-xs text-muted-foreground mt-1", children: "Dit moet het emailadres zijn waarmee je kind zich heeft geregistreerd" })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { type: "submit", disabled: addChildMutation.isPending, "data-testid": "button-submit-add-child", children: addChildMutation.isPending ? "Bezig..." : "Toevoegen" }), _jsx(Button, { type: "button", variant: "outline", onClick: () => {
                                                setShowAddChild(false);
                                                setChildData({ email: "", name: "" });
                                            }, "data-testid": "button-cancel-add-child", children: "Annuleren" })] })] }) }))] }), _jsx("div", { className: "space-y-4", children: isLoading ? (_jsx(Card, { children: _jsxs(CardContent, { className: "p-6 text-center", children: [_jsx("div", { className: "animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto" }), _jsx("p", { className: "text-muted-foreground mt-2", children: "Kinderen laden..." })] }) })) : children && Array.isArray(children) && children.length > 0 ? (children.map((childData) => (_jsx(Card, { children: _jsxs(CardContent, { className: "p-6", children: [_jsxs("div", { className: "flex items-start justify-between", children: [_jsxs("div", { className: "flex items-start gap-3", children: [_jsx("div", { className: "w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center", children: _jsx(User, { className: "w-6 h-6 text-primary" }) }), _jsxs("div", { children: [_jsx("h3", { className: "font-semibold", children: childData.relationship.childName }), _jsx("p", { className: "text-sm text-muted-foreground", children: childData.relationship.childEmail }), childData.child && (_jsxs("div", { className: "flex items-center gap-2 mt-2 text-sm text-muted-foreground", children: [_jsx(BookOpen, { className: "w-4 h-4" }), childData.child.educationLevel?.toUpperCase(), " - Klas ", childData.child.grade] }))] })] }), _jsx("div", { className: "text-right", children: getStatusBadge(childData.relationship.isConfirmed) })] }), childData.relationship.isConfirmed && childData.child && (_jsx("div", { className: "mt-4 pt-4 border-t flex gap-2", children: _jsxs(Button, { size: "sm", variant: "outline", onClick: () => {
                                        // TODO: Navigate to child's tasks view
                                        toast({
                                            title: "Binnenkort beschikbaar",
                                            description: "Bekijk taken functionaliteit wordt nog ontwikkeld."
                                        });
                                    }, children: [_jsx(Calendar, { className: "w-4 h-4 mr-2" }), "Taken bekijken"] }) }))] }) }, childData.relationship.id)))) : (_jsx(Card, { children: _jsxs(CardContent, { className: "p-6 text-center", children: [_jsx(User, { className: "w-12 h-12 text-muted-foreground mx-auto mb-4" }), _jsx("h3", { className: "font-semibold mb-2", children: "Nog geen kinderen toegevoegd" }), _jsx("p", { className: "text-muted-foreground mb-4", children: "Voeg je kinderen toe om hun huiswerk voortgang te volgen" }), _jsxs(Button, { onClick: () => setShowAddChild(true), "data-testid": "button-first-add-child", children: [_jsx(Plus, { className: "w-4 h-4 mr-2" }), "Eerste kind toevoegen"] })] }) })) }), _jsx(ParentIntroModal, { open: showIntroModal, onOpenChange: handleIntroModalClose })] }));
}
