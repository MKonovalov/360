import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { listManagedAnalysisTemplates } from '@/lib/db/queries/analysisTemplates';
import { listManagedCustomAgents } from '@/lib/db/queries/analysisTemplates';
import { listActivePracticeAreas } from '@/lib/db/queries/practiceAreas';
import { listCapabilityPresetCards } from '@/lib/analysis/capabilityPresets';
import { AgentManagement } from '@/components/agents/agent-management';

function LoadError() {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-8 text-center">
      <p className="text-[18px] font-semibold leading-[1.2] text-slate-900">
        Couldn&apos;t load agents
      </p>
      <p className="text-sm text-slate-500">
        Something went wrong fetching this data. Try refreshing the page.
      </p>
    </div>
  );
}

export default async function AgentsPage() {
  await requireStaffAccess();

  try {
    const [templates, customAgents, practiceAreas] = await Promise.all([
      listManagedAnalysisTemplates(),
      listManagedCustomAgents(),
      listActivePracticeAreas(),
    ]);
    return <AgentManagement templates={templates} customAgents={customAgents} practiceAreas={practiceAreas.map(({ id, name, shortCode }) => ({ id, name, shortCode }))} capabilities={listCapabilityPresetCards()} />;
  } catch {
    return <LoadError />;
  }
}
