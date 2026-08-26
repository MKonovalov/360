import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  noStore: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth }));
vi.mock('next/cache', () => ({ unstable_noStore: mocks.noStore }));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));

import { requireStaffAccess } from './requireStaffAccess';

describe('requireStaffAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.redirect.mockImplementation(() => { throw new Error('NEXT_REDIRECT'); });
  });

  it('marks an unauthenticated redirect as non-cacheable before redirecting', async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    await expect(requireStaffAccess()).rejects.toThrow('NEXT_REDIRECT');

    expect(mocks.noStore).toHaveBeenCalledOnce();
    expect(mocks.redirect).toHaveBeenCalledWith('/sign-in');
  });
});
