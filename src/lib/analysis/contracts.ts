import { z } from 'zod';
import { SERVABLE_PROVIDERS } from '@/lib/models/catalog';
import type { ModelRef } from '@/lib/models/modelRef';

export const ANALYSIS_RUN_STATUSES = [
  'queued',
  'running',
  'completed',
  'failed',
  'cancelled',
  'pending_review',
  'confirmed',
  'dismissed',
] as const;

export type AnalysisRunStatus = (typeof ANALYSIS_RUN_STATUSES)[number];

export const NONTERMINAL_ANALYSIS_RUN_STATUSES = ['queued', 'running'] as const;
export type NonterminalAnalysisRunStatus = (typeof NONTERMINAL_ANALYSIS_RUN_STATUSES)[number];

const transitions = {
  queued: ['running', 'failed', 'cancelled'],
  running: ['completed', 'failed', 'cancelled'],
  completed: ['pending_review'],
  failed: [],
  cancelled: [],
  pending_review: ['confirmed', 'dismissed'],
  confirmed: [],
  dismissed: [],
} as const satisfies Readonly<Record<AnalysisRunStatus, readonly AnalysisRunStatus[]>>;

export const ANALYSIS_RUN_TRANSITIONS = transitions;

export function canTransitionAnalysisRun(
  fromStatus: AnalysisRunStatus,
  toStatus: AnalysisRunStatus,
): boolean {
  return transitions[fromStatus].some((candidate) => candidate === toStatus);
}

export type AnalysisTransitionOutcome =
  | { readonly ok: true; readonly fromStatus: AnalysisRunStatus; readonly toStatus: AnalysisRunStatus }
  | { readonly ok: false; readonly reason: 'invalid_transition' | 'replayed' };

export function resolveAnalysisTransition(
  fromStatus: AnalysisRunStatus,
  toStatus: AnalysisRunStatus,
  isReplay = false,
): AnalysisTransitionOutcome {
  if (isReplay) return { ok: false, reason: 'replayed' };
  if (!canTransitionAnalysisRun(fromStatus, toStatus)) {
    return { ok: false, reason: 'invalid_transition' };
  }
  return { ok: true, fromStatus, toStatus };
}

export const supportedEfforts = ['standard'] as const;
export type AnalysisEffort = (typeof supportedEfforts)[number];

export const STANDARD_EXECUTION_BUDGET = Object.freeze({
  maxAttempts: 2,
  maxToolCalls: 12,
  maxExecutionSeconds: 300,
  maxSpendUsd: 2.5,
});

export const PHASE32_NOOP_POLICY = Object.freeze({
  schemaVersion: 1,
  mode: 'phase32_noop',
  networkAccess: false,
  writesAllowed: false,
  effectiveMaxAttempts: 1,
  effectiveMaxToolCalls: 0,
  effectiveMaxExecutionSeconds: 5,
  effectiveMaxSpendUsd: 0,
});

export const PHASE33_DEFERRED_POLICY = Object.freeze({
  schemaVersion: 1,
  mode: 'phase33_policy_deferred',
  executionEnabled: false,
  personaExecutionEnabled: false,
  policyVersion: null,
  limits: null,
  personaPolicy: null,
  retention: null,
  evidenceStorage: 'bounded_excerpt_and_content_hash',
  auditVisibility: 'allowlisted_safe_metadata_only',
  failureReason: 'policy_unavailable',
  networkAccess: false,
  writesAllowed: false,
  effectiveMaxAttempts: 0,
  effectiveMaxToolCalls: 0,
  effectiveMaxExecutionSeconds: 0,
  effectiveMaxSpendUsd: 0,
});

