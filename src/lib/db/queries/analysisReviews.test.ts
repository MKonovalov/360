import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  db: { execute: vi.fn() },
}));

vi.mock('../index', () => ({ db: mocks.db }));

import {
  reconcileReviewResultSchema,
  reviewDecisionOutcomeSchema,
  reviewItemSchema,
} from '@/lib/analysis/reviewContracts';
import {
  decideAnalysisRun,
  getEffectiveReviewProjection,
  listRunReviewItems,
  reconcileCompletedRunForReview,
  transitionReviewDecision,
} from './analysisReviews';

function flattenSql(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'object') return String(value);
  const record = value as Record<string, unknown>;
  if ('queryChunks' in record && Array.isArray(record.queryChunks)) {
    return record.queryChunks.map(flattenSql).join('');
  }
  if ('brand' in record || 'value' in record) return String(record.value);
  return '';
}

function executeRows(...rows: readonly unknown[]) {
  mocks.db.execute.mockResolvedValue({ rows });
  return mocks.db.execute;
}

const PACKET_HASH = 'a'.repeat(64);
const ACTOR = 'user_2staff';

beforeEach(() => {
  mocks.db.execute.mockReset();
});

describe('reconcileCompletedRunForReview', () => {
  it('rejects a non-positive run id without touching the database', async () => {
    const result = await reconcileCompletedRunForReview({ runId: 0 });
    expect(result).toEqual({ ok: false, reason: 'invalid_input' });
    expect(mocks.db.execute).not.toHaveBeenCalled();
  });

  it('promotes a completed run with a visible packet exactly once and appends one lifecycle event', async () => {
    executeRows({
      status: 'completed',
      resultId: 7,
      packetHash: PACKET_HASH,
      hasReview: false,
      hasPacket: true,
      updated: true,
    });

    const result = await reconcileCompletedRunForReview({ runId: 1 });

    expect(result).toEqual({
      ok: true,
      runId: 1,
      resultId: 7,
      packetHash: PACKET_HASH,
      replayed: false,
    });
    expect(reconcileReviewResultSchema.parse(result)).toEqual(result);

    const sqlText = flattenSql(mocks.db.execute.mock.calls[0][0]);
    expect(sqlText).toContain('UPDATE analysis_run');
    expect(sqlText).toContain("'pending_review'");
    expect(sqlText).toContain('INSERT INTO analysis_run_event');
    expect(sqlText).toContain("'completed'");
    expect(sqlText).toContain("'system'");
    expect(sqlText).toContain('analysis-review-reconciler');
    expect(sqlText).toContain(':completed->pending_review:0');
  });

  it('replays an already-pending run without a second event', async () => {
    executeRows({
      status: 'pending_review',
      resultId: 7,
      packetHash: PACKET_HASH,
      hasReview: false,
      hasPacket: true,
      updated: false,
    });

    const result = await reconcileCompletedRunForReview({ runId: 1 });

    expect(result).toEqual({
      ok: true,
      runId: 1,
      resultId: 7,
      packetHash: PACKET_HASH,
      replayed: true,
    });
    expect(mocks.db.execute).toHaveBeenCalledTimes(1);
  });

  it('replays a decided run from the persisted review identity even when the packet is no longer visible', async () => {
    executeRows({
      status: 'confirmed',
      resultId: 7,
      packetHash: PACKET_HASH,
      hasReview: true,
      hasPacket: false,
      updated: false,
    });

    const result = await reconcileCompletedRunForReview({ runId: 1 });

    expect(result).toEqual({
      ok: true,
      runId: 1,
      resultId: 7,
      packetHash: PACKET_HASH,
      replayed: true,
    });
  });

  it('rejects a missing run as not_found', async () => {
    executeRows();
    const result = await reconcileCompletedRunForReview({ runId: 123456 });
    expect(result).toEqual({ ok: false, reason: 'not_found' });
  });

  it('rejects non-completed statuses as not_completed before any packet check', async () => {
    executeRows({
      status: 'failed',
      resultId: null,
      packetHash: null,
      hasReview: false,
      hasPacket: false,
      updated: false,
    });

    const result = await reconcileCompletedRunForReview({ runId: 1 });

    expect(result).toEqual({ ok: false, reason: 'not_completed' });
  });

  it('rejects a completed run without a visible packet as missing_packet', async () => {
    executeRows({
      status: 'completed',
      resultId: null,
      packetHash: null,
      hasReview: false,
      hasPacket: false,
      updated: false,
    });

    const result = await reconcileCompletedRunForReview({ runId: 1 });

    expect(result).toEqual({ ok: false, reason: 'missing_packet' });
  });
});

