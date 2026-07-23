import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { PersonaList } from '@/components/personas/persona-list';
import { PersonaDetail } from '@/components/personas/persona-detail';
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
// CompanyDetailPage) — every page under /personas gates itself too, so the
// check can never be skipped by a future refactor of the layout alone.
export default async function PersonaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireStaffAccess();

  const { id } = await params;
  const filters = parsePersonaFilters(await searchParams);
  const currentCompanies = (await listDistinctCurrentCompanyNames()).map((row) => row.name);

  const personaId = Number(id);
  if (Number.isNaN(personaId)) {
    notFound();
  }

  return (
    <div className="grid grid-cols-[minmax(320px,1fr)_2fr] gap-8 p-8">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <PersonaSearchInput />
          <PersonaFilters currentCompanies={currentCompanies} />
        </div>
        <PersonaList filters={filters} selectedId={personaId} />
      </div>
      {/* D-07 mobile pattern: a persona is selected, so the detail pane is
          always visible; the list hides itself (PersonaList's own
          `hidden md:block`). A plain Link (never the router-history-back
          navigation helper, which would break a directly-shared
          /personas/{id} URL — 02-RESEARCH.md Anti-Pattern note) gets mobile
          users back to the list. */}
      <div className="block">
        <Link
          href="/personas"
          className="mb-4 inline-block text-[14px] font-normal leading-[1.5] text-indigo-600 md:hidden"
        >
          ← Back to list
        </Link>
        <PersonaDetail id={personaId} />
      </div>
    </div>
  );
}
