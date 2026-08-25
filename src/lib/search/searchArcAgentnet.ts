import { z } from 'zod';

import {
  arcAgentnetClient,
  type ArcAgentnetClient,
  type ArcAgentnetClientResult,
  type ArcAgentnetJob,
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
import { processSearchTerminalResult, type SearchProcessResult } from './searchCandidates';

export interface SearchSubmitContext {
  readonly schemaVersion: number;
  readonly analysis: {
    readonly resolvedInstructions: string;
    readonly subjectType: 'company';
    readonly company: {
      readonly id: number;
      readonly name: string;
      readonly domain: string | null;
    };
  };
}

const searchSubmitContextSchema = z
  .object({
    schemaVersion: z.number().int().positive(),
    analysis: z
      .object({
        resolvedInstructions: z.string().trim().min(1).max(20_000),
        subjectType: z.literal('company'),
        company: z
          .object({
            id: z.number().int().positive(),
            name: z.string().trim().min(1).max(200),
            domain: z.string().trim().min(1).max(253).nullable(),
          })
          .strict(),
      })
      .strict(),
  })
  .strict();

export interface SearchJobInput {
  readonly idempotencyKey: string;
  readonly context: SearchSubmitContext;
  readonly runId: number;
  readonly initiatingUserId: string;
  readonly associateMapping?: typeof associateSearchRunPartnerMapping;
  readonly client?: ArcAgentnetClient;
}

export interface SearchPollInput {
  readonly partnerJobId: string;
  readonly client?: ArcAgentnetClient;
}

export async function submitSearchJob(input: SearchJobInput): Promise<ArcAgentnetClientResult<ArcAgentnetJob>> {
  const parsedContext = searchSubmitContextSchema.safeParse(input.context);
  if (!parsedContext.success) return { ok: false, kind: 'invalid_input', status: null };
  const submitted = await (input.client ?? arcAgentnetClient).submit({ idempotencyKey: input.idempotencyKey, input: parsedContext.data });
  if (!submitted.ok) return submitted;
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
  readonly processTerminal?: typeof processSearchTerminalResult;
}

export type SearchReconciliationResult =
  | { readonly kind: 'not_found' }
  | { readonly kind: 'poll_failed'; readonly failure: Exclude<ArcAgentnetClientResult<ArcAgentnetJob>, { readonly ok: true }> }
  | { readonly kind: 'processing_failed'; readonly run: SearchRunRecord }
  | { readonly kind: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'; readonly run: SearchRunRecord }
  | { readonly kind: 'terminal_conflict'; readonly run: SearchRunRecord };

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
  const processTerminal = dependencies.processTerminal ?? processSearchTerminalResult;
  const run = await getRun(runId, initiatingUserId);
  if (!run) return { kind: 'not_found' };
  const mapping = await getMapping(runId, initiatingUserId);
  if (!mapping) {
    switch (run.status) {
      case 'succeeded':
      case 'failed':
      case 'cancelled':
        return { kind: run.status, run };
      case 'queued':
      case 'running':
        return { kind: 'not_found' };
      default:
        return assertNever(run.status);
    }
  }
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

  if (polled.value.status === 'queued' || polled.value.status === 'running' || polled.value.status === 'cancelling') {
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
    return { kind: polled.value.status === 'queued' ? 'queued' : 'running', run: statusRun };
  }

  const packet = packetFromResult(polled.value.result);
  if (polled.value.status === 'succeeded') {
    let processed: SearchProcessResult;
    try {
      processed = await processTerminal({
        searchRunId: runId,
        userId: initiatingUserId,
        packet,
        terminalStatus: 'succeeded',
      });
    } catch (error: unknown) {
      if (error instanceof Error) return { kind: 'processing_failed', run };
      throw error;
    }

    switch (processed.kind) {
      case 'not_found':
        return { kind: 'not_found' };
      case 'not_terminal':
      case 'conflict': {
        const currentRun = await getRun(runId, initiatingUserId);
        return currentRun ? { kind: 'terminal_conflict', run: currentRun } : { kind: 'not_found' };
      }
      case 'invalid_packet':
      case 'applied':
      case 'replayed': {
        const terminal = await recordTerminal({
          runId,
          initiatingUserId,
          partnerJobId: polled.value.jobId,
          requestId: polled.value.requestId,
          status: processed.kind === 'invalid_packet' ? 'failed' : 'succeeded',
          packetHash: processed.packetHash,
          packetSchemaVersion: processed.packetSchemaVersion,
          terminalResultSummary: terminalSummary(polled.value.result),
        });
        const terminalRun = terminalResultRun(terminal);
        if (!terminalRun) return { kind: 'not_found' };
        if (terminal.kind === 'conflict') return { kind: 'terminal_conflict', run: terminalRun };
        return { kind: processed.kind === 'invalid_packet' ? 'failed' : 'succeeded', run: terminalRun };
      }
    }
  }

  const terminal = await recordTerminal({
    runId,
    initiatingUserId,
    partnerJobId: polled.value.jobId,
    requestId: polled.value.requestId,
    status: polled.value.status,
    packetHash: null,
    packetSchemaVersion: null,
    terminalResultSummary: terminalSummary(polled.value.result),
  });
  const terminalRun = terminalResultRun(terminal);
  if (!terminalRun) return { kind: 'not_found' };
  return terminal.kind === 'conflict'
    ? { kind: 'terminal_conflict', run: terminalRun }
    : { kind: polled.value.status, run: terminalRun };
}

function assertNever(value: never): never {
  throw new Error(`Unhandled Search run status: ${String(value)}`);
}
