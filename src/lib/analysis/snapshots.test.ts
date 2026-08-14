import { describe, expect, it } from 'vitest';

import {
  PHASE32_NOOP_POLICY,
  PHASE33_DEFERRED_POLICY,
  PHASE33_STANDARD_APPROVED_POLICY,
  STANDARD_EXECUTION_BUDGET,
  type AnalysisTargetType,
} from './contracts';
import { buildAnalysisSnapshots, buildPhase33AnalysisSnapshots } from './snapshots';

function createInput(type: AnalysisTargetType = 'company') {
  const isCompany = type === 'company';

  return {
    template: {
      schemaVersion: 1,
      templateId: isCompany ? 10 : 20,
      templateVersionId: isCompany ? 11 : 21,
      templateKey: `${type}-buying-signal-analysis`,
      templateName: `${isCompany ? 'Company' : 'Persona'} Buying Signal Analysis`,
      targetType: type,
      version: 1,
      resolvedInstruction: `resolved-${type}-instruction`,
      effort: 'standard',
    },
    subject: {
      type,
      id: isCompany ? 42 : 84,
      displayName: isCompany ? 'Example Company' : 'Example Person',
    },
    checklist: {
      schemaVersion: 1,
      targetType: type,
      practiceAreaId: 7,
      practiceAreaName: 'GBS',
    items: [],
    },
    resolvedModelChain: ['model.primary', 'model.fallback'],
  };
}

function createCustomInput() {
  const input = createInput();
  return {
    ...input,
    template: {
      ...input.template,
      templateId: 30,
      templateVersionId: 31,
      templateKey: 'custom-agent-opaque-1',
      templateName: 'Cost pressure scout',
      version: 2,
      resolvedInstruction: 'Use the snapshotted behavior instruction.',
      custom: {
        schemaVersion: 1 as const,
        customAgentId: 'custom-agent-opaque-1',
        templateVersionId: 31,
        version: 2,
        name: 'Cost pressure scout',
        description: 'Find public evidence of cost pressure.',
        researchQuery: 'Find recent public evidence.',
        behaviorInstruction: 'Use only grounded evidence.',
        capabilityPresetIds: ['web-research'],
        outputSchema: {
          type: 'object' as const,
          properties: { riskScore: { type: 'number' as const, nullable: true } },
          required: ['riskScore'],
        },
      },
    },
  };
}

