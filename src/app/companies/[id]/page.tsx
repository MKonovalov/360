import { notFound } from 'next/navigation';
import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { CompanyList } from '@/components/companies/company-list';
import { CompanyDetail } from '@/components/companies/company-detail';

// Belt-and-suspenders alongside the layout's auth gate (02-RESEARCH.md
// Pitfall 4) — every page under /companies gates itself too, so the
// check can never be skipped by a future refactor of the layout alone.
export default async function CompanyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  // Awaited even though unused yet — Pitfall 3: params/searchParams are
  // Promises in Next.js 15+/16, and Plan 04 wires real filter values here.
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireStaffAccess();

  const { id } = await params;
  await searchParams;

  const companyId = Number(id);
  if (Number.isNaN(companyId)) {
    notFound();
  }

  return (
    <div className="grid grid-cols-[minmax(320px,1fr)_2fr] gap-8 p-8">
      {/* selectedId threading + mobile responsive swap lands in Task 2,
          which owns CompanyList's signature change. */}
      <CompanyList filters={undefined} />
      <CompanyDetail id={companyId} />
    </div>
  );
}
