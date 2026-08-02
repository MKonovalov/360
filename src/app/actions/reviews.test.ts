import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireStaffAccess: vi.fn().mockResolvedValue({ userId: 'user_123' }),
  acceptProposal: vi.fn(),
  getProposalById: vi.fn(),
  rejectProposal: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/auth/requireStaffAccess', () => ({
  requireStaffAccess: mocks.requireStaffAccess,
}));
vi.mock('@/lib/db/queries/proposals', () => ({
  acceptProposal: mocks.acceptProposal,
  getProposalById: mocks.getProposalById,
}));
vi.mock('@/lib/db/queries/corrections', () => ({
  rejectProposal: mocks.rejectProposal,
}));

import { revalidatePath } from 'next/cache';
import { acceptProposalAction, rejectProposalAction } from './reviews';

describe('review actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.acceptProposal.mockResolvedValue({ ok: true });
    mocks.getProposalById.mockResolvedValue({ traceId: 'trace_abc123' });
    mocks.rejectProposal.mockResolvedValue({ ok: true });
  });

  it('accept calls requireStaffAccess first, then acceptProposal, and returns ok:true', async () => {
    // Given / When
    const result = await acceptProposalAction(7);

    // Then
    expect(result).toEqual({ ok: true });
    expect(mocks.acceptProposal).toHaveBeenCalledWith(7);
    expect(
      mocks.requireStaffAccess.mock.invocationCallOrder[0] <
        mocks.acceptProposal.mock.invocationCallOrder[0]
    ).toBe(true);
    expect(revalidatePath).toHaveBeenCalledWith('/reviews');
    expect(revalidatePath).toHaveBeenCalledWith('/companies');
  });

  it('accept surfaces already_resolved as a result, not a throw, and does not revalidate', async () => {
    // Given
    mocks.acceptProposal.mockResolvedValue({ ok: false, reason: 'already_resolved' });

    // When
    const result = await acceptProposalAction(7);

    // Then
    expect(result).toEqual({ ok: false, reason: 'already_resolved' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('accept surfaces duplicate_signal as a result, not a throw', async () => {
    // Given
    mocks.acceptProposal.mockResolvedValue({ ok: false, reason: 'duplicate_signal' });

    // When
    const result = await acceptProposalAction(7);

    // Then
    expect(result).toEqual({ ok: false, reason: 'duplicate_signal' });
  });

  it('accept maps an unexpected throw to action_failed (D-06 fail-loud envelope)', async () => {
    // Given
    mocks.acceptProposal.mockRejectedValue(new Error('db down'));

    // When
    const result = await acceptProposalAction(7);

    // Then
    expect(result).toEqual({ ok: false, reason: 'action_failed' });
  });

  it('reject with an invalid reason fails before any write', async () => {
    // Given / When
    const result = await rejectProposalAction(7, { reason: 'bogus_reason' });

    // Then
    expect(result).toEqual({ ok: false, reason: 'invalid_reason' });
    expect(mocks.getProposalById).not.toHaveBeenCalled();
    expect(mocks.rejectProposal).not.toHaveBeenCalled();
  });

  it('reject resolves traceId from the proposal run and revalidates', async () => {
    // Given
    mocks.getProposalById.mockResolvedValue({ traceId: 'trace_abc123' });

    // When
    const result = await rejectProposalAction(7, {
      reason: 'hallucinated_no_evidence',
      note: '  evidence link was dead  ',
    });

    // Then
    expect(result).toEqual({ ok: true });
    expect(mocks.getProposalById).toHaveBeenCalledWith(7);
    expect(mocks.rejectProposal).toHaveBeenCalledWith(7, {
      reason: 'hallucinated_no_evidence',
      note: 'evidence link was dead',
      traceId: 'trace_abc123',
    });
    expect(revalidatePath).toHaveBeenCalledWith('/reviews');
  });

  it('reject with a missing proposal fails loud with not_found', async () => {
    // Given
    mocks.getProposalById.mockResolvedValue(undefined);

    // When
    const result = await rejectProposalAction(7, { reason: 'other' });

    // Then
    expect(result).toEqual({ ok: false, reason: 'not_found' });
    expect(mocks.rejectProposal).not.toHaveBeenCalled();
  });

  it('reject with no run traceId fails loud with no_trace instead of fabricating one', async () => {
    // Given
    mocks.getProposalById.mockResolvedValue({ traceId: null });

    // When
    const result = await rejectProposalAction(7, { reason: 'other' });

    // Then
    expect(result).toEqual({ ok: false, reason: 'no_trace' });
    expect(mocks.rejectProposal).not.toHaveBeenCalled();
  });

  it('reject surfaces already_resolved as a result, not a throw', async () => {
    // Given
    mocks.rejectProposal.mockResolvedValue({ ok: false, reason: 'already_resolved' });

    // When
    const result = await rejectProposalAction(7, { reason: 'other' });

    // Then
    expect(result).toEqual({ ok: false, reason: 'already_resolved' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