describe('decideAnalysisRun', () => {
  it('rejects a non-positive run id without touching the database', async () => {
    const result = await decideAnalysisRun({ runId: 0, decision: 'confirmed' }, ACTOR);
    expect(result).toEqual({ ok: false, reason: 'invalid_input' });
    expect(mocks.db.execute).not.toHaveBeenCalled();
  });

  it('rejects a blank client actor id without touching the database', async () => {
    const result = await decideAnalysisRun({ runId: 1, decision: 'confirmed' }, '   ');
    expect(result).toEqual({ ok: false, reason: 'invalid_input' });
    expect(mocks.db.execute).not.toHaveBeenCalled();
  });

  it('decides a pending_review run atomically with one review row and one staff lifecycle event', async () => {
    const decidedAt = new Date('2026-08-08T10:00:00.000Z');
    executeRows({
      runId: 1,
      resultId: 7,
      decision: 'confirmed',
      decidedBy: ACTOR,
      decidedAt: decidedAt.toISOString(),
      packetHash: PACKET_HASH,
      decided: true,
      replayed: false,
      status: null,
      hasPacket: null,
    });

    const result = await decideAnalysisRun(
      { runId: 1, decision: 'confirmed' },
      ACTOR,
      { decidedAt },
    );

    expect(result).toEqual({
      ok: true,
      runId: 1,
      resultId: 7,
      decision: 'confirmed',
      decidedBy: ACTOR,
      decidedAt: '2026-08-08T10:00:00.000Z',
      packetHash: PACKET_HASH,
      replayed: false,
    });
    expect(reviewDecisionOutcomeSchema.parse(result)).toEqual(result);

    const sqlText = flattenSql(mocks.db.execute.mock.calls[0][0]);
    expect(sqlText).toContain('UPDATE analysis_run');
    expect(sqlText).toContain("'pending_review'");
    expect(sqlText).toContain('INSERT INTO analysis_run_review');
    expect(sqlText).toContain('ON CONFLICT (analysis_run_id) DO NOTHING');
    expect(sqlText).toContain('INSERT INTO analysis_run_event');
    expect(sqlText).toContain("'staff'");
    expect(sqlText).toContain(ACTOR);
    expect(sqlText).toContain("':pending_review->', confirmed::text, ':'");
    expect(sqlText).toContain('current_run.attempt');
  });

  it('returns the original winner with replayed true when the run was already decided', async () => {
    executeRows({
      runId: 1,
      resultId: 7,
      decision: 'confirmed',
      decidedBy: 'user_original',
      decidedAt: '2026-08-07T09:00:00.000Z',
      packetHash: PACKET_HASH,
      decided: true,
      replayed: true,
      status: null,
      hasPacket: null,
    });

    const result = await decideAnalysisRun(
      { runId: 1, decision: 'dismissed' },
      ACTOR,
    );

    expect(result).toEqual({
      ok: true,
      runId: 1,
      resultId: 7,
      decision: 'confirmed',
      decidedBy: 'user_original',
      decidedAt: '2026-08-07T09:00:00.000Z',
      packetHash: PACKET_HASH,
      replayed: true,
    });
    expect(reviewDecisionOutcomeSchema.parse(result)).toEqual(result);
  });

  it('classifies a missing run as not_found', async () => {
    executeRows();
    const result = await decideAnalysisRun({ runId: 9999, decision: 'confirmed' }, ACTOR);
    expect(result).toEqual({ ok: false, reason: 'not_found' });
  });

  it('classifies a run without a visible packet as missing_packet', async () => {
    executeRows({
      runId: null,
      resultId: null,
      decision: null,
      decidedBy: null,
      decidedAt: null,
      packetHash: null,
      decided: false,
      replayed: false,
      status: 'completed',
      hasPacket: false,
    });

    const result = await decideAnalysisRun({ runId: 1, decision: 'confirmed' }, ACTOR);

    expect(result).toEqual({ ok: false, reason: 'missing_packet' });
  });

  it('classifies a run that is not pending_review as not_pending_review', async () => {
    executeRows({
      runId: null,
      resultId: null,
      decision: null,
      decidedBy: null,
      decidedAt: null,
      packetHash: null,
      decided: false,
      replayed: false,
      status: 'failed',
      hasPacket: true,
    });

    const result = await decideAnalysisRun({ runId: 1, decision: 'confirmed' }, ACTOR);

    expect(result).toEqual({ ok: false, reason: 'not_pending_review' });
  });

  it('classifies an in-flight race without a visible winner as race_loser', async () => {
    executeRows({
      runId: null,
      resultId: null,
      decision: null,
      decidedBy: null,
      decidedAt: null,
      packetHash: null,
      decided: false,
      replayed: false,
      status: 'pending_review',
      hasPacket: true,
    });

    const result = await decideAnalysisRun({ runId: 1, decision: 'confirmed' }, ACTOR);

    expect(result).toEqual({ ok: false, reason: 'race_loser' });
  });
});

