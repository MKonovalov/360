import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireStaffAccess: vi.fn().mockResolvedValue({ userId: 'user_123' }),
  upsertModelSettings: vi.fn(),
  getUnionServableIds: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/auth/requireStaffAccess', () => ({
  requireStaffAccess: mocks.requireStaffAccess,
}));
vi.mock('@/lib/db/queries/userModelSettings', () => ({
  upsertModelSettings: mocks.upsertModelSettings,
}));
vi.mock('@/lib/models/catalog', () => ({
  getUnionServableIds: mocks.getUnionServableIds,
}));

import { revalidatePath } from 'next/cache';
import { saveSettingsAction } from './settings';

describe('saveSettingsAction security matrix (T-17-02..06)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUnionServableIds.mockReturnValue(['claude-sonnet-4-6', 'anthropic/claude-sonnet-4.6']);
    mocks.upsertModelSettings.mockResolvedValue(undefined);
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
      fallbackModels: ['anthropic/claude-sonnet-4.6'],
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
      fallbackModels: ['anthropic/claude-sonnet-4.6'],
    });
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
    expect(mocks.getUnionServableIds).toHaveBeenCalled();
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
