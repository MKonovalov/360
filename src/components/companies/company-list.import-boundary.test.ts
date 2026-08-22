import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/companies/company-detail', () => {
  throw new Error('CompanyList must not import CompanyDetail');
});

describe('CompanyList import boundary', () => {
  it('loads without importing the detail component', async () => {
    await expect(import('./company-list')).resolves.toHaveProperty('CompanyList');
  });
});
