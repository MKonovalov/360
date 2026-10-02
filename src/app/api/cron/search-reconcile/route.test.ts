import { beforeEach, describe, expect, it, vi } from 'vitest';

const sweep = vi.hoisted(() => vi.fn());
const analyzeSweep = vi.hoisted(() => vi.fn());
vi.mock('@/lib/search/searchCallbacks', () => ({ reconcileInFlightSearchRuns: sweep }));
vi.mock('@/lib/analysis/arcAgentnetSweep', () => ({ reconcileInFlightArcAgentnetRuns: analyzeSweep }));
const envMock = vi.hoisted(() => ({ CRON_SECRET: 'c'.repeat(32) as string | undefined }));
vi.mock('@/lib/env', () => ({ env: envMock }));

import { GET } from './route';

describe('GET /api/cron/search-reconcile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envMock.CRON_SECRET = 'c'.repeat(32);
  });

  it.each([
    ['no authorization', undefined],
    ['a wrong secret', `Bearer ${'d'.repeat(32)}`],
  ] as const)('rejects %s', async (_label, authorization) => {
    const response = await GET(new Request('https://x.test/api/cron/search-reconcile', authorization ? { headers: { authorization } } : {}));
    expect(response.status).toBe(401);
    expect(sweep).not.toHaveBeenCalled();
    expect(analyzeSweep).not.toHaveBeenCalled();
  });

  it('fails closed when no cron secret is configured', async () => {
    envMock.CRON_SECRET = undefined;
    const response = await GET(new Request('https://x.test/api/cron/search-reconcile', { headers: { authorization: 'Bearer anything' } }));
    expect(response.status).toBe(401);
  });

  it('runs both the Search and Analyze sweeps for an authorized cron request', async () => {
    sweep.mockResolvedValue({ checked: 2, failed: 0 });
    analyzeSweep.mockResolvedValue({ checked: 1, failed: 1 });
    const response = await GET(new Request('https://x.test/api/cron/search-reconcile', { headers: { authorization: `Bearer ${'c'.repeat(32)}` } }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      search: { checked: 2, failed: 0 },
      analyze: { checked: 1, failed: 1 },
    });
  });

  it('still reports the other sweep when one throws', async () => {
    sweep.mockRejectedValue(new Error('db down'));
    analyzeSweep.mockResolvedValue({ checked: 3, failed: 0 });
    const response = await GET(new Request('https://x.test/api/cron/search-reconcile', { headers: { authorization: `Bearer ${'c'.repeat(32)}` } }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      search: { checked: 0, failed: 0, error: 'sweep_failed' },
      analyze: { checked: 3, failed: 0 },
    });
  });
});
