import { redirect } from 'next/navigation';
import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';

// Thin redirect-only stub per D-03 — /companies/[id] URLs (bookmarks,
// shared links) now land on the consolidated /companies?selected=<id>
// stacked-accordion page instead of rendering their own list+detail split.
export default async function CompanyLegacyIdRedirectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireStaffAccess();

  const { id } = await params;
  const search = await searchParams;

  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (value === undefined) continue;
    qs.set(key, Array.isArray(value) ? value[0] : value);
  }
  qs.set('selected', id);

  // This call throws internally to signal the redirect — never wrap it in
  // a try/catch, same reasoning as the notFound() placement convention in
  // company-detail.tsx (wrapping it would swallow that signal).
  redirect(`/companies?${qs.toString()}`);
}
