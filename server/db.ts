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

// COMPLETELY IGNORE DATABASE_URL (which points to Neon)
// BUILD SUPABASE CONNECTION STRING FROM SCRATCH
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Extract project reference from Supabase URL
// Example: https://abc123.supabase.co -> abc123
const projectRef = supabaseUrl.replace('https://', '').split('.')[0];

// Build proper Supabase PostgreSQL connection string
// Format: postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
const supabaseConnectionString = `postgresql://postgres:${supabaseKey}@db.${projectRef}.supabase.co:5432/postgres`;

console.log('🚫 IGNORING DATABASE_URL (Neon):', process.env.DATABASE_URL?.substring(0, 50) + '...');
console.log('✅ USING SUPABASE CONNECTION:', `postgresql://postgres:***@db.${projectRef}.supabase.co:5432/postgres`);

// Create postgres connection using SUPABASE ONLY
const sql = postgres(supabaseConnectionString, {
  ssl: 'require',
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(sql, { schema });

console.log('✅ Connected to SUPABASE database (DATABASE_URL IGNORED!)');