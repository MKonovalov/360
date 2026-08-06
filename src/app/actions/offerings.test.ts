import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mirrors signals.test.ts's vi.hoisted/vi.mock structure exactly. The query
// modules under test are mocked wholesale; only offerings.ts's own logic
// (zod validation, requireStaffAccess-first ordering, server-side sortOrder
// computation, the delete-guard pass-through, sequential reorder) is
// exercised.

const mocks = vi.hoisted(() => ({
  requireStaffAccess: vi.fn().mockResolvedValue({ userId: 'user_123' }),
  insertPracticeArea: vi.fn(),
  updatePracticeArea: vi.fn(),
  listAllPracticeAreas: vi.fn(),
  deletePracticeArea: vi.fn(),
  updatePracticeAreaSortOrder: vi.fn(),
  insertDomain: vi.fn(),
  updateDomain: vi.fn(),
  listDomainsForPracticeArea: vi.fn(),
  deleteDomain: vi.fn(),
  updateDomainSortOrder: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/auth/requireStaffAccess', () => ({
  requireStaffAccess: mocks.requireStaffAccess,
}));
vi.mock('@/lib/db/queries/practiceAreas', () => ({
  insertPracticeArea: mocks.insertPracticeArea,
  updatePracticeArea: mocks.updatePracticeArea,
  listAllPracticeAreas: mocks.listAllPracticeAreas,
  deletePracticeArea: mocks.deletePracticeArea,
  updatePracticeAreaSortOrder: mocks.updatePracticeAreaSortOrder,
}));
vi.mock('@/lib/db/queries/domains', () => ({
  insertDomain: mocks.insertDomain,
  updateDomain: mocks.updateDomain,
  listDomainsForPracticeArea: mocks.listDomainsForPracticeArea,
  deleteDomain: mocks.deleteDomain,
  updateDomainSortOrder: mocks.updateDomainSortOrder,
}));

import { revalidatePath } from 'next/cache';
import {
  archivePracticeAreaAction,
  createDomainAction,
  createPracticeAreaAction,
  deleteDomainAction,
  deletePracticeAreaAction,
  reorderDomainsAction,
  reorderPracticeAreasAction,
  updateDomainAction,
  updatePracticeAreaAction,
} from './offerings';

const validPracticeAreaInput = {
  name: 'GBS',
  shortCode: 'GBS',
  description: 'Global Business Services',
};

const validDomainInput = {
  practiceAreaId: 1,
  name: 'Design',
};