// The production-approved grounded policy applied to every non-fixture run
// created through POST /api/analysis-runs. `mode: 'phase33_grounded'` is the
// only phase33 shape the executor will execute (execution.ts:140 parses via
// phase33PolicySnapshotSchema, and phase33_policy_deferred short-circuits to
// policy_unavailable at execution.ts:144-150). It is deliberately NOT derived
// from PHASE36_APPROVED_POLICY — that fixture policy carries a
// 'phase36-fixture-v1' version and is reserved for fixture-mode runs.
//
// personaExecutionEnabled is FALSE for now: the executor hands
// `subjectDisplayName` (a persona's real name, resolved in subjects.ts) to the
// model verbatim via buildGroundedPrompt — the redactPersonaInput allowlist
// gate in personaPolicy.ts is NOT wired into the execution path. Enabling
// persona execution here would send unredacted persona names to the model, a
// PII blocker. Persona runs therefore fail closed with the documented
// `persona_policy_unavailable` reason (execution.ts:151-153) until the
// executor redacts persona input through personaPolicy.ts and a persona
// policy/retention exists (contracts.ts superRefine requires both when
// personaExecutionEnabled is true).
export const PHASE33_STANDARD_APPROVED_POLICY = Object.freeze({
  schemaVersion: 1,
  mode: 'phase33_grounded',
  executionEnabled: true,
  personaExecutionEnabled: false,
  policyVersion: 'phase33-standard-v1',
  limits: Object.freeze({
    // Budget fields derived from STANDARD_EXECUTION_BUDGET.
    maxAttempts: STANDARD_EXECUTION_BUDGET.maxAttempts,
    maxToolCalls: STANDARD_EXECUTION_BUDGET.maxToolCalls,
    maxExecutionSeconds: STANDARD_EXECUTION_BUDGET.maxExecutionSeconds,
    // Source bounds aligned with the webSearch tool's own caps
    // (WEB_SEARCH_LIMITS.maxResults = 5, maxSnippetLength = 8_000) so a
    // legitimate grounded analysis is never rejected by its own policy.
    maxSources: 5,
    maxSourceBytes: 50_000,
    maxExcerptBytes: 8_000,
    maxSpendUsd: STANDARD_EXECUTION_BUDGET.maxSpendUsd,
  }),
  personaPolicy: null,
  retention: null,
  evidenceStorage: 'bounded_excerpt_and_content_hash',
  auditVisibility: 'allowlisted_safe_metadata_only',
  failureReason: null,
  networkAccess: true,
  writesAllowed: false,
  effectiveMaxAttempts: STANDARD_EXECUTION_BUDGET.maxAttempts,
  effectiveMaxToolCalls: STANDARD_EXECUTION_BUDGET.maxToolCalls,
  effectiveMaxExecutionSeconds: STANDARD_EXECUTION_BUDGET.maxExecutionSeconds,
  effectiveMaxSpendUsd: STANDARD_EXECUTION_BUDGET.maxSpendUsd,
});

export const analysisTargetTypes = ['company', 'persona'] as const;
export type AnalysisTargetType = (typeof analysisTargetTypes)[number];

const positiveIdSchema = z.number().int().positive();
const safeNameSchema = z.string().trim().min(1).max(200);
const safeSlugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120);
const safeModelIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^(?!.*:\/\/)[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/);

export const modelRefSchema = z
  .object({
    provider: z.enum(SERVABLE_PROVIDERS),
    modelId: safeModelIdSchema,
  })
  .strict();

export type AnalysisModelRef = ModelRef;

export const analysisRunStatusSchema = z.enum(ANALYSIS_RUN_STATUSES);
export const analysisTargetTypeSchema = z.enum(analysisTargetTypes);
export const analysisEffortSchema = z.enum(supportedEfforts);
export const nonterminalAnalysisRunStatusSchema = z.enum(NONTERMINAL_ANALYSIS_RUN_STATUSES);
export const catalogSignalStatusSchema = z.enum(['active', 'draft', 'retired']);

export const companySubjectSchema = z
  .object({ type: z.literal('company'), id: positiveIdSchema })
  .strict();
export const personaSubjectSchema = z
  .object({ type: z.literal('persona'), id: positiveIdSchema })
  .strict();
export const analysisSubjectSchema = z.discriminatedUnion('type', [
  companySubjectSchema,
  personaSubjectSchema,
]);
export type AnalysisSubject = z.infer<typeof analysisSubjectSchema>;

export const subjectSnapshotSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('company'), id: positiveIdSchema, displayName: safeNameSchema }).strict(),
  z.object({ type: z.literal('persona'), id: positiveIdSchema, displayName: safeNameSchema }).strict(),
]);

export const templateSnapshotSchema = z
  .object({ schemaVersion: z.literal(1), templateId: positiveIdSchema, templateVersionId: positiveIdSchema,
    templateKey: safeSlugSchema, templateName: safeNameSchema, targetType: analysisTargetTypeSchema,
    version: positiveIdSchema, resolvedInstruction: z.string().trim().min(1).max(20_000), effort: analysisEffortSchema })
  .strict();

const budgetSchema = z
  .object({
    maxAttempts: z.literal(2),
    maxToolCalls: z.literal(12),
    maxExecutionSeconds: z.literal(300),
    maxSpendUsd: z.literal(2.5),
  })
  .strict();

