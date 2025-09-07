import { useAuth } from "@/lib/auth";
import MentalCheckin from "@/features/mental/MentalCheckin";

export default function Mental() {
  const { user, loading } = useAuth();

  console.log('Mental page - user:', user); // Debug log
  console.log('Mental page - loading:', loading); // Debug log

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Niet ingelogd</h2>
          <p className="text-gray-600">Log eerst in om verder te gaan.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <MentalCheckin userId={user.id} />
    </div>
  );
}
