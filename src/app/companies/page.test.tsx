import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireStaffAccess: vi.fn(),
  redirect: vi.fn(),
  listDistinctIndustries: vi.fn(),
}));

vi.mock('@/lib/auth/requireStaffAccess', () => ({ requireStaffAccess: mocks.requireStaffAccess }));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('@/lib/db/queries/companies', () => ({ listDistinctIndustries: mocks.listDistinctIndustries }));
vi.mock('@/components/companies/company-list', () => ({
  CompanyList: () => <div data-company-list="true" />,
}));
vi.mock('@/components/companies/company-search-input', () => ({ CompanySearchInput: () => null }));
vi.mock('@/components/companies/company-filters', () => ({ CompanyFilters: () => null }));
vi.mock('@/components/explorer/explorer-menu', () => ({ ExplorerMenu: () => null }));

import CompaniesPage from './page';

describe('/companies route migration boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireStaffAccess.mockResolvedValue({ userId: 'staff' });
    mocks.listDistinctIndustries.mockResolvedValue([{ industry: 'Technology' }]);
    mocks.redirect.mockImplementation((path: string) => {
      throw new Error(`NEXT_REDIRECT: ${path}`);
    });
  });

  it('renders the canonical list route without selected-record query state', async () => {
    const element = await CompaniesPage({ searchParams: Promise.resolve({}) });

    expect(renderToStaticMarkup(element)).toContain('data-company-list="true"');
    expect(mocks.listDistinctIndustries).toHaveBeenCalledTimes(1);
  });

  it('redirects the legacy selected route once with only recognized tab state', async () => {
    await expect(
      CompaniesPage({
        searchParams: Promise.resolve({
          selected: '42',
          tab: 'analysis',
          search: 'Acme',
          industry: 'Technology',
          signal: 'cost_pressure',
        }),
      }),
    ).rejects.toThrow('NEXT_REDIRECT: /companies/42?tab=analysis');

    expect(mocks.listDistinctIndustries).not.toHaveBeenCalled();
  });

  it('normalizes an invalid legacy tab to the canonical General URL', async () => {
    await expect(
      CompaniesPage({
        searchParams: Promise.resolve({ selected: '42', tab: 'invalid', search: 'Acme' }),
      }),
    ).rejects.toThrow('NEXT_REDIRECT: /companies/42');
  });

  it('denies unauthenticated access before legacy parsing or list queries', async () => {
    mocks.requireStaffAccess.mockRejectedValueOnce(new Error('NEXT_REDIRECT: /sign-in'));

    await expect(
      CompaniesPage({ searchParams: Promise.resolve({ selected: '42' }) }),
    ).rejects.toThrow('NEXT_REDIRECT: /sign-in');

    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.listDistinctIndustries).not.toHaveBeenCalled();
  });
});
