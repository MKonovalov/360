import { beforeEach, describe, expect, it, vi } from 'vitest';

// 30-02 anchor: buyer_role query module — insert/list/update CRUD, the
// Pitfall-3 explicit updatedAt/updatedBy stamp, and the DATA-10 delete guard
// with a TWO-table dependent check (offeringBuyerRole OR personaSignal —
// structural copy of importBatches.ts's hasCompanyDependents). Pure unit on
// the query functions with a stubbed drizzle client — no live DB (D-16).
const mocks = vi.hoisted(() => ({
  db: { insert: vi.fn(), select: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));

vi.mock('../index', () => ({ db: mocks.db }));

import {
  insertBuyerRole,
  updateBuyerRole,
  listBuyerRoles,
  hasBuyerRoleDependents,
  deleteBuyerRole,
} from './buyerRoles';
import { buyerRole, offeringBuyerRole, personaSignal } from '../schema';

describe('buyerRoles query module (30-02)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts a buyer role with updatedBy equal to createdBy and returns the inserted row', async () => {
    const inserted = {
      id: 9,
      name: 'CFO',
      description: null,
      createdBy: 'user-1',
      updatedBy: 'user-1',
    };
    const returning = vi.fn().mockResolvedValue([inserted]);
    const values = vi.fn().mockReturnValue({ returning });
    mocks.db.insert.mockReturnValue({ values });

    const result = await insertBuyerRole({ name: 'CFO', createdBy: 'user-1' });

    expect(mocks.db.insert).toHaveBeenCalledWith(buyerRole);
    // Insert-time convention: updatedBy starts equal to createdBy (T-30-03).
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'CFO',
        createdBy: 'user-1',
        updatedBy: 'user-1',
      })
    );
    expect(result).toEqual(inserted);
  });

  it('listBuyerRoles returns all buyer roles (no status filter — plain reusable lookup)', async () => {
    const rows = [{ id: 9, name: 'CFO' }, { id: 10, name: 'Head of GBS' }];
    const orderBy = vi.fn().mockResolvedValue(rows);
    const from = vi.fn().mockReturnValue({ orderBy });
    mocks.db.select.mockReturnValue({ from });

    const result = await listBuyerRoles();

    expect(result).toEqual(rows);
    expect(from).toHaveBeenCalledWith(buyerRole);
    expect(orderBy).toHaveBeenCalled();
  });

  it('updateBuyerRole explicitly stamps updatedAt and updatedBy on top of the patch', async () => {
    const updated = { id: 9, name: 'Chief Financial Officer', updatedBy: 'user-2' };
    const returning = vi.fn().mockResolvedValue([updated]);
    const where = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where });
    mocks.db.update.mockReturnValue({ set });

    const result = await updateBuyerRole(9, { name: 'Chief Financial Officer' }, 'user-2');

    expect(mocks.db.update).toHaveBeenCalledWith(buyerRole);
    // Drizzle never auto-touches updatedAt/updatedBy (Pitfall 3) — the query
    // function must stamp them explicitly in the .set() clause.
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Chief Financial Officer',
        updatedAt: expect.any(Date),
        updatedBy: 'user-2',
      })
    );
    expect(result).toEqual(updated);
  });

  it('hasBuyerRoleDependents short-circuits true on an offeringBuyerRole hit alone', async () => {
    const limit = vi.fn().mockResolvedValue([{ one: 1 }]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    mocks.db.select.mockReturnValue({ from });

    const result = await hasBuyerRoleDependents(9);

    expect(result).toBe(true);
    expect(from).toHaveBeenCalledWith(offeringBuyerRole);
    // Short-circuit: the first dependent table checked returns a hit, so the
    // personaSignal check never runs.
    expect(mocks.db.select).toHaveBeenCalledTimes(1);
  });

  it('hasBuyerRoleDependents returns true on a personaSignal hit alone (offeringBuyerRole empty)', async () => {
    const limit = vi
      .fn()
      .mockResolvedValueOnce([]) // offeringBuyerRole: no match
      .mockResolvedValueOnce([{ one: 1 }]); // personaSignal: match
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    mocks.db.select.mockReturnValue({ from });

    const result = await hasBuyerRoleDependents(9);

    expect(result).toBe(true);
    expect(mocks.db.select).toHaveBeenCalledTimes(2);
    expect(from).toHaveBeenCalledWith(offeringBuyerRole);
    expect(from).toHaveBeenCalledWith(personaSignal);
  });

  it('hasBuyerRoleDependents returns false when neither dependent table has a match', async () => {
    const limit = vi.fn().mockResolvedValue([]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    mocks.db.select.mockReturnValue({ from });

    const result = await hasBuyerRoleDependents(9);

    expect(result).toBe(false);
    expect(mocks.db.select).toHaveBeenCalledTimes(2);
    expect(from).toHaveBeenCalledWith(offeringBuyerRole);
    expect(from).toHaveBeenCalledWith(personaSignal);
  });

  it('deleteBuyerRole returns has_dependents without deleting when an offeringBuyerRole references it', async () => {
    const limit = vi.fn().mockResolvedValue([{ one: 1 }]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    mocks.db.select.mockReturnValue({ from });

    const result = await deleteBuyerRole(9);

    expect(result).toEqual({ ok: false, reason: 'has_dependents' });
    expect(mocks.db.delete).not.toHaveBeenCalled();
  });

  it('deleteBuyerRole returns has_dependents when only a personaSignal references it', async () => {
    const limit = vi
      .fn()
      .mockResolvedValueOnce([]) // offeringBuyerRole: no match
      .mockResolvedValueOnce([{ one: 1 }]); // personaSignal: match
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    mocks.db.select.mockReturnValue({ from });

    const result = await deleteBuyerRole(9);

    expect(result).toEqual({ ok: false, reason: 'has_dependents' });
    expect(mocks.db.delete).not.toHaveBeenCalled();
  });

  it('deleteBuyerRole removes the row and returns ok when no dependents exist', async () => {
    const limit = vi.fn().mockResolvedValue([]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    mocks.db.select.mockReturnValue({ from });
    const deleteWhere = vi.fn().mockResolvedValue([{ id: 9 }]);
    mocks.db.delete.mockReturnValue({ where: deleteWhere });

    const result = await deleteBuyerRole(9);

    expect(result).toEqual({ ok: true });
    expect(mocks.db.delete).toHaveBeenCalledWith(buyerRole);
    expect(deleteWhere).toHaveBeenCalled();
  });
});
