import Link from 'next/link';
import { listCompanies, type CompanyFilters } from '@/lib/db/queries/companies';
import { listSignalsForCompany } from '@/lib/db/queries/signals';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SignalBadge } from '@/components/companies/signal-badge';
import { cn } from '@/lib/utils';

// revenue_band/ownership_type are fixed-but-extensible pgEnums storing
// slug values (e.g. "under_50m", "pe_backed") — humanize for display
// rather than showing the raw slug to a mixed/leadership audience.
function humanizeEnum(value: string | null): string {
  if (!value) return '—';
  return value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export async function CompanyList({
  filters,
  selectedId,
}: {
  filters?: CompanyFilters;
  selectedId?: number;
}) {
  // Phase 2 baseline error-state handling (CONTEXT.md's Claude's Discretion
  // note) — full EXPL-06 hardening lands in Phase 4, but a Sanity/DB-style
  // fetch failure must degrade to known-good UI copy, never a thrown 500.
  let companies: Awaited<ReturnType<typeof listCompanies>>;
  try {
    companies = await listCompanies(filters);
  } catch {
    return (
      <div
        className={cn(
          'flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-8 text-center',
          selectedId ? 'hidden md:flex' : 'flex'
        )}
      >
        <p className="text-[18px] font-semibold leading-[1.2] text-slate-900">
          {"Couldn't load companies"}
        </p>
        <p className="text-sm text-slate-500">
          Something went wrong fetching this data. Try refreshing the page.
        </p>
      </div>
    );
  }

  if (companies.length === 0) {
    // A filtered search/filter combination matching zero rows gets distinct
    // copy from a genuinely empty (unseeded) dataset.
    const hasActiveFilters = Boolean(
      filters?.search || filters?.industry || filters?.signalType || filters?.revenueBand || filters?.ownershipType
    );

    return (
      <div
        className={cn(
          'flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-8 text-center',
          // D-07 mobile pattern: hide the list pane once a company is
          // selected on narrow viewports so only the detail pane shows.
          selectedId ? 'hidden md:flex' : 'flex'
        )}
      >
        {hasActiveFilters ? (
          <>
            <p className="text-[18px] font-semibold leading-[1.2] text-slate-900">
              No companies match your filters
            </p>
            <p className="text-sm text-slate-500">
              Try removing a filter or clearing your search.
            </p>
          </>
        ) : (
          <>
            <p className="text-[18px] font-semibold leading-[1.2] text-slate-900">
              No companies yet
            </p>
            <p className="text-sm text-slate-500">
              Company data will appear here once the seed dataset is loaded.
            </p>
          </>
        )}
      </div>
    );
  }

  // N+1 acceptable at this seed-data scale (9 rows) per 02-RESEARCH.md's
  // ILIKE-over-tsvector rationale — do not add batching this task.
  const rowsWithSignals = await Promise.all(
    companies.map(async (company) => {
      const signals = await listSignalsForCompany(company.id);
      const distinctSignalTypes = Array.from(new Set(signals.map((s) => s.signalType)));
      return { company, distinctSignalTypes };
    })
  );

  return (
    <div
      className={cn(
        'rounded-lg border border-slate-200 bg-white',
        // D-07 mobile pattern: a selected company hides the list on narrow
        // viewports so only the detail pane shows (RESEARCH.md "Mobile/
        // Narrow-Viewport Behavior").
        selectedId ? 'hidden md:block' : 'block'
      )}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Industry</TableHead>
            <TableHead>Employee Count</TableHead>
            <TableHead>HQ Location</TableHead>
            <TableHead>Revenue Band</TableHead>
            <TableHead>Ownership Type</TableHead>
            <TableHead>Signals</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rowsWithSignals.map(({ company, distinctSignalTypes }) => (
            <TableRow
              key={company.id}
              className={cn(
                'min-h-12',
                // Accent (indigo-600) selected-row indicator per UI-SPEC's
                // Color section — accent marks selection state only.
                company.id === selectedId && 'border-l-2 border-l-indigo-600 bg-indigo-50/50'
              )}
            >
              <TableCell className="font-medium text-slate-900">
                <Link href={`/companies/${company.id}`} className="block">
                  {company.name}
                </Link>
              </TableCell>
              <TableCell>{company.industry ?? '—'}</TableCell>
              <TableCell>{company.employeeCountBand ?? '—'}</TableCell>
              <TableCell>{company.hqLocation ?? '—'}</TableCell>
              <TableCell>{humanizeEnum(company.revenueBand)}</TableCell>
              <TableCell>{humanizeEnum(company.ownershipType)}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-2">
                  {distinctSignalTypes.map((signalType) => (
                    <SignalBadge key={signalType} signalType={signalType} />
                  ))}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
