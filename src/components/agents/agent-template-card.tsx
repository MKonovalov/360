'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { FormEvent } from 'react';

import {
  saveAnalysisTemplateAction,
  setAnalysisTemplateStatusAction,
} from '@/app/actions/analysisTemplates';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { ManagedAnalysisTemplateRead } from '@/lib/analysis/templateContracts';
import type { AnalysisEffort } from '@/lib/analysis/contracts';

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
      return 'Only the current instruction and default effort can be changed.';
    case 'not_found':
      return 'This template is no longer available. Refresh the page.';
    case 'action_failed':
      return 'Could not save this change. Please try again.';
    default:
      return 'Could not save this change. Please try again.';
  }
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
  const [current, setCurrent] = useState(template);
  const [instruction, setInstruction] = useState(template.latest.instruction);
  const [defaultEffort, setDefaultEffort] = useState<AnalysisEffort>(template.latest.defaultEffort);
  const [feedback, setFeedback] = useState<Feedback>({ kind: 'idle' });
  const [isPending, startTransition] = useTransition();
  const priorVersions = current.history.slice(1);

  function markDirty(): void {
    setFeedback((previous) => (previous.kind === 'saving' ? previous : { kind: 'idle' }));
  }

  function saveContent(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setFeedback({ kind: 'saving' });
    startTransition(async () => {
      try {
        const result = await saveAnalysisTemplateAction({
          operation: 'content',
          templateKey: current.key,
          instruction,
          defaultEffort,
        });
        if (result.ok) {
          setCurrent(result.template);
          setInstruction(result.template.latest.instruction);
          setDefaultEffort(result.template.latest.defaultEffort);
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
        if (error instanceof Error) {
          setFeedback({ kind: 'error', message: 'Could not save this change. Please try again.' });
          return;
        }
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
        if (error instanceof Error) {
          setFeedback({ kind: 'error', message: 'Could not change this template. Please try again.' });
          return;
        }
        setFeedback({ kind: 'error', message: 'Could not change this template. Please try again.' });
      }
    });
  }

  return (
    <article data-template-key={current.key} className="flex flex-col gap-6 rounded-lg border border-slate-200 bg-white p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h3 className="text-[18px] font-semibold leading-[1.2] text-slate-900">{current.name}</h3>
          <p className="text-sm text-slate-500">Target: {current.targetType}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={current.status === 'active' ? 'secondary' : 'outline'}>
            {current.status === 'active' ? 'Active' : 'Retired'}
          </Badge>
          <Badge variant="outline">Current version {current.latest.version}</Badge>
        </div>
      </div>

      <form onSubmit={saveContent} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor={`${current.key}-instruction`} className="text-[12px] font-medium text-slate-700">
            Current instruction
          </label>
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
          <label htmlFor={`${current.key}-effort`} className="text-[12px] font-medium text-slate-700">
            Default effort
          </label>
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

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <Button type="submit" disabled={isPending}>
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
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-slate-800">Version {version.version}</p>
                  <Badge variant="outline">Read-only</Badge>
                  <span className="text-xs text-slate-500">{formatDate(version.createdAt)}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{version.instruction}</p>
                <p className="mt-2 text-xs text-slate-500">Default effort: {version.defaultEffort}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </article>
  );
}
