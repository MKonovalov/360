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
  insertOffering: vi.fn(),
  updateOffering: vi.fn(),
  listAllOfferingsForPracticeArea: vi.fn(),
  insertOfferingBuyerRole: vi.fn(),
  listBuyerRolesForOffering: vi.fn(),
  deleteOffering: vi.fn(),
  updateOfferingSortOrder: vi.fn(),
  deleteOfferingBuyerRole: vi.fn(),
  updateOfferingBuyerRoleRank: vi.fn(),
  insertTrigger: vi.fn(),
  deleteTrigger: vi.fn(),
  listTriggersForOffering: vi.fn(),
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
vi.mock('@/lib/db/queries/offerings', () => ({
  insertOffering: mocks.insertOffering,
  updateOffering: mocks.updateOffering,
  listAllOfferingsForPracticeArea: mocks.listAllOfferingsForPracticeArea,
  insertOfferingBuyerRole: mocks.insertOfferingBuyerRole,
  listBuyerRolesForOffering: mocks.listBuyerRolesForOffering,
  deleteOffering: mocks.deleteOffering,
  updateOfferingSortOrder: mocks.updateOfferingSortOrder,
  deleteOfferingBuyerRole: mocks.deleteOfferingBuyerRole,
  updateOfferingBuyerRoleRank: mocks.updateOfferingBuyerRoleRank,
  insertTrigger: mocks.insertTrigger,
  deleteTrigger: mocks.deleteTrigger,
  listTriggersForOffering: mocks.listTriggersForOffering,
}));