describe('offerings actions — practice areas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireStaffAccess.mockResolvedValue({ userId: 'user_123' });
    mocks.listAllPracticeAreas.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }]);
    mocks.insertPracticeArea.mockResolvedValue({ id: 1 });
    mocks.updatePracticeArea.mockResolvedValue({ id: 1 });
    mocks.deletePracticeArea.mockResolvedValue({ ok: true });
    mocks.updatePracticeAreaSortOrder.mockResolvedValue({ id: 1 });
    mocks.listDomainsForPracticeArea.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    mocks.insertDomain.mockResolvedValue({ id: 1 });
    mocks.updateDomain.mockResolvedValue({ id: 1 });
    mocks.deleteDomain.mockResolvedValue({ ok: true });
    mocks.updateDomainSortOrder.mockResolvedValue({ id: 1 });
  });

  // ---- createPracticeAreaAction ----

  it('createPracticeAreaAction calls requireStaffAccess first, computes sortOrder server-side, then insertPracticeArea', async () => {
    const result = await createPracticeAreaAction(validPracticeAreaInput);

    expect(result).toEqual({ ok: true });
    expect(
      mocks.requireStaffAccess.mock.invocationCallOrder[0] <
        mocks.insertPracticeArea.mock.invocationCallOrder[0]
    ).toBe(true);
    // sortOrder is the current count of listAllPracticeAreas() — never client-supplied.
    expect(mocks.listAllPracticeAreas.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.insertPracticeArea.mock.invocationCallOrder[0]
    );
    expect(mocks.insertPracticeArea).toHaveBeenCalledWith({
      name: 'GBS',
      shortCode: 'GBS',
      description: 'Global Business Services',
      status: undefined,
      sortOrder: 3,
      createdBy: 'user_123',
    });
    expect(revalidatePath).toHaveBeenCalledWith('/offerings');
  });

  it('createPracticeAreaAction ignores a client-supplied sortOrder (server-computed only)', async () => {
    await createPracticeAreaAction({ ...validPracticeAreaInput, sortOrder: 99 });

    expect(mocks.insertPracticeArea).toHaveBeenCalledWith({
      name: 'GBS',
      shortCode: 'GBS',
      description: 'Global Business Services',
      status: undefined,
      sortOrder: 3,
      createdBy: 'user_123',
    });
  });

  it('createPracticeAreaAction rejects invalid_input before any write when name is empty', async () => {
    const result = await createPracticeAreaAction({ ...validPracticeAreaInput, name: '' });

    expect(result).toEqual({ ok: false, reason: 'invalid_input' });
    expect(mocks.insertPracticeArea).not.toHaveBeenCalled();
    expect(mocks.listAllPracticeAreas).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('createPracticeAreaAction maps an unexpected throw to action_failed', async () => {
    mocks.insertPracticeArea.mockRejectedValue(new Error('db down'));

    const result = await createPracticeAreaAction(validPracticeAreaInput);

    expect(result).toEqual({ ok: false, reason: 'action_failed' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  // ---- updatePracticeAreaAction ----

  it('updatePracticeAreaAction calls updatePracticeArea with the patch and userId', async () => {
    const result = await updatePracticeAreaAction(100, validPracticeAreaInput);

    expect(result).toEqual({ ok: true });
    expect(mocks.updatePracticeArea).toHaveBeenCalledWith(
      100,
      {
        name: 'GBS',
        shortCode: 'GBS',
        description: 'Global Business Services',
        status: undefined,
      },
      'user_123'
    );
    expect(revalidatePath).toHaveBeenCalledWith('/offerings');
  });

  it('updatePracticeAreaAction returns not_found when no row updated', async () => {
    mocks.updatePracticeArea.mockResolvedValue(undefined);

    const result = await updatePracticeAreaAction(999, validPracticeAreaInput);

    expect(result).toEqual({ ok: false, reason: 'not_found' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('updatePracticeAreaAction rejects invalid_input before any write', async () => {
    const result = await updatePracticeAreaAction(100, {
      ...validPracticeAreaInput,
      shortCode: '',
    });

    expect(result).toEqual({ ok: false, reason: 'invalid_input' });
    expect(mocks.updatePracticeArea).not.toHaveBeenCalled();
  });

  // ---- archivePracticeAreaAction ----

  it('archivePracticeAreaAction calls requireStaffAccess first then updatePracticeArea with status draft (never retired)', async () => {
    const result = await archivePracticeAreaAction(100);

    expect(result).toEqual({ ok: true });
    expect(
      mocks.requireStaffAccess.mock.invocationCallOrder[0] <
        mocks.updatePracticeArea.mock.invocationCallOrder[0]
    ).toBe(true);
    // practiceAreaStatusEnum has only ['active','draft'] — archive is a soft
    // flip to 'draft', never 'retired'.
    expect(mocks.updatePracticeArea).toHaveBeenCalledWith(100, { status: 'draft' }, 'user_123');
    expect(revalidatePath).toHaveBeenCalledWith('/offerings');
  });

  it('archivePracticeAreaAction returns not_found when no row updated', async () => {
    mocks.updatePracticeArea.mockResolvedValue(undefined);

    const result = await archivePracticeAreaAction(999);

    expect(result).toEqual({ ok: false, reason: 'not_found' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  // ---- deletePracticeAreaAction ----

  it('deletePracticeAreaAction passes has_dependents straight through without revalidation', async () => {
    mocks.deletePracticeArea.mockResolvedValue({ ok: false, reason: 'has_dependents' });

    const result = await deletePracticeAreaAction(100);

    expect(result).toEqual({ ok: false, reason: 'has_dependents' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('deletePracticeAreaAction revalidates and returns ok when the delete succeeds', async () => {
    const result = await deletePracticeAreaAction(100);

    expect(result).toEqual({ ok: true });
    expect(mocks.deletePracticeArea).toHaveBeenCalledWith(100);
    expect(revalidatePath).toHaveBeenCalledWith('/offerings');
  });

  // ---- reorderPracticeAreasAction ----

  it('reorderPracticeAreasAction calls updatePracticeAreaSortOrder once per id in order', async () => {
    const result = await reorderPracticeAreasAction([3, 1, 2]);

    expect(result).toEqual({ ok: true });
    expect(mocks.updatePracticeAreaSortOrder).toHaveBeenCalledTimes(3);
    expect(mocks.updatePracticeAreaSortOrder).toHaveBeenNthCalledWith(1, 3, 0, 'user_123');
    expect(mocks.updatePracticeAreaSortOrder).toHaveBeenNthCalledWith(2, 1, 1, 'user_123');
    expect(mocks.updatePracticeAreaSortOrder).toHaveBeenNthCalledWith(3, 2, 2, 'user_123');
    expect(revalidatePath).toHaveBeenCalledWith('/offerings');
  });

  it('reorderPracticeAreasAction maps an unexpected throw to action_failed', async () => {
    mocks.updatePracticeAreaSortOrder.mockRejectedValue(new Error('db down'));

    const result = await reorderPracticeAreasAction([1, 2]);

    expect(result).toEqual({ ok: false, reason: 'action_failed' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe('offerings actions — domains', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireStaffAccess.mockResolvedValue({ userId: 'user_123' });
    mocks.listDomainsForPracticeArea.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    mocks.insertDomain.mockResolvedValue({ id: 1 });
    mocks.updateDomain.mockResolvedValue({ id: 1 });
    mocks.deleteDomain.mockResolvedValue({ ok: true });
    mocks.updateDomainSortOrder.mockResolvedValue({ id: 1 });
  });

  it('createDomainAction computes sortOrder scoped to the domain practiceAreaId', async () => {
    const result = await createDomainAction(validDomainInput);

    expect(result).toEqual({ ok: true });
    expect(mocks.listDomainsForPracticeArea).toHaveBeenCalledWith(1);
    expect(mocks.insertDomain).toHaveBeenCalledWith({
      practiceAreaId: 1,
      name: 'Design',
      sortOrder: 2,
      createdBy: 'user_123',
    });
    expect(revalidatePath).toHaveBeenCalledWith('/offerings');
  });

  it('createDomainAction rejects invalid_input when name is empty (never calls insertDomain)', async () => {
    const result = await createDomainAction({ ...validDomainInput, name: '' });

    expect(result).toEqual({ ok: false, reason: 'invalid_input' });
    expect(mocks.insertDomain).not.toHaveBeenCalled();
    expect(mocks.listDomainsForPracticeArea).not.toHaveBeenCalled();
  });

  it('createDomainAction maps an unexpected throw to action_failed', async () => {
    mocks.insertDomain.mockRejectedValue(new Error('db down'));

    const result = await createDomainAction(validDomainInput);

    expect(result).toEqual({ ok: false, reason: 'action_failed' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('updateDomainAction calls updateDomain with the patch and userId', async () => {
    const result = await updateDomainAction(50, { ...validDomainInput, name: 'Build' });

    expect(result).toEqual({ ok: true });
    expect(mocks.updateDomain).toHaveBeenCalledWith(
      50,
      { practiceAreaId: 1, name: 'Build' },
      'user_123'
    );
    expect(revalidatePath).toHaveBeenCalledWith('/offerings');
  });

  it('updateDomainAction returns not_found when no row updated', async () => {
    mocks.updateDomain.mockResolvedValue(undefined);

    const result = await updateDomainAction(999, validDomainInput);

    expect(result).toEqual({ ok: false, reason: 'not_found' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('deleteDomainAction passes has_dependents straight through', async () => {
    mocks.deleteDomain.mockResolvedValue({ ok: false, reason: 'has_dependents' });

    const result = await deleteDomainAction(50);

    expect(result).toEqual({ ok: false, reason: 'has_dependents' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('reorderDomainsAction calls updateDomainSortOrder once per id in order', async () => {
    const result = await reorderDomainsAction([2, 1]);

    expect(result).toEqual({ ok: true });
    expect(mocks.updateDomainSortOrder).toHaveBeenCalledTimes(2);
    expect(mocks.updateDomainSortOrder).toHaveBeenNthCalledWith(1, 2, 0, 'user_123');
    expect(mocks.updateDomainSortOrder).toHaveBeenNthCalledWith(2, 1, 1, 'user_123');
    expect(revalidatePath).toHaveBeenCalledWith('/offerings');
  });
});
