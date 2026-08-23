'use client';

import { useRouter } from 'next/navigation';
import { createContext, useContext, useState, useTransition } from 'react';
import type { ReactNode, SyntheticEvent } from 'react';

import {
  saveAnalysisTemplateAction,
  setAnalysisTemplateStatusAction,
} from '@/app/actions/analysisTemplates';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { ExecutorAvailability, ManagedAnalysisTemplateRead } from '@/lib/analysis/templateContracts';
import type { AnalysisEffort } from '@/lib/analysis/contracts';
import type { AnalysisExecutor } from '@/lib/analysis/executionTarget';

type Feedback =
  | { readonly kind: 'idle' }
  | { readonly kind: 'saving' }
  | { readonly kind: 'saved'; readonly message: string }
  | { readonly kind: 'error'; readonly message: string };

export function actionMessage(reason: string): string {
  switch (reason) {
    case 'conflict':
      return 'This template changed in another session. Refresh and try again.';
    case 'invalid_input':
      return 'Only the current instruction, default effort, and executor can be changed.';
    case 'not_found':
      return 'This template is no longer available. Refresh the page.';
    case 'action_failed':
      return 'Could not save this change. Please try again.';
    case 'executor_unavailable':
      return 'Arc-agentnet is currently unavailable. Keep Internal or try again later.';
    default:
      return 'Could not save this change. Please try again.';
  }
}

const ExecutorAvailabilityContext = createContext<ExecutorAvailability>({ companyArcAgentnetEnabled: false });

export function AgentTemplateExecutorAvailabilityProvider({
  availability,
  children,
}: {
  readonly availability: ExecutorAvailability;
  readonly children: ReactNode;
}) {
  return <ExecutorAvailabilityContext.Provider value={availability}>{children}</ExecutorAvailabilityContext.Provider>;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(value));
}

