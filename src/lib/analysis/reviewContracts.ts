import { z } from 'zod';

import { analysisRunStatusSchema, analysisTargetTypeSchema } from './contracts';

// D-34-02: one whole-run terminal decision. Closed enum mirrors the
// analysis_review_decision DB enum — a client can never invent an
// open-ended or partial decision (T-34-01).
export const WHOLE_RUN_DECISIONS = ['confirmed', 'dismissed'] as const;
export type WholeRunDecision = (typeof WHOLE_RUN_DECISIONS)[number];
export const wholeRunDecisionSchema = z.enum(WHOLE_RUN_DECISIONS);

// D-34-03: only strong/weak findings with persisted source links are candidate
// evidence; no_evidence and inconclusive are excluded by contract.
export const CANDIDATE_ELIGIBLE_EVIDENCE_STATUSES = ['strong', 'weak'] as const;
export type CandidateEligibleEvidenceStatus = (typeof CANDIDATE_ELIGIBLE_EVIDENCE_STATUSES)[number];

const positiveIdSchema = z.number().int().positive();
const nonnegativeIntSchema = z.number().int().nonnegative();
const safeNameSchema = z.string().trim().min(1).max(200);
const safeIdentifierSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/);
const packetHashSchema = z.string().regex(/^[a-f0-9]{64}$/);
// Server-derived Clerk staff user id (opaque, like userModelSettings) — output-only.
const serverActorIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/);
const serverTimestampSchema = z.string().datetime({ offset: true });
const boundedExcerptSchema = z.string().trim().min(1).max(8_000);
const safeUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(2_048)
  .url()
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        url.protocol === 'https:' &&
        url.username === '' &&
        url.password === '' &&
        !/(?:database_url|api[_-]?key|token|secret|clerk|session)/i.test(url.toString())
      );
    } catch {
      return false;
    }
  }, 'unsupported_source');
const signalRecordTypeSchema = z.enum(['company', 'persona']);

// D-34-01/D-34-02: reconciliation and decision actions accept only a positive
// run ID plus the closed decision. Actor identity, decision timestamp, and
// packet hash are server-result fields (T-34-02); packet payloads are never
// client input and cannot be mutated through these contracts.
export const reconcileReviewInputSchema = z.object({ runId: positiveIdSchema }).strict();
export type ReconcileReviewInput = z.infer<typeof reconcileReviewInputSchema>;

export const decideRunInputSchema = z
  .object({ runId: positiveIdSchema, decision: wholeRunDecisionSchema })
  .strict();
export type DecideRunInput = z.infer<typeof decideRunInputSchema>;

export const reviewDecisionFailureReasonSchema = z.enum([
  'invalid_input',
  'missing_packet',
  'not_pending_review',
  'replayed',
  'race_loser',
  'not_found',
]);
export type ReviewDecisionFailureReason = z.infer<typeof reviewDecisionFailureReasonSchema>;

// Server-result union: the persisted winner (replayed flag distinguishes a
// retry/race-loser replay from a fresh decision) or a safe failure reason.
export const reviewDecisionOutcomeSchema = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      runId: positiveIdSchema,
      resultId: positiveIdSchema,
      decision: wholeRunDecisionSchema,
      decidedBy: serverActorIdSchema,
      decidedAt: serverTimestampSchema,
      packetHash: packetHashSchema,
      replayed: z.boolean(),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: reviewDecisionFailureReasonSchema,
    })
    .strict(),
]);
export type ReviewDecisionOutcome = z.infer<typeof reviewDecisionOutcomeSchema>;

export const reconcileReviewFailureReasonSchema = z.enum([
  'invalid_input',
  'missing_packet',
  'not_completed',
  'not_found',
]);
export type ReconcileReviewFailureReason = z.infer<typeof reconcileReviewFailureReasonSchema>;

export const reconcileReviewResultSchema = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      runId: positiveIdSchema,
      resultId: positiveIdSchema,
      packetHash: packetHashSchema,
      replayed: z.boolean(),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: reconcileReviewFailureReasonSchema,
    })
    .strict(),
]);
export type ReconcileReviewResult = z.infer<typeof reconcileReviewResultSchema>;

