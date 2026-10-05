import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireStaffAccess: vi.fn(),
  revalidatePath: vi.fn(),
  getCompanyById: vi.fn(),
  insertCompany: vi.fn(),
  updateCompanyFields: vi.fn(),
  deleteCompanyById: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock('@/lib/auth/requireStaffAccess', () => ({ requireStaffAccess: mocks.requireStaffAccess }));
vi.mock('@/lib/db/queries/companies', () => ({
  getCompanyById: mocks.getCompanyById,
  insertCompany: mocks.insertCompany,
  updateCompanyFields: mocks.updateCompanyFields,
  deleteCompanyById: mocks.deleteCompanyById,
}));

import { createCompany, deleteCompany, updateCompany } from './companies';

const current = {
  id: 25, name: 'Acme', domain: 'acme.com', industry: 'Chemicals', employeeCountBand: null,
  hqLocation: null, revenueBand: null, ownershipType: null,
};
const input = {
  id: 25, baseVersion: 2, name: 'Acme', domain: 'acme.com', industry: 'Chemicals',
  employeeCountBand: '', hqLocation: '', revenueBand: null, ownershipType: null,
};

describe('company actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireStaffAccess.mockResolvedValue({ userId: 'staff' });
    mocks.getCompanyById.mockResolvedValue(current);
    mocks.updateCompanyFields.mockResolvedValue('updated');
    mocks.deleteCompanyById.mockResolvedValue(true);
  });

  it('gates every action on staff access before touching data', async () => {
    mocks.requireStaffAccess.mockRejectedValue(new Error('NEXT_REDIRECT'));

    await expect(updateCompany(input)).rejects.toThrow('NEXT_REDIRECT');
    await expect(deleteCompany({ id: 25 })).rejects.toThrow('NEXT_REDIRECT');
    expect(mocks.updateCompanyFields).not.toHaveBeenCalled();
    expect(mocks.deleteCompanyById).not.toHaveBeenCalled();
  });

  it('writes only changed fields, normalizes the domain, and revalidates', async () => {
    const result = await updateCompany({ ...input, domain: 'https://www.Acme-Group.com/', hqLocation: 'Berlin' });

    expect(result).toEqual({ ok: true });
    expect(mocks.updateCompanyFields).toHaveBeenCalledWith(
      25,
      2,
      expect.objectContaining({ domain: 'acme-group.com', hqLocation: 'Berlin' }),
      ['domain', 'hqLocation'],
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/companies/25');
  });

  it('skips the write when nothing changed', async () => {
    await expect(updateCompany(input)).resolves.toEqual({ ok: true });
    expect(mocks.updateCompanyFields).not.toHaveBeenCalled();
  });

  it.each([
    [{ ...input, name: ' ' }, 'Name is required'],
    [{ ...input, domain: 'not a domain' }, 'Enter a valid domain, e.g. acme.com'],
  ])('rejects invalid input %#', async (bad, reason) => {
    await expect(updateCompany(bad)).resolves.toEqual({ ok: false, reason });
    expect(mocks.updateCompanyFields).not.toHaveBeenCalled();
  });

  it('reports stale versions and duplicate domains', async () => {
    mocks.updateCompanyFields.mockResolvedValueOnce('stale');
    await expect(updateCompany({ ...input, industry: 'X' })).resolves.toMatchObject({ ok: false });
    mocks.updateCompanyFields.mockResolvedValueOnce('domain_conflict');
    await expect(updateCompany({ ...input, domain: 'other.com' })).resolves.toEqual({
      ok: false,
      reason: 'Another company already uses this domain.',
    });
  });

  it('deletes and revalidates, and rejects bad ids or missing companies', async () => {
    await expect(deleteCompany({ id: 25 })).resolves.toEqual({ ok: true });
    expect(mocks.deleteCompanyById).toHaveBeenCalledWith(25);
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/companies');

    await expect(deleteCompany({ id: 0 })).resolves.toEqual({ ok: false, reason: 'Invalid input' });
    mocks.deleteCompanyById.mockResolvedValueOnce(false);
    await expect(deleteCompany({ id: 99 })).resolves.toEqual({ ok: false, reason: 'Company not found' });
  });

  describe('createCompany', () => {
    const fields = { name: 'Acme', domain: 'https://www.acme.com', industry: '', employeeCountBand: '', hqLocation: '', revenueBand: null, ownershipType: null };

    it('requires staff access and creates with a normalized domain', async () => {
      mocks.insertCompany.mockResolvedValue({ kind: 'created', id: 77 });

      await expect(createCompany(fields)).resolves.toEqual({ ok: true, id: 77 });
      expect(mocks.insertCompany).toHaveBeenCalledWith(expect.objectContaining({ name: 'Acme', domain: 'acme.com', industry: null }));
      expect(mocks.revalidatePath).toHaveBeenCalledWith('/companies');

      mocks.requireStaffAccess.mockRejectedValue(new Error('NEXT_REDIRECT'));
      await expect(createCompany(fields)).rejects.toThrow('NEXT_REDIRECT');
    });

    it('rejects a missing name and reports a duplicate domain', async () => {
      await expect(createCompany({ ...fields, name: '' })).resolves.toEqual({ ok: false, reason: 'Name is required' });
      expect(mocks.insertCompany).not.toHaveBeenCalled();

      mocks.insertCompany.mockResolvedValue({ kind: 'domain_conflict' });
      await expect(createCompany(fields)).resolves.toEqual({ ok: false, reason: 'Another company already uses this domain.' });
    });
  });
});
