'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import type { AnalysisRunStatus, SafeOutcomeReason } from '@/lib/analysis/contracts';
import {
  isTerminalAnalysisStatus,
  pollAnalysisRun,
  type AnalysisRunStatusResponse,
} from '@/lib/analysis/pollingClient';

type AnalysisRunResponse = AnalysisRunStatusResponse;
type ActorKind = AnalysisRunStatusResponse['events'][number]['actorKind'];
type StatusTone = 'neutral' | 'active' | 'success' | 'warning' | 'danger';

interface StatusPresentation {
  readonly label: string;
  readonly description: string;
  readonly outcome: string | null;
  readonly tone: StatusTone;
}

type LoadState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly run: AnalysisRunResponse }
  | { readonly status: 'error'; readonly message: string };

const STATUS_PRESENTATION = {
  queued: {
    label: 'Queued',
    description: 'The analysis is queued and waiting to start.',
    outcome: null,
    tone: 'neutral',
  },
  running: {
    label: 'Running',
    description: 'The analysis is in progress.',
    outcome: null,
    tone: 'active',
  },
  completed: {
    label: 'Completed',
    description: 'The analysis completed and is ready for review.',
    outcome: 'The analysis completed successfully.',
    tone: 'success',
  },
  failed: {
    label: 'Failed',
    description: 'The analysis stopped before completion.',
    outcome: 'The analysis did not complete.',
    tone: 'danger',
  },
  cancelled: {
    label: 'Cancelled',
    description: 'The analysis was stopped before completion.',
    outcome: 'The analysis was cancelled.',
    tone: 'danger',
  },
  pending_review: {
    label: 'Pending review',
    description: 'The completed analysis is waiting for review.',
    outcome: 'The analysis completed successfully.',
    tone: 'warning',
  },
  confirmed: {
    label: 'Confirmed',
    description: 'The completed analysis outcome was confirmed.',
    outcome: 'The analysis outcome is confirmed.',
    tone: 'success',
  },
  dismissed: {
    label: 'Dismissed',
    description: 'The completed analysis outcome was dismissed.',
    outcome: 'The analysis outcome is dismissed.',
    tone: 'neutral',
  },
} as const satisfies Readonly<Record<string, StatusPresentation>>;

const SAFE_REASON_COPY = {
  invalid_input: 'The submitted analysis details were not valid.',
  subject_mismatch: 'The selected record does not match this template.',
  active_run_exists: 'An active analysis run already exists.',
  dispatch_failed: 'The analysis could not be started.',
  execution_failed: 'The analysis did not complete.',
  timed_out: 'The analysis took too long and stopped safely.',
  policy_unavailable: 'The analysis policy is not yet available for this run.',
  persona_policy_unavailable: 'Persona analysis is temporarily unavailable while persona data protection is finalized.',
  cancelled: 'The analysis was cancelled.',
  completed: 'The analysis completed successfully.',
  replayed: 'This transition was already recorded.',
} as const satisfies Readonly<Record<SafeOutcomeReason, string>>;

const ACTOR_LABELS = {
  staff: 'staff',
  workflow: 'workflow',
  system: 'system',
} as const satisfies Readonly<Record<ActorKind, string>>;

const STATUS_TONE_CLASSES: Readonly<Record<StatusTone, string>> = {
  neutral: 'border-slate-200 bg-slate-50 text-slate-700',
  active: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  danger: 'border-red-200 bg-red-50 text-red-700',
};

const timestampFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function AnalysisRunStatus({ applicationRunId }: { readonly applicationRunId: number }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const router = useRouter();

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;
    setState({ status: 'loading' });

    void pollAnalysisRun({
      applicationRunId,
      signal: controller.signal,
      onUpdate: (run) => {
        if (isActive) setState({ status: 'ready', run });
      },
    }).then((result) => {
      if (!isActive || result.kind === 'aborted') return;
      if (result.kind === 'error') setState({ status: 'error', message: result.message });
      if (result.kind === 'terminal' && isTerminalAnalysisStatus(result.run.status)) router.refresh();
    });

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [applicationRunId]);

  if (state.status === 'loading') {
    return (
      <p role="status" className="text-[14px] font-normal leading-[1.5] text-slate-500">
        Loading analysis run status…
      </p>
    );
  }

  if (state.status === 'error') {
    return (
      <p role="alert" className="text-[14px] font-normal leading-[1.5] text-red-600">
        {state.message}
      </p>
    );
  }

  const { run } = state;
  const presentation = STATUS_PRESENTATION[run.status];
  const outcome = presentation.outcome;
  const headingId = `analysis-run-status-${run.applicationRunId}`;

  return (
    <section aria-labelledby={headingId} className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id={headingId} className="text-[16px] font-semibold leading-[1.3] text-slate-900">
            {`Analysis run #${run.applicationRunId}`}
          </h3>
          <p className="text-[12px] font-normal leading-[1.4] text-slate-500">Database status</p>
        </div>
        <Badge variant="outline" className={STATUS_TONE_CLASSES[presentation.tone]}>
          {presentation.label}
        </Badge>
      </div>

      <div className="space-y-1">
        <p className="text-[14px] font-normal leading-[1.5] text-slate-700">{presentation.description}</p>
        {outcome ? <p className="text-[14px] font-normal leading-[1.5] text-slate-600">{outcome}</p> : null}
        {run.safeReason ? (
          <p className="text-[12px] font-normal leading-[1.4] text-slate-500">
            <span className="font-medium text-slate-700">Reason:</span> {SAFE_REASON_COPY[run.safeReason]}
          </p>
        ) : null}
      </div>

      <div className="space-y-3 border-t border-slate-100 pt-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="text-[14px] font-semibold leading-[1.5] text-slate-900">Audit history</h4>
          <span className="text-[12px] font-normal leading-[1.4] text-slate-500">
            {`${run.events.length} event${run.events.length === 1 ? '' : 's'}`}
          </span>
        </div>
        {run.events.length > 0 ? (
          <ol className="space-y-2">
            {run.events.map((event, index) => (
              <li
                key={`${event.createdAt}-${event.fromStatus ?? 'created'}-${event.toStatus}-${index}`}
                className="space-y-1 rounded-md border border-slate-100 bg-slate-50 p-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="text-[14px] font-medium leading-[1.5] text-slate-900">
                    {event.fromStatus === null
                      ? `Run created · ${STATUS_PRESENTATION[event.toStatus].label}`
                      : `${STATUS_PRESENTATION[event.fromStatus].label} → ${STATUS_PRESENTATION[event.toStatus].label}`}
                  </p>
                  <time dateTime={event.createdAt} className="text-[12px] font-normal leading-[1.4] text-slate-500">
                    {timestampFormatter.format(new Date(event.createdAt))}
                  </time>
                </div>
                <p className="text-[12px] font-normal leading-[1.4] text-slate-500">
                  {`Actor kind: ${ACTOR_LABELS[event.actorKind]}`}
                </p>
                {event.safeReason ? (
                  <p className="text-[12px] font-normal leading-[1.4] text-slate-500">
                    <span className="font-medium text-slate-700">Reason:</span> {SAFE_REASON_COPY[event.safeReason]}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-[14px] font-normal leading-[1.5] text-slate-500">No audit events were returned.</p>
        )}
      </div>
    </section>
  );
}