// REV-01: one run-level review-list item per completed packet. targetType plus
// subjectId is retained everywhere (bare IDs are ambiguous across Company and
// Persona serial spaces); authoritative state is analysis_run.status.
export const reviewItemSchema = z
  .object({
    runId: positiveIdSchema,
    status: analysisRunStatusSchema,
    targetType: analysisTargetTypeSchema,
    subjectId: positiveIdSchema,
    subjectDisplayName: safeNameSchema,
    templateName: safeNameSchema,
    practiceAreaName: safeNameSchema,
    resultId: positiveIdSchema,
    packetHash: packetHashSchema,
    findingCount: nonnegativeIntSchema,
    sourceCount: nonnegativeIntSchema,
    linkCount: nonnegativeIntSchema,
    completedAt: serverTimestampSchema.nullable(),
    decidedBy: serverActorIdSchema.nullable().optional(),
    decidedAt: serverTimestampSchema.nullable().optional(),
    decision: wholeRunDecisionSchema.nullable().optional(),
  })
  .strict();
export type ReviewItem = z.infer<typeof reviewItemSchema>;

// D-34-04: the polymorphic link identity is a historical provenance fact; the
// display status is a separate, active-by-default field. Retired/draft
// historical identities stay represented in provenance instead of being
// silently reclassified.
const linkIdentitySchema = z
  .object({
    signalType: signalRecordTypeSchema,
    signalId: positiveIdSchema,
    offeringId: positiveIdSchema,
    status: z.enum(['active', 'draft', 'retired']),
  })
  .strict();
export type LinkIdentity = z.infer<typeof linkIdentitySchema>;

// D-34-03/D-34-04/REV-04/REV-05: one normalized confirmed candidate evidence
// row. Positive confirmed-only predicate lives in the query (34-02); this
// contract rejects non-eligible evidence statuses and missing provenance
// identity at parse time.
export const confirmedCandidateEvidenceSchema = z
  .object({
    targetType: analysisTargetTypeSchema,
    subjectId: positiveIdSchema,
    offeringId: positiveIdSchema,
    analysisRunId: positiveIdSchema,
    resultId: positiveIdSchema,
    packetHash: packetHashSchema,
    findingRowId: positiveIdSchema,
    findingKey: safeIdentifierSchema,
    signalType: signalRecordTypeSchema,
    signalId: positiveIdSchema,
    signalName: safeNameSchema,
    evidenceStatus: z.enum(CANDIDATE_ELIGIBLE_EVIDENCE_STATUSES),
    supportRole: z.enum(['primary', 'corroborating']),
    sourceRowId: positiveIdSchema,
    sourceKey: safeIdentifierSchema,
    canonicalUrl: safeUrlSchema,
    sourceTitle: safeNameSchema.max(500),
    retrievedAt: serverTimestampSchema,
    excerpt: boundedExcerptSchema,
    displayStatus: z.enum(['active', 'draft', 'retired']),
    linkIdentity: linkIdentitySchema,
  })
  .strict()
  .superRefine((candidate, context) => {
    if (candidate.linkIdentity.signalId !== candidate.signalId) {
      context.addIssue({ code: 'custom', path: ['linkIdentity'], message: 'signal_identity_mismatch' });
    }
    if (candidate.linkIdentity.signalType !== candidate.signalType) {
      context.addIssue({ code: 'custom', path: ['linkIdentity'], message: 'signal_discriminator_mismatch' });
    }
    if (candidate.linkIdentity.offeringId !== candidate.offeringId) {
      context.addIssue({ code: 'custom', path: ['linkIdentity'], message: 'offering_identity_mismatch' });
    }
  });
export type ConfirmedCandidateEvidence = z.infer<typeof confirmedCandidateEvidenceSchema>;

export function isEligibleCandidateEvidence(
  status: string,
): status is CandidateEligibleEvidenceStatus {
  return (CANDIDATE_ELIGIBLE_EVIDENCE_STATUSES as readonly string[]).includes(status);
}

// REV-05: only an explicitly confirmed run status is a candidate source.
export function isConfirmedRunStatus(status: string): boolean {
  return status === 'confirmed';
}

// D-34-04: active offerings are the default display rows; draft/retired are
// historical identities that remain in provenance.
export function isActiveCandidateDisplay(status: string): boolean {
  return status === 'active';
}

// D-34-04/Pitfall 5: deterministic ordering of candidate evidence rows without
// dropping duplicate provenance. Distinct findings/sources supporting the same
// offering stay as separate rows; consumers may collapse at the final
// projection while retaining an ordered provenance array.
export function normalizeCandidateEvidence(
  rows: readonly ConfirmedCandidateEvidence[],
): readonly ConfirmedCandidateEvidence[] {
  return [...rows].sort((left, right) => {
    const leftKey = `${left.analysisRunId}:${left.findingRowId}:${left.sourceRowId}`;
    const rightKey = `${right.analysisRunId}:${right.findingRowId}:${right.sourceRowId}`;
    if (leftKey < rightKey) return -1;
    if (leftKey > rightKey) return 1;
    return 0;
  });
}
