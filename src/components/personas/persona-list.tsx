import { listPersonas, type PersonaFilters } from '@/lib/db/queries/personas';
import { listCompanyRolesForPersona } from '@/lib/db/queries/companyPersonaRoles';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

// seniority is a fixed-but-extensible pgEnum storing slug values
// (e.g. "c_level") — humanize for display rather than showing the raw slug
// to a mixed/leadership audience.
function humanizeEnum(value: string | null): string {
  if (!value) return '—';
  return value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export async function PersonaList({
  filters,
  selectedId,
}: {
  filters?: PersonaFilters;
  selectedId?: number;
}) {
  // Phase 2 baseline error-state handling (mirrors company-list.tsx) — a
  // Neon fetch failure must degrade to known-good UI copy, never a thrown 500.
  let personas: Awaited<ReturnType<typeof listPersonas>>;
  try {
    personas = await listPersonas(filters);
  } catch {
    return (
      <div
        className={cn(
          'flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-8 text-center',
          selectedId ? 'hidden md:flex' : 'flex'
        )}
      >
        <p className="text-[18px] font-semibold leading-[1.2] text-slate-900">
          {"Couldn't load personas"}
        </p>
        <p className="text-sm text-slate-500">
          Something went wrong fetching this data. Try refreshing the page.
        </p>
      </div>
    );
  }

  if (personas.length === 0) {
    // A filtered search/filter combination matching zero rows gets distinct
    // copy from a genuinely empty (unseeded) dataset.
    const hasActiveFilters = Boolean(
      filters?.search || filters?.seniority || filters?.currentCompany || filters?.hasSignals
    );

    return (
      <div
        className={cn(
          'flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-8 text-center',
          // D-07 mobile pattern: hide the list pane once a persona is
          // selected on narrow viewports so only the detail pane shows.
          selectedId ? 'hidden md:flex' : 'flex'
        )}
      >
        {hasActiveFilters ? (
          <>
            <p className="text-[18px] font-semibold leading-[1.2] text-slate-900">
              No personas match your filters
            </p>
            <p className="text-sm text-slate-500">
              Try removing a filter or clearing your search.
            </p>
          </>
        ) : (
          <>
            <p className="text-[18px] font-semibold leading-[1.2] text-slate-900">
              No personas yet
            </p>
            <p className="text-sm text-slate-500">
              Persona data will appear here once the seed dataset is loaded.
            </p>
          </>
        )}
      </div>
    );
  }

  // N+1 acceptable at this seed-data scale (10 rows) per company-list.tsx's
  // per-row signal fetch precedent — do not add batching this task.
  const rowsWithCurrentCompany = await Promise.all(
    personas.map(async (persona) => {
      const roles = await listCompanyRolesForPersona(persona.id);
      const current = roles.find((r) => r.role.isCurrent);
      return { persona, currentCompanyName: current?.company.name ?? '—' };
    })
  );

  return (
    <div
      className={cn(
        'rounded-lg border border-slate-200 bg-white',
        // D-07 mobile pattern: a selected persona hides the list on narrow
        // viewports so only the detail pane shows.
        selectedId ? 'hidden md:block' : 'block'
      )}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Seniority</TableHead>
            <TableHead>Current Company</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rowsWithCurrentCompany.map(({ persona, currentCompanyName }) => (
            // Row Link + selected-row highlight land in Plan 03-03 alongside
            // the /personas/[id] detail route (plan's explicit sequencing).
            <TableRow key={persona.id} className="min-h-12">
              <TableCell className="font-medium text-slate-900">{persona.name}</TableCell>
              <TableCell>{persona.title}</TableCell>
              <TableCell>{humanizeEnum(persona.seniority)}</TableCell>
              <TableCell>{currentCompanyName}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
