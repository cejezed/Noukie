import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useLocation } from "wouter";

async function getUid() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export default function StudyBrowse() {
  const [userId, setUserId] = useState<string | null>(null);
  const [, navigate] = useLocation();

  useEffect(() => {
    getUid().then(setUserId);
  }, []);

  const quizzes = useQuery({
    queryKey: ["quizzes", userId],
    enabled: !!userId,
    queryFn: async () => {
      const res = await fetch("/api/quizzes", {
        headers: { "x-user-id": userId! },
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      // Alleen gepubliceerde quizzes tonen
      return (json.data as Array<any>).filter((q) => q.is_published);
    },
  });

  if (!userId) {
    return (
      <main className="mx-auto max-w-[1000px] px-6 py-8">
        <p className="text-sm text-gray-500">Inloggen vereist…</p>
      </main>
    );
  }

  if (quizzes.isLoading) {
    return (
      <main className="mx-auto max-w-[1000px] px-6 py-8">
        <p>Laden…</p>
      </main>
    );
  }

  if (quizzes.isError) {
    return (
      <main className="mx-auto max-w-[1000px] px-6 py-8">
        <p className="text-red-600">Er ging iets mis bij het laden van de quizzes.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1000px] px-6 py-8">
      <h1 className="text-2xl font-semibold mb-6">Toetsen</h1>

      {quizzes.data?.length ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quizzes.data.map((q: any) => (
            <button
              key={q.id}
              onClick={() => navigate(`/toets/spelen?quiz=${q.id}`)}
              className="text-left bg-white rounded-2xl shadow p-4 hover:shadow-md"
            >
              <div className="text-sm text-gray-500">
                {q.subject} · {q.chapter}
              </div>
              <div className="font-semibold">{q.title}</div>
              {q.description && (
                <div className="text-sm text-gray-600 line-clamp-2">
                  {q.description}
                </div>
              )}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-gray-600">Nog geen gepubliceerde toetsen.</p>
      )}
    </main>
  );
}