export const policySnapshotSchema = z
  .object({ schemaVersion: z.literal(1), mode: z.literal('phase32_noop'), networkAccess: z.literal(false),
    writesAllowed: z.literal(false), effectiveMaxAttempts: z.literal(1), effectiveMaxToolCalls: z.literal(0),
    effectiveMaxExecutionSeconds: z.literal(5), effectiveMaxSpendUsd: z.literal(0) })
  .strict();

const phase33LimitsSchema = z
  .object({
    maxAttempts: z.number().int().positive(),
    maxToolCalls: z.number().int().nonnegative(),
    maxExecutionSeconds: z.number().int().positive(),
    maxSources: z.number().int().positive(),
    maxSourceBytes: z.number().int().positive(),
    maxExcerptBytes: z.number().int().positive(),
    maxSpendUsd: z.number().nonnegative(),
  })
  .strict();

const phase33PersonaPolicySchema = z
  .object({
    version: z.string().trim().min(1).max(120),
    allowlistedFields: z.array(z.string().trim().min(1).max(80)).min(1).max(20),
    redactionRules: z.array(z.string().trim().min(1).max(200)).min(1).max(20),
    classifications: z.array(z.enum(['public_biz', 'personal_data', 'restricted'])).min(1).max(3),
  })
  .strict();

const phase33ApprovedPolicySchema = z
  .object({
    schemaVersion: z.literal(1),
    mode: z.literal('phase33_grounded'),
    executionEnabled: z.literal(true),
    personaExecutionEnabled: z.boolean(),
    policyVersion: z.string().trim().min(1).max(120),
    limits: phase33LimitsSchema,
    personaPolicy: phase33PersonaPolicySchema.nullable(),
    retention: z
      .object({
        durationSeconds: z.number().int().positive(),
        classification: z.enum(['public_biz', 'personal_data', 'restricted']),
      })
      .strict()
      .nullable(),
    evidenceStorage: z.literal('bounded_excerpt_and_content_hash'),
    auditVisibility: z.literal('allowlisted_safe_metadata_only'),
    failureReason: z.null(),
    networkAccess: z.literal(true),
    writesAllowed: z.literal(false),
    effectiveMaxAttempts: z.number().int().positive(),
    effectiveMaxToolCalls: z.number().int().nonnegative(),
    effectiveMaxExecutionSeconds: z.number().int().positive(),
    effectiveMaxSpendUsd: z.number().nonnegative(),
  })
  .strict()
  .superRefine((policy, context) => {
    if (policy.personaExecutionEnabled && (policy.personaPolicy === null || policy.retention === null)) {
      context.addIssue({ code: 'custom', path: ['personaPolicy'], message: 'persona_policy_required' });
    }
  });

export const phase33PolicySnapshotSchema = z.union([
  z
    .object({
      schemaVersion: z.literal(1),
      mode: z.literal('phase33_policy_deferred'),
      executionEnabled: z.literal(false),
      personaExecutionEnabled: z.literal(false),
      policyVersion: z.null(),
      limits: z.null(),
      personaPolicy: z.null(),
      retention: z.null(),
      evidenceStorage: z.literal('bounded_excerpt_and_content_hash'),
      auditVisibility: z.literal('allowlisted_safe_metadata_only'),
      failureReason: z.literal('policy_unavailable'),
      networkAccess: z.literal(false),
      writesAllowed: z.literal(false),
      effectiveMaxAttempts: z.literal(0),
      effectiveMaxToolCalls: z.literal(0),
      effectiveMaxExecutionSeconds: z.literal(0),
      effectiveMaxSpendUsd: z.literal(0),
    })
    .strict(),
  phase33ApprovedPolicySchema,
]);

export type Phase33PolicySnapshot = z.infer<typeof phase33PolicySnapshotSchema>;

export const checklistItemSchema = z
  .object({ signalId: positiveIdSchema, status: z.literal('active'), name: safeNameSchema, category: safeNameSchema,
    description: z.string().trim().min(1).max(2_000), buyerRoleId: positiveIdSchema.optional() })
  .strict();

export const checklistSnapshotSchema = z
  .object({
    schemaVersion: z.literal(1),
    targetType: analysisTargetTypeSchema,
    practiceAreaId: positiveIdSchema,
    practiceAreaName: safeNameSchema,
    items: z.array(checklistItemSchema).max(100),
  })
  .strict();

