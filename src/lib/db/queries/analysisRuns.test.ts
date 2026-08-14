import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTableConfig } from 'drizzle-orm/pg-core';

const mocks = vi.hoisted(() => ({
  db: { execute: vi.fn(), select: vi.fn(), insert: vi.fn() },
}));

vi.mock('../index', () => ({ db: mocks.db }));

import { buildAnalysisSnapshots } from '@/lib/analysis/snapshots';
import { analysisRun, analysisRunEvent } from '../schema';
import {
  ACTIVE_RUN_STATUSES,
  createAnalysisRun,
  getAnalysisRun,
  listAnalysisRunsForSubject,
  listAnalysisRunEvents,
  transitionAnalysisRun,
  type AnalysisRunEventRow,
  type AnalysisRunRow,
} from './analysisRuns';

function flattenSql(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'object') return String(value);

  const record = value as Record<string, unknown>;
  if ('queryChunks' in record && Array.isArray(record.queryChunks)) {
    return record.queryChunks.map(flattenSql).join('');
  }
  if ('name' in record) return String(record.name);
  if ('brand' in record || 'value' in record) return String(record.value);
  return '';
}

function selectRows(...rows: readonly unknown[]) {
  const where = vi.fn().mockResolvedValue(rows);
  mocks.db.select.mockReturnValue({ from: vi.fn().mockReturnValue({ where }) });
  return where;
}

function selectOrderedRows(...rows: readonly unknown[]) {
  const orderBy = vi.fn().mockResolvedValue(rows);
  const where = vi.fn().mockReturnValue({ orderBy });
  mocks.db.select.mockReturnValue({ from: vi.fn().mockReturnValue({ where }) });
  return orderBy;
}

function selectHistoryRows(...rows: readonly unknown[]) {
  const orderBy = vi.fn().mockResolvedValue(rows);
  const where = vi.fn().mockReturnValue({ orderBy });
  const secondJoin = vi.fn().mockReturnValue({ where });
  const firstJoin = vi.fn().mockReturnValue({ leftJoin: secondJoin });
  const from = vi.fn().mockReturnValue({ leftJoin: firstJoin });
  mocks.db.select.mockReturnValue({ from });
  return { where, orderBy };
}

function executeRows(...rows: readonly unknown[]) {
  mocks.db.execute.mockResolvedValue({ rows });
  return mocks.db.execute;
}

function executeRejects(error: unknown) {
  mocks.db.execute.mockRejectedValue(error);
  return mocks.db.execute;
}

const built = buildAnalysisSnapshots({
  template: {
    schemaVersion: 1,
    templateId: 1,
    templateVersionId: 11,
    templateKey: 'company-buying-signal-analysis',
    templateName: 'Company Buying Signal Analysis',
    targetType: 'company',
    version: 1,
    resolvedInstruction: 'Assess the selected company.',
    effort: 'standard',
  },
  subject: { type: 'company', id: 424242, displayName: 'Acme Corp' },
  checklist: {
    schemaVersion: 1,
    targetType: 'company',
    practiceAreaId: 9,
    practiceAreaName: 'GBS',
    items: [],
  },
  resolvedModelChain: ['phase32-noop'],
});

const runRow: AnalysisRunRow = {
  id: 7,
  templateId: built.templateId,
  templateVersionId: built.templateVersionId,
  subjectType: built.subjectType,
  subjectId: built.subjectId,
  practiceAreaId: built.practiceAreaId,
  status: 'queued',
  attempt: 0,
  maxAttempts: 2,
  createdBy: 'user_123',
  templateSnapshot: built.templateSnapshot,
  subjectSnapshot: built.subjectSnapshot,
  checklistSnapshot: built.checklistSnapshot,
  executionSnapshot: built.executionSnapshot,
  policySnapshot: built.policySnapshot,
  safeReason: null,
  startedAt: null,
  completedAt: null,
  terminalAt: null,
  createdAt: new Date('2026-08-07T12:00:00.000Z'),
  updatedAt: new Date('2026-08-07T12:00:00.000Z'),
};

const eventRow: AnalysisRunEventRow = {
  id: 1,
  analysisRunId: 7,
  eventKey: '7:queued:0',
  fromStatus: null,
  toStatus: 'queued',
  actorKind: 'staff',
  actorId: 'user_123',
  safeReason: null,
  attempt: 0,
  createdAt: new Date('2026-08-07T12:00:00.000Z'),
};

