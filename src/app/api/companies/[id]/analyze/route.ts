// src/app/api/companies/[id]/analyze/route.ts — the FIRST Route Handler in the
// codebase (D-06). The proxy.ts matcher already covers /api (src/proxy.ts L11),
// so unauthenticated requests reach this handler — requireStaffAccess() is the
// single gate, called FIRST (D-06/T-09-01). No anonymous path to the agent or
// the DB writes.
import { z } from 'zod';
import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { analyzeCompany, type AnalyzeResult } from '@/lib/agents/analyzeCompany';
import { createRun } from '@/lib/db/queries/runs';
import { insertProposals } from '@/lib/db/queries/proposals';
import { getModelDisplayName } from '@/lib/models/catalog';
import { getTraceUrl, initLangfuse, runWithPhase33Trace } from '@/lib/telemetry/langfuse';

// Vercel Hobby ceiling (D-07): the client strip tells staff "this can take up
// to a minute" — the handler must honor that promise.
export const maxDuration = 60;

// Company ids are serial PKs (schema.ts) — coerce the string path segment to a
// positive integer, 400 otherwise (T-09-03 route-side input validation).
const companyIdSchema = z.coerce.number().int().positive();

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  // Single gate, first call (D-06/T-09-01) — the same function every protected
  // page/action uses; redirect('/sign-in') throws for anonymous callers.
  // FAL-01: capture the authenticated userId — the ONLY user identifier that
  // ever reaches the settings query (T-16-04); never client-supplied.
  const { userId } = await requireStaffAccess();

  const { id } = await params; // Next 16 App Router: params is a Promise
  const parsed = companyIdSchema.safeParse(id);
  if (!parsed.success) {
    return Response.json({ error: 'invalid_id' }, { status: 400 });
  }
  const companyId = parsed.data;

  // Telemetry bootstrap (D-13/D-15/D-16): idempotent module singleton — the
  // first request registers the Langfuse OTel path, later requests no-op;
  // no-op in tests or without keys, never a crash at import.
  initLangfuse();

  // ── Domain A (AI/tool) — D-08 ────────────────────────────────────────────
  // Analysis failures are reported as analysis failures, never as DB errors.
  // Wrapped in a Langfuse ACTIVE observation so every AI SDK span emitted by
  // analyzeCompany nests under one trace, and span.traceId is that trace
  // (OBSV-01). Genuine agent/provider throws propagate fail-loud (D-06); the
  // only structured non-ok results are the fail-closed gate and D-15
  // not_configured.
  let result: AnalyzeResult;
  let traceId: string | undefined;
  try {
    const observed = await runWithPhase33Trace(
      'analyze-company',
      () => analyzeCompany(companyId, userId),
      {
        input: { targetType: 'company' },
        output: (res) => res.ok
          ? {
              modelId: res.modelUsed,
              modelProvider: res.modelUsedProvider,
              usedFallback: res.usedFallback,
              proposalCount: res.proposals.length,
            }
          : { status: 'failed' },
      },
    );
    result = observed.result;
    traceId = observed.traceId ?? undefined;
  } catch (err) {
    return Response.json({ error: 'analysis_failed', message: String(err) }, { status: 502 });
  }

  if (!result.ok) {
    switch (result.reason) {
      case 'gate_failed':
        // T-09-03: surfaced to the client but never persisted (D-03).
        return Response.json({ error: 'gate_failed', errors: result.errors ?? [] }, { status: 422 });
      case 'not_configured':
        // D-20-01/09: 400 (was 503, D-15) + names the missing key so staff
        // know which provider to configure (Phase 21 surfaces the pickers;
        // D-20-04 keeps the gate-only surface in Phase 20). The undefined
        // message on the bare fast-gate path (FIRECRAWL, no missingKey) is
        // intentional — JSON drops it.
        return Response.json(
          { error: 'not_configured', message: result.missingKey ? `${result.missingKey} not configured` : undefined },
          { status: 400 },
        );
      case 'billing':
        // FAL-02 (D-20-10): account-level credits exhausted — distinct 402 so
        // the UI can branch on status + reason (never a generic 502).
        return Response.json({ error: 'billing', message: result.message ?? 'provider credits exhausted' }, { status: 402 });
      case 'company_not_found':
        return Response.json({ error: 'company_not_found' }, { status: 404 });
      case 'db_error':
        // Data-layer failure during analysis — analysis-domain, not persist.
        return Response.json({ error: 'analysis_failed', message: 'db_error' }, { status: 502 });
      case 'rate_limited':
        // D-20-09: distinct 429 (was the D-04 502 carve-out) + the
        // platform-vs-upstream reason from the runAgent diagnostics helper
        // (D-20-07).
        return Response.json({ error: 'rate_limited', message: result.message }, { status: 429 });
      default:
        return Response.json({ error: 'analysis_failed', message: 'unknown_error' }, { status: 502 });
    }
  }

  // OBSV-01: the trace URL lookup is best-effort telemetry — a Langfuse
  // failure must never fail the run, only drop the "View trace" link (D-15).
  const traceUrl = traceId ? await getTraceUrl(traceId).catch(() => undefined) : undefined;

  // ── Domain B (DB writes) — D-08 ──────────────────────────────────────────
  // Only when Domain A succeeded; a write failure is a persist failure, never
  // reported as an AI error.
  let run: Awaited<ReturnType<typeof createRun>>;
  try {
    run = await persistRunAndProposals(companyId, result, traceId, traceUrl);
  } catch (err) {
    return Response.json({ error: 'persist_failed', message: String(err) }, { status: 502 });
  }

  // Fail-loud success (D-06/Pitfall 5): never a silent-[] shape. proposalCount
  // rides along so the client strip can render "N proposals queued". The FLAT
  // audit shape (OQ-2 locked): modelUsed/modelChain already ride on ...run
  // (createRun .returning()); usedFallback + modelUsedName added explicitly.
  // modelUsedName is server-computed (D-07) — catalog.json is server-only, and
  // getModelDisplayName falls back to the raw id when absent from the snapshot.
  return Response.json(
    {
      ...run,
      proposalCount: result.proposals.length,
      usedFallback: result.usedFallback,
      modelUsedName: getModelDisplayName(result.modelUsed),
    },
    { status: 201 },
  );
}

// Persist helper (inline — under the ~40-line threshold): one run row carrying
// the trace linkage + artifacts, then the proposal set into the review queue.
// No try/catch here — the route's Domain B owns error handling (house
// convention: query modules never catch, callers do).
async function persistRunAndProposals(
  companyId: number,
  result: Extract<AnalyzeResult, { ok: true }>,
  traceId?: string,
  traceUrl?: string,
) {
  const run = await createRun({
    companyId,
    traceId,
    traceUrl,
    verdict: result.verdict,
    usageTokens: result.usage,
    evidenceAppendix: result.output.evidenceAppendix,
    hypotheses: result.output.keyUncertainties,
    // FAL-05 (REG-04 seam): the model that actually served + the resolved
    // chain snapshot — agent_run is the durable audit truth (D-14).
    modelUsed: result.modelUsed,
    modelProvider: result.modelUsedProvider,
    modelChain: result.modelChain,
  });
  await insertProposals(run.id, companyId, result.proposals);
  return run;
}
