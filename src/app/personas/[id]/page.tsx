import { notFound } from 'next/navigation';
import { PersonaDetail } from '@/components/personas/persona-detail';
import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { parsePersonaId, parsePersonaTab } from '@/lib/params/personaRoute';

export default async function PersonaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireStaffAccess();

  const { id } = await params;
  const search = await searchParams;
  const personaId = parsePersonaId(id);
  if (personaId === undefined) notFound();

  return <PersonaDetail id={personaId} tab={parsePersonaTab(search.tab)} />;
}
