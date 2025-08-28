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
    role: "student" as "student" | "parent",
    educationLevel: "" as "vmbo" | "havo" | "vwo" | "mbo" | "",
    grade: "",
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      await signIn(loginData.email, loginData.password);
      toast({
        title: "Welkom terug!",
        description: "Je bent succesvol ingelogd.",
      });
    } catch (error: any) {
      toast({
        title: "Inloggen mislukt",
        description: error.message || "Controleer je gegevens en probeer opnieuw.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
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
      await signUp(
        signUpData.email, 
        signUpData.password, 
        signUpData.name, 
        signUpData.role,
        signUpData.role === 'student' ? signUpData.educationLevel : undefined,
        signUpData.role === 'student' ? signUpData.grade : undefined
      );
      toast({
        title: "Account aangemaakt!",
        description: "Check je email voor verificatie en log daarna in.",
      });
    } catch (error: any) {
      toast({
        title: "Registratie mislukt",
        description: error.message || "Er ging iets mis bij het aanmaken van je account.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" data-testid="login-page">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-48 h-48 bg-white rounded-full flex items-center justify-center mx-auto mb-4 p-4">
            <img 
              src="/noukie-logo.png" 
              alt="Noukie Logo" 
              className="w-full h-full object-contain"
            />
          </div>
          <CardTitle className="text-2xl">Huiswerkcoach Noukie</CardTitle>
          <p className="text-muted-foreground">Jouw persoonlijke AI huiswerkcoach - dagelijkse voice check-ins, taakplanning en uitlegvideo's</p>
        </CardHeader>
        
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2" data-testid="auth-tabs">
              <TabsTrigger value="login" data-testid="tab-login">Inloggen</TabsTrigger>
              <TabsTrigger value="signup" data-testid="tab-signup">Registreren</TabsTrigger>
            </TabsList>
            
            {/* Login Tab */}
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4" data-testid="login-form">
                <div>
                  <Label htmlFor="login-email">E-mailadres</Label>
                  <Input
                    id="login-email"
                    type="email"
                    value={loginData.email}
                    onChange={(e) => setLoginData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="je@example.com"
                    required
                    data-testid="input-login-email"
                  />
                </div>
                
                <div>
                  <Label htmlFor="login-password">Wachtwoord</Label>
                  <Input
                    id="login-password"
                    type="password"
                    value={loginData.password}
                    onChange={(e) => setLoginData(prev => ({ ...prev, password: e.target.value }))}
                    required
                    data-testid="input-login-password"
                  />
                </div>
                
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                  data-testid="button-login"
                >
                  {isLoading ? "Bezig met inloggen..." : "Inloggen"}
                </Button>
              </form>
            </TabsContent>
            
            {/* Sign Up Tab */}
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4" data-testid="signup-form">
                <div>
                  <Label htmlFor="signup-name">Volledige naam</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    value={signUpData.name}
                    onChange={(e) => setSignUpData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Je volledige naam"
                    required
                    data-testid="input-signup-name"
                  />
                </div>
                
                <div>
                  <Label htmlFor="signup-email">E-mailadres</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    value={signUpData.email}
                    onChange={(e) => setSignUpData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="je@example.com"
                    required
                    data-testid="input-signup-email"
                  />
                </div>
                
                <div>
                  <Label htmlFor="signup-role">Rol</Label>
                  <Select
                    value={signUpData.role}
                    onValueChange={(value: "student" | "parent") => setSignUpData(prev => ({ 
                      ...prev, 
                      role: value, 
                      // Reset student fields when switching to parent
                      educationLevel: value === 'parent' ? "" : prev.educationLevel,
                      grade: value === 'parent' ? "" : prev.grade
                    }))}
                  >
                    <SelectTrigger data-testid="select-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="student">Student</SelectItem>
                      <SelectItem value="parent">Ouder</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Student-specific fields */}
                {signUpData.role === 'student' && (
                  <>
                    <div>
                      <Label htmlFor="education-level">Schoolniveau</Label>
                      <Select
                        value={signUpData.educationLevel}
                        onValueChange={(value: "vmbo" | "havo" | "vwo" | "mbo") => setSignUpData(prev => ({ ...prev, educationLevel: value }))}
                      >
                        <SelectTrigger data-testid="select-education-level">
                          <SelectValue placeholder="Kies je schoolniveau" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="vmbo">VMBO</SelectItem>
                          <SelectItem value="havo">HAVO</SelectItem>
                          <SelectItem value="vwo">VWO</SelectItem>
                          <SelectItem value="mbo">MBO</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="grade">Klas/Jaargang</Label>
                      <Select
                        value={signUpData.grade}
                        onValueChange={(value) => setSignUpData(prev => ({ ...prev, grade: value }))}
                      >
                        <SelectTrigger data-testid="select-grade">
                          <SelectValue placeholder="Kies je klas" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Klas 1</SelectItem>
                          <SelectItem value="2">Klas 2</SelectItem>
                          <SelectItem value="3">Klas 3</SelectItem>
                          <SelectItem value="4">Klas 4</SelectItem>
                          <SelectItem value="5">Klas 5</SelectItem>
                          <SelectItem value="6">Klas 6</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
                
                <div>
                  <Label htmlFor="signup-password">Wachtwoord</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    value={signUpData.password}
                    onChange={(e) => setSignUpData(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Minimaal 6 karakters"
                    required
                    data-testid="input-signup-password"
                  />
                </div>
                
                <div>
                  <Label htmlFor="confirm-password">Bevestig wachtwoord</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={signUpData.confirmPassword}
                    onChange={(e) => setSignUpData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    required
                    data-testid="input-confirm-password"
                  />
                </div>
                
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                  data-testid="button-signup"
                >
                  {isLoading ? "Bezig met registreren..." : "Account aanmaken"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
