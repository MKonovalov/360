import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireStaffAccess: vi.fn().mockResolvedValue({ userId: 'user_123' }),
  upsertModelSettings: vi.fn(),
  upsertOrganizationDataSourceSettings: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/auth/requireStaffAccess', () => ({
  requireStaffAccess: mocks.requireStaffAccess,
}));
vi.mock('@/lib/db/queries/userModelSettings', () => ({
  upsertModelSettings: mocks.upsertModelSettings,
}));
vi.mock('@/lib/db/queries/organizationDataSourceSettings', () => ({
  upsertOrganizationDataSourceSettings: mocks.upsertOrganizationDataSourceSettings,
}));
import { revalidatePath } from 'next/cache';
import { saveDataSourceSettingsAction, saveSettingsAction } from './settings';

describe('saveSettingsAction security matrix (T-17-02..06)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.upsertModelSettings.mockResolvedValue(undefined);
    mocks.upsertOrganizationDataSourceSettings.mockResolvedValue(undefined);
  });

  it('saves a valid chain: gate FIRST, then upsert with the session userId, then revalidate', async () => {
    // Given / When
    const result = await saveSettingsAction({
      primaryModel: 'claude-sonnet-4-6',
      fallbacks: ['anthropic/claude-sonnet-4.6'],
    });

    // Then
    expect(result).toEqual({ ok: true });
    expect(
      mocks.requireStaffAccess.mock.invocationCallOrder[0] <
        mocks.upsertModelSettings.mock.invocationCallOrder[0]
    ).toBe(true);
    expect(mocks.upsertModelSettings).toHaveBeenCalledWith({
      userId: 'user_123',
      primaryModel: 'claude-sonnet-4-6',
      primaryProvider: 'anthropic',
      fallbackModels: ['anthropic/claude-sonnet-4.6'],
      // nousresearch outranks openrouter for dual-listed ids (widened-gate
      // precedence flip, post-widening amendment).
      fallbackProviders: ['nousresearch'],
    });
    expect(revalidatePath).toHaveBeenCalledWith('/settings');
  });

  it('accepts a cross-provider chain against the union servable set (REG-07) — ids pass through verbatim (D-04)', async () => {
    // Given / When
    const result = await saveSettingsAction({
      primaryModel: 'claude-sonnet-4-6',
      fallbacks: ['anthropic/claude-sonnet-4.6'],
    });

    // Then
    expect(result).toEqual({ ok: true });
    expect(mocks.upsertModelSettings).toHaveBeenCalledWith({
      userId: 'user_123',
      primaryModel: 'claude-sonnet-4-6',
      primaryProvider: 'anthropic',
      fallbackModels: ['anthropic/claude-sonnet-4.6'],
      fallbackProviders: ['nousresearch'],
    });
  });

  it('REG-07 (4-provider): a cross-provider chain spanning the new providers saves against the widened union, ids pass through verbatim (D-04)', async () => {
    // Given — the widened 4-provider union: an anthropic id + an openrouter id +
    // a nousresearch pin + an opencode Zen id + an opencode Go-exclusive id
    // (proving the logical opencode provider spans both snapshot providerIDs at
    // When — an opencode primary + nousresearch fallback: a chain that was
    // impossible before v1.5.
    const result = await saveSettingsAction({
      primaryModel: 'deepseek-v4-flash',
      primaryProvider: 'opencode',
      fallbacks: ['nousresearch/hermes-4-70b'],
      fallbackProviders: ['nousresearch'],
    });

    // Then — raw ids verbatim (no prefix-strip, no translation, D-04).
    expect(result).toEqual({ ok: true });
    expect(mocks.upsertModelSettings).toHaveBeenCalledWith({
      userId: 'user_123',
      primaryModel: 'deepseek-v4-flash',
      primaryProvider: 'opencode',
      fallbackModels: ['nousresearch/hermes-4-70b'],
      fallbackProviders: ['nousresearch'],
    });
    expect(revalidatePath).toHaveBeenCalledWith('/settings');
  });

  it('rejects malformed input before any write (missing primary, fallbacks not an array)', async () => {
    // Given / When
    const result = await saveSettingsAction({ fallbacks: 'nope' });

    // Then
    expect(result).toEqual({ ok: false, reason: 'invalid_model' });
    expect(mocks.upsertModelSettings).not.toHaveBeenCalled();
  });

  it('rejects more than 2 fallbacks (zod max(2)) before any write', async () => {
    // Given / When
    const result = await saveSettingsAction({
      primaryModel: 'claude-sonnet-4-6',
      fallbacks: ['claude-haiku-4-5', 'claude-haiku-4-5', 'claude-haiku-4-5'],
    });

    // Then
    expect(result).toEqual({ ok: false, reason: 'invalid_model' });
    expect(mocks.upsertModelSettings).not.toHaveBeenCalled();
  });

  it('rejects a non-servable model id against the server-computed servable set', async () => {
    // Given / When
    const result = await saveSettingsAction({
      primaryModel: 'claude-opus-4-9',
      fallbacks: [],
    });

    // Then
    expect(result).toEqual({ ok: false, reason: 'invalid_model' });
    expect(mocks.upsertModelSettings).not.toHaveBeenCalled();
  });

  it('rejects primary repeated in fallbacks (D-08 backstop)', async () => {
    // Given / When
    const result = await saveSettingsAction({
      primaryModel: 'claude-sonnet-4-6',
      fallbacks: ['claude-sonnet-4-6'],
    });

    // Then
    expect(result).toEqual({ ok: false, reason: 'duplicate_model' });
    expect(mocks.upsertModelSettings).not.toHaveBeenCalled();
  });

  it('rejects duplicate fallback entries (D-09 backstop)', async () => {
    // Given / When
    const result = await saveSettingsAction({
      primaryModel: 'claude-sonnet-4-6',
      fallbacks: ['anthropic/claude-sonnet-4.6', 'anthropic/claude-sonnet-4.6'],
    });

    // Then
    expect(result).toEqual({ ok: false, reason: 'duplicate_model' });
    expect(mocks.upsertModelSettings).not.toHaveBeenCalled();
  });

  it('maps an unexpected upsert throw to action_failed — never thrown to the client', async () => {
    // Given
    mocks.upsertModelSettings.mockRejectedValue(new Error('db down'));

    // When
    const result = await saveSettingsAction({
      primaryModel: 'claude-sonnet-4-6',
      fallbacks: ['anthropic/claude-sonnet-4.6'],
    });

    // Then
    expect(result).toEqual({ ok: false, reason: 'action_failed' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe('saveDataSourceSettingsAction security matrix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.upsertOrganizationDataSourceSettings.mockResolvedValue(undefined);
  });

  it('saves the complete shared tuple with no user-owned scope', async () => {
    const result = await saveDataSourceSettingsAction({
      webResearchProvider: 'exa',
      companyEnrichmentProvider: 'apollo',
      personaEnrichmentProvider: 'prospeo',
    });

    expect(result).toEqual({ ok: true });
    expect(mocks.upsertOrganizationDataSourceSettings).toHaveBeenCalledWith({
      webResearchProvider: 'exa',
      companyEnrichmentProvider: 'apollo',
      personaEnrichmentProvider: 'prospeo',
    });
    expect(revalidatePath).toHaveBeenCalledWith('/settings');
  });

  it('rejects malformed input without writing or returning credential data', async () => {
    const result = await saveDataSourceSettingsAction({
      webResearchProvider: 'firecrawl',
      companyEnrichmentProvider: 'apollo',
      personaEnrichmentProvider: 'prospeo',
      FIRECRAWL_API_KEY: 'secret',
    });

    expect(result).toEqual({ ok: false, reason: 'invalid_data_source' });
    expect(mocks.upsertOrganizationDataSourceSettings).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain('secret');
  });
});
