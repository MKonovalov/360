import { beforeEach, describe, expect, it, vi } from 'vitest';

// 30-05 anchor: polymorphic signal_offering_link query module. Unit tests on
// the query functions with a stubbed drizzle client — no live DB (D-16).
// The insert guard is the module's one genuinely new piece of logic: the
// practice-area equality check that must run BEFORE any write (a signal may
// only link to an offering in the same practice area — spec Section 3).
// Mirrors companySignals.test.ts's mock-hoisting structure; `delete` is added
// to the db mock because deleteSignalOfferingLink calls it.
const mocks = vi.hoisted(() => ({
  db: { insert: vi.fn(), select: vi.fn(), delete: vi.fn() },
}));

vi.mock('../index', () => ({ db: mocks.db }));

import {
  deleteSignalOfferingLink,
  insertSignalOfferingLink,
  listLinksForOffering,
  listLinksForSignal,
} from './signalOfferingLinks';
import { companySignal, offering, personaSignal, signalOfferingLink } from '../schema';

// Flattens a Drizzle SQL expression's queryChunks into a single string so a
// .where() argument can be asserted on its literal contents (param values,
// SQL keywords) without depending on the exact chunk tree shape. Column
// references do not flatten to readable names (their table refs are
// symbol-keyed), so assertions target the injected param values — e.g. the
// offering id, signal id, and 'persona' discriminator literal.
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

describe('signalOfferingLinks query module (30-05)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts a link when the signal and offering share a practice area, returning { ok: true, id }', async () => {
    const signalFrom = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ practiceAreaId: 1 }]) });
    const offeringFrom = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ practiceAreaId: 1 }]) });
    mocks.db.select
      .mockReturnValueOnce({ from: signalFrom })
      .mockReturnValueOnce({ from: offeringFrom });

    const returning = vi.fn().mockResolvedValue([{ id: 7 }]);
    const values = vi.fn().mockReturnValue({ returning });
    mocks.db.insert.mockReturnValue({ values });

    const result = await insertSignalOfferingLink({
      signalType: 'company',
      signalId: 42,
      offeringId: 99,
      relevanceNote: 'New CFO signals transformation work',
      createdBy: 'user-1',
    });

    expect(result).toEqual({ ok: true, id: 7 });
    // The guard reads the signal's practice area from company_signal first.
    expect(signalFrom).toHaveBeenCalledWith(companySignal);
    expect(offeringFrom).toHaveBeenCalledWith(offering);
    expect(mocks.db.insert).toHaveBeenCalledWith(signalOfferingLink);
    // Insert-time convention: updatedBy starts equal to createdBy (T-30-03).
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        signalType: 'company',
        signalId: 42,
        offeringId: 99,
        relevanceNote: 'New CFO signals transformation work',
        createdBy: 'user-1',
        updatedBy: 'user-1',
      })
    );
  });

  it('rejects a cross-practice-area link with practice_area_mismatch and never calls db.insert', async () => {
    const signalFrom = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ practiceAreaId: 1 }]) });
    const offeringFrom = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ practiceAreaId: 2 }]) });
    mocks.db.select
      .mockReturnValueOnce({ from: signalFrom })
      .mockReturnValueOnce({ from: offeringFrom });

    const result = await insertSignalOfferingLink({
      signalType: 'company',
      signalId: 42,
      offeringId: 99,
      createdBy: 'user-1',
    });

    expect(result).toEqual({ ok: false, reason: 'practice_area_mismatch' });
    // The guard fires BEFORE any write — the insert must never be reached.
    expect(mocks.db.insert).not.toHaveBeenCalled();
  });

  it("signalType: 'persona' reads the signal's practice area from personaSignal, not companySignal", async () => {
    const personaFrom = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ practiceAreaId: 1 }]) });
    const offeringFrom = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ practiceAreaId: 1 }]) });
    mocks.db.select
      .mockReturnValueOnce({ from: personaFrom })
      .mockReturnValueOnce({ from: offeringFrom });

    const returning = vi.fn().mockResolvedValue([{ id: 8 }]);
    const values = vi.fn().mockReturnValue({ returning });
    mocks.db.insert.mockReturnValue({ values });

    const result = await insertSignalOfferingLink({
      signalType: 'persona',
      signalId: 7,
      offeringId: 3,
      createdBy: 'user-1',
    });

    expect(result).toEqual({ ok: true, id: 8 });
    // The discriminator branches to persona_signal — company_signal is never touched.
    expect(personaFrom).toHaveBeenCalledWith(personaSignal);
    expect(mocks.db.insert).toHaveBeenCalledWith(signalOfferingLink);
  });

  it('rejects a missing signal row with practice_area_mismatch and never inserts', async () => {
    const signalFrom = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) });
    const offeringFrom = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ practiceAreaId: 1 }]) });
    mocks.db.select
      .mockReturnValueOnce({ from: signalFrom })
      .mockReturnValueOnce({ from: offeringFrom });

    const result = await insertSignalOfferingLink({
      signalType: 'company',
      signalId: 999,
      offeringId: 99,
      createdBy: 'user-1',
    });

    expect(result).toEqual({ ok: false, reason: 'practice_area_mismatch' });
    expect(mocks.db.insert).not.toHaveBeenCalled();
  });

  it('rejects a missing offering row with practice_area_mismatch and never inserts', async () => {
    const signalFrom = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ practiceAreaId: 1 }]) });
    const offeringFrom = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) });
    mocks.db.select
      .mockReturnValueOnce({ from: signalFrom })
      .mockReturnValueOnce({ from: offeringFrom });

    const result = await insertSignalOfferingLink({
      signalType: 'company',
      signalId: 42,
      offeringId: 999,
      createdBy: 'user-1',
    });

    expect(result).toEqual({ ok: false, reason: 'practice_area_mismatch' });
    expect(mocks.db.insert).not.toHaveBeenCalled();
  });

  it('listLinksForOffering returns every link for the offering, scoped by offeringId', async () => {
    const rows = [{ id: 1, signalType: 'company', signalId: 42, offeringId: 99 }];
    const where = vi.fn().mockResolvedValue(rows);
    const from = vi.fn().mockReturnValue({ where });
    mocks.db.select.mockReturnValue({ from });

    const result = await listLinksForOffering(99);

    expect(result).toEqual(rows);
    expect(from).toHaveBeenCalledWith(signalOfferingLink);
    expect(flattenSql(where.mock.calls[0][0])).toContain('99');
  });

  it('listLinksForSignal filters by BOTH the signalType discriminator and the signalId', async () => {
    const rows = [{ id: 2, signalType: 'persona', signalId: 7, offeringId: 3 }];
    const where = vi.fn().mockResolvedValue(rows);
    const from = vi.fn().mockReturnValue({ where });
    mocks.db.select.mockReturnValue({ from });

    const result = await listLinksForSignal('persona', 7);

    expect(result).toEqual(rows);
    expect(from).toHaveBeenCalledWith(signalOfferingLink);
    const whereSql = flattenSql(where.mock.calls[0][0]);
    expect(whereSql).toContain('persona');
    expect(whereSql).toContain('7');
  });

  it('deleteSignalOfferingLink removes a link row unconditionally by id', async () => {
    const where = vi.fn().mockResolvedValue([]);
    mocks.db.delete.mockReturnValue({ where });

    await deleteSignalOfferingLink(5);

    expect(mocks.db.delete).toHaveBeenCalledWith(signalOfferingLink);
    expect(flattenSql(where.mock.calls[0][0])).toContain('5');
  });
});
