import { eq } from 'drizzle-orm';
import { db } from '../index';
import { agentRun } from '../schema';
import type { ModelProviderId } from '@/lib/models/catalog';
import type { ModelRef } from '@/lib/models/modelRef';

export interface CreateRunInput {
  companyId: number;
  traceId?: string;
  traceUrl?: string;
  verdict?: string;
  usageTokens?: unknown;
  evidenceAppendix?: unknown;
  hypotheses?: unknown;
  modelUsed?: string; // raw model ID that actually served (REG-04)
  modelProvider?: ModelProviderId | null;
  modelChain?: readonly (ModelRef | string)[]; // resolved pair snapshot captured at run start (D-05)
}

// OBSV-01: persists one Analyze run's Langfuse trace linkage (traceId +
// traceUrl) plus the run artifacts (usage tokens, evidence appendix,
// hypotheses) as JSON. REG-04: modelUsed/modelChain durably record "which
// model ran" (D-14) — populated by Phase 16. No try/catch — the caller (Route
// Handler) owns error handling (house convention, signals.ts).
export async function createRun(input: CreateRunInput) {
  const [inserted] = await db
    .insert(agentRun)
    .values({
      companyId: input.companyId,
      traceId: input.traceId,
      traceUrl: input.traceUrl,
      verdict: input.verdict,
      usageTokens: input.usageTokens,
      evidenceAppendix: input.evidenceAppendix,
      hypotheses: input.hypotheses,
      modelUsed: input.modelUsed,
      modelProvider: input.modelProvider,
      modelChain: input.modelChain ? [...input.modelChain] : undefined,
    })
    .returning();
  return inserted;
}

// Correction trace-linking lookup: proposal → run → Langfuse trace.
export async function getRunById(id: number) {
  const rows = await db.select().from(agentRun).where(eq(agentRun.id, id));
  return rows[0];
}
