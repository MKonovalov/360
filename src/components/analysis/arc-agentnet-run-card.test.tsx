import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { ArcAgentnetRunHistoryRow } from '@/lib/db/queries/arcAgentnetRuns';

import { ArcAgentnetRunCard } from './arc-agentnet-run-card';

function run(overrides: Partial<ArcAgentnetRunHistoryRow> = {}): ArcAgentnetRunHistoryRow {
  return {
    runId: 83,
    status: 'completed',
    safeReason: 'completed',
    templateName: 'Company Buying Signal Analysis',
    practiceAreaName: 'GBS — Design, Build & Run',
    createdAt: '2026-10-02T10:47:30.138Z',
    completedAt: '2026-10-02T11:27:46.106Z',
    result: {
      narrative: 'Group-level assessment.',
      findings: [
        { findingId: 'F-301', label: 'Fragmented delivery', status: 'supported', confidence: 'high', claim: 'Two distinct GBS families.', reasoning: 'Hard registry facts.', sources: [
          { sourceId: 'S01', title: 'GTC', publisher: 'MOL Group', sourceType: null, url: 'https://molgroup.info/gtc', supportRole: 'supports' },
          { sourceId: 'S02', title: 'No link source', publisher: null, sourceType: null, url: null, supportRole: null },
        ] },
        { findingId: 'F-298', label: 'No GBS/SSC exists', status: 'not_supported', confidence: null, claim: 'Falsified.', reasoning: null, sources: [] },
      ],
    },
    ...overrides,
  };
}

describe('ArcAgentnetRunCard', () => {
  it('shows findings with status, claim, reasoning and sources; links open safely', () => {
    const html = renderToStaticMarkup(<ArcAgentnetRunCard run={run()} />);

    expect(html).toContain('Run #83');
    expect(html).toContain('Fragmented delivery');
    expect(html).toContain('Two distinct GBS families.');
    expect(html).toContain('Hard registry facts.');
    expect(html).toContain('href="https://molgroup.info/gtc"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('No link source');
    expect(html).not.toContain('href="undefined"');
  });

  it('opens supported findings by default and leaves the rest collapsed', () => {
    const html = renderToStaticMarkup(<ArcAgentnetRunCard run={run()} />);

    expect(html.match(/<details open=""/g)).toHaveLength(1);
  });

  it('says so when a completed run has no displayable result', () => {
    const html = renderToStaticMarkup(<ArcAgentnetRunCard run={run({ result: null })} />);

    expect(html).toContain('could not be displayed');
  });

  it.each([
    ['failed', 'execution_failed', 'The analysis did not complete.'],
    ['failed', 'job_expired', 'expired before it could be retrieved'],
    ['cancelled', null, 'The analysis was cancelled.'],
  ] as const)('shows safe copy for a %s run (%s)', (status, safeReason, copy) => {
    const html = renderToStaticMarkup(<ArcAgentnetRunCard run={run({ status, safeReason, result: null })} />);

    expect(html).toContain(copy);
  });
});
