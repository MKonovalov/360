import { describe, expect, it } from 'vitest';
import {
  ANALYSIS_RUN_STATUSES,
  analysisSnapshotSchema,
  analysisAgentSelectionSchema,
  checklistSnapshotSchema,
  checklistSnapshotV1Schema,
  checklistSnapshotV2Schema,
  customOutputSchemaSnapshotSchema,
  parseAnalysisModelOutput,
  analysisSubjectSchema,
  analysisRunStatusSchema,
  boundedAttemptSchema,
  canTransitionAnalysisRun,
  NONTERMINAL_ANALYSIS_RUN_STATUSES,
  parseAnalysisSnapshot,
  PHASE32_NOOP_POLICY,
  PHASE33_DEFERRED_POLICY,
  PHASE33_STANDARD_APPROVED_POLICY,
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
      'pending_review',
      'confirmed',
      'dismissed',
    ]);
    expect(NONTERMINAL_ANALYSIS_RUN_STATUSES).toEqual(['queued', 'running']);
  });

  it('locks the resolved effort, future budget, and no-op policy', () => {
    expect(supportedEfforts).toEqual(['standard']);
    expect(STANDARD_EXECUTION_BUDGET).toEqual({
      maxAttempts: 2,
      maxToolCalls: 6,
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

  it('accepts the production standard approved policy with execution enabled and no persona execution', () => {
    expect(phase33PolicySnapshotSchema.safeParse(PHASE33_STANDARD_APPROVED_POLICY).success).toBe(true);
    expect(PHASE33_STANDARD_APPROVED_POLICY).toMatchObject({
      schemaVersion: 1,
      mode: 'phase33_grounded',
      executionEnabled: true,
      personaExecutionEnabled: false,
      policyVersion: 'phase33-standard-v1',
      personaPolicy: null,
      retention: null,
      failureReason: null,
      networkAccess: true,
      writesAllowed: false,
    });
  });

  it('derives the production standard approved policy budget from STANDARD_EXECUTION_BUDGET', () => {
    expect(PHASE33_STANDARD_APPROVED_POLICY.limits).toEqual({
      maxAttempts: STANDARD_EXECUTION_BUDGET.maxAttempts,
      maxToolCalls: STANDARD_EXECUTION_BUDGET.maxToolCalls,
      maxExecutionSeconds: STANDARD_EXECUTION_BUDGET.maxExecutionSeconds,
      maxSources: 5,
      maxSourceBytes: 50_000,
      maxExcerptBytes: 8_000,
      maxSpendUsd: STANDARD_EXECUTION_BUDGET.maxSpendUsd,
    });
    expect(PHASE33_STANDARD_APPROVED_POLICY.effectiveMaxAttempts).toBe(STANDARD_EXECUTION_BUDGET.maxAttempts);
    expect(PHASE33_STANDARD_APPROVED_POLICY.effectiveMaxToolCalls).toBe(STANDARD_EXECUTION_BUDGET.maxToolCalls);
    expect(PHASE33_STANDARD_APPROVED_POLICY.effectiveMaxExecutionSeconds).toBe(
      STANDARD_EXECUTION_BUDGET.maxExecutionSeconds,
    );
    expect(PHASE33_STANDARD_APPROVED_POLICY.effectiveMaxSpendUsd).toBe(STANDARD_EXECUTION_BUDGET.maxSpendUsd);
  });

  it('enforces the persona superRefine gate on the standard approved policy shape', () => {
    expect(
      phase33PolicySnapshotSchema.safeParse({
        ...PHASE33_STANDARD_APPROVED_POLICY,
        personaExecutionEnabled: true,
      }).success,
    ).toBe(false);
  });

  it('accepts only legal lifecycle edges and makes replay a no-transition outcome', () => {
    expect(canTransitionAnalysisRun('queued', 'running')).toBe(true);
    expect(analysisRunStatusSchema.safeParse('pending_review').success).toBe(true);
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

  it('keeps parsing an execution snapshot persisted under the prior maxToolCalls budget (12)', () => {
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
        futureBudget: { ...STANDARD_EXECUTION_BUDGET, maxToolCalls: 12 },
        policy: PHASE32_NOOP_POLICY,
      },
      policy: PHASE32_NOOP_POLICY,
      templateVersionId: 11,
      subjectType: 'company',
      subjectId: 42,
      practiceAreaId: 7,
    };

    expect(analysisSnapshotSchema.safeParse(snapshot).success).toBe(true);
  });

  it('bounds attempts and safe outcome reasons', () => {
    expect(boundedAttemptSchema.safeParse(2).success).toBe(true);
    expect(boundedAttemptSchema.safeParse(3).success).toBe(false);
    expect(safeOutcomeSchema.safeParse({ ok: false, reason: 'timed_out', attempts: 2 }).success).toBe(true);
    expect(safeOutcomeSchema.safeParse({ ok: false, reason: 'persona_policy_unavailable', attempts: 1 }).success).toBe(
      true,
    );
    expect(safeOutcomeSchema.safeParse({ ok: false, reason: 'policy_unavailable', attempts: 1 }).success).toBe(true);
    expect(safeOutcomeSchema.safeParse({ ok: false, reason: 'private_reasoning', attempts: 1 }).success).toBe(
      false,
    );
  });

  it('accepts only opaque fixed or custom launch selections', () => {
    expect(analysisAgentSelectionSchema.parse({ kind: 'fixed', templateVersionId: 11 })).toEqual({
      kind: 'fixed',
      templateVersionId: 11,
    });
    expect(analysisAgentSelectionSchema.parse({
      kind: 'custom',
      customAgentId: 'custom-agent-opaque-1',
      templateVersionId: 42,
    })).toEqual({
      kind: 'custom',
      customAgentId: 'custom-agent-opaque-1',
      templateVersionId: 42,
    });

    for (const input of [
      { kind: 'custom', customAgentId: 'agent', templateVersionId: 42, behaviorInstruction: 'forged' },
      { kind: 'custom', customAgentId: 'agent', templateVersionId: 42, provider: 'forged' },
      { kind: 'fixed', templateVersionId: 11, actorId: 'forged' },
      { kind: 'custom', customAgentId: 'agent' },
    ]) {
      expect(analysisAgentSelectionSchema.safeParse(input).success).toBe(false);
    }
  });

  it('preserves fixed output envelope and requires additive custom output only for custom runs', () => {
    const fixed = { narrative: 'summary', findings: [] };
    expect(parseAnalysisModelOutput(fixed)).toEqual(fixed);
    expect(() => parseAnalysisModelOutput({ ...fixed, custom: {} })).toThrow();

    const customSchema = {
      type: 'object' as const,
      properties: { riskScore: { type: 'number' as const } },
      required: ['riskScore'],
    };
    expect(parseAnalysisModelOutput({ ...fixed, custom: { riskScore: 3 } }, customSchema)).toEqual({
      ...fixed,
      custom: { riskScore: 3 },
    });
    expect(() => parseAnalysisModelOutput({ ...fixed, custom: {} }, customSchema)).toThrow();
    expect(() => parseAnalysisModelOutput({ ...fixed, custom: { riskScore: 3, evidence: 'forged' } }, customSchema)).toThrow();
    expect(() => parseAnalysisModelOutput({ ...fixed, custom: { riskScore: 3.5 } }, {
      type: 'object',
      properties: { riskScore: { type: 'number' }, labels: { type: 'array', items: { type: 'string' }, maxItems: 1 } },
      required: ['riskScore', 'labels'],
    })).toThrow();
  });

  it('locks the sole custom output persistence path', () => {
    expect(customOutputSchemaSnapshotSchema.parse({
      schemaVersion: 1,
      storage: 'analysis_run_result.raw_audit.customOutput',
      fields: { type: 'object', properties: {}, required: [] },
    }).storage).toBe('analysis_run_result.raw_audit.customOutput');
    expect(customOutputSchemaSnapshotSchema.safeParse({
      schemaVersion: 1,
      storage: 'other.path',
      fields: { type: 'object', properties: {}, required: [] },
    }).success).toBe(false);
    expect(customOutputSchemaSnapshotSchema.safeParse({
      schemaVersion: 1,
      storage: 'analysis_run_result.raw_audit.customOutput',
      fields: { type: 'object', properties: { evidence: { type: 'string' } }, required: [] },
    }).success).toBe(false);
  });
});

describe('checklist snapshot schema versioning', () => {
  const v1Snapshot = {
    schemaVersion: 1,
    targetType: 'company',
    practiceAreaId: 7,
    practiceAreaName: 'GBS',
    items: [
      { signalId: 3, status: 'active', name: 'No GBS/SSC exists', category: 'GBS-state', description: 'No shared services org exists yet.' },
      { signalId: 9, status: 'active', name: 'Cost pressure', category: 'Financial & commercial', description: 'Margin pressure is increasing.' },
    ],
  };

  const v2Snapshot = {
    schemaVersion: 2,
    targetType: 'company',
    practiceAreaId: 7,
    practiceAreaName: 'GBS',
    selectedCategory: 'GBS-state',
    items: [
      { signalId: 3, status: 'active', name: 'No GBS/SSC exists', category: 'GBS-state', description: 'No shared services org exists yet.' },
      { signalId: 5, status: 'active', name: 'GBS recently stood up', category: 'GBS-state', description: 'A GBS org stood up in the last year.' },
    ],
  };

  it('keeps parsing existing v1 checklist snapshots -- unfiltered items, no selectedCategory field', () => {
    expect(checklistSnapshotV1Schema.safeParse(v1Snapshot).success).toBe(true);
    expect(checklistSnapshotSchema.safeParse(v1Snapshot).success).toBe(true);
    expect(checklistSnapshotSchema.parse(v1Snapshot)).toEqual(v1Snapshot);
    // v1 rows never carry selectedCategory -- adding it must reject, since
    // v1 is `.strict()` and has no such field.
    expect(checklistSnapshotV1Schema.safeParse({ ...v1Snapshot, selectedCategory: 'GBS-state' }).success).toBe(false);
  });

  it('accepts a v2 GBS-state checklist snapshot with homogeneous, non-empty items', () => {
    expect(checklistSnapshotV2Schema.safeParse(v2Snapshot).success).toBe(true);
    expect(checklistSnapshotSchema.safeParse(v2Snapshot).success).toBe(true);
    expect(checklistSnapshotSchema.parse(v2Snapshot)).toEqual(v2Snapshot);
  });

  it('rejects a v2 snapshot with an empty item list', () => {
    expect(checklistSnapshotV2Schema.safeParse({ ...v2Snapshot, items: [] }).success).toBe(false);
  });

  it('rejects a v2 snapshot whose items are not homogeneous with selectedCategory', () => {
    const mixed = {
      ...v2Snapshot,
      items: [
        ...v2Snapshot.items,
        { signalId: 9, status: 'active', name: 'Cost pressure', category: 'Financial & commercial', description: 'Margin pressure is increasing.' },
      ],
    };
    expect(checklistSnapshotV2Schema.safeParse(mixed).success).toBe(false);
  });

  it('discriminates strictly on schemaVersion -- v2 fields never leak into a v1-tagged snapshot', () => {
    expect(
      checklistSnapshotSchema.safeParse({ ...v1Snapshot, schemaVersion: 1, selectedCategory: 'GBS-state' }).success,
    ).toBe(false);
    expect(checklistSnapshotSchema.safeParse({ ...v2Snapshot, schemaVersion: 3 }).success).toBe(false);
  });
});
