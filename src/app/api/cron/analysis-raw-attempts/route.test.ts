import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  env: { CRON_SECRET: 'cron-test-secret' as string | undefined },
  deleteExpiredAnalysisRawAttemptsBatch: vi.fn(),
}));

vi.mock('@/lib/env', () => ({ env: mocks.env }));
vi.mock('@/lib/db/queries/analysisRawAttempts', () => ({
  deleteExpiredAnalysisRawAttemptsBatch: mocks.deleteExpiredAnalysisRawAttemptsBatch,
}));

import * as route from './route';

describe('GET /api/cron/analysis-raw-attempts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.env.CRON_SECRET = 'cron-test-secret';
    mocks.deleteExpiredAnalysisRawAttemptsBatch.mockResolvedValue(0);
  });

  it('keeps the existing read-retention baseline visible through the GET-only route', () => {
    // Given
    const exportedMethods = Object.keys(route);

    // When / Then
    expect(exportedMethods).toContain('GET');
    expect(exportedMethods).not.toContain('POST');
  });

  it('denies a missing secret before database access', async () => {
    // Given
    mocks.env.CRON_SECRET = undefined;

    // When
    const response = await route.GET(new Request('http://localhost'));

    // Then
    expect(response.status).toBe(401);
    expect(mocks.deleteExpiredAnalysisRawAttemptsBatch).not.toHaveBeenCalled();
  });

  it.each([
    ['wrong secret', 'Bearer wrong-secret'],
    ['malformed scheme', 'Basic cron-test-secret'],
    ['extra whitespace', 'Bearer  cron-test-secret'],
  ])('denies %s before database access', async (_caseName, authorization) => {
    // Given

    // When
    const response = await route.GET(new Request('http://localhost', {
      headers: { authorization },
    }));

    // Then
    expect(response.status).toBe(401);
    expect(mocks.deleteExpiredAnalysisRawAttemptsBatch).not.toHaveBeenCalled();
  });

  it('deletes one max-500 batch per invocation and leaves overflow for the next invocation', async () => {
    // Given
    mocks.deleteExpiredAnalysisRawAttemptsBatch
      .mockResolvedValueOnce(500)
      .mockResolvedValueOnce(2);

    // When
    const firstResponse = await route.GET(new Request('http://localhost', {
      headers: { authorization: 'Bearer cron-test-secret' },
    }));

    // Then
    expect(firstResponse.status).toBe(200);
    const firstBody = await firstResponse.json();
    expect(firstBody).toEqual({ deletedCount: 500 });
    expect(mocks.deleteExpiredAnalysisRawAttemptsBatch).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(firstBody)).not.toContain('artifact');

    // When
    const secondResponse = await route.GET(new Request('http://localhost', {
      headers: { authorization: 'Bearer cron-test-secret' },
    }));

    // Then
    await expect(secondResponse.json()).resolves.toEqual({ deletedCount: 2 });
    expect(mocks.deleteExpiredAnalysisRawAttemptsBatch).toHaveBeenCalledTimes(2);
  });

  it('is repeat-safe when the cleanup query finds no expired rows', async () => {
    // Given
    mocks.deleteExpiredAnalysisRawAttemptsBatch.mockResolvedValue(0);

    // When
    const response = await route.GET(new Request('http://localhost', {
      headers: { authorization: 'Bearer cron-test-secret' },
    }));

    // Then
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ deletedCount: 0 });
    expect(mocks.deleteExpiredAnalysisRawAttemptsBatch).toHaveBeenCalledTimes(1);
  });
});
