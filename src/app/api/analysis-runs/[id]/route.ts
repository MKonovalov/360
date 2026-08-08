import { z } from 'zod';

import { safeOutcomeReasonSchema } from '@/lib/analysis/contracts';
import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import {
  getAnalysisRun,
  listAnalysisRunEvents,
} from '@/lib/db/queries/analysisRuns';

const applicationRunIdSchema = z.coerce.number().int().positive();

type RouteContext = {
  readonly params: Promise<{ readonly id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  await requireStaffAccess();

  const params = await context.params;
  const parsedId = applicationRunIdSchema.safeParse(params.id);
  if (!parsedId.success) {
    return Response.json({ error: 'invalid_input' }, { status: 400 });
  }

  const run = await getAnalysisRun(parsedId.data);
  if (!run) {
    return Response.json({ error: 'analysis_run_not_found' }, { status: 404 });
  }

  const events = await listAnalysisRunEvents(run.id);
  const runReason = safeOutcomeReasonSchema.safeParse(run.safeReason);

  return Response.json({
    applicationRunId: run.id,
    status: run.status,
    safeReason: runReason.success ? runReason.data : null,
    attempt: run.attempt,
    maxAttempts: run.maxAttempts,
    timestamps: {
      createdAt: run.createdAt.toISOString(),
      startedAt: run.startedAt?.toISOString() ?? null,
      completedAt: run.completedAt?.toISOString() ?? null,
      terminalAt: run.terminalAt?.toISOString() ?? null,
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
        resolvedModelChain: run.executionSnapshot.resolvedModelChain.slice(0, 8),
        futureBudget: {
          maxAttempts: run.executionSnapshot.futureBudget.maxAttempts,
          maxToolCalls: run.executionSnapshot.futureBudget.maxToolCalls,
          maxExecutionSeconds: run.executionSnapshot.futureBudget.maxExecutionSeconds,
          maxSpendUsd: run.executionSnapshot.futureBudget.maxSpendUsd,
        },
        policy: {
          mode: run.policySnapshot.mode,
          networkAccess: run.policySnapshot.networkAccess,
          writesAllowed: run.policySnapshot.writesAllowed,
          effectiveMaxAttempts: run.policySnapshot.effectiveMaxAttempts,
          effectiveMaxToolCalls: run.policySnapshot.effectiveMaxToolCalls,
          effectiveMaxExecutionSeconds: run.policySnapshot.effectiveMaxExecutionSeconds,
          effectiveMaxSpendUsd: run.policySnapshot.effectiveMaxSpendUsd,
        },
      },
    },
    events: events.map((event) => {
      const eventReason = safeOutcomeReasonSchema.safeParse(event.safeReason);
      return {
        fromStatus: event.fromStatus,
        toStatus: event.toStatus,
        actorKind: event.actorKind,
        safeReason: eventReason.success ? eventReason.data : null,
        attempt: event.attempt,
        createdAt: event.createdAt.toISOString(),
      };
    }),
  });
}
