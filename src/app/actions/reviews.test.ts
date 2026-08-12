import { readFileSync } from 'node:fs';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireStaffAccess: vi.fn().mockResolvedValue({ userId: 'user_123' }),
  acceptProposal: vi.fn(),
  getProposalById: vi.fn(),
  rejectProposal: vi.fn(),
  getEffectiveReviewProjection: vi.fn(),
  transitionReviewDecision: vi.fn(),
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
vi.mock('@/lib/db/queries/analysisReviews', () => ({
  getEffectiveReviewProjection: mocks.getEffectiveReviewProjection,
  transitionReviewDecision: mocks.transitionReviewDecision,
}));

import { revalidatePath } from 'next/cache';
import { acceptProposalAction, dismissRunAction, confirmRunAction, rejectProposalAction } from './reviews';

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

const PACKET_HASH = 'a'.repeat(64);

const decidedOutcome = (overrides: Record<string, unknown> = {}) => ({
  ok: true as const,
  runId: 7,
  resultId: 10,
  decision: 'confirmed' as const,
  decidedBy: 'user_123',
  decidedAt: '2026-08-08T00:00:00.000Z',
  packetHash: PACKET_HASH,
  replayed: false,
  ...overrides,
});

describe('whole-run review actions (v1.7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getEffectiveReviewProjection.mockResolvedValue(undefined);
    mocks.transitionReviewDecision.mockResolvedValue({
      kind: 'corrected',
      event: {
        eventId: 12,
        runId: 7,
        resultId: 10,
        sequence: 1,
        priorDecision: null,
        decision: 'confirmed',
        expectedPriorEventId: 0,
        decidedBy: 'user_123',
        decidedAt: '2026-08-08T00:00:00.000Z',
        packetHash: PACKET_HASH,
      },
    });
  });

  it('confirms a run: staff gate first, server-derived actor only, decision query only, and revalidates /reviews', async () => {
    // Given / When
    const result = await confirmRunAction({ runId: 7, decision: 'confirmed' });

    // Then
    expect(result).toEqual(decidedOutcome());
    // actor identity is the Clerk userId returned by requireStaffAccess — the
    // browser supplies runId + decision only (T-34-09, D-34-02).
    expect(mocks.transitionReviewDecision).toHaveBeenCalledWith(
      { runId: 7, decision: 'confirmed', expectedPriorEventId: 0 },
      'user_123',
    );
    expect(
      mocks.requireStaffAccess.mock.invocationCallOrder[0] <
        mocks.transitionReviewDecision.mock.invocationCallOrder[0]
    ).toBe(true);
    expect(revalidatePath).toHaveBeenCalledWith('/reviews');
  });

  it('rejects when staff access fails, before validation or any DB call', async () => {
    // Given — an unauthenticated caller: requireStaffAccess redirects (throws).
    mocks.requireStaffAccess.mockRejectedValueOnce(new Error('NEXT_REDIRECT: /sign-in'));

    // When / Then
    await expect(confirmRunAction({ runId: 7, decision: 'confirmed' })).rejects.toThrow();
    expect(mocks.transitionReviewDecision).not.toHaveBeenCalled();
  });

  it('rejects a non-positive run id before any DB call', async () => {
    // When
    const result = await confirmRunAction({ runId: 0, decision: 'confirmed' });

    // Then
    expect(result).toEqual({ ok: false, reason: 'invalid_input' });
    expect(mocks.transitionReviewDecision).not.toHaveBeenCalled();
  });

  it('rejects a non-closed decision before any DB call', async () => {
    // When
    const result = await confirmRunAction({ runId: 7, decision: 'maybe' });

    // Then
    expect(result).toEqual({ ok: false, reason: 'invalid_input' });
    expect(mocks.transitionReviewDecision).not.toHaveBeenCalled();
  });

  it('never lets the confirm action carry a dismissed decision to the query', async () => {
    // When — the browser forges the decision on the confirm endpoint.
    const result = await confirmRunAction({ runId: 7, decision: 'dismissed' });

    // Then
    expect(result).toEqual({ ok: false, reason: 'invalid_input' });
    expect(mocks.transitionReviewDecision).not.toHaveBeenCalled();
  });

  it('never accepts actor, packet, or timestamp fields from the browser', async () => {
    // When — a forged payload attempts to supply server-result fields (T-34-02).
    const result = await confirmRunAction({
      runId: 7,
      decision: 'confirmed',
      actorId: 'user_evil',
      decidedBy: 'user_evil',
      packetHash: 'b'.repeat(64),
      decidedAt: '2020-01-01T00:00:00.000Z',
    });

    // Then — the strict input schema rejects the extra keys before the query.
    expect(result).toEqual({ ok: false, reason: 'invalid_input' });
    expect(mocks.transitionReviewDecision).not.toHaveBeenCalled();
  });

  it('replays the persisted original winner on a retry and revalidates', async () => {
    // Given — a retry/competing attempt returns the stored decision.
    mocks.transitionReviewDecision.mockResolvedValue({
      kind: 'replayed',
      projection: {
        runId: 7,
        resultId: 10,
        decision: 'confirmed',
        decidedBy: 'user_first',
        decidedAt: '2026-08-08T00:00:00.000Z',
        packetHash: PACKET_HASH,
        effectiveEventId: 12,
        effectiveSequence: 1,
      },
    });

    // When
    const result = await confirmRunAction({ runId: 7, decision: 'confirmed' });

    // Then — the original actor is preserved; the loser is never reported as a win.
    expect(result).toEqual(
      decidedOutcome({ decidedBy: 'user_first', replayed: true }),
    );
    expect(revalidatePath).toHaveBeenCalledWith('/reviews');
  });

  it('maps race_loser without claiming the loser won and does not revalidate', async () => {
    // Given
    mocks.transitionReviewDecision.mockResolvedValue({ kind: 'conflict', projection: {
      runId: 7, resultId: 10, decision: 'confirmed', decidedBy: 'user_first',
      decidedAt: '2026-08-08T00:00:00.000Z', packetHash: PACKET_HASH,
      effectiveEventId: 12, effectiveSequence: 1,
    }, expectedPriorEventId: 0 });

    // When
    const result = await dismissRunAction({ runId: 7, decision: 'dismissed' });

    // Then
    expect(result).toEqual({ ok: false, reason: 'race_loser' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('surfaces the remaining safe failure reasons without revalidating', async () => {
    // Given
    for (const reason of ['missing_packet', 'not_pending_review', 'not_found']) {
      mocks.transitionReviewDecision.mockResolvedValueOnce({ kind: 'not_eligible', reason });

      // When / Then
      const result = await confirmRunAction({ runId: 7, decision: 'confirmed' });
      expect(result).toEqual({ ok: false, reason });
    }
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('lets an unexpected query throw propagate so the client surfaces a retryable failure', async () => {
    // Given — a transient DB error is not a forged closed reason.
    mocks.getEffectiveReviewProjection.mockRejectedValue(new Error('db down'));

    // When / Then
    await expect(confirmRunAction({ runId: 7, decision: 'confirmed' })).rejects.toThrow('db down');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('dismisses a run through the same staff-gated, server-actored path', async () => {
    // Given
    mocks.transitionReviewDecision.mockResolvedValue({
      kind: 'corrected',
      event: {
        eventId: 12, runId: 7, resultId: 10, sequence: 1, priorDecision: null,
        decision: 'dismissed', expectedPriorEventId: 0, decidedBy: 'user_123',
        decidedAt: '2026-08-08T00:00:00.000Z', packetHash: PACKET_HASH,
      },
    });

    // When
    const result = await dismissRunAction({ runId: 7, decision: 'dismissed' });

    // Then
    expect(result).toEqual(decidedOutcome({ decision: 'dismissed', replayed: false }));
    expect(mocks.transitionReviewDecision).toHaveBeenCalledWith(
      { runId: 7, decision: 'dismissed', expectedPriorEventId: 0 },
      'user_123',
    );
    expect(revalidatePath).toHaveBeenCalledWith('/reviews');
  });

  it('uses the server projection as the expected event for an append-only correction', async () => {
    mocks.getEffectiveReviewProjection.mockResolvedValue({
      runId: 7,
      resultId: 10,
      decision: 'confirmed',
      decidedBy: 'user_first',
      decidedAt: '2026-08-08T00:00:00.000Z',
      packetHash: PACKET_HASH,
      effectiveEventId: 12,
      effectiveSequence: 1,
    });
    mocks.transitionReviewDecision.mockResolvedValue({
      kind: 'corrected',
      event: {
        eventId: 13,
        runId: 7,
        resultId: 10,
        sequence: 2,
        priorDecision: 'confirmed',
        decision: 'dismissed',
        expectedPriorEventId: 12,
        decidedBy: 'user_123',
        decidedAt: '2026-08-08T00:00:00.000Z',
        packetHash: PACKET_HASH,
      },
    });

    const result = await dismissRunAction({ runId: 7, decision: 'dismissed' });

    expect(result).toEqual(decidedOutcome({ decision: 'dismissed' }));
    expect(mocks.transitionReviewDecision).toHaveBeenCalledWith(
      { runId: 7, decision: 'dismissed', expectedPriorEventId: 12 },
      'user_123',
    );
  });

  it('never lets the dismiss action carry a confirmed decision to the query', async () => {
    // When
    const result = await dismissRunAction({ runId: 7, decision: 'confirmed' });

    // Then
    expect(result).toEqual({ ok: false, reason: 'invalid_input' });
    expect(mocks.transitionReviewDecision).not.toHaveBeenCalled();
  });

  it('static: the whole-run path never imports or calls legacy proposal or live-catalog writes', () => {
    // Given — the action module as tracked on disk.
    const source = readFileSync(new URL('./reviews.ts', import.meta.url), 'utf8');
    const marker = 'v1.7 whole-run review actions';
    const legacySection = source.slice(0, source.indexOf(marker));
    const wholeRunSection = source.slice(source.indexOf(marker));

    // Then — the whole-run path reaches only the decide query...
    expect(wholeRunSection).toMatch(/transitionReviewDecision\s*\(/);
    // ...and never calls acceptProposal, signal, companySignal, personaSignal,
    // signalOfferingLink, or offering mutations (REV-03, T-34-12).
    expect(wholeRunSection).not.toMatch(
      /\b(?:acceptProposal|companySignal|personaSignal|signalOfferingLink|offering|signal)\s*\(/,
    );
    // No interactive transactions anywhere in the file (neon-http constraint).
    expect(source).not.toMatch(/db\.transaction/);
    // No live-catalog write modules are imported by the file at all.
    expect(source).not.toMatch(
      /from ['"]@\/lib\/db\/queries\/(?:signalOfferingLinks|offerings|signals)['"]/,
    );
    // The legacy Accept write stays confined to the legacy action above the marker.
    expect(legacySection).toMatch(/\bacceptProposal\s*\(/);
  });
});
