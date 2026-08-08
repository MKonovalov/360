'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { confirmRunAction, dismissRunAction } from '@/app/actions/reviews';
import { Button } from '@/components/ui/button';
import type { ReviewDecisionOutcome, WholeRunDecision } from '@/lib/analysis/reviewContracts';

// v1.7 whole-run decision controls (D-34-02/D-34-05/T-34-10). These buttons
// only ever send { runId, decision } to the staff-gated Server Action; the
// card renders the SERVER's stored outcome verbatim — a replay shows the
// original actor/timestamp (winner-preserving, T-34-12), and race_loser is
// never presented as a win. A thrown query error (the only retryable reason)
// offers Try again; every other reason is terminal and forces a reload to
// re-sync with the persisted state.

export type RunActionState =
  | { readonly status: 'idle' }
  | { readonly status: 'pending' }
  | {
      readonly status: 'decided';
      readonly decision: WholeRunDecision;
      readonly replayed: boolean;
      readonly decidedBy: string;
      readonly decidedAt: string;
    }
  | {
      readonly status: 'error';
      readonly reason: string;
      readonly retryable: boolean;
      readonly attempted: WholeRunDecision;
    };

export type RunActionEvent = ReviewDecisionOutcome | { readonly thrown: true };

export function reduceRunActionState(
  _state: RunActionState,
  event: RunActionEvent,
  attempted: WholeRunDecision,
): RunActionState {
  if ('thrown' in event) {
    return { status: 'error', reason: 'action_failed', retryable: true, attempted };
  }
  if (event.ok) {
    return {
      status: 'decided',
      decision: event.decision,
      replayed: event.replayed,
      decidedBy: event.decidedBy,
      decidedAt: event.decidedAt,
    };
  }
  // Safe closed failure reasons are terminal — retrying cannot change them,
  // so only the thrown-action case is ever retryable.
  return { status: 'error', reason: event.reason, retryable: false, attempted };
}

const RUN_ACTION_ERROR_COPY: Readonly<Record<string, string>> = {
  invalid_input: 'This decision could not be submitted. Reload to re-sync.',
  missing_packet: 'This run has no reviewable packet, so it cannot be decided.',
  not_pending_review: 'This run is no longer pending review.',
  race_loser: 'Another reviewer decided this run first. Nothing was changed.',
  not_found: 'This run was not found.',
  action_failed: 'Could not submit the decision. Please try again.',
};

export function runActionCopy(reason: string): string {
  return RUN_ACTION_ERROR_COPY[reason] ?? RUN_ACTION_ERROR_COPY.action_failed;
}

export function decidedCopy(state: Extract<RunActionState, { readonly status: 'decided' }>): string {
  const verb = state.decision === 'confirmed' ? 'Confirmed' : 'Dismissed';
  if (state.replayed) {
    // Winner-preserving replay: the original actor/timestamp are the fact.
    return `Already ${verb.toLowerCase()} by ${state.decidedBy} — original decision preserved.`;
  }
  return `${verb} by ${state.decidedBy} at ${state.decidedAt}.`;
}

export function RunDecisionButtons({
  runId,
  state,
  onDecision,
}: {
  runId: number;
  state: RunActionState;
  onDecision: (decision: WholeRunDecision) => void;
}) {
  const submitting = state.status === 'pending';
  return (
    <div role="group" aria-label={`Decide run ${runId}`} className="flex items-center gap-2">
      <Button
        variant="default"
        size="sm"
        disabled={submitting}
        aria-label={`Confirm run ${runId}`}
        onClick={() => onDecision('confirmed')}
      >
        {submitting ? 'Deciding…' : 'Confirm'}
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={submitting}
        aria-label={`Dismiss run ${runId}`}
        onClick={() => onDecision('dismissed')}
      >
        {submitting ? 'Deciding…' : 'Dismiss'}
      </Button>
    </div>
  );
}

export function RunReviewActions({ runId }: { runId: number }) {
  const [state, setState] = useState<RunActionState>({ status: 'idle' });
  const [, startTransition] = useTransition();
  const router = useRouter();

  async function handleDecision(decision: WholeRunDecision) {
    setState({ status: 'pending' });
    startTransition(async () => {
      try {
        const outcome =
          decision === 'confirmed'
            ? await confirmRunAction({ runId, decision })
            : await dismissRunAction({ runId, decision });
        setState((prev) => reduceRunActionState(prev, outcome, decision));
      } catch {
        setState((prev) => reduceRunActionState(prev, { thrown: true }, decision));
      }
    });
  }

  if (state.status === 'idle' || state.status === 'pending') {
    return <RunDecisionButtons runId={runId} state={state} onDecision={handleDecision} />;
  }
  if (state.status === 'decided') {
    return (
      <p aria-live="polite" className="text-[14px] font-normal leading-[1.5] text-slate-600">
        {decidedCopy(state)}
      </p>
    );
  }
  return (
    <div className="flex items-center gap-3">
      <p aria-live="polite" className="text-[14px] font-normal leading-[1.5] text-red-600">
        {runActionCopy(state.reason)}
      </p>
      {state.retryable ? (
        <Button variant="outline" size="sm" onClick={() => handleDecision(state.attempted)}>
          Try again
        </Button>
      ) : (
        <Button variant="outline" size="sm" onClick={() => router.refresh()}>
          Reload
        </Button>
      )}
    </div>
  );
}
