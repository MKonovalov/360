import { describe, expect, it } from 'vitest';

import {
  CANDIDATE_ELIGIBLE_EVIDENCE_STATUSES,
  confirmedCandidateEvidenceSchema,
  decideRunInputSchema,
  isActiveCandidateDisplay,
  isConfirmedRunStatus,
  isEligibleCandidateEvidence,
  normalizeCandidateEvidence,
  reconcileReviewInputSchema,
  reconcileReviewResultSchema,
  effectiveReviewProjectionSchema,
  reviewDecisionEventSchema,
  reviewDecisionTransitionInputSchema,
  reviewDecisionTransitionOutcomeSchema,
  reviewDecisionOutcomeSchema,
  reviewItemSchema,
  wholeRunDecisionSchema,
} from './reviewContracts';

const runId = 42;
const actorId = 'user_2abcDEF123';
const decidedAt = '2026-08-08T10:00:00.000Z';
const packetHash = 'a'.repeat(64);

const candidateEvidence = {
  targetType: 'company',
  subjectId: 7,
  offeringId: 101,
  analysisRunId: runId,
  resultId: 9,
  packetHash,
  findingRowId: 201,
  findingKey: 'finding-1',
  signalType: 'company',
  signalId: 3,
  signalName: 'New CFO or GBS head',
  evidenceStatus: 'strong',
  supportRole: 'primary',
  sourceRowId: 301,
  sourceKey: 'source-1',
  canonicalUrl: 'https://example.com/news/transformation-program',
  sourceTitle: 'Example announces transformation program',
  retrievedAt: '2026-08-07T12:00:00.000Z',
  excerpt: 'The company announced a large transformation program.',
  displayStatus: 'active',
  linkIdentity: { signalType: 'company', signalId: 3, offeringId: 101, status: 'active' },
} as const;

