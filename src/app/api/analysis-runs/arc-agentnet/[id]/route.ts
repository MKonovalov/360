import { z } from 'zod';

import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { arcAgentnetClient } from '@/lib/arc-agentnet/client';
import {
  applyArcAgentnetResultProjection,
  getArcAgentnetRunById,
  recordArcAgentnetStatus,
} from '@/lib/db/queries/arcAgentnetRuns';
import { serializeArcAgentnetProjection } from '@/lib/db/queries/arcAgentnetResultValidation';
import type { ArcAgentnetRunRecord } from '@/lib/db/queries/arcAgentnetRunTypes';

const applicationRunIdSchema = z.coerce.number().int().positive();
const terminalStatuses = new Set(['completed', 'failed', 'cancelled']);

type RouteContext = {
  readonly params: Promise<{ readonly id: string }>;
};

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  const { userId } = await requireStaffAccess();
  const params = await context.params;
  const parsedId = applicationRunIdSchema.safeParse(params.id);
  if (!parsedId.success) return safeResponse({ error: 'invalid_input' }, 400);

  const run = await getArcAgentnetRunById(parsedId.data, userId);
  if (!run) return safeResponse({ error: 'analysis_run_not_found' }, 404);
  if (run.executionTarget !== 'arc-agentnet') return safeResponse({ error: 'analysis_run_not_found' }, 404);
  if (!run.partnerJobId || !run.partnerRequestId) return safeResponse({ error: 'status_unavailable' }, 503);

  if (terminalStatuses.has(run.arcAgentnetLocalStatus ?? '')) return safeProjection(run);

  const polled = await arcAgentnetClient.poll({ jobId: run.partnerJobId });
  if (!polled.ok) {
    if (polled.kind === 'job_expired') {
      const expired = await recordArcAgentnetStatus({
        runId: run.id,
        initiatingUserId: userId,
        partnerJobId: run.partnerJobId,
        requestId: run.partnerRequestId,
        partnerStatus: 'failed',
        safeReason: 'job_expired',
      });
      return expired.kind === 'not_found'
        ? safeResponse({ error: 'analysis_run_not_found' }, 404)
        : terminalStatuses.has(expired.run.arcAgentnetLocalStatus ?? '')
          && expired.run.arcAgentnetSafeReason !== 'job_expired'
          ? safeProjection(expired.run)
        : safeResponse({ error: 'job_expired' }, 410);
    }
    return safeResponse({ error: 'status_unavailable' }, 503);
  }

  if (polled.value.jobId !== run.partnerJobId || polled.value.requestId !== run.partnerRequestId) {
    return safeResponse({ error: 'status_unavailable' }, 503);
  }

  if (polled.value.result !== undefined) {
    const projection = await applyArcAgentnetResultProjection({
      runId: run.id,
      initiatingUserId: userId,
      partnerJobId: run.partnerJobId,
      requestId: run.partnerRequestId,
      projection: polled.value.result,
    });
    if (projection.kind === 'invalid_input') return safeResponse({ error: 'invalid_result' }, 502);
    if (projection.kind === 'not_found') return safeResponse({ error: 'analysis_run_not_found' }, 404);
  }

  const reconciled = await recordArcAgentnetStatus({
    runId: run.id,
    initiatingUserId: userId,
    partnerJobId: run.partnerJobId,
    requestId: run.partnerRequestId,
    partnerStatus: polled.value.status,
  });
  if (reconciled.kind === 'not_found') return safeResponse({ error: 'analysis_run_not_found' }, 404);

  return safeProjection(reconciled.run);
}

function safeProjection(run: ArcAgentnetRunRecord): Response {
  const executor = run.executionTarget === 'arc-agentnet' ? 'arc-agentnet' : 'internal';
  const serializedResult = run.arcAgentnetResultProjection === null
    ? null
    : serializeArcAgentnetProjection(run.arcAgentnetResultProjection);
  return safeResponse({
    applicationRunId: run.id,
    status: run.arcAgentnetLocalStatus,
    safeReason: run.arcAgentnetSafeReason,
    executor,
    timestamps: {
      createdAt: run.createdAt.toISOString(),
      startedAt: run.arcAgentnetStartedAt?.toISOString() ?? null,
      completedAt: run.arcAgentnetCompletedAt?.toISOString() ?? null,
      terminalAt: run.arcAgentnetTerminalAt?.toISOString() ?? null,
    },
    snapshotSummary: {
      template: {
        templateId: run.templateSnapshot.templateId,
        templateVersionId: run.templateSnapshot.templateVersionId,
        key: run.templateSnapshot.templateKey,
        name: run.templateSnapshot.templateName,
        targetType: run.templateSnapshot.targetType,
        version: run.templateSnapshot.version,
        effort: run.templateSnapshot.effort,
      },
      subject: {
        type: run.subjectSnapshot.type,
        id: run.subjectSnapshot.id,
        displayName: run.subjectSnapshot.displayName,
      },
      checklist: {
        practiceAreaId: run.checklistSnapshot.practiceAreaId,
        practiceAreaName: run.checklistSnapshot.practiceAreaName,
        itemCount: run.checklistSnapshot.items.length,
      },
      execution: {
        executor,
        resolvedModelChain: run.executionSnapshot.resolvedModelChain.slice(0, 8),
        futureBudget: run.executionSnapshot.futureBudget,
      },
    },
    result: serializedResult !== null && serializedResult.ok ? serializedResult.projection : null,
  }, 200);
}

function safeResponse(body: Readonly<Record<string, unknown>>, status: number): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}
