import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { PersonaList } from '@/components/personas/persona-list';
import { PersonaSearchInput } from '@/components/personas/persona-search-input';
import { PersonaFilters } from '@/components/personas/persona-filters';
import {
  listDistinctCurrentCompanyNames,
  type PersonaFilters as PersonaFiltersShape,
} from '@/lib/db/queries/personas';

// Next's searchParams type is `string | string[] | undefined` per key —
// take the first array element if a key is ever repeated in the URL.
function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parsePersonaFilters(params: {
  [key: string]: string | string[] | undefined;
}): PersonaFiltersShape {
  return {
    search: firstValue(params.search),
    seniority: firstValue(params.seniority),
    currentCompany: firstValue(params.currentCompany),
    hasSignals: firstValue(params.hasSignals) === 'true',
  };
}

// Belt-and-suspenders alongside the layout's auth gate (mirrors
// CompaniesPage) — every page under /personas gates itself too, so the
// check can never be skipped by a future refactor of the layout alone.
export default async function PersonasPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireStaffAccess();

  const filters = parsePersonaFilters(await searchParams);
  const currentCompanies = (await listDistinctCurrentCompanyNames()).map((row) => row.name);

  return (
    <div className="grid grid-cols-[minmax(320px,1fr)_2fr] gap-8 p-8">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <PersonaSearchInput />
          <PersonaFilters currentCompanies={currentCompanies} />
        </div>
        <PersonaList filters={filters} selectedId={undefined} />
      </div>
      {/* D-07 mobile pattern: no persona selected here, so on narrow
          viewports only the list shows — this placeholder pane is
          desktop-only, never an empty detail pane on mobile. */}
      <div className="hidden min-h-48 items-center justify-center rounded-lg border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500 md:flex">
        Select a persona to view details
      </div>
    </div>
  );
}
