'use client';

import { useState, useTransition } from 'react';
import { saveDataSourceSettingsAction } from '@/app/actions/settings';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  dataSourceProviderMetadata,
  parseDataSourceSelection,
  type DataSourceAvailability,
  type DataSourceProviderId,
  type DataSourceSelection,
} from '@/lib/data-sources/contracts';

type DataSourceRole = keyof DataSourceSelection;
export type DataSourceSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function statusAfterDataSourceEdit(status: DataSourceSaveStatus): DataSourceSaveStatus {
  return status === 'saving' ? 'saving' : 'idle';
}

const ROLE_COPY = {
  webResearchProvider: {
    label: 'Web research',
    description: 'Provider used to search and retrieve public evidence.',
    providers: ['firecrawl', 'exa'],
  },
  companyEnrichmentProvider: {
    label: 'Company enrichment',
    description: 'Provider used to enrich company records.',
    providers: ['apollo', 'prospeo'],
  },
  personaEnrichmentProvider: {
    label: 'Persona enrichment',
    description: 'Provider used to enrich persona records.',
    providers: ['apollo', 'prospeo'],
  },
} as const satisfies Record<DataSourceRole, { readonly label: string; readonly description: string; readonly providers: readonly DataSourceProviderId[] }>;

const DATA_SOURCE_ROLES = [
  'webResearchProvider',
  'companyEnrichmentProvider',
  'personaEnrichmentProvider',
] as const satisfies readonly DataSourceRole[];

function availabilityFor(
  availability: readonly DataSourceAvailability[],
  provider: DataSourceProviderId,
): DataSourceAvailability['status'] {
  return availability.find((entry) => entry.provider === provider)?.status ?? 'unavailable';
}

export function DataSourceSettingsForm({
  selection,
  availability,
}: {
  readonly selection: DataSourceSelection;
  readonly availability: readonly DataSourceAvailability[];
}) {
  const [draft, setDraft] = useState<DataSourceSelection>(selection);
  const [status, setStatus] = useState<DataSourceSaveStatus>('idle');
  const [isPending, startTransition] = useTransition();

  function markDirty() {
    setStatus(statusAfterDataSourceEdit);
  }

  function save() {
    setStatus('saving');
    startTransition(async () => {
      try {
        const result = await saveDataSourceSettingsAction(draft);
        setStatus(result.ok ? 'saved' : 'error');
      } catch {
        setStatus('error');
      }
    });
  }

  return (
    <div className="flex flex-col gap-6 rounded-lg border border-slate-200 bg-white p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-[18px] font-semibold leading-[1.2] text-slate-900">Data Sources</h2>
        <p className="text-sm text-slate-500">
          These shared provider choices apply to web research, company enrichment, and persona enrichment for the team.
        </p>
      </div>

      <div className="flex flex-col gap-5">
        {DATA_SOURCE_ROLES.map((role) => {
          const copy = ROLE_COPY[role];
          return (
            <div key={role} className="flex flex-col gap-2">
              <div>
                <label htmlFor={role} className="text-sm font-medium text-slate-900">{copy.label}</label>
                <p className="text-sm text-slate-500">{copy.description}</p>
              </div>
              <Select
                value={draft[role]}
                onValueChange={(value) => {
                  markDirty();
                  setDraft((current) =>
                    parseDataSourceSelection({ ...current, [role]: value }),
                  );
                }}
              >
                <SelectTrigger id={role} className="w-full sm:w-72">
                  <SelectValue>{dataSourceProviderMetadata[draft[role]].label}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {copy.providers.map((provider) => {
                    const status = availabilityFor(availability, provider);
                    const suffix = status === 'available' ? 'Available' : status === 'not_configured' ? 'Not configured' : 'Unavailable';
                    return (
                      <SelectItem key={provider} value={provider}>
                        {dataSourceProviderMetadata[provider].label} · {suffix}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3 border-t border-slate-100 pt-3">
        <Button type="button" disabled={isPending} onClick={save}>
          {isPending ? 'Saving…' : 'Save changes'}
        </Button>
        {status === 'saved' ? <p className="text-sm text-slate-600">Saved.</p> : null}
        {status === 'error' ? <p className="text-sm text-red-600">Couldn&apos;t save your changes. Please try again.</p> : null}
      </div>
    </div>
  );
}
