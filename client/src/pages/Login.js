import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import * as React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
export default function Login() {
    const { signIn, signUp } = useAuth();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [loginData, setLoginData] = useState({
        email: "",
        password: "",
    });
    const [signUpData, setSignUpData] = useState({
        email: "",
        password: "",
        confirmPassword: "",
        name: "",
        role: "student",
        educationLevel: "",
        grade: "",
    });
    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await signIn(loginData.email, loginData.password);
            toast({
                title: "Welkom terug!",
                description: "Je bent succesvol ingelogd.",
            });
        }
        catch (error) {
            toast({
                title: "Inloggen mislukt",
                description: error.message || "Controleer je gegevens en probeer opnieuw.",
                variant: "destructive",
            });
        }
        finally {
            setIsLoading(false);
        }
    };
    const handleSignUp = async (e) => {
        e.preventDefault();
        if (signUpData.password !== signUpData.confirmPassword) {
            toast({
                title: "Wachtwoorden komen niet overeen",
                description: "Controleer je wachtwoorden en probeer opnieuw.",
                variant: "destructive",
            });
            return;
        }
        if (signUpData.password.length < 6) {
            toast({
                title: "Wachtwoord te kort",
                description: "Je wachtwoord moet minimaal 6 karakters lang zijn.",
                variant: "destructive",
            });
            return;
        }
        if (signUpData.role === 'student' && (!signUpData.educationLevel || !signUpData.grade)) {
            toast({
                title: "Ontbrekende gegevens",
                description: "Studenten moeten hun schoolniveau en jaargang invullen.",
                variant: "destructive",
            });
            return;
        }
        setIsLoading(true);
        try {
            await signUp(signUpData.email, signUpData.password, signUpData.name, signUpData.role, signUpData.role === 'student' ? signUpData.educationLevel : undefined, signUpData.role === 'student' ? signUpData.grade : undefined);
            toast({
                title: "Account aangemaakt!",
                description: "Check je email voor verificatie en log daarna in.",
            });
        }
        catch (error) {
            toast({
                title: "Registratie mislukt",
                description: error.message || "Er ging iets mis bij het aanmaken van je account.",
                variant: "destructive",
            });
        }
        finally {
            setIsLoading(false);
        }
    };
    return (_jsx("div", { className: "min-h-screen bg-background flex items-center justify-center p-4", "data-testid": "login-page", children: _jsxs(Card, { className: "w-full max-w-md", children: [_jsxs(CardHeader, { className: "text-center", children: [_jsx("div", { className: "w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 p-2", children: _jsx("img", { src: "/noukie-logo.png", alt: "Noukie Logo", className: "w-full h-full object-contain" }) }), _jsx(CardTitle, { className: "text-2xl", children: "Huiswerkcoach Noukie" }), _jsx("p", { className: "text-muted-foreground", children: "Jouw persoonlijke AI huiswerkcoach - dagelijkse check-ins, taakplanning en hulp bij huiswerk" })] }), _jsx(CardContent, { children: _jsxs(Tabs, { defaultValue: "login", className: "w-full", children: [_jsxs(TabsList, { className: "grid w-full grid-cols-2", "data-testid": "auth-tabs", children: [_jsx(TabsTrigger, { value: "login", "data-testid": "tab-login", children: "Inloggen" }), _jsx(TabsTrigger, { value: "signup", "data-testid": "tab-signup", children: "Registreren" })] }), _jsx(TabsContent, { value: "login", children: _jsxs("form", { onSubmit: handleLogin, className: "space-y-4", "data-testid": "login-form", children: [_jsxs("div", { children: [_jsx(Label, { htmlFor: "login-email", children: "E-mailadres" }), _jsx(Input, { id: "login-email", type: "email", value: loginData.email, onChange: (e) => setLoginData(prev => ({ ...prev, email: e.target.value })), placeholder: "je@example.com", required: true, "data-testid": "input-login-email" })] }), _jsxs("div", { children: [_jsx(Label, { htmlFor: "login-password", children: "Wachtwoord" }), _jsx(Input, { id: "login-password", type: "password", value: loginData.password, onChange: (e) => setLoginData(prev => ({ ...prev, password: e.target.value })), required: true, "data-testid": "input-login-password" })] }), _jsx(Button, { type: "submit", className: "w-full", disabled: isLoading, "data-testid": "button-login", children: isLoading ? "Bezig met inloggen..." : "Inloggen" })] }) }), _jsx(TabsContent, { value: "signup", children: _jsxs("form", { onSubmit: handleSignUp, className: "space-y-4", "data-testid": "signup-form", children: [_jsxs("div", { children: [_jsx(Label, { htmlFor: "signup-name", children: "Naam" }), _jsx(Input, { id: "signup-name", type: "text", value: signUpData.name, onChange: (e) => setSignUpData(prev => ({ ...prev, name: e.target.value })), placeholder: "Je volledige naam", required: true, "data-testid": "input-signup-name" })] }), _jsxs("div", { children: [_jsx(Label, { htmlFor: "signup-email", children: "E-mailadres" }), _jsx(Input, { id: "signup-email", type: "email", value: signUpData.email, onChange: (e) => setSignUpData(prev => ({ ...prev, email: e.target.value })), placeholder: "je@example.com", required: true, "data-testid": "input-signup-email" })] }), _jsxs("div", { children: [_jsx(Label, { htmlFor: "signup-role", children: "Rol" }), _jsxs(Select, { value: signUpData.role, onValueChange: (value) => setSignUpData(prev => ({
                                                        ...prev,
                                                        role: value,
                                                        // Reset student fields when switching to parent
                                                        educationLevel: value === 'parent' ? "" : prev.educationLevel,
                                                        grade: value === 'parent' ? "" : prev.grade
                                                    })), children: [_jsx(SelectTrigger, { "data-testid": "select-role", children: _jsx(SelectValue, {}) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "student", children: "Student" }), _jsx(SelectItem, { value: "parent", children: "Ouder" })] })] })] }), signUpData.role === 'student' && (_jsxs(_Fragment, { children: [_jsxs("div", { children: [_jsx(Label, { htmlFor: "education-level", children: "Schoolniveau" }), _jsxs(Select, { value: signUpData.educationLevel, onValueChange: (value) => setSignUpData(prev => ({ ...prev, educationLevel: value })), children: [_jsx(SelectTrigger, { "data-testid": "select-education-level", children: _jsx(SelectValue, { placeholder: "Kies je schoolniveau" }) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "vmbo", children: "VMBO" }), _jsx(SelectItem, { value: "havo", children: "HAVO" }), _jsx(SelectItem, { value: "vwo", children: "VWO" }), _jsx(SelectItem, { value: "mbo", children: "MBO" })] })] })] }), _jsxs("div", { children: [_jsx(Label, { htmlFor: "grade", children: "Klas/Jaargang" }), _jsxs(Select, { value: signUpData.grade, onValueChange: (value) => setSignUpData(prev => ({ ...prev, grade: value })), children: [_jsx(SelectTrigger, { "data-testid": "select-grade", children: _jsx(SelectValue, { placeholder: "Kies je klas" }) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "1", children: "Klas 1" }), _jsx(SelectItem, { value: "2", children: "Klas 2" }), _jsx(SelectItem, { value: "3", children: "Klas 3" }), _jsx(SelectItem, { value: "4", children: "Klas 4" }), _jsx(SelectItem, { value: "5", children: "Klas 5" }), _jsx(SelectItem, { value: "6", children: "Klas 6" })] })] })] })] })), _jsxs("div", { children: [_jsx(Label, { htmlFor: "signup-password", children: "Wachtwoord" }), _jsx(Input, { id: "signup-password", type: "password", value: signUpData.password, onChange: (e) => setSignUpData(prev => ({ ...prev, password: e.target.value })), placeholder: "Minimaal 6 karakters", required: true, "data-testid": "input-signup-password" })] }), _jsxs("div", { children: [_jsx(Label, { htmlFor: "confirm-password", children: "Bevestig wachtwoord" }), _jsx(Input, { id: "confirm-password", type: "password", value: signUpData.confirmPassword, onChange: (e) => setSignUpData(prev => ({ ...prev, confirmPassword: e.target.value })), required: true, "data-testid": "input-confirm-password" })] }), _jsx(Button, { type: "submit", className: "w-full", disabled: isLoading, "data-testid": "button-signup", children: isLoading ? "Bezig met registreren..." : "Account aanmaken" })] }) })] }) })] }) }));
}