import { revalidatePath } from 'next/cache';
import {
  archiveOfferingAction,
  archivePracticeAreaAction,
  createDomainAction,
  createOfferingAction,
  createPracticeAreaAction,
  createTriggerAction,
  deleteDomainAction,
  deleteOfferingAction,
  deletePracticeAreaAction,
  deleteTriggerAction,
  reorderDomainsAction,
  reorderOfferingsAction,
  reorderPracticeAreasAction,
  updateDomainAction,
  updateOfferingAction,
  updateOfferingBuyerRolesAction,
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

const validOfferingInput = {
  practiceAreaId: 1,
  domainId: 1,
  name: 'Automation & AI Portfolio Governance',
  offerType: 'programme',
  description: 'Portfolio governance offering',
  commercialModelText: 'Retainer-based',
  status: 'active',
  buyerRoles: [
    { buyerRoleId: 1, rank: 1 },
    { buyerRoleId: 2, rank: 2 },
  ],
};

describe('offerings actions — offerings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireStaffAccess.mockResolvedValue({ userId: 'user_123' });
    mocks.listAllOfferingsForPracticeArea.mockResolvedValue([
      { id: 1, domainId: 1 },
      { id: 2, domainId: null },
    ]);
    mocks.insertOffering.mockResolvedValue({ id: 100 });
    mocks.updateOffering.mockResolvedValue({ id: 100 });
    mocks.insertOfferingBuyerRole.mockResolvedValue({ id: 1 });
    mocks.listBuyerRolesForOffering.mockResolvedValue([]);
    mocks.deleteOffering.mockResolvedValue({ ok: true });
    mocks.updateOfferingSortOrder.mockResolvedValue({ id: 100 });
    mocks.deleteOfferingBuyerRole.mockResolvedValue(undefined);
    mocks.updateOfferingBuyerRoleRank.mockResolvedValue({ id: 1 });
  });

  // ---- createOfferingAction ----

  it('createOfferingAction computes sortOrder server-side from same-domainId siblings, inserts, then syncs buyerRoles via insertOfferingBuyerRole', async () => {
    const result = await createOfferingAction(validOfferingInput);

    expect(result).toEqual({ ok: true });
    expect(
      mocks.requireStaffAccess.mock.invocationCallOrder[0] <
        mocks.insertOffering.mock.invocationCallOrder[0]
    ).toBe(true);
    // sortOrder = count of siblings with the SAME domainId (OFR-04 scoping) —
    // never client-supplied.
    expect(mocks.insertOffering).toHaveBeenCalledWith({
      practiceAreaId: 1,
      domainId: 1,
      name: 'Automation & AI Portfolio Governance',
      offerType: 'programme',
      description: 'Portfolio governance offering',
      commercialModelText: 'Retainer-based',
      status: 'active',
      sortOrder: 1,
      createdBy: 'user_123',
    });
    // Fresh offering — no existing rows to diff, every buyerRole inserted.
    expect(mocks.insertOfferingBuyerRole).toHaveBeenCalledTimes(2);
    expect(mocks.insertOfferingBuyerRole).toHaveBeenCalledWith({
      offeringId: 100,
      buyerRoleId: 1,
      rank: 1,
      createdBy: 'user_123',
    });
    expect(mocks.insertOfferingBuyerRole).toHaveBeenCalledWith({
      offeringId: 100,
      buyerRoleId: 2,
      rank: 2,
      createdBy: 'user_123',
    });
    expect(revalidatePath).toHaveBeenCalledWith('/offerings');
  });

  it('createOfferingAction accepts a null domainId (OFR-04 "No domain" path) and type-checks cleanly', async () => {
    const result = await createOfferingAction({ ...validOfferingInput, domainId: null });

    expect(result).toEqual({ ok: true });
    // domainId: null flows straight into insertOffering — only type-checks
    // because 30-01 widened insertOffering's input to domainId?: number | null.
    expect(mocks.insertOffering).toHaveBeenCalledWith(
      expect.objectContaining({
        domainId: null,
        // sortOrder counts siblings with domainId ?? null === null — the
        // { id: 2, domainId: null } mock row.
        sortOrder: 1,
      })
    );
    expect(revalidatePath).toHaveBeenCalledWith('/offerings');
  });

  it('createOfferingAction rejects invalid_input before any write when name is empty', async () => {
    const result = await createOfferingAction({ ...validOfferingInput, name: '' });

    expect(result).toEqual({ ok: false, reason: 'invalid_input' });
    expect(mocks.insertOffering).not.toHaveBeenCalled();
    expect(mocks.listAllOfferingsForPracticeArea).not.toHaveBeenCalled();
    expect(mocks.insertOfferingBuyerRole).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('createOfferingAction maps an unexpected throw to action_failed', async () => {
    mocks.insertOffering.mockRejectedValue(new Error('db down'));

    const result = await createOfferingAction(validOfferingInput);

    expect(result).toEqual({ ok: false, reason: 'action_failed' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  // ---- updateOfferingAction ----

  it('updateOfferingAction diffs buyerRoles — adds, removes, and rank-updates in one call', async () => {
    // Existing ranked links: buyerRole 1 (rank 1), buyerRole 2 (rank 2).
    mocks.listBuyerRolesForOffering.mockResolvedValue([
      { buyerRoleId: 1, name: 'CFO', rank: 1 },
      { buyerRoleId: 2, name: 'Head of GBS', rank: 2 },
    ]);
    // Next-ranked input: buyerRole 1 moves to rank 2, buyerRole 2 removed,
    // buyerRole 3 added at rank 1.
    const nextRanked = [
      { buyerRoleId: 1, rank: 2 },
      { buyerRoleId: 3, rank: 1 },
    ];

    const result = await updateOfferingAction(100, { ...validOfferingInput, buyerRoles: nextRanked });

    expect(result).toEqual({ ok: true });
    // The primary patch never touches sortOrder.
    expect(mocks.updateOffering).toHaveBeenCalledWith(
      100,
      {
        practiceAreaId: 1,
        domainId: 1,
        name: 'Automation & AI Portfolio Governance',
        offerType: 'programme',
        description: 'Portfolio governance offering',
        commercialModelText: 'Retainer-based',
        status: 'active',
      },
      'user_123'
    );
    expect(mocks.insertOfferingBuyerRole).toHaveBeenCalledTimes(1);
    expect(mocks.insertOfferingBuyerRole).toHaveBeenCalledWith({
      offeringId: 100,
      buyerRoleId: 3,
      rank: 1,
      createdBy: 'user_123',
    });
    expect(mocks.deleteOfferingBuyerRole).toHaveBeenCalledTimes(1);
    expect(mocks.deleteOfferingBuyerRole).toHaveBeenCalledWith(100, 2);
    expect(mocks.updateOfferingBuyerRoleRank).toHaveBeenCalledTimes(1);
    expect(mocks.updateOfferingBuyerRoleRank).toHaveBeenCalledWith(100, 1, 2, 'user_123');
    expect(revalidatePath).toHaveBeenCalledWith('/offerings');
  });

  it('updateOfferingAction returns not_found when no row updated (no buyerRole sync runs)', async () => {
    mocks.updateOffering.mockResolvedValue(undefined);

    const result = await updateOfferingAction(999, validOfferingInput);

    expect(result).toEqual({ ok: false, reason: 'not_found' });
    expect(mocks.listBuyerRolesForOffering).not.toHaveBeenCalled();
    expect(mocks.insertOfferingBuyerRole).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  // ---- archiveOfferingAction ----

  it('archiveOfferingAction flips status to retired and revalidates', async () => {
    const result = await archiveOfferingAction(100);

    expect(result).toEqual({ ok: true });
    expect(
      mocks.requireStaffAccess.mock.invocationCallOrder[0] <
        mocks.updateOffering.mock.invocationCallOrder[0]
    ).toBe(true);
    // Offering uses the 3-value catalogStatusEnum — 'retired' IS valid here
    // (unlike Practice Area's 2-value enum where archive is 'draft').
    expect(mocks.updateOffering).toHaveBeenCalledWith(100, { status: 'retired' }, 'user_123');
    expect(revalidatePath).toHaveBeenCalledWith('/offerings');
  });

  it('archiveOfferingAction returns not_found when no row updated', async () => {
    mocks.updateOffering.mockResolvedValue(undefined);

    const result = await archiveOfferingAction(999);

    expect(result).toEqual({ ok: false, reason: 'not_found' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  // ---- deleteOfferingAction ----

  it('deleteOfferingAction passes has_dependents straight through without revalidation', async () => {
    mocks.deleteOffering.mockResolvedValue({ ok: false, reason: 'has_dependents' });

    const result = await deleteOfferingAction(100);

    expect(result).toEqual({ ok: false, reason: 'has_dependents' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('deleteOfferingAction revalidates and returns ok when the delete succeeds', async () => {
    const result = await deleteOfferingAction(100);

    expect(result).toEqual({ ok: true });
    expect(mocks.deleteOffering).toHaveBeenCalledWith(100);
    expect(revalidatePath).toHaveBeenCalledWith('/offerings');
  });

  // ---- reorderOfferingsAction ----

  it('reorderOfferingsAction calls updateOfferingSortOrder once per id in order', async () => {
    const result = await reorderOfferingsAction([3, 1, 2]);

    expect(result).toEqual({ ok: true });
    expect(mocks.updateOfferingSortOrder).toHaveBeenCalledTimes(3);
    expect(mocks.updateOfferingSortOrder).toHaveBeenNthCalledWith(1, 3, 0, 'user_123');
    expect(mocks.updateOfferingSortOrder).toHaveBeenNthCalledWith(2, 1, 1, 'user_123');
    expect(mocks.updateOfferingSortOrder).toHaveBeenNthCalledWith(3, 2, 2, 'user_123');
    expect(revalidatePath).toHaveBeenCalledWith('/offerings');
  });

  // ---- updateOfferingBuyerRolesAction (Matrix Popover immediate-persist) ----

  it('updateOfferingBuyerRolesAction calls the sync helper directly without touching updateOffering', async () => {
    const result = await updateOfferingBuyerRolesAction(50, [{ buyerRoleId: 5, rank: 1 }]);

    expect(result).toEqual({ ok: true });
    expect(
      mocks.requireStaffAccess.mock.invocationCallOrder[0] <
        mocks.insertOfferingBuyerRole.mock.invocationCallOrder[0]
    ).toBe(true);
    // No existing links → the new role is inserted, and the offering row
    // itself is never touched.
    expect(mocks.insertOfferingBuyerRole).toHaveBeenCalledTimes(1);
    expect(mocks.insertOfferingBuyerRole).toHaveBeenCalledWith({
      offeringId: 50,
      buyerRoleId: 5,
      rank: 1,
      createdBy: 'user_123',
    });
    expect(mocks.updateOffering).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith('/offerings');
  });
});

describe('offerings actions — triggers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireStaffAccess.mockResolvedValue({ userId: 'user_123' });
    mocks.listTriggersForOffering.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    mocks.insertTrigger.mockResolvedValue({ id: 3 });
    mocks.deleteTrigger.mockResolvedValue(undefined);
  });

  it('createTriggerAction computes sortOrder from listTriggersForOffering count and inserts', async () => {
    const result = await createTriggerAction({
      offeringId: 5,
      triggerText: 'New CFO announced',
    });

    expect(result).toEqual({ ok: true });
    expect(
      mocks.requireStaffAccess.mock.invocationCallOrder[0] <
        mocks.insertTrigger.mock.invocationCallOrder[0]
    ).toBe(true);
    // sortOrder appends after the two existing triggers — never client-supplied.
    expect(mocks.listTriggersForOffering).toHaveBeenCalledWith(5);
    expect(mocks.insertTrigger).toHaveBeenCalledWith({
      offeringId: 5,
      triggerText: 'New CFO announced',
      sortOrder: 2,
      createdBy: 'user_123',
    });
    expect(revalidatePath).toHaveBeenCalledWith('/offerings');
  });

  it('createTriggerAction rejects invalid_input when triggerText is empty', async () => {
    const result = await createTriggerAction({ offeringId: 5, triggerText: '' });

    expect(result).toEqual({ ok: false, reason: 'invalid_input' });
    expect(mocks.insertTrigger).not.toHaveBeenCalled();
    expect(mocks.listTriggersForOffering).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('deleteTriggerAction calls requireStaffAccess first, then deleteTrigger unconditionally, and revalidates', async () => {
    const result = await deleteTriggerAction(42);

    expect(result).toEqual({ ok: true });
    expect(
      mocks.requireStaffAccess.mock.invocationCallOrder[0] <
        mocks.deleteTrigger.mock.invocationCallOrder[0]
    ).toBe(true);
    expect(mocks.deleteTrigger).toHaveBeenCalledWith(42);
    expect(revalidatePath).toHaveBeenCalledWith('/offerings');
  });

  it('deleteTriggerAction maps an unexpected throw to action_failed', async () => {
    mocks.deleteTrigger.mockRejectedValue(new Error('db down'));

    const result = await deleteTriggerAction(42);

    expect(result).toEqual({ ok: false, reason: 'action_failed' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
