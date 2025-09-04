import type { Request, Response } from 'express';
import { supabase } from '../../client/src/lib/supabase';

// Helper-functie om de gebruiker op te halen
async function getUserFromRequest(req: Request) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return null;
  const { data: { user } } = await supabase.auth.getUser(token);
  return user;
}

// Haalt alle vakken voor een gebruiker op
export async function handleGetCourses(req: Request, res: Response) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: 'Niet geautoriseerd.' });

    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('user_id', user.id);

    if (error) throw error;
    res.status(200).json(data);
  } catch (error: any) {
    res.status(500).json({ error: "Kon vakken niet ophalen", details: error.message });
  }
}

// Maakt een nieuw vak aan
export async function handleCreateCourse(req: Request, res: Response) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: 'Niet geautoriseerd.' });

    const { name, color } = req.body;
    if (!name || !color) return res.status(400).json({ error: 'Naam en kleur zijn verplicht.' });

    const { data, error } = await supabase
      .from('courses')
      .insert({ name, color, user_id: user.id })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error: any) {
    res.status(500).json({ error: "Kon vak niet aanmaken", details: error.message });
  }
}

// Verwijdert een vak
export async function handleDeleteCourse(req: Request, res: Response) {
    try {
        const user = await getUserFromRequest(req);
        if (!user) return res.status(401).json({ error: 'Niet geautoriseerd.' });

        const { courseId } = req.params;
        const { error } = await supabase
            .from('courses')
            .delete()
            .eq('id', courseId)
            .eq('user_id', user.id);

        if (error) throw error;
        res.status(204).send();
    } catch (error: any) {
        res.status(500).json({ error: "Kon vak niet verwijderen", details: error.message });
    }
}

