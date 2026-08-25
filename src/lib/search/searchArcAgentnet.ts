import { createHash } from 'node:crypto';

import {
  arcAgentnetClient,
  type ArcAgentnetClient,
  type ArcAgentnetClientResult,
  type ArcAgentnetJob,
  type ArcAgentnetSubmitContext,
} from '@/lib/arc-agentnet/client';
import type { SearchTerminalResultSummary } from '@/lib/db/schema';
import {
  getSearchRunById,
  getSearchRunPartnerMapping,
  associateSearchRunPartnerMapping,
  recordSearchRunStatus,
  recordSearchTerminalResult,
  type RecordSearchRunStatusResult,
  type RecordSearchTerminalResultResult,
  type SearchRunRecord,
} from './searchRuns';

export type SearchSubmitContext = ArcAgentnetSubmitContext;

export interface SearchJobInput {
  readonly idempotencyKey: string;
  readonly context: SearchSubmitContext;
  readonly runId?: number;
  readonly initiatingUserId?: string;
  readonly associateMapping?: typeof associateSearchRunPartnerMapping;
  readonly client?: ArcAgentnetClient;
}

export interface SearchPollInput {
  readonly partnerJobId: string;
  readonly client?: ArcAgentnetClient;
}

export async function submitSearchJob(input: SearchJobInput): Promise<ArcAgentnetClientResult<ArcAgentnetJob>> {
  const submitted = await (input.client ?? arcAgentnetClient).submit({ idempotencyKey: input.idempotencyKey, input: input.context });
  if (!submitted.ok || input.runId === undefined || input.initiatingUserId === undefined) return submitted;
  try {
    const associated = await (input.associateMapping ?? associateSearchRunPartnerMapping)({
      runId: input.runId,
      initiatingUserId: input.initiatingUserId,
      partnerJobId: submitted.value.jobId,
      requestId: submitted.value.requestId,
    });
    return associated === undefined
      ? { ok: false, kind: 'persistence', status: null }
      : submitted;
  } catch {
    return { ok: false, kind: 'persistence', status: null };
  }
}

export function pollSearchJob(input: SearchPollInput): Promise<ArcAgentnetClientResult<ArcAgentnetJob>> {
  return (input.client ?? arcAgentnetClient).poll({ jobId: input.partnerJobId });
}

interface ReconcileDependencies {
  readonly client?: ArcAgentnetClient;
  readonly getRun?: typeof getSearchRunById;
  readonly getMapping?: typeof getSearchRunPartnerMapping;
  readonly recordStatus?: typeof recordSearchRunStatus;
  readonly recordTerminal?: typeof recordSearchTerminalResult;
}

export type SearchReconciliationResult =
  | { readonly kind: 'not_found' }
  | { readonly kind: 'poll_failed'; readonly failure: Exclude<ArcAgentnetClientResult<ArcAgentnetJob>, { readonly ok: true }> }
  | { readonly kind: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'; readonly run: SearchRunRecord }
  | { readonly kind: 'terminal_conflict'; readonly run: SearchRunRecord };

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, nested]) => [key, canonicalize(nested)]));
  }
  return value;
}

function hashResult(value: unknown): string | null {
  if (value === undefined) return null;
  return createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

function packetFromResult(result: unknown): unknown {
  if (result !== null && typeof result === 'object' && 'output' in result) return (result as { output?: unknown }).output;
  return result;
}

function terminalSummary(result: unknown): SearchTerminalResultSummary {
  const packet = packetFromResult(result);
  const packetRecord = packet !== null && typeof packet === 'object' ? packet as Record<string, unknown> : {};
  const candidates = Array.isArray(packetRecord.candidates) ? packetRecord.candidates : [];
  let sourceCount = 0;
  let inconclusiveCount = 0;
  for (const candidate of candidates) {
    if (candidate === null || typeof candidate !== 'object') continue;
    const record = candidate as Record<string, unknown>;
    sourceCount += Array.isArray(record.sources) ? record.sources.length : 0;
    if (record.status === 'inconclusive') inconclusiveCount += 1;
  }
  return {
    schemaVersion: typeof packetRecord.schemaVersion === 'number' ? packetRecord.schemaVersion : 1,
    candidateCount: candidates.length,
    sourceCount,
    inconclusiveCount,
    normalizedCandidateCount: candidates.length,
  };
}

function statusResultRun(result: RecordSearchRunStatusResult): SearchRunRecord | undefined {
  return result.kind === 'not_found' ? undefined : result.run;
}

function terminalResultRun(result: RecordSearchTerminalResultResult): SearchRunRecord | undefined {
  return result.kind === 'not_found' ? undefined : result.run;
}

export async function reconcileSearchRun(
  runId: number,
  initiatingUserId: string,
  dependencies: ReconcileDependencies = {},
): Promise<SearchReconciliationResult> {
  const getRun = dependencies.getRun ?? getSearchRunById;
  const getMapping = dependencies.getMapping ?? getSearchRunPartnerMapping;
  const recordStatus = dependencies.recordStatus ?? recordSearchRunStatus;
  const recordTerminal = dependencies.recordTerminal ?? recordSearchTerminalResult;
  const run = await getRun(runId, initiatingUserId);
  if (!run) return { kind: 'not_found' };
  const mapping = await getMapping(runId, initiatingUserId);
  if (!mapping) return { kind: 'not_found' };
  const polled = await pollSearchJob({ partnerJobId: mapping.partnerJobId, client: dependencies.client });
  if (!polled.ok) {
    if (polled.kind !== 'job_expired') return { kind: 'poll_failed', failure: polled };
    const terminal = await recordTerminal({
      runId,
      initiatingUserId,
      partnerJobId: mapping.partnerJobId,
      requestId: mapping.requestId,
      status: 'failed',
      packetHash: null,
      packetSchemaVersion: null,
      terminalResultSummary: { schemaVersion: 1, candidateCount: 0, sourceCount: 0, inconclusiveCount: 0, normalizedCandidateCount: 0 },
    });
    const terminalRun = terminalResultRun(terminal);
    return terminalRun ? { kind: terminal.kind === 'conflict' ? 'terminal_conflict' : 'failed', run: terminalRun } : { kind: 'not_found' };
  }

  const status = await recordStatus({
    runId,
    initiatingUserId,
    partnerJobId: polled.value.jobId,
    requestId: polled.value.requestId,
    partnerStatus: polled.value.status,
    source: 'poll',
  });
  const statusRun = statusResultRun(status);
  if (!statusRun) return { kind: 'not_found' };
  if (polled.value.status === 'queued' || polled.value.status === 'running' || polled.value.status === 'cancelling') {
    return { kind: polled.value.status === 'queued' ? 'queued' : 'running', run: statusRun };
  }

  const packet = packetFromResult(polled.value.result);
  const summary = terminalSummary(polled.value.result);
  const terminal = await recordTerminal({
    runId,
    initiatingUserId,
    partnerJobId: polled.value.jobId,
    requestId: polled.value.requestId,
    status: polled.value.status,
    packetHash: polled.value.status === 'succeeded' ? hashResult(packet) : null,
    packetSchemaVersion: typeof summary.schemaVersion === 'number' ? summary.schemaVersion : null,
    terminalResultSummary: summary,
  });
  const terminalRun = terminalResultRun(terminal);
  if (!terminalRun) return { kind: 'not_found' };
  return terminal.kind === 'conflict'
    ? { kind: 'terminal_conflict', run: terminalRun }
    : { kind: polled.value.status, run: terminalRun };
}
