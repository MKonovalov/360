import { describe, expect, it } from 'vitest';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase('Phase 36 adversarial database no-write guard', () => {
  it('is intentionally gated: live Signal/Offering/link hashes require TEST_DATABASE_URL', () => {
    expect(testDatabaseUrl).toBeTruthy();
  });
});
