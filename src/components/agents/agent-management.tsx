'use client';

import type { ManagedAnalysisTemplateRead } from '@/lib/analysis/templateContracts';
import { FIXED_ANALYSIS_TEMPLATES } from '@/lib/analysis/templateContracts';

import { AgentTemplateCard } from './agent-template-card';

export function AgentManagement({
  templates,
}: {
  readonly templates: readonly ManagedAnalysisTemplateRead[];
}) {
  return (
    <main className="flex flex-col gap-8 p-8">
      <header className="flex flex-col gap-2">
        <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-slate-500">Manage</p>
        <h1 className="text-[24px] font-semibold leading-[1.2] text-slate-900">Agents</h1>
        <p className="max-w-2xl text-sm leading-6 text-slate-500">
          Manage the fixed Company and Persona analysis instructions used for future launches.
          Existing runs keep their original version snapshots.
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
    </main>
  );
}
