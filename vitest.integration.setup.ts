import { config } from 'dotenv';

config({ path: '.env.local', quiet: true });

if (!process.env.DATABASE_URL || !process.env.TEST_DATABASE_URL) {
  throw new Error('DB integration lane requires DATABASE_URL and TEST_DATABASE_URL');
}

for (const [name, value] of Object.entries({
  DATABASE_URL: process.env.DATABASE_URL,
  TEST_DATABASE_URL: process.env.TEST_DATABASE_URL,
})) {
  if (!value.startsWith('postgres')) throw new Error(`DB integration lane requires ${name} to be a PostgreSQL URL`);
}
