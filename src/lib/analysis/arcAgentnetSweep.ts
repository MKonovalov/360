import 'server-only';

import { arcAgentnetClient, type ArcAgentnetClient } from '@/lib/arc-agentnet/client';
import {
  applyArcAgentnetResultProjection,
  listInFlightArcAgentnetRuns,
  recordArcAgentnetStatus,
  type ArcAgentnetRunRecord,
} from '@/lib/db/queries/arcAgentnetRuns';

const SWEEP_WINDOW_MS = 48 * 60 * 60 * 1000;
const SWEEP_LIMIT = 20;

export interface ArcAgentnetSweepResult {
  readonly checked: number;
  readonly failed: number;
}

interface SweepDependencies {
  readonly listRuns?: typeof listInFlightArcAgentnetRuns;
  readonly client?: Pick<ArcAgentnetClient, 'poll'>;
  readonly applyProjection?: typeof applyArcAgentnetResultProjection;
  readonly recordStatus?: typeof recordArcAgentnetStatus;
  readonly now?: Date;
}

// Mirrors the status route's poll handling (GET /api/analysis-runs/arc-agentnet/[id])
// for a run nobody has open. A result the projection rules reject is left
// running, exactly as the route does, so a later fix can still ingest it.
async function reconcileRun(run: ArcAgentnetRunRecord, dependencies: Required<Omit<SweepDependencies, 'listRuns' | 'now'>>): Promise<boolean> {
  const { partnerJobId, partnerRequestId, initiatingUserId } = run;
  if (!partnerJobId || !partnerRequestId || !initiatingUserId) return false;

  const polled = await dependencies.client.poll({ jobId: partnerJobId });
  if (!polled.ok) {
    if (polled.kind !== 'job_expired') return false;
    await dependencies.recordStatus({
      runId: run.id,
      initiatingUserId,
      partnerJobId,
      requestId: partnerRequestId,
      partnerStatus: 'failed',
      source: 'poll',
      safeReason: 'job_expired',
    });
    return true;
  }
  if (polled.value.jobId !== partnerJobId || polled.value.requestId !== partnerRequestId) return false;

  if (polled.value.status === 'succeeded' && polled.value.result !== undefined) {
    const projection = await dependencies.applyProjection({
      runId: run.id,
      initiatingUserId,
      partnerJobId,
      requestId: partnerRequestId,
      projection: polled.value.result,
      source: 'poll',
    });
    if (projection.kind === 'invalid_input' || projection.kind === 'not_found' || projection.kind === 'conflict') return false;
  }

  const reconciled = await dependencies.recordStatus({
    runId: run.id,
    initiatingUserId,
    partnerJobId,
    requestId: partnerRequestId,
    partnerStatus: polled.value.status,
    source: 'poll',
  });
  return reconciled.kind !== 'not_found';
}

// Safety net for lost Analyze webhooks: reconcile every recent in-flight run.
export async function reconcileInFlightArcAgentnetRuns(dependencies: SweepDependencies = {}): Promise<ArcAgentnetSweepResult> {
  const listRuns = dependencies.listRuns ?? listInFlightArcAgentnetRuns;
  const resolved = {
    client: dependencies.client ?? arcAgentnetClient,
    applyProjection: dependencies.applyProjection ?? applyArcAgentnetResultProjection,
    recordStatus: dependencies.recordStatus ?? recordArcAgentnetStatus,
  };
  const since = new Date((dependencies.now ?? new Date()).getTime() - SWEEP_WINDOW_MS);
  const runs = await listRuns(since, SWEEP_LIMIT);
  let failed = 0;
  for (const run of runs) {
    try {
      if (!(await reconcileRun(run, resolved))) failed += 1;
    } catch {
      failed += 1;
    }
  }
  return { checked: runs.length, failed };
}
