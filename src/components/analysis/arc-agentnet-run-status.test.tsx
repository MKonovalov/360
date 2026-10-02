import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import type { ArcAgentnetRunHistoryRow } from '@/lib/db/queries/arcAgentnetRuns';

import { ArcAgentnetRunStatus } from './arc-agentnet-run-status';

const run: ArcAgentnetRunHistoryRow = {
  runId: 84,
  status: 'queued',
  safeReason: null,
  templateName: 'Company Buying Signal Analysis',
  practiceAreaName: 'GBS — Design, Build & Run',
  createdAt: '2026-10-02T13:26:59.882Z',
  completedAt: null,
  result: null,
};

describe('ArcAgentnetRunStatus', () => {
  it('shows an in-progress card for a queued or running partner run', () => {
    const html = renderToStaticMarkup(<ArcAgentnetRunStatus run={run} />);

    expect(html).toContain('Run #84');
    expect(html).toContain('Queued');
    expect(html).toContain('The analysis is in progress.');
    expect(html).not.toContain('could not be loaded');
  });

  it('polls the partner status route rather than the internal endpoint', async () => {
    const source = await import('node:fs').then((fs) => fs.readFileSync(new URL('./arc-agentnet-run-status.tsx', import.meta.url), 'utf8'));

    expect(source).toContain('pollArcAgentnetRun');
    expect(source).not.toContain('pollAnalysisRun');
  });
});
