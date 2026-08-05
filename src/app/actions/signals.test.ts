import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mirrors reviews.test.ts's vi.hoisted/vi.mock structure exactly. The query
// modules under test are mocked wholesale; only signals.ts's own logic
// (zod validation, requireStaffAccess-first ordering, link sync diff, the
// discriminated-union envelope) is exercised.

const mocks = vi.hoisted(() => ({
  requireStaffAccess: vi.fn().mockResolvedValue({ userId: 'user_123' }),
  insertCompanySignal: vi.fn(),
  updateCompanySignal: vi.fn(),
  insertPersonaSignal: vi.fn(),
  updatePersonaSignal: vi.fn(),
  insertSignalOfferingLink: vi.fn(),
  listLinksForSignal: vi.fn(),
  deleteSignalOfferingLink: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/auth/requireStaffAccess', () => ({
  requireStaffAccess: mocks.requireStaffAccess,
}));
vi.mock('@/lib/db/queries/companySignals', () => ({
  insertCompanySignal: mocks.insertCompanySignal,
  updateCompanySignal: mocks.updateCompanySignal,
}));
vi.mock('@/lib/db/queries/personaSignals', () => ({
  insertPersonaSignal: mocks.insertPersonaSignal,
  updatePersonaSignal: mocks.updatePersonaSignal,
}));
vi.mock('@/lib/db/queries/signalOfferingLinks', () => ({
  insertSignalOfferingLink: mocks.insertSignalOfferingLink,
  listLinksForSignal: mocks.listLinksForSignal,
  deleteSignalOfferingLink: mocks.deleteSignalOfferingLink,
}));

import { revalidatePath } from 'next/cache';
import {
  archiveCompanySignalAction,
  archivePersonaSignalAction,
  createCompanySignalAction,
  createPersonaSignalAction,
  updateCompanySignalAction,
  updatePersonaSignalAction,
} from './signals';

const validCompanyInput = {
  practiceAreaId: 1,
  name: 'Cost pressure',
  category: 'Financial',
  description: 'Margin compression signal',
  offeringIds: [10, 20],
};

const validPersonaInput = {
  ...validCompanyInput,
  buyerRoleId: 5,
};

