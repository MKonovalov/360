import Link from 'next/link';
import { listNeedsAttention } from '@/lib/db/queries/stats';
import { listSignalsForCompany } from '@/lib/db/queries/signals';
import { SignalBadge } from '@/components/companies/signal-badge';

// EXPL-06: this widget's own try/catch is fully independent of the other
// three dashboard widgets — a failure here must never blank the rest of the
// page.
export async function NeedsAttention() {
  let companies: Awaited<ReturnType<typeof listNeedsAttention>>;
  try {
    companies = await listNeedsAttention(14);
  } catch {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-6 text-center">
        <p className="text-[18px] font-semibold leading-[1.2] text-slate-900">
          {"Couldn't load needs attention"}
        </p>
        <p className="text-sm text-slate-500">
          Something went wrong fetching this data. Try refreshing the page.
        </p>
      </div>
    );
  }

  if (companies.length === 0) {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-6 text-center">
        <p className="text-[18px] font-semibold leading-[1.2] text-slate-900">
          {"You're all caught up"}
        </p>
        <p className="text-sm text-slate-500">
          No high-strength signals are overdue for review.
        </p>
      </div>
    );
  }

  // N+1 acceptable at this scale — matches company-list.tsx's existing
  // precedent for resolving per-row signal badges.
  // Guarded like the initial fetch above — a failure here must also not
  // blank the rest of the page.
  let rowsWithHighSignals: { company: (typeof companies)[number]; highStrengthTypes: string[] }[];
  try {
    rowsWithHighSignals = await Promise.all(
      companies.map(async (company) => {
        const signals = await listSignalsForCompany(company.id);
        const highStrengthTypes = Array.from(
          new Set(signals.filter((s) => s.strength === 'high').map((s) => s.signalType))
        );
        return { company, highStrengthTypes };
      })
    );
  } catch {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-6 text-center">
        <p className="text-[18px] font-semibold leading-[1.2] text-slate-900">
          {"Couldn't load needs attention"}
        </p>
        <p className="text-sm text-slate-500">
          Something went wrong fetching this data. Try refreshing the page.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-[18px] font-semibold leading-[1.2] text-slate-900">Needs Attention</h2>
      <div className="mt-4 space-y-2">
        {rowsWithHighSignals.map(({ company, highStrengthTypes }) => (
          <div key={company.id} className="flex items-center justify-between gap-2 text-sm">
            <Link
              href={`/companies?selected=${company.id}`}
              className="text-indigo-600 hover:underline"
            >
              {company.name}
            </Link>
            <div className="flex flex-wrap justify-end gap-2">
              {highStrengthTypes.map((signalType) => (
                <SignalBadge key={signalType} signalType={signalType} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
