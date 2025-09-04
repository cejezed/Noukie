import MentalCheckin from "@/features/mental/MentalCheckin";
import { useAuth } from "@/lib/auth";
import { Loader2 } from "lucide-react";

export default function MentalPage() {
  const enabled = true;
  const { user, isLoading } = useAuth();
  
  // DEBUG: Log de user data
  console.log('MentalPage - User data:', { user, isLoading });
  console.log('User ID:', user?.id);
  
  if (!enabled) return <div className="p-4">Deze functie staat (nog) uit.</div>;

  if (isLoading || !user) {
    return (
      <div className="flex justify-center items-center h-full p-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const userId = user.id;
  
  // Extra check voordat we MentalCheckin renderen
  if (!userId) {
    console.error('User ID is undefined!', user);
    return <div className="p-4 text-red-500">Error: Geen gebruikers ID gevonden.</div>;
  }

  console.log('Passing userId to MentalCheckin:', userId);

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