describe('signal actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireStaffAccess.mockResolvedValue({ userId: 'user_123' });
    mocks.insertCompanySignal.mockResolvedValue({ id: 100 });
    mocks.updateCompanySignal.mockResolvedValue({ id: 100 });
    mocks.insertPersonaSignal.mockResolvedValue({ id: 200 });
    mocks.updatePersonaSignal.mockResolvedValue({ id: 200 });
    mocks.insertSignalOfferingLink.mockResolvedValue({ ok: true, id: 1 });
    mocks.listLinksForSignal.mockResolvedValue([]);
    mocks.deleteSignalOfferingLink.mockResolvedValue(undefined);
  });

  // ---- createCompanySignalAction ----

  it('createCompanySignalAction calls requireStaffAccess first, then insertCompanySignal', async () => {
    await createCompanySignalAction(validCompanyInput);

    expect(
      mocks.requireStaffAccess.mock.invocationCallOrder[0] <
        mocks.insertCompanySignal.mock.invocationCallOrder[0]
    ).toBe(true);
    expect(mocks.insertCompanySignal).toHaveBeenCalledWith({
      practiceAreaId: 1,
      name: 'Cost pressure',
      category: 'Financial',
      description: 'Margin compression signal',
      status: undefined,
      createdBy: 'user_123',
    });
  });

  it('createCompanySignalAction syncs offeringIds via insertSignalOfferingLink and revalidates on success', async () => {
    const result = await createCompanySignalAction(validCompanyInput);

    expect(result).toEqual({ ok: true });
    expect(mocks.insertSignalOfferingLink).toHaveBeenCalledTimes(2);
    expect(mocks.insertSignalOfferingLink).toHaveBeenCalledWith({
      signalType: 'company',
      signalId: 100,
      offeringId: 10,
      createdBy: 'user_123',
    });
    expect(mocks.insertSignalOfferingLink).toHaveBeenCalledWith({
      signalType: 'company',
      signalId: 100,
      offeringId: 20,
      createdBy: 'user_123',
    });
    expect(revalidatePath).toHaveBeenCalledWith('/signals');
  });

  it('createCompanySignalAction rejects invalid_input before any write when name is missing', async () => {
    const result = await createCompanySignalAction({ ...validCompanyInput, name: '' });

    expect(result).toEqual({ ok: false, reason: 'invalid_input' });
    expect(mocks.insertCompanySignal).not.toHaveBeenCalled();
    expect(mocks.insertSignalOfferingLink).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('createCompanySignalAction rejects invalid_input when practiceAreaId is non-positive', async () => {
    const result = await createCompanySignalAction({ ...validCompanyInput, practiceAreaId: 0 });

    expect(result).toEqual({ ok: false, reason: 'invalid_input' });
    expect(mocks.insertCompanySignal).not.toHaveBeenCalled();
  });

  it('createCompanySignalAction surfaces practice_area_mismatch from insertSignalOfferingLink without rollback', async () => {
    mocks.insertSignalOfferingLink
      .mockResolvedValueOnce({ ok: true, id: 1 })
      .mockResolvedValueOnce({ ok: false, reason: 'practice_area_mismatch' });

    const result = await createCompanySignalAction(validCompanyInput);

    expect(result).toEqual({ ok: false, reason: 'practice_area_mismatch' });
    // Signal row was created (no rollback — neon-http has no transactions).
    expect(mocks.insertCompanySignal).toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('createCompanySignalAction maps an unexpected throw to action_failed', async () => {
    mocks.insertCompanySignal.mockRejectedValue(new Error('db down'));

    const result = await createCompanySignalAction(validCompanyInput);

    expect(result).toEqual({ ok: false, reason: 'action_failed' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  // ---- updateCompanySignalAction ----

  it('updateCompanySignalAction calls updateCompanySignal with the patch and userId', async () => {
    await updateCompanySignalAction(100, validCompanyInput);

    expect(mocks.updateCompanySignal).toHaveBeenCalledWith(
      100,
      expect.objectContaining({
        practiceAreaId: 1,
        name: 'Cost pressure',
        category: 'Financial',
        description: 'Margin compression signal',
      }),
      'user_123'
    );
  });

  it('updateCompanySignalAction diffs offeringIds — inserts added, deletes removed', async () => {
    mocks.listLinksForSignal.mockResolvedValue([
      { id: 501, offeringId: 20 }, // kept
      { id: 502, offeringId: 30 }, // removed
    ]);

    await updateCompanySignalAction(100, { ...validCompanyInput, offeringIds: [20, 40] });

    expect(mocks.listLinksForSignal).toHaveBeenCalledWith('company', 100);
    expect(mocks.insertSignalOfferingLink).toHaveBeenCalledWith({
      signalType: 'company',
      signalId: 100,
      offeringId: 40,
      createdBy: 'user_123',
    });
    expect(mocks.deleteSignalOfferingLink).toHaveBeenCalledWith(502);
    expect(mocks.insertSignalOfferingLink).toHaveBeenCalledTimes(1);
    expect(mocks.deleteSignalOfferingLink).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith('/signals');
  });

  it('updateCompanySignalAction returns not_found when updateCompanySignal resolves undefined (no link sync)', async () => {
    mocks.updateCompanySignal.mockResolvedValue(undefined);

    const result = await updateCompanySignalAction(999, validCompanyInput);

    expect(result).toEqual({ ok: false, reason: 'not_found' });
    expect(mocks.listLinksForSignal).not.toHaveBeenCalled();
    expect(mocks.insertSignalOfferingLink).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('updateCompanySignalAction rejects invalid_input before any write', async () => {
    const result = await updateCompanySignalAction(100, { ...validCompanyInput, category: '' });

    expect(result).toEqual({ ok: false, reason: 'invalid_input' });
    expect(mocks.updateCompanySignal).not.toHaveBeenCalled();
  });

  it('updateCompanySignalAction maps an unexpected throw to action_failed', async () => {
    mocks.updateCompanySignal.mockRejectedValue(new Error('db down'));

    const result = await updateCompanySignalAction(100, validCompanyInput);

    expect(result).toEqual({ ok: false, reason: 'action_failed' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  // ---- archiveCompanySignalAction ----

  it('archiveCompanySignalAction calls requireStaffAccess first then updateCompanySignal with status retired', async () => {
    const result = await archiveCompanySignalAction(100);

    expect(result).toEqual({ ok: true });
    expect(
      mocks.requireStaffAccess.mock.invocationCallOrder[0] <
        mocks.updateCompanySignal.mock.invocationCallOrder[0]
    ).toBe(true);
    expect(mocks.updateCompanySignal).toHaveBeenCalledWith(100, { status: 'retired' }, 'user_123');
    expect(revalidatePath).toHaveBeenCalledWith('/signals');
  });

  it('archiveCompanySignalAction returns not_found when no row updated', async () => {
    mocks.updateCompanySignal.mockResolvedValue(undefined);

    const result = await archiveCompanySignalAction(999);

    expect(result).toEqual({ ok: false, reason: 'not_found' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('archiveCompanySignalAction maps an unexpected throw to action_failed', async () => {
    mocks.updateCompanySignal.mockRejectedValue(new Error('db down'));

    const result = await archiveCompanySignalAction(100);

    expect(result).toEqual({ ok: false, reason: 'action_failed' });
  });

  // ---- createPersonaSignalAction ----

  it('createPersonaSignalAction calls insertPersonaSignal with buyerRoleId and syncs links', async () => {
    const result = await createPersonaSignalAction(validPersonaInput);

    expect(result).toEqual({ ok: true });
    expect(mocks.insertPersonaSignal).toHaveBeenCalledWith({
      practiceAreaId: 1,
      buyerRoleId: 5,
      name: 'Cost pressure',
      category: 'Financial',
      description: 'Margin compression signal',
      status: undefined,
      createdBy: 'user_123',
    });
    expect(mocks.insertSignalOfferingLink).toHaveBeenCalledWith({
      signalType: 'persona',
      signalId: 200,
      offeringId: 10,
      createdBy: 'user_123',
    });
    expect(revalidatePath).toHaveBeenCalledWith('/signals');
  });

  it('createPersonaSignalAction rejects invalid_input when buyerRoleId is missing', async () => {
    const { buyerRoleId, ...withoutBuyerRole } = validPersonaInput;
    const result = await createPersonaSignalAction(withoutBuyerRole);

    expect(result).toEqual({ ok: false, reason: 'invalid_input' });
    expect(mocks.insertPersonaSignal).not.toHaveBeenCalled();
  });

  it('createPersonaSignalAction surfaces practice_area_mismatch from insertSignalOfferingLink', async () => {
    mocks.insertSignalOfferingLink.mockResolvedValue({ ok: false, reason: 'practice_area_mismatch' });

    const result = await createPersonaSignalAction(validPersonaInput);

    expect(result).toEqual({ ok: false, reason: 'practice_area_mismatch' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('createPersonaSignalAction maps an unexpected throw to action_failed', async () => {
    mocks.insertPersonaSignal.mockRejectedValue(new Error('db down'));

    const result = await createPersonaSignalAction(validPersonaInput);

    expect(result).toEqual({ ok: false, reason: 'action_failed' });
  });

  // ---- updatePersonaSignalAction ----

  it('updatePersonaSignalAction diffs offeringIds against listLinksForSignal persona', async () => {
    mocks.listLinksForSignal.mockResolvedValue([{ id: 601, offeringId: 10 }]);

    await updatePersonaSignalAction(200, { ...validPersonaInput, offeringIds: [10, 50] });

    expect(mocks.listLinksForSignal).toHaveBeenCalledWith('persona', 200);
    expect(mocks.insertSignalOfferingLink).toHaveBeenCalledWith({
      signalType: 'persona',
      signalId: 200,
      offeringId: 50,
      createdBy: 'user_123',
    });
    expect(mocks.deleteSignalOfferingLink).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith('/signals');
  });

  it('updatePersonaSignalAction returns not_found when updatePersonaSignal resolves undefined', async () => {
    mocks.updatePersonaSignal.mockResolvedValue(undefined);

    const result = await updatePersonaSignalAction(999, validPersonaInput);

    expect(result).toEqual({ ok: false, reason: 'not_found' });
    expect(mocks.listLinksForSignal).not.toHaveBeenCalled();
  });

  it('updatePersonaSignalAction rejects invalid_input when buyerRoleId is missing', async () => {
    const { buyerRoleId, ...withoutBuyerRole } = validPersonaInput;
    const result = await updatePersonaSignalAction(200, withoutBuyerRole);

    expect(result).toEqual({ ok: false, reason: 'invalid_input' });
    expect(mocks.updatePersonaSignal).not.toHaveBeenCalled();
  });

  // ---- archivePersonaSignalAction ----

  it('archivePersonaSignalAction calls updatePersonaSignal with status retired and revalidates', async () => {
    const result = await archivePersonaSignalAction(200);

    expect(result).toEqual({ ok: true });
    expect(mocks.updatePersonaSignal).toHaveBeenCalledWith(200, { status: 'retired' }, 'user_123');
    expect(revalidatePath).toHaveBeenCalledWith('/signals');
  });

  it('archivePersonaSignalAction returns not_found when no row updated', async () => {
    mocks.updatePersonaSignal.mockResolvedValue(undefined);

    const result = await archivePersonaSignalAction(999);

    expect(result).toEqual({ ok: false, reason: 'not_found' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('archivePersonaSignalAction maps an unexpected throw to action_failed', async () => {
    mocks.updatePersonaSignal.mockRejectedValue(new Error('db down'));

    const result = await archivePersonaSignalAction(200);

    expect(result).toEqual({ ok: false, reason: 'action_failed' });
  });
});