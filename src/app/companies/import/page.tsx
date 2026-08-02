import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { ImportWizard } from '@/components/import/import-wizard';

// Belt-and-suspenders alongside the layout's auth gate (02-RESEARCH.md
// Pitfall 4) — every page under /companies gates itself too, so the check can
// never be skipped by a future refactor of the layout alone. The surrounding
// AppShellLayout comes from src/app/companies/layout.tsx; this route needs no
// layout of its own.
//
// Entity type is fixed by the route, not by wizard state (D-05) — the Menu →
// Import item on /companies is what lands staff here.
export default async function CompaniesImportPage() {
  await requireStaffAccess();

  return (
    <div className="p-8">
      <ImportWizard entityType="company" />
    </div>
  );
}
