import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../index';
import { agentRun, company, signal, signalProposal } from '../schema';
import type { ProposalSignal } from '@/lib/agents/types';

// ANLZ-03: bulk-insert one run's proposal set into the durable review queue.
// status defaults to 'pending' at the DB level. No try/catch — caller owns
// error handling (house convention, signals.ts).
export async function insertProposals(runId: number, companyId: number, proposals: ProposalSignal[]) {
  return db
    .insert(signalProposal)
    .values(
      proposals.map((p) => ({
        runId,
        companyId,
        signalType: p.signalType,
        strength: p.strength,
        detectedAt: p.detectedAt,
        evidenceUrl: p.evidenceUrl,
        reliability: p.reliability,
        confidence: p.confidence,
        evidenceSnippet: p.evidenceSnippet,
        reasoning: p.reasoning,
      })),
    )
    .returning();
}

// ANLZ-03: the review queue. Joins agent_run so each row carries the Langfuse
// trace linkage (traceId/traceUrl) for the "View trace" link and the
// proposal→run lookup the reject flow needs. LEFT join — runId is nullable
// (proposals can outlive a run).
export async function listPendingProposals() {
  return db
    .select({
      id: signalProposal.id,
      companyId: signalProposal.companyId,
      runId: signalProposal.runId,
      companyName: company.name,
      signalType: signalProposal.signalType,
      strength: signalProposal.strength,
      detectedAt: signalProposal.detectedAt,
      evidenceUrl: signalProposal.evidenceUrl,
      reliability: signalProposal.reliability,
      confidence: signalProposal.confidence,
      evidenceSnippet: signalProposal.evidenceSnippet,
      reasoning: signalProposal.reasoning,
      status: signalProposal.status,
      resolvedAt: signalProposal.resolvedAt,
      createdAt: signalProposal.createdAt,
      traceId: agentRun.traceId,
      traceUrl: agentRun.traceUrl,
    })
    .from(signalProposal)
    .leftJoin(agentRun, eq(signalProposal.runId, agentRun.id))
    .where(eq(signalProposal.status, 'pending'))
    .orderBy(desc(signalProposal.createdAt));
}

// ANLZ-04: pending-proposal count for the Company-detail badge.
export async function countPendingProposals() {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(signalProposal)
    .where(eq(signalProposal.status, 'pending'));
  return row?.count ?? 0;
}

export type AcceptProposalResult =
  | { ok: true }
  | { ok: false; reason: 'already_resolved' | 'not_found' | 'duplicate_signal' };

// D-09/T-09-07: the guarded, idempotent Accept — ONE Accept = ONE Signal
// (ANLZ-02). No db.transaction() (neon-http has none): the status-guarded
// conditional update is the primary exactly-once guard, and the unique index
// signal(company_id, signal_type) (schema.ts) is the race backstop. A second
// accept on the same proposal is an idempotent no-op, NOT an error.
export async function acceptProposal(proposalId: number): Promise<AcceptProposalResult> {
  const updated = await db
    .update(signalProposal)
    .set({ status: 'accepted', resolvedAt: new Date() })
    .where(and(eq(signalProposal.id, proposalId), eq(signalProposal.status, 'pending')))
    .returning({ id: signalProposal.id });
  if (updated.length === 0) return { ok: false, reason: 'already_resolved' };

  const [proposal] = await db.select().from(signalProposal).where(eq(signalProposal.id, proposalId));
  if (!proposal) return { ok: false, reason: 'not_found' };

  try {
    await db
      .insert(signal)
      .values({
        companyId: proposal.companyId,
        signalType: proposal.signalType,
        strength: proposal.strength,
        source: proposal.evidenceUrl, // D-10: signal.source = the evidence URL
        detectedAt: proposal.detectedAt,
        note: proposal.reasoning, // D-10: reasoning rides along as the note
      })
      .returning();
  } catch (err) {
    // T-09-07: a concurrent duplicate accept surfaces as a unique violation
    // on signal(company_id, signal_type). Any other DB error propagates
    // fail-loud (D-06) — never swallow a real write failure as a "duplicate".
    if (isUniqueViolation(err)) return { ok: false, reason: 'duplicate_signal' };
    throw err;
  }
  return { ok: true };
}

function isUniqueViolation(err: unknown): boolean {
  if (err && typeof err === 'object' && 'code' in err && (err as { code?: unknown }).code === '23505') {
    return true;
  }
  const message = err instanceof Error ? err.message : String(err);
  return /duplicate key/i.test(message);
}
