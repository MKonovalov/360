import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import {
  DebugAnalysisRun,
  DebugDiagnosticUnavailable,
  fetchAnalysisDebugDiagnostics,
} from './debug-analysis-run';
import type { DebugAnalysisRunDiagnostic } from '@/lib/analysis/debugDiagnostics';

const diagnostic: DebugAnalysisRunDiagnostic = {
  applicationRunId: 39,
  rawAttemptId: 71,
  status: 'failed',
  safeReason: 'execution_failed',
  reason: 'missing_support',
  timestamps: {
    capturedAt: '2026-08-15T12:00:00.000Z',
    expiresAt: '2026-08-22T12:00:00.000Z',
    createdAt: '2026-08-15T11:00:00.000Z',
    startedAt: '2026-08-15T11:01:00.000Z',
    completedAt: '2026-08-15T11:05:00.000Z',
    terminalAt: '2026-08-15T11:05:00.000Z',
  },
  raw: {
    targetType: 'company',
    attempt: 1,
    failureStage: 'normalization',
    schemaVersion: 1,
    redactionVersion: 1,
    truncated: false,
    counts: {
      findings: { received: 1, retained: 1 },
      citations: { received: 0, retained: 0 },
      toolResults: { received: 0, retained: 0 },
    },
    bytes: { received: 512, serialized: 512 },
    citationCoverage: {
      findingCount: 1,
      citedFindingCount: 0,
      citationCount: 0,
      mismatches: [{ kind: 'finding_without_citation', findingId: 'f-1' }],
    },
    findings: [{
      findingId: 'f-1',
      signalId: 4,
      status: 'strong',
      confidence: 'high',
      claim: { value: 'Cost pressure is visible', sha256: 'a'.repeat(64), originalLength: 24, redaction: 'none', truncated: false },
    }],
    citations: [],
    toolResults: [],
  },
  normalized: {
    resultId: 12,
    targetType: 'company',
    packetHash: 'c'.repeat(64),
    startedAt: '2026-08-15T11:01:00.000Z',
    completedAt: '2026-08-15T11:05:00.000Z',
    durationMs: 240_000,
    findingCount: 0,
    sourceCount: 0,
    linkCount: 0,
    expiresAt: null,
  },
};

const missingSupportDiagnostic: DebugAnalysisRunDiagnostic = {
  ...diagnostic,
  applicationRunId: 60,
  rawAttemptId: 60,
  reason: 'missing_support',
  raw: {
    ...diagnostic.raw,
    findings: [
      {
        findingId: 'run-60-strong',
        signalId: 12,
        status: 'strong',
        confidence: 'high',
        claim: {
          value: null,
          sha256: 'd'.repeat(64),
          originalLength: 42,
          redaction: 'sensitive',
          truncated: false,
        },
      },
      {
        findingId: 'run-60-weak',
        signalId: 13,
        status: 'weak',
        confidence: 'low',
        claim: {
          value: 'Weak finding without support.',
          sha256: 'e'.repeat(64),
          originalLength: 29,
          redaction: 'none',
          truncated: false,
        },
      },
    ],
    counts: {
      ...diagnostic.raw.counts,
      findings: { received: 2, retained: 2 },
    },
  },
  normalized: null,
};

describe('DebugAnalysisRun', () => {
  it('renders the redacted comparison and exact private validation reason without raw fields', () => {
    const html = renderToStaticMarkup(<DebugAnalysisRun applicationRunId={39} initialDiagnostic={diagnostic} />);

    expect(html).toContain('Redacted analysis diagnostics');
    expect(html).toContain('missing_support');
    expect(html).toContain('Cost pressure is visible');
    expect(html).toContain('Normalized result');
    expect(html).toContain('Finding / citation coverage');
    expect(html).toContain('Finding f-1 has no retained citation.');
    expect(html).not.toContain('reasoningSummary');
    expect(html).not.toContain('modelId');
    expect(html).not.toContain('rawAudit');
  });

  it('renders an explicit unavailable state without raw payload placeholders', () => {
    const html = renderToStaticMarkup(<DebugDiagnosticUnavailable />);

    expect(html).toContain('Diagnostic artifact unavailable');
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('rawAudit');
  });

  it('requests the dedicated diagnostics API with browser no-store semantics', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(diagnostic), { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();

    const result = await fetchAnalysisDebugDiagnostics(39, controller.signal);

    expect(result).toMatchObject({ kind: 'ready' });
    expect(fetchMock).toHaveBeenCalledWith('/api/debug/analysis-runs/39', {
      cache: 'no-store',
      signal: controller.signal,
    });
    vi.unstubAllGlobals();
  });

  it('renders the run-60 missing-support diagnosis without inventing a normalized result', () => {
    const html = renderToStaticMarkup(
      <DebugAnalysisRun applicationRunId={60} initialDiagnostic={missingSupportDiagnostic} />,
    );

    expect(html).toContain('Run #60');
    expect(html).toContain('missing_support');
    expect(html).toContain('No normalized result was committed for this failed run.');
    expect(html).toContain('Finding / citation coverage');
    expect(html).not.toContain('undefined');
  });
});
