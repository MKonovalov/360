import { config } from 'dotenv';

import {
  assertPhase39Preflight,
  parseFixtureDatabaseUrl,
} from './src/lib/verification/databaseIdentity';

config({ path: '.env.local', quiet: true });

const databaseUrl = process.env.DATABASE_URL;
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!parseFixtureDatabaseUrl(databaseUrl)) {
  throw new Error('Phase 39 integration preflight blocked: DATABASE_URL must be a PostgreSQL URL');
}

if (!parseFixtureDatabaseUrl(testDatabaseUrl)) {
  throw new Error('Phase 39 integration preflight blocked: TEST_DATABASE_URL must be a PostgreSQL URL');
}

if (!testDatabaseUrl) {
  throw new Error('Phase 39 integration preflight blocked: TEST_DATABASE_URL is required');
}

const fixtureUrl = new URL(testDatabaseUrl);
fixtureUrl.hash = 'phase39-fixture';
process.env.TEST_DATABASE_URL = fixtureUrl.toString();

assertPhase39Preflight();
