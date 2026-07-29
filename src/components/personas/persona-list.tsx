import { ChevronDownIcon } from 'lucide-react';
import { listPersonas, type PersonaFilters } from '@/lib/db/queries/personas';
import { listCompanyRolesForPersona } from '@/lib/db/queries/companyPersonaRoles';
import { TableCell } from '@/components/ui/table';
import { ExplorerAccordionTable } from '@/components/explorer/explorer-accordion-table';
import { ExplorerTableBehavior } from '@/components/explorer/explorer-table-behavior';
import { PersonaDetail } from '@/components/personas/persona-detail';
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
      filters?.search ||
        filters?.seniority ||
        filters?.currentCompany ||
        filters?.hasSignals !== undefined
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
      <ExplorerTableBehavior selectedId={selectedId}>
        <ExplorerAccordionTable
          columnLabels={['Name', 'Title', 'Seniority', 'Current Company']}
          rows={rowsWithCurrentCompany}
          getRowId={(row) => row.persona.id}
          selectedId={selectedId}
          renderRowCells={({ persona, currentCompanyName }, isExpanded) => (
            <>
              <TableCell className="font-medium text-slate-900">
                <span className="flex items-center gap-1">
                  <ChevronDownIcon
                    className={cn(
                      'size-4 shrink-0 text-slate-400 transition-transform',
                      isExpanded && 'rotate-180'
                    )}
                  />
                  {persona.name}
                </span>
              </TableCell>
              <TableCell>{persona.title}</TableCell>
              <TableCell>{humanizeEnum(persona.seniority)}</TableCell>
              <TableCell>{currentCompanyName}</TableCell>
            </>
          )}
          renderDetail={(row) => <PersonaDetail id={row.persona.id} />}
        />
      </ExplorerTableBehavior>
    </div>
  );
}
