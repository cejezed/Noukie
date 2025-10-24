import { supabase } from '../../client/src/lib/supabase';
// Helper om de gebruiker uit het verzoek te halen
async function getUserFromRequest(req) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token)
        return null;
    const { data: { user } } = await supabase.auth.getUser(token);
    return user;
}
// Haalt het volledige rooster op voor een gebruiker
export async function handleGetSchedule(req, res) {
    try {
        const user = await getUserFromRequest(req);
        if (!user)
            return res.status(401).json({ error: 'Niet geautoriseerd.' });
        const { data, error } = await supabase
            .from('schedule')
            .select('*')
            .eq('user_id', user.id);
        if (error)
            throw error;
        res.status(200).json(data);
    }
    catch (error) {
        res.status(500).json({ error: "Kon rooster niet ophalen", details: error.message });
    }
}
// Maakt een nieuw roosteritem aan
export async function handleCreateScheduleItem(req, res) {
    try {
        const user = await getUserFromRequest(req);
        if (!user)
            return res.status(401).json({ error: 'Niet geautoriseerd.' });
        // Voeg user_id toe aan de data uit de body
        const itemData = { ...req.body, user_id: user.id };
        const { data, error } = await supabase
            .from('schedule')
            .insert(itemData)
            .select()
            .single();
        if (error)
            throw error;
        res.status(201).json(data);
    }
    catch (error) {
        res.status(500).json({ error: "Kon roosteritem niet aanmaken", details: error.message });
    }
}
// Verwijdert een roosteritem
export async function handleDeleteScheduleItem(req, res) {
    try {
        const user = await getUserFromRequest(req);
        if (!user)
            return res.status(401).json({ error: 'Niet geautoriseerd.' });
        const { itemId } = req.params;
        const { error } = await supabase
            .from('schedule')
            .delete()
            .eq('id', itemId)
            .eq('user_id', user.id); // Veiligheidscheck
        if (error)
            throw error;
        res.status(204).send();
    }
    catch (error) {
        res.status(500).json({ error: "Kon roosteritem niet verwijderen", details: error.message });
    }
}
// Annuleert een roosteritem (zet status op 'cancelled')
export async function handleCancelScheduleItem(req, res) {
    try {
        const user = await getUserFromRequest(req);
        if (!user)
            return res.status(401).json({ error: 'Niet geautoriseerd.' });
        const { itemId } = req.params;
        const { data, error } = await supabase
            .from('schedule')
            .update({ status: 'cancelled' })
            .eq('id', itemId)
            .eq('user_id', user.id) // Veiligheidscheck
            .select()
            .single();
        if (error)
            throw error;
        res.status(200).json(data);
    }
    catch (error) {
        res.status(500).json({ error: "Kon roosteritem niet annuleren", details: error.message });
    }
}
