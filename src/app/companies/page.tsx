import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { CompanyList } from '@/components/companies/company-list';

// Belt-and-suspenders alongside the layout's auth gate (02-RESEARCH.md
// Pitfall 4) — every page under /companies gates itself too, so the
// check can never be skipped by a future refactor of the layout alone.
export default async function CompaniesPage() {
  await requireStaffAccess();

  return (
    <div className="grid grid-cols-[minmax(320px,1fr)_2fr] gap-8 p-8">
      <CompanyList filters={undefined} />
      <div className="flex min-h-48 items-center justify-center rounded-lg border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
        Select a company to view details
      </div>
    </div>
  );
}
