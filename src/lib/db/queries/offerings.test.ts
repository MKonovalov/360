import { beforeEach, describe, expect, it, vi } from 'vitest';

// 30-03 anchor: offering query module — CRUD with the insert-time
// updatedBy=createdBy convention, the Pitfall-3 explicit updatedAt/updatedBy
// stamp, and the picker-vs-admin active/all split (spec Section 3
// draft-exclusion rule: status='draft' offerings must never surface in a
// picker). Pure unit on the query functions with a stubbed drizzle client —
// no live DB (D-16). Mirrors proposals.test.ts's mock-hoisting structure;
// `delete` is added to the db mock because deleteOffering calls db.delete.
const mocks = vi.hoisted(() => ({
  db: { insert: vi.fn(), select: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));

vi.mock('../index', () => ({ db: mocks.db }));

import {
  insertOffering,
  updateOffering,
  listAllOfferingsForPracticeArea,
  listActiveOfferingsForPracticeArea,
  insertOfferingBuyerRole,
  insertTrigger,
  listTriggersForOffering,
  listBuyerRolesForOffering,
  hasOfferingDependents,
  deleteOffering,
} from './offerings';
import { buyerRole, offering, offeringBuyerRole, signalOfferingLink, trigger } from '../schema';

// Flattens a Drizzle SQL expression's queryChunks into a single string so a
// .where() argument can be asserted on its literal contents (param values,
// SQL keywords) without depending on the exact chunk tree shape. Column
// references do not flatten to readable names (their table refs are
// symbol-keyed), so assertions target the injected param values — e.g. the
// practice-area id and the 'active' status literal.
function flattenSql(sql: unknown): string {
  if (sql === null || sql === undefined) return '';
  if (typeof sql === 'object') {
    const obj = sql as Record<string, unknown>;
    if ('queryChunks' in obj && Array.isArray(obj.queryChunks)) {
      return obj.queryChunks.map(flattenSql).join('');
    }
    if ('brand' in obj || 'value' in obj) {
      return String(obj.value);
    }
    return '';
  }
  return String(sql);
}

describe('offerings query module (30-03)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts an offering with updatedBy equal to createdBy and returns the inserted row', async () => {
    const inserted = {
      id: 11,
      practiceAreaId: 1,
      domainId: null,
      name: 'GBS Diagnostic',
      offerType: 'entry',
      description: 'Rapid GBS health check',
      commercialModelText: null,
      sortOrder: 1,
      status: 'active',
      createdBy: 'user-1',
      updatedBy: 'user-1',
    };
    const returning = vi.fn().mockResolvedValue([inserted]);
    const values = vi.fn().mockReturnValue({ returning });
    mocks.db.insert.mockReturnValue({ values });

    const result = await insertOffering({
      practiceAreaId: 1,
      name: 'GBS Diagnostic',
      offerType: 'entry',
      description: 'Rapid GBS health check',
      sortOrder: 1,
      createdBy: 'user-1',
    });

    expect(mocks.db.insert).toHaveBeenCalledWith(offering);
    // Insert-time convention: updatedBy starts equal to createdBy (T-30-03).
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        practiceAreaId: 1,
        name: 'GBS Diagnostic',
        offerType: 'entry',
        description: 'Rapid GBS health check',
        sortOrder: 1,
        createdBy: 'user-1',
        updatedBy: 'user-1',
      })
    );
    expect(result).toEqual(inserted);
  });

  it('listAllOfferingsForPracticeArea returns every offering for the area regardless of status, ordered by sortOrder', async () => {
    const rows = [
      { id: 1, name: 'active offering', sortOrder: 1, status: 'active' },
      { id: 2, name: 'draft offering', sortOrder: 2, status: 'draft' },
    ];
    const orderBy = vi.fn().mockResolvedValue(rows);
    const where = vi.fn().mockReturnValue({ orderBy });
    const from = vi.fn().mockReturnValue({ where });
    mocks.db.select.mockReturnValue({ from });

    const result = await listAllOfferingsForPracticeArea(1);

    expect(result).toEqual(rows);
    expect(from).toHaveBeenCalledWith(offering);
    // Admin query: scoped to the practice area (param 1), no status filter
    // (draft/retired visible), ordered by sortOrder.
    expect(flattenSql(where.mock.calls[0][0])).toContain('1');
    expect(flattenSql(where.mock.calls[0][0])).not.toContain('active');
    expect(orderBy).toHaveBeenCalled();
  });

  it('listActiveOfferingsForPracticeArea filters to status=active AND practice area — the picker-safe query', async () => {
    const rows = [{ id: 1, name: 'active offering', sortOrder: 1, status: 'active' }];
    const orderBy = vi.fn().mockResolvedValue(rows);
    const where = vi.fn().mockReturnValue({ orderBy });
    const from = vi.fn().mockReturnValue({ where });
    mocks.db.select.mockReturnValue({ from });

    const result = await listActiveOfferingsForPracticeArea(42);

    expect(result).toEqual(rows);
    expect(from).toHaveBeenCalledWith(offering);
    // Picker (Phase 31/32): the where clause ANDs the practice-area scope
    // (param 42) with the status='active' filter (param 'active') — spec
    // Section 3 draft-exclusion rule — never just the practice area alone.
    const whereSql = flattenSql(where.mock.calls[0][0]);
    expect(whereSql).toContain('42');
    expect(whereSql).toContain('active');
    expect(orderBy).toHaveBeenCalled();
  });

  it('updateOffering explicitly stamps updatedAt and updatedBy on top of the patch', async () => {
    const updated = { id: 11, name: 'Renamed', updatedBy: 'user-2' };
    const returning = vi.fn().mockResolvedValue([updated]);
    const where = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where });
    mocks.db.update.mockReturnValue({ set });

    const result = await updateOffering(11, { name: 'Renamed' }, 'user-2');

    expect(mocks.db.update).toHaveBeenCalledWith(offering);
    // Drizzle never auto-touches updatedAt/updatedBy (Pitfall 3) — the query
    // function must stamp them explicitly in the .set() clause.
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Renamed', updatedAt: expect.any(Date), updatedBy: 'user-2' })
    );
    expect(where).toHaveBeenCalled();
    expect(result).toEqual(updated);
  });

  it('updateOffering stamps updatedAt/updatedBy even when the patch has no other changes', async () => {
    const returning = vi.fn().mockResolvedValue([{ id: 11, updatedBy: 'user-2' }]);
    const where = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where });
    mocks.db.update.mockReturnValue({ set });

    await updateOffering(11, {}, 'user-2');

    // Empty patch: the set clause is STILL the two audit stamps and nothing
    // else — proving the update never silently skips attribution.
    expect(set).toHaveBeenCalledWith({ updatedAt: expect.any(Date), updatedBy: 'user-2' });
  });

  it('insertOfferingBuyerRole inserts a ranked buyer-role link with updatedBy equal to createdBy', async () => {
    const inserted = { id: 1, offeringId: 11, buyerRoleId: 2, rank: 1 };
    const returning = vi.fn().mockResolvedValue([inserted]);
    const values = vi.fn().mockReturnValue({ returning });
    mocks.db.insert.mockReturnValue({ values });

    const result = await insertOfferingBuyerRole({ offeringId: 11, buyerRoleId: 2, rank: 1, createdBy: 'user-1' });

    expect(mocks.db.insert).toHaveBeenCalledWith(offeringBuyerRole);
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ offeringId: 11, buyerRoleId: 2, rank: 1, createdBy: 'user-1', updatedBy: 'user-1' })
    );
    expect(result).toEqual(inserted);
  });

  it('insertTrigger inserts a trigger row for an offering with updatedBy equal to createdBy', async () => {
    const inserted = { id: 1, offeringId: 11, triggerText: 'New CFO appointed', sortOrder: 1 };
    const returning = vi.fn().mockResolvedValue([inserted]);
    const values = vi.fn().mockReturnValue({ returning });
    mocks.db.insert.mockReturnValue({ values });

    const result = await insertTrigger({ offeringId: 11, triggerText: 'New CFO appointed', sortOrder: 1, createdBy: 'user-1' });

    expect(mocks.db.insert).toHaveBeenCalledWith(trigger);
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ offeringId: 11, triggerText: 'New CFO appointed', sortOrder: 1, createdBy: 'user-1', updatedBy: 'user-1' })
    );
    expect(result).toEqual(inserted);
  });

  it('listTriggersForOffering returns the offering triggers ordered by sortOrder', async () => {
    const rows = [{ id: 1, triggerText: 'First', sortOrder: 1 }, { id: 2, triggerText: 'Second', sortOrder: 2 }];
    const orderBy = vi.fn().mockResolvedValue(rows);
    const where = vi.fn().mockReturnValue({ orderBy });
    const from = vi.fn().mockReturnValue({ where });
    mocks.db.select.mockReturnValue({ from });

    const result = await listTriggersForOffering(11);

    expect(result).toEqual(rows);
    expect(from).toHaveBeenCalledWith(trigger);
    expect(where).toHaveBeenCalled();
    expect(orderBy).toHaveBeenCalled();
  });

  it('listBuyerRolesForOffering joins buyerRole.name and orders by rank', async () => {
    const rows = [
      { buyerRoleId: 1, name: 'CFO', rank: 1 },
      { buyerRoleId: 2, name: 'Head of GBS', rank: 2 },
    ];
    const orderBy = vi.fn().mockResolvedValue(rows);
    const where = vi.fn().mockReturnValue({ orderBy });
    const innerJoin = vi.fn().mockReturnValue({ where });
    const from = vi.fn().mockReturnValue({ innerJoin });
    mocks.db.select.mockReturnValue({ from });

    const result = await listBuyerRolesForOffering(11);

    expect(result).toEqual(rows);
    expect(from).toHaveBeenCalledWith(offeringBuyerRole);
    expect(innerJoin).toHaveBeenCalledWith(buyerRole, expect.anything());
    expect(where).toHaveBeenCalled();
    expect(orderBy).toHaveBeenCalled();
  });

  it('hasOfferingDependents short-circuits true on an offeringBuyerRole hit alone', async () => {
    const limit = vi.fn().mockResolvedValue([{ one: 1 }]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    mocks.db.select.mockReturnValue({ from });

    const result = await hasOfferingDependents(11);

    expect(result).toBe(true);
    expect(from).toHaveBeenCalledWith(offeringBuyerRole);
    // Short-circuit: the first dependent table checked returns a hit, so no
    // further existence query runs.
    expect(mocks.db.select).toHaveBeenCalledTimes(1);
  });

  it('hasOfferingDependents returns true on a trigger hit alone (offeringBuyerRole empty)', async () => {
    const limit = vi
      .fn()
      .mockResolvedValueOnce([]) // offeringBuyerRole: no match
      .mockResolvedValueOnce([{ one: 1 }]); // trigger: match
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    mocks.db.select.mockReturnValue({ from });

    const result = await hasOfferingDependents(11);

    expect(result).toBe(true);
    expect(mocks.db.select).toHaveBeenCalledTimes(2);
    expect(from).toHaveBeenCalledWith(offeringBuyerRole);
    expect(from).toHaveBeenCalledWith(trigger);
  });

  it('hasOfferingDependents returns true on a signalOfferingLink hit alone (both prior tables empty)', async () => {
    const limit = vi
      .fn()
      .mockResolvedValueOnce([]) // offeringBuyerRole: no match
      .mockResolvedValueOnce([]) // trigger: no match
      .mockResolvedValueOnce([{ one: 1 }]); // signalOfferingLink: match
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    mocks.db.select.mockReturnValue({ from });

    const result = await hasOfferingDependents(11);

    expect(result).toBe(true);
    expect(mocks.db.select).toHaveBeenCalledTimes(3);
    expect(from).toHaveBeenCalledWith(offeringBuyerRole);
    expect(from).toHaveBeenCalledWith(trigger);
    expect(from).toHaveBeenCalledWith(signalOfferingLink);
  });

  it('hasOfferingDependents returns false when none of the three dependent tables match', async () => {
    const limit = vi.fn().mockResolvedValue([]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    mocks.db.select.mockReturnValue({ from });

    const result = await hasOfferingDependents(11);

    expect(result).toBe(false);
    expect(mocks.db.select).toHaveBeenCalledTimes(3);
    expect(from).toHaveBeenCalledWith(offeringBuyerRole);
    expect(from).toHaveBeenCalledWith(trigger);
    expect(from).toHaveBeenCalledWith(signalOfferingLink);
  });

  it('deleteOffering returns has_dependents without deleting when a dependent exists', async () => {
    const limit = vi.fn().mockResolvedValue([{ one: 1 }]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    mocks.db.select.mockReturnValue({ from });

    const result = await deleteOffering(11);

    expect(result).toEqual({ ok: false, reason: 'has_dependents' });
    expect(mocks.db.delete).not.toHaveBeenCalled();
  });

  it('deleteOffering removes the row and returns ok when no dependents exist', async () => {
    const limit = vi.fn().mockResolvedValue([]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    mocks.db.select.mockReturnValue({ from });
    const deleteWhere = vi.fn().mockResolvedValue([{ id: 11 }]);
    mocks.db.delete.mockReturnValue({ where: deleteWhere });

    const result = await deleteOffering(11);

    expect(result).toEqual({ ok: true });
    expect(mocks.db.delete).toHaveBeenCalledWith(offering);
    expect(deleteWhere).toHaveBeenCalled();
  });
});
