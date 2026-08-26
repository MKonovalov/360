import 'server-only';

import { z } from 'zod';

import { isSearchEnabled } from './templateContracts';
import { searchRunStatusSchema } from './contracts';

// Task 14 (2026-08-25-search-job): local, dependency-free Search
// observability. No external telemetry SDK, no network call — every event is
// a bounded, allow-listed local metric written to stdout so it rides the
// existing log pipeline without a new provider (MUST NOT DO: no logging
// providers, no external telemetry SDKs).
//
// Every event kind below is keyed to the ID that is genuinely available at
// its real production call site — a run ID inside run-lifecycle functions
// (reconcileSearchRun, submitSearchJob, processSearchTerminalResult), a
// review ID inside review-decision functions (approveSearchReview,
// bulkSearchReviews) that never carry the parent run ID without an extra
// query. Every field is a closed-set enum, a bounded count, or a boolean —
// there is no free-text field anywhere in this schema, so raw packet
// content, resolved instructions, private reasoning, source contents,
// partner credentials, mapping identity, request IDs, and user PII cannot
// reach an event even by caller mistake — the strict discriminated union
// rejects anything outside its known shape.

const searchRunIdSchema = z.number().int().positive().max(2_147_483_647);
const reviewIdSchema = z.number().int().positive().max(2_147_483_647);
const boundedCountSchema = z.number().int().nonnegative().max(1_000);
const packetByteCountSchema = z.number().int().nonnegative().max(2_000_000);

// Mirrors ArcAgentnetClientResult's failure `kind` union exactly
// (src/lib/arc-agentnet/client.ts) — the only two Search call sites that can
// fail against the partner (submitSearchJob dispatch, pollSearchJob/
// reconcileSearchRun poll) already narrow to this same closed set.
const partnerFailureReasonSchema = z.enum([
  'not_configured',
  'network',
  'invalid_input',
  'invalid_response',
  'http_error',
  'job_expired',
  'persistence',
]);

const lifecycleEventSchema = z.object({
  kind: z.literal('lifecycle'),
  searchRunId: searchRunIdSchema,
  status: searchRunStatusSchema,
}).strict();

const normalizationEventSchema = z.object({
  kind: z.literal('normalization'),
  searchRunId: searchRunIdSchema,
  packetByteCount: packetByteCountSchema,
  packetValid: z.boolean(),
}).strict();

// Sourced directly from processSearchTerminalResult's own loop counters and
// SearchTerminalResultSummary shape (@/lib/db/schema) — no field here is
// invented for telemetry; every one is already computed for persistence.
const candidateCountsEventSchema = z.object({
  kind: z.literal('candidate_counts'),
  searchRunId: searchRunIdSchema,
  candidateCount: boundedCountSchema,
  sourceCount: boundedCountSchema,
  inconclusiveCount: boundedCountSchema,
  ambiguousCount: boundedCountSchema,
  normalizedCandidateCount: boundedCountSchema,
}).strict();

// duplicatePreventedCount folds companyPersonaRole reuse and Buyer Role link
// reuse from a single approveSearchReview() call's ApprovalResult;
// auditRecorded folds "audit completeness" into the same event (auditIds
// length > 0) rather than a synthetic separate metric kind with no seam of
// its own.
const approvalEventSchema = z.object({
  kind: z.literal('approval'),
  reviewId: reviewIdSchema,
  conflictCount: boundedCountSchema,
  duplicatePreventedCount: boundedCountSchema,
  auditRecorded: z.boolean(),
}).strict();

const dispatchErrorEventSchema = z.object({
  kind: z.literal('dispatch_error'),
  searchRunId: searchRunIdSchema,
  reason: partnerFailureReasonSchema,
}).strict();

const pollErrorEventSchema = z.object({
  kind: z.literal('poll_error'),
  searchRunId: searchRunIdSchema,
  reason: partnerFailureReasonSchema,
}).strict();

// Field names mirror SEARCH_OUTCOMES exactly (contracts.ts) — spelled out
// explicitly rather than generated from that array so zod's static inference
// stays sound (a computed-key object schema loses per-field types).
// bulkSearchReviews() has no single parent run ID for an arbitrary batch, so
// the batch's first (deduplicated) review ID is the correlator, mirroring
// the single-approval event's reviewId identity.
const bulkOutcomeEventSchema = z.object({
  kind: z.literal('bulk_outcome'),
  reviewId: reviewIdSchema,
  approved: boundedCountSchema,
  rejected: boundedCountSchema,
  skipped: boundedCountSchema,
  failed: boundedCountSchema,
}).strict();

const searchMetricEventSchema = z.discriminatedUnion('kind', [
  lifecycleEventSchema,
  normalizationEventSchema,
  candidateCountsEventSchema,
  approvalEventSchema,
  dispatchErrorEventSchema,
  pollErrorEventSchema,
  bulkOutcomeEventSchema,
]);

export type SearchMetricEvent = z.infer<typeof searchMetricEventSchema>;

// Disabled by default (D-Task14): mirrors isSearchEnabled's own
// unset/'false'/'0'/'off' => disabled default (src/lib/env.ts), so a rolled-
// back or not-yet-enabled Search deployment emits zero metrics — there is no
// separate telemetry flag to drift out of sync with the rollout flag, and no
// dependency on the unrelated COMPANY_ANALYSIS_ARC_AGENTNET_ENABLED flag
// (flag isolation).
export function recordSearchMetric(event: SearchMetricEvent): void {
  if (!isSearchEnabled()) return;

  // Best-effort, contained (MUST DO): telemetry must never change a Search
  // business outcome. Fail closed on an unvalidated/forged shape (parse,
  // don't validate — the same boundary discipline every Search route/query
  // module already applies), and catch every hazard from serialization
  // through the sink itself so a metric-recording fault can never propagate
  // into the caller's control flow (dispatch, approval, bulk, reconcile).
  try {
    const parsed = searchMetricEventSchema.safeParse(event);
    if (!parsed.success) return;
    console.info(JSON.stringify({ schemaVersion: 1, source: 'search', ...parsed.data }));
  } catch {
    // Swallowed intentionally: a telemetry-sink fault must never surface as
    // a Search failure.
  }
}
