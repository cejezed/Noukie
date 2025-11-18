/**
 * Vocab Lists API (UPDATED WITH ADMIN CRUD)
 *
 * GET /api/vocab/lists - List all vocab lists for user
 * POST /api/vocab/lists - Create new vocab list
 * PUT /api/vocab/lists - Update vocab list metadata
 * DELETE /api/vocab/lists - Delete vocab list (cascades to items and progress)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Auth check
  const userId = (req.headers['x-user-id'] as string) || null;
  if (!userId) {
    return res.status(401).json({ error: 'Missing x-user-id' });
  }

  // GET: List all vocab lists for this user
  if (req.method === 'GET') {
    try {
      const { subject, grade } = req.query;

      let query = admin
        .from('vocab_lists')
        .select('*')
        .eq('owner_id', userId)
        .order('created_at', { ascending: false });

      // Optional filters
      if (subject) {
        query = query.eq('subject', subject);
      }
      if (grade) {
        query = query.eq('grade', parseInt(grade as string));
      }

      const { data, error } = await query;

      if (error) {
        console.error('Vocab lists fetch error:', error);
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({ data });
    } catch (error: any) {
      console.error('Unexpected error fetching vocab lists:', error);
      return res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  // POST: Create new vocab list
  if (req.method === 'POST') {
    try {
      const {
        subject,
        grade,
        title,
        language_from,
        language_to,
      } = req.body;

      // Validation
      if (!subject || !title || !language_from || !language_to) {
        return res.status(400).json({
          error: 'Missing required fields: subject, title, language_from, language_to',
        });
      }

      // Insert new list
      const { data, error } = await admin
        .from('vocab_lists')
        .insert([
          {
            owner_id: userId,
            subject,
            grade: grade || null,
            title,
            language_from,
            language_to,
          },
        ])
        .select('*')
        .single();

      if (error) {
        console.error('Vocab list creation error:', error);
        return res.status(500).json({ error: error.message });
      }

      return res.status(201).json({ data });
    } catch (error: any) {
      console.error('Unexpected error creating vocab list:', error);
      return res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  // PUT: Update vocab list metadata
  if (req.method === 'PUT') {
    try {
      const { id, subject, grade, title, language_from, language_to } = req.body;

      // Validation
      if (!id) {
        return res.status(400).json({ error: 'Missing list id' });
      }

      // Verify ownership
      const { data: existingList, error: checkError } = await admin
        .from('vocab_lists')
        .select('id, owner_id')
        .eq('id', id)
        .single();

      if (checkError || !existingList) {
        return res.status(404).json({ error: 'List not found' });
      }

      if (existingList.owner_id !== userId) {
        return res.status(403).json({ error: 'Access denied: not list owner' });
      }

      // Update list
      const updates: any = { updated_at: new Date().toISOString() };
      if (subject !== undefined) updates.subject = subject;
      if (grade !== undefined) updates.grade = grade || null;
      if (title !== undefined) updates.title = title;
      if (language_from !== undefined) updates.language_from = language_from;
      if (language_to !== undefined) updates.language_to = language_to;

      const { data, error } = await admin
        .from('vocab_lists')
        .update(updates)
        .eq('id', id)
        .eq('owner_id', userId)
        .select('*')
        .single();

      if (error) {
        console.error('Vocab list update error:', error);
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({ data });
    } catch (error: any) {
      console.error('Unexpected error updating vocab list:', error);
      return res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  // DELETE: Delete vocab list (cascades to items and progress)
  if (req.method === 'DELETE') {
    try {
      const listId = req.query.id as string;

      if (!listId) {
        return res.status(400).json({ error: 'Missing list id' });
      }

      // Verify ownership
      const { data: existingList, error: checkError } = await admin
        .from('vocab_lists')
        .select('id, owner_id')
        .eq('id', listId)
        .single();

      if (checkError || !existingList) {
        return res.status(404).json({ error: 'List not found' });
      }

      if (existingList.owner_id !== userId) {
        return res.status(403).json({ error: 'Access denied: not list owner' });
      }

      // Delete list (CASCADE will delete items and progress)
      const { error: deleteError } = await admin
        .from('vocab_lists')
        .delete()
        .eq('id', listId)
        .eq('owner_id', userId);

      if (deleteError) {
        console.error('Vocab list deletion error:', deleteError);
        return res.status(500).json({ error: deleteError.message });
      }

      return res.status(204).end();
    } catch (error: any) {
      console.error('Unexpected error deleting vocab list:', error);
      return res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  // Method not allowed
  res.setHeader('Allow', 'GET, POST, PUT, DELETE');
  return res.status(405).end('Method Not Allowed');
}
