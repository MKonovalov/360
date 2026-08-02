import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '../index';
import { correction, signalProposal, correctionReasonEnum } from '../schema';
import { mirrorCorrectionAnnotation } from '@/lib/telemetry/langfuse';

// OBSV-02/D-14: staff reject with a structured reason. Runtime-validated via
// zod against the DB enum — an invalid reason fails before any write
// (fail-loud), because reject input arrives as unknown from a Server Action.
const correctionReasonSchema = z.enum(correctionReasonEnum.enumValues);

export interface RejectProposalInput {
  reason: string;
  note?: string;
  traceId: string;
}

export type RejectProposalResult =
  | { ok: true }
  | { ok: false; reason: 'invalid_reason' | 'already_resolved' };

// D-14: the correction ROW is the durable source of truth; the Langfuse
// annotation is the observability mirror (fire-and-forget — it must never
// block or fail an already-committed reject).
export async function rejectProposal(
  proposalId: number,
  input: RejectProposalInput,
): Promise<RejectProposalResult> {
  const parsed = correctionReasonSchema.safeParse(input.reason);
  if (!parsed.success) return { ok: false, reason: 'invalid_reason' };

  // Idempotent status guard (same pattern as acceptProposal, T-09-07): a
  // proposal already resolved is a no-op, not an error.
  const updated = await db
    .update(signalProposal)
    .set({ status: 'rejected', resolvedAt: new Date() })
    .where(and(eq(signalProposal.id, proposalId), eq(signalProposal.status, 'pending')))
    .returning({ id: signalProposal.id });
  if (updated.length === 0) return { ok: false, reason: 'already_resolved' };

  await db
    .insert(correction)
    .values({
      proposalId,
      reason: parsed.data,
      note: input.note,
      traceId: input.traceId,
    })
    .returning();

  // D-14 mirror — fire-and-forget; failures are swallowed (the DB row is
  // already the source of truth).
  void mirrorCorrectionAnnotation(input.traceId, { reason: parsed.data, note: input.note }).catch(
    () => {},
  );

  return { ok: true };
}

// Reads for future prompt/taxonomy tuning reads (D-14).
export async function getCorrectionsForProposal(proposalId: number) {
  return db.select().from(correction).where(eq(correction.proposalId, proposalId));
}
