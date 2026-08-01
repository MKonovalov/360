import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { listPendingProposals } from '@/lib/db/queries/proposals';
import { ReviewQueue } from '@/components/reviews/review-queue';

// Belt-and-suspenders alongside the (dashboard) layout's auth gate
// (02-RESEARCH.md Pitfall 4) — every page in the group gates itself too, so
// the check can never be skipped by a future refactor of the layout alone.
// The surrounding AppShellLayout comes from src/app/(dashboard)/layout.tsx.
//
// T-09-06: the queue is read-only for non-staff — accept/reject are separate
// staff-gated Server Actions (reviews.ts), so a layout-only bypass still
// cannot mutate anything.
export default async function ReviewsPage() {
  await requireStaffAccess();

  // EXPL-06: a DB-fetch failure degrades to the established per-widget error
  // card (same copy shape as every dashboard widget), never Next.js's default
  // 500 page.
  let proposals: Awaited<ReturnType<typeof listPendingProposals>>;
  try {
    proposals = await listPendingProposals();
  } catch {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-8 text-center">
        <p className="text-[18px] font-semibold leading-[1.2] text-slate-900">
          Couldn't load proposals
        </p>
        <p className="text-sm text-slate-500">
          Something went wrong fetching this data. Try refreshing the page.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-12 p-8">
      <h1 className="text-[24px] font-semibold leading-[1.2] text-slate-900">Review Proposals</h1>
      <ReviewQueue proposals={proposals} />
    </div>
  );
}
