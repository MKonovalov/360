import { ChevronDownIcon } from 'lucide-react';
import { listCompanies, type CompanyFilters } from '@/lib/db/queries/companies';
import { listSignalsForCompany } from '@/lib/db/queries/signals';
import { TableCell } from '@/components/ui/table';
import { SignalBadge } from '@/components/companies/signal-badge';
import { CompanyDetail } from '@/components/companies/company-detail';
import { ExplorerAccordionTable } from '@/components/explorer/explorer-accordion-table';
import { ExplorerTableBehavior } from '@/components/explorer/explorer-table-behavior';
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
    <div className="rounded-lg border border-slate-200 bg-white">
      <ExplorerTableBehavior selectedId={selectedId}>
        <ExplorerAccordionTable
          columnLabels={[
            'Name',
            'Industry',
            'Employee Count',
            'HQ Location',
            'Revenue Band',
            'Ownership Type',
            'Signals',
          ]}
          rows={rowsWithSignals}
          getRowId={(row) => row.company.id}
          selectedId={selectedId}
          renderRowCells={({ company, distinctSignalTypes }, isExpanded) => (
            <>
              <TableCell className="font-medium text-slate-900">
                <span className="flex items-center gap-1">
                  <ChevronDownIcon
                    className={cn(
                      'size-4 shrink-0 text-slate-400 transition-transform',
                      isExpanded && 'rotate-180'
                    )}
                  />
                  {company.name}
                </span>
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
            </>
          )}
          renderDetail={(row) => <CompanyDetail id={row.company.id} />}
        />
      </ExplorerTableBehavior>
    </div>
  );
}
