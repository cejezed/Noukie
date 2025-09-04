import React from "react";
import { useAuth } from "@/lib/auth";

export default function PlanningTemp() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="p-6">Laden...</div>;
  }

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold">Planning</h2>
      <p>Planning pagina werkt weer!</p>
    </div>
  );
}