describe('buildAnalysisSnapshots', () => {
  it('freezes explicit provider/model pairs in the execution snapshot', () => {
    const input = {
      ...createInput(),
      resolvedModelChain: [{ modelId: 'claude-sonnet-4-6', provider: 'opencode' as const }],
    };

    const result = buildAnalysisSnapshots(input);

    expect(result.executionSnapshot.resolvedModelChain).toEqual(input.resolvedModelChain);
  });

  it.each(['company', 'persona'] as const)(
    'builds validated scalar identities and immutable snapshots for a %s',
    (type) => {
      // Given
      const input = createInput(type);

      // When
      const result = buildAnalysisSnapshots(input);

      // Then
      expect(result).toEqual({
        templateId: input.template.templateId,
        templateVersionId: input.template.templateVersionId,
        subjectType: input.subject.type,
        subjectId: input.subject.id,
        practiceAreaId: input.checklist.practiceAreaId,
        templateSnapshot: input.template,
        subjectSnapshot: input.subject,
        checklistSnapshot: input.checklist,
        executionSnapshot: {
          schemaVersion: 1,
          effort: 'standard',
          resolvedModelChain: input.resolvedModelChain,
          futureBudget: STANDARD_EXECUTION_BUDGET,
          policy: PHASE32_NOOP_POLICY,
        },
        policySnapshot: PHASE32_NOOP_POLICY,
      });
    },
  );

  it('preserves an empty checklist and the exact execution limits', () => {
    // Given
    const input = createInput();

    // When
    const result = buildAnalysisSnapshots(input);

    // Then
    expect(result.checklistSnapshot.items).toEqual([]);
    expect(result.executionSnapshot.futureBudget).toEqual({
      maxAttempts: 2,
      maxToolCalls: 6,
      maxExecutionSeconds: 300,
      maxSpendUsd: 2.5,
    });
    expect(result.policySnapshot).toEqual({
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

  it('hands new Phase 33 runs an explicit deferred policy without changing Phase 32 snapshots', () => {
    const result = buildPhase33AnalysisSnapshots(createInput());

    expect(result.policySnapshot).toEqual(PHASE33_DEFERRED_POLICY);
    expect(result.executionSnapshot.policy).toEqual(PHASE33_DEFERRED_POLICY);
    expect(result.policySnapshot).not.toEqual(PHASE32_NOOP_POLICY);
  });

  it.each(['company', 'persona'] as const)(
    'carries the production standard approved policy into snapshots for a %s',
    (type) => {
      const result = buildPhase33AnalysisSnapshots(createInput(type), PHASE33_STANDARD_APPROVED_POLICY);

      expect(result.policySnapshot).toEqual(PHASE33_STANDARD_APPROVED_POLICY);
      expect(result.executionSnapshot.policy).toEqual(PHASE33_STANDARD_APPROVED_POLICY);
      expect(result.policySnapshot).toMatchObject({
        mode: 'phase33_grounded',
        executionEnabled: true,
        personaExecutionEnabled: false,
        failureReason: null,
      });
      expect(result.executionSnapshot.futureBudget).toEqual(STANDARD_EXECUTION_BUDGET);
      expect(Object.isFrozen(result.policySnapshot)).toBe(true);
    },
  );

  it('accepts only a complete approved Phase 33 policy and preserves it immutably', () => {
    const policy = {
      schemaVersion: 1,
      mode: 'phase33_grounded',
      executionEnabled: true,
      personaExecutionEnabled: false,
      policyVersion: 'phase33-approved-test',
      limits: {
        maxAttempts: 1,
        maxToolCalls: 1,
        maxExecutionSeconds: 60,
        maxSources: 1,
        maxSourceBytes: 1_000,
        maxExcerptBytes: 500,
        maxSpendUsd: 1,
      },
      personaPolicy: null,
      retention: null,
      evidenceStorage: 'bounded_excerpt_and_content_hash',
      auditVisibility: 'allowlisted_safe_metadata_only',
      failureReason: null,
      networkAccess: true,
      writesAllowed: false,
      effectiveMaxAttempts: 1,
      effectiveMaxToolCalls: 1,
      effectiveMaxExecutionSeconds: 60,
      effectiveMaxSpendUsd: 1,
    } as const;

    const result = buildPhase33AnalysisSnapshots(createInput(), policy);
    expect(result.policySnapshot).toEqual(policy);
    expect(Object.isFrozen(result.policySnapshot)).toBe(true);
  });

  it.each([
    ['API key', 'template', 'apiKey'],
    ['DATABASE_URL', 'template', 'DATABASE_URL'],
    ['Clerk secret', 'subject', 'clerkSecretKey'],
    ['session value', 'subject', 'sessionId'],
    ['private reasoning', 'root', 'privateReasoning'],
    ['unrestricted source row', 'subject', 'sourceRow'],
  ] as const)('rejects %s injection', (_label, location, field) => {
    // Given
    const input = createInput();
    const injected =
      location === 'template'
        ? { ...input, template: { ...input.template, [field]: 'fixture-secret' } }
        : location === 'subject'
          ? { ...input, subject: { ...input.subject, [field]: 'fixture-secret' } }
          : { ...input, [field]: 'fixture-secret' };

    // When / Then
    expect(() => buildAnalysisSnapshots(injected)).toThrow();
  });

  it.each([
    ['subject discriminator', { subject: { type: 'organization', id: 42, displayName: 'Invalid' } }],
    ['subject mismatch', { subject: { type: 'persona', id: 42, displayName: 'Invalid' } }],
    ['model URL', { resolvedModelChain: ['https://models.example/private'] }],
    ['model whitespace', { resolvedModelChain: ['model id'] }],
    ['effort', { template: { effort: 'unbounded' } }],
    ['reason', { reason: 'r'.repeat(501) }],
  ])('rejects invalid or unbounded %s values', (_label, override) => {
    // Given
    const input = createInput();
    const candidate = {
      ...input,
      ...override,
      template: { ...input.template, ...('template' in override ? override.template : {}) },
    };

    // When / Then
    expect(() => buildAnalysisSnapshots(candidate)).toThrow();
  });

  it('copies and deeply freezes snapshots against source and result mutation', () => {
    // Given
    const input = createInput();

    // When
    const result = buildAnalysisSnapshots(input);
    input.template.resolvedInstruction = 'mutated-source';
    input.resolvedModelChain[0] = 'mutated-source-model';

    // Then
    expect(result.templateSnapshot.resolvedInstruction).not.toBe(input.template.resolvedInstruction);
    expect(result.executionSnapshot.resolvedModelChain[0]).not.toBe(input.resolvedModelChain[0]);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.templateSnapshot)).toBe(true);
    expect(Object.isFrozen(result.executionSnapshot.resolvedModelChain)).toBe(true);
    expect(Reflect.set(result.templateSnapshot, 'resolvedInstruction', 'mutated-result')).toBe(false);
    expect(Reflect.set(result.executionSnapshot.resolvedModelChain, 0, 'mutated-result-model')).toBe(false);
  });

  it('snapshots custom identity, configuration, output storage, and all mutable replay inputs', () => {
    const input = createCustomInput();
    const result = buildPhase33AnalysisSnapshots(input, PHASE33_STANDARD_APPROVED_POLICY);

    expect(result.templateSnapshot.custom).toEqual(input.template.custom);
    expect(result.executionSnapshot.customOutputSchema).toEqual({
      schemaVersion: 1,
      storage: 'analysis_run_result.raw_audit.customOutput',
      fields: input.template.custom.outputSchema,
    });
    expect(result.executionSnapshot.policy).toEqual(PHASE33_STANDARD_APPROVED_POLICY);

    input.template.custom.behaviorInstruction = 'mutated behavior';
    input.template.custom.outputSchema.properties.riskScore.nullable = false;
    input.subject.displayName = 'Mutated subject';
    (input.checklist.items as Array<{
      signalId: number;
      status: 'active';
      name: string;
      category: string;
      description: string;
    }>).push({
      signalId: 99,
      status: 'active',
      name: 'Mutated signal',
      category: 'Financial',
      description: 'Must not enter the replay snapshot.',
    });
    input.resolvedModelChain[0] = 'mutated-model';

    expect(result.templateSnapshot.custom?.behaviorInstruction).toBe('Use only grounded evidence.');
    const customOutputSchema = result.executionSnapshot.customOutputSchema;
    expect(customOutputSchema).not.toBeNull();
    if (customOutputSchema !== null && customOutputSchema !== undefined) {
      expect(customOutputSchema.fields?.properties.riskScore.type).toBe('number');
    }
    expect(result.subjectSnapshot.displayName).toBe('Example Company');
    expect(result.checklistSnapshot.items).toHaveLength(0);
    expect(result.executionSnapshot.resolvedModelChain[0]).not.toBe('mutated-model');
    expect(Object.isFrozen(result.templateSnapshot.custom)).toBe(true);
    expect(Object.isFrozen(customOutputSchema?.fields?.properties)).toBe(true);
  });

  it('keeps fixed snapshots byte-compatible by omitting custom fields', () => {
    const result = buildPhase33AnalysisSnapshots(createInput());

    expect(result.templateSnapshot).not.toHaveProperty('custom');
    expect(result.executionSnapshot).not.toHaveProperty('customOutputSchema');
  });
});
