import { RunReviewCard } from './run-review-card';
import type { RunReviewCardData } from './run-review-card';

// Server component: additive v1.7 whole-run review section rendered below the
// unchanged legacy proposal queue (REV-01). items === null is the page's
// fetch-failure sentinel and renders a per-widget error card (EXPL-06 pattern,
// same copy shape as every dashboard widget); an empty array is the healthy
// empty state. Dedupes by runId defensively — the server list is already one
// item per run, but a duplicate key must never render the same run twice.
export function RunReviewSection({ items }: { items: RunReviewCardData[] | null }) {
  const uniqueItems =
    items === null
      ? null
      : [...new Map(items.map((item) => [item.runId, item])).values()];

  return (
    <section aria-labelledby="run-review-heading" className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 id="run-review-heading" className="text-[18px] font-semibold leading-[1.2] text-slate-900">
          Analysis Run Reviews
        </h2>
        <span className="inline-flex rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
          v1.7
        </span>
      </div>

      {uniqueItems === null ? (
        <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-8 text-center">
          <p className="text-[18px] font-semibold leading-[1.2] text-slate-900">
            Couldn&apos;t load run reviews
          </p>
          <p className="text-sm text-slate-500">
            Something went wrong fetching this data. Try refreshing the page.
          </p>
        </div>
      ) : uniqueItems.length === 0 ? (
        <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-8 text-center">
          <p className="text-[18px] font-semibold leading-[1.2] text-slate-900">
            No analysis runs to review
          </p>
          <p className="text-sm text-slate-500">
            Completed analysis runs awaiting a whole-run decision appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {uniqueItems.map((item) => (
            <RunReviewCard key={item.runId} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}
