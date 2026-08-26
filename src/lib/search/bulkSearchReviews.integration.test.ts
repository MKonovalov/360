import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  createApprovalIntegrationHarness,
  type ApprovalIntegrationHarness,
} from './approveSearchReview.integration.fixtures';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase('bulk Search review decisions against Neon', () => {
  let dbModule: typeof import('@/lib/db/index');
  let schema: typeof import('@/lib/db/schema');
  let harness: ApprovalIntegrationHarness;
  let bulkSearchReviews: typeof import('./bulkSearchReviews').bulkSearchReviews;

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_placeholder';
    process.env.CLERK_SECRET_KEY = 'sk_test_placeholder';
    vi.resetModules();
    dbModule = await import('@/lib/db/index');
    schema = await import('@/lib/db/schema');
    ({ bulkSearchReviews } = await import('./bulkSearchReviews'));
    harness = await createApprovalIntegrationHarness({ db: dbModule.db, schema });
  });

  afterAll(async () => {
    if (harness) await harness.cleanup();
  });

  it('keeps an eligible approval when an ineligible candidate is skipped', async () => {
    // Given
    const ineligibleReview = await harness.insertCandidate({
      packetCandidateId: `inconclusive-${randomUUID()}`,
      personaSnapshot: {
        firstName: null, lastName: null, fullName: `Inconclusive ${randomUUID()}`, title: null,
        email: null, linkedinUrl: null, phone: null, location: null, department: null, function: null,
        seniority: null, companyName: harness.companyName, companyDomain: harness.companyDomain, bio: null, photoUrl: null,
      },
      matchSnapshot: { kind: 'new_persona' },
      eligibilitySnapshot: { eligible: false, deficiencies: ['insufficient_public_sources:1'] },
      status: 'inconclusive',
    });

    // When
    const result = await bulkSearchReviews({
      reviewIds: [harness.reviewId, ineligibleReview],
      action: 'approve',
      actorUserId: 'search-approval-integration',
      revisions: { [harness.reviewId]: 1, [ineligibleReview]: 1 },
    });

    // Then
    expect(result).toMatchObject({
      kind: 'completed',
      outcomes: [
        { reviewId: harness.reviewId, outcome: 'approved' },
        { reviewId: ineligibleReview, outcome: 'skipped', reason: 'ineligible' },
      ],
      counts: { approved: 1, rejected: 0, skipped: 1, failed: 0 },
    });
    const candidates = await dbModule.db
      .select({ id: schema.searchCandidate.id, status: schema.searchCandidate.status })
      .from(schema.searchCandidate)
      .where(eq(schema.searchCandidate.searchRunId, harness.searchRunId));
    expect(candidates.find((candidate) => candidate.id === harness.reviewId)?.status).toBe('approved');
    expect(candidates.find((candidate) => candidate.id === ineligibleReview)?.status).toBe('inconclusive');
  });

  it('rejects a candidate independently and maps a missing candidate without exposing details', async () => {
    // Given
    const rejectionReview = await harness.insertCandidate({
      packetCandidateId: `reject-${randomUUID()}`,
      personaSnapshot: {
        firstName: null, lastName: null, fullName: `Reject ${randomUUID()}`, title: null,
        email: null, linkedinUrl: null, phone: null, location: null, department: null, function: null,
        seniority: null, companyName: harness.companyName, companyDomain: harness.companyDomain, bio: null, photoUrl: null,
      },
      matchSnapshot: { kind: 'new_persona' },
      status: 'pending',
    });
    const missingReview = 2_000_000_000;

    // When
    const result = await bulkSearchReviews({
      reviewIds: [rejectionReview, missingReview],
      action: 'reject',
      actorUserId: 'search-approval-integration',
      revisions: { [rejectionReview]: 1, [missingReview]: 1 },
    });

    // Then
    expect(result).toMatchObject({
      kind: 'completed',
      outcomes: [
        { reviewId: rejectionReview, outcome: 'rejected' },
        { reviewId: missingReview, outcome: 'skipped', reason: 'not_found' },
      ],
      counts: { approved: 0, rejected: 1, skipped: 1, failed: 0 },
    });
    const [rejectedCandidate] = await dbModule.db
      .select({ status: schema.searchCandidate.status })
      .from(schema.searchCandidate)
      .where(eq(schema.searchCandidate.id, rejectionReview));
    expect(rejectedCandidate?.status).toBe('rejected');
    expect(JSON.stringify(result)).not.toContain('partner');
  });
});
