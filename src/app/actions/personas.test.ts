import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireStaffAccess: vi.fn(),
  revalidatePath: vi.fn(),
  getPersonaById: vi.fn(),
  insertPersona: vi.fn(),
  updatePersonaFields: vi.fn(),
  deletePersonaById: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock('@/lib/auth/requireStaffAccess', () => ({ requireStaffAccess: mocks.requireStaffAccess }));
vi.mock('@/lib/db/queries/personas', () => ({
  getPersonaById: mocks.getPersonaById,
  insertPersona: mocks.insertPersona,
  updatePersonaFields: mocks.updatePersonaFields,
  deletePersonaById: mocks.deletePersonaById,
}));

import { createPersona, deletePersona, updatePersona } from './personas';

const current = { id: 25, name: 'Nina Larsson', title: 'CFO', seniority: 'c_level', email: null, linkedinUrl: null };
const input = { id: 25, baseVersion: 3, name: 'Nina Larsson', title: 'CFO', seniority: 'c_level', email: '', linkedinUrl: '' };

describe('persona actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireStaffAccess.mockResolvedValue({ userId: 'staff' });
    mocks.getPersonaById.mockResolvedValue(current);
    mocks.updatePersonaFields.mockResolvedValue('updated');
    mocks.deletePersonaById.mockResolvedValue(true);
  });

  it('gates every action on staff access before touching data', async () => {
    mocks.requireStaffAccess.mockRejectedValue(new Error('NEXT_REDIRECT'));

    await expect(updatePersona(input)).rejects.toThrow('NEXT_REDIRECT');
    await expect(deletePersona({ id: 25 })).rejects.toThrow('NEXT_REDIRECT');
    expect(mocks.updatePersonaFields).not.toHaveBeenCalled();
    expect(mocks.deletePersonaById).not.toHaveBeenCalled();
  });

  it('writes only changed fields, lowercases email, and revalidates', async () => {
    const result = await updatePersona({ ...input, title: 'Group CFO', email: 'Nina@Example.COM' });

    expect(result).toEqual({ ok: true });
    expect(mocks.updatePersonaFields).toHaveBeenCalledWith(
      25,
      3,
      expect.objectContaining({ title: 'Group CFO', email: 'nina@example.com' }),
      ['title', 'email'],
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/personas/25');
  });

  it('skips the write when nothing changed', async () => {
    await expect(updatePersona(input)).resolves.toEqual({ ok: true });
    expect(mocks.updatePersonaFields).not.toHaveBeenCalled();
  });

  it.each([
    [{ ...input, name: '  ' }, 'Name is required'],
    [{ ...input, email: 'not-an-email' }, 'Enter a valid email'],
    [{ ...input, linkedinUrl: 'javascript:alert(1)' }, 'LinkedIn URL must start with http(s)://'],
  ])('rejects invalid input %#', async (bad, reason) => {
    await expect(updatePersona(bad)).resolves.toEqual({ ok: false, reason });
    expect(mocks.updatePersonaFields).not.toHaveBeenCalled();
  });

  it('reports stale versions and duplicate emails', async () => {
    mocks.updatePersonaFields.mockResolvedValueOnce('stale');
    await expect(updatePersona({ ...input, title: 'X' })).resolves.toMatchObject({ ok: false });
    mocks.updatePersonaFields.mockResolvedValueOnce('email_conflict');
    await expect(updatePersona({ ...input, email: 'a@b.co' })).resolves.toEqual({
      ok: false,
      reason: 'Another persona already uses this email.',
    });
  });

  it('deletes and revalidates, and rejects bad ids or missing personas', async () => {
    await expect(deletePersona({ id: 25 })).resolves.toEqual({ ok: true });
    expect(mocks.deletePersonaById).toHaveBeenCalledWith(25);
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/personas');

    await expect(deletePersona({ id: -1 })).resolves.toEqual({ ok: false, reason: 'Invalid input' });
    mocks.deletePersonaById.mockResolvedValueOnce(false);
    await expect(deletePersona({ id: 99 })).resolves.toEqual({ ok: false, reason: 'Persona not found' });
  });

  describe('createPersona', () => {
    const fields = { name: 'Nina Larsson', title: 'CFO', seniority: 'c_level', email: 'Nina@Example.COM', linkedinUrl: '' };

    it('requires staff access and creates with a lowercased email', async () => {
      mocks.insertPersona.mockResolvedValue({ kind: 'created', id: 77 });

      await expect(createPersona(fields)).resolves.toEqual({ ok: true, id: 77 });
      expect(mocks.insertPersona).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Nina Larsson', email: 'nina@example.com', linkedinUrl: null }),
      );
      expect(mocks.revalidatePath).toHaveBeenCalledWith('/personas');

      mocks.requireStaffAccess.mockRejectedValue(new Error('NEXT_REDIRECT'));
      await expect(createPersona(fields)).rejects.toThrow('NEXT_REDIRECT');
    });

    it('rejects invalid input and reports a duplicate email', async () => {
      await expect(createPersona({ ...fields, name: '' })).resolves.toEqual({ ok: false, reason: 'Name is required' });
      await expect(createPersona({ ...fields, linkedinUrl: 'javascript:alert(1)' })).resolves.toMatchObject({ ok: false });
      expect(mocks.insertPersona).not.toHaveBeenCalled();

      mocks.insertPersona.mockResolvedValue({ kind: 'email_conflict' });
      await expect(createPersona(fields)).resolves.toEqual({ ok: false, reason: 'Another persona already uses this email.' });
    });
  });
});
