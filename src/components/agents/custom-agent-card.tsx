'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { CustomAgentRead } from '@/lib/db/queries/customAgents';
import type { SafeCapabilityPreset, PracticeAreaOption, CustomAgentEditorAgent } from './custom-agent-editor';
import { CustomAgentEditor } from './custom-agent-editor';

function toEditorAgent(agent: CustomAgentRead, practiceArea: PracticeAreaOption): CustomAgentEditorAgent {
  return {
    customAgentId: agent.customAgentId,
    targetType: agent.targetType,
    practiceAreaId: agent.practiceAreaId,
    practiceAreaName: practiceArea.name,
    practiceAreaShortCode: practiceArea.shortCode,
    status: agent.status,
    latest: agent.latest,
    history: agent.history.slice(1).map((version) => ({ version: version.version, createdBy: version.createdBy, createdAt: version.createdAt })),
  };
}

export function CustomAgentCard({
  agent,
  practiceArea,
  practiceAreas,
  capabilities,
}: {
  readonly agent: CustomAgentRead;
  readonly practiceArea: PracticeAreaOption;
  readonly practiceAreas: readonly PracticeAreaOption[];
  readonly capabilities: readonly SafeCapabilityPreset[];
}) {
  const editorAgent = toEditorAgent(agent, practiceArea);
  return (
    <article data-custom-agent-id={agent.customAgentId} className="flex flex-col gap-5 rounded-lg border border-slate-200 bg-white p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2"><Badge variant="secondary">Custom</Badge><h3 className="text-[18px] font-semibold leading-[1.2] text-slate-900">{agent.latest.name}</h3></div>
          <p className="text-sm text-slate-500">{agent.latest.description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2"><Badge variant="outline">Target: {agent.targetType}</Badge><Badge variant="outline">Practice Area: {practiceArea.shortCode}</Badge><Badge variant={agent.status === 'active' ? 'secondary' : 'outline'}>{agent.status === 'active' ? 'Active' : 'Retired'}</Badge><Badge variant="outline">Current version {agent.latest.version}</Badge></div>
      </header>
      <div className="grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2"><div><p className="text-[12px] font-medium text-slate-500">Research query</p><p className="mt-1 text-sm text-slate-700">{agent.latest.researchQuery}</p></div><div><p className="text-[12px] font-medium text-slate-500">Capabilities</p><p className="mt-1 text-sm text-slate-700">{agent.latest.capabilityPresetIds.join(', ')}</p></div></div>
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4"><CustomAgentEditor mode="edit" agent={editorAgent} practiceAreas={practiceAreas} capabilities={capabilities} trigger={<Button variant="outline">Edit custom agent</Button>} /></div>
    </article>
  );
}
