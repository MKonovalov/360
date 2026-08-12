import { describe, expect, it } from 'vitest';

import {
  createPhase39Fixture,
  PHASE39_APPROVED_POLICY,
  PHASE39_TARGETS,
  resolvePhase39Lifecycle,
  shouldCreatePhase39Run,
} from './phase39Fixtures';

describe('Phase 39 deterministic fixtures', () => {
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

    expect(execution.output.findings).toHaveLength(1);
    expect(execution.steps[0]?.toolResults[0]?.toolName).toBe('webSearch');
    expect(execution.output.findings[0]?.signalId).toBe(fixture.signalId);
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
