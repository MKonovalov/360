'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

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
  createAnalysisRunPayload,
  fetchAnalysisOptions,
  fetchAnalysisPreview,
  getErrorCopy,
  parseCreateRunResponse,
  readJson,
  type AnalysisPreview,
  type AnalysisSubjectType,
  type PracticeArea,
} from './analysisLauncherClient';

export { createAnalysisRunPayload } from './analysisLauncherClient';
export type { AnalysisSubjectType } from './analysisLauncherClient';

type OptionsState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly practiceAreas: readonly PracticeArea[] }
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

export function AnalysisLauncher({
  open,
  subjectType,
  subjectId,
  onOpenChange,
}: AnalysisLauncherProps) {
  const router = useRouter();
  const [optionsState, setOptionsState] = useState<OptionsState>({ status: 'loading' });
  const [practiceAreaId, setPracticeAreaId] = useState('');
  const [previewState, setPreviewState] = useState<PreviewState>({ status: 'idle' });
  const [launchState, setLaunchState] = useState<LaunchState>({ status: 'idle' });
  const generationRef = useRef(0);
  const optionsControllerRef = useRef<AbortController | null>(null);
  const previewControllerRef = useRef<AbortController | null>(null);
  const launchControllerRef = useRef<AbortController | null>(null);
  const pollControllerRef = useRef<AbortController | null>(null);

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
    setPreviewState({ status: 'idle' });
    setLaunchState({ status: 'idle' });
    if (!open) return;

    const controller = new AbortController();
    optionsControllerRef.current = controller;
    void loadOptions(controller, generation);

    return () => {
      controller.abort();
      if (generationRef.current === generation) generationRef.current++;
    };
  }, [open, subjectId, subjectType]);

  useEffect(() => {
    if (!open || !practiceAreaId || optionsState.status !== 'ready') return;
    const selectedId = Number(practiceAreaId);
    if (!Number.isInteger(selectedId) || selectedId <= 0) return;

    const generation = generationRef.current;
    const controller = new AbortController();
    previewControllerRef.current?.abort();
    previewControllerRef.current = controller;
    setPreviewState({ status: 'loading' });
    void loadPreview(controller, generation, selectedId);

    return () => controller.abort();
  }, [open, optionsState.status, practiceAreaId, subjectId, subjectType]);

  async function loadOptions(controller: AbortController, generation: number) {
    try {
      const result = await fetchAnalysisOptions(subjectType, controller.signal);
      if (!isCurrent(generation, controller)) return;
      if (!result.ok) {
        setOptionsState({ status: 'error', message: result.message });
        return;
      }
      setOptionsState({ status: 'ready', practiceAreas: result.practiceAreas });
      setPracticeAreaId(String(result.practiceAreas[0]?.id ?? ''));
    } catch (error: unknown) {
      if (isAbortError(error) || !isCurrent(generation, controller)) return;
      setOptionsState({ status: 'error', message: error instanceof TypeError ? ANALYSIS_LAUNCHER_ERROR_COPY.network : 'Analysis options could not be loaded. Refresh and try again.' });
    }
  }

  async function loadPreview(controller: AbortController, generation: number, selectedId: number) {
    try {
      const result = await fetchAnalysisPreview({
        subjectType,
        subjectId,
        practiceAreaId: selectedId,
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (previewState.status !== 'ready' || launchState.status === 'launching' || launchState.status === 'started') return;
    const generation = generationRef.current;
    const controller = new AbortController();
    launchControllerRef.current?.abort();
    launchControllerRef.current = controller;
    setLaunchState({ status: 'launching' });
    try {
      const response = await fetch('/api/analysis-runs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify(createAnalysisRunPayload({
          templateVersionId: previewState.preview.template.templateVersionId,
          subjectType,
          subjectId,
          practiceAreaId: previewState.preview.practiceArea.id,
        })),
      });
      const payload = await readJson(response);
      if (!isCurrent(generation, controller)) return;
      if (!response.ok) {
        setLaunchState({ status: 'error', message: getErrorCopy(payload) });
        return;
      }
      const applicationRunId = parseCreateRunResponse(payload);
      if (applicationRunId === null) {
        setLaunchState({ status: 'error', message: 'The analysis run could not be started. Try again.' });
        return;
      }
      setLaunchState({ status: 'started', applicationRunId, run: null });
      router.refresh();
      startPolling(applicationRunId, generation);
    } catch (error: unknown) {
      if (isAbortError(error) || !isCurrent(generation, controller)) return;
      setLaunchState({ status: 'error', message: error instanceof TypeError ? ANALYSIS_LAUNCHER_ERROR_COPY.network : 'The analysis run could not be started. Try again.' });
    }
  }

  function startPolling(applicationRunId: number, generation: number) {
    const controller = new AbortController();
    pollControllerRef.current = controller;
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
    }
    onOpenChange(nextOpen);
  }

  const heading = subjectType === 'company' ? 'Company analysis' : 'Persona analysis';
  const practiceAreas = optionsState.status === 'ready' ? optionsState.practiceAreas : [];
  const preview = previewState.status === 'ready' ? previewState.preview : null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{heading}</DialogTitle>
          <DialogDescription>Choose a Practice Area, inspect the resolved preview, then start the durable analysis run.</DialogDescription>
        </DialogHeader>
        {optionsState.status === 'loading' ? <p role="status">Loading analysis options…</p> : null}
        {optionsState.status === 'error' ? <p role="alert" className="text-red-600">{optionsState.message}</p> : null}
        {optionsState.status === 'ready' && practiceAreas.length === 0 ? <p role="status">No Practice Areas are available for analysis.</p> : null}
        {optionsState.status === 'ready' && practiceAreas.length > 0 ? (
          <form id={`analysis-launch-${subjectType}-${subjectId}`} onSubmit={handleSubmit} className="space-y-4">
            <label htmlFor={`analysis-practice-area-${subjectType}-${subjectId}`} className="block text-sm font-medium text-slate-700">Practice Area</label>
            <Select value={practiceAreaId || undefined} onValueChange={(value) => { setPracticeAreaId(value); setLaunchState({ status: 'idle' }); }} disabled={launchState.status === 'launching' || launchState.status === 'started'}>
              <SelectTrigger id={`analysis-practice-area-${subjectType}-${subjectId}`}><SelectValue placeholder="Select a Practice Area" /></SelectTrigger>
              <SelectContent>{practiceAreas.map((area) => <SelectItem key={area.id} value={String(area.id)}>{`${area.name} · ${area.shortCode}`}</SelectItem>)}</SelectContent>
            </Select>
            {previewState.status === 'loading' ? <p role="status">Loading analysis preview…</p> : null}
            {previewState.status === 'error' ? <p role="alert" className="text-red-600">{previewState.message}</p> : null}
            {preview ? <AnalysisPreviewPanel preview={preview} /> : null}
            {launchState.status === 'error' ? <p role="alert" className="text-red-600">{launchState.message}</p> : null}
            {launchState.status === 'started' ? <p role="status">{`Analysis run #${launchState.applicationRunId} started${launchState.run && isTerminalAnalysisStatus(launchState.run.status) ? ` · ${launchState.run.status}` : ''}.`}</p> : null}
            <Button type="submit" disabled={!preview || launchState.status === 'launching' || launchState.status === 'started'}>{launchState.status === 'launching' ? 'Starting…' : launchState.status === 'started' ? 'Started' : 'Start analysis'}</Button>
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
