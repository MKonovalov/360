'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { decideRunInputSchema } from '@/lib/analysis/reviewContracts';
import type { ReviewDecisionOutcome, WholeRunDecision } from '@/lib/analysis/reviewContracts';
import { acceptProposal, getProposalById } from '@/lib/db/queries/proposals';
import { rejectProposal } from '@/lib/db/queries/corrections';
import {
  getEffectiveReviewProjection,
  transitionReviewDecision,
} from '@/lib/db/queries/analysisReviews';
import { correctionReasonEnum } from '@/lib/db/schema';

// Server Action controller for the proposal review queue (ANLZ-02/OBSV-02).
// Both actions call requireStaffAccess() FIRST (matches enrichment.ts) —
// Server Actions are gated independently of the page that renders the trigger.

export type ReviewsActionResult = { ok: true } | { ok: false; reason: string };

// D-09/T-09-07: one Accept = one Signal. acceptProposal is status-guarded and
// idempotent — already_resolved / duplicate_signal surface as result reasons,
// never as thrown errors. Revalidates the queue AND the companies list so the
// pending-count badge (proposal-badge.tsx) reflects the write.
export async function acceptProposalAction(proposalId: number): Promise<ReviewsActionResult> {
  await requireStaffAccess();

  try {
    const result = await acceptProposal(proposalId);
    if (result.ok) {
      revalidatePath('/reviews');
      revalidatePath('/companies');
    }
    return result;
  } catch {
    return { ok: false, reason: 'action_failed' };
  }
}

// D-14/OBSV-02: staff reject with a structured reason. The reason is
// runtime-validated against the DB enum BEFORE any write (fail-loud — reject
// input arrives as unknown from a Server Action). traceId is resolved from the
// proposal's run via getProposalById — NEVER trusted from the client — because
// correction.trace_id is NOT NULL (schema.ts) and the correction row is the
// durable source of truth for the Langfuse mirror annotation.
const rejectInputSchema = z.object({
  reason: z.enum(correctionReasonEnum.enumValues),
  note: z.string().trim().max(500).optional(),
});

export async function rejectProposalAction(proposalId: number, input: unknown): Promise<ReviewsActionResult> {
  await requireStaffAccess();

  const parsed = rejectInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid_reason' };

  try {
    const proposal = await getProposalById(proposalId);
    if (!proposal) return { ok: false, reason: 'not_found' };
    // runId is nullable (proposals can outlive a run) — without a traceId the
    // correction row cannot be written, so fail loud instead of fabricating one.
    if (!proposal.traceId) return { ok: false, reason: 'no_trace' };

    const result = await rejectProposal(proposalId, {
      reason: parsed.data.reason,
      note: parsed.data.note,
      traceId: proposal.traceId,
    });
    if (result.ok) revalidatePath('/reviews');
    return result;
  } catch {
    return { ok: false, reason: 'action_failed' };
  }
}

// ---- v1.7 whole-run review actions below this line ----
//
// D-34-02/D-34-05/T-34-12: the whole-run Confirm/Dismiss boundary is structurally
// separate from the legacy proposal Accept/Reject path above. Both actions call
// requireStaffAccess() FIRST (never accept an actor from the browser), validate
// the 34-01 decideRunInputSchema (positive runId + closed decision only — packet,
// source, signal, offering and timestamp fields are rejected as invalid_input),
// and reach the database exclusively through decideAnalysisRun from Plan 34-02.
// They never call acceptProposal, never write a live Signal/offering/link, and
// never open an interactive transaction (neon-http constraint). Replay/race
// outcomes are returned verbatim from the winner-preserving query — a loser is
// never reported as a win. A thrown query error propagates so the client
// surfaces a retryable failure instead of a forged closed reason.

async function decideWholeRun(
  input: unknown,
  decision: WholeRunDecision,
  actorId: string,
): Promise<ReviewDecisionOutcome> {
  const parsed = decideRunInputSchema.safeParse(input);
  if (!parsed.success || parsed.data.decision !== decision) {
    return { ok: false, reason: 'invalid_input' };
  }
  const projection = await getEffectiveReviewProjection(parsed.data.runId);
  const transition = await transitionReviewDecision(
    {
      runId: parsed.data.runId,
      decision,
      expectedPriorEventId: projection?.effectiveEventId ?? 0,
    },
    actorId,
  );
  if (transition.kind === 'corrected' || transition.kind === 'replayed') {
    const current = transition.kind === 'corrected' ? transition.event : transition.projection;
    revalidatePath('/reviews');
    return {
      ok: true,
      runId: current.runId,
      resultId: current.resultId,
      decision: current.decision,
      decidedBy: current.decidedBy,
      decidedAt: current.decidedAt,
      packetHash: current.packetHash,
      replayed: transition.kind === 'replayed',
    };
  }
  if (transition.kind === 'conflict') return { ok: false, reason: 'race_loser' };
  return { ok: false, reason: transition.reason };
}

export async function confirmRunAction(input: unknown): Promise<ReviewDecisionOutcome> {
  const { userId } = await requireStaffAccess();
  return decideWholeRun(input, 'confirmed', userId);
}

export async function dismissRunAction(input: unknown): Promise<ReviewDecisionOutcome> {
  const { userId } = await requireStaffAccess();
  return decideWholeRun(input, 'dismissed', userId);
}
