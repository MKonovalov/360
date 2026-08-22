import Link from 'next/link';
import { listCompanies, type CompanyFilters } from '@/lib/db/queries/companies';
import { listSignalSummariesForCompanies } from '@/lib/db/queries/signals';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SignalBadge } from '@/components/companies/signal-badge';
import { humanizeEnum } from '@/components/explorer/explorer-format';

export async function CompanyList({
  filters,
}: {
  filters?: CompanyFilters;
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
        className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-8 text-center"
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
        className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-8 text-center"
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

  let signalSummaries: Awaited<ReturnType<typeof listSignalSummariesForCompanies>>;
  try {
    signalSummaries = await listSignalSummariesForCompanies(companies.map((company) => company.id));
  } catch {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-8 text-center">
        <p className="text-[18px] font-semibold leading-[1.2] text-slate-900">
          {"Couldn't load companies"}
        </p>
        <p className="text-sm text-slate-500">
          Something went wrong fetching this data. Try refreshing the page.
        </p>
      </div>
    );
  }

  const signalTypesByCompanyId = new Map<number, string[]>();
  for (const summary of signalSummaries) {
    const signalTypes = signalTypesByCompanyId.get(summary.companyId);
    if (signalTypes) {
      signalTypes.push(summary.signalType);
    } else {
      signalTypesByCompanyId.set(summary.companyId, [summary.signalType]);
    }
  }

  const rowsWithSignals = companies.map((company) => ({
    company,
    distinctSignalTypes: signalTypesByCompanyId.get(company.id) ?? [],
  }));

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
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
            <TableRow key={company.id}>
              <TableCell className="font-medium text-slate-900">
                <Link href={`/companies/${company.id}`} className="text-indigo-600 hover:underline">
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
