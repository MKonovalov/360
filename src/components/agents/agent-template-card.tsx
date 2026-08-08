'use client';

import type { ManagedAnalysisTemplateRead } from '@/lib/analysis/templateContracts';

export function AgentTemplateCard({
  template,
}: {
  readonly template: ManagedAnalysisTemplateRead;
}) {
  return (
    <article data-template-key={template.key} className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6">
      <div className="flex flex-col gap-1">
        <h3 className="text-[18px] font-semibold leading-[1.2] text-slate-900">{template.name}</h3>
        <p className="text-sm text-slate-500">Target: {template.targetType}</p>
      </div>
      <p className="text-sm text-slate-500">Current version {template.latest.version}</p>
    </article>
  );
}
