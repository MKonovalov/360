'use client';

import type { ReactNode } from 'react';
import { ExternalLinkIcon, RotateCcwIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { humanizeEnum } from '@/components/explorer/explorer-format';
import { isPrivateOrUnsafeSourceHost, type SearchReviewProjection } from '@/lib/search/contracts';

export type SearchReviewDecisionState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'pending'; readonly action: 'approve' | 'reject' | 'bulk' }
  | { readonly kind: 'success'; readonly message: string }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'stale'; readonly message: string };

export interface SearchReviewCardProps {
  readonly review: SearchReviewProjection;
  readonly selected: boolean;
  readonly selectionDisabled?: boolean;
  readonly decisionState: SearchReviewDecisionState;
  readonly onSelectedChange: (selected: boolean) => void;
  readonly onApprove: () => void;
  readonly onReject: () => void;
  readonly onEdit: () => void;
  readonly onReload: () => void;
  readonly children?: ReactNode;
}

export function canApproveSearchReview(review: SearchReviewProjection): boolean {
  return review.status === 'pending' && review.eligibility.eligible;
}

export function canRejectSearchReview(review: SearchReviewProjection): boolean {
  return review.status !== 'approved' && review.status !== 'rejected';
}

export function isPublicHttpsSourceUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && url.username === ''
      && url.password === ''
      && !isPrivateOrUnsafeSourceHost(url.hostname);
  } catch (error: unknown) {
    if (error instanceof TypeError) return false;
    throw error;
  }
}

