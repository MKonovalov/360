import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createSearchLaunchPayload,
  pollSearchRun,
  searchErrorMessage,
} from './searchClient';

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

function statusProjection(
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled',
  total = 0,
) {
  return {
    searchRunId: 73,
    status,
    company: { id: 42, name: 'Acme', domain: 'acme.example' },
    template: { id: 5, versionId: 11, name: 'GBS Scout', version: 2 },
    candidateCounts: {
      total,
      pending: total,
      inconclusive: 0,
      ambiguous: 0,
      approved: 0,
      rejected: 0,
    },
    reviewsUrl: total > 0 ? '/reviews?searchRunId=73' : null,
  } as const;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('searchClient', () => {
  it('creates the exact local-only launch payload', () => {
    const payload = createSearchLaunchPayload({
      companyId: 42,
      templateVersionId: 11,
      idempotencyKey: 'opaque-browser-key',
    });

    expect(payload).toEqual({
      subject: { type: 'company', id: 42 },
      templateVersionId: 11,
      idempotencyKey: 'opaque-browser-key',
    });
    expect(JSON.stringify(payload)).not.toContain('partner');
    expect(JSON.stringify(payload)).not.toContain('instruction');
  });

  it('maps dispatch, expiry, validation, and persistence failures to safe copy', () => {
    expect(searchErrorMessage('partner_unavailable')).toContain('Search could not reach');
    expect(searchErrorMessage('job_expired')).toContain('expired');
    expect(searchErrorMessage('invalid_input')).toContain('invalid');
    expect(searchErrorMessage('persistence_unavailable')).toContain('saved');
    expect(searchErrorMessage('partner_unavailable')).not.toContain('partner ID');
  });

  it('polls the local run endpoint at two-second intervals and stops at terminal status', async () => {
    vi.useFakeTimers();
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const running = statusProjection('running');
    const succeeded = statusProjection('succeeded', 2);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(running))
      .mockResolvedValueOnce(jsonResponse(succeeded));
    vi.stubGlobal('fetch', fetchMock);

    const promise = pollSearchRun({
      searchRunId: 73,
      signal: new AbortController().signal,
    });

    await vi.runAllTimersAsync();

    await expect(promise).resolves.toEqual({ kind: 'terminal', projection: succeeded });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/search-runs/73',
      '/api/search-runs/73',
    ]);
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 2000);
  });

  it('resolves as aborted without another local request after cancellation', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(statusProjection('running')));
    vi.stubGlobal('fetch', fetchMock);

    const promise = pollSearchRun({ searchRunId: 73, signal: controller.signal });
    await Promise.resolve();
    controller.abort();

    await expect(promise).resolves.toEqual({ kind: 'aborted' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