describe('whole-run review decision contracts', () => {
  it('represents sequence-one history and the synchronized effective projection', () => {
    const event = reviewDecisionEventSchema.parse({
      eventId: 12,
      runId,
      resultId: 9,
      sequence: 1,
      priorDecision: null,
      decision: 'confirmed',
      expectedPriorEventId: 0,
      decidedBy: actorId,
      decidedAt,
      packetHash,
    });
    const projection = effectiveReviewProjectionSchema.parse({
      runId,
      resultId: 9,
      decision: event.decision,
      decidedBy: event.decidedBy,
      decidedAt: event.decidedAt,
      packetHash: event.packetHash,
      effectiveEventId: event.eventId,
      effectiveSequence: event.sequence,
    });

    expect(projection.effectiveEventId).toBe(event.eventId);
    expect(projection.effectiveSequence).toBe(1);
  });

  it('distinguishes replay, correction, and stale conflict outcomes', () => {
    const input = { runId, decision: 'dismissed', expectedPriorEventId: 12 };
    expect(reviewDecisionTransitionInputSchema.safeParse(input).success).toBe(true);
    expect(reviewDecisionTransitionInputSchema.safeParse({ ...input, expectedPriorEventId: -1 }).success).toBe(false);

    const projection = {
      runId,
      resultId: 9,
      decision: 'dismissed',
      decidedBy: actorId,
      decidedAt,
      packetHash,
      effectiveEventId: 13,
      effectiveSequence: 2,
    } as const;
    expect(reviewDecisionTransitionOutcomeSchema.safeParse({ kind: 'replayed', projection }).success).toBe(true);
    expect(reviewDecisionTransitionOutcomeSchema.safeParse({
      kind: 'conflict',
      projection,
      expectedPriorEventId: 12,
    }).success).toBe(true);
    expect(reviewDecisionTransitionOutcomeSchema.safeParse({ kind: 'conflict', projection, expectedPriorEventId: 13 }).success).toBe(true);
  });

  it('accepts only the closed confirmed|dismissed decision set', () => {
    expect(wholeRunDecisionSchema.safeParse('confirmed').success).toBe(true);
    expect(wholeRunDecisionSchema.safeParse('dismissed').success).toBe(true);
    expect(wholeRunDecisionSchema.safeParse('approved').success).toBe(false);
    expect(wholeRunDecisionSchema.safeParse('rejected').success).toBe(false);
    expect(wholeRunDecisionSchema.safeParse('open').success).toBe(false);
    expect(wholeRunDecisionSchema.safeParse('').success).toBe(false);
  });

  it('rejects non-positive run IDs and open-ended decision inputs', () => {
    expect(decideRunInputSchema.safeParse({ runId, decision: 'confirmed' }).success).toBe(true);
    expect(decideRunInputSchema.safeParse({ runId: 0, decision: 'confirmed' }).success).toBe(false);
    expect(decideRunInputSchema.safeParse({ runId: -1, decision: 'confirmed' }).success).toBe(false);
    expect(decideRunInputSchema.safeParse({ runId: 1.5, decision: 'confirmed' }).success).toBe(false);
    expect(decideRunInputSchema.safeParse({ runId, decision: 'pending' }).success).toBe(false);
  });

  it('never accepts client-supplied actor identity or packet mutation shapes', () => {
    expect(decideRunInputSchema.safeParse({ runId, decision: 'confirmed', actorId }).success).toBe(false);
    expect(decideRunInputSchema.safeParse({ runId, decision: 'confirmed', decidedBy: actorId }).success).toBe(false);
    expect(decideRunInputSchema.safeParse({ runId, decision: 'confirmed', decidedAt }).success).toBe(false);
    expect(decideRunInputSchema.safeParse({ runId, decision: 'confirmed', packetHash }).success).toBe(false);
  });

  it('keeps actor, decision timestamp, and packet hash as server-result fields', () => {
    const result = reviewDecisionOutcomeSchema.safeParse({
      ok: true,
      runId,
      resultId: 9,
      decision: 'confirmed',
      decidedBy: actorId,
      decidedAt,
      packetHash,
      replayed: false,
    });
    expect(result.success).toBe(true);
    expect(reviewDecisionOutcomeSchema.safeParse({
      ok: true,
      runId,
      resultId: 9,
      decision: 'confirmed',
      decidedAt,
      packetHash,
      replayed: false,
    }).success).toBe(false);
    expect(reviewDecisionOutcomeSchema.safeParse({
      ok: true,
      runId,
      resultId: 9,
      decision: 'confirmed',
      decidedBy: actorId,
      packetHash,
      replayed: false,
    }).success).toBe(false);
    expect(reviewDecisionOutcomeSchema.safeParse({
      ok: true,
      runId,
      resultId: 9,
      decision: 'confirmed',
      decidedBy: actorId,
      decidedAt,
      replayed: false,
    }).success).toBe(false);
  });

  it('encodes safe error outcomes for invalid, missing, replayed, and race-loser results', () => {
    for (const reason of ['invalid_input', 'missing_packet', 'not_pending_review', 'replayed', 'race_loser', 'not_found']) {
      expect(reviewDecisionOutcomeSchema.safeParse({ ok: false, reason }).success).toBe(true);
    }
    expect(reviewDecisionOutcomeSchema.safeParse({ ok: false, reason: 'confirmed' }).success).toBe(false);
    expect(reviewDecisionOutcomeSchema.safeParse({ ok: true, reason: 'invalid_input' }).success).toBe(false);
  });
});

describe('reconciliation contracts', () => {
  it('accepts only a positive run ID and never a packet payload', () => {
    expect(reconcileReviewInputSchema.safeParse({ runId }).success).toBe(true);
    expect(reconcileReviewInputSchema.safeParse({ runId: 0 }).success).toBe(false);
    expect(reconcileReviewInputSchema.safeParse({ runId: -5 }).success).toBe(false);
    expect(reconcileReviewInputSchema.safeParse({ runId: '42' }).success).toBe(false);
    expect(reconcileReviewInputSchema.safeParse({ runId, packetHash }).success).toBe(false);
  });

  it('requires packet/result identity and represents missing packets as failures', () => {
    expect(reconcileReviewResultSchema.safeParse({
      ok: true,
      runId,
      resultId: 9,
      packetHash,
      replayed: false,
    }).success).toBe(true);
    expect(reconcileReviewResultSchema.safeParse({
      ok: true,
      runId,
      resultId: 9,
      replayed: false,
    }).success).toBe(false);
    expect(reconcileReviewResultSchema.safeParse({
      ok: false,
      reason: 'missing_packet',
    }).success).toBe(true);
    expect(reconcileReviewResultSchema.safeParse({
      ok: false,
      reason: 'not_completed',
    }).success).toBe(true);
  });
});