describe('analysis run ledger guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a queued run and its queued event in one atomic statement', async () => {
    const execute = executeRows({ runId: 7, eventId: 1 });
    selectRows(runRow);

    const result = await createAnalysisRun({
      templateId: built.templateId,
      templateVersionId: built.templateVersionId,
      subjectType: built.subjectType,
      subjectId: built.subjectId,
      practiceAreaId: built.practiceAreaId,
      createdBy: 'user_123',
      templateSnapshot: built.templateSnapshot,
      subjectSnapshot: built.subjectSnapshot,
      checklistSnapshot: built.checklistSnapshot,
      executionSnapshot: built.executionSnapshot,
      policySnapshot: built.policySnapshot,
    });

    expect(result).toEqual({ ok: true, run: runRow });
    expect(execute).toHaveBeenCalledTimes(1);
    const sqlText = flattenSql(execute.mock.calls[0]?.[0]);
    expect(sqlText).toContain('INSERT INTO analysis_run');
    expect(sqlText).toContain('INSERT INTO analysis_run_event');
    expect(sqlText).toContain("'queued'");
    expect(sqlText).toContain('staff');
    expect(mocks.db.insert).not.toHaveBeenCalled();
  });

  it('maps a direct SQLSTATE 23505 to active_run_exists without swallowing other errors', async () => {
    const directError = Object.assign(new Error('duplicate key value'), { code: '23505' });
    executeRejects(directError);
    expect(
      await createAnalysisRun({
        templateId: built.templateId,
        templateVersionId: built.templateVersionId,
        subjectType: built.subjectType,
        subjectId: built.subjectId,
        practiceAreaId: built.practiceAreaId,
        createdBy: 'user_123',
        templateSnapshot: built.templateSnapshot,
        subjectSnapshot: built.subjectSnapshot,
        checklistSnapshot: built.checklistSnapshot,
        executionSnapshot: built.executionSnapshot,
        policySnapshot: built.policySnapshot,
      }),
    ).toEqual({ ok: false, reason: 'active_run_exists' });

    vi.clearAllMocks();
    const nestedError = Object.assign(new Error('unique violation'), {
      cause: Object.assign(new Error('inner'), { code: '23505' }),
    });
    executeRejects(nestedError);
    expect(
      await createAnalysisRun({
        templateId: built.templateId,
        templateVersionId: built.templateVersionId,
        subjectType: built.subjectType,
        subjectId: built.subjectId,
        practiceAreaId: built.practiceAreaId,
        createdBy: 'user_123',
        templateSnapshot: built.templateSnapshot,
        subjectSnapshot: built.subjectSnapshot,
        checklistSnapshot: built.checklistSnapshot,
        executionSnapshot: built.executionSnapshot,
        policySnapshot: built.policySnapshot,
      }),
    ).toEqual({ ok: false, reason: 'active_run_exists' });

    vi.clearAllMocks();
    const unrelated = Object.assign(new Error('serialization failure'), { code: '40001' });
    executeRejects(unrelated);
    await expect(
      createAnalysisRun({
        templateId: built.templateId,
        templateVersionId: built.templateVersionId,
        subjectType: built.subjectType,
        subjectId: built.subjectId,
        practiceAreaId: built.practiceAreaId,
        createdBy: 'user_123',
        templateSnapshot: built.templateSnapshot,
        subjectSnapshot: built.subjectSnapshot,
        checklistSnapshot: built.checklistSnapshot,
        executionSnapshot: built.executionSnapshot,
        policySnapshot: built.policySnapshot,
      }),
    ).rejects.toMatchObject({ code: '40001' });
  });

  it('reads a single run and an undefined for a missing id', async () => {
    selectRows(runRow);
    expect(await getAnalysisRun(7)).toEqual(runRow);

    vi.clearAllMocks();
    selectRows();
    expect(await getAnalysisRun(999)).toBeUndefined();
  });

  it('lists every subject-scoped lifecycle row newest first without writing or reconciling', async () => {
    const dismissedRun: AnalysisRunRow = {
      ...runRow,
      id: 8,
      status: 'dismissed',
      subjectType: 'company',
      subjectId: 42,
      createdAt: new Date('2026-08-08T12:00:00.000Z'),
      updatedAt: new Date('2026-08-08T12:00:00.000Z'),
      safeReason: null,
    };
    const queuedRun: AnalysisRunRow = {
      ...runRow,
      id: 7,
      status: 'queued',
      subjectType: 'company',
      subjectId: 42,
    };
    const { where, orderBy } = selectHistoryRows(
      {
        run: dismissedRun,
        review: {
          decision: 'dismissed',
          decidedBy: 'user_staff',
          decidedAt: new Date('2026-08-08T12:01:00.000Z'),
        },
        result: { id: 19, packetHash: 'b'.repeat(64) },
      },
      { run: queuedRun, review: null, result: null },
    );

    const rows = await listAnalysisRunsForSubject({ targetType: 'company', subjectId: 42 });

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      runId: 8,
      status: 'dismissed',
      targetType: 'company',
      subjectId: 42,
      review: { decision: 'dismissed', decidedBy: 'user_staff' },
      packetProjection: { resultId: 19, packetHash: 'b'.repeat(64) },
    });
    expect(rows[1]).toMatchObject({ runId: 7, status: 'queued', review: null, packetProjection: null });
    expect(flattenSql(where.mock.calls[0]?.[0])).toContain('subject_type');
    expect(flattenSql(where.mock.calls[0]?.[0])).toContain('subject_id');
    expect(orderBy).toHaveBeenCalled();
    expect(mocks.db.execute).not.toHaveBeenCalled();
    expect(mocks.db.insert).not.toHaveBeenCalled();
  });

  it('orders event history deterministically by timestamp then id', async () => {
    const orderBy = selectOrderedRows(eventRow);
    await listAnalysisRunEvents(7);
    expect(orderBy).toHaveBeenCalledWith(analysisRunEvent.createdAt, analysisRunEvent.id);
    expect(mocks.db.select).toHaveBeenCalled();
  });

  it('wins a legal transition with exactly one event carrying actor, reason, and attempt', async () => {
    const runningEvent: AnalysisRunEventRow = {
      ...eventRow,
      eventKey: '7:queued->running:1',
      fromStatus: 'queued',
      toStatus: 'running',
      safeReason: null,
      attempt: 1,
    };
    const runningRow: AnalysisRunRow = { ...runRow, status: 'running', attempt: 1, updatedAt: new Date('2026-08-07T12:01:00.000Z') };
    const execute = executeRows(runningEvent);
    selectRows(runningRow);

    const result = await transitionAnalysisRun({
      runId: 7,
      expectedStatus: 'queued',
      toStatus: 'running',
      actorKind: 'workflow',
      actorId: 'workflow-executor',
      attempt: 1,
    });

    expect(result).toEqual({ ok: true, reason: 'transitioned', run: runningRow, event: runningEvent });
    expect(execute).toHaveBeenCalledTimes(1);
    const sqlText = flattenSql(execute.mock.calls[0]?.[0]);
    expect(sqlText).toContain('UPDATE analysis_run');
    expect(sqlText).toContain('INSERT INTO analysis_run_event');
    expect(sqlText).toContain('7:queued->running:1');
    expect(sqlText).toContain('running');
    expect(sqlText).toContain('workflow-executor');
    expect(mocks.db.insert).not.toHaveBeenCalled();
  });

  it('rejects an illegal transition pair before any SQL runs and appends nothing', async () => {
    const completedRow: AnalysisRunRow = { ...runRow, status: 'completed' };
    selectRows(completedRow);

    const result = await transitionAnalysisRun({
      runId: 7,
      expectedStatus: 'completed',
      toStatus: 'running',
      actorKind: 'staff',
      actorId: 'user_123',
      attempt: 1,
    });

    expect(result).toEqual({ ok: false, reason: 'invalid_transition', run: completedRow });
    expect(mocks.db.execute).not.toHaveBeenCalled();
    expect(mocks.db.insert).not.toHaveBeenCalled();
  });

  it('treats a replayed transition as a no-op and appends no history', async () => {
    const completedRow: AnalysisRunRow = { ...runRow, status: 'completed' };
    executeRows();
    selectRows(completedRow);

    const result = await transitionAnalysisRun({
      runId: 7,
      expectedStatus: 'running',
      toStatus: 'completed',
      actorKind: 'workflow',
      actorId: 'workflow-executor',
      safeReason: 'completed',
      attempt: 1,
    });

    expect(result).toEqual({ ok: false, reason: 'replayed', run: completedRow });
    expect(mocks.db.execute).toHaveBeenCalledTimes(1);
    expect(mocks.db.insert).not.toHaveBeenCalled();
  });

  it('cannot reset a terminal row and returns not_found for an unknown run', async () => {
    const failedRow: AnalysisRunRow = { ...runRow, status: 'failed', terminalAt: new Date('2026-08-07T12:02:00.000Z') };
    selectRows(failedRow);
    expect(
      await transitionAnalysisRun({
        runId: 7,
        expectedStatus: 'failed',
        toStatus: 'running',
        actorKind: 'staff',
        actorId: 'user_123',
        attempt: 1,
      }),
    ).toEqual({ ok: false, reason: 'invalid_transition', run: failedRow });
    expect(mocks.db.execute).not.toHaveBeenCalled();

    vi.clearAllMocks();
    executeRows();
    selectRows();
    expect(
      await transitionAnalysisRun({
        runId: 404,
        expectedStatus: 'queued',
        toStatus: 'running',
        actorKind: 'workflow',
        actorId: 'workflow-executor',
        attempt: 1,
      }),
    ).toEqual({ ok: false, reason: 'not_found', run: undefined });
    expect(mocks.db.insert).not.toHaveBeenCalled();
  });

  it('exposes the exact partial-index active status set to tests', () => {
    expect(ACTIVE_RUN_STATUSES).toEqual(['queued', 'running']);
  });

  it('keeps the active-run duplicate index keyed on (subject_type, subject_id, template_id)', () => {
    const config = getTableConfig(analysisRun);
    const activeIndex = config.indexes.find(
      (index) => (index as { config?: { name?: string } }).config?.name === 'analysis_run_active_subject_template_idx'
    );
    const indexConfig = (activeIndex as {
      config?: {
        name?: string;
        unique?: boolean;
        columns?: { name?: string }[];
        where?: { queryChunks?: { value?: unknown }[] };
      };
    }).config;

    expect(indexConfig?.name).toBe('analysis_run_active_subject_template_idx');
    expect(indexConfig?.unique).toBe(true);
    expect(indexConfig?.columns?.map((column) => column.name)).toEqual(['subject_type', 'subject_id', 'template_id']);
    const whereText = (indexConfig?.where?.queryChunks ?? [])
      .map((chunk) => {
        if (chunk === null || chunk === undefined) return '';
        if (typeof chunk === 'string') return chunk;
        if (typeof chunk !== 'object') return String(chunk);
        const record = chunk as Record<string, unknown>;
        if ('name' in record) return String(record.name);
        if ('value' in record) {
          const nested = record.value;
          if (typeof nested === 'string') return nested;
          if (nested !== null && typeof nested === 'object') {
            return Object.values(nested as Record<string, unknown>).map((item) => (typeof item === 'string' ? item : '')).join('');
          }
        }
        return '';
      })
      .join('');
    expect(whereText).toContain('status');
    expect(whereText).toContain("IN ('queued', 'running', 'pending_review')");
  });

  it('persists the exact future and no-op limits through the snapshot values', () => {
    expect(built.executionSnapshot.futureBudget).toEqual({
      maxAttempts: 2,
      maxToolCalls: 6,
      maxExecutionSeconds: 300,
      maxSpendUsd: 2.5,
    });
    expect(built.policySnapshot).toEqual({
      schemaVersion: 1,
      mode: 'phase32_noop',
      networkAccess: false,
      writesAllowed: false,
      effectiveMaxAttempts: 1,
      effectiveMaxToolCalls: 0,
      effectiveMaxExecutionSeconds: 5,
      effectiveMaxSpendUsd: 0,
    });
    expect(runRow.maxAttempts).toBe(2);
  });

  it('uses the analysis_run table for reads and never touches db.insert', async () => {
    const where = vi.fn().mockResolvedValue([runRow]);
    const from = vi.fn().mockReturnValue({ where });
    mocks.db.select.mockReturnValue({ from });
    await getAnalysisRun(7);
    expect(from).toHaveBeenCalledWith(analysisRun);
  });
});
