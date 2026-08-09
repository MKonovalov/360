import { describe, expect, it, vi } from 'vitest';

import {
  isTerminalAnalysisStatus,
  pollAnalysisRun,
  type AnalysisRunStatusResponse,
} from './pollingClient';

const responseFor = (status: AnalysisRunStatusResponse['status']): Response =>
  new Response(
    JSON.stringify({
      applicationRunId: 7,
      status,
      safeReason: null,
      attempt: 0,
      maxAttempts: 2,
      timestamps: {
        createdAt: '2026-08-08T00:00:00.000Z',
        startedAt: null,
        completedAt: null,
        terminalAt: null,
      },
      snapshotSummary: {
        template: {
          templateId: 1,
          templateVersionId: 2,
          key: 'company-buying-signal-analysis',
          name: 'Company Buying Signal Analysis',
          targetType: 'company',
          version: 1,
          effort: 'standard',
        },
        subject: { type: 'company', id: 42, displayName: 'Acme' },
        checklist: { practiceAreaId: 3, practiceAreaName: 'GBS', itemCount: 2 },
        execution: {
          resolvedModelChain: ['model-a'],
          futureBudget: {
            maxAttempts: 2,
            maxToolCalls: 12,
            maxExecutionSeconds: 300,
            maxSpendUsd: 2.5,
          },
          policy: {
            mode: 'phase32_noop',
            networkAccess: false,
            writesAllowed: false,
            effectiveMaxAttempts: 1,
            effectiveMaxToolCalls: 0,
            effectiveMaxExecutionSeconds: 5,
            effectiveMaxSpendUsd: 0,
          },
        },
      },
      events: [],
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );

describe('pollingClient', () => {
  it('treats every durable terminal status as terminal and queued/running as active', () => {
    const terminalStatuses: readonly AnalysisRunStatusResponse['status'][] = [
      'completed',
      'failed',
      'cancelled',
      'pending_review',
      'confirmed',
      'dismissed',
    ];

    expect(terminalStatuses.every(isTerminalAnalysisStatus)).toBe(true);
    expect(isTerminalAnalysisStatus('queued')).toBe(false);
    expect(isTerminalAnalysisStatus('running')).toBe(false);
  });

  it('stops immediately after a terminal response without scheduling another request', async () => {
    const fetchImpl = vi.fn(async () => responseFor('completed'));
    const onUpdate = vi.fn();
    const controller = new AbortController();

    const result = await pollAnalysisRun({
      applicationRunId: 7,
      signal: controller.signal,
      intervalMs: 1,
      fetchImpl,
      onUpdate,
    });

    expect(result).toMatchObject({ kind: 'terminal', run: { status: 'completed' } });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it('follows queued to running to completed and does not drop intermediate updates', async () => {
    vi.useFakeTimers();
    try {
      const statuses: AnalysisRunStatusResponse['status'][] = ['queued', 'running', 'completed'];
      const fetchImpl = vi.fn(async () => responseFor(statuses.shift() ?? 'completed'));
      const onUpdate = vi.fn();
      const controller = new AbortController();
      const polling = pollAnalysisRun({
        applicationRunId: 7,
        signal: controller.signal,
        intervalMs: 100,
        fetchImpl,
        onUpdate,
      });

      await vi.runOnlyPendingTimersAsync();
      await vi.runOnlyPendingTimersAsync();
      await vi.runOnlyPendingTimersAsync();
      const result = await polling;

      expect(result).toMatchObject({ kind: 'terminal', run: { status: 'completed' } });
      expect(fetchImpl).toHaveBeenCalledTimes(3);
      expect(onUpdate.mock.calls.map(([run]) => run.status)).toEqual(['queued', 'running', 'completed']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('aborts an in-flight request and suppresses its stale response', async () => {
    let resolveResponse: ((response: Response) => void) | undefined;
    const fetchImpl = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((resolve, reject) => {
          resolveResponse = resolve;
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          }, { once: true });
        }),
    );
    const onUpdate = vi.fn();
    const controller = new AbortController();
    const polling = pollAnalysisRun({
      applicationRunId: 7,
      signal: controller.signal,
      intervalMs: 100,
      fetchImpl,
      onUpdate,
    });

    controller.abort();
    resolveResponse?.(responseFor('completed'));

    await expect(polling).resolves.toEqual({ kind: 'aborted' });
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('returns a safe network error without retrying an unavailable status endpoint', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('network unavailable');
    });
    const controller = new AbortController();

    await expect(pollAnalysisRun({
      applicationRunId: 7,
      signal: controller.signal,
      fetchImpl,
      onUpdate: vi.fn(),
    })).resolves.toEqual({ kind: 'error', message: 'The analysis status could not be reached. Try again.' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
