import { beforeEach, describe, expect, it, vi } from 'vitest';

const fakeDb = vi.hoisted(() => ({ rowsByTable: new Map<unknown, unknown[]>(), selected: [] as unknown[] }));

vi.mock('server-only', () => ({}));
vi.mock('../index', () => ({
  db: {
    select: () => ({
      from: (table: unknown) => {
        fakeDb.selected.push(table);
        const result = Promise.resolve(fakeDb.rowsByTable.get(table) ?? []);
        const chain: Record<string, unknown> = {
          where: () => chain,
          orderBy: () => chain,
          limit: () => result,
          then: result.then.bind(result),
        };
        return chain;
      },
    }),
  },
}));

import { analysisRun, analysisRunEvent, searchRun } from '../schema';
import { listJobLogs, outcomeForStatus } from './jobLogs';

const at = (iso: string) => new Date(iso);

function analysisRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 53,
    executionTarget: 'internal',
    status: 'failed',
    safeReason: 'execution_failed',
    createdBy: 'user_me',
    initiatingUserId: null,
    subjectType: 'company',
    subjectId: 117,
    subjectSnapshot: { displayName: 'Cinkarna Celje' },
    templateSnapshot: { templateName: 'Company Buying Signal Analysis' },
    createdAt: at('2026-08-14T19:45:21Z'),
    startedAt: at('2026-08-14T19:45:25Z'),
    completedAt: null,
    terminalAt: at('2026-08-14T19:46:10Z'),
    arcAgentnetLocalStatus: null,
    arcAgentnetSafeReason: null,
    arcAgentnetStartedAt: null,
    arcAgentnetCompletedAt: null,
    arcAgentnetTerminalAt: null,
    ...overrides,
  };
}

const searchRow = {
  id: 26,
  companyId: 198,
  status: 'succeeded',
  initiatingUserId: 'user_other',
  companySnapshot: { id: 198, name: 'SAS (Scandinavian Airlines)', domain: 'sasgroup.net' },
  templateSnapshot: { name: 'Company Buying Signal Search' },
  terminalResultSummary: { schemaVersion: 1, candidateCount: 6, sourceCount: 12, inconclusiveCount: 0, normalizedCandidateCount: 6 },
  createdAt: at('2026-10-01T22:09:17Z'),
  startedAt: at('2026-10-01T22:09:22Z'),
  completedAt: at('2026-10-01T22:33:02Z'),
  terminalAt: at('2026-10-01T22:33:02Z'),
};

beforeEach(() => {
  fakeDb.rowsByTable.clear();
  fakeDb.selected.length = 0;
});

describe('outcomeForStatus', () => {
  it.each([
    ['queued', 'active'], ['running', 'active'],
    ['failed', 'failed'], ['cancelled', 'failed'],
    ['completed', 'success'], ['succeeded', 'success'], ['pending_review', 'success'], ['confirmed', 'success'], ['dismissed', 'success'],
  ] as const)('%s is %s', (status, outcome) => {
    expect(outcomeForStatus(status)).toBe(outcome);
  });
});

describe('listJobLogs', () => {
  it('merges Analyze and Search runs newest first with outcome, reason, duration and owner', async () => {
    fakeDb.rowsByTable.set(analysisRun, [analysisRow()]);
    fakeDb.rowsByTable.set(searchRun, [searchRow]);
    fakeDb.rowsByTable.set(analysisRunEvent, [
      { analysisRunId: 53, fromStatus: null, toStatus: 'queued', safeReason: null, createdAt: at('2026-08-14T19:45:21Z') },
      { analysisRunId: 53, fromStatus: 'running', toStatus: 'failed', safeReason: 'execution_failed', createdAt: at('2026-08-14T19:46:10Z') },
    ]);

    const rows = await listJobLogs('user_me');

    expect(rows.map((row) => row.key)).toEqual(['search-26', 'analyze-53']);
    expect(rows[0]).toMatchObject({
      kind: 'search', subjectName: 'SAS (Scandinavian Airlines)', status: 'succeeded', outcome: 'success',
      owner: 'teammate', summary: '6 candidates · 12 sources', durationSeconds: 1420,
    });
    expect(rows[1]).toMatchObject({
      kind: 'analyze', executor: 'internal', status: 'failed', outcome: 'failed', reason: 'execution_failed',
      owner: 'you', durationSeconds: 45,
    });
    expect(rows[1]?.events).toEqual([
      { at: '2026-08-14T19:45:21.000Z', label: 'created → queued' },
      { at: '2026-08-14T19:46:10.000Z', label: 'running → failed (execution_failed)' },
    ]);
  });

  it('uses the partner lifecycle for Arc Agent Net runs and synthesizes their timeline', async () => {
    fakeDb.rowsByTable.set(analysisRun, [analysisRow({
      id: 83, executionTarget: 'arc-agentnet', status: 'running', safeReason: null, createdBy: 'user_x', initiatingUserId: 'user_me',
      arcAgentnetLocalStatus: 'completed', arcAgentnetSafeReason: 'completed',
      arcAgentnetStartedAt: at('2026-10-02T10:47:41Z'), arcAgentnetTerminalAt: at('2026-10-02T11:27:46Z'),
      createdAt: at('2026-10-02T10:47:30Z'), startedAt: null, terminalAt: null,
    })]);

    const [row] = await listJobLogs('user_me');

    expect(row).toMatchObject({ executor: 'arc-agentnet', status: 'completed', outcome: 'success', owner: 'you', durationSeconds: 2405 });
    expect(row?.events.map((event) => event.label)).toEqual(['created', 'started', 'completed']);
  });

  it('skips the event query when there are no Analyze runs and exposes no ids or payloads', async () => {
    fakeDb.rowsByTable.set(searchRun, [searchRow]);

    const rows = await listJobLogs('user_me');

    expect(fakeDb.selected).not.toContain(analysisRunEvent);
    expect(JSON.stringify(rows)).not.toMatch(/user_other|user_me|partner|idempotency/i);
  });

  it('caps the merged list at the limit', async () => {
    fakeDb.rowsByTable.set(analysisRun, [analysisRow({ id: 1 }), analysisRow({ id: 2, createdAt: at('2026-08-15T00:00:00Z') })]);
    fakeDb.rowsByTable.set(searchRun, [searchRow]);

    expect((await listJobLogs('user_me', 2)).map((row) => row.key)).toEqual(['search-26', 'analyze-2']);
  });
});
