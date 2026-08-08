import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/agents/runAgent', () => ({ runAgent: vi.fn() }));
vi.mock('@/lib/agents/modelFactory', () => ({ instantiateChain: vi.fn() }));
vi.mock('@/lib/env', () => ({ env: { FIRECRAWL_API_KEY: 'phase36-test-key' } }));

import { GroundedExecutionAdapter } from '@/lib/analysis/execution';
import { PHASE33_DEFERRED_POLICY } from '@/lib/analysis/contracts';
import { createPhase36Fixture, PHASE36_TARGETS } from './phase36Fixtures';

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
});
