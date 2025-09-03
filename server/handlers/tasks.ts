import type { Request, Response } from 'express';
import { supabase } from '../../client/src/lib/supabase';

// Haalt de taken voor vandaag op voor een specifieke gebruiker
export async function handleGetTasksForToday(req: Request, res: Response) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Geen autorisatie-token.' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return res.status(401).json({ error: 'Niet geautoriseerd.' });
    }

    // Bepaal de start- en eindtijd voor vandaag
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfDay = today.toISOString();
    
    today.setHours(23, 59, 59, 999);
    const endOfDay = today.toISOString();

    // Haal taken op die vandaag beginnen
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .gte('starts_at', startOfDay)
      .lte('starts_at', endOfDay);

    if (tasksError) {
      throw tasksError;
    }

    res.status(200).json(tasks);
  } catch (error: any) {
    console.error("Fout bij ophalen van taken:", error);
    res.status(500).json({ error: "Kon taken niet ophalen", details: error.message });
  }
}