describe('listRunReviewItems', () => {
  it('reconciles completed runs first, then returns one normalized item per reviewable run', async () => {
    mocks.db.execute
      .mockResolvedValueOnce({ rows: [{ promoted: '2' }] })
      .mockResolvedValueOnce({
        rows: [
          {
            runId: 1,
            status: 'pending_review',
            targetType: 'company',
            subjectId: 100,
            subjectDisplayName: 'Acme Inc',
            templateName: 'Company Buying Signal Analysis',
            practiceAreaName: 'GBS',
            resultId: 7,
            packetHash: PACKET_HASH,
            findingCount: 0,
            sourceCount: 0,
            linkCount: 0,
            completedAt: '2026-08-07T12:00:00.000Z',
            decidedBy: null,
            decidedAt: null,
            decision: null,
          },
          {
            runId: 2,
            status: 'confirmed',
            targetType: 'company',
            subjectId: 101,
            subjectDisplayName: 'Beta Ltd',
            templateName: 'Company Buying Signal Analysis',
            practiceAreaName: 'GBS',
            resultId: 8,
            packetHash: 'b'.repeat(64),
            findingCount: 1,
            sourceCount: 1,
            linkCount: 1,
            completedAt: '2026-08-06T12:00:00.000Z',
            decidedBy: ACTOR,
            decidedAt: '2026-08-06T13:00:00.000Z',
            decision: 'confirmed',
          },
        ],
      });

    const items = await listRunReviewItems();

    expect(items).toHaveLength(2);
    expect(reviewItemSchema.parse(items[0])).toEqual(items[0]);
    expect(reviewItemSchema.parse(items[1])).toEqual(items[1]);
    expect(items[0].status).toBe('pending_review');
    expect(items[1].decision).toBe('confirmed');

    const reconcileSql = flattenSql(mocks.db.execute.mock.calls[0][0]);
    expect(reconcileSql).toContain('UPDATE analysis_run');
    expect(reconcileSql).toContain("'pending_review'");
    expect(reconcileSql).toContain('INSERT INTO analysis_run_event');
    expect(reconcileSql).toContain('analysis_result_retention');
    expect(reconcileSql).toContain('active_run.status IN');
    expect(reconcileSql).toContain('newer_completed.status =');

    const listSql = flattenSql(mocks.db.execute.mock.calls[1][0]);
    expect(listSql).toContain('FROM analysis_run');
    expect(listSql).toContain('JOIN analysis_run_result');
    expect(listSql).toContain('LEFT JOIN analysis_run_review');
    expect(listSql).toContain("IN ('pending_review', 'confirmed', 'dismissed')");
    expect(listSql).toContain("subject_snapshot->>'displayName'");
    expect(listSql).toContain("template_snapshot->>'templateName'");
    expect(listSql).toContain("checklist_snapshot->>'practiceAreaName'");
    expect(listSql).toContain('analysis_result_retention');
  });

  it('returns an empty list when no reviewable runs exist', async () => {
    mocks.db.execute
      .mockResolvedValueOnce({ rows: [{ promoted: '0' }] })
      .mockResolvedValueOnce({ rows: [] });

    const items = await listRunReviewItems();

    expect(items).toEqual([]);
  });
});

