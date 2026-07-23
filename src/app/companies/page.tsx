import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { CompanyList } from '@/components/companies/company-list';
import { CompanySearchInput } from '@/components/companies/company-search-input';
import { CompanyFilters } from '@/components/companies/company-filters';
import { listDistinctIndustries, type CompanyFilters as CompanyFiltersShape } from '@/lib/db/queries/companies';

// Next's searchParams type is `string | string[] | undefined` per key —
// take the first array element if a key is ever repeated in the URL.
function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseCompanyFilters(params: {
  [key: string]: string | string[] | undefined;
}): CompanyFiltersShape {
  return {
    search: firstValue(params.search),
    industry: firstValue(params.industry),
    signalType: firstValue(params.signal),
    revenueBand: firstValue(params.revenueBand),
    ownershipType: firstValue(params.ownershipType),
  };
}

// Belt-and-suspenders alongside the layout's auth gate (02-RESEARCH.md
// Pitfall 4) — every page under /companies gates itself too, so the
// check can never be skipped by a future refactor of the layout alone.
export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireStaffAccess();

  const filters = parseCompanyFilters(await searchParams);
  const industries = (await listDistinctIndustries())
    .map((row) => row.industry)
    .filter((industry): industry is string => Boolean(industry));

  return (
    <div className="grid grid-cols-[minmax(320px,1fr)_2fr] gap-8 p-8">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <CompanySearchInput />
          <CompanyFilters industries={industries} />
        </div>
        <CompanyList filters={filters} selectedId={undefined} />
      </div>
      {/* D-07 mobile pattern: no company selected here, so on narrow
          viewports only the list shows — this placeholder pane is
          desktop-only, never an empty detail pane on mobile. */}
      <div className="hidden min-h-48 items-center justify-center rounded-lg border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500 md:flex">
        Select a company to view details
      </div>
    </div>
  );
}
