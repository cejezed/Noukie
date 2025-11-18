import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

const admin = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { parentId, childEmail, childName } = req.body;

  if (!parentId || !childEmail || !childName) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Find child by email
    const { data: child, error: childError } = await admin
      .from('users')
      .select('*')
      .eq('email', childEmail)
      .single();

    if (childError || !child) {
      return res.status(404).json({ error: 'Child not found with this email address' });
    }

    if (child.role !== 'student') {
      return res.status(400).json({ error: 'Only student accounts can be added as children' });
    }

    // Check if relationship already exists
    const { data: existingRel } = await admin
      .from('parent_child_relationships')
      .select('*')
      .eq('parent_id', parentId)
      .eq('child_id', child.id)
      .single();

    if (existingRel) {
      return res.status(400).json({ error: 'This child is already linked to your account' });
    }

    // Create the relationship
    const { data: relationship, error: relError } = await admin
      .from('parent_child_relationships')
      .insert({
        parent_id: parentId,
        child_id: child.id,
        child_email: childEmail,
        child_name: childName,
        is_confirmed: false,
      })
      .select()
      .single();

    if (relError) {
      console.error('Error creating relationship:', relError);
      return res.status(500).json({ error: 'Failed to create relationship' });
    }

    return res.json({ success: true, relationship });
  } catch (error) {
    console.error('Add child error:', error);
    return res.status(500).json({ error: 'Failed to add child' });
  }
}
