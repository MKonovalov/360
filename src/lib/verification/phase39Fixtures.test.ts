import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  firecrawlClient: { search: vi.fn() },
}));

vi.mock('@/lib/env', () => ({ env: { FIRECRAWL_API_KEY: 'phase39-test-key' } }));
vi.mock('firecrawl', () => ({ Firecrawl: vi.fn(function Firecrawl() { return mocks.firecrawlClient; }) }));

import {
  createPhase39Fixture,
  isPhase39FixtureMode,
  PHASE39_APPROVED_POLICY,
  PHASE39_TARGETS,
  resolvePhase39Lifecycle,
  shouldCreatePhase39Run,
} from './phase39Fixtures';
import { GroundedExecutionAdapter } from '@/lib/analysis/execution';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.firecrawlClient.search.mockResolvedValue({ web: [{ url: 'https://example.com', title: 'Example', description: 'Evidence' }] });
});

describe('Phase 39 deterministic fixtures', () => {
  it.each([
    {
      name: 'marked isolated database',
      flag: '1',
      databaseUrl: 'postgresql://fixture:fixture@ep-app.example.test/db#phase39-fixture',
      testDatabaseUrl: 'postgresql://fixture:fixture@ep-test.example.test/db#phase39-fixture',
      expected: true,
    },
    {
      name: 'bare flag without marker',
      flag: '1',
      databaseUrl: 'postgresql://fixture:fixture@ep-app.example.test/db',
      testDatabaseUrl: 'postgresql://fixture:fixture@ep-test.example.test/db',
      expected: false,
    },
    {
      name: 'marked production identity',
      flag: '1',
      databaseUrl: 'postgresql://fixture:fixture@ep-test.example.test/db#phase39-fixture',
      testDatabaseUrl: 'postgresql://fixture:fixture@ep-test-pooler.example.test/db#phase39-fixture',
      expected: false,
    },
  ])('$name selects Phase 39 mode only for the canonical isolated identity', ({ flag, databaseUrl, testDatabaseUrl, expected }) => {
    vi.stubEnv('PHASE39_FIXTURE_ONLY', flag);
    vi.stubEnv('DATABASE_URL', databaseUrl);
    vi.stubEnv('TEST_DATABASE_URL', testDatabaseUrl);

    expect(isPhase39FixtureMode()).toBe(expected);
  });

  it('builds immutable, writes-disabled Company and Persona fixtures', () => {
    const fixtures = PHASE39_TARGETS.map(createPhase39Fixture);

    expect(fixtures.map((fixture) => fixture.targetType)).toEqual(['company', 'persona']);
    expect(fixtures.every((fixture) => fixture.policy.writesAllowed === false)).toBe(true);
    expect(fixtures.every((fixture) => Object.isFrozen(fixture))).toBe(true);
    expect(fixtures.every((fixture) => fixture.packetInput.sourceResults.length === 1)).toBe(true);
  });

  it.each(PHASE39_TARGETS)('returns a bounded source-backed execution for %s', async (targetType) => {
    const fixture = createPhase39Fixture(targetType);
    const execution = await fixture.executorDependencies.runAgent({
      company: { id: fixture.subjectId, name: fixture.subjectSnapshot.displayName },
      liveSignals: [{ signalType: String(fixture.signalId) }],
    });

    expect(execution.submittedGroundedReport.findings).toHaveLength(1);
    expect(execution.steps[0]?.toolResults[0]?.toolName).toBe('webSearch');
    expect(execution.submittedGroundedReport.findings[0]?.signalId).toBe(fixture.signalId);
  });

  it('selects the Phase 39 executor and policy in guarded fixture mode', async () => {
    vi.stubEnv('PHASE39_FIXTURE_ONLY', '1');
    vi.stubEnv('DATABASE_URL', 'postgresql://fixture:fixture@ep-app.example.test/db#phase39-fixture');
    vi.stubEnv('TEST_DATABASE_URL', 'postgresql://fixture:fixture@ep-test.example.test/db#phase39-fixture');
    const fixture = createPhase39Fixture('company');
    const execution = await new GroundedExecutionAdapter({
      instantiateChain: () => { throw new Error('production executor selected'); },
      runAgent: async () => { throw new Error('production executor selected'); },
    }).execute({
      runId: fixture.runId,
      targetType: fixture.targetType,
      subjectId: fixture.subjectId,
      subjectDisplayName: fixture.subjectSnapshot.displayName,
      checklist: fixture.built.checklistSnapshot.items.map((item) => ({
        signalId: item.signalId,
        name: item.name,
        category: item.category,
        description: item.description,
      })),
      modelChain: ['phase39.fixture'],
      policy: PHASE39_APPROVED_POLICY,
    });

    expect(execution).toMatchObject({ ok: true, modelId: 'phase39.fixture' });
  });

  it('keeps duplicate active-run creation closed while allowing a terminal recovery run', () => {
    const fixture = createPhase39Fixture('company');

    expect(shouldCreatePhase39Run({ activeRunIds: [fixture.runId], requestedRunId: fixture.runId })).toBe(false);
    expect(shouldCreatePhase39Run({ activeRunIds: [fixture.runId], requestedRunId: fixture.runId + 1 })).toBe(true);
    expect(resolvePhase39Lifecycle('running')).toEqual({ status: 'completed', safeReason: null });
  });

  it('exposes the fixed policy contract for no-live-write verification', () => {
    expect(PHASE39_APPROVED_POLICY.writesAllowed).toBe(false);
    expect(PHASE39_APPROVED_POLICY.effectiveMaxAttempts).toBe(1);
    expect(PHASE39_APPROVED_POLICY.effectiveMaxToolCalls).toBe(1);
    expect(PHASE39_APPROVED_POLICY.effectiveMaxSpendUsd).toBe(0);
  });
});
