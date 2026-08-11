import { z } from 'zod';

import { supportedEfforts } from './contracts';
import type { AnalysisEffort, AnalysisTargetType } from './contracts';
import { validateCapabilitySelection } from './capabilityPresets';

export const BOUNDED_OUTPUT_FIELD_TYPES = ['string', 'number', 'boolean', 'array'] as const;
type BoundedOutputFieldType = (typeof BOUNDED_OUTPUT_FIELD_TYPES)[number];

export const CUSTOM_AGENT_POLICY = {
  maxFields: 12,
  maxFieldNameLength: 64,
  maxFieldDescriptionLength: 300,
  maxNameLength: 120,
  maxDescriptionLength: 500,
  maxResearchQueryLength: 4_000,
  maxBehaviorInstructionLength: 8_000,
  maxEnumValues: 10,
  maxEnumValueLength: 64,
  minArrayItems: 1,
  maxArrayItems: 20,
  maxSerializedSchemaBytes: 16 * 1024,
} as const;

export const practiceAreaIdSchema = z.number().int().positive();
const targetTypeSchema = z.enum(['company', 'persona']);
const effortSchema = z.enum(supportedEfforts);
const capabilityPresetIdSchema = z.string().trim().min(1).max(64).regex(/^[a-z0-9-]+$/);

const authoredFieldSchema = z
  .object({
    name: z.string().trim().min(1).max(CUSTOM_AGENT_POLICY.maxFieldNameLength),
    type: z.enum(BOUNDED_OUTPUT_FIELD_TYPES),
    description: z.string().trim().max(CUSTOM_AGENT_POLICY.maxFieldDescriptionLength).optional(),
    required: z.boolean().optional(),
    nullable: z.boolean().optional(),
    enum: z.array(z.string().trim().min(1).max(CUSTOM_AGENT_POLICY.maxEnumValueLength)).max(CUSTOM_AGENT_POLICY.maxEnumValues).optional(),
    itemType: z.enum(['string', 'number', 'boolean']).optional(),
    maxItems: z.number().int().min(CUSTOM_AGENT_POLICY.minArrayItems).max(CUSTOM_AGENT_POLICY.maxArrayItems).optional(),
  })
  .strict();

const authoredOutputSchema = z.object({ fields: z.array(authoredFieldSchema).max(CUSTOM_AGENT_POLICY.maxFields) }).strict();

export type NormalizedOutputField = {
  readonly type: BoundedOutputFieldType;
  readonly description?: string;
  readonly nullable?: boolean;
  readonly enum?: readonly string[];
  readonly items?: { readonly type: 'string' | 'number' | 'boolean' };
  readonly maxItems?: number;
};

export type BoundedOutputSchema = {
  readonly type: 'object';
  readonly properties: Readonly<Record<string, NormalizedOutputField>>;
  readonly required: readonly string[];
};

const normalizedOutputFieldSchema = z
  .object({
    type: z.enum(BOUNDED_OUTPUT_FIELD_TYPES),
    description: z.string().max(CUSTOM_AGENT_POLICY.maxFieldDescriptionLength).optional(),
    nullable: z.boolean().optional(),
    enum: z.array(z.string().min(1).max(CUSTOM_AGENT_POLICY.maxEnumValueLength)).max(CUSTOM_AGENT_POLICY.maxEnumValues).optional(),
    items: z.object({ type: z.enum(['string', 'number', 'boolean']) }).strict().optional(),
    maxItems: z.number().int().min(CUSTOM_AGENT_POLICY.minArrayItems).max(CUSTOM_AGENT_POLICY.maxArrayItems).optional(),
  })
  .strict();

export const boundedOutputSchema = z
  .object({
    type: z.literal('object'),
    properties: z.record(z.string().min(1).max(CUSTOM_AGENT_POLICY.maxFieldNameLength), normalizedOutputFieldSchema),
    required: z.array(z.string().min(1).max(CUSTOM_AGENT_POLICY.maxFieldNameLength)).max(CUSTOM_AGENT_POLICY.maxFields),
  })
  .strict()
  .superRefine((schema, context) => {
    const serializedSize = Buffer.byteLength(JSON.stringify(schema), 'utf8');
    if (serializedSize > CUSTOM_AGENT_POLICY.maxSerializedSchemaBytes) {
      context.addIssue({ code: 'custom', message: 'Schema is too large', path: [] });
    }
  });

const baseCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(CUSTOM_AGENT_POLICY.maxNameLength),
    description: z.string().trim().min(1).max(CUSTOM_AGENT_POLICY.maxDescriptionLength),
    targetType: targetTypeSchema,
    practiceAreaId: practiceAreaIdSchema,
    researchQuery: z.string().trim().min(1).max(CUSTOM_AGENT_POLICY.maxResearchQueryLength),
    behaviorInstruction: z.string().trim().min(1).max(CUSTOM_AGENT_POLICY.maxBehaviorInstructionLength),
    defaultEffort: effortSchema,
    outputSchema: authoredOutputSchema.nullable(),
    capabilityPresetIds: z.array(capabilityPresetIdSchema).max(2),
  })
  .strict();

export const customAgentCreateSchema = baseCreateSchema;

export type CustomAgentCreateInput = z.infer<typeof customAgentCreateSchema>;

const customAgentSaveSchema = z
  .object({
    customAgentId: z.string().trim().min(1).max(120),
    name: baseCreateSchema.shape.name,
    description: baseCreateSchema.shape.description,
    researchQuery: baseCreateSchema.shape.researchQuery,
    behaviorInstruction: baseCreateSchema.shape.behaviorInstruction,
    outputSchema: baseCreateSchema.shape.outputSchema,
    capabilityPresetIds: baseCreateSchema.shape.capabilityPresetIds,
    defaultEffort: baseCreateSchema.shape.defaultEffort,
  })
  .strict();

export type CustomAgentSaveInput = z.infer<typeof customAgentSaveSchema>;

export const customAgentLifecycleInputSchema = z
  .object({
    customAgentId: z.string().trim().min(1).max(120),
    status: z.enum(['active', 'retired']),
  })
  .strict();

const normalizedOutputSchemaInput = boundedOutputSchema.nullable();

export const customAgentVersionSchema = z
  .object({
    customAgentId: z.string().trim().min(1).max(120),
    targetType: targetTypeSchema,
    practiceAreaId: practiceAreaIdSchema,
    version: z.number().int().positive(),
    name: z.string().trim().min(1).max(CUSTOM_AGENT_POLICY.maxNameLength),
    description: z.string().trim().min(1).max(CUSTOM_AGENT_POLICY.maxDescriptionLength),
    researchQuery: z.string().trim().min(1).max(CUSTOM_AGENT_POLICY.maxResearchQueryLength),
    behaviorInstruction: z.string().trim().min(1).max(CUSTOM_AGENT_POLICY.maxBehaviorInstructionLength),
    outputSchema: normalizedOutputSchemaInput,
    capabilityPresetIds: z.array(capabilityPresetIdSchema).max(2),
    supportedEfforts: z.array(effortSchema).min(1).max(1),
    defaultEffort: effortSchema,
    createdBy: z.string().trim().min(1).max(120),
    createdAt: z.string().trim().min(1).max(64),
    status: z.enum(['active', 'retired']),
  })
  .strict();

export type CustomAgentVersion = z.infer<typeof customAgentVersionSchema>;

export type CustomAgentValidationIssue = {
  readonly path: string;
  readonly code: string;
  readonly message: string;
};

export type CustomAgentParseResult =
  | { readonly ok: true; readonly value: CustomAgentVersionInput }
  | { readonly ok: false; readonly issues: readonly CustomAgentValidationIssue[] };

export type CustomAgentSaveParseResult =
  | { readonly ok: true; readonly value: Omit<CustomAgentSaveInput, 'outputSchema'> & { readonly outputSchema: BoundedOutputSchema | null } }
  | { readonly ok: false; readonly issues: readonly CustomAgentValidationIssue[] };

export type CustomAgentVersionInput = Omit<CustomAgentCreateInput, 'outputSchema'> & {
  readonly outputSchema: BoundedOutputSchema | null;
};

function issue(path: string, code: string, message: string): CustomAgentValidationIssue {
  return { path, code, message };
}

