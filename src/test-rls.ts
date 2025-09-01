import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL!;
const anon = process.env.SUPABASE_ANON_KEY!;

// kies een stabiel testaccount zodat herhaald draaien werkt
const email = 'test@example.com';      // maak deze user evt. eerst aan in Dashboard → Auth → Users
const password = 'Test1234!';

async function loginOrSignup() {
  const supabase = createClient(url, anon, { auth: { persistSession: false } });

  // 1) Probeer eerst in te loggen
  let { data: login, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });

  // 2) Als login faalt met "invalid login credentials", probeer te registreren
  if (signInErr) {
    console.log('Login mislukte, probeer signup…', signInErr.message);
    const { error: signUpErr } = await supabase.auth.signUp({ email, password });
    if (signUpErr) throw new Error('signUp: ' + signUpErr.message);

    // Als email-confirmation UIT staat werkt direct sign-in; anders moet je mail bevestigen
    const res = await supabase.auth.signInWithPassword({ email, password });
    login = res.data;
    if (res.error) throw new Error('signIn na signUp: ' + res.error.message);
  }

  if (!login?.session) throw new Error('Geen sessie na login');
  return login.session;
}

async function main() {
  // haal sessie binnen (login of signup)
  const session = await loginOrSignup();

  // client met sessie voor RLS
  const authed = createClient(url, anon);
  await authed.auth.setSession(session);

  // insert zonder user_id mee te geven (default auth.uid() vult kolom)
  const { data: ins, error: insErr } = await authed
    .from('todos')
    .insert({ title: 'RLS testtodo (login-or-signup)' })
    .select()
    .single();
  if (insErr) throw new Error('insert: ' + insErr.message);
  console.log('Inserted todo:', ins);

  const { data: rows, error: selErr } = await authed
    .from('todos')
    .select('*')
    .order('created_at', { ascending: false });
  if (selErr) throw new Error('select: ' + selErr.message);

  console.log('Todos for this user:', rows);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
