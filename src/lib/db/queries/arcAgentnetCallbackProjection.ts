import type { AnalyzeCallbackPayload } from '@/lib/arc-agentnet/callback';
import {
  applyArcAgentnetResultProjection,
  getArcAgentnetRunByPartnerIdentity,
  recordArcAgentnetStatus,
} from './arcAgentnetRuns';

export async function applyArcAgentnetCallbackProjection(input: Readonly<{
  readonly callback: AnalyzeCallbackPayload;
  readonly receivedAt: Date;
}>): Promise<void> {
  const run = await getArcAgentnetRunByPartnerIdentity(
    input.callback.jobId,
    input.callback.requestId,
  );
  if (!run || run.initiatingUserId === null) return;

  if (input.callback.result !== undefined) {
    await applyArcAgentnetResultProjection({
      runId: run.id,
      initiatingUserId: run.initiatingUserId,
      partnerJobId: input.callback.jobId,
      requestId: input.callback.requestId,
      projection: input.callback.result,
      occurredAt: input.receivedAt,
    });
  }

  await recordArcAgentnetStatus({
    runId: run.id,
    initiatingUserId: run.initiatingUserId,
    partnerJobId: input.callback.jobId,
    requestId: input.callback.requestId,
    partnerStatus: input.callback.status,
    occurredAt: input.receivedAt,
  });
}
