'use client';

import type { SearchRunStatus as SearchRunStatusValue, SearchStatusProjection } from '@/lib/search/contracts';

const STATUS_COPY: Record<SearchRunStatusValue, string> = {
  queued: 'Search is queued and will start shortly.',
  running: 'Search is running. This panel will update automatically.',
  succeeded: 'Search completed.',
  failed: 'Search failed. No candidate changes were saved.',
  cancelled: 'Search was cancelled.',
};

export function searchRunStatusCopy(status: SearchRunStatusValue): string {
  return STATUS_COPY[status];
}

export function SearchRunStatus({ projection }: { readonly projection: SearchStatusProjection }) {
  const { candidateCounts } = projection;
  const hasReviews = candidateCounts.total > 0 && isLocalReviewsUrl(projection.reviewsUrl);

  return (
    <section
      aria-label="Search run status"
      className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Search status</p>
          <p className="mt-1 text-sm font-medium text-slate-900" role="status" aria-live="polite">
            {searchRunStatusCopy(projection.status)}
          </p>
        </div>
        <span className="rounded-full bg-white px-2 py-1 text-xs font-medium capitalize text-slate-600 ring-1 ring-slate-200">
          {projection.status}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-slate-500">Company</dt>
          <dd className="font-medium text-slate-900">{projection.company.name}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Domain</dt>
          <dd className="font-medium text-slate-900">{projection.company.domain ?? 'No domain recorded'}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Template</dt>
          <dd className="font-medium text-slate-900">{projection.template.name}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Candidates</dt>
          <dd className="font-medium text-slate-900">{candidateCounts.total}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        <span>Pending: {candidateCounts.pending}</span>
        <span>Inconclusive: {candidateCounts.inconclusive}</span>
        <span>Ambiguous: {candidateCounts.ambiguous}</span>
        <span>Approved: {candidateCounts.approved}</span>
        <span>Rejected: {candidateCounts.rejected}</span>
      </div>

      {hasReviews && (
        <a
          href={projection.reviewsUrl}
          className="inline-flex text-sm font-medium text-indigo-600 underline-offset-4 hover:underline"
        >
          Review {candidateCounts.total} candidate{candidateCounts.total === 1 ? '' : 's'}
        </a>
      )}
    </section>
  );
}

function isLocalReviewsUrl(url: string | null): url is string {
  return url !== null && url.startsWith('/reviews?searchRunId=') && !url.includes('//');
}
