'use client';
}
});


const saveQuiz = useMutation({
mutationFn: async () => {
const res = await fetch('/api/quizzes', {
method: 'POST', headers: { 'Content-Type': 'application/json', 'x-user-id': uid! }, body: JSON.stringify(form)
});
if (!res.ok) throw new Error(await res.text());
return res.json();
},
onSuccess: () => { qc.invalidateQueries({ queryKey: ['quizzes-admin', uid] }); setForm({ subject: '', chapter: '', title: '', description: '', is_published: false }); }
});


const addQuestions = useMutation({
mutationFn: async () => {
if (!selectedQuiz) throw new Error('Kies eerst een quiz.');
const payload = {
quiz_id: selectedQuiz,
items: [{
qtype: newQ.qtype,
prompt: newQ.prompt,
choices: newQ.qtype === 'mc' ? newQ.choices.split('\n').map(s => s.trim()).filter(Boolean) : undefined,
answer: newQ.answer,
explanation: newQ.explanation,
}]
};
const res = await fetch('/api/quizzes/questions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-user-id': uid! }, body: JSON.stringify(payload) });
if (!res.ok) throw new Error(await res.text());
return res.json();
},
onSuccess: () => { setNewQ({ qtype: 'mc', prompt: '', choices: '', answer: '', explanation: '' }); }
});


return (
<main className="mx-auto max-w-[1000px] px-6 py-8">
<h1 className="text-2xl font-semibold mb-6">Quiz Admin</h1>


<section className="mb-10 bg-white p-5 rounded-2xl shadow">
<h2 className="font-semibold mb-4">Nieuwe quiz</h2>
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
<input className="border p-2 rounded" placeholder="Vak (subject)" value={form.subject} onChange={e=>setForm({...form, subject:e.target.value})} />
<input className="border p-2 rounded" placeholder="Hoofdstuk (chapter)" value={form.chapter} onChange={e=>setForm({...form, chapter:e.target.value})} />
<input className="border p-2 rounded md:col-span-2" placeholder="Titel" value={form.title} onChange={e=>setForm({...form, title:e.target.value})} />
<textarea className="border p-2 rounded md:col-span-2" placeholder="Omschrijving (kort)" value={form.description} onChange={e=>setForm({...form, description:e.target.value})} />
<label className="flex items-center gap-2"><input type="checkbox" checked={form.is_published} onChange={e=>setForm({...form, is_published:e.target.checked})}/>Publiceren</label>
<button className="bg-emerald-600 text-white px-4 py-2 rounded" onClick={()=>saveQuiz.mutate()}>Opslaan</button>
</div>
</section>


<section className="mb-10 bg-white p-5 rounded-2xl shadow">
<h2 className="font-semibold mb-4">Vragen toevoegen aan quiz</h2>
<div className="mb-3">
<select className="border p-2 rounded" value={selectedQuiz ?? ''} onChange={e=>setSelectedQuiz(e.target.value)}>
<option value="">— Kies quiz —</option>
{quizzes.data?.map(q => <option key={q.id} value={q.id}>{q.subject} · {q.chapter} · {q.title}</option>)}
</select>
</div>
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
<select className="border p-2 rounded" value={newQ.qtype} onChange={e=>setNewQ({...newQ, qtype: e.target.value as any})}>
<option value="mc">Meerkeuze</option>
<option value="open">Open vraag</option>
</select>
<input className="border p-2 rounded" placeholder="Juiste antwoord" value={newQ.answer} onChange={e=>setNewQ({...newQ, answer:e.target.value})}/>
<textarea className="border p-2 rounded md:col-span-2" placeholder="Vraag" value={newQ.prompt} onChange={e=>setNewQ({...newQ, prompt:e.target.value})}/>
{newQ.qtype === 'mc' && (
<textarea className="border p-2 rounded md:col-span-2" placeholder={'Meerkeuze‑opties (één per regel)'} value={newQ.choices} onChange={e=>setNewQ({...newQ, choices:e.target.value})}/>
)}
<textarea className="border p-2 rounded md:col-span-2" placeholder="Uitleg (optioneel)" value={newQ.explanation} onChange={e=>setNewQ({...newQ, explanation:e.target.value})}/>
<button className="bg-sky-600 text-white px-4 py-2 rounded" onClick={()=>addQuestions.mutate()}>Vraag toevoegen</button>
</div>
</section>
</main>
);
}