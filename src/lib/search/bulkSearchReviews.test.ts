import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  approveSearchReview: vi.fn(),
  rejectSearchReview: vi.fn(),
}));

vi.mock('./approveSearchReview', () => ({ approveSearchReview: mocks.approveSearchReview }));
vi.mock('./rejectSearchReview', () => ({ rejectSearchReview: mocks.rejectSearchReview }));
vi.mock('server-only', () => ({}));

import { bulkSearchReviews } from './bulkSearchReviews';

const approveInput = {
  reviewIds: [7, 3],
  action: 'approve',
  actorUserId: 'user_owner',
  revisions: { '7': 2, '3': 4 },
};

const rejectInput = {
  reviewIds: [7],
  action: 'reject',
  actorUserId: 'user_owner',
  revisions: { '7': 2 },
};

beforeEach(() => {
  mocks.approveSearchReview.mockReset();
  mocks.rejectSearchReview.mockReset();
});

describe('bulkSearchReviews', () => {
  it('approves eligible candidates independently in the submitted order', async () => {
    // Given
    mocks.approveSearchReview
      .mockResolvedValueOnce({ kind: 'approved', personaId: 31 })
      .mockResolvedValueOnce({ kind: 'approved', personaId: 32 });

    // When
    const result = await bulkSearchReviews(approveInput);

    // Then
    expect(result).toEqual({
      kind: 'completed',
      outcomes: [
        { reviewId: 7, outcome: 'approved' },
        { reviewId: 3, outcome: 'approved' },
      ],
      counts: { approved: 2, rejected: 0, skipped: 0, failed: 0 },
    });
    expect(mocks.approveSearchReview.mock.calls).toEqual([
      [{ reviewId: 7, expectedRevision: 2, actorUserId: 'user_owner' }],
      [{ reviewId: 3, expectedRevision: 4, actorUserId: 'user_owner' }],
    ]);
    expect(mocks.rejectSearchReview).not.toHaveBeenCalled();
  });

  it('dispatches rejection through the single-candidate operation', async () => {
    // Given
    mocks.rejectSearchReview.mockResolvedValue({ kind: 'rejected', auditId: 101 });

    // When
    const result = await bulkSearchReviews(rejectInput);

    // Then
    expect(result).toMatchObject({
      kind: 'completed',
      outcomes: [{ reviewId: 7, outcome: 'rejected' }],
      counts: { approved: 0, rejected: 1, skipped: 0, failed: 0 },
    });
    expect(mocks.rejectSearchReview).toHaveBeenCalledWith({ reviewId: 7, expectedRevision: 2, actorUserId: 'user_owner' });
    expect(mocks.approveSearchReview).not.toHaveBeenCalled();
  });

  it.each([
    ['ambiguous match', { kind: 'ambiguous_match' }, { outcome: 'skipped', reason: 'ineligible' }],
    ['inconclusive evidence', { kind: 'inconclusive' }, { outcome: 'skipped', reason: 'ineligible' }],
    ['terminal candidate', { kind: 'already_terminal' }, { outcome: 'skipped', reason: 'already_terminal' }],
    ['stale revision', { kind: 'stale_revision' }, { outcome: 'skipped', reason: 'stale_revision' }],
    ['missing candidate', { kind: 'not_found' }, { outcome: 'skipped', reason: 'not_found' }],
    ['unauthorized candidate', { kind: 'unauthorized' }, { outcome: 'skipped', reason: 'not_found' }],
    ['approval conflict', { kind: 'conflict' }, { outcome: 'failed', reason: 'conflict' }],
    ['persistence failure', { kind: 'persistence_failed' }, { outcome: 'failed', reason: 'failed' }],
  ] as const)('maps %s to a safe bounded outcome', async (_label, singleResult, expected) => {
    // Given
    mocks.approveSearchReview.mockResolvedValue(singleResult);

    // When
    const result = await bulkSearchReviews({ ...approveInput, reviewIds: [7], revisions: { '7': 2 } });

    // Then
    expect(result).toEqual({
      kind: 'completed',
      outcomes: [{ reviewId: 7, ...expected }],
      counts: {
        approved: 0,
        rejected: 0,
        skipped: expected.outcome === 'skipped' ? 1 : 0,
        failed: expected.outcome === 'failed' ? 1 : 0,
      },
    });
  });

  it('retains partial success and continues after an individual failure', async () => {
    // Given
    mocks.approveSearchReview
      .mockResolvedValueOnce({ kind: 'approved', personaId: 31 })
      .mockRejectedValueOnce(new Error('database secret: raw details'))
      .mockResolvedValueOnce({ kind: 'approved', personaId: 33 });

    // When
    const result = await bulkSearchReviews({
      ...approveInput,
      reviewIds: [7, 3, 9],
      revisions: { '7': 2, '3': 4, '9': 1 },
    });

    // Then
    expect(result).toEqual({
      kind: 'completed',
      outcomes: [
        { reviewId: 7, outcome: 'approved' },
        { reviewId: 3, outcome: 'failed', reason: 'failed' },
        { reviewId: 9, outcome: 'approved' },
      ],
      counts: { approved: 2, rejected: 0, skipped: 0, failed: 1 },
    });
    expect(mocks.approveSearchReview).toHaveBeenCalledTimes(3);
    expect(JSON.stringify(result)).not.toContain('database secret');
  });

  it('deduplicates IDs while preserving first-seen order and revisions', async () => {
    // Given
    mocks.approveSearchReview.mockResolvedValue({ kind: 'approved', personaId: 31 });

    // When
    const result = await bulkSearchReviews({
      ...approveInput,
      reviewIds: [9, 7, 9, 3, 7],
      revisions: { '9': 1, '7': 2, '3': 4 },
    });

    // Then
    expect(result.kind).toBe('completed');
    if (result.kind !== 'completed') throw new TypeError('bulk result should be completed');
    expect(result.outcomes.map(({ reviewId }) => reviewId)).toEqual([9, 7, 3]);
    expect(mocks.approveSearchReview.mock.calls.map(([input]) => input)).toEqual([
      { reviewId: 9, expectedRevision: 1, actorUserId: 'user_owner' },
      { reviewId: 7, expectedRevision: 2, actorUserId: 'user_owner' },
      { reviewId: 3, expectedRevision: 4, actorUserId: 'user_owner' },
    ]);
  });

  it('rejects empty, oversized, incomplete, and unknown bulk input before dispatch', async () => {
    // Given
    const oversizedIds = Array.from({ length: 51 }, (_value, index) => index + 1);
    const invalidInputs = [
      { ...approveInput, reviewIds: [], revisions: {} },
      { ...approveInput, reviewIds: oversizedIds, revisions: Object.fromEntries(oversizedIds.map((id) => [id, 1])) },
      { ...approveInput, reviewIds: [7], revisions: {} },
      { ...approveInput, reviewIds: [7], revisions: { '7': 2, '8': 1 } },
      { ...approveInput, actorUserId: '   ' },
      { ...approveInput, action: 'delete' },
      { ...approveInput, extra: 'blocked' },
    ];

    // When
    const results = await Promise.all(invalidInputs.map((input) => bulkSearchReviews(input)));

    // Then
    expect(results).toEqual(invalidInputs.map(() => ({ kind: 'invalid_input' })));
    expect(mocks.approveSearchReview).not.toHaveBeenCalled();
    expect(mocks.rejectSearchReview).not.toHaveBeenCalled();
  });
});
