import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  db: { execute: vi.fn() },
}));

vi.mock('@/lib/db/index', () => ({ db: mocks.db }));
vi.mock('server-only', () => ({}));

import { rejectSearchReview } from './rejectSearchReview';

const input = {
  reviewId: 7,
  expectedRevision: 2,
  actorUserId: 'user_owner',
  reason: 'Evidence needs review; email ada@example.com must not be stored.',
};

beforeEach(() => mocks.db.execute.mockReset());

describe('rejectSearchReview', () => {
  it('rejects the current owned candidate and returns only the safe audit ID', async () => {
    mocks.db.execute.mockResolvedValue({ rows: [{ kind: 'rejected', rejectionAuditId: 101 }] });

    await expect(rejectSearchReview(input)).resolves.toEqual({ kind: 'rejected', auditId: 101 });

    const sqlText = JSON.stringify(mocks.db.execute.mock.calls[0]?.[0]);
    expect(sqlText).toContain('UPDATE search_candidate');
    expect(sqlText).toContain('search_candidate_audit');
    expect(sqlText).toContain('revision');
    expect(sqlText).not.toContain('UPDATE persona');
    expect(sqlText).not.toContain('INSERT INTO persona');
    expect(sqlText).not.toContain('company_persona_role');
    expect(sqlText).not.toContain('buyer_role');
  });

  it.each([
    ['not found', { kind: 'not_found' }],
    ['unauthorized', { kind: 'unauthorized' }],
    ['stale revision', { kind: 'stale_revision' }],
    ['terminal candidate', { kind: 'already_terminal' }],
  ])('returns a safe %s guard outcome', async (_label, row) => {
    mocks.db.execute.mockResolvedValue({ rows: [row] });

    await expect(rejectSearchReview(input)).resolves.toEqual(row);
  });

  it('redacts rejection reason before the single audit write', async () => {
    mocks.db.execute.mockResolvedValue({ rows: [{ kind: 'rejected', rejectionAuditId: 101 }] });

    await rejectSearchReview(input);

    const sqlText = JSON.stringify(mocks.db.execute.mock.calls[0]?.[0]);
    expect(sqlText).toContain('[REDACTED]');
    expect(sqlText).not.toContain('ada@example.com');
  });

  it('rejects malformed input without writing', async () => {
    await expect(rejectSearchReview({ ...input, expectedRevision: -1, unknown: true })).resolves.toEqual({
      kind: 'invalid_input',
    });
    expect(mocks.db.execute).not.toHaveBeenCalled();
  });

  it('maps persistence failures safely and performs no domain-record write', async () => {
    mocks.db.execute.mockRejectedValueOnce(new Error('database unavailable'));

    await expect(rejectSearchReview(input)).resolves.toEqual({ kind: 'persistence_failed' });
    expect(mocks.db.execute).toHaveBeenCalledTimes(1);
    const sqlText = JSON.stringify(mocks.db.execute.mock.calls[0]?.[0]);
    expect(sqlText).not.toContain('INSERT INTO persona');
    expect(sqlText).not.toContain('INSERT INTO company_persona_role');
  });
});
