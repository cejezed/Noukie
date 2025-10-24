import { supabase } from '../../client/src/lib/supabase';
// Helper-functie om de gebruiker op te halen
async function getUserFromRequest(req) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token)
        return null;
    const { data: { user } } = await supabase.auth.getUser(token);
    return user;
}
// Maakt een nieuwe taak aan
export async function handleCreateTask(req, res) {
    try {
        const user = await getUserFromRequest(req);
        if (!user)
            return res.status(401).json({ error: 'Niet geautoriseerd.' });
        const { title, course_id, est_minutes, priority, due_at } = req.body;
        if (!title || !due_at)
            return res.status(400).json({ error: 'Titel en deadline zijn verplicht.' });
        const { data, error } = await supabase
            .from('tasks')
            .insert({ title, course_id, est_minutes, priority, due_at, user_id: user.id })
            .select()
            .single();
        if (error)
            throw error;
        res.status(201).json(data);
    }
    catch (error) {
        res.status(500).json({ error: "Kon taak niet aanmaken", details: error.message });
    }
}
// Haalt de taken voor vandaag op
export async function handleGetTasksForToday(req, res) {
    try {
        const user = await getUserFromRequest(req);
        if (!user)
            return res.status(401).json({ error: 'Niet geautoriseerd.' });
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const startOfDay = today.toISOString();
        today.setHours(23, 59, 59, 999);
        const endOfDay = today.toISOString();
        const { data, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('user_id', user.id)
            .gte('due_at', startOfDay)
            .lte('due_at', endOfDay);
        if (error)
            throw error;
        res.status(200).json(data);
    }
    catch (error) {
        res.status(500).json({ error: "Kon taken niet ophalen", details: error.message });
    }
}
// Haalt taken voor een specifieke week op
export async function handleGetTasksForWeek(req, res) {
    try {
        const user = await getUserFromRequest(req);
        if (!user)
            return res.status(401).json({ error: 'Niet geautoriseerd.' });
        const { week_start, week_end } = req.params;
        const { data, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('user_id', user.id)
            .gte('due_at', week_start)
            .lte('due_at', week_end);
        if (error)
            throw error;
        res.status(200).json(data);
    }
    catch (error) {
        res.status(500).json({ error: "Kon weektaken niet ophalen", details: error.message });
    }
}
// Werkt de status van een taak bij
export async function handleUpdateTaskStatus(req, res) {
    try {
        const user = await getUserFromRequest(req);
        if (!user)
            return res.status(401).json({ error: 'Niet geautoriseerd.' });
        const { taskId } = req.params;
        const { status } = req.body;
        if (!status)
            return res.status(400).json({ error: "Status is verplicht." });
        const { data, error } = await supabase
            .from('tasks')
            .update({ status })
            .eq('id', taskId)
            .eq('user_id', user.id)
            .select()
            .single();
        if (error)
            throw error;
        res.status(200).json(data);
    }
    catch (error) {
        res.status(500).json({ error: "Kon taakstatus niet bijwerken", details: error.message });
    }
}
// Verwijdert een taak
export async function handleDeleteTask(req, res) {
    try {
        const user = await getUserFromRequest(req);
        if (!user)
            return res.status(401).json({ error: 'Niet geautoriseerd.' });
        const { taskId } = req.params;
        const { error } = await supabase
            .from('tasks')
            .delete()
            .eq('id', taskId)
            .eq('user_id', user.id);
        if (error)
            throw error;
        res.status(204).send();
    }
    catch (error) {
        res.status(500).json({ error: "Kon taak niet verwijderen", details: error.message });
    }
}
