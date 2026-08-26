'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  MAX_BULK_REVIEW_IDS,
  searchBulkResultSchema,
  searchReviewErrorResponseSchema,
  searchReviewResponseSchema,
  type BulkSearchResult,
  type SearchBulkRequest,
  type SearchReviewProjection,
} from '@/lib/search/contracts';

import {
  canApproveSearchReview,
  canRejectSearchReview,
  SearchReviewCard,
  type SearchReviewDecisionState,
} from './SearchReviewCard';
import { SearchReviewEditor, type SearchReviewEditPayload, type SearchReviewRoleOption } from './SearchReviewEditor';

export { canApproveSearchReview } from './SearchReviewCard';

export interface SearchReviewQueueProps {
  readonly reviews: readonly SearchReviewProjection[];
  readonly searchRunId?: number;
  readonly roleOptions: readonly SearchReviewRoleOption[];
  readonly loadError?: boolean;
  readonly onReload?: () => void;
}

type BulkState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'pending'; readonly action: 'approve' | 'reject' }
  | { readonly kind: 'complete'; readonly action: 'approve' | 'reject'; readonly result: BulkSearchResult }
  | { readonly kind: 'error'; readonly message: string };

const ERROR_COPY: Readonly<Record<string, string>> = {
  stale_revision: 'This review changed in another session. Reload the latest version before deciding.',
  review_ineligible: 'This candidate is no longer eligible for that action.',
  already_terminal: 'This review already has a terminal decision.',
  search_review_not_found: 'This review is no longer available.',
  unknown_buyer_role: 'One of the selected Buyer Roles is no longer available.',
  persistence_unavailable: 'The Search review could not be saved. Try again.',
};

function canBulkDecide(review: SearchReviewProjection, action: SearchBulkRequest['action']): boolean {
  switch (action) {
    case 'approve':
      return canApproveSearchReview(review);
    case 'reject':
      return canRejectSearchReview(review);
    default:
      return assertNever(action);
  }
}

export function getBulkSearchReviewIds(input: {
  readonly reviews: readonly SearchReviewProjection[];
  readonly selectedReviewIds: readonly number[];
  readonly action: SearchBulkRequest['action'];
}): readonly number[] {
  const reviewById = new Map(input.reviews.map((review) => [review.reviewId, review]));
  return input.selectedReviewIds
    .filter((id) => {
      const review = reviewById.get(id);
      return review !== undefined && canBulkDecide(review, input.action);
    })
    .slice(0, MAX_BULK_REVIEW_IDS);
}

export function buildBulkSearchRequest(input: {
  readonly reviews: readonly SearchReviewProjection[];
  readonly selectedReviewIds: readonly number[];
  readonly action: SearchBulkRequest['action'];
}): SearchBulkRequest {
  const reviewById = new Map(input.reviews.map((review) => [review.reviewId, review]));
  const reviewIds = [...getBulkSearchReviewIds(input)];
  const revisions = Object.fromEntries(reviewIds.map((id) => [id, reviewById.get(id)?.revision ?? 0]));
  return { reviewIds, action: input.action, revisions };
}

export function bulkSearchSummary(result: BulkSearchResult): string {
  switch (result.kind) {
    case 'invalid_input':
      return 'Bulk decision could not be started. Refresh and try again.';
    case 'completed':
      return `${result.counts.approved} approved · ${result.counts.rejected} rejected · ${result.counts.skipped} skipped · ${result.counts.failed} failed`;
    default:
      return assertNever(result);
  }
}

