import MentalCheckin from "@/features/mental/MentalCheckin";
import { useAuth } from "@/lib/auth";

export default function MentalPage() {
  // Eventueel via env uit/aan zetten; voor nu gewoon aan:
  const enabled = true;

  const { user, isLoading } = useAuth();
  
  if (!enabled) return <div className="p-4">Deze functie staat (nog) uit.</div>;

  // Toon een laadbericht zolang de gebruiker niet geladen is
  if (isLoading || !user) {
    return <div className="flex justify-center items-center h-full p-4">Gebruiker wordt geladen...</div>;
  }

  const userId = user.id;

  return (
    <div className="max-w-xl mx-auto p-4">
      <MentalCheckin
        userId={userId}
        webhookUrl={import.meta.env.VITE_MENTAL_WEBHOOK}
        helpWebhookUrl={import.meta.env.VITE_MENTAL_HELP_WEBHOOK}
        rewardTiers={[
          { points: 25, label: "Samen shoppen" },
          { points: 100, label: "Dagje Walibi" },
          { points: 150, label: "Phantasialand" },
        ]}
        allowNegative={false}
      />
    </div>
  );
}
