import { beforeEach, describe, expect, it, vi } from 'vitest';

// 30-04 anchor: persona_signal query module — same shape as companySignals.ts
// extended with the required buyerRoleId (DATA-07: every persona signal
// references a real buyer_role — never null, never a placeholder). Covers the
// insert-time updatedBy=createdBy convention, the Pitfall-3 explicit
// updatedAt/updatedBy stamp, the picker-vs-admin active/all split, and the
// distinct-categories helper (category stays free text — no enum). Pure unit
// on the query functions with a stubbed drizzle client — no live DB (D-16).
// Mirrors companySignals.test.ts's mock-hoisting structure; `selectDistinct`
// is added to the db mock because listDistinctPersonaSignalCategories calls it.
const mocks = vi.hoisted(() => ({
  db: { insert: vi.fn(), select: vi.fn(), update: vi.fn(), selectDistinct: vi.fn() },
}));

vi.mock('../index', () => ({ db: mocks.db }));

import {
  insertPersonaSignal,
  updatePersonaSignal,
  listAllPersonaSignalsForPracticeArea,
  listActivePersonaSignalsForPracticeArea,
  listDistinctPersonaSignalCategories,
  listActivePersonaSignalCategoriesForPracticeArea,
  listActivePersonaSignalsForPracticeAreaAndCategory,
} from './personaSignals';
import { personaSignal } from '../schema';

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