export function SearchReviewQueue({ reviews, searchRunId, roleOptions, loadError = false, onReload }: SearchReviewQueueProps) {
  const [items, setItems] = useState<readonly SearchReviewProjection[]>(() => [...reviews]);
  const [selectedIds, setSelectedIds] = useState<readonly number[]>([]);
  const [decisionStates, setDecisionStates] = useState<Record<number, SearchReviewDecisionState>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEditId, setSavingEditId] = useState<number | null>(null);
  const [bulkState, setBulkState] = useState<BulkState>({ kind: 'idle' });

  useEffect(() => {
    setItems([...reviews]);
    setSelectedIds([]);
    setDecisionStates({});
  }, [reviews]);

  const eligibleIds = items.filter(canApproveSearchReview).slice(0, MAX_BULK_REVIEW_IDS).map((review) => review.reviewId);
  const selectedEligibleIds = getBulkSearchReviewIds({ reviews: items, selectedReviewIds: selectedIds, action: 'approve' });
  const selectedRejectableIds = getBulkSearchReviewIds({ reviews: items, selectedReviewIds: selectedIds, action: 'reject' });

  function setDecision(reviewId: number, state: SearchReviewDecisionState) {
    setDecisionStates((previous) => ({ ...previous, [reviewId]: state }));
  }

  function setStatus(reviewId: number, status: SearchReviewProjection['status']) {
    setItems((previous) => previous.map((item) => item.reviewId === reviewId ? { ...item, status } : item));
  }

  async function decide(review: SearchReviewProjection, action: 'approve' | 'reject') {
    if ((action === 'approve' && !canApproveSearchReview(review)) || (action === 'reject' && !canRejectSearchReview(review))) return;
    setDecision(review.reviewId, { kind: 'pending', action });
    try {
      const response = await fetch(`/api/search-reviews/${review.reviewId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedRevision: review.revision }),
      });
      const payload = await readResponseJson(response);
      if (!response.ok) {
        setDecision(review.reviewId, response.status === 409 && isError(payload, 'stale_revision')
          ? { kind: 'stale', message: ERROR_COPY.stale_revision }
          : { kind: 'error', message: errorCopy(payload) });
        return;
      }
      setStatus(review.reviewId, action === 'approve' ? 'approved' : 'rejected');
      setSelectedIds((previous) => previous.filter((id) => id !== review.reviewId));
      setDecision(review.reviewId, { kind: 'success', message: action === 'approve' ? 'Approved.' : 'Rejected.' });
    } catch (error: unknown) {
      setDecision(review.reviewId, { kind: 'error', message: error instanceof Error ? 'The Search review request failed. Try again.' : 'The Search review request failed. Try again.' });
    }
  }

  async function saveEdit(review: SearchReviewProjection, payload: SearchReviewEditPayload) {
    setSavingEditId(review.reviewId);
    setEditError(null);
    try {
      const response = await fetch(`/api/search-reviews/${review.reviewId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedRevision: review.revision, ...payload }),
      });
      const body = await readResponseJson(response);
      if (!response.ok) {
        setEditError(response.status === 409 && isError(body, 'stale_revision') ? ERROR_COPY.stale_revision : errorCopy(body));
        return;
      }
      const parsed = searchReviewResponseSchema.safeParse(body);
      if (!parsed.success) {
        setEditError('The latest Search review could not be loaded. Reload and try again.');
        return;
      }
      setItems((previous) => previous.map((item) => item.reviewId === review.reviewId ? parsed.data.review : item));
      setEditingId(null);
    } catch (error: unknown) {
      setEditError(error instanceof Error ? 'The staged edit request failed. Try again.' : 'The staged edit request failed. Try again.');
    } finally {
      setSavingEditId(null);
    }
  }

  async function decideBulk(action: 'approve' | 'reject') {
    const request = buildBulkSearchRequest({ reviews: items, selectedReviewIds: selectedIds, action });
    if (request.reviewIds.length === 0) return;
    setBulkState({ kind: 'pending', action });
    try {
      const response = await fetch('/api/search-reviews/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      const payload = await readResponseJson(response);
      const parsed = searchBulkResultSchema.safeParse(payload);
      if (!response.ok || !parsed.success) {
        setBulkState({ kind: 'error', message: errorCopy(payload) });
        return;
      }
      const result = parsed.data;
      if (result.kind === 'completed') {
        for (const outcome of result.outcomes) {
          setDecision(outcome.reviewId, outcomeState(outcome));
          if (outcome.outcome === 'approved' || outcome.outcome === 'rejected') setStatus(outcome.reviewId, outcome.outcome);
        }
      }
      setSelectedIds((previous) => previous.filter((id) => !request.reviewIds.includes(id)));
      setBulkState({ kind: 'complete', action, result });
    } catch (error: unknown) {
      setBulkState({ kind: 'error', message: error instanceof Error ? 'The bulk Search review request failed. Successful rows remain unchanged.' : 'The bulk Search review request failed. Successful rows remain unchanged.' });
    }
  }

  const reload = onReload ?? (() => {
    if (typeof window !== 'undefined') window.location.reload();
  });

  return (
    <section aria-labelledby="search-review-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="search-review-heading" className="text-[18px] font-semibold leading-[1.2] text-slate-900">Search Reviews</h2>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">separate queue</span>
          </div>
          <p className="mt-1 text-sm text-slate-500">Review Search candidates without mixing them with Analyze runs or signal proposals.</p>
        </div>
        {searchRunId !== undefined && <span className="text-[12px] text-slate-500">Search run #{searchRunId}</span>}
      </div>

      {loadError ? (
        <EmptyState title="Couldn&apos;t load Search Reviews" copy="Something went wrong fetching this Search run. Try refreshing the page." action={reload} />
      ) : searchRunId === undefined ? (
        <EmptyState title="No Search run selected" copy="Open a succeeded Search run to review its normalized candidates." />
      ) : items.length === 0 ? (
        <EmptyState title="No Search candidates to review" copy="This Search run has no normalized candidates. Nothing was added to the legacy review queues." />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <span className="mr-auto text-[13px] text-slate-600">{selectedRejectableIds.length} selected · {selectedEligibleIds.length} eligible to approve · max {MAX_BULK_REVIEW_IDS} per action</span>
            <Button type="button" variant="outline" size="sm" onClick={() => setSelectedIds(eligibleIds)}>Select eligible</Button>
            <Button type="button" size="sm" disabled={selectedEligibleIds.length === 0 || bulkState.kind === 'pending'} onClick={() => void decideBulk('approve')}>Approve eligible</Button>
            <Button type="button" variant="outline" size="sm" disabled={selectedRejectableIds.length === 0 || bulkState.kind === 'pending'} onClick={() => void decideBulk('reject')}>Reject selected</Button>
          </div>
          {bulkState.kind === 'pending' && <p className="text-sm text-slate-500" role="status">Submitting independent {bulkState.action} decisions…</p>}
          {bulkState.kind === 'complete' && <p className="text-sm text-emerald-700" role="status">{bulkSearchSummary(bulkState.result)}</p>}
          {bulkState.kind === 'error' && <p className="text-sm text-red-600" role="alert">{bulkState.message}</p>}
          <div className="space-y-3">
            {items.map((review) => (
              <SearchReviewCard
                key={review.reviewId}
                review={review}
                selected={selectedIds.includes(review.reviewId)}
                selectionDisabled={!canRejectSearchReview(review) || bulkState.kind === 'pending'}
                decisionState={decisionStates[review.reviewId] ?? { kind: 'idle' }}
                onSelectedChange={(selected) => setSelectedIds((previous) => selected ? [...new Set([...previous, review.reviewId])].slice(0, MAX_BULK_REVIEW_IDS) : previous.filter((id) => id !== review.reviewId))}
                onApprove={() => void decide(review, 'approve')}
                onReject={() => void decide(review, 'reject')}
                onEdit={() => { setEditingId(review.reviewId); setEditError(null); }}
                onReload={reload}
              >
                {editingId === review.reviewId && canRejectSearchReview(review) && (
                  <SearchReviewEditor review={review} roleOptions={roleOptions} isSaving={savingEditId === review.reviewId} errorMessage={editError} onCancel={() => setEditingId(null)} onSave={(payload) => void saveEdit(review, payload)} />
                )}
              </SearchReviewCard>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function outcomeState(outcome: Exclude<BulkSearchResult, { readonly kind: 'invalid_input' }>['outcomes'][number]): SearchReviewDecisionState {
  switch (outcome.outcome) {
    case 'approved':
      return { kind: 'success', message: 'Approved in bulk.' };
    case 'rejected':
      return { kind: 'success', message: 'Rejected in bulk.' };
    case 'skipped':
      return outcome.reason === 'stale_revision'
        ? { kind: 'stale', message: ERROR_COPY.stale_revision }
        : { kind: 'error', message: `Skipped: ${outcome.reason.replaceAll('_', ' ')}.` };
    case 'failed':
      return { kind: 'error', message: `Failed: ${outcome.reason.replaceAll('_', ' ')}.` };
    default:
      return assertNever(outcome);
  }
}

function errorCopy(payload: unknown): string {
  const parsed = searchReviewErrorResponseSchema.safeParse(payload);
  return parsed.success ? ERROR_COPY[parsed.data.error] ?? 'The Search review action could not be completed. Try again.' : 'The Search review action could not be completed. Try again.';
}

function isError(payload: unknown, expected: string): boolean {
  const parsed = searchReviewErrorResponseSchema.safeParse(payload);
  return parsed.success && parsed.data.error === expected;
}

async function readResponseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch (error: unknown) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
}

function EmptyState({ title, copy, action }: { readonly title: string; readonly copy: string; readonly action?: () => void }) {
  return <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-8 text-center"><p className="text-[18px] font-semibold leading-[1.2] text-slate-900">{title}</p><p className="text-sm text-slate-500">{copy}</p>{action && <Button type="button" variant="outline" size="sm" onClick={action}>Reload</Button>}</div>;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled Search bulk result: ${String(value)}`);
}
