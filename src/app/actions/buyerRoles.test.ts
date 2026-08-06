import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mirrors signals.test.ts's vi.hoisted/vi.mock structure exactly. The
// buyerRoles query module under test is mocked wholesale; only
// buyerRoles.ts's own logic (zod validation, requireStaffAccess-first
// ordering, the delete-guard pass-through, the discriminated-union envelope)
// is exercised.

const mocks = vi.hoisted(() => ({
  requireStaffAccess: vi.fn().mockResolvedValue({ userId: 'user_123' }),
  insertBuyerRole: vi.fn(),
  updateBuyerRole: vi.fn(),
  deleteBuyerRole: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/auth/requireStaffAccess', () => ({
  requireStaffAccess: mocks.requireStaffAccess,
}));
vi.mock('@/lib/db/queries/buyerRoles', () => ({
  insertBuyerRole: mocks.insertBuyerRole,
  updateBuyerRole: mocks.updateBuyerRole,
  deleteBuyerRole: mocks.deleteBuyerRole,
}));

import { revalidatePath } from 'next/cache';
import {
  createBuyerRoleAction,
  deleteBuyerRoleAction,
  updateBuyerRoleAction,
} from './buyerRoles';

const validBuyerRoleInput = {
  name: 'Head of GBS',
  description: 'Owns the shared services org',
};

describe('buyer role actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireStaffAccess.mockResolvedValue({ userId: 'user_123' });
    mocks.insertBuyerRole.mockResolvedValue({ id: 1 });
    mocks.updateBuyerRole.mockResolvedValue({ id: 1 });
    mocks.deleteBuyerRole.mockResolvedValue({ ok: true });
  });

  // ---- createBuyerRoleAction ----

  it('createBuyerRoleAction calls requireStaffAccess first then insertBuyerRole with description pass-through', async () => {
    const result = await createBuyerRoleAction(validBuyerRoleInput);

    expect(result).toEqual({ ok: true });
    expect(
      mocks.requireStaffAccess.mock.invocationCallOrder[0] <
        mocks.insertBuyerRole.mock.invocationCallOrder[0]
    ).toBe(true);
    // 30-01 widened insertBuyerRole to { name, description?, createdBy } — the
    // description field is passed straight through to the query layer.
    expect(mocks.insertBuyerRole).toHaveBeenCalledWith({
      name: 'Head of GBS',
      description: 'Owns the shared services org',
      createdBy: 'user_123',
    });
    expect(revalidatePath).toHaveBeenCalledWith('/offerings');
  });

  it('createBuyerRoleAction passes description as undefined when absent', async () => {
    await createBuyerRoleAction({ name: 'CFO' });

    expect(mocks.insertBuyerRole).toHaveBeenCalledWith({
      name: 'CFO',
      description: undefined,
      createdBy: 'user_123',
    });
  });

  it('createBuyerRoleAction rejects invalid_input before any write when name is empty', async () => {
    const result = await createBuyerRoleAction({ name: '   ' });

    expect(result).toEqual({ ok: false, reason: 'invalid_input' });
    expect(mocks.insertBuyerRole).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('createBuyerRoleAction maps an unexpected throw to action_failed', async () => {
    mocks.insertBuyerRole.mockRejectedValue(new Error('db down'));

    const result = await createBuyerRoleAction(validBuyerRoleInput);

    expect(result).toEqual({ ok: false, reason: 'action_failed' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  // ---- updateBuyerRoleAction ----

  it('updateBuyerRoleAction calls updateBuyerRole with the patch and userId', async () => {
    const result = await updateBuyerRoleAction(5, {
      ...validBuyerRoleInput,
      name: 'Head of GBS & SSC',
    });

    expect(result).toEqual({ ok: true });
    expect(mocks.updateBuyerRole).toHaveBeenCalledWith(
      5,
      { name: 'Head of GBS & SSC', description: 'Owns the shared services org' },
      'user_123'
    );
    expect(revalidatePath).toHaveBeenCalledWith('/offerings');
  });

  it('updateBuyerRoleAction returns not_found when no row updated', async () => {
    mocks.updateBuyerRole.mockResolvedValue(undefined);

    const result = await updateBuyerRoleAction(999, validBuyerRoleInput);

    expect(result).toEqual({ ok: false, reason: 'not_found' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('updateBuyerRoleAction rejects invalid_input when name is empty', async () => {
    const result = await updateBuyerRoleAction(5, { name: '' });

    expect(result).toEqual({ ok: false, reason: 'invalid_input' });
    expect(mocks.updateBuyerRole).not.toHaveBeenCalled();
  });

  it('updateBuyerRoleAction maps an unexpected throw to action_failed', async () => {
    mocks.updateBuyerRole.mockRejectedValue(new Error('db down'));

    const result = await updateBuyerRoleAction(5, validBuyerRoleInput);

    expect(result).toEqual({ ok: false, reason: 'action_failed' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  // ---- deleteBuyerRoleAction ----

  it('deleteBuyerRoleAction passes has_dependents straight through unmodified', async () => {
    mocks.deleteBuyerRole.mockResolvedValue({ ok: false, reason: 'has_dependents' });

    const result = await deleteBuyerRoleAction(5);

    expect(result).toEqual({ ok: false, reason: 'has_dependents' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('deleteBuyerRoleAction revalidates and returns ok when the delete succeeds', async () => {
    const result = await deleteBuyerRoleAction(5);

    expect(result).toEqual({ ok: true });
    expect(mocks.deleteBuyerRole).toHaveBeenCalledWith(5);
    expect(revalidatePath).toHaveBeenCalledWith('/offerings');
  });

  it('deleteBuyerRoleAction maps an unexpected throw to action_failed', async () => {
    mocks.deleteBuyerRole.mockRejectedValue(new Error('db down'));

    const result = await deleteBuyerRoleAction(5);

    expect(result).toEqual({ ok: false, reason: 'action_failed' });
  });
});