describe('review-list item contracts', () => {
  it('retains targetType plus subjectId and the authoritative run status', () => {
    const item = {
      runId,
      status: 'pending_review',
      targetType: 'persona',
      subjectId: 11,
      subjectDisplayName: 'Jane Doe',
      templateName: 'Persona transformation program',
      practiceAreaName: 'GBS',
      resultId: 9,
      packetHash,
      findingCount: 2,
      sourceCount: 1,
      linkCount: 2,
      completedAt: '2026-08-07T12:00:00.000Z',
    };
    expect(reviewItemSchema.safeParse(item).success).toBe(true);
    expect(reviewItemSchema.safeParse({ ...item, targetType: 'unknown' }).success).toBe(false);
    expect(reviewItemSchema.safeParse({ ...item, subjectId: 0 }).success).toBe(false);
    expect(reviewItemSchema.safeParse({ ...item, status: 'confirmed' }).success).toBe(true);
  });
});

describe('confirmed candidate evidence contracts', () => {
  it('requires target and signal discriminators plus full provenance identity', () => {
    expect(confirmedCandidateEvidenceSchema.safeParse(candidateEvidence).success).toBe(true);
    expect(confirmedCandidateEvidenceSchema.safeParse({ ...candidateEvidence, targetType: undefined }).success).toBe(false);
    expect(confirmedCandidateEvidenceSchema.safeParse({ ...candidateEvidence, subjectId: undefined }).success).toBe(false);
    expect(confirmedCandidateEvidenceSchema.safeParse({ ...candidateEvidence, signalType: undefined }).success).toBe(false);
    expect(confirmedCandidateEvidenceSchema.safeParse({ ...candidateEvidence, signalId: undefined }).success).toBe(false);
    expect(confirmedCandidateEvidenceSchema.safeParse({ ...candidateEvidence, analysisRunId: undefined }).success).toBe(false);
    expect(confirmedCandidateEvidenceSchema.safeParse({ ...candidateEvidence, findingRowId: undefined }).success).toBe(false);
    expect(confirmedCandidateEvidenceSchema.safeParse({ ...candidateEvidence, sourceRowId: undefined }).success).toBe(false);
    expect(confirmedCandidateEvidenceSchema.safeParse({ ...candidateEvidence, packetHash: undefined }).success).toBe(false);
  });

  it('rejects no_evidence and inconclusive evidence statuses', () => {
    expect(confirmedCandidateEvidenceSchema.safeParse({
      ...candidateEvidence,
      evidenceStatus: 'no_evidence',
    }).success).toBe(false);
    expect(confirmedCandidateEvidenceSchema.safeParse({
      ...candidateEvidence,
      evidenceStatus: 'inconclusive',
    }).success).toBe(false);
  });

  it('keeps active display status distinct from historical link identity', () => {
    const historical = {
      ...candidateEvidence,
      displayStatus: 'active',
      linkIdentity: { signalType: 'company', signalId: 3, offeringId: 101, status: 'retired' },
    };
    expect(confirmedCandidateEvidenceSchema.safeParse(historical).success).toBe(true);
    expect(isActiveCandidateDisplay('active')).toBe(true);
    expect(isActiveCandidateDisplay('draft')).toBe(false);
    expect(isActiveCandidateDisplay('retired')).toBe(false);
  });

  it('deterministically orders duplicates without dropping provenance', () => {
    const duplicate = {
      ...candidateEvidence,
      findingRowId: 202,
      findingKey: 'finding-2',
      sourceRowId: 302,
      sourceKey: 'source-2',
      evidenceStatus: 'weak',
    } as const;
    const rows = normalizeCandidateEvidence([duplicate, candidateEvidence]);
    expect(rows).toEqual([candidateEvidence, duplicate]);
    expect(rows).toHaveLength(2);
  });
});

describe('candidate eligibility predicates', () => {
  it('treats strong and weak as eligible and excludes the rest', () => {
    for (const status of CANDIDATE_ELIGIBLE_EVIDENCE_STATUSES) {
      expect(isEligibleCandidateEvidence(status)).toBe(true);
    }
    expect(isEligibleCandidateEvidence('no_evidence')).toBe(false);
    expect(isEligibleCandidateEvidence('inconclusive')).toBe(false);
  });

  it('confirms only explicitly confirmed run statuses', () => {
    expect(isConfirmedRunStatus('confirmed')).toBe(true);
    expect(isConfirmedRunStatus('pending_review')).toBe(false);
    expect(isConfirmedRunStatus('completed')).toBe(false);
    expect(isConfirmedRunStatus('failed')).toBe(false);
    expect(isConfirmedRunStatus('cancelled')).toBe(false);
    expect(isConfirmedRunStatus('dismissed')).toBe(false);
    expect(isConfirmedRunStatus('queued')).toBe(false);
    expect(isConfirmedRunStatus('running')).toBe(false);
  });
});
