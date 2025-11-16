import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

// Kleurthema's
export const colorThemes = [
  { id: "yellow", name: "Geel (Standaard)", primary: "hsl(47.9, 95.8%, 53.1%)", preview: "bg-yellow-500" },
  { id: "blue", name: "Blauw", primary: "hsl(217.2, 91.2%, 59.8%)", preview: "bg-blue-500" },
  { id: "green", name: "Groen", primary: "hsl(142.1, 76.2%, 36.3%)", preview: "bg-green-500" },
  { id: "red", name: "Rood", primary: "hsl(0, 84.2%, 60.2%)", preview: "bg-red-500" },
  { id: "purple", name: "Paars", primary: "hsl(262.1, 83.3%, 57.8%)", preview: "bg-purple-500" },
  { id: "pink", name: "Roze", primary: "hsl(330.1, 81.2%, 60.4%)", preview: "bg-pink-500" },
];

/**
 * Custom hook to manage app theme
 * Automatically loads and applies the user's saved theme on mount
 */
export function useTheme() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTheme, setSelectedTheme] = useState("yellow");

  // Apply theme to CSS variables
  const applyTheme = (themeId: string) => {
    const theme = colorThemes.find((t) => t.id === themeId) || colorThemes[0];
    setSelectedTheme(theme.id);
    if (typeof window !== "undefined") {
      document.documentElement.style.setProperty("--primary", theme.primary);
    }
  };

  // Load user's saved theme on mount
  useEffect(() => {
    if (user?.user_metadata?.app_theme) {
      applyTheme(user.user_metadata.app_theme);
    } else {
      applyTheme("yellow"); // Default theme
    }
  }, [user]);

  // Mutation to save theme preference
  const updateThemeMutation = useMutation({
    mutationFn: async (themeId: string) => {
      const { data, error } = await supabase.auth.updateUser({
        data: { app_theme: themeId },
      });
      if (error) throw new Error(error.message);
      return data.user;
    },
    onSuccess: (updatedUser) => {
      queryClient.invalidateQueries({ queryKey: ["user"] });
      const themeName =
        colorThemes.find((t) => t.id === updatedUser.user_metadata.app_theme)?.name || "Nieuw thema";
      toast({
        title: "Thema opgeslagen!",
        description: `Je kleurvoorkeur is bijgewerkt naar ${themeName}.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Fout bij opslaan",
        description: `Kon het thema niet opslaan: ${(error as Error).message}`,
        variant: "destructive",
      });
    },
  });

  // Change and save theme
  const changeTheme = (themeId: string) => {
    applyTheme(themeId); // Apply immediately for instant feedback
    updateThemeMutation.mutate(themeId); // Save to database
  };

  return {
    selectedTheme,
    themes: colorThemes,
    changeTheme,
    applyTheme,
    isUpdating: updateThemeMutation.isPending,
  };
}
