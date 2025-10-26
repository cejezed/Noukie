'use client';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';


async function uid() { const { data } = await supabase.auth.getUser(); return data.user?.id ?? null; }


export default function StudyBrowse() {
const [userId, setUserId] = useState<string | null>(null);
useEffect(()=>{ uid().then(setUserId); },[]);


const quizzes = useQuery({
queryKey: ['quizzes', userId], enabled: !!userId,
queryFn: async () => {
const res = await fetch('/api/quizzes', { headers: { 'x-user-id': userId! } });
if (!res.ok) throw new Error(await res.text());
const json = await res.json();
// Filter alleen published voor leerling‑lijst
return (json.data as Array<any>).filter((q)=> q.is_published);
}
});


return (
<main className="mx-auto max-w-[1000px] px-6 py-8">
<h1 className="text-2xl font-semibold mb-6">Kies een quiz</h1>
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
{quizzes.data?.map(q => (
<a key={q.id} href={`/study/play?quiz=${q.id}`} className="block bg-white rounded-2xl shadow p-4 hover:shadow-md">
<div className="text-sm text-gray-500">{q.subject} · {q.chapter}</div>
<div className="font-semibold">{q.title}</div>
<div className="text-sm text-gray-600 line-clamp-2">{q.description}</div>
</a>
))}
</div>
</main>
);
}