import { config } from 'dotenv';

config({ path: '.env.local', quiet: true });

const requiredVariables = [
  'DATABASE_URL',
  'FIRECRAWL_API_KEY',
  'NOUSRESEARCH_API_KEY',
  'OPENROUTER_API_KEY',
  'OPENCODE_API_KEY',
] as const;

const missingVariables = requiredVariables.filter((name) => !process.env[name]);
if (missingVariables.length > 0) {
  throw new Error(`Live-provider lane requires configured provider prerequisites: ${missingVariables.join(', ')}`);
}
