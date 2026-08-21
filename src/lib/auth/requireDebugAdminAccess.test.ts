import { beforeEach, describe, expect, it, vi } from 'vitest';

// debugAdminConfig is mutable here (not frozen) so individual tests can flip
// captureEnabled/adminUserIds to prove the gate and allowlist checks are each
// independently fail-closed — the real module freezes it, but this mock only
// needs to model the shape requireDebugAdminAccess reads.
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }),
  debugAdminConfig: { captureEnabled: true, adminUserIds: ['user_debug'] as string[] },
}));

vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth }));
vi.mock('next/navigation', () => ({ notFound: mocks.notFound }));
vi.mock('./debugAdminConfig', () => ({ debugAdminConfig: mocks.debugAdminConfig }));

import { requireDebugAdminAccess } from './requireDebugAdminAccess';

describe('requireDebugAdminAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.debugAdminConfig.captureEnabled = true;
    mocks.debugAdminConfig.adminUserIds = ['user_debug'];
  });

  it.each([null, 'user_staff'])('denies anonymous and ordinary staff identities', async (userId) => {
    mocks.auth.mockResolvedValue({ userId });

    await expect(requireDebugAdminAccess()).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mocks.notFound).toHaveBeenCalledOnce();
  });

  it('denies an allowlisted admin when the capture gate is disabled', async () => {
    mocks.debugAdminConfig.captureEnabled = false;
    mocks.auth.mockResolvedValue({ userId: 'user_debug' });

    await expect(requireDebugAdminAccess()).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mocks.notFound).toHaveBeenCalledOnce();
  });

  it('denies access when the admin allowlist is empty (fail-closed invalid config)', async () => {
    mocks.debugAdminConfig.adminUserIds = [];
    mocks.auth.mockResolvedValue({ userId: 'user_debug' });

    await expect(requireDebugAdminAccess()).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mocks.notFound).toHaveBeenCalledOnce();
  });

  it('returns only an allowlisted Clerk user ID', async () => {
    mocks.auth.mockResolvedValue({ userId: 'user_debug' });

    await expect(requireDebugAdminAccess()).resolves.toEqual({ userId: 'user_debug' });
    expect(mocks.notFound).not.toHaveBeenCalled();
  });
});
