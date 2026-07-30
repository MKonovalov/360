import { getSignalTypeBreakdown } from '@/lib/db/queries/stats';
import { SignalBadge } from '@/components/companies/signal-badge';

// EXPL-06: this widget's own try/catch is fully independent of the other
// three dashboard widgets — a failure here must never blank the rest of the
// page. No distinct all-zero empty state — getSignalTypeBreakdown() always
// zero-fills all 4 signal types, and a breakdown of nothing is still a
// valid, informative state (06-UI-SPEC.md Copywriting Contract).
export async function SignalBreakdown() {
  let rows: Awaited<ReturnType<typeof getSignalTypeBreakdown>>;
  try {
    rows = await getSignalTypeBreakdown();
  } catch {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-6 text-center">
        <p className="text-[18px] font-semibold leading-[1.2] text-slate-900">
          {"Couldn't load signal breakdown"}
        </p>
        <p className="text-sm text-slate-500">
          Something went wrong fetching this data. Try refreshing the page.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-[18px] font-semibold leading-[1.2] text-slate-900">Signal Breakdown</h2>
      <div className="mt-4 space-y-2">
        {rows.map(({ signalType, count }) => (
          <div key={signalType} className="flex items-center justify-between gap-2 text-sm">
            <SignalBadge signalType={signalType} />
            <span className="text-slate-900">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
