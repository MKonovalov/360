import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const mocks = vi.hoisted(() => ({
  listCompanies: vi.fn(),
  listSignalSummariesForCompanies: vi.fn(),
  listSignalsForCompany: vi.fn(),
}));

vi.mock('@/lib/db/queries/companies', () => ({ listCompanies: mocks.listCompanies }));
vi.mock('@/lib/db/queries/signals', () => ({
  listSignalSummariesForCompanies: mocks.listSignalSummariesForCompanies,
  listSignalsForCompany: mocks.listSignalsForCompany,
}));

import { CompanyList } from './company-list';

describe('CompanyList query budget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listCompanies.mockResolvedValue([
      {
        id: 11,
        name: 'Alpha Co',
        industry: 'Technology',
        employeeCountBand: '51_200',
        hqLocation: 'New York',
        revenueBand: 'under_50m',
        ownershipType: 'private',
      },
      {
        id: 22,
        name: 'Beta Co',
        industry: 'Manufacturing',
        employeeCountBand: null,
        hqLocation: null,
        revenueBand: null,
        ownershipType: null,
      },
    ]);
    mocks.listSignalSummariesForCompanies.mockResolvedValue([
      { companyId: 11, signalType: 'cost_pressure' },
      { companyId: 22, signalType: 'new_cfo_or_gbs_head' },
    ]);
    mocks.listSignalsForCompany.mockResolvedValue([]);
  });

  it('uses one grouped summary query and no per-company detail signal queries', async () => {
    const markup = renderToStaticMarkup(await CompanyList({ filters: { industry: 'Technology' } }));

    expect(mocks.listSignalSummariesForCompanies).toHaveBeenCalledTimes(1);
    expect(mocks.listSignalSummariesForCompanies).toHaveBeenCalledWith([11, 22]);
    expect(mocks.listSignalsForCompany).not.toHaveBeenCalled();
    expect(markup).toContain('Cost Pressure');
    expect(markup).toContain('New CFO/GBS Head');
  });
});
