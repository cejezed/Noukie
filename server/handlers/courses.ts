import type { Request, Response } from 'express';
import { supabase } from '../../client/src/lib/supabase';

// Haalt alle vakken voor een gebruiker op
export async function handleGetCourses(req: Request, res: Response) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Geen autorisatie-token.' });

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return res.status(401).json({ error: 'Niet geautoriseerd.' });

    const { data: courses, error: coursesError } = await supabase
      .from('courses')
      .select('*')
      .eq('user_id', user.id);

    if (coursesError) throw coursesError;

    res.status(200).json(courses);
  } catch (error: any) {
    console.error("Fout bij ophalen van vakken:", error);
    res.status(500).json({ error: "Kon vakken niet ophalen", details: error.message });
  }
}

// Handelt het aanmaken van een nieuw vak af
export async function handleCreateCourse(req: Request, res: Response) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Geen autorisatie-token.' });

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return res.status(401).json({ error: 'Niet geautoriseerd.' });

    const { name, color } = req.body;
    if (!name || !color) return res.status(400).json({ error: 'Naam en kleur zijn verplicht.' });

    const { data: newCourse, error: insertError } = await supabase
      .from('courses')
      .insert({ name, color, user_id: user.id })
      .select()
      .single();

    if (insertError) throw insertError;

    res.status(201).json(newCourse);
  } catch (error: any) {
    console.error("Course create error:", error);
    res.status(500).json({ error: "Failed to create course", details: error.message });
  }
}

