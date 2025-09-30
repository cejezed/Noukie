import 'dotenv/config';
import type { Config } from 'drizzle-kit';

export default {
 schema: "./shared/schema.ts", 
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!, // zorg dat .env deze heeft
  },
  verbose: true,
  strict: true,
} satisfies Config;
