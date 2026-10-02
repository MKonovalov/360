import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { JobLogRow } from '@/lib/db/queries/jobLogs';

import { JobLogsPanel, filterJobLogs } from './job-logs-panel';

function row(overrides: Partial<JobLogRow> = {}): JobLogRow {
  return {
    key: 'analyze-53',
    kind: 'analyze',
    runId: 53,
    executor: 'internal',
    subjectType: 'company',
    subjectId: 117,
    subjectName: 'Cinkarna Celje',
    template: 'Company Buying Signal Analysis',
    status: 'failed',
    outcome: 'failed',
    reason: 'execution_failed',
    summary: null,
    owner: 'you',
    createdAt: '2026-08-14T19:45:21.000Z',
    startedAt: '2026-08-14T19:45:25.000Z',
    finishedAt: '2026-08-14T19:46:10.000Z',
    durationSeconds: 45,
    events: [
      { at: '2026-08-14T19:45:21.000Z', label: 'created → queued' },
      { at: '2026-08-14T19:46:10.000Z', label: 'running → failed (execution_failed)' },
    ],
    ...overrides,
  };
}

const rows = [
  row(),
  row({ key: 'search-26', kind: 'search', runId: 26, executor: 'search', subjectId: 198, subjectName: 'SAS (Scandinavian Airlines)', template: 'Company Buying Signal Search', status: 'succeeded', outcome: 'success', reason: null, summary: '6 candidates · 12 sources' }),
  row({ key: 'analyze-83', runId: 83, executor: 'arc-agentnet', subjectId: 121, subjectName: 'MOL Group', status: 'running', outcome: 'active', reason: null, finishedAt: null, durationSeconds: null }),
];

describe('JobLogsPanel', () => {
  it('lists Analyze and Search jobs with status, subject, timing and an event timeline', () => {
    const html = renderToStaticMarkup(<JobLogsPanel rows={rows} limit={200} />);

    expect(html).toContain('Job logs');
    expect(html).toContain('3 of 3 jobs');
    expect(html).toContain('#53');
    expect(html).toContain('Cinkarna Celje');
    expect(html).toContain('SAS (Scandinavian Airlines)');
    expect(html).toContain('2026-08-14 19:45 UTC');
    expect(html).toContain('running → failed (execution_failed)');
    expect(html).toContain('Execution Failed');
    expect(html).toContain('6 candidates · 12 sources');
    expect(html).toContain('href="/companies/117?tab=analysis"');
    expect(html).toContain('45s');
  });

  it('never renders partner identifiers or user ids', () => {
    const html = renderToStaticMarkup(<JobLogsPanel rows={rows} limit={200} />);

    expect(html).not.toMatch(/partner|request_id|user_[A-Za-z0-9]{6,}/i);
  });

  it('shows an empty state when there are no jobs', () => {
    expect(renderToStaticMarkup(<JobLogsPanel rows={[]} limit={200} />)).toContain('No jobs match');
  });
});

describe('filterJobLogs', () => {
  const none = { kind: 'all', outcome: 'all', query: '' } as const;

  it('filters by job type and status group', () => {
    expect(filterJobLogs(rows, { ...none, kind: 'search' }).map((r) => r.key)).toEqual(['search-26']);
    expect(filterJobLogs(rows, { ...none, outcome: 'failed' }).map((r) => r.key)).toEqual(['analyze-53']);
    expect(filterJobLogs(rows, { ...none, outcome: 'active' }).map((r) => r.key)).toEqual(['analyze-83']);
  });

  it('searches company, template, run number and status case-insensitively', () => {
    expect(filterJobLogs(rows, { ...none, query: 'sas' }).map((r) => r.key)).toEqual(['search-26']);
    expect(filterJobLogs(rows, { ...none, query: ' #53'.trim().replace('#', '') }).map((r) => r.key)).toEqual(['analyze-53']);
    expect(filterJobLogs(rows, { ...none, query: 'RUNNING' }).map((r) => r.key)).toEqual(['analyze-83']);
  });
});
