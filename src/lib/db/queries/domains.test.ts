import { beforeEach, describe, expect, it, vi } from 'vitest';

// 30-02 anchor: domain query module — insert scoped to a practice area,
// listDomainsForPracticeArea, the Pitfall-3 explicit updatedAt/updatedBy stamp,
// and the DATA-10 delete guard (single-dependent-table shape: offering only,
// mirroring importBatches.ts's hasPersonaDependents). Pure unit on the query
// functions with a stubbed drizzle client — no live DB (D-16).
const mocks = vi.hoisted(() => ({
  db: { insert: vi.fn(), select: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));

vi.mock('../index', () => ({ db: mocks.db }));

import {
  insertDomain,
  updateDomain,
  listDomainsForPracticeArea,
  hasDomainDependents,
  deleteDomain,
} from './domains';
import { domain, offering, practiceArea } from '../schema';

describe('domains query module (30-02)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts a domain scoped to a practice area with updatedBy equal to createdBy', async () => {
    const inserted = {
      id: 3,
      practiceAreaId: 7,
      name: 'Design',
      sortOrder: 1,
      createdBy: 'user-1',
      updatedBy: 'user-1',
    };
    const returning = vi.fn().mockResolvedValue([inserted]);
    const values = vi.fn().mockReturnValue({ returning });
    mocks.db.insert.mockReturnValue({ values });

    const result = await insertDomain({
      practiceAreaId: 7,
      name: 'Design',
      sortOrder: 1,
      createdBy: 'user-1',
    });

    expect(mocks.db.insert).toHaveBeenCalledWith(domain);
    // Insert-time convention: updatedBy starts equal to createdBy (T-30-03).
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        practiceAreaId: 7,
        name: 'Design',
        sortOrder: 1,
        createdBy: 'user-1',
        updatedBy: 'user-1',
      })
    );
    expect(result).toEqual(inserted);
  });

  it('listDomainsForPracticeArea returns only that practice area’s domains ordered by sortOrder', async () => {
    const rows = [{ id: 3, practiceAreaId: 7, name: 'Design', sortOrder: 1 }];
    const orderBy = vi.fn().mockResolvedValue(rows);
    const where = vi.fn().mockReturnValue({ orderBy });
    const from = vi.fn().mockReturnValue({ where });
    mocks.db.select.mockReturnValue({ from });

    const result = await listDomainsForPracticeArea(7);

    expect(result).toEqual(rows);
    expect(from).toHaveBeenCalledWith(domain);
    expect(where).toHaveBeenCalledTimes(1);
    expect(orderBy).toHaveBeenCalled();
  });

  it('updateDomain explicitly stamps updatedAt and updatedBy on top of the patch', async () => {
    const updated = { id: 3, name: 'Renamed', sortOrder: 1, updatedBy: 'user-2' };
    const returning = vi.fn().mockResolvedValue([updated]);
    const where = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where });
    mocks.db.update.mockReturnValue({ set });

    const result = await updateDomain(3, { name: 'Renamed' }, 'user-2');

    expect(mocks.db.update).toHaveBeenCalledWith(domain);
    // Drizzle never auto-touches updatedAt/updatedBy (Pitfall 3) — the query
    // function must stamp them explicitly in the .set() clause.
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Renamed', updatedAt: expect.any(Date), updatedBy: 'user-2' })
    );
    expect(result).toEqual(updated);
  });

  it('hasDomainDependents short-circuits true when an offering references the domain', async () => {
    const limit = vi.fn().mockResolvedValue([{ one: 1 }]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    mocks.db.select.mockReturnValue({ from });

    const result = await hasDomainDependents(3);

    expect(result).toBe(true);
    expect(from).toHaveBeenCalledWith(offering);
    expect(mocks.db.select).toHaveBeenCalledTimes(1);
  });

  it('hasDomainDependents returns false when no offering references the domain', async () => {
    const limit = vi.fn().mockResolvedValue([]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    mocks.db.select.mockReturnValue({ from });

    const result = await hasDomainDependents(3);

    expect(result).toBe(false);
    expect(from).toHaveBeenCalledWith(offering);
    expect(mocks.db.select).toHaveBeenCalledTimes(1);
  });

  it('deleteDomain returns has_dependents without deleting when a dependent offering exists', async () => {
    const limit = vi.fn().mockResolvedValue([{ one: 1 }]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    mocks.db.select.mockReturnValue({ from });

    const result = await deleteDomain(3);

    expect(result).toEqual({ ok: false, reason: 'has_dependents' });
    expect(mocks.db.delete).not.toHaveBeenCalled();
  });

  it('deleteDomain removes the row and returns ok when no dependents exist', async () => {
    const limit = vi.fn().mockResolvedValue([]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    mocks.db.select.mockReturnValue({ from });
    const deleteWhere = vi.fn().mockResolvedValue([{ id: 3 }]);
    mocks.db.delete.mockReturnValue({ where: deleteWhere });

    const result = await deleteDomain(3);

    expect(result).toEqual({ ok: true });
    expect(mocks.db.delete).toHaveBeenCalledWith(domain);
    expect(deleteWhere).toHaveBeenCalled();
  });
});
