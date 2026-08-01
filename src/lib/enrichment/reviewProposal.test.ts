import { describe, expect, it } from 'vitest';
import {
  createReviewProposal,
  verifyReviewProposal,
  type ReviewProposalInput,
} from './reviewProposal';

const SECRET = 'review-secret-with-enough-entropy-for-tests';
const NOW = new Date('2026-07-31T10:00:00.000Z');

const proposal: ReviewProposalInput = {
  userId: 'user_123',
  entityType: 'company',
  recordId: 42,
  baseVersion: 3,
  rows: [
    {
      field: 'industry',
      currentValue: 'Consulting',
      incomingValue: 'Professional Services',
      classification: 'conflict',
      preAccepted: false,
    },
    {
      field: 'techStack',
      currentValue: null,
      incomingValue: ['SAP', 'Workday'],
      classification: 'fill',
      preAccepted: true,
    },
  ],
};

describe('review proposals', () => {
  it('returns only signed values for selected field names', () => {
    // Given
    const token = createReviewProposal(proposal, SECRET, NOW);

    // When
    const result = verifyReviewProposal(
      { token, acceptedFields: ['techStack'] },
      { userId: proposal.userId, secret: SECRET, now: NOW }
    );

    // Then
    expect(result).toEqual({
      ok: true,
      proposal: expect.objectContaining({ entityType: 'company', recordId: 42, baseVersion: 3 }),
      accepted: { techStack: ['SAP', 'Workday'] },
    });
  });

  it('rejects a tampered token', () => {
    // Given
    const token = createReviewProposal(proposal, SECRET, NOW);
    const tampered = `${token.slice(0, -1)}${token.endsWith('a') ? 'b' : 'a'}`;

    // When
    const result = verifyReviewProposal(
      { token: tampered, acceptedFields: ['industry'] },
      { userId: proposal.userId, secret: SECRET, now: NOW }
    );

    // Then
    expect(result).toEqual({ ok: false, reason: 'invalid_proposal' });
  });

  it('rejects a proposal issued to another Clerk user', () => {
    // Given
    const token = createReviewProposal(proposal, SECRET, NOW);

    // When
    const result = verifyReviewProposal(
      { token, acceptedFields: ['industry'] },
      { userId: 'user_other', secret: SECRET, now: NOW }
    );

    // Then
    expect(result).toEqual({ ok: false, reason: 'invalid_proposal' });
  });

  it('rejects an expired proposal', () => {
    // Given
    const token = createReviewProposal(proposal, SECRET, NOW);
    const afterExpiry = new Date(NOW.getTime() + 11 * 60 * 1000);

    // When
    const result = verifyReviewProposal(
      { token, acceptedFields: ['industry'] },
      { userId: proposal.userId, secret: SECRET, now: afterExpiry }
    );

    // Then
    expect(result).toEqual({ ok: false, reason: 'expired_proposal' });
  });

  it('rejects duplicate or unproposed accepted fields', () => {
    // Given
    const token = createReviewProposal(proposal, SECRET, NOW);

    // When
    const duplicate = verifyReviewProposal(
      { token, acceptedFields: ['industry', 'industry'] },
      { userId: proposal.userId, secret: SECRET, now: NOW }
    );
    const unproposed = verifyReviewProposal(
      { token, acceptedFields: ['ownershipType'] },
      { userId: proposal.userId, secret: SECRET, now: NOW }
    );

    // Then
    expect(duplicate).toEqual({ ok: false, reason: 'invalid_request' });
    expect(unproposed).toEqual({ ok: false, reason: 'invalid_request' });
  });

  it('rejects proposal values that do not match the entity field schema', () => {
    // Given
    const invalidProposal = {
      ...proposal,
      rows: [
        {
          field: 'revenueBand',
          currentValue: null,
          incomingValue: 'not-a-revenue-band',
          classification: 'fill',
          preAccepted: true,
        },
      ],
    };

    // When / Then
    expect(() => createReviewProposal(invalidProposal, SECRET, NOW)).toThrow();
  });
});
