import { z } from 'zod';

import {
  analysisRunStatusSchema,
  safeOutcomeReasonSchema,
  type AnalysisRunStatus,
} from './contracts';

const analysisRunStatusResponseSchema = z.object({
  applicationRunId: z.number().int().positive(),
  status: analysisRunStatusSchema,
  safeReason: safeOutcomeReasonSchema.nullable(),
  events: z.array(z.object({
    fromStatus: analysisRunStatusSchema.nullable(),
    toStatus: analysisRunStatusSchema,
    actorKind: z.enum(['staff', 'workflow', 'system']),
    safeReason: safeOutcomeReasonSchema.nullable(),
    attempt: z.number().int().min(0).max(2),
    createdAt: z.string().datetime({ offset: true }),
  }).strict()),
});

export type AnalysisRunStatusResponse = z.infer<typeof analysisRunStatusResponseSchema>;

export const TERMINAL_ANALYSIS_STATUSES = [
  'completed',
  'failed',
  'cancelled',
  'pending_review',
  'confirmed',
  'dismissed',
] as const satisfies readonly AnalysisRunStatus[];

const terminalStatusSet: ReadonlySet<AnalysisRunStatus> = new Set(TERMINAL_ANALYSIS_STATUSES);

export function isTerminalAnalysisStatus(status: AnalysisRunStatus): boolean {
  return terminalStatusSet.has(status);
}

export type AnalysisPollingResult =
  | { readonly kind: 'terminal'; readonly run: AnalysisRunStatusResponse }
  | { readonly kind: 'aborted' }
  | { readonly kind: 'error'; readonly message: string };

type FetchImplementation = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface PollAnalysisRunOptions {
  readonly applicationRunId: number;
  readonly signal: AbortSignal;
  readonly onUpdate: (run: AnalysisRunStatusResponse) => void;
  readonly intervalMs?: number;
  readonly fetchImpl?: FetchImplementation;
}

export async function pollAnalysisRun({
  applicationRunId,
  signal,
  onUpdate,
  intervalMs = 2_000,
  fetchImpl = fetch,
}: PollAnalysisRunOptions): Promise<AnalysisPollingResult> {
  while (!signal.aborted) {
    let run: AnalysisRunStatusResponse;
    try {
      const response = await fetchImpl(`/api/analysis-runs/${applicationRunId}`, { signal });
      const payload = await readJson(response);
      if (signal.aborted) return { kind: 'aborted' };
      if (!response.ok) {
        return { kind: 'error', message: 'The analysis status could not be loaded. Try again.' };
      }
      const parsed = analysisRunStatusResponseSchema.safeParse(payload);
      if (!parsed.success) {
        return { kind: 'error', message: 'The analysis status could not be loaded. Try again.' };
      }
      run = parsed.data;
    } catch (error: unknown) {
      if (isAbortError(error) || signal.aborted) return { kind: 'aborted' };
      if (error instanceof TypeError) {
        return { kind: 'error', message: 'The analysis status could not be reached. Try again.' };
      }
      return { kind: 'error', message: 'The analysis status could not be loaded. Try again.' };
    }

    if (signal.aborted) return { kind: 'aborted' };
    onUpdate(run);
    if (isTerminalAnalysisStatus(run.status)) return { kind: 'terminal', run };
    if (!(await waitForNextPoll(intervalMs, signal))) return { kind: 'aborted' };
  }

  return { kind: 'aborted' };
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch (error: unknown) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function waitForNextPoll(intervalMs: number, signal: AbortSignal): Promise<boolean> {
  if (signal.aborted) return Promise.resolve(false);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (shouldContinue: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', handleAbort);
      resolve(shouldContinue);
    };
    const handleAbort = () => finish(false);
    const timer = setTimeout(() => finish(true), intervalMs);
    signal.addEventListener('abort', handleAbort, { once: true });
  });
}
