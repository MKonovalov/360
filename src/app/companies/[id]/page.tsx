import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { CompanyList } from '@/components/companies/company-list';
import { CompanyDetail } from '@/components/companies/company-detail';
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
export default async function CompanyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireStaffAccess();

  const { id } = await params;
  const filters = parseCompanyFilters(await searchParams);
  const industries = (await listDistinctIndustries())
    .map((row) => row.industry)
    .filter((industry): industry is string => Boolean(industry));

  const companyId = Number(id);
  if (Number.isNaN(companyId)) {
    notFound();
  }

  return (
    <div className="grid grid-cols-[minmax(320px,1fr)_2fr] gap-8 p-8">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <CompanySearchInput />
          <CompanyFilters industries={industries} />
        </div>
        <CompanyList filters={filters} selectedId={companyId} />
      </div>
      {/* D-07 mobile pattern: a company is selected, so the detail pane is
          always visible; the list hides itself (CompanyList's own
          `hidden md:block`). A plain Link (never the router-history-back
          navigation helper, which would break a directly-shared
          /companies/{id} URL — RESEARCH.md Anti-Pattern note) gets mobile
          users back to the list. */}
      <div className="block">
        <Link
          href="/companies"
          className="mb-4 inline-block text-[14px] font-normal leading-[1.5] text-indigo-600 md:hidden"
        >
          ← Back to list
        </Link>
        <CompanyDetail id={companyId} />
      </div>
    </div>
  );
}
