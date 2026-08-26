'use client';

import { Button } from '@/components/ui/button';
import type { SearchStatusProjection } from '@/lib/search/contracts';

import { SearchRunStatus } from './SearchRunStatus';
import type { SearchCompanyIdentity, SearchTemplateProjection } from './searchClient';

export interface SearchLauncherPanelProps {
  readonly company: SearchCompanyIdentity;
  readonly template: SearchTemplateProjection | null;
  readonly activeRun?: SearchStatusProjection | null;
  readonly isStartDisabled: boolean;
  readonly isStarting?: boolean;
  readonly errorMessage?: string | null;
  readonly onStartAction: () => void;
}

export function SearchLauncherPanel({
  company,
  template,
  activeRun = null,
  isStartDisabled,
  isStarting = false,
  errorMessage = null,
  onStartAction,
}: SearchLauncherPanelProps) {
  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Company</p>
        <p className="mt-1 text-base font-semibold text-slate-900">{company.name}</p>
        <p className="text-sm text-slate-500">{company.domain ?? 'No domain recorded'}</p>
      </section>

      {template === null ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
          No compatible active Search templates are available.
        </p>
      ) : (
        <section className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Resolved template</p>
            <p className="mt-1 font-medium text-slate-900">{template.name} · v{template.version}</p>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-900">Resolved Buyer Roles</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {template.buyerRoles.length > 0 ? template.buyerRoles.map((role) => (
                <li key={role.id} className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-700 ring-1 ring-slate-200">
                  {role.name}
                </li>
              )) : <li className="text-sm text-slate-500">No Buyer Roles resolved.</li>}
            </ul>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-900">Evidence preview</p>
            {template.buyerRoleEvidence.length > 0 ? (
              <ul className="mt-2 space-y-2 text-sm text-slate-600">
                {template.buyerRoleEvidence.map((evidence) => (
                  <li key={evidence.buyerRoleId}>
                    <span className="font-medium text-slate-800">{evidence.buyerRoleName}:</span>{' '}
                    {evidence.matchedRules.map((rule) => rule.label).join(', ')}
                  </li>
                ))}
              </ul>
            ) : <p className="mt-2 text-sm text-slate-500">No rule evidence is available.</p>}
          </div>

          <p className="text-xs text-slate-500">
            Evidence policy: at least {template.evidencePolicy.minimumPublicSources} public source
            {template.evidencePolicy.minimumPublicSources === 1 ? '' : 's'}; HTTPS required.
          </p>
        </section>
      )}

      {activeRun && <SearchRunStatus projection={activeRun} />}
      {errorMessage && <p className="text-sm text-red-600" role="alert">{errorMessage}</p>}

      <Button type="button" onClick={onStartAction} disabled={isStartDisabled}>
        {isStarting ? 'Starting Search…' : 'Start Search'}
      </Button>
    </div>
  );
}
