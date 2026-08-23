'use client';

import { useEffect, useRef, useState, useSyncExternalStore, type SyntheticEvent } from 'react';
import { useRouter } from 'next/navigation';

import { useDebugLaunchPreferenceOrSafe } from './debug-launch-preference-provider';
import type { DebugLaunchPreferenceController } from '@/lib/analysis/debugLaunchPreference';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AnalysisPreviewPanel } from './AnalysisPreviewPanel';
import {
  isTerminalAnalysisStatus,
  pollAnalysisRun,
  type AnalysisRunStatusResponse,
} from '@/lib/analysis/pollingClient';
import {
  ANALYSIS_LAUNCHER_ERROR_COPY,
  analysisRunEndpoint,
  createArcAgentnetRunPayload,
  createAnalysisRunPayload as createClientAnalysisRunPayload,
  fetchAnalysisPreview,
  fetchAnalysisOptions,
  getErrorCopy,
  parseCreateRunResponse,
  pollArcAgentnetRun,
  readJson,
  type AnalysisPreview,
  type AnalysisRunPayloadInput,
  type AnalysisSubjectType,
  type AnalysisExecutor,
  type AgentOption,
  type AgentSelection,
  type PracticeArea,
} from './analysisLauncherClient';

export type { AnalysisSubjectType } from './analysisLauncherClient';

type OptionsState =
  | { readonly status: 'loading' }
  | {
      readonly status: 'ready';
      readonly practiceAreas: readonly PracticeArea[];
      readonly agents: readonly AgentOption[] | null;
      readonly signalCategories: readonly string[];
      readonly loadedPracticeAreaId: number | null;
    }
  | { readonly status: 'error'; readonly message: string };
type PreviewState =
  | { readonly status: 'idle' | 'loading' }
  | { readonly status: 'ready'; readonly preview: AnalysisPreview }
  | { readonly status: 'error'; readonly message: string };
type LaunchState =
  | { readonly status: 'idle' | 'launching' }
  | { readonly status: 'started'; readonly applicationRunId: number; readonly run: AnalysisRunStatusResponse | null }
  | { readonly status: 'error'; readonly message: string };

export interface AnalysisLauncherProps {
  readonly open: boolean;
  readonly subjectType: AnalysisSubjectType;
  readonly subjectId: number;
  readonly onOpenChange: (open: boolean) => void;
}

export interface AnalysisPreviewPayloadInput {
  readonly subjectType: AnalysisSubjectType;
  readonly subjectId: number;
  readonly practiceAreaId: number;
  readonly signalCategory: string;
  readonly selection: AgentSelection;
}

interface LegacyFixedAnalysisRunPayloadInput {
  readonly templateVersionId: number;
  readonly subjectType: AnalysisSubjectType;
  readonly subjectId: number;
  readonly practiceAreaId: number;
  readonly signalCategory: string;
}

type LauncherAnalysisRunPayloadInput = AnalysisRunPayloadInput | LegacyFixedAnalysisRunPayloadInput;
type LauncherAnalysisRunPayload = ReturnType<typeof createClientAnalysisRunPayload>;

export function createAnalysisRunPayload(input: AnalysisRunPayloadInput): LauncherAnalysisRunPayload;
export function createAnalysisRunPayload(input: LegacyFixedAnalysisRunPayloadInput): LauncherAnalysisRunPayload;
export function createAnalysisRunPayload(input: LauncherAnalysisRunPayloadInput): LauncherAnalysisRunPayload {
  if ('selection' in input) return createClientAnalysisRunPayload(input);
  return createClientAnalysisRunPayload({
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    practiceAreaId: input.practiceAreaId,
    signalCategory: input.signalCategory,
    selection: { kind: 'fixed', templateVersionId: input.templateVersionId },
  });
}

export function analysisAgentOptionKey(agent: AgentOption): string {
  switch (agent.kind) {
    case 'fixed':
      return `fixed:${agent.templateVersionId}`;
    case 'custom':
      return `custom:${agent.customAgentId}:${agent.templateVersionId}`;
    default:
      return assertNever(agent);
  }
}

