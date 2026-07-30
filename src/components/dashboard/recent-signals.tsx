import Link from 'next/link';
import { listRecentSignals } from '@/lib/db/queries/stats';
import { humanizeEnum, dateFormatter } from '@/components/explorer/explorer-format';

// EXPL-06: this widget's own try/catch is fully independent of the other
// three dashboard widgets — a failure here must never blank the rest of the
// page (enforced structurally by each widget being its own Server Component,
// invoked separately by the page rather than sharing one try/catch).
export async function RecentSignals() {
  let rows: Awaited<ReturnType<typeof listRecentSignals>>;
  try {
    rows = await listRecentSignals(5);
  } catch {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-6 text-center">
        <p className="text-[18px] font-semibold leading-[1.2] text-slate-900">
          {"Couldn't load recent signals"}
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
        <p className="text-[18px] font-semibold leading-[1.2] text-slate-900">No signals yet</p>
        <p className="text-sm text-slate-500">
          {"Signals will appear here once they're detected for a company."}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-[18px] font-semibold leading-[1.2] text-slate-900">Recent Signals</h2>
      <div className="mt-4 space-y-2">
        {rows.map(({ signal, companyName }) => (
          <div key={signal.id} className="flex items-center justify-between gap-2 text-sm">
            <Link
              href={`/companies?selected=${signal.companyId}`}
              className="text-indigo-600 hover:underline"
            >
              {companyName}
            </Link>
            <span className="shrink-0 text-[12px] font-normal leading-[1.4] text-slate-500">
              {humanizeEnum(signal.signalType)} · {dateFormatter.format(new Date(signal.detectedAt))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
