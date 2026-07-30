import Link from 'next/link';
import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { listRecentlyViewedForUser } from '@/lib/db/queries/recentlyViewed';
import { getCompanyById } from '@/lib/db/queries/companies';
import { getPersonaById } from '@/lib/db/queries/personas';

// Pitfall 3 (06-RESEARCH.md): never build the route via naive `${recordType}s`
// pluralization — 'company' incorrectly pluralizes to 'companys'. This
// explicit lookup is the single source of truth for record-type -> route.
const ROUTE_BY_RECORD_TYPE = {
  company: '/companies',
  persona: '/personas',
} as const;

// EXPL-06: this widget's own try/catch is fully independent of the other
// three dashboard widgets — a failure here must never blank the rest of the
// page. userId is derived from this widget's own requireStaffAccess() call
// (T-06-12) — a staff member can only ever see their own recently-viewed
// list, never another user's via a route param or query string.
export async function RecentlyViewed() {
  const { userId } = await requireStaffAccess();

  let rows: Awaited<ReturnType<typeof listRecentlyViewedForUser>>;
  try {
    rows = await listRecentlyViewedForUser(userId, 5);
  } catch {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-6 text-center">
        <p className="text-[18px] font-semibold leading-[1.2] text-slate-900">
          {"Couldn't load recently viewed"}
        </p>
        <p className="text-sm text-slate-500">
          Something went wrong fetching this data. Try refreshing the page.
        </p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-6 text-center">
        <p className="text-[18px] font-semibold leading-[1.2] text-slate-900">
          Nothing viewed yet
        </p>
        <p className="text-sm text-slate-500">
          Companies and Personas you open will show up here.
        </p>
      </div>
    );
  }

  // N+1 acceptable at this scale (max 5 rows) — matches company-list.tsx's
  // existing "N+1 acceptable at this seed-data scale" precedent for
  // resolving related-row display names.
  // Guarded like the initial fetch above — a failure here must also not
  // blank the rest of the page.
  let resolvedRows: ((typeof rows)[number] & { name: string | undefined })[];
  try {
    resolvedRows = await Promise.all(
      rows.map(async (row) => {
        const name =
          row.recordType === 'company'
            ? (await getCompanyById(row.recordId))?.name
            : (await getPersonaById(row.recordId))?.name;
        return { ...row, name };
      })
    );
  } catch {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-6 text-center">
        <p className="text-[18px] font-semibold leading-[1.2] text-slate-900">
          {"Couldn't load recently viewed"}
        </p>
        <p className="text-sm text-slate-500">
          Something went wrong fetching this data. Try refreshing the page.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-[18px] font-semibold leading-[1.2] text-slate-900">Recently Viewed</h2>
      <div className="mt-4 space-y-2">
        {resolvedRows.map((row) => (
          <div
            key={`${row.recordType}-${row.recordId}`}
            className="flex items-center justify-between gap-2 text-sm"
          >
            <Link
              href={`${ROUTE_BY_RECORD_TYPE[row.recordType]}?selected=${row.recordId}`}
              className="text-indigo-600 hover:underline"
            >
              {row.name ?? 'Unknown'}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