export function analysisAgentSelection(agent: AgentOption): AgentSelection {
  switch (agent.kind) {
    case 'fixed':
      return { kind: 'fixed', templateVersionId: agent.templateVersionId };
    case 'custom':
      return {
        kind: 'custom',
        customAgentId: agent.customAgentId,
        templateVersionId: agent.templateVersionId,
      };
    default:
      return assertNever(agent);
  }
}

export function defaultAnalysisAgentKey(agents: readonly AgentOption[]): string {
  const first = agents[0];
  return first?.kind === 'fixed' ? analysisAgentOptionKey(first) : '';
}

export function availableAnalysisAgentsForSubject(
  subjectType: AnalysisSubjectType,
  agents: readonly AgentOption[],
): readonly AgentOption[] {
  return subjectType === 'company'
    ? agents
    : agents.filter((agent) => agent.executor === 'internal');
}

export function isAnalysisAgentPickerReady(
  status: OptionsState['status'],
  agents: readonly AgentOption[] | null,
): boolean {
  return status === 'ready' && agents !== null;
}

export function createAnalysisPreviewPayload({
  subjectType,
  subjectId,
  practiceAreaId,
  signalCategory,
  selection,
}: AnalysisPreviewPayloadInput) {
  const subject = { type: subjectType, id: subjectId };
  const selectionPayload = (() => {
    switch (selection.kind) {
      case 'fixed':
        return { kind: 'fixed' as const, templateVersionId: selection.templateVersionId };
      case 'custom':
        return {
          kind: 'custom' as const,
          customAgentId: selection.customAgentId,
          templateVersionId: selection.templateVersionId,
        };
      default:
        return assertNever(selection);
    }
  })();
  return {
    subject,
    practiceAreaId,
    signalCategory,
    selection: selectionPayload,
  };
}

export interface AnalysisRunLaunchInput {
  readonly controller: DebugLaunchPreferenceController;
  readonly payload: AnalysisRunPayloadInput;
  readonly signal: AbortSignal;
}

export type AnalysisRunLaunchResult =
  | { readonly kind: 'blocked' }
  | { readonly kind: 'started'; readonly applicationRunId: number }
  | { readonly kind: 'error'; readonly message: string };

// Reads the confirmed debug launch preference exactly once, immediately
// before the POST, and never re-reads it -- a preference change after this
// call starts cannot retarget the in-flight request. A debug-route 401/404
// (revoked authorization) resets the preference to Off; every other error
// surfaces the existing generic copy with no automatic fallback to the
// ordinary route.
export async function performAnalysisRunLaunch({
  controller,
  payload,
  signal,
}: AnalysisRunLaunchInput): Promise<AnalysisRunLaunchResult> {
  const executor = payload.executor ?? 'internal';
  if (executor === 'arc-agentnet') {
    if (payload.subjectType !== 'company') return { kind: 'error', message: 'The analysis run could not be started. Try again.' };
    const response = await fetch('/api/analysis-runs/arc-agentnet', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal,
      body: JSON.stringify(createArcAgentnetRunPayload({
        subjectType: payload.subjectType,
        subjectId: payload.subjectId,
        practiceAreaId: payload.practiceAreaId,
        signalCategory: payload.signalCategory,
        selection: payload.selection,
        idempotencyKey: crypto.randomUUID(),
      })),
    });
    const responseBody = await readJson(response);
    if (!response.ok) return { kind: 'error', message: getErrorCopy(responseBody) };
    const applicationRunId = parseCreateRunResponse(responseBody);
    return applicationRunId === null
      ? { kind: 'error', message: 'The analysis run could not be started. Try again.' }
      : { kind: 'started', applicationRunId };
  }
  const snapshot = controller.getSnapshot();
  if (snapshot.status !== 'confirmed') return { kind: 'blocked' };

  const endpoint = analysisRunEndpoint(snapshot.preference);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    signal,
    body: JSON.stringify(createClientAnalysisRunPayload(payload)),
  });
  const responseBody = await readJson(response);
  if (!response.ok) {
    if (endpoint === '/api/debug/analysis-runs' && (response.status === 401 || response.status === 404)) {
      controller.reset();
    }
    return { kind: 'error', message: getErrorCopy(responseBody) };
  }

  const applicationRunId = parseCreateRunResponse(responseBody);
  if (applicationRunId === null) {
    return { kind: 'error', message: 'The analysis run could not be started. Try again.' };
  }
  return { kind: 'started', applicationRunId };
}

