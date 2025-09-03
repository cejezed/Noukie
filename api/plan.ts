import type { Request, Response } from 'express';
import { supabase } from '../../client/src/lib/supabase';

// Deze functie handelt het aanmaken van een weekplanning af
export async function handleCreatePlan(req: Request, res: Response) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Geen autorisatie-token.' });

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return res.status(401).json({ error: 'Niet geautoriseerd.' });

    const { title, week_start_date } = req.body;
    if (!title || !week_start_date) {
      return res.status(400).json({ error: 'Titel en startdatum van de week zijn verplicht.' });
    }

    // Voeg de nieuwe planning toe aan de database
    // LET OP: U moet mogelijk een 'plans' tabel aanmaken in Supabase
    const { data: newPlan, error: insertError } = await supabase
      .from('plans')
      .insert({ title, week_start_date, user_id: user.id })
      .select()
      .single();

    if (insertError) throw insertError;

    res.status(201).json(newPlan);

  } catch (error: any) {
    console.error("Fout bij het aanmaken van een planning:", error.message);
    res.status(500).json({ error: "Kon planning niet aanmaken", details: error.message });
  }
}