describe('transitionReviewDecision', () => {
  it('returns a corrected append-only event and includes the advisory lock and expected-event guard', async () => {
    const decidedAt = new Date('2026-08-08T11:00:00.000Z');
    executeRows({
      kind: 'corrected',
      eventId: 12,
      runId: 1,
      resultId: 7,
      sequence: 2,
      priorDecision: 'confirmed',
      decision: 'dismissed',
      expectedPriorEventId: 11,
      decidedBy: ACTOR,
      decidedAt: decidedAt.toISOString(),
      packetHash: PACKET_HASH,
    });

    const result = await transitionReviewDecision(
      { runId: 1, decision: 'dismissed', expectedPriorEventId: 11 },
      ACTOR,
      { decidedAt },
    );

    expect(result).toEqual({
      kind: 'corrected',
      event: {
        eventId: 12,
        runId: 1,
        resultId: 7,
        sequence: 2,
        priorDecision: 'confirmed',
        decision: 'dismissed',
        expectedPriorEventId: 11,
        decidedBy: ACTOR,
        decidedAt: decidedAt.toISOString(),
        packetHash: PACKET_HASH,
      },
    });

    const sqlText = flattenSql(mocks.db.execute.mock.calls[0][0]);
    expect(sqlText).toContain('pg_advisory_xact_lock');
    expect(sqlText).toContain("concat('analysis-review:', 1::text)");
    expect(sqlText).toContain('replay');
    expect(sqlText).toContain('expected_prior_event_id');
    expect(sqlText).toContain('INSERT INTO analysis_run_review_event');
    expect(sqlText).toContain('ON CONFLICT (analysis_run_id) DO UPDATE');
  });

  it('replays the same transition without appending another event', async () => {
    executeRows({
      kind: 'replayed',
      runId: 1,
      resultId: 7,
      decision: 'confirmed',
      decidedBy: ACTOR,
      decidedAt: '2026-08-08T10:00:00.000Z',
      packetHash: PACKET_HASH,
      effectiveEventId: 11,
      effectiveSequence: 1,
    });

    const result = await transitionReviewDecision(
      { runId: 1, decision: 'confirmed', expectedPriorEventId: 0 },
      ACTOR,
    );

    expect(result.kind).toBe('replayed');
    expect(mocks.db.execute).toHaveBeenCalledTimes(1);
    expect(flattenSql(mocks.db.execute.mock.calls[0][0])).toContain('replay');
  });

  it('returns a reloadable conflict without writing when the expected event is stale', async () => {
    executeRows({
      kind: 'conflict',
      runId: 1,
      resultId: 7,
      decision: 'confirmed',
      decidedBy: 'user_first',
      decidedAt: '2026-08-08T10:00:00.000Z',
      packetHash: PACKET_HASH,
      effectiveEventId: 11,
      effectiveSequence: 1,
      expectedPriorEventId: 3,
    });

    const result = await transitionReviewDecision(
      { runId: 1, decision: 'dismissed', expectedPriorEventId: 3 },
      ACTOR,
    );

    expect(result).toEqual({
      kind: 'conflict',
      projection: {
        runId: 1,
        resultId: 7,
        decision: 'confirmed',
        decidedBy: 'user_first',
        decidedAt: '2026-08-08T10:00:00.000Z',
        packetHash: PACKET_HASH,
        effectiveEventId: 11,
        effectiveSequence: 1,
      },
      expectedPriorEventId: 3,
    });
    expect(flattenSql(mocks.db.execute.mock.calls[0][0])).toContain('NOT EXISTS (SELECT 1 FROM inserted_event)');
  });

  it('rejects ineligible runs without attempting an insert', async () => {
    executeRows({ kind: 'not_eligible', reason: 'not_pending_review' });
    const result = await transitionReviewDecision(
      { runId: 1, decision: 'confirmed', expectedPriorEventId: 0 },
      ACTOR,
    );
    expect(result).toEqual({ kind: 'not_eligible', reason: 'not_pending_review' });
    expect(flattenSql(mocks.db.execute.mock.calls[0][0])).toContain('status');
  });
});

describe('getEffectiveReviewProjection', () => {
  it('reads the effective projection rather than reconstructing it from audit events', async () => {
    executeRows({
      runId: 1,
      resultId: 7,
      decision: 'dismissed',
      decidedBy: ACTOR,
      decidedAt: '2026-08-08T11:00:00.000Z',
      packetHash: PACKET_HASH,
      effectiveEventId: 12,
      effectiveSequence: 2,
    });
    const result = await getEffectiveReviewProjection(1);
    expect(result?.effectiveEventId).toBe(12);
    expect(flattenSql(mocks.db.execute.mock.calls[0][0])).toContain('FROM analysis_run_review');
    expect(flattenSql(mocks.db.execute.mock.calls[0][0])).not.toContain('analysis_run_review_event AS event');
  });
});
