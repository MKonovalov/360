import 'server-only';

import { z } from 'zod';

import { MAX_BULK_REVIEW_IDS, searchBulkRequestSchema } from './contracts';
import { approveSearchReview, type ApprovalResult } from './approveSearchReview';
import { rejectSearchReview, type RejectionResult } from './rejectSearchReview';

const bulkInputSchema = searchBulkRequestSchema
  .extend({ actorUserId: z.string().trim().min(1).max(200) })
  .strict();

export interface BulkSearchReviewsInput {
  readonly reviewIds: readonly number[];
  readonly action: 'approve' | 'reject';
  readonly actorUserId: string;
  readonly revisions: Readonly<Record<number, number>>;
}

export type BulkSearchReason =
  | 'ineligible'
  | 'stale_revision'
  | 'already_terminal'
  | 'not_found'
  | 'conflict'
  | 'failed';

export type BulkSearchOutcome =
  | { readonly reviewId: number; readonly outcome: 'approved' | 'rejected' }
  | { readonly reviewId: number; readonly outcome: 'skipped' | 'failed'; readonly reason: BulkSearchReason };

export interface BulkSearchCounts {
  readonly approved: number;
  readonly rejected: number;
  readonly skipped: number;
  readonly failed: number;
}

export type BulkSearchResult =
  | { readonly kind: 'invalid_input' }
  | { readonly kind: 'completed'; readonly outcomes: readonly BulkSearchOutcome[]; readonly counts: BulkSearchCounts };

function assertNever(value: never): never {
  throw new Error(`Unhandled Search bulk result: ${String(value)}`);
}

function deduplicateReviewIds(reviewIds: readonly number[]): readonly number[] {
  const seen = new Set<number>();
  return reviewIds.filter((reviewId) => {
    if (seen.has(reviewId)) return false;
    seen.add(reviewId);
    return true;
  });
}

function hasExactRevisionCoverage(reviewIds: readonly number[], revisions: Readonly<Record<string, number>>): boolean {
  const revisionKeys = Object.keys(revisions);
  return revisionKeys.length === reviewIds.length
    && reviewIds.every((reviewId) => revisionKeys.includes(String(reviewId)));
}

function approvalOutcome(reviewId: number, result: ApprovalResult): BulkSearchOutcome {
  switch (result.kind) {
    case 'approved':
      return { reviewId, outcome: 'approved' };
    case 'ambiguous_match':
    case 'inconclusive':
    case 'unknown_buyer_role':
    case 'company_mismatch':
    case 'invalid_persona':
      return { reviewId, outcome: 'skipped', reason: 'ineligible' };
    case 'already_terminal':
      return { reviewId, outcome: 'skipped', reason: 'already_terminal' };
    case 'stale_revision':
      return { reviewId, outcome: 'skipped', reason: 'stale_revision' };
    case 'not_found':
    case 'unauthorized':
      return { reviewId, outcome: 'skipped', reason: 'not_found' };
    case 'conflict':
      return { reviewId, outcome: 'failed', reason: 'conflict' };
    case 'invalid_input':
    case 'persistence_failed':
      return { reviewId, outcome: 'failed', reason: 'failed' };
    default:
      return assertNever(result);
  }
}

function rejectionOutcome(reviewId: number, result: RejectionResult): BulkSearchOutcome {
  switch (result.kind) {
    case 'rejected':
      return { reviewId, outcome: 'rejected' };
    case 'already_terminal':
      return { reviewId, outcome: 'skipped', reason: 'already_terminal' };
    case 'stale_revision':
      return { reviewId, outcome: 'skipped', reason: 'stale_revision' };
    case 'not_found':
    case 'unauthorized':
      return { reviewId, outcome: 'skipped', reason: 'not_found' };
    case 'invalid_input':
    case 'persistence_failed':
      return { reviewId, outcome: 'failed', reason: 'failed' };
    default:
      return assertNever(result);
  }
}

function countOutcomes(outcomes: readonly BulkSearchOutcome[]): BulkSearchCounts {
  const counts = { approved: 0, rejected: 0, skipped: 0, failed: 0 };
  for (const outcome of outcomes) counts[outcome.outcome] += 1;
  return counts;
}

export async function bulkSearchReviews(input: unknown): Promise<BulkSearchResult> {
  const parsed = bulkInputSchema.safeParse(input);
  if (!parsed.success) return { kind: 'invalid_input' };

  const reviewIds = deduplicateReviewIds(parsed.data.reviewIds);
  if (reviewIds.length === 0 || parsed.data.reviewIds.length > MAX_BULK_REVIEW_IDS) return { kind: 'invalid_input' };
  if (!hasExactRevisionCoverage(reviewIds, parsed.data.revisions)) return { kind: 'invalid_input' };

  // Staff authorization belongs to the route boundary. Task 8 still checks ownership for every mutation.
  const outcomes: BulkSearchOutcome[] = [];
  for (const reviewId of reviewIds) {
    const expectedRevision = parsed.data.revisions[String(reviewId)];
    if (expectedRevision === undefined) return { kind: 'invalid_input' };

    try {
      if (parsed.data.action === 'approve') {
        const result = await approveSearchReview({ reviewId, expectedRevision, actorUserId: parsed.data.actorUserId });
        outcomes.push(approvalOutcome(reviewId, result));
      } else {
        const result = await rejectSearchReview({ reviewId, expectedRevision, actorUserId: parsed.data.actorUserId });
        outcomes.push(rejectionOutcome(reviewId, result));
      }
    } catch (error: unknown) {
      if (error instanceof Error) outcomes.push({ reviewId, outcome: 'failed', reason: 'failed' });
      else outcomes.push({ reviewId, outcome: 'failed', reason: 'failed' });
    }
  }

  return { kind: 'completed', outcomes, counts: countOutcomes(outcomes) };
}
