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

export async function CompanyList({ filters }: { filters?: CompanyFilters }) {
  const companies = await listCompanies(filters);

  if (companies.length === 0) {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-8 text-center">
        <p className="text-[18px] font-semibold leading-[1.2] text-slate-900">
          No companies yet
        </p>
        <p className="text-sm text-slate-500">
          Company data will appear here once the seed dataset is loaded.
        </p>
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
            <TableRow key={company.id} className="min-h-12">
              <TableCell className="font-medium text-slate-900">{company.name}</TableCell>
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
