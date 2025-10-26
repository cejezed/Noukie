'use client';
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';


function useUserId() { const [id,setId]=useState<string|null>(null); useEffect(()=>{supabase.auth.getUser().then(({data})=>setId(data.user?.id??null));},[]); return id; }


export default function StudyPlay() {
const userId = useUserId();
const params = new URLSearchParams(location.search);
const quizId = params.get('quiz')!;


const [resultId, setResultId] = useState<string | null>(null);
const [index, setIndex] = useState(0);
const [answers, setAnswers] = useState<Record<string,string>>({});
const [done, setDone] = useState(false);


const questions = useQuery({
queryKey: ['quiz-questions', quizId, userId], enabled: !!userId,
queryFn: async () => {
const res = await fetch(`/api/quizzes/questions?quiz_id=${quizId}`, { headers: { 'x-user-id': userId! } });
if (!res.ok) throw new Error(await res.text());
const json = await res.json();
return json.data as Array<any>;
}
});


const play = useMutation({
mutationFn: async (payload: any) => {
const res = await fetch('/api/quizzes/play', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-user-id': userId! }, body: JSON.stringify(payload) });
if (!res.ok) throw new Error(await res.text());
return res.json();
}
});


useEffect(()=>{
if (userId) {
play.mutate({ action: 'start', quiz_id: quizId }, { onSuccess: (r)=> setResultId(r.result.id) });
}
},[userId]);


if (!questions.data) return <main className="p-8">Laden…</main>;


const q = questions.data[index];
if (!q) {
if (!done && resultId) {
play.mutate({ action: 'finish', result_id: resultId }, { onSuccess: ()=> setDone(true) });
}
return <main className="p-8"><h1 className="text-2xl font-semibold mb-4">Klaar!</h1><p>Je antwoorden zijn opgeslagen.</p><a className="text-sky-700 underline" href="/study">Terug naar quizlijst</a></main>;
}


const choices: string[] = q.choices ? JSON.parse(q.choices) : [];
const current = answers[q.id] ?? '';


const submit = (value: string) => {
setAnswers(prev => ({ ...prev, [q.id]: value }));
if (resultId) play.mutate({ action: 'answer', result_id: resultId, question_id: q.id, given_answer: value });
setIndex(i => i + 1);
};


return (
<main className="mx-auto max-w-[800px] px-6 py-8">
<div className="mb-6 text-sm text-gray-500">Vraag {index+1} van {questions.data.length}</div>
<h1 className="text-xl font-semibold mb-4">{q.prompt}</h1>


{q.qtype === 'mc' ? (
<div className="grid gap-3">
{choices.map((c: string, i: number) => (
<button key={i} onClick={()=>submit(c)} className="text-left border rounded-xl p-3 hover:bg-gray-50">{c}</button>
))}
</div>
) : (
<form className="flex gap-2" onSubmit={(e)=>{e.preventDefault(); const inp=(e.target as HTMLFormElement).elements.namedItem('open') as HTMLInputElement; submit(inp.value);}}>
<input name="open" className="flex-1 border rounded-xl p-3" placeholder="Jouw antwoord" defaultValue={current} />
<button className="px-4 py-2 rounded-xl bg-sky-600 text-white">Volgende</button>
</form>
)}
</main>
);
}