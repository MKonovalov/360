import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { CompanyList } from '@/components/companies/company-list';
import { CompanySearchInput } from '@/components/companies/company-search-input';
import { CompanyFilters } from '@/components/companies/company-filters';
import { ExplorerMenu } from '@/components/explorer/explorer-menu';
import { listDistinctIndustries } from '@/lib/db/queries/companies';
import { parseCompanyFilters } from '@/lib/params/companyFilters';
import { buildCompanyLegacyRedirect } from '@/lib/params/companyRoute';
import { redirect } from 'next/navigation';

// Belt-and-suspenders alongside the layout's auth gate (02-RESEARCH.md
// Pitfall 4) — every page under /companies gates itself too, so the
// check can never be skipped by a future refactor of the layout alone.
export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireStaffAccess();

  const search = await searchParams;
  const legacyRedirect = buildCompanyLegacyRedirect(search);
  if (legacyRedirect) redirect(legacyRedirect);

  const filters = parseCompanyFilters(search);
  const industries = (await listDistinctIndustries())
    .map((row) => row.industry)
    .filter((industry): industry is string => Boolean(industry));

  return (
    <div className="flex flex-col gap-4 p-8">
      <div className="flex items-center justify-end">
        <ExplorerMenu
          variant="labeled"
          items={[
            { label: 'Import', href: '/companies/import' },
            { label: 'Settings', href: '/settings' },
          ]}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <CompanySearchInput />
        <CompanyFilters industries={industries} />
      </div>
      <CompanyList filters={filters} />
    </div>
  );
}
