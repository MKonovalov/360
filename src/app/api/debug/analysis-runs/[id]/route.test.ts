import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireDebugAdminAccess: vi.fn(),
  getAnalysisRawAttemptDiagnostic: vi.fn(),
}));

vi.mock('@/lib/auth/requireDebugAdminAccess', () => ({
  requireDebugAdminAccess: mocks.requireDebugAdminAccess,
}));
vi.mock('@/lib/db/queries/analysisRawAttemptDiagnostics', () => ({
  getAnalysisRawAttemptDiagnostic: mocks.getAnalysisRawAttemptDiagnostic,
}));

import { GET } from './route';

const failure = {
  schemaVersion: 1 as const,
  failureStage: 'provider' as const,
  errorName: 'ProviderTimeout',
  errorMessage: 'Provider unavailable',
  stackExcerpt: { value: null, sha256: 'd'.repeat(64), originalLength: 8_400, redaction: 'metadata_only' as const, truncated: true },
  providerPayload: { value: '{"status":429}', sha256: 'e'.repeat(64), originalLength: 14, redaction: 'none' as const, truncated: false },
  correlation: { runId: 39, traceId: 'trace-39', observationId: 'observation-39', parentObservationId: 'parent-39' },
};

const finding = {
  findingId: 'f-1',
  signalId: 4,
  status: 'strong' as const,
  confidence: 'high' as const,
  claim: { value: 'Cost pressure is visible', sha256: 'a'.repeat(64), originalLength: 24, redaction: 'none' as const, truncated: false },
  reasoningSummary: null,
};

const diagnostic = {
  rawAttemptId: 71,
  analysisRunId: 39,
  attempt: 1,
  failureStage: 'normalization',
  status: 'failed',
  safeReason: 'execution_failed',
  artifact: {
    schemaVersion: 1,
    redactionVersion: 1,
    targetType: 'company' as const,
    attempt: 1,
    failureStage: 'normalization',
    failureReason: 'missing_support',
    failure,
    modelProvider: 'anthropic' as const,
    modelId: 'claude-test',
    findings: [finding],
    citations: [],
    toolResults: [],
    truncated: false,
    counts: {
      findings: { received: 1, retained: 1 },
      citations: { received: 0, retained: 0 },
      toolResults: { received: 0, retained: 0 },
    },
    bytes: { received: 512, serialized: 512 },
  },
  payloadHash: 'b'.repeat(64),
  schemaVersion: 1,
  redactionVersion: 1,
  capturedAt: new Date('2026-08-15T12:00:00.000Z'),
  expiresAt: new Date('2026-08-22T12:00:00.000Z'),
  runStatus: 'failed' as const,
  runCreatedAt: new Date('2026-08-15T11:00:00.000Z'),
  runStartedAt: new Date('2026-08-15T11:01:00.000Z'),
  runCompletedAt: new Date('2026-08-15T11:05:00.000Z'),
  runTerminalAt: new Date('2026-08-15T11:05:00.000Z'),
  normalized: {
    resultId: 12,
    targetType: 'company' as const,
    packetHash: 'c'.repeat(64),
    startedAt: new Date('2026-08-15T11:01:00.000Z'),
    completedAt: new Date('2026-08-15T11:05:00.000Z'),
    durationMs: 240_000,
    findingCount: 0,
    sourceCount: 0,
    linkCount: 0,
    expiresAt: null,
  },
};

const missingSupportDiagnostic = {
  ...diagnostic,
  rawAttemptId: 60,
  analysisRunId: 60,
  artifact: {
    ...diagnostic.artifact,
    failureReason: 'missing_support',
    findings: [
      { ...finding, findingId: 'run-60-strong', signalId: 12, claim: { value: null, sha256: 'd'.repeat(64), originalLength: 42, redaction: 'sensitive' as const, truncated: false } },
      { ...finding, findingId: 'run-60-weak', signalId: 13, status: 'weak' as const, confidence: 'low' as const, claim: { value: 'Weak finding without support.', sha256: 'e'.repeat(64), originalLength: 29, redaction: 'none' as const, truncated: false } },
    ],
    citations: [],
    counts: {
      findings: { received: 2, retained: 2 },
      citations: { received: 0, retained: 0 },
      toolResults: { received: 0, retained: 0 },
    },
  },
  normalized: null,
};

const routeContext = (id: string): { params: Promise<{ id: string }> } => ({ params: Promise.resolve({ id }) });

