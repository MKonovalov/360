'use client';

import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { z } from 'zod';

import { AnalysisRunStatus } from '@/components/analysis/analysis-run-status';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const analysisOptionsSchema = z.object({
  templates: z.array(z.object({
    templateVersionId: z.number().int().positive(), name: z.string(),
    targetType: z.enum(['company', 'persona']),
    version: z.number().int().positive(), supportedEfforts: z.array(z.string()),
  })),
  practiceAreas: z.array(z.object({
    id: z.number().int().positive(), name: z.string(), shortCode: z.string(),
  })),
});
const createRunResponseSchema = z.object({ applicationRunId: z.number().int().positive() });
const errorCopy: Record<string, string> = {
  invalid_input: 'Choose a valid template and Practice Area, then try again.',
  template_version_not_found: 'That analysis template is no longer available. Refresh and try again.', template_not_active: 'That analysis template is no longer available. Refresh and try again.',
  subject_type_mismatch: 'This template does not match the selected record.',
  subject_not_found: 'This record could not be found.',
  practice_area_required: 'Choose a Practice Area before starting.',
  practice_area_not_found: 'That Practice Area is no longer available. Refresh and try again.',
  active_run_exists: 'An active analysis run already exists for this record and template.',
  dispatch_failed: 'The analysis run could not be started. Try again.',
  network: 'The analysis service could not be reached. Try again.',
  action_failed: 'The analysis run could not be started. Try again.',
};

type SubjectType = 'company' | 'persona';
type AnalysisOptions = z.infer<typeof analysisOptionsSchema>;
type OptionsState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly options: AnalysisOptions }
  | { readonly status: 'error'; readonly message: string };

function readErrorCode(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null || !('error' in value)) return undefined;
  const error = value.error;
  return typeof error === 'string' ? error : undefined;
}

function safeRunError(errorCode: string | undefined): string {
  return errorCopy[errorCode ?? ''] ?? errorCopy.action_failed;
}

function parsePositiveInteger(value: string): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

type LauncherSelectProps = {
  readonly id: string; readonly label: string; readonly placeholder: string; readonly value: string;
  readonly disabled: boolean; readonly onValueChange: (value: string) => void; readonly children: ReactNode;
};

function LauncherSelect({ id, label, placeholder, value, disabled, onValueChange, children }: LauncherSelectProps) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-[12px] font-medium leading-[1.4] text-slate-700">
        {label}
      </label>
      <Select value={value || undefined} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </div>
  );
}