describe('personaSignals query module (30-04)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts a persona signal with required buyerRoleId, updatedBy equal to createdBy, category passed through unmodified as free text', async () => {
    const inserted = {
      id: 1,
      practiceAreaId: 1,
      buyerRoleId: 2,
      name: 'CFO mandates a GBS review in first 90 days',
      category: 'Tenure/mandate',
      description: 'New CFO signals early transformation intent',
      status: 'active',
      createdBy: 'user-1',
      updatedBy: 'user-1',
    };
    const returning = vi.fn().mockResolvedValue([inserted]);
    const values = vi.fn().mockReturnValue({ returning });
    mocks.db.insert.mockReturnValue({ values });

    const result = await insertPersonaSignal({
      practiceAreaId: 1,
      // DATA-07: buyerRoleId is a required field at the type level — the
      // insert payload always carries a real buyer_role id.
      buyerRoleId: 2,
      name: 'CFO mandates a GBS review in first 90 days',
      category: 'Tenure/mandate',
      description: 'New CFO signals early transformation intent',
      createdBy: 'user-1',
    });

    expect(mocks.db.insert).toHaveBeenCalledWith(personaSignal);
    // Insert-time convention: updatedBy starts equal to createdBy (T-30-03).
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        practiceAreaId: 1,
        buyerRoleId: 2,
        name: 'CFO mandates a GBS review in first 90 days',
        // category is free text (NOT an enum) — the exact string round-trips
        // byte-for-byte, including the slash, never coerced.
        category: 'Tenure/mandate',
        description: 'New CFO signals early transformation intent',
        createdBy: 'user-1',
        updatedBy: 'user-1',
      })
    );
    expect(result).toEqual(inserted);
  });

  it('listAllPersonaSignalsForPracticeArea returns every signal for the area regardless of status', async () => {
    const rows = [
      { id: 1, name: 'active signal', status: 'active' },
      { id: 2, name: 'draft signal', status: 'draft' },
    ];
    const where = vi.fn().mockResolvedValue(rows);
    const from = vi.fn().mockReturnValue({ where });
    mocks.db.select.mockReturnValue({ from });

    const result = await listAllPersonaSignalsForPracticeArea(1);

    expect(result).toEqual(rows);
    expect(from).toHaveBeenCalledWith(personaSignal);
    // Admin query: scoped to the practice area (param 1), no status filter
    // (draft/retired visible for management).
    expect(flattenSql(where.mock.calls[0][0])).toContain('1');
    expect(flattenSql(where.mock.calls[0][0])).not.toContain('active');
  });

  it('listActivePersonaSignalsForPracticeArea filters to status=active AND practice area — the picker-safe query', async () => {
    const rows = [{ id: 1, name: 'active signal', status: 'active' }];
    const where = vi.fn().mockResolvedValue(rows);
    const from = vi.fn().mockReturnValue({ where });
    mocks.db.select.mockReturnValue({ from });

    const result = await listActivePersonaSignalsForPracticeArea(42);

    expect(result).toEqual(rows);
    expect(from).toHaveBeenCalledWith(personaSignal);
    // Picker (Phase 31): the where clause ANDs the practice-area scope
    // (param 42) with the status='active' filter (param 'active') — spec
    // Section 3 draft-exclusion rule — never just the practice area alone.
    const whereSql = flattenSql(where.mock.calls[0][0]);
    expect(whereSql).toContain('42');
    expect(whereSql).toContain('active');
  });

  it('updatePersonaSignal explicitly stamps updatedAt and updatedBy on top of the patch', async () => {
    const updated = { id: 1, name: 'Renamed', updatedBy: 'user-2' };
    const returning = vi.fn().mockResolvedValue([updated]);
    const where = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where });
    mocks.db.update.mockReturnValue({ set });

    const result = await updatePersonaSignal(1, { name: 'Renamed' }, 'user-2');

    expect(mocks.db.update).toHaveBeenCalledWith(personaSignal);
    // Drizzle never auto-touches updatedAt/updatedBy (Pitfall 3) — the query
    // function must stamp them explicitly in the .set() clause.
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Renamed', updatedAt: expect.any(Date), updatedBy: 'user-2' })
    );
    expect(where).toHaveBeenCalled();
    expect(result).toEqual(updated);
  });

  it('updatePersonaSignal stamps updatedAt/updatedBy even when the patch has no other changes', async () => {
    const returning = vi.fn().mockResolvedValue([{ id: 1, updatedBy: 'user-2' }]);
    const where = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where });
    mocks.db.update.mockReturnValue({ set });

    await updatePersonaSignal(1, {}, 'user-2');

    // Empty patch: the set clause is STILL the two audit stamps and nothing
    // else — proving the update never silently skips attribution.
    expect(set).toHaveBeenCalledWith({ updatedAt: expect.any(Date), updatedBy: 'user-2' });
  });

  it('listDistinctPersonaSignalCategories returns the distinct category values as a string[] ordered by category', async () => {
    const rows = [
      { category: 'Career pattern' },
      { category: 'Content engagement' },
      { category: 'Org/hiring signal' },
    ];
    const orderBy = vi.fn().mockResolvedValue(rows);
    const from = vi.fn().mockReturnValue({ orderBy });
    mocks.db.selectDistinct.mockReturnValue({ from });

    const result = await listDistinctPersonaSignalCategories();

    // selectDistinct projects only the category column — the SQL ORDER BY
    // does the sorting; the helper maps rows to a plain string[].
    expect(mocks.db.selectDistinct).toHaveBeenCalledWith({ category: personaSignal.category });
    expect(from).toHaveBeenCalledWith(personaSignal);
    expect(orderBy).toHaveBeenCalledWith(personaSignal.category);
    expect(result).toEqual(['Career pattern', 'Content engagement', 'Org/hiring signal']);
  });

  it('listActivePersonaSignalCategoriesForPracticeArea scopes the distinct-category query to practice area AND status=active', async () => {
    const rows = [{ category: 'GBS-state' }];
    const orderBy = vi.fn().mockResolvedValue(rows);
    const where = vi.fn().mockReturnValue({ orderBy });
    const from = vi.fn().mockReturnValue({ where });
    mocks.db.selectDistinct.mockReturnValue({ from });

    const result = await listActivePersonaSignalCategoriesForPracticeArea(7);

    expect(mocks.db.selectDistinct).toHaveBeenCalledWith({ category: personaSignal.category });
    expect(from).toHaveBeenCalledWith(personaSignal);
    // Both the practice-area id (param 7) and the status='active' literal
    // must be present in the where clause — draft/retired categories and
    // other practice areas' categories must never leak into the picker.
    const whereSql = flattenSql(where.mock.calls[0][0]);
    expect(whereSql).toContain('7');
    expect(whereSql).toContain('active');
    expect(orderBy).toHaveBeenCalledWith(personaSignal.category);
    expect(result).toEqual(['GBS-state']);
  });

  it('listActivePersonaSignalsForPracticeAreaAndCategory filters by practice area, status=active, AND exact category, ordered by id', async () => {
    const rows = [
      { id: 3, category: 'GBS-state', status: 'active', practiceAreaId: 7 },
      { id: 5, category: 'GBS-state', status: 'active', practiceAreaId: 7 },
    ];
    const orderBy = vi.fn().mockResolvedValue(rows);
    const where = vi.fn().mockReturnValue({ orderBy });
    const from = vi.fn().mockReturnValue({ where });
    mocks.db.select.mockReturnValue({ from });

    const result = await listActivePersonaSignalsForPracticeAreaAndCategory(7, 'GBS-state');

    expect(from).toHaveBeenCalledWith(personaSignal);
    // Server-side re-resolution guard: the where clause carries all three
    // params — practice area (7), status ('active'), and the exact category
    // string ('GBS-state') — never trusting a caller-passed signal id.
    const whereSql = flattenSql(where.mock.calls[0][0]);
    expect(whereSql).toContain('7');
    expect(whereSql).toContain('active');
    expect(whereSql).toContain('GBS-state');
    expect(orderBy).toHaveBeenCalledWith(personaSignal.id);
    expect(result).toEqual(rows);
  });

  it('listActivePersonaSignalsForPracticeAreaAndCategory excludes wrong category, wrong status, and wrong practice area (asserted via the where-clause params)', async () => {
    // The mock DB cannot itself filter rows — the driver owns that. This
    // asserts the query FUNCTION always builds the AND of all three
    // predicates, which is what makes wrong-category/status/practice-area
    // rows unreachable against a real Postgres WHERE clause.
    const orderBy = vi.fn().mockResolvedValue([]);
    const where = vi.fn().mockReturnValue({ orderBy });
    const from = vi.fn().mockReturnValue({ where });
    mocks.db.select.mockReturnValue({ from });

    await listActivePersonaSignalsForPracticeAreaAndCategory(99, 'Career pattern');

    const whereArg = where.mock.calls[0][0] as { queryChunks?: unknown[] };
    // and(...) combines exactly 3 predicates: practiceAreaId, status, category.
    expect(Array.isArray(whereArg.queryChunks)).toBe(true);
    const whereSql = flattenSql(whereArg);
    expect(whereSql).toContain('99');
    expect(whereSql).toContain('active');
    expect(whereSql).toContain('Career pattern');
    expect(whereSql).not.toContain('draft');
    expect(whereSql).not.toContain('retired');
  });
});
