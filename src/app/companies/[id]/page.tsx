import { notFound } from 'next/navigation';
import { CompanyDetail } from '@/components/companies/company-detail';
import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { parseCompanyId, parseCompanyTab } from '@/lib/params/companyRoute';

export default async function CompanyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireStaffAccess();

  const { id } = await params;
  const search = await searchParams;
  const companyId = parseCompanyId(id);
  if (companyId === undefined) notFound();

  const tab = parseCompanyTab(search.tab);

  return <CompanyDetail id={companyId} tab={tab} />;
}
