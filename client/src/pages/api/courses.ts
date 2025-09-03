import type { Request, Response } from 'express';
import { supabase } from '../../lib/supabase';

export async function handleCreateCourse(req: Request, res: Response) {
  try {
    // Stap 1: Valideer de gebruiker via de meegestuurde token
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Geen autorisatie-token.' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return res.status(401).json({ error: 'Niet geautoriseerd.' });
    }

    // Stap 2: Valideer de input
    const { name, color } = req.body;
    if (!name || !color) {
      return res.status(400).json({ error: 'Naam en kleur zijn verplicht.' });
    }

    // Stap 3: Voeg het nieuwe vak toe aan de database
    const { data: newCourse, error: insertError } = await supabase
      .from('courses')
      .insert({ name, color, user_id: user.id })
      .select()
      .single();

    if (insertError) {
      // Gooi de specifieke databasefout door voor betere debugging
      throw insertError;
    }

    // Stap 4: Stuur het succesvolle resultaat terug
    res.status(201).json(newCourse);
  } catch (error: any) {
    console.error("Course create error:", error);
    res.status(500).json({ error: "Failed to create course", details: error.message });
  }
}

