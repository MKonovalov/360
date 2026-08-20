import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }),
}));

vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth }));
vi.mock('next/navigation', () => ({ notFound: mocks.notFound }));
vi.mock('./debugAdminConfig', () => ({
  debugAdminConfig: Object.freeze({
    captureEnabled: true,
    adminUserIds: Object.freeze(['user_debug']),
  }),
}));

import { requireDebugAdminAccess } from './requireDebugAdminAccess';

describe('requireDebugAdminAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([null, 'user_staff'])('denies anonymous and ordinary staff identities', async (userId) => {
    mocks.auth.mockResolvedValue({ userId });

    await expect(requireDebugAdminAccess()).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mocks.notFound).toHaveBeenCalledOnce();
  });

  it('returns only an allowlisted Clerk user ID', async () => {
    mocks.auth.mockResolvedValue({ userId: 'user_debug' });

    await expect(requireDebugAdminAccess()).resolves.toEqual({ userId: 'user_debug' });
    expect(mocks.notFound).not.toHaveBeenCalled();
  });
});
