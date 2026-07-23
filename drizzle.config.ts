import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// Repo only has `.env.local` (no `.env`); dotenv/config's default path misses it.
config({ path: '.env.local' });

export default defineConfig({
  out: './drizzle',
  schema: './src/lib/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
