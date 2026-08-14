import { config } from 'dotenv';

import { parseFixtureDatabaseUrl } from './src/lib/verification/databaseIdentity';

config({ path: '.env.local', quiet: true });

const database = parseFixtureDatabaseUrl(process.env.DATABASE_URL);
const fixture = parseFixtureDatabaseUrl(process.env.GBS_TEST_DATABASE_URL);

if (!database || !fixture) {
  throw new Error('GBS integration lane requires PostgreSQL DATABASE_URL and GBS_TEST_DATABASE_URL values');
}
if (fixture.marker !== 'gbs-fixture') {
  throw new Error('GBS_TEST_DATABASE_URL must carry the gbs-fixture marker');
}
if (database.identity === fixture.identity) {
  throw new Error('GBS_TEST_DATABASE_URL must not identify DATABASE_URL');
}

process.env.DATABASE_URL = process.env.GBS_TEST_DATABASE_URL;
