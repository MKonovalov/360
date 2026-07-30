import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { getDashboardCounts } from '@/lib/db/queries/stats';
import { StatCard } from '@/components/dashboard/stat-card';
import { RecentSignals } from '@/components/dashboard/recent-signals';
import { RecentlyViewed } from '@/components/dashboard/recently-viewed';
import { NeedsAttention } from '@/components/dashboard/needs-attention';
import { SignalBreakdown } from '@/components/dashboard/signal-breakdown';

// Belt-and-suspenders alongside the layout's auth gate (matches every other
// page in the app, e.g. companies/page.tsx) — D-01 fully replaces the app's
// one prior anonymous-access exception (src/app/page.tsx) with the same
// requireStaffAccess() gate every other route already uses.
export default async function StartPage() {
  await requireStaffAccess();

  // A1 (06-RESEARCH.md): "Active Signals" is a plain COUNT(*) FROM signal —
  // no status/soft-delete column exists on the signal table today.
  const counts = await getDashboardCounts();

  return (
    <div className="flex flex-col gap-8 p-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Companies" value={counts.companies} />
        <StatCard label="Personas" value={counts.personas} />
        <StatCard label="Active Signals" value={counts.signals} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RecentSignals />
        <RecentlyViewed />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <NeedsAttention />
        <SignalBreakdown />
      </div>
    </div>
  );
}