export function SearchReviewCard({
  review,
  selected,
  selectionDisabled = false,
  decisionState,
  onSelectedChange,
  onApprove,
  onReject,
  onEdit,
  onReload,
  children,
}: SearchReviewCardProps) {
  const canApprove = canApproveSearchReview(review);
  const canReject = canRejectSearchReview(review);
  const isPending = decisionState.kind === 'pending';
  const approveReason = review.eligibility.eligible
    ? review.status === 'pending' ? undefined : 'Only pending candidates can be approved.'
    : 'Approval unavailable until the candidate is eligible.';
  const statusLabel = humanizeEnum(review.status);

  return (
    <article data-search-review-id={review.reviewId} className="min-w-0 space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="pt-1">
            <Checkbox
              checked={selected}
              disabled={selectionDisabled}
              onCheckedChange={(checked) => onSelectedChange(checked === true)}
              aria-label={`Select ${review.persona.fullName}`}
            />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[18px] font-semibold leading-[1.2] text-slate-900">{review.persona.fullName}</h3>
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">{statusLabel}</span>
            </div>
            <p className="mt-1 text-[14px] leading-[1.5] text-slate-600">Candidate {review.reviewId} · {review.packetCandidateId}</p>
            <p className="text-[14px] leading-[1.5] text-slate-900">{review.persona.title ?? 'Title unavailable'}</p>
            <p className="text-[12px] leading-[1.4] text-slate-500">{review.company.name} · {review.company.domain ?? 'No domain recorded'}</p>
          </div>
        </div>
        <span className="text-[12px] text-slate-500">Revision {review.revision}</span>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <section className="min-w-0 space-y-2" aria-label="Persona details">
          <h4 className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">Persona</h4>
          <dl className="grid min-w-0 gap-x-3 gap-y-1 text-[13px] sm:grid-cols-2">
            <Detail label="Email" value={review.persona.email} />
            <Detail label="Phone" value={review.persona.phone} />
            <Detail label="Location" value={review.persona.location} />
            <Detail label="Department" value={review.persona.department} />
            <Detail label="Function" value={review.persona.function} />
            <Detail label="Seniority" value={review.persona.seniority} />
            <Detail label="LinkedIn" value={review.persona.linkedinUrl} />
            <Detail label="Bio" value={review.persona.bio} />
          </dl>
        </section>

        <section className="min-w-0 space-y-2" aria-label="Buyer Role and match details">
          <h4 className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">Buyer Roles &amp; match</h4>
          <p className="text-[13px] text-slate-700">{matchLabel(review)}</p>
          {review.buyerRoles.length === 0 ? (
            <p className="text-[13px] text-slate-500">No Buyer Roles proposed.</p>
          ) : (
            <ul className="space-y-2">
              {review.buyerRoles.map((role) => (
                <li key={role.buyerRoleId} className="rounded-md border border-slate-100 bg-slate-50 p-2 text-[13px]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-slate-900">{role.buyerRoleName}</span>
                    <span className="text-[12px] text-slate-500">{role.confidence}</span>
                  </div>
                  <p className="mt-1 text-[12px] text-slate-500">Matched rule evidence: {role.matchedRuleIds.join(', ')}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="space-y-2" aria-label="Evidence">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">Evidence</h4>
          <span className="text-[12px] text-slate-500">{review.sources.length} source{review.sources.length === 1 ? '' : 's'}</span>
        </div>
        {review.sources.length === 0 ? (
          <p className="text-[13px] text-slate-500">No source evidence is available.</p>
        ) : (
          <ul className="grid min-w-0 gap-2 sm:grid-cols-2">
            {review.sources.map((source) => (
              <li key={source.packetSourceId} className="min-w-0 rounded-md border border-slate-100 p-2 text-[13px]">
                {isPublicHttpsSourceUrl(source.url) ? (
                  <a href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 text-indigo-600 hover:underline">
                    <span className="truncate">{source.title}</span>
                    <ExternalLinkIcon className="size-3.5 shrink-0" aria-hidden="true" />
                  </a>
                ) : (
                  <span className="text-slate-600">{source.title} <span className="text-[12px] text-amber-700">(link unavailable)</span></span>
                )}
                <p className="mt-1 text-[12px] text-slate-500">{humanizeEnum(source.kind)} · {source.supports.length} claim{source.supports.length === 1 ? '' : 's'}</p>
              </li>
            ))}
          </ul>
        )}
        {review.claims.length > 0 && (
          <ul className="space-y-1 text-[12px] text-slate-600">
            {review.claims.map((claim) => <li key={claim.claimId}><span className="font-medium text-slate-800">{claim.field}:</span> {claim.value}</li>)}
          </ul>
        )}
      </section>

      <section className="space-y-1 rounded-md bg-slate-50 p-3 text-[12px]" aria-label="Review eligibility and audit">
        <p className={review.eligibility.eligible ? 'text-emerald-700' : 'text-amber-700'}>
          {review.eligibility.eligible ? 'Eligible for approval.' : 'Not eligible for approval.'}
        </p>
        {review.eligibility.deficiencies.length > 0 && <ul className="list-disc space-y-1 pl-4 text-amber-700">{review.eligibility.deficiencies.map((item) => <li key={item}>{item}</li>)}</ul>}
        <p className="text-slate-500">Audit: {review.audit.editCount} edits · {review.audit.lastEventType ?? 'No edits recorded'}{review.latestEditor ? ` · latest editor ${review.latestEditor}` : ''}</p>
      </section>

      {children}

      {decisionState.kind === 'stale' && (
        <div className="flex flex-wrap items-center gap-2 text-[14px] text-amber-700" role="alert">
          <span>{decisionState.message}</span>
          <Button type="button" variant="outline" size="sm" onClick={onReload}><RotateCcwIcon className="size-3.5" aria-hidden="true" />Reload latest</Button>
        </div>
      )}
      {(decisionState.kind === 'error' || decisionState.kind === 'success') && (
        <p className={decisionState.kind === 'error' ? 'text-[14px] text-red-600' : 'text-[14px] text-emerald-700'} role={decisionState.kind === 'error' ? 'alert' : 'status'}>{decisionState.message}</p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" disabled={!canApprove || isPending} title={approveReason} onClick={onApprove}>{isPending && decisionState.kind === 'pending' && decisionState.action === 'approve' ? 'Approving…' : 'Approve'}</Button>
          <Button type="button" variant="outline" size="sm" disabled={!canReject || isPending} onClick={onReject}>{isPending && decisionState.kind === 'pending' && decisionState.action === 'reject' ? 'Rejecting…' : 'Reject'}</Button>
          <Button type="button" variant="ghost" size="sm" disabled={!canReject || isPending} onClick={onEdit}>Edit staged fields</Button>
        </div>
        {approveReason && <span className="text-[12px] text-slate-500">{approveReason}</span>}
      </div>
    </article>
  );
}

function Detail({ label, value }: { readonly label: string; readonly value: string | null }) {
  return <div className="min-w-0"><dt className="text-slate-500">{label}</dt><dd className="truncate text-slate-800">{value ?? '—'}</dd></div>;
}

function matchLabel(review: SearchReviewProjection): string {
  switch (review.match.kind) {
    case 'new_persona':
      return 'New Persona candidate';
    case 'existing_persona':
      return `Existing Persona match by ${humanizeEnum(review.match.matchedBy)}`;
    case 'ambiguous':
      return `Ambiguous match by ${humanizeEnum(review.match.matchedBy)}; approval unavailable.`;
    default:
      return assertNever(review.match);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled Search match: ${String(value)}`);
}
