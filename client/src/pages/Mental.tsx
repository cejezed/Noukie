import MentalCheckin from "@/features/mental/MentalCheckin";
import { useAuth } from "@/lib/auth";

export default function MentalPage() {
  // Eventueel via env uit/aan zetten; voor nu gewoon aan:
  const enabled = true;

  const { user } = useAuth();
  const userId = user?.id || "demo-user"; // fallback voor lokaal testen

  if (!enabled) return <div className="p-4">Deze functie staat (nog) uit.</div>;

  return (
    <div className="max-w-xl mx-auto p-4">
      <MentalCheckin
        userId={userId}
        webhookUrl={import.meta.env.VITE_MENTAL_WEBHOOK}
        helpWebhookUrl={import.meta.env.VITE_MENTAL_HELP_WEBHOOK}
        rewardTiers={[
          { points: 25, label: "Samen shoppen" },
          { points: 50, label: "Dagje Walibi" },
          { points: 100, label: "Phantasialand" },
        ]}
        allowNegative={false}
      />
    </div>
  );
}