export function AnalysisLauncher({
  open,
  subjectType,
  subjectId,
  onOpenChange,
}: AnalysisLauncherProps) {
  const router = useRouter();
  const debugLaunchPreferenceController = useDebugLaunchPreferenceOrSafe();
  const debugLaunchPreferenceSnapshot = useSyncExternalStore(
    debugLaunchPreferenceController.subscribe,
    debugLaunchPreferenceController.getSnapshot,
    debugLaunchPreferenceController.getSnapshot,
  );
  const isDebugLaunchPreferenceReady = debugLaunchPreferenceSnapshot.status === 'confirmed';
  const [optionsState, setOptionsState] = useState<OptionsState>({ status: 'loading' });
  const [practiceAreaId, setPracticeAreaId] = useState('');
  const [signalCategory, setSignalCategory] = useState('');
  const [selectedAgentKey, setSelectedAgentKey] = useState('');
  const [previewState, setPreviewState] = useState<PreviewState>({ status: 'idle' });
  const [launchState, setLaunchState] = useState<LaunchState>({ status: 'idle' });
  const generationRef = useRef(0);
  const optionsControllerRef = useRef<AbortController | null>(null);
  const previewControllerRef = useRef<AbortController | null>(null);
  const launchControllerRef = useRef<AbortController | null>(null);
  const pollControllerRef = useRef<AbortController | null>(null);
  const optionPracticeAreas = optionsState.status === 'ready' ? optionsState.practiceAreas : null;
  const optionAgents = optionsState.status === 'ready' ? optionsState.agents : null;
  const optionSignalCategories = optionsState.status === 'ready' ? optionsState.signalCategories : null;
  const loadedPracticeAreaId = optionsState.status === 'ready' ? optionsState.loadedPracticeAreaId : null;

  function abortRequests() {
    optionsControllerRef.current?.abort();
    previewControllerRef.current?.abort();
    launchControllerRef.current?.abort();
    pollControllerRef.current?.abort();
    optionsControllerRef.current = null;
    previewControllerRef.current = null;
    launchControllerRef.current = null;
    pollControllerRef.current = null;
  }

  useEffect(() => {
    const generation = ++generationRef.current;
    abortRequests();
    setOptionsState({ status: 'loading' });
    setPracticeAreaId('');
    setSignalCategory('');
    setSelectedAgentKey('');
    setPreviewState({ status: 'idle' });
    setLaunchState({ status: 'idle' });
    if (!open) return;

    const controller = new AbortController();
    optionsControllerRef.current = controller;
    void loadOptions(controller, generation, undefined);

    return () => {
      controller.abort();
      if (generationRef.current === generation) generationRef.current++;
    };
  }, [open, subjectId, subjectType]);

  useEffect(() => () => abortRequests(), []);

  useEffect(() => {
    if (!open || !practiceAreaId || optionsState.status !== 'ready') return;
    const selectedId = Number(practiceAreaId);
    if (!Number.isInteger(selectedId) || selectedId <= 0) return;
    if (optionsState.loadedPracticeAreaId === selectedId) return;

    const generation = ++generationRef.current;
    optionsControllerRef.current?.abort();
    previewControllerRef.current?.abort();
    optionsControllerRef.current = null;
    previewControllerRef.current = null;
    setOptionsState((current) => current.status === 'ready' ? { ...current, agents: null } : current);
    setSignalCategory('');
    setSelectedAgentKey('');
    setPreviewState({ status: 'idle' });
    setLaunchState({ status: 'idle' });
    const controller = new AbortController();
    optionsControllerRef.current = controller;
    void loadOptions(controller, generation, selectedId);

    return () => controller.abort();
  }, [loadedPracticeAreaId, open, optionPracticeAreas, optionsState.status, practiceAreaId, subjectId, subjectType]);

  const agentOptions = optionAgents === null ? null : availableAnalysisAgentsForSubject(subjectType, optionAgents);
  const selectedAgent = agentOptions?.find((agent) => analysisAgentOptionKey(agent) === selectedAgentKey) ?? null;
  const agentPickerReady = isAnalysisAgentPickerReady(optionsState.status, agentOptions);

  useEffect(() => {
    if (!open || !practiceAreaId || !signalCategory || optionsState.status !== 'ready' || optionsState.agents === null || selectedAgent === null) return;
    const selectedId = Number(practiceAreaId);
    if (!Number.isInteger(selectedId) || selectedId <= 0 || optionsState.loadedPracticeAreaId !== selectedId) return;

    const generation = generationRef.current;
    const controller = new AbortController();
    previewControllerRef.current?.abort();
    previewControllerRef.current = controller;
    setPreviewState({ status: 'loading' });
    void loadPreview({
      controller,
      generation,
      selectedId,
      signalCategory,
      selection: analysisAgentSelection(selectedAgent),
    });

    return () => controller.abort();
  }, [agentOptions, loadedPracticeAreaId, open, optionsState.status, practiceAreaId, selectedAgentKey, signalCategory, subjectId, subjectType]);

  async function loadOptions(controller: AbortController, generation: number, selectedPracticeAreaId: number | undefined) {
    try {
      const result = await fetchAnalysisOptions(subjectType, selectedPracticeAreaId, controller.signal);
      if (!isCurrent(generation, controller)) return;
      if (!result.ok) {
        setOptionsState({ status: 'error', message: result.message });
        return;
      }
      if (selectedPracticeAreaId === undefined) {
        setOptionsState({
          status: 'ready',
          practiceAreas: result.practiceAreas,
          agents: null,
          signalCategories: [],
          loadedPracticeAreaId: null,
        });
        setPracticeAreaId(String(result.practiceAreas[0]?.id ?? ''));
        return;
      }
      setOptionsState({
        status: 'ready',
        practiceAreas: result.practiceAreas,
        agents: result.agents,
        signalCategories: result.signalCategories,
        loadedPracticeAreaId: selectedPracticeAreaId,
      });
      setSelectedAgentKey(defaultAnalysisAgentKey(availableAnalysisAgentsForSubject(subjectType, result.agents)));
    } catch (error: unknown) {
      if (isAbortError(error) || !isCurrent(generation, controller)) return;
      setOptionsState({ status: 'error', message: error instanceof TypeError ? ANALYSIS_LAUNCHER_ERROR_COPY.network : 'Analysis options could not be loaded. Refresh and try again.' });
    }
  }

  async function loadPreview({
    controller,
    generation,
    selectedId,
    signalCategory: selectedSignalCategory,
    selection,
  }: {
    readonly controller: AbortController;
    readonly generation: number;
    readonly selectedId: number;
    readonly signalCategory: string;
    readonly selection: AgentSelection;
  }) {
    try {
      const result = await fetchAnalysisPreview({
        subjectType,
        subjectId,
        practiceAreaId: selectedId,
        signalCategory: selectedSignalCategory,
        selection,
        signal: controller.signal,
      });
      if (!isCurrent(generation, controller)) return;
      setPreviewState(result.ok
        ? { status: 'ready', preview: result.preview }
        : { status: 'error', message: result.message });
    } catch (error: unknown) {
      if (isAbortError(error) || !isCurrent(generation, controller)) return;
      setPreviewState({ status: 'error', message: error instanceof TypeError ? ANALYSIS_LAUNCHER_ERROR_COPY.network : 'The analysis preview could not be loaded. Refresh and try again.' });
    }
  }

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const isLaunchReady = selectedAgent?.executor === 'arc-agentnet' || isDebugLaunchPreferenceReady;
    if (!isLaunchReady || !signalCategory || previewState.status !== 'ready' || selectedAgent === null || launchState.status === 'launching' || launchState.status === 'started') return;
    const generation = generationRef.current;
    const controller = new AbortController();
    launchControllerRef.current?.abort();
    launchControllerRef.current = controller;
    setLaunchState({ status: 'launching' });
    try {
      const result = await performAnalysisRunLaunch({
        controller: debugLaunchPreferenceController,
        payload: {
          subjectType,
          subjectId,
          practiceAreaId: previewState.preview.practiceArea.id,
          signalCategory,
          selection: analysisAgentSelection(selectedAgent),
          executor: selectedAgent.executor,
        },
        signal: controller.signal,
      });
      if (!isCurrent(generation, controller)) return;
      if (result.kind === 'blocked') {
        setLaunchState({ status: 'idle' });
        return;
      }
      if (result.kind === 'error') {
        setLaunchState({ status: 'error', message: result.message });
        return;
      }
      setLaunchState({ status: 'started', applicationRunId: result.applicationRunId, run: null });
      if (selectedAgent.executor === 'internal') router.refresh();
      startPolling(result.applicationRunId, generation, selectedAgent.executor);
    } catch (error: unknown) {
      if (isAbortError(error) || !isCurrent(generation, controller)) return;
      setLaunchState({ status: 'error', message: error instanceof TypeError ? ANALYSIS_LAUNCHER_ERROR_COPY.network : 'The analysis run could not be started. Try again.' });
    }
  }

  function startPolling(applicationRunId: number, generation: number, executor: AnalysisExecutor) {
    const controller = new AbortController();
    pollControllerRef.current = controller;
    if (executor === 'arc-agentnet') {
      void pollArcAgentnetRun({ applicationRunId, signal: controller.signal }).then((result) => {
        if (generation !== generationRef.current || result.kind === 'aborted') return;
        if (result.kind === 'error') setLaunchState({ status: 'error', message: result.message });
        if (result.kind === 'terminal') router.refresh();
      });
      return;
    }
    void pollAnalysisRun({
      applicationRunId,
      signal: controller.signal,
      onUpdate: (run) => {
        if (generation === generationRef.current) setLaunchState({ status: 'started', applicationRunId, run });
      },
    }).then((result) => {
      if (generation !== generationRef.current || result.kind === 'aborted') return;
      if (result.kind === 'error') setLaunchState({ status: 'error', message: result.message });
      if (result.kind === 'terminal') router.refresh();
    });
  }

  function isCurrent(generation: number, controller: AbortController): boolean {
    return generation === generationRef.current && !controller.signal.aborted;
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      generationRef.current++;
      abortRequests();
      setLaunchState({ status: 'idle' });
      setPreviewState({ status: 'idle' });
      setPracticeAreaId('');
      setSignalCategory('');
      setSelectedAgentKey('');
    }
    onOpenChange(nextOpen);
  }

  const heading = subjectType === 'company' ? 'Company analysis' : 'Persona analysis';
  const practiceAreas = optionsState.status === 'ready' ? optionsState.practiceAreas : [];
  const signalCategories = optionSignalCategories ?? [];
  const availableAgents = agentOptions ?? [];
  const preview = previewState.status === 'ready' ? previewState.preview : null;
  const isLaunchReady = selectedAgent?.executor === 'arc-agentnet' || isDebugLaunchPreferenceReady;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{heading}</DialogTitle>
          <DialogDescription>Choose a Practice Area and Buying Signal Category, inspect the resolved preview, then start the durable analysis run.</DialogDescription>
        </DialogHeader>
        {optionsState.status === 'loading' ? <p role="status">Loading analysis options…</p> : null}
        {optionsState.status === 'error' ? <p role="alert" className="text-red-600">{optionsState.message}</p> : null}
        {optionsState.status === 'ready' && practiceAreas.length === 0 ? <p role="status">No Practice Areas are available for analysis.</p> : null}
        {optionsState.status === 'ready' && practiceAreas.length > 0 ? (
          <form id={`analysis-launch-${subjectType}-${subjectId}`} onSubmit={handleSubmit} className="space-y-4">
             <div className="grid gap-4 sm:grid-cols-2">
               <div className="space-y-2">
                 <label htmlFor={`analysis-practice-area-${subjectType}-${subjectId}`} className="block text-sm font-medium text-slate-700">Practice Area</label>
                 <Select value={practiceAreaId || undefined} onValueChange={(value) => { setPracticeAreaId(value); setSignalCategory(''); setSelectedAgentKey(''); setPreviewState({ status: 'idle' }); setLaunchState({ status: 'idle' }); }} disabled={launchState.status === 'launching' || launchState.status === 'started'}>
                   <SelectTrigger id={`analysis-practice-area-${subjectType}-${subjectId}`} className="w-full"><SelectValue placeholder="Select a Practice Area" /></SelectTrigger>
                   <SelectContent>{practiceAreas.map((area) => <SelectItem key={area.id} value={String(area.id)}>{`${area.name} · ${area.shortCode}`}</SelectItem>)}</SelectContent>
                 </Select>
               </div>
               <div className="space-y-2">
                 <label htmlFor={`analysis-signal-category-${subjectType}-${subjectId}`} className="block text-sm font-medium text-slate-700">Buying Signal Category</label>
                 <Select value={signalCategory} onValueChange={(value) => { setSignalCategory(value); setLaunchState({ status: 'idle' }); }} disabled={!agentPickerReady || signalCategories.length === 0 || launchState.status === 'launching' || launchState.status === 'started'}>
                   <SelectTrigger id={`analysis-signal-category-${subjectType}-${subjectId}`} className="w-full"><SelectValue placeholder="Select a Buying Signal Category" /></SelectTrigger>
                   <SelectContent>{signalCategories.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent>
                 </Select>
               </div>
             </div>
             {agentPickerReady && signalCategories.length === 0 ? <p role="status">No active Buying Signal Categories are available for this Practice Area.</p> : null}
             {agentPickerReady && availableAgents.length > 0 ? (
               <>
                 <label htmlFor={`analysis-agent-${subjectType}-${subjectId}`} className="block text-sm font-medium text-slate-700">Analysis agent</label>
                 <Select value={selectedAgentKey || undefined} onValueChange={(value) => { setSelectedAgentKey(value); setLaunchState({ status: 'idle' }); }} disabled={launchState.status === 'launching' || launchState.status === 'started'}>
                   <SelectTrigger id={`analysis-agent-${subjectType}-${subjectId}`}><SelectValue placeholder="Select an analysis agent" /></SelectTrigger>
                   <SelectContent>{availableAgents.map((agent) => <SelectItem key={analysisAgentOptionKey(agent)} value={analysisAgentOptionKey(agent)}>{analysisAgentLabel(agent)}</SelectItem>)}</SelectContent>
                 </Select>
               </>
             ) : null}
             {agentPickerReady && availableAgents.length === 0 ? <p role="status">No compatible analysis agents are available.</p> : null}
             {previewState.status === 'loading' ? <p role="status">Loading analysis preview…</p> : null}
            {previewState.status === 'error' ? <p role="alert" className="text-red-600">{previewState.message}</p> : null}
            {preview ? <AnalysisPreviewPanel preview={preview} /> : null}
            {launchState.status === 'error' ? <p role="alert" className="text-red-600">{launchState.message}</p> : null}
            {launchState.status === 'started' ? <p role="status">{`Analysis run #${launchState.applicationRunId} started${launchState.run && isTerminalAnalysisStatus(launchState.run.status) ? ` · ${launchState.run.status}` : ''}.`}</p> : null}
              <Button type="submit" disabled={!isLaunchReady || !preview || !signalCategory || selectedAgent === null || launchState.status === 'launching' || launchState.status === 'started'}>{launchState.status === 'launching' ? 'Starting…' : launchState.status === 'started' ? 'Started' : 'Start analysis'}</Button>
          </form>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export function analysisAgentLabel(agent: AgentOption): string {
  const executorLabel = agent.executor === 'arc-agentnet' ? 'Arc-agentnet' : 'Internal';
  switch (agent.kind) {
    case 'fixed':
      return `Fixed v1.7 · ${agent.name} · v${agent.version} · ${executorLabel}`;
    case 'custom':
      return `Custom · ${agent.name} · v${agent.version} · ${executorLabel}`;
    default:
      return assertNever(agent);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unexpected analysis agent kind: ${String(value)}`);
}
