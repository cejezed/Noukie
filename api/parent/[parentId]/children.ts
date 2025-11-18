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
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { parentId } = req.query;

  if (!parentId || typeof parentId !== 'string') {
    return res.status(400).json({ error: 'Missing parentId parameter' });
  }

  try {
    // Get parent-child relationships
    const { data: relationships, error: relError } = await admin
      .from('parent_child_relationships')
      .select('*')
      .eq('parent_id', parentId);

    if (relError) {
      console.error('Error fetching relationships:', relError);
      return res.status(500).json({ error: 'Failed to fetch relationships' });
    }

    if (!relationships || relationships.length === 0) {
      return res.json([]);
    }

    // Get child data for each relationship
    const childrenData = await Promise.all(
      relationships.map(async (rel) => {
        const { data: child, error: childError } = await admin
          .from('users')
          .select('*')
          .eq('id', rel.child_id)
          .single();

        if (childError) {
          console.error('Error fetching child:', childError);
          return { relationship: rel, child: null };
        }

        return { relationship: rel, child };
      })
    );

    return res.json(childrenData);
  } catch (error) {
    console.error('Get children error:', error);
    return res.status(500).json({ error: 'Failed to get children' });
  }
}
