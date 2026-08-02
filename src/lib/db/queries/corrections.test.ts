import { beforeEach, describe, expect, it, vi } from 'vitest';

// 09-02-03 anchor: rejectProposal captures a structured correction (reason
// enum + traceId + optional note, OBSV-02) and mirrors it to Langfuse (D-14).
// Pure unit with stubbed drizzle client + mocked langfuse mirror — no live
// DB, no live Langfuse (D-16).
const mocks = vi.hoisted(() => ({
  db: { insert: vi.fn(), select: vi.fn(), update: vi.fn() },
  mirrorCorrectionAnnotation: vi.fn(),
}));

vi.mock('../index', () => ({ db: mocks.db }));
vi.mock('@/lib/telemetry/langfuse', () => ({
  mirrorCorrectionAnnotation: mocks.mirrorCorrectionAnnotation,
}));

import { rejectProposal, getCorrectionsForProposal } from './corrections';
import { correction, signalProposal } from '../schema';

function updateChain(returningResolved: unknown) {
  const returning = vi.fn().mockResolvedValue(returningResolved);
  const where = vi.fn().mockReturnValue({ returning });
  return { set: vi.fn().mockReturnValue({ where }) };
}

function insertChain(returningResolved: unknown) {
  const returning = vi.fn().mockResolvedValue(returningResolved);
  return { values: vi.fn().mockReturnValue({ returning }) };
}

describe('corrections query module (09-02-03)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mirrorCorrectionAnnotation.mockResolvedValue(undefined);
  });

  it('rejects a pending proposal: marks it rejected and inserts a correction row with reason enum + traceId + note', async () => {
    mocks.db.update.mockReturnValue(
      updateChain([{ id: 3 }]),
    );
    const insert = insertChain([{ id: 7 }]);
    mocks.db.insert.mockReturnValue(insert);

    const result = await rejectProposal(3, {
      reason: 'wrong_signal_type',
      note: 'Actually a transformation signal, not cost pressure',
      traceId: 'trace_123',
    });

    expect(result).toEqual({ ok: true });
    expect(mocks.db.update).toHaveBeenCalledWith(signalProposal);
    expect(mocks.db.insert).toHaveBeenCalledWith(correction);
    expect(insert.values).toHaveBeenCalledWith({
      proposalId: 3,
      reason: 'wrong_signal_type',
      note: 'Actually a transformation signal, not cost pressure',
      traceId: 'trace_123',
    });
  });

  it('mirrors the correction as a Langfuse annotation on the run trace (D-14)', async () => {
    mocks.db.update.mockReturnValue(updateChain([{ id: 3 }]));
    mocks.db.insert.mockReturnValue(insertChain([{ id: 7 }]));

    await rejectProposal(3, {
      reason: 'hallucinated_no_evidence',
      note: 'No source supports this',
      traceId: 'trace_456',
    });

    expect(mocks.mirrorCorrectionAnnotation).toHaveBeenCalledTimes(1);
    expect(mocks.mirrorCorrectionAnnotation).toHaveBeenCalledWith('trace_456', {
      reason: 'hallucinated_no_evidence',
      note: 'No source supports this',
    });
  });

  it('rejects an invalid reason via zod BEFORE any write or mirror', async () => {
    const result = await rejectProposal(3, {
      reason: 'not_a_real_reason',
      traceId: 'trace_123',
    });

    expect(result).toEqual({ ok: false, reason: 'invalid_reason' });
    expect(mocks.db.update).not.toHaveBeenCalled();
    expect(mocks.db.insert).not.toHaveBeenCalled();
    expect(mocks.mirrorCorrectionAnnotation).not.toHaveBeenCalled();
  });

  it('is idempotent: a second reject on the same proposal writes nothing', async () => {
    mocks.db.update
      .mockReturnValueOnce(updateChain([{ id: 3 }]))
      .mockReturnValueOnce(updateChain([]));
    const insert = insertChain([{ id: 7 }]);
    mocks.db.insert.mockReturnValue(insert);

    const first = await rejectProposal(3, { reason: 'other', traceId: 'trace_123' });
    const second = await rejectProposal(3, { reason: 'other', traceId: 'trace_123' });

    expect(first).toEqual({ ok: true });
    expect(second).toEqual({ ok: false, reason: 'already_resolved' });
    expect(insert.values).toHaveBeenCalledTimes(1);
    expect(mocks.mirrorCorrectionAnnotation).toHaveBeenCalledTimes(1);
  });

  it('lists corrections for a proposal for future prompt/taxonomy tuning', async () => {
    const rows = [{ id: 7, proposalId: 3, reason: 'wrong_signal_type', traceId: 'trace_123' }];
    const where = vi.fn().mockResolvedValue(rows);
    const from = vi.fn().mockReturnValue({ where });
    mocks.db.select.mockReturnValue({ from });

    const result = await getCorrectionsForProposal(3);

    expect(result).toEqual(rows);
    expect(from).toHaveBeenCalledWith(correction);
    expect(where).toHaveBeenCalled();
  });
});