export function AgentTemplateCard({
  template,
}: {
  readonly template: ManagedAnalysisTemplateRead;
}) {
  const router = useRouter();
  const availability = useContext(ExecutorAvailabilityContext);
  const [current, setCurrent] = useState(template);
  const [instruction, setInstruction] = useState(template.latest.instruction);
  const [defaultEffort, setDefaultEffort] = useState<AnalysisEffort>(template.latest.defaultEffort);
  const [executor, setExecutor] = useState<AnalysisExecutor>(template.latest.executor);
  const [feedback, setFeedback] = useState<Feedback>({ kind: 'idle' });
  const [isPending, startTransition] = useTransition();
  const priorVersions = current.history.slice(1);
  const executorOptions: readonly { readonly value: AnalysisExecutor; readonly label: string }[] = current.targetType === 'company' && availability.companyArcAgentnetEnabled ? [{ value: 'internal', label: 'Internal' }, { value: 'arc-agentnet', label: 'Arc-agentnet' }] : [{ value: 'internal', label: 'Internal' }];
  const isExecutorValid = executor === 'internal' || (current.targetType === 'company' && availability.companyArcAgentnetEnabled);
  const executorIssue = current.targetType === 'persona' ? 'Company-only executor: Persona templates use Internal.' : 'Arc-agentnet is currently unavailable for this template.';

  function markDirty(): void { setFeedback((previous) => (previous.kind === 'saving' ? previous : { kind: 'idle' })); }

  function saveContent(event: SyntheticEvent<HTMLFormElement>): void {
    event.preventDefault();
    setFeedback({ kind: 'saving' });
    startTransition(async () => {
      try {
        const result = await saveAnalysisTemplateAction({
          operation: 'content',
          templateKey: current.key,
          expectedVersion: current.latest.version,
          instruction,
          defaultEffort,
          executor,
        });
        if (result.ok) {
          setCurrent(result.template);
          setInstruction(result.template.latest.instruction);
          setDefaultEffort(result.template.latest.defaultEffort);
          setExecutor(result.template.latest.executor);
          setFeedback({
            kind: 'saved',
            message:
              result.kind === 'version_appended'
                ? `Saved as version ${result.template.latest.version}.`
                : 'No content changes to save.',
          });
          router.refresh();
          return;
        }
        setFeedback({ kind: 'error', message: actionMessage(result.reason) });
      } catch (error: unknown) {
        if (error instanceof Error) { setFeedback({ kind: 'error', message: 'Could not save this change. Please try again.' }); return; }
        setFeedback({ kind: 'error', message: 'Could not save this change. Please try again.' });
      }
    });
  }

  function changeLifecycle(): void {
    const nextStatus = current.status === 'active' ? 'retired' : 'active';
    setFeedback({ kind: 'saving' });
    startTransition(async () => {
      try {
        const result = await setAnalysisTemplateStatusAction({
          operation: 'lifecycle',
          templateKey: current.key,
          status: nextStatus,
        });
        if (result.ok) {
          setCurrent(result.template);
          setFeedback({
            kind: 'saved',
            message: nextStatus === 'active' ? 'Template reactivated.' : 'Template retired.',
          });
          router.refresh();
          return;
        }
        setFeedback({ kind: 'error', message: actionMessage(result.reason) });
      } catch (error: unknown) {
        if (error instanceof Error) { setFeedback({ kind: 'error', message: 'Could not change this template. Please try again.' }); return; }
        setFeedback({ kind: 'error', message: 'Could not change this template. Please try again.' });
      }
    });
  }

  return (
    <article data-template-key={current.key} className="flex flex-col gap-6 rounded-lg border border-slate-200 bg-white p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1"><h3 className="text-[18px] font-semibold leading-[1.2] text-slate-900">{current.name}</h3><p className="text-sm text-slate-500">Target: {current.targetType}</p></div>
        <div className="flex items-center gap-2">
          <Badge variant={current.status === 'active' ? 'secondary' : 'outline'}>
            {current.status === 'active' ? 'Active' : 'Retired'}
          </Badge>
          <Badge variant="outline">Current version {current.latest.version}</Badge>
        </div>
      </div>

      <form onSubmit={saveContent} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor={`${current.key}-instruction`} className="text-[12px] font-medium text-slate-700">Current instruction</label>
          <Textarea
            id={`${current.key}-instruction`}
            value={instruction}
            onChange={(event) => {
              markDirty();
              setInstruction(event.target.value);
            }}
            rows={5}
            disabled={isPending}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor={`${current.key}-effort`} className="text-[12px] font-medium text-slate-700">Default effort</label>
          <Select
            value={defaultEffort}
            onValueChange={(value) => {
              markDirty();
              const nextEffort = current.latest.supportedEfforts.find((effort) => effort === value);
              if (nextEffort) setDefaultEffort(nextEffort);
            }}
            disabled={isPending}
          >
            <SelectTrigger id={`${current.key}-effort`} aria-label="Default effort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {current.latest.supportedEfforts.map((effort) => (
                <SelectItem key={effort} value={effort}>
                  {effort}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor={`${current.key}-executor`} className="text-[12px] font-medium text-slate-700">Executor</label>
          <Select
            value={executor}
            onValueChange={(value) => {
              markDirty();
              const nextExecutor = executorOptions.find((option) => option.value === value)?.value;
              if (nextExecutor) setExecutor(nextExecutor);
            }}
            disabled={isPending}
          >
            <SelectTrigger id={`${current.key}-executor`} aria-label="Executor" data-executor-value={executor} data-executor-options={executorOptions.map(({ value }) => value).join(',')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {executorOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-slate-500">{current.targetType === 'persona' ? 'Company-only executor: Persona templates use Internal.' : 'Company templates can use Arc-agentnet when enabled.'}</p>
          {!isExecutorValid ? (
            <p role="alert" className="text-xs text-red-600">Invalid executor configuration: {executorIssue}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <Button type="submit" disabled={isPending || !isExecutorValid}>
            {isPending ? 'Saving…' : 'Save new version'}
          </Button>
          <Button type="button" variant="outline" onClick={changeLifecycle} disabled={isPending}>
            {current.status === 'active' ? 'Retire template' : 'Reactivate template'}
          </Button>
          {feedback.kind === 'saved' ? <p className="text-sm text-slate-600">{feedback.message}</p> : null}
          {feedback.kind === 'error' ? <p role="alert" className="text-sm text-red-600">{feedback.message}</p> : null}
        </div>
      </form>

      <div className="grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
        <div>
          <p className="text-[12px] font-medium text-slate-500">Supported efforts</p>
          <p className="text-sm text-slate-700">{current.latest.supportedEfforts.join(', ')}</p>
        </div>
        <div>
          <p className="text-[12px] font-medium text-slate-500">Execution budget</p>
          <p className="text-sm text-slate-700">{current.latest.futureBudget.maxExecutionSeconds}s / run</p>
        </div>
      </div>

      <section aria-labelledby={`${current.key}-history-heading`} className="flex flex-col gap-3 border-t border-slate-100 pt-4">
        <div>
          <h4 id={`${current.key}-history-heading`} className="text-sm font-semibold text-slate-900">Read-only history</h4>
          <p className="text-xs text-slate-500">Prior versions remain available for existing run inspection.</p>
        </div>
        {priorVersions.length === 0 ? (
          <p className="text-sm text-slate-500">No prior versions.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {priorVersions.map((version) => (
              <div key={version.templateVersionId} data-history-version={version.version} className="rounded-md border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium text-slate-800">Version {version.version}</p><Badge variant="outline">Read-only</Badge><span className="text-xs text-slate-500">{formatDate(version.createdAt)}</span></div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{version.instruction}</p>
                <p className="mt-2 text-xs text-slate-500">Default effort: {version.defaultEffort}</p>
                <p className="mt-2 text-xs text-slate-500">Executor: {version.executor === 'internal' ? 'Internal' : 'Arc-agentnet'}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </article>
  );
}
