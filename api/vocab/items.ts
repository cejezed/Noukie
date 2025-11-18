/**
 * Vocab Items API (UPDATED WITH ADMIN CRUD)
 *
 * POST /api/vocab/items - Bulk add items to a vocab list
 * PUT /api/vocab/items - Update individual item
 * DELETE /api/vocab/items - Delete individual item
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

  // POST: Bulk add items to list
  if (req.method === 'POST') {
    try {
      const { list_id, items } = req.body;

      // Validation
      if (!list_id) {
        return res.status(400).json({ error: 'Missing list_id' });
      }

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'items must be a non-empty array' });
      }

      // Verify list ownership
      const { data: list, error: listError } = await admin
        .from('vocab_lists')
        .select('id, owner_id')
        .eq('id', list_id)
        .single();

      if (listError || !list) {
        return res.status(404).json({ error: 'List not found' });
      }

      if (list.owner_id !== userId) {
        return res.status(403).json({ error: 'Access denied: not list owner' });
      }

      // Validate each item
      for (const item of items) {
        if (!item.term || !item.translation) {
          return res.status(400).json({
            error: 'Each item must have term and translation',
          });
        }
      }

      // Prepare items for insertion
      const itemsToInsert = items.map((item) => ({
        list_id,
        term: item.term.trim(),
        translation: item.translation.trim(),
        example_sentence: item.example_sentence?.trim() || null,
        notes: item.notes?.trim() || null,
      }));

      // Bulk insert (with conflict handling - skip duplicates)
      const { data, error } = await admin
        .from('vocab_items')
        .insert(itemsToInsert)
        .select('*');

      if (error) {
        console.error('Items insert error:', error);

        // Handle unique constraint violation gracefully
        if (error.code === '23505') {
          return res.status(400).json({
            error: 'Some items already exist in this list (duplicate terms)',
            details: error.message,
          });
        }

        return res.status(500).json({ error: error.message });
      }

      return res.status(201).json({
        data,
        count: data.length,
      });
    } catch (error: any) {
      console.error('Unexpected error adding vocab items:', error);
      return res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  // PUT: Update individual item
  if (req.method === 'PUT') {
    try {
      const { id, term, translation, example_sentence, notes } = req.body;

      // Validation
      if (!id) {
        return res.status(400).json({ error: 'Missing item id' });
      }

      // Get item and verify ownership via list
      const { data: item, error: itemError } = await admin
        .from('vocab_items')
        .select('id, list_id')
        .eq('id', id)
        .single();

      if (itemError || !item) {
        return res.status(404).json({ error: 'Item not found' });
      }

      // Verify list ownership
      const { data: list, error: listError } = await admin
        .from('vocab_lists')
        .select('id, owner_id')
        .eq('id', item.list_id)
        .single();

      if (listError || !list || list.owner_id !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Update item
      const updates: any = {};
      if (term !== undefined) updates.term = term.trim();
      if (translation !== undefined) updates.translation = translation.trim();
      if (example_sentence !== undefined)
        updates.example_sentence = example_sentence?.trim() || null;
      if (notes !== undefined) updates.notes = notes?.trim() || null;

      const { data: updatedItem, error: updateError } = await admin
        .from('vocab_items')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single();

      if (updateError) {
        console.error('Item update error:', updateError);
        return res.status(500).json({ error: updateError.message });
      }

      return res.status(200).json({ data: updatedItem });
    } catch (error: any) {
      console.error('Unexpected error updating vocab item:', error);
      return res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  // DELETE: Delete individual item
  if (req.method === 'DELETE') {
    try {
      const itemId = req.query.id as string;

      if (!itemId) {
        return res.status(400).json({ error: 'Missing item id' });
      }

      // Get item and verify ownership via list
      const { data: item, error: itemError } = await admin
        .from('vocab_items')
        .select('id, list_id')
        .eq('id', itemId)
        .single();

      if (itemError || !item) {
        return res.status(404).json({ error: 'Item not found' });
      }

      // Verify list ownership
      const { data: list, error: listError } = await admin
        .from('vocab_lists')
        .select('id, owner_id')
        .eq('id', item.list_id)
        .single();

      if (listError || !list || list.owner_id !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Delete item (CASCADE will delete progress)
      const { error: deleteError } = await admin
        .from('vocab_items')
        .delete()
        .eq('id', itemId);

      if (deleteError) {
        console.error('Item deletion error:', deleteError);
        return res.status(500).json({ error: deleteError.message });
      }

      return res.status(204).end();
    } catch (error: any) {
      console.error('Unexpected error deleting vocab item:', error);
      return res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  // Method not allowed
  res.setHeader('Allow', 'POST, PUT, DELETE');
  return res.status(405).end('Method Not Allowed');
}
