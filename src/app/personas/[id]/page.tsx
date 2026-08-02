import { redirect } from 'next/navigation';
import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';

// D-03: legacy /personas/<id> URLs (bookmarks, shared links) now redirect to
// the consolidated /personas?selected=<id> shape, preserving any other query
// params (e.g. active filters) rather than dropping them.
export default async function PersonaRedirectPage({
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

  redirect(`/personas?${qs.toString()}`);
}
