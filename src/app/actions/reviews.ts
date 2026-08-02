'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { acceptProposal, getProposalById } from '@/lib/db/queries/proposals';
import { rejectProposal } from '@/lib/db/queries/corrections';
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
