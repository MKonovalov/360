import { neon } from '@neondatabase/serverless';
import { describe, expect, it } from 'vitest';

import { GroundedExecutionAdapter } from '@/lib/analysis/execution';
import { createPhase38FixedFixture } from './phase38Fixtures';
import { assertPhase39Preflight } from './databaseIdentity';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)('Phase 39 adversarial no-live-write proof', () => {
  it('keeps Signal, Offering, and signal-offering-link counts unchanged', async () => {
    assertPhase39Preflight();
    const sql = neon(testDatabaseUrl as string);
    const before = await sql`
      SELECT
        (SELECT count(*)::int FROM signal) AS signals,
        (SELECT count(*)::int FROM offering) AS offerings,
        (SELECT count(*)::int FROM signal_offering_link) AS links
    `;
    const fixture = createPhase38FixedFixture('company');
    const result = await new GroundedExecutionAdapter(fixture.executorDependencies).execute({
      runId: fixture.runId,
      targetType: fixture.targetType,
      subjectId: fixture.subjectId,
      subjectDisplayName: fixture.subjectSnapshot.displayName,
      checklist: fixture.built.checklistSnapshot.items.map((item) => ({ signalId: item.signalId, name: item.name, category: item.category, description: item.description })),
      modelChain: ['phase39.fixture'],
      policy: fixture.policy,
    });
    expect(result.ok).toBe(true);
    const after = await sql`
      SELECT
        (SELECT count(*)::int FROM signal) AS signals,
        (SELECT count(*)::int FROM offering) AS offerings,
        (SELECT count(*)::int FROM signal_offering_link) AS links
    `;
    expect(after).toEqual(before);
  });
});