describe('GET /api/debug/analysis-runs/[id]', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.requireDebugAdminAccess.mockResolvedValue({ userId: 'user_debug' }); mocks.getAnalysisRawAttemptDiagnostic.mockResolvedValue(diagnostic); });

  it('authorizes before parsing the id or querying raw data', async () => {
    const order: string[] = [];
    mocks.requireDebugAdminAccess.mockImplementation(async () => {
      order.push('auth');
      return { userId: 'user_debug' };
    });
    mocks.getAnalysisRawAttemptDiagnostic.mockImplementation(async () => {
      order.push('db');
      return diagnostic;
    });

    const response = await GET(new Request('http://localhost'), routeContext('39'));

    expect(response.status).toBe(200);
    expect(order).toEqual(['auth', 'db']);
  });

  it('keeps denied requests 404-safe without touching raw data', async () => {
    const order: string[] = [];
    mocks.requireDebugAdminAccess.mockImplementation(async () => {
      order.push('auth');
      throw new Error('NEXT_NOT_FOUND');
    });
    const context: { readonly params: Promise<{ readonly id: string }> } = {
      get params() {
        order.push('params');
        return Promise.resolve({ id: 'not-a-number' });
      },
    };

    await expect(GET(new Request('http://localhost'), context)).rejects.toThrow('NEXT_NOT_FOUND');

    expect(order).toEqual(['auth']);
    expect(mocks.getAnalysisRawAttemptDiagnostic).not.toHaveBeenCalled();
  });

  it.each(['0', '-1', '39.5', 'not-a-number'])('rejects malformed id %s after auth and before raw query', async (id) => {
    const response = await GET(new Request('http://localhost'), routeContext(id));

    expect(response.status).toBe(400);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(mocks.getAnalysisRawAttemptDiagnostic).not.toHaveBeenCalled();
  });

  it.each([
    { label: 'missing', value: null },
    { label: 'expired', value: null },
  ])('returns a no-store 404 for $label artifacts', async ({ value }) => {
    mocks.getAnalysisRawAttemptDiagnostic.mockResolvedValue(value);

    const response = await GET(new Request('http://localhost'), routeContext('39'));

    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    await expect(response.json()).resolves.toEqual({ error: 'analysis_debug_not_found' });
  });

  it('returns only a redacted comparison DTO, private reason, timestamps, and no-store headers', async () => {
    const response = await GET(new Request('http://localhost'), routeContext('39'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(payload).toMatchObject({
      applicationRunId: 39,
      status: 'failed',
      reason: 'missing_support',
      raw: {
        failureStage: 'normalization',
        findings: [{ claim: { value: 'Cost pressure is visible', redaction: 'none' } }],
        citationCoverage: {
          findingCount: 1,
          citedFindingCount: 0,
          citationCount: 0,
          mismatches: [{ kind: 'finding_without_citation', findingId: 'f-1' }],
        },
      },
      failure: {
        stage: 'provider',
        errorName: 'ProviderTimeout',
        errorMessage: 'Provider unavailable',
        stackExcerpt: {
          value: null,
          redaction: 'metadata_only',
          truncated: true,
        },
        providerPayload: {
          value: '{"status":429}',
          redaction: 'none',
          truncated: false,
        },
        correlation: {
          runId: 39,
          traceId: 'trace-39',
          observationId: 'observation-39',
          parentObservationId: 'parent-39',
        },
      },
      normalized: { resultId: 12, findingCount: 0 },
    });
    expect(payload.raw.findings[0]).not.toHaveProperty('reasoningSummary');
    expect(payload.raw).not.toHaveProperty('modelId');
    expect(payload.failure).not.toEqual(expect.objectContaining({ schemaVersion: expect.anything(), cause: expect.anything(), provider: expect.anything() }));
    expect(JSON.stringify(payload)).not.toMatch(/prompt|credential|private reasoning|raw stack|arbitrary provider/i);
    expect(mocks.getAnalysisRawAttemptDiagnostic).toHaveBeenCalledWith(39);
  });

  it('returns failure null for artifacts written before failure diagnostics existed', async () => {
    const legacyArtifact: Record<string, unknown> = { ...diagnostic.artifact };
    Reflect.deleteProperty(legacyArtifact, 'failure');
    mocks.getAnalysisRawAttemptDiagnostic.mockResolvedValue({ ...diagnostic, artifact: legacyArtifact });

    const response = await GET(new Request('http://localhost'), routeContext('39'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(payload.failure).toBeNull();
  });

  it('returns the existing unavailable response for a malformed stored failure record', async () => {
    mocks.getAnalysisRawAttemptDiagnostic.mockResolvedValue({
      ...diagnostic,
      artifact: {
        ...diagnostic.artifact,
        failure: {
          ...diagnostic.artifact.failure,
          correlation: {
            ...diagnostic.artifact.failure.correlation,
            providerRequestBody: 'must not be projected',
          },
        },
      },
    });

    const response = await GET(new Request('http://localhost'), routeContext('39'));

    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    await expect(response.json()).resolves.toEqual({ error: 'analysis_debug_not_found' });
  });

  it('diagnoses run 60 missing_support without normalized data or sensitive claim text', async () => {
    // Given
    mocks.getAnalysisRawAttemptDiagnostic.mockResolvedValue(missingSupportDiagnostic);

    // When
    const response = await GET(new Request('http://localhost'), routeContext('60'));
    const payload = await response.json();

    // Then
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(payload).toMatchObject({
      applicationRunId: 60,
      rawAttemptId: 60,
      reason: 'missing_support',
      raw: {
        findings: [
          { findingId: 'run-60-strong', signalId: 12, claim: { value: null, redaction: 'sensitive' } },
          { findingId: 'run-60-weak', signalId: 13, claim: { value: 'Weak finding without support.', redaction: 'none' } },
        ],
        citations: [],
      },
      normalized: null,
    });
    expect(JSON.stringify(payload)).not.toContain('secret');
    expect(JSON.stringify(payload)).not.toContain('private reasoning');
  });
});
