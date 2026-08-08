import { describe, expect, it } from 'vitest';
import {
  ANALYSIS_RUN_STATUSES,
  analysisSnapshotSchema,
  analysisSubjectSchema,
  analysisRunStatusSchema,
  boundedAttemptSchema,
  canTransitionAnalysisRun,
  NONTERMINAL_ANALYSIS_RUN_STATUSES,
  parseAnalysisSnapshot,
  PHASE32_NOOP_POLICY,
  PHASE33_DEFERRED_POLICY,
  phase33PolicySnapshotSchema,
  resolveAnalysisTransition,
  STANDARD_EXECUTION_BUDGET,
  safeOutcomeSchema,
  supportedEfforts,
} from './contracts';

describe('Phase 32 analysis contracts', () => {
  it('defines the exact lifecycle and nonterminal status sets', () => {
    expect(ANALYSIS_RUN_STATUSES).toEqual([
      'queued',
      'running',
      'completed',
      'failed',
      'cancelled',
    ]);
    expect(NONTERMINAL_ANALYSIS_RUN_STATUSES).toEqual(['queued', 'running']);
  });

  it('locks the resolved effort, future budget, and no-op policy', () => {
    expect(supportedEfforts).toEqual(['standard']);
    expect(STANDARD_EXECUTION_BUDGET).toEqual({
      maxAttempts: 2,
      maxToolCalls: 12,
      maxExecutionSeconds: 300,
      maxSpendUsd: 2.5,
    });
    expect(PHASE32_NOOP_POLICY).toEqual({
      schemaVersion: 1,
      mode: 'phase32_noop',
      networkAccess: false,
      writesAllowed: false,
      effectiveMaxAttempts: 1,
      effectiveMaxToolCalls: 0,
      effectiveMaxExecutionSeconds: 5,
      effectiveMaxSpendUsd: 0,
    });
  });

  it('represents missing Phase 33 approval as an explicit disabled policy', () => {
    expect(phase33PolicySnapshotSchema.safeParse(PHASE33_DEFERRED_POLICY).success).toBe(true);
    expect(phase33PolicySnapshotSchema.safeParse({ ...PHASE33_DEFERRED_POLICY, executionEnabled: true }).success).toBe(
      false,
    );
  });

  it('accepts only legal lifecycle edges and makes replay a no-transition outcome', () => {
    expect(canTransitionAnalysisRun('queued', 'running')).toBe(true);
    expect(analysisRunStatusSchema.safeParse('pending_review').success).toBe(false);
    expect(canTransitionAnalysisRun('failed', 'running')).toBe(false);
    expect(resolveAnalysisTransition('running', 'completed')).toEqual({
      ok: true,
      fromStatus: 'running',
      toStatus: 'completed',
    });
    expect(resolveAnalysisTransition('running', 'completed', true)).toEqual({
      ok: false,
      reason: 'replayed',
    });
  });

  it('keeps Company and Persona subjects discriminated', () => {
    expect(analysisSubjectSchema.safeParse({ type: 'company', id: 42 }).success).toBe(true);
    expect(analysisSubjectSchema.safeParse({ type: 'persona', id: 42 }).success).toBe(true);
    expect(analysisSubjectSchema.safeParse({ type: 'company', id: 42, sessionId: 'secret' }).success).toBe(
      false,
    );
  });

  it('allows an empty checklist and rejects unsafe or mismatched snapshot fields', () => {
    const snapshot = {
      schemaVersion: 1,
      template: {
        schemaVersion: 1,
        templateId: 10,
        templateVersionId: 11,
        templateKey: 'company-buying-signal-analysis',
        templateName: 'Company Buying Signal Analysis',
        targetType: 'company',
        version: 1,
        resolvedInstruction: 'Review the selected buying signals.',
        effort: 'standard',
      },
      subject: { type: 'company', id: 42, displayName: 'Example Company' },
      checklist: {
        schemaVersion: 1,
        targetType: 'company',
        practiceAreaId: 7,
        practiceAreaName: 'GBS',
        items: [],
      },
      execution: {
        schemaVersion: 1,
        effort: 'standard',
        resolvedModelChain: ['model.alpha'],
        futureBudget: STANDARD_EXECUTION_BUDGET,
        policy: PHASE32_NOOP_POLICY,
      },
      policy: PHASE32_NOOP_POLICY,
      templateVersionId: 11,
      subjectType: 'company',
      subjectId: 42,
      practiceAreaId: 7,
    };

    expect(analysisSnapshotSchema.safeParse(snapshot).success).toBe(true);
    expect(
      analysisSnapshotSchema.safeParse({
        ...snapshot,
        checklist: {
          ...snapshot.checklist,
          items: [
            {
              signalId: 1,
              status: 'active',
              name: 'Cost pressure',
              category: 'financial',
              description: 'A bounded signal description.',
            },
          ],
        },
      }).success,
    ).toBe(true);
    expect(
      analysisSnapshotSchema.safeParse({
        ...snapshot,
        checklist: {
          ...snapshot.checklist,
          items: [
            {
              signalId: 1,
              status: 'draft',
              name: 'Draft signal',
              category: 'financial',
              description: 'This must not enter an active snapshot.',
            },
          ],
        },
      }).success,
    ).toBe(false);
    expect(
      analysisSnapshotSchema.safeParse({ ...snapshot, subject: { type: 'persona', id: 42, displayName: 'Person' } })
        .success,
    ).toBe(false);
    expect(analysisSnapshotSchema.safeParse({ ...snapshot, apiKey: 'secret' }).success).toBe(false);
    expect(analysisSnapshotSchema.safeParse({ ...snapshot, databaseUrl: 'https://db.example' }).success).toBe(
      false,
    );
    const frozenSnapshot = parseAnalysisSnapshot(snapshot);
    expect(Object.isFrozen(frozenSnapshot)).toBe(true);
    expect(Object.isFrozen(frozenSnapshot.template)).toBe(true);
  });

  it('bounds attempts and safe outcome reasons', () => {
    expect(boundedAttemptSchema.safeParse(2).success).toBe(true);
    expect(boundedAttemptSchema.safeParse(3).success).toBe(false);
    expect(safeOutcomeSchema.safeParse({ ok: false, reason: 'timed_out', attempts: 2 }).success).toBe(true);
    expect(safeOutcomeSchema.safeParse({ ok: false, reason: 'private_reasoning', attempts: 1 }).success).toBe(
      false,
    );
  });
});
