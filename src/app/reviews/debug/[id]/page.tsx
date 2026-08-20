import { notFound } from 'next/navigation';
import { z } from 'zod';

import { DebugAnalysisRun } from '@/components/reviews/debug-analysis-run';
import { AppShellLayout } from '@/components/layout/app-shell-layout';
import { requireDebugAdminAccess } from '@/lib/auth/requireDebugAdminAccess';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const applicationRunIdSchema = z.coerce.number().int().positive();

type DebugAnalysisRunPageProps = {
  readonly params: Promise<{ readonly id: string }>;
};

export default async function DebugAnalysisRunPage(props: DebugAnalysisRunPageProps) {
  await requireDebugAdminAccess();

  const { id } = await props.params;
  const parsedId = applicationRunIdSchema.safeParse(id);
  if (!parsedId.success) notFound();

  return (
    <AppShellLayout>
      <main className="min-w-0 flex-1 bg-background p-4 lg:p-8">
        <div className="mx-auto w-full max-w-6xl">
          <DebugAnalysisRun applicationRunId={parsedId.data} initialDiagnostic={null} />
        </div>
      </main>
    </AppShellLayout>
  );
}
