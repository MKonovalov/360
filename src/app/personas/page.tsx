import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { PersonaList } from '@/components/personas/persona-list';
import { PersonaSearchInput } from '@/components/personas/persona-search-input';
import { PersonaFilters } from '@/components/personas/persona-filters';
import { listDistinctCurrentCompanyNames } from '@/lib/db/queries/personas';
import { parsePersonaFilters, parseSelectedId } from '@/lib/params/personaFilters';

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
  const selectedId = parseSelectedId(await searchParams);
  const currentCompanies = (await listDistinctCurrentCompanyNames()).map((row) => row.name);

  return (
    <div className="flex flex-col gap-4 p-8">
      <div className="flex flex-wrap items-center gap-3">
        <PersonaSearchInput />
        <PersonaFilters currentCompanies={currentCompanies} />
      </div>
      <PersonaList filters={filters} selectedId={selectedId} />
    </div>
  );
}
