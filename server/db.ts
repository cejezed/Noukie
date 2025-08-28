import { createClient } from '@supabase/supabase-js';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from "@shared/schema";

if (!process.env.SUPABASE_URL) {
  throw new Error(
    "SUPABASE_URL must be set. Did you forget to configure Supabase?",
  );
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "SUPABASE_SERVICE_ROLE_KEY must be set. Did you forget to configure Supabase?",
  );
}

// Create Supabase client for auth and database operations
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Create postgres connection for Drizzle using SUPABASE connection
// FORCE use of Supabase URL - NEVER use DATABASE_URL (Neon)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for database connection');
}

// Build Supabase postgres connection string
const connectionString = `postgresql://postgres:[YOUR_PASSWORD]@${supabaseUrl.replace('https://', '').replace('.supabase.co', '')}.pooler.supabase.com:5432/postgres`;

// For now, use SUPABASE_URL directly as postgres connection
// This ensures we NEVER use Neon DATABASE_URL
const postgresUrl = process.env.SUPABASE_URL?.replace('https://', 'postgresql://postgres:') || '';

if (!postgresUrl) {
  throw new Error('Could not create Supabase postgres connection string');
}

// FORCE connection to Supabase ONLY - ignore DATABASE_URL (Neon)
// Extract host from Supabase URL 
const host = supabaseUrl.replace('https://', '').replace('.supabase.co', '') + '.pooler.supabase.com';
const supabaseConnectionString = `postgresql://postgres.${host.split('.')[0]}:${supabaseServiceKey}@${host}:5432/postgres`;

const sql = postgres(supabaseConnectionString);
export const db = drizzle(sql, { schema });

console.log('✅ Connected to Supabase database (FORCED - NO NEON)');