export function AnalysisRunLauncher({
  subjectType,
  subjectId,
}: {
  readonly subjectType: SubjectType;
  readonly subjectId: number;
}) {
  const [optionsState, setOptionsState] = useState<OptionsState>({ status: 'loading' });
  const [selectedTemplateVersionId, setSelectedTemplateVersionId] = useState('');
  const [selectedPracticeAreaId, setSelectedPracticeAreaId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [applicationRunId, setApplicationRunId] = useState<number | null>(null);
  const subjectGenerationRef = useRef(0);
  const postControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    subjectGenerationRef.current += 1;
    const subjectGeneration = subjectGenerationRef.current;
    const controller = new AbortController();
    let isActive = true;
    setOptionsState({ status: 'loading' });
    setSelectedTemplateVersionId('');
    setSelectedPracticeAreaId('');
    setIsSubmitting(false);
    setSubmitError(null);
    setApplicationRunId(null);

    void (async () => {
      try {
        const response = await fetch(
          `/api/analysis-options?subjectType=${encodeURIComponent(subjectType)}`,
          { signal: controller.signal },
        );
        const payload: unknown = await response.json().catch(() => null);
        if (!isActive) return;
        if (!response.ok) {
          setOptionsState({ status: 'error', message: 'Analysis options could not be loaded. Refresh and try again.' });
          return;
        }
        const parsed = analysisOptionsSchema.safeParse(payload);
        if (!parsed.success) {
          setOptionsState({ status: 'error', message: 'Analysis options could not be loaded. Refresh and try again.' });
          return;
        }
        const options: AnalysisOptions = {
          ...parsed.data,
          templates: parsed.data.templates.filter(
            (template) => template.targetType === subjectType && template.supportedEfforts.includes('standard'),
          ),
        };
        setOptionsState({ status: 'ready', options });
        setSelectedTemplateVersionId(String(options.templates[0]?.templateVersionId ?? ''));
        setSelectedPracticeAreaId(String(options.practiceAreas[0]?.id ?? ''));
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        if (isActive) {
          setOptionsState({ status: 'error', message: 'Analysis options could not be loaded. Refresh and try again.' });
        }
      }
    })();

    return () => {
      isActive = false;
      controller.abort();
      postControllerRef.current?.abort();
      postControllerRef.current = null;
      if (subjectGenerationRef.current === subjectGeneration) subjectGenerationRef.current += 1;
    };
  }, [subjectId, subjectType]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (optionsState.status !== 'ready' || applicationRunId !== null || isSubmitting) return;

    const template = optionsState.options.templates.find(
      (option) => String(option.templateVersionId) === selectedTemplateVersionId,
    );
    const practiceAreaId = parsePositiveInteger(selectedPracticeAreaId);
    if (!template || !practiceAreaId) {
      setSubmitError(safeRunError('invalid_input'));
      return;
    }
    if (!optionsState.options.practiceAreas.some((practiceArea) => practiceArea.id === practiceAreaId)) {
      setSubmitError(safeRunError('practice_area_not_found'));
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    const requestGeneration = subjectGenerationRef.current;
    const postController = new AbortController();
    postControllerRef.current?.abort();
    postControllerRef.current = postController;
    const isCurrentRequest = () =>
      requestGeneration === subjectGenerationRef.current && postControllerRef.current === postController;
    try {
      const response = await fetch('/api/analysis-runs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: postController.signal,
        body: JSON.stringify({
          templateVersionId: template.templateVersionId,
          subject: { type: subjectType, id: subjectId },
          practiceAreaId,
        }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!isCurrentRequest()) return;
      if (!response.ok) {
        setSubmitError(safeRunError(readErrorCode(payload)));
        return;
      }
      const parsed = createRunResponseSchema.safeParse(payload);
      if (!parsed.success) {
        setSubmitError(safeRunError(undefined));
        return;
      }
      setApplicationRunId(parsed.data.applicationRunId);
    } catch (error: unknown) {
      if (!isCurrentRequest()) return;
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setSubmitError(error instanceof TypeError ? safeRunError('network') : safeRunError(undefined));
    } finally {
      if (isCurrentRequest()) {
        postControllerRef.current = null;
        setIsSubmitting(false);
      }
    }
  }

  const headingId = `analysis-launcher-${subjectType}-${subjectId}`;
  const options = optionsState.status === 'ready' ? optionsState.options : null;
  const emptyMessage = options?.templates.length === 0
    ? 'No compatible analysis template is available for this record.'
    : options?.practiceAreas.length === 0
      ? 'No Practice Areas are available for analysis.'
      : null;

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <h2 id={headingId} className="text-[18px] font-semibold leading-[1.2] text-slate-900">
        Start analysis
      </h2>
      {optionsState.status === 'loading' ? <p role="status" className="text-[14px] font-normal leading-[1.5] text-slate-500">Loading analysis options…</p> : null}
      {optionsState.status === 'error' ? <p role="alert" className="text-[14px] font-normal leading-[1.5] text-red-600">{optionsState.message}</p> : null}
      {emptyMessage ? (
        <p role="status" className="text-[14px] font-normal leading-[1.5] text-slate-500">{emptyMessage}</p>
      ) : null}
      {options && options.templates.length > 0 && options.practiceAreas.length > 0 ? (
        <>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <LauncherSelect
                id={`analysis-template-${subjectType}-${subjectId}`}
                label="Template"
                placeholder="Select a template"
                value={selectedTemplateVersionId}
                disabled={isSubmitting || applicationRunId !== null}
                onValueChange={(value) => { setSelectedTemplateVersionId(value); setSubmitError(null); }}
              >
                {options.templates.map((template) => <SelectItem key={template.templateVersionId} value={String(template.templateVersionId)}>{`${template.name} · v${template.version}`}</SelectItem>)}
              </LauncherSelect>
              <LauncherSelect
                id={`analysis-practice-area-${subjectType}-${subjectId}`}
                label="Practice Area"
                placeholder="Select a Practice Area"
                value={selectedPracticeAreaId}
                disabled={isSubmitting || applicationRunId !== null}
                onValueChange={(value) => { setSelectedPracticeAreaId(value); setSubmitError(null); }}
              >
                {options.practiceAreas.map((practiceArea) => <SelectItem key={practiceArea.id} value={String(practiceArea.id)}>{`${practiceArea.name} · ${practiceArea.shortCode}`}</SelectItem>)}
              </LauncherSelect>
            </div>
            {submitError ? <p role="alert" className="text-[14px] font-normal leading-[1.5] text-red-600">{submitError}</p> : null}
            <Button type="submit" disabled={isSubmitting || applicationRunId !== null}>
              {isSubmitting ? 'Starting…' : 'Start analysis'}
            </Button>
          </form>
          {applicationRunId !== null ? <AnalysisRunStatus applicationRunId={applicationRunId} /> : null}
        </>
      ) : null}
    </section>
  );
}
