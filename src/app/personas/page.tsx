import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { PersonaList } from '@/components/personas/persona-list';
import { PersonaSearchInput } from '@/components/personas/persona-search-input';
import { PersonaFilters } from '@/components/personas/persona-filters';
import { ExplorerMenu } from '@/components/explorer/explorer-menu';
import { listDistinctCurrentCompanyNames } from '@/lib/db/queries/personas';
import { parsePersonaFilters } from '@/lib/params/personaFilters';
import { buildPersonaLegacyRedirect } from '@/lib/params/personaRoute';
import { redirect } from 'next/navigation';

// Belt-and-suspenders alongside the layout's auth gate (mirrors
// CompaniesPage) — every page under /personas gates itself too, so the
// check can never be skipped by a future refactor of the layout alone.
export default async function PersonasPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireStaffAccess();

  const search = await searchParams;
  const legacyRedirect = buildPersonaLegacyRedirect(search);
  if (legacyRedirect) redirect(legacyRedirect);

  const filters = parsePersonaFilters(search);
  const currentCompanies = (await listDistinctCurrentCompanyNames()).map((row) => row.name);

  return (
    <div className="flex flex-col gap-4 p-8">
      <div className="flex items-center justify-end">
        <ExplorerMenu
          variant="labeled"
          items={[
            { label: 'Import', href: '/personas/import' },
            { label: 'Settings', href: '/settings' },
          ]}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <PersonaSearchInput />
        <PersonaFilters currentCompanies={currentCompanies} />
      </div>
      <PersonaList filters={filters} />
    </div>
  );
}