export const executionSnapshotSchema = z
  .object({
    schemaVersion: z.literal(1),
    effort: analysisEffortSchema,
    resolvedModelChain: z.array(z.union([modelRefSchema, safeModelIdSchema])).min(1).max(8),
    futureBudget: budgetSchema,
    policy: z.union([policySnapshotSchema, phase33PolicySnapshotSchema]),
  })
  .strict();

export const analysisSnapshotSchema = z
  .object({
    schemaVersion: z.literal(1),
    template: templateSnapshotSchema,
    subject: subjectSnapshotSchema,
    checklist: checklistSnapshotSchema,
    execution: executionSnapshotSchema,
    policy: z.union([policySnapshotSchema, phase33PolicySnapshotSchema]),
    templateVersionId: positiveIdSchema,
    subjectType: analysisTargetTypeSchema,
    subjectId: positiveIdSchema,
    practiceAreaId: positiveIdSchema,
  })
  .strict()
  .superRefine((snapshot, context) => {
    if (snapshot.template.targetType !== snapshot.subject.type) {
      context.addIssue({ code: 'custom', path: ['subject', 'type'], message: 'subject_mismatch' });
    }
    if (snapshot.checklist.targetType !== snapshot.subject.type) {
      context.addIssue({ code: 'custom', path: ['checklist', 'targetType'], message: 'subject_mismatch' });
    }
    if (snapshot.subjectType !== snapshot.subject.type || snapshot.subjectId !== snapshot.subject.id) {
      context.addIssue({ code: 'custom', path: ['subjectType'], message: 'subject_mismatch' });
    }
    if (snapshot.templateVersionId !== snapshot.template.templateVersionId) {
      context.addIssue({ code: 'custom', path: ['templateVersionId'], message: 'snapshot_mismatch' });
    }
    if (snapshot.practiceAreaId !== snapshot.checklist.practiceAreaId) {
      context.addIssue({ code: 'custom', path: ['practiceAreaId'], message: 'snapshot_mismatch' });
    }
  });

export type AnalysisSnapshot = z.infer<typeof analysisSnapshotSchema>;
export type ReadonlyAnalysisSnapshot = DeepReadonly<AnalysisSnapshot>;

export const safeOutcomeReasons = [
  'invalid_input',
  'subject_mismatch',
  'active_run_exists',
  'dispatch_failed',
  'execution_failed',
  'timed_out',
  'policy_unavailable',
  'persona_policy_unavailable',
  'cancelled',
  'completed',
  'replayed',
] as const;
export type SafeOutcomeReason = (typeof safeOutcomeReasons)[number];
export const safeOutcomeReasonSchema = z.enum(safeOutcomeReasons);

export const boundedAttemptSchema = z.number().int().min(0).max(2);
export const boundedReasonSchema = z.string().trim().min(1).max(500);
export const safeOutcomeSchema = z
  .object({
    ok: z.boolean(),
    reason: safeOutcomeReasonSchema,
    attempts: boundedAttemptSchema,
  })
  .strict();

export type SafeOutcome = z.infer<typeof safeOutcomeSchema>;

export function safeOutcomeForStatus(status: AnalysisRunStatus): SafeOutcome {
  switch (status) {
    case 'queued':
    case 'running':
      return { ok: true, reason: 'completed', attempts: 0 };
    case 'completed':
    case 'pending_review':
    case 'confirmed':
    case 'dismissed':
      return { ok: true, reason: 'completed', attempts: 0 };
    case 'failed':
      return { ok: false, reason: 'execution_failed', attempts: 0 };
    case 'cancelled':
      return { ok: false, reason: 'cancelled', attempts: 0 };
    default:
      return assertNever(status);
  }
}

export function isCompatibleSubject(
  targetType: AnalysisTargetType,
  subject: AnalysisSubject,
): boolean {
  return targetType === subject.type;
}

export function parseAnalysisSnapshot(input: unknown): ReadonlyAnalysisSnapshot {
  return freeze(analysisSnapshotSchema.parse(input));
}

type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer U)[]
    ? readonly DeepReadonly<U>[]
    : T extends object
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
      : T;

function freeze<T>(value: T): DeepReadonly<T> {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const key of Reflect.ownKeys(value)) {
      const child = Reflect.get(value, key);
      if (child !== null && typeof child === 'object') freeze(child);
    }
    Object.freeze(value);
  }
  return value as DeepReadonly<T>;
}

function assertNever(value: never): never {
  throw new Error(`Unexpected analysis status: ${String(value)}`);
}
