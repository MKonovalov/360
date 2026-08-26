'use client';

import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { SearchStatusProjection } from '@/lib/search/contracts';

import { SearchRunStatus } from './SearchRunStatus';
import {
  createSearchLaunchPayload,
  launchSearchRun,
  pollSearchRun,
  type SearchCompanyIdentity,
  type SearchTemplateProjection,
} from './searchClient';

export type { SearchCompanyIdentity, SearchTemplateProjection } from './searchClient';

export interface SearchLauncherConfig {
  readonly company: SearchCompanyIdentity;
  readonly templates: readonly SearchTemplateProjection[];
  readonly activeRun: SearchStatusProjection | null;
}

interface SearchLauncherProps extends SearchLauncherConfig {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

export function initialSearchTemplateVersionId(
  templates: readonly SearchTemplateProjection[],
): string {
  return templates[0] === undefined ? '' : String(templates[0].versionId);
}

export function canStartSearch(input: {
  readonly templates: readonly SearchTemplateProjection[];
  readonly selectedTemplateVersionId: string;
  readonly activeRun: SearchStatusProjection | null;
}): boolean {
  return input.activeRun === null || !isActiveSearchStatus(input.activeRun.status)
    ? input.templates.some((template) => String(template.versionId) === input.selectedTemplateVersionId)
    : false;
}

export function SearchLauncher({
  open,
  onOpenChange,
  company,
  templates,
  activeRun,
}: SearchLauncherProps) {
  const [selectedTemplateVersionIdState, setSelectedTemplateVersionId] = useState(() => initialSearchTemplateVersionId(templates));
  const [projection, setProjection] = useState<SearchStatusProjection | null>(activeRun);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const generationRef = useRef(0);

  useEffect(() => () => {
    generationRef.current += 1;
    controllerRef.current?.abort();
  }, []);

  const selectedTemplateVersionId = templates.some(
    (template) => String(template.versionId) === selectedTemplateVersionIdState,
  ) ? selectedTemplateVersionIdState : initialSearchTemplateVersionId(templates);
  const displayedProjection = projection ?? activeRun;
  const selectedTemplate = templates.find(
    (template) => String(template.versionId) === selectedTemplateVersionId,
  ) ?? null;
  const startDisabled = isStarting || !canStartSearch({
    templates,
    selectedTemplateVersionId,
    activeRun: displayedProjection,
  });

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      generationRef.current += 1;
      controllerRef.current?.abort();
      controllerRef.current = null;
      setIsStarting(false);
      setErrorMessage(null);
      setProjection(activeRun);
    }
    onOpenChange(nextOpen);
  }

  async function startSearch() {
    if (startDisabled || selectedTemplate === null) return;

    const controller = new AbortController();
    const generation = ++generationRef.current;
    controllerRef.current?.abort();
    controllerRef.current = controller;
    setIsStarting(true);
    setErrorMessage(null);

    const launch = await launchSearchRun({
      payload: createSearchLaunchPayload({
        companyId: company.id,
        templateVersionId: selectedTemplate.versionId,
        idempotencyKey: createOpaqueIdempotencyKey(),
      }),
      signal: controller.signal,
    });
    if (generation !== generationRef.current) return;
    if (launch.kind === 'aborted') {
      setIsStarting(false);
      return;
    }
    if (launch.kind === 'error') {
      setIsStarting(false);
      setProjection(null);
      setErrorMessage(launch.message);
      return;
    }

    const initialProjection = createInitialProjection({
      company,
      template: selectedTemplate,
      searchRunId: launch.searchRunId,
      status: launch.status,
    });
    setProjection(initialProjection);

    const polling = await pollSearchRun({
      searchRunId: launch.searchRunId,
      signal: controller.signal,
      onUpdate: (nextProjection) => {
        if (generation === generationRef.current) setProjection(nextProjection);
      },
    });
    if (generation !== generationRef.current) return;
    setIsStarting(false);
    if (polling.kind === 'terminal') {
      setProjection(polling.projection);
      return;
    }
    if (polling.kind === 'error') {
      setProjection(null);
      setErrorMessage(polling.message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Start Company Search</DialogTitle>
          <DialogDescription>
            Select a server-approved Search template. The run will use the resolved Buyer Roles and evidence policy shown below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label htmlFor="search-template" className="text-sm font-medium text-slate-900">
            Search template
          </label>
          <Select
            value={selectedTemplateVersionId}
            onValueChange={setSelectedTemplateVersionId}
            disabled={isStarting || isActiveSearchStatus(displayedProjection?.status)}
          >
            <SelectTrigger id="search-template" className="w-full" aria-label="Search template">
              <SelectValue placeholder="Select a Search template" />
            </SelectTrigger>
            <SelectContent>
              {templates.map((template) => (
                <SelectItem key={template.versionId} value={String(template.versionId)}>
                  {template.name} · v{template.version}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <SearchLauncherPanel
          company={company}
          template={selectedTemplate}
          activeRun={displayedProjection}
          isStartDisabled={startDisabled}
          isStarting={isStarting}
          errorMessage={errorMessage}
          onStartAction={startSearch}
        />

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SearchLauncherPanel({
  company,
  template,
  activeRun = null,
  isStartDisabled,
  isStarting = false,
  errorMessage = null,
  onStartAction,
}: {
  readonly company: SearchCompanyIdentity;
  readonly template: SearchTemplateProjection | null;
  readonly activeRun?: SearchStatusProjection | null;
  readonly isStartDisabled: boolean;
  readonly isStarting?: boolean;
  readonly errorMessage?: string | null;
  readonly onStartAction: () => void;
}) {
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

function createInitialProjection(input: {
  readonly company: SearchCompanyIdentity;
  readonly template: SearchTemplateProjection;
  readonly searchRunId: number;
  readonly status: SearchStatusProjection['status'];
}): SearchStatusProjection {
  return {
    searchRunId: input.searchRunId,
    status: input.status,
    company: input.company,
    template: {
      id: input.template.id,
      versionId: input.template.versionId,
      name: input.template.name,
      version: input.template.version,
    },
    candidateCounts: {
      total: 0,
      pending: 0,
      inconclusive: 0,
      ambiguous: 0,
      approved: 0,
      rejected: 0,
    },
    reviewsUrl: null,
  };
}

function createOpaqueIdempotencyKey(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
  if (cryptoApi) {
    const bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);
    return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function isActiveSearchStatus(status: SearchStatusProjection['status'] | undefined): boolean {
  return status === 'queued' || status === 'running';
}
