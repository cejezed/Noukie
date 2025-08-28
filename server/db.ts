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

// Create Supabase client for auth
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Use the direct DATABASE_URL if it's a Supabase connection string
// Or construct from SUPABASE_URL for database operations
let connectionString = process.env.DATABASE_URL;

// If DATABASE_URL points to Neon, try to use Supabase instead
if (connectionString?.includes('neon') && process.env.SUPABASE_URL) {
  // Extract project ref from Supabase URL
  const supabaseUrl = process.env.SUPABASE_URL;
  const projectRef = supabaseUrl.split('//')[1].split('.')[0];
  connectionString = `postgresql://postgres:${process.env.SUPABASE_SERVICE_ROLE_KEY}@db.${projectRef}.supabase.co:5432/postgres?sslmode=require`;
}

if (!connectionString) {
  throw new Error("No valid database connection string found");
}

const sql = postgres(connectionString);
export const db = drizzle(sql, { schema });
