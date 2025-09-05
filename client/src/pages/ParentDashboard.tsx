import React, { useState, useEffect } from "react";
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
    } else {
      setHasSeenIntro(true);
    }
  }, [user?.id]);

  // Handle intro modal close
  const handleIntroModalClose = (open: boolean) => {
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
    mutationFn: async (childInfo: { childEmail: string; childName: string }) => {
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
    onError: (error: Error) => {
      toast({
        title: "Kon kind niet toevoegen",
        description: error.message || "Controleer het emailadres en probeer opnieuw.",
        variant: "destructive",
      });
    }
  });

  const handleAddChild = (e: React.FormEvent) => {
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

  const getStatusBadge = (isConfirmed: boolean) => {
    return isConfirmed ? (
      <Badge variant="default" className="gap-1">
        <CheckCircle2 className="w-3 h-3" />
        Bevestigd
      </Badge>
    ) : (
      <Badge variant="secondary">
        Wacht op bevestiging
      </Badge>
    );
  };

  return (
    <div className="p-6 space-y-6" data-testid="parent-dashboard">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <h2 className="text-2xl font-semibold">Mijn kinderen</h2>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-primary relative"
            onClick={() => setShowIntroModal(true)}
            data-testid="button-parent-intro"
          >
            <Info className="w-4 h-4" />
            {!hasSeenIntro && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full border-2 border-white animate-pulse" />
            )}
          </Button>
        </div>
        <p className="text-muted-foreground">
          Voeg je kinderen toe om hun voortgang te volgen
        </p>
      </div>

      {/* Add Child Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Kind toevoegen</CardTitle>
            {!showAddChild && (
              <Button
                onClick={() => setShowAddChild(true)}
                size="sm"
                data-testid="button-add-child"
              >
                <Plus className="w-4 h-4 mr-2" />
                Voeg kind toe
              </Button>
            )}
          </div>
        </CardHeader>

        {showAddChild && (
          <CardContent>
            <form onSubmit={handleAddChild} className="space-y-4">
              <div>
                <Label htmlFor="child-name">Naam van je kind</Label>
                <Input
                  id="child-name"
                  type="text"
                  value={childData.name}
                  onChange={(e) => setChildData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Volledige naam"
                  required
                  data-testid="input-child-name"
                />
              </div>

              <div>
                <Label htmlFor="child-email">Emailadres van je kind</Label>
                <Input
                  id="child-email"
                  type="email"
                  value={childData.email}
                  onChange={(e) => setChildData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="kind@example.com"
                  required
                  data-testid="input-child-email"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Dit moet het emailadres zijn waarmee je kind zich heeft geregistreerd
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={addChildMutation.isPending}
                  data-testid="button-submit-add-child"
                >
                  {addChildMutation.isPending ? "Bezig..." : "Toevoegen"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowAddChild(false);
                    setChildData({ email: "", name: "" });
                  }}
                  data-testid="button-cancel-add-child"
                >
                  Annuleren
                </Button>
              </div>
            </form>
          </CardContent>
        )}
      </Card>

      {/* Children List */}
      <div className="space-y-4">
        {isLoading ? (
          <Card>
            <CardContent className="p-6 text-center">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto" />
              <p className="text-muted-foreground mt-2">Kinderen laden...</p>
            </CardContent>
          </Card>
        ) : children && Array.isArray(children) && children.length > 0 ? (
          children.map((childData: any) => (
            <Card key={childData.relationship.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                      <User className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{childData.relationship.childName}</h3>
                      <p className="text-sm text-muted-foreground">{childData.relationship.childEmail}</p>
                      {childData.child && (
                        <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                          <BookOpen className="w-4 h-4" />
                          {childData.child.educationLevel?.toUpperCase()} - Klas {childData.child.grade}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    {getStatusBadge(childData.relationship.isConfirmed)}
                  </div>
                </div>

                {childData.relationship.isConfirmed && childData.child && (
                  <div className="mt-4 pt-4 border-t flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        // TODO: Navigate to child's tasks view
                        toast({
                          title: "Binnenkort beschikbaar",
                          description: "Bekijk taken functionaliteit wordt nog ontwikkeld."
                        });
                      }}
                    >
                      <Calendar className="w-4 h-4 mr-2" />
                      Taken bekijken
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="p-6 text-center">
              <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold mb-2">Nog geen kinderen toegevoegd</h3>
              <p className="text-muted-foreground mb-4">
                Voeg je kinderen toe om hun huiswerk voortgang te volgen
              </p>
              <Button
                onClick={() => setShowAddChild(true)}
                data-testid="button-first-add-child"
              >
                <Plus className="w-4 h-4 mr-2" />
                Eerste kind toevoegen
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Parent Introduction Modal */}
      <ParentIntroModal
        open={showIntroModal}
        onOpenChange={handleIntroModalClose}
      />
    </div>
  );
}
