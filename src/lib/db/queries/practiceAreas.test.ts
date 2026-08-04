import { beforeEach, describe, expect, it, vi } from 'vitest';

// 30-02 anchor: practice_area query module — insert/list-all/list-active CRUD,
// the Pitfall-3 explicit updatedAt/updatedBy stamp, and the DATA-10 delete
// guard (hasPracticeAreaDependents → discriminated-union result). Pure unit on
// the query functions with a stubbed drizzle client — no live DB (D-16).
// Mirrors proposals.test.ts's mock-hoisting structure; `delete` is added to
// the db mock because deletePracticeArea calls db.delete.
const mocks = vi.hoisted(() => ({
  db: { insert: vi.fn(), select: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));

vi.mock('../index', () => ({ db: mocks.db }));

import {
  insertPracticeArea,
  updatePracticeArea,
  listAllPracticeAreas,
  listActivePracticeAreas,
  hasPracticeAreaDependents,
  deletePracticeArea,
} from './practiceAreas';
import { companySignal, domain, offering, personaSignal, practiceArea } from '../schema';

describe('practiceAreas query module (30-02)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts a practice area with updatedBy equal to createdBy and returns the inserted row', async () => {
    const inserted = {
      id: 7,
      name: 'GBS — Design, Build & Run',
      shortCode: 'GBS',
      sortOrder: 1,
      description: null,
      status: 'active',
      createdBy: 'user-1',
      updatedBy: 'user-1',
    };
    const returning = vi.fn().mockResolvedValue([inserted]);
    const values = vi.fn().mockReturnValue({ returning });
    mocks.db.insert.mockReturnValue({ values });

    const result = await insertPracticeArea({
      name: 'GBS — Design, Build & Run',
      shortCode: 'GBS',
      sortOrder: 1,
      status: 'active',
      createdBy: 'user-1',
    });

    expect(mocks.db.insert).toHaveBeenCalledWith(practiceArea);
    // Insert-time convention: updatedBy starts equal to createdBy (T-30-03).
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'GBS — Design, Build & Run',
        shortCode: 'GBS',
        sortOrder: 1,
        status: 'active',
        createdBy: 'user-1',
        updatedBy: 'user-1',
      })
    );
    expect(result).toEqual(inserted);
  });

  it('listAllPracticeAreas returns every row ordered by sortOrder regardless of status', async () => {
    const rows = [
      { id: 1, name: 'active one', sortOrder: 1 },
      { id: 2, name: 'draft one', sortOrder: 2 },
    ];
    const orderBy = vi.fn().mockResolvedValue(rows);
    const from = vi.fn().mockReturnValue({ orderBy });
    mocks.db.select.mockReturnValue({ from });

    const result = await listAllPracticeAreas();

    expect(result).toEqual(rows);
    expect(from).toHaveBeenCalledWith(practiceArea);
    expect(orderBy).toHaveBeenCalled();
  });

  it('listActivePracticeAreas filters to active rows only', async () => {
    const rows = [{ id: 1, name: 'active one', status: 'active', sortOrder: 1 }];
    const orderBy = vi.fn().mockResolvedValue(rows);
    const where = vi.fn().mockReturnValue({ orderBy });
    const from = vi.fn().mockReturnValue({ where });
    mocks.db.select.mockReturnValue({ from });

    const result = await listActivePracticeAreas();

    expect(result).toEqual(rows);
    // Draft practice areas are hidden from the Signals picker (spec Section 2.1).
    expect(where).toHaveBeenCalledTimes(1);
    expect(orderBy).toHaveBeenCalled();
  });

  it('updatePracticeArea explicitly stamps updatedAt and updatedBy on top of the patch', async () => {
    const updated = { id: 7, name: 'Renamed', sortOrder: 1, updatedBy: 'user-2' };
    const returning = vi.fn().mockResolvedValue([updated]);
    const where = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where });
    mocks.db.update.mockReturnValue({ set });

    const result = await updatePracticeArea(7, { name: 'Renamed' }, 'user-2');

    expect(mocks.db.update).toHaveBeenCalledWith(practiceArea);
    // Drizzle never auto-touches updatedAt/updatedBy (Pitfall 3) — the query
    // function must stamp them explicitly in the .set() clause.
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Renamed', updatedAt: expect.any(Date), updatedBy: 'user-2' })
    );
    expect(where).toHaveBeenCalled();
    expect(result).toEqual(updated);
  });

  it('updatePracticeArea stamps updatedAt/updatedBy even when the patch has no other changes', async () => {
    const returning = vi.fn().mockResolvedValue([{ id: 7, updatedBy: 'user-2' }]);
    const where = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where });
    mocks.db.update.mockReturnValue({ set });

    await updatePracticeArea(7, {}, 'user-2');

    // Empty patch: the set clause is STILL the two audit stamps and nothing
    // else — proving the update never silently skips attribution.
    expect(set).toHaveBeenCalledWith({ updatedAt: expect.any(Date), updatedBy: 'user-2' });
  });

  it('hasPracticeAreaDependents short-circuits true on a domain hit', async () => {
    const limit = vi.fn().mockResolvedValue([{ one: 1 }]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    mocks.db.select.mockReturnValue({ from });

    const result = await hasPracticeAreaDependents(5);

    expect(result).toBe(true);
    expect(from).toHaveBeenCalledWith(domain);
    // Short-circuit: the first dependent table checked returns a hit, so no
    // further existence query runs.
    expect(mocks.db.select).toHaveBeenCalledTimes(1);
  });

  it('hasPracticeAreaDependents walks all four dependent tables and returns false when none match', async () => {
    const limit = vi.fn().mockResolvedValue([]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    mocks.db.select.mockReturnValue({ from });

    const result = await hasPracticeAreaDependents(5);

    expect(result).toBe(false);
    expect(mocks.db.select).toHaveBeenCalledTimes(4);
    expect(from).toHaveBeenCalledWith(domain);
    expect(from).toHaveBeenCalledWith(offering);
    expect(from).toHaveBeenCalledWith(companySignal);
    expect(from).toHaveBeenCalledWith(personaSignal);
  });

  it('deletePracticeArea returns has_dependents without deleting when a dependent exists', async () => {
    const limit = vi.fn().mockResolvedValue([{ one: 1 }]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    mocks.db.select.mockReturnValue({ from });

    const result = await deletePracticeArea(5);

    expect(result).toEqual({ ok: false, reason: 'has_dependents' });
    expect(mocks.db.delete).not.toHaveBeenCalled();
  });

  it('deletePracticeArea removes the row and returns ok when no dependents exist', async () => {
    const limit = vi.fn().mockResolvedValue([]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    mocks.db.select.mockReturnValue({ from });
    const deleteWhere = vi.fn().mockResolvedValue([{ id: 5 }]);
    mocks.db.delete.mockReturnValue({ where: deleteWhere });

    const result = await deletePracticeArea(5);

    expect(result).toEqual({ ok: true });
    expect(mocks.db.delete).toHaveBeenCalledWith(practiceArea);
    expect(deleteWhere).toHaveBeenCalled();
  });
});
