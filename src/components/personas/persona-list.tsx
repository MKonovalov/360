import Link from 'next/link';
import { listPersonas, type PersonaFilters } from '@/lib/db/queries/personas';
import { listCompanyRolesForPersona } from '@/lib/db/queries/companyPersonaRoles';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { humanizeEnum } from '@/components/explorer/explorer-format';

export async function PersonaList({ filters }: { filters?: PersonaFilters }) {
  // Phase 2 baseline error-state handling (mirrors company-list.tsx) — a
  // Neon fetch failure must degrade to known-good UI copy, never a thrown 500.
  let personas: Awaited<ReturnType<typeof listPersonas>>;
  try {
    personas = await listPersonas(filters);
  } catch {
    return (
      <div
        className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-8 text-center"
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
        className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-8 text-center"
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
    <div className="rounded-lg border border-slate-200 bg-white">
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
            <TableRow key={persona.id}>
              <TableCell className="font-medium text-slate-900">
                <Link href={`/personas/${persona.id}`} className="text-indigo-600 hover:underline">
                  {persona.name}
                </Link>
              </TableCell>
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
