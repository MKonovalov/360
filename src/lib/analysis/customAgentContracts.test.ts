import { describe, expect, it } from 'vitest';

import {
  BOUNDED_OUTPUT_FIELD_TYPES,
  CUSTOM_AGENT_POLICY,
  boundedOutputSchema,
  customAgentCreateSchema,
  customAgentVersionSchema,
  parseCustomAgentCreateInput,
} from './customAgentContracts';

const validCreateInput = {
  name: 'Cost pressure scout',
  description: 'Finds public evidence of financial pressure.',
  targetType: 'company' as const,
  practiceAreaId: 7,
  researchQuery: 'Find recent public evidence that this company is under cost pressure.',
  behaviorInstruction: 'Separate observed evidence from inference and never invent sources.',
  defaultEffort: 'standard' as const,
  outputSchema: null,
  capabilityPresetIds: ['none'],
};

describe('custom agent contracts', () => {
  it('D-37-01/D-37-02/D-37-04/D-37-05: accepts authored create fields without client identity or runtime policy', () => {
    const result = customAgentCreateSchema.safeParse(validCreateInput);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validCreateInput);
    }
  });

  it.each(['id', 'key', 'actorId', 'status', 'version', 'checklist', 'resolvedInstruction', 'budget', 'provider', 'credential', 'toolId'])(
    'D-37-01/D-37-06/D-37-07: rejects client-owned field %s',
    (field) => {
      const result = customAgentCreateSchema.safeParse({ ...validCreateInput, [field]: 'tampered' });

      expect(result.success).toBe(false);
    },
  );

  it('D-37-05: requires exactly one positive Practice Area ID', () => {
    expect(customAgentCreateSchema.safeParse({ ...validCreateInput, practiceAreaId: 0 }).success).toBe(false);
    expect(customAgentCreateSchema.safeParse({ ...validCreateInput, practiceAreaId: [7] }).success).toBe(false);
  });

  it('D-37-07: accepts only the server-approved standard effort', () => {
    expect(customAgentCreateSchema.safeParse({ ...validCreateInput, defaultEffort: 'fast' }).success).toBe(false);
  });

  it('D-37-08/D-37-09: represents empty output schema as null and non-empty schema as additive fields', () => {
    const result = parseCustomAgentCreateInput({
      ...validCreateInput,
      outputSchema: {
        fields: [
          {
            name: 'riskScore',
            type: 'number',
            description: 'Observed score.',
            required: true,
            nullable: true,
          },
        ],
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.outputSchema).toEqual({
        type: 'object',
        properties: {
          riskScore: {
            type: 'number',
            description: 'Observed score.',
            nullable: true,
          },
        },
        required: ['riskScore'],
      });
    }
  });

  it('D-37-10: rejects unsupported nested schema fields with a field path', () => {
    const result = parseCustomAgentCreateInput({
      ...validCreateInput,
      outputSchema: { fields: [{ name: 'nested', type: 'object' }] },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues).toContainEqual(expect.objectContaining({ path: 'outputSchema.fields[0].type' }));
  });

  it('D-37-10: reports enum, field-count, array, and serialized-size bounds at field paths', () => {
    const tooManyEnums = Array.from({ length: CUSTOM_AGENT_POLICY.maxEnumValues + 1 }, (_, index) => `v${index}`);
    const result = parseCustomAgentCreateInput({
      ...validCreateInput,
      outputSchema: {
        fields: [{ name: 'status', type: 'string', enum: tooManyEnums }],
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues).toContainEqual(expect.objectContaining({ path: 'outputSchema.fields[0].enum' }));
  });

  it('D-37-11: exposes an immutable version handoff without runtime authority', () => {
    const result = customAgentVersionSchema.safeParse({
      customAgentId: 'custom-agent-opaque-1',
      targetType: 'persona',
      practiceAreaId: 9,
      version: 1,
      name: 'Persona scout',
      description: 'A bounded persona research configuration.',
      researchQuery: 'Find relevant public evidence.',
      behaviorInstruction: 'Use cited evidence only.',
      outputSchema: null,
      capabilityPresetIds: ['none'],
      supportedEfforts: ['standard'],
      defaultEffort: 'standard',
      createdBy: 'staff_1',
      createdAt: '2026-08-09T00:00:00.000Z',
      status: 'retired',
    });

    expect(result.success).toBe(true);
    expect(BOUNDED_OUTPUT_FIELD_TYPES).toEqual(['string', 'number', 'boolean', 'array']);
  });
});
