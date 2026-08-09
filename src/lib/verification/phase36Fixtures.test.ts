import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/agents/runAgent', () => ({ runAgent: vi.fn() }));
vi.mock('@/lib/agents/modelFactory', () => ({ instantiateChain: vi.fn() }));
vi.mock('@/lib/env', () => ({ env: { FIRECRAWL_API_KEY: 'phase36-test-key' } }));

import { GroundedExecutionAdapter } from '@/lib/analysis/execution';
import { PHASE33_DEFERRED_POLICY } from '@/lib/analysis/contracts';
import { normalizeAnalysisPacket } from '@/lib/analysis/results';
import { createPhase36Fixture, isPhase36FixtureMode, PHASE36_TARGETS } from './phase36Fixtures';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('Phase 36 deterministic verification fixtures', () => {
  it('creates compatible immutable Company and Persona lifecycle fixtures', () => {
    const fixtures = PHASE36_TARGETS.map((targetType) => createPhase36Fixture(targetType));

    expect(fixtures.map((fixture) => fixture.targetType)).toEqual(['company', 'persona']);
    expect(fixtures.map((fixture) => fixture.subjectSnapshot.type)).toEqual(['company', 'persona']);
    expect(fixtures[0]?.templateSnapshot.targetType).toBe('company');
    expect(fixtures[1]?.templateSnapshot.targetType).toBe('persona');
    expect(fixtures.every((fixture) => Object.isFrozen(fixture.built))).toBe(true);
    expect(fixtures.every((fixture) => fixture.packetInput.citations.length === 1)).toBe(true);
  });

  it('supplies a deterministic executor that returns source-backed findings without providers', async () => {
    const fixture = createPhase36Fixture('company');
    const result = await new GroundedExecutionAdapter(fixture.executorDependencies).execute({
      runId: fixture.runId,
      targetType: fixture.targetType,
      subjectId: fixture.subjectId,
      subjectDisplayName: fixture.subjectSnapshot.displayName,
      checklistSignalIds: [fixture.signalId],
      modelChain: ['phase36.fixture'],
      policy: fixture.policy,
    });

    expect(result).toMatchObject({ ok: true, modelId: 'phase36.fixture' });
    if (result.ok) {
      expect(result.toolResults).toEqual([
        expect.objectContaining({ url: fixture.source.url, title: fixture.source.title }),
      ]);
      expect(result.citations).toEqual(fixture.packetInput.citations);
      expect(result.output.findings[0]?.signalId).toBe(fixture.signalId);
    }
  });

  it('keeps deferred execution fail closed for both target contracts', async () => {
    for (const targetType of PHASE36_TARGETS) {
      const fixture = createPhase36Fixture(targetType);
      const result = await new GroundedExecutionAdapter(fixture.executorDependencies).execute({
        runId: fixture.runId,
        targetType,
        subjectId: fixture.subjectId,
        subjectDisplayName: fixture.subjectSnapshot.displayName,
        checklistSignalIds: [fixture.signalId],
        modelChain: ['phase36.fixture'],
        policy: PHASE33_DEFERRED_POLICY,
      });

      expect(result).toMatchObject({
        ok: false,
        failureReason: targetType === 'persona' ? 'persona_policy_unavailable' : 'policy_unavailable',
      });
    }
  });

  it.each([
    {
      name: 'marked pooler URL for the same test database',
      flag: '1',
      databaseUrl: 'postgresql://fixture:fixture@ep-test-pooler.example.test/db#phase36-fixture',
      testDatabaseUrl: 'postgresql://fixture:fixture@ep-test.example.test/db',
      expected: true,
    },
    {
      name: 'production app database with a separate test database',
      flag: '1',
      databaseUrl: 'postgresql://fixture:fixture@ep-production.example.test/db#phase36-fixture',
      testDatabaseUrl: 'postgresql://fixture:fixture@ep-test.example.test/db',
      expected: false,
    },
    {
      name: 'unmarked equal database URLs',
      flag: '1',
      databaseUrl: 'postgresql://fixture:fixture@ep-test.example.test/db',
      testDatabaseUrl: 'postgresql://fixture:fixture@ep-test.example.test/db',
      expected: false,
    },
    { name: 'missing flag', flag: '', databaseUrl: 'db-main', testDatabaseUrl: 'db-test', expected: false },
    { name: 'missing database URL', flag: '1', databaseUrl: '', testDatabaseUrl: 'db-test', expected: false },
    { name: 'missing test database URL', flag: '1', databaseUrl: 'db-main', testDatabaseUrl: '', expected: false },
    { name: 'invalid URLs', flag: '1', databaseUrl: 'db-main', testDatabaseUrl: 'db-test', expected: false },
  ])('$name requires an explicit isolated test database', ({ flag, databaseUrl, testDatabaseUrl, expected }) => {
    vi.stubEnv('PHASE36_FIXTURE_ONLY', flag);
    vi.stubEnv('DATABASE_URL', databaseUrl);
    vi.stubEnv('TEST_DATABASE_URL', testDatabaseUrl);

    expect(isPhase36FixtureMode()).toBe(expected);
  });

  it('normalizes the fixture execution into a source-backed packet', async () => {
    const fixture = createPhase36Fixture('company');
    const execution = await new GroundedExecutionAdapter(fixture.executorDependencies).execute({
      runId: fixture.runId,
      targetType: fixture.targetType,
      subjectId: fixture.subjectId,
      subjectDisplayName: fixture.subjectSnapshot.displayName,
      checklistSignalIds: [fixture.signalId],
      modelChain: ['phase36.fixture'],
      policy: fixture.policy,
    });

    expect(execution.ok).toBe(true);
    if (!execution.ok) return;

    const packet = normalizeAnalysisPacket({
      checklistSnapshot: fixture.built.checklistSnapshot,
      targetType: fixture.targetType,
      narrative: execution.output.narrative,
      findings: execution.output.findings,
      sourceResults: execution.toolResults.map((item) => ({
        origin: 'firecrawl',
        providerName: 'firecrawl',
        providerVersion: 'search',
        url: item.url,
        title: item.title,
        snippet: item.snippet,
        content: item.snippet,
        retrievedAt: '2026-08-09T00:00:00.000Z',
      })),
      citations: execution.citations,
      audit: { attempt: 1, modelId: execution.modelId, toolCallCount: 1, durationMs: execution.durationMs, traceId: null },
    });

    expect(packet.links).toHaveLength(1);
  });
});