function zodIssues(error: z.ZodError): readonly CustomAgentValidationIssue[] {
  return error.issues.map((entry) => ({
    path: entry.path.map((part) => (typeof part === 'number' ? `[${part}]` : part)).join('.').replace('.[', '['),
    code: entry.code,
    message: entry.message,
  }));
}

function normalizeOutputSchema(input: z.infer<typeof authoredOutputSchema>): { value?: BoundedOutputSchema; issues: readonly CustomAgentValidationIssue[] } {
  const issues: CustomAgentValidationIssue[] = [];
  const properties: Record<string, NormalizedOutputField> = {};
  const required: string[] = [];

  input.fields.forEach((field, index) => {
    const path = `outputSchema.fields[${index}]`;
    if (field.type !== 'array' && (field.itemType !== undefined || field.maxItems !== undefined)) {
      issues.push(issue(`${path}.itemType`, 'invalid_type', 'Array item settings require an array field'));
    }
    if (field.type === 'array' && (field.itemType === undefined || field.maxItems === undefined)) {
      issues.push(issue(`${path}.maxItems`, 'required', 'Arrays require an item type and maxItems'));
    }
    if (field.type !== 'string' && field.enum !== undefined) {
      issues.push(issue(`${path}.enum`, 'invalid_type', 'Enums are supported only for string fields'));
    }
    if (['grounding', 'evidence', 'citation', 'source', 'finding', 'review', 'candidate', 'signal', 'policy'].some((reserved) => field.name.toLowerCase().includes(reserved))) {
      issues.push(issue(`${path}.name`, 'reserved_field', 'This output channel is server-owned'));
    }
    if (properties[field.name] !== undefined) {
      issues.push(issue(`${path}.name`, 'duplicate', 'Field names must be unique'));
    }
    if (field.type === 'array' && field.itemType !== undefined && field.maxItems !== undefined) {
      properties[field.name] = {
        type: 'array',
        ...(field.description === undefined ? {} : { description: field.description }),
        ...(field.nullable === undefined ? {} : { nullable: field.nullable }),
        items: { type: field.itemType },
        maxItems: field.maxItems,
      };
    } else if (field.type !== 'array') {
      properties[field.name] = {
        type: field.type,
        ...(field.description === undefined ? {} : { description: field.description }),
        ...(field.nullable === undefined ? {} : { nullable: field.nullable }),
        ...(field.enum === undefined ? {} : { enum: field.enum }),
      };
    }
    if (field.required === true) required.push(field.name);
  });

  if (issues.length > 0) return { issues };
  const value = { type: 'object' as const, properties, required };
  const parsed = boundedOutputSchema.safeParse(value);
  return parsed.success ? { value: parsed.data, issues: [] } : { issues: zodIssues(parsed.error) };
}

export function parseCustomAgentCreateInput(input: unknown): CustomAgentParseResult {
  const parsed = customAgentCreateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, issues: zodIssues(parsed.error) };

  const capabilityResult = validateCapabilitySelection({
    targetType: parsed.data.targetType,
    practiceAreaId: parsed.data.practiceAreaId,
    capabilityPresetIds: parsed.data.capabilityPresetIds,
  });
  if (!capabilityResult.ok) return { ok: false, issues: capabilityResult.issues };

  if (parsed.data.outputSchema === null) return { ok: true, value: { ...parsed.data, outputSchema: null } };
  const normalized = normalizeOutputSchema(parsed.data.outputSchema);
  return normalized.value === undefined
    ? { ok: false, issues: normalized.issues }
    : { ok: true, value: { ...parsed.data, outputSchema: normalized.value } };
}

export function parseCustomAgentSaveInput(input: unknown): CustomAgentSaveParseResult {
  const parsed = customAgentSaveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, issues: zodIssues(parsed.error) };

  if (parsed.data.outputSchema === null) return { ok: true, value: { ...parsed.data, outputSchema: null } };
  const normalized = normalizeOutputSchema(parsed.data.outputSchema);
  return normalized.value === undefined
    ? { ok: false, issues: normalized.issues }
    : { ok: true, value: { ...parsed.data, outputSchema: normalized.value } };
}

export type { AnalysisEffort, AnalysisTargetType };
