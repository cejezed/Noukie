import type { Request, Response } from 'express';
import { supabase } from '../../client/src/lib/supabase';

// Haalt het rooster op voor een specifieke gebruiker
export async function handleGetSchedule(req: Request, res: Response) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Geen autorisatie-token.' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return res.status(401).json({ error: 'Niet geautoriseerd.' });
    }

    const { data: schedule, error: scheduleError } = await supabase
      .from('schedule')
      .select('*')
      .eq('user_id', user.id);

    if (scheduleError) {
      throw scheduleError;
    }

    res.status(200).json(schedule);
  } catch (error: any) {
    console.error("Fout bij ophalen van rooster:", error);
    res.status(500).json({ error: "Kon rooster niet ophalen", details: error.message });
  }
}

