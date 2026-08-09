'use client';

import type { ManagedAnalysisTemplateRead } from '@/lib/analysis/templateContracts';
import { FIXED_ANALYSIS_TEMPLATES } from '@/lib/analysis/templateContracts';
import type { CustomAgentRead } from '@/lib/db/queries/customAgents';
import { Button } from '@/components/ui/button';

import { AgentTemplateCard } from './agent-template-card';
import { CustomAgentCard } from './custom-agent-card';
import { CustomAgentEditor, type PracticeAreaOption, type SafeCapabilityPreset } from './custom-agent-editor';

export function AgentManagement({
  templates,
  customAgents = [],
  practiceAreas = [],
  capabilities = [],
}: {
  readonly templates: readonly ManagedAnalysisTemplateRead[];
  readonly customAgents?: readonly CustomAgentRead[];
  readonly practiceAreas?: readonly PracticeAreaOption[];
  readonly capabilities?: readonly SafeCapabilityPreset[];
}) {
  return (
    <main className="flex flex-col gap-8 p-8">
      <header className="flex flex-col gap-2">
        <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-slate-500">Manage</p>
        <h1 className="text-[24px] font-semibold leading-[1.2] text-slate-900">Agents</h1>
        <p className="max-w-2xl text-sm leading-6 text-slate-500">
          Manage the fixed Company and Persona analysis instructions used for future launches.
          Existing runs keep their original version snapshots. Custom agents are configured here and activate separately after review.
        </p>
      </header>

      <section aria-labelledby="agent-templates-heading" className="flex flex-col gap-4">
        <h2 id="agent-templates-heading" className="sr-only">
          Analysis templates
        </h2>
        {FIXED_ANALYSIS_TEMPLATES.flatMap((fixedTemplate) => {
          const template = templates.find(({ key }) => key === fixedTemplate.key);
          return template ? [<AgentTemplateCard key={template.key} template={template} />] : [];
        })}
      </section>

      <section aria-labelledby="custom-agents-heading" className="flex flex-col gap-4 border-t border-slate-200 pt-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-[12px] font-medium uppercase tracking-[0.14em] text-slate-500">Custom</p><h2 id="custom-agents-heading" className="text-[20px] font-semibold leading-[1.2] text-slate-900">Custom Agents</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">Create a bounded, versioned agent for a single target and Practice Area. New agents begin retired.</p></div>
          <CustomAgentEditor mode="create" practiceAreas={practiceAreas} capabilities={capabilities} trigger={<Button>Create custom agent</Button>} />
        </div>
        {customAgents.length === 0 ? <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">No custom agents yet. Create one when you need a focused research definition.</p> : customAgents.map((agent) => { const practiceArea = practiceAreas.find((candidate) => candidate.id === agent.practiceAreaId); return practiceArea ? <CustomAgentCard key={agent.customAgentId} agent={agent} practiceArea={practiceArea} practiceAreas={practiceAreas} capabilities={capabilities} /> : null; })}
      </section>
    </main>
  );
}
