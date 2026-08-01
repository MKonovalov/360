import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  enrichOrganization: vi.fn(),
  enrichPerson: vi.fn(),
  getCompanyById: vi.fn(),
  getPersonaById: vi.fn(),
  applyCompanyEnrichment: vi.fn(),
  applyPersonaEnrichment: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/auth/requireStaffAccess', () => ({
  requireStaffAccess: vi.fn().mockResolvedValue({ userId: 'user_123' }),
}));
vi.mock('@/lib/env', () => ({
  env: {
    APOLLO_API_KEY: 'test-key',
    PROSPEO_API_KEY: 'test-key',
    ENRICHMENT_REVIEW_SECRET: 'review-secret-with-enough-entropy-for-tests',
  },
}));
vi.mock('@/lib/enrichment/apollo', () => ({
  enrichOrganization: mocks.enrichOrganization,
}));
vi.mock('@/lib/enrichment/prospeo', () => ({
  enrichPerson: mocks.enrichPerson,
}));
vi.mock('@/lib/db/queries/companies', () => ({
  getCompanyById: mocks.getCompanyById,
  applyCompanyEnrichment: mocks.applyCompanyEnrichment,
}));
vi.mock('@/lib/db/queries/personas', () => ({
  getPersonaById: mocks.getPersonaById,
  applyPersonaEnrichment: mocks.applyPersonaEnrichment,
}));

import { commitEnrichment, runEnrichment } from './enrichment';

describe('enrichment actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCompanyById.mockResolvedValue({
      id: 7,
      domain: 'example.com',
      industry: null,
      version: 4,
    });
    mocks.enrichOrganization.mockResolvedValue({
      ok: true,
      fields: [{ field: 'industry', incomingValue: 'Professional Services' }],
    });
    mocks.applyCompanyEnrichment.mockResolvedValue(true);
  });

  it('calls Apollo once for review and never refetches on commit', async () => {
    // Given
    const review = await runEnrichment({ entityType: 'company', recordId: 7 });
    expect(review.ok).toBe(true);
    if (!review.ok) return;

    // When
    const committed = await commitEnrichment({
      token: review.proposalToken,
      acceptedFields: ['industry'],
    });

    // Then
    expect(committed).toEqual({ ok: true });
    expect(mocks.enrichOrganization).toHaveBeenCalledTimes(1);
    expect(mocks.applyCompanyEnrichment).toHaveBeenCalledWith(7, 4, {
      industry: 'Professional Services',
    });
  });

  it('rejects a field that was not in the signed review', async () => {
    // Given
    const review = await runEnrichment({ entityType: 'company', recordId: 7 });
    expect(review.ok).toBe(true);
    if (!review.ok) return;

    // When
    const committed = await commitEnrichment({
      token: review.proposalToken,
      acceptedFields: ['ownershipType'],
    });

    // Then
    expect(committed).toEqual({ ok: false, reason: 'invalid_request' });
    expect(mocks.applyCompanyEnrichment).not.toHaveBeenCalled();
  });

  it('maps a zero-row conditional update to stale_review', async () => {
    // Given
    mocks.applyCompanyEnrichment.mockResolvedValue(false);
    const review = await runEnrichment({ entityType: 'company', recordId: 7 });
    expect(review.ok).toBe(true);
    if (!review.ok) return;

    // When
    const committed = await commitEnrichment({
      token: review.proposalToken,
      acceptedFields: ['industry'],
    });

    // Then
    expect(committed).toEqual({ ok: false, reason: 'stale_review' });
  });

  it('rejects malformed action input before loading a record', async () => {
    // Given / When
    const result = await runEnrichment({ entityType: 'company', recordId: '7' });

    // Then
    expect(result).toEqual({ ok: false, reason: 'invalid_request' });
    expect(mocks.getCompanyById).not.toHaveBeenCalled();
  });

  it('calls Prospeo once for a persona review and commits only accepted fields', async () => {
    // Given
    mocks.getPersonaById.mockResolvedValue({
      id: 8,
      email: 'mark@sumware.com',
      title: null,
      version: 1,
    });
    mocks.enrichPerson.mockResolvedValue({
      ok: true,
      fields: [{ field: 'title', incomingValue: 'CFO' }],
    });
    mocks.applyPersonaEnrichment.mockResolvedValue(true);

    // When
    const review = await runEnrichment({ entityType: 'persona', recordId: 8 });
    expect(review.ok).toBe(true);
    if (!review.ok) return;

    const committed = await commitEnrichment({
      token: review.proposalToken,
      acceptedFields: ['title'],
    });

    // Then
    expect(committed).toEqual({ ok: true });
    expect(mocks.enrichPerson).toHaveBeenCalledTimes(1);
    expect(mocks.enrichPerson).toHaveBeenCalledWith('mark@sumware.com');
    expect(mocks.applyPersonaEnrichment).toHaveBeenCalledWith(8, 1, {
      title: 'CFO',
    });
  });
});
