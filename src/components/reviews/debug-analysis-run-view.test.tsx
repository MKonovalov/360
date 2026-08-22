import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { DebugAnalysisRunDiagnostic } from '@/lib/analysis/debugDiagnostics';
import { DebugDiagnosticsView } from './debug-analysis-run-view';

const baseDiagnostic: DebugAnalysisRunDiagnostic = {
  applicationRunId: 39,
  rawAttemptId: 71,
  status: 'failed',
  safeReason: 'execution_failed',
  reason: 'missing_support',
  failure: null,
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
      findings: { received: 0, retained: 0 },
      citations: { received: 0, retained: 0 },
      toolResults: { received: 0, retained: 0 },
    },
    bytes: { received: 512, serialized: 512 },
    citationCoverage: {
      findingCount: 0,
      citedFindingCount: 0,
      citationCount: 0,
      mismatches: [],
    },
    findings: [],
    citations: [],
    toolResults: [],
  },
  normalized: null,
};

const completeFailure: NonNullable<DebugAnalysisRunDiagnostic['failure']> = {
  stage: 'provider',
  errorName: 'ProviderUnavailableError',
  errorMessage: 'The provider did not return a usable response.',
  stackExcerpt: {
    value: null,
    sha256: 'a'.repeat(64),
    originalLength: 384,
    redaction: 'sensitive',
    truncated: false,
  },
  providerPayload: {
    value: 'PROMPT_MARKER_NOT_FOR_DISPLAY PRIVATE_REASONING_MARKER_NOT_FOR_DISPLAY AUTH_HEADER_MARKER_NOT_FOR_DISPLAY COOKIE_MARKER_NOT_FOR_DISPLAY RAW_PROVIDER_TEXT_NOT_FOR_DISPLAY',
    sha256: 'b'.repeat(64),
    originalLength: 86,
    redaction: 'none',
    truncated: true,
  },
  correlation: {
    runId: 39,
    traceId: 'trace-39',
    observationId: 'observation-71',
    parentObservationId: 'parent-39',
  },
};

const completeFailureDiagnostic: DebugAnalysisRunDiagnostic = {
  ...baseDiagnostic,
  failure: completeFailure,
};

describe('DebugDiagnosticsView failure details', () => {
  it('renders bounded failure metadata and explicit redaction states', () => {
    const html = renderToStaticMarkup(<DebugDiagnosticsView diagnostic={completeFailureDiagnostic} />);

    expect(html).toContain('Failure details');
    expect(html).toContain('provider');
    expect(html).toContain('The provider did not return a usable response.');
    expect(html).toContain('ProviderUnavailableError');
    expect(html).toContain('Redacted');
    expect(html).toContain('Truncated');
    expect(html).toContain('trace-39');
    expect(html).toContain('observation-71');
    expect(html).toContain('parent-39');
    expect(html).not.toContain('PROMPT_MARKER_NOT_FOR_DISPLAY');
    expect(html).not.toContain('PRIVATE_REASONING_MARKER_NOT_FOR_DISPLAY');
    expect(html).not.toContain('AUTH_HEADER_MARKER_NOT_FOR_DISPLAY');
    expect(html).not.toContain('COOKIE_MARKER_NOT_FOR_DISPLAY');
    expect(html).not.toContain('RAW_PROVIDER_TEXT_NOT_FOR_DISPLAY');
  });

  it('renders Not recorded for absent bounded values without a failure-only placeholder', () => {
    const html = renderToStaticMarkup(
      <DebugDiagnosticsView
        diagnostic={{
          ...completeFailureDiagnostic,
          failure: {
            ...completeFailure,
            stackExcerpt: null,
            providerPayload: null,
          },
        }}
      />,
    );

    expect(html).toContain('Failure details');
    expect(html).toContain('Not recorded');
  });
});
