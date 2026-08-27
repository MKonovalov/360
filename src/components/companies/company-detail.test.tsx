import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCompanyById: vi.fn(),
  listSignalsForCompany: vi.fn(),
  listPersonasForCompany: vi.fn(),
  countPendingProposalsForCompany: vi.fn(),
  fetchArcpediaArticles: vi.fn(),
  listAnalysisRunsForSubject: vi.fn(),
  listConfirmedCandidateOfferingsForSubject: vi.fn(),
  getAnalysisPacket: vi.fn(),
  projectRunReviewCards: vi.fn(),
  requireStaffAccess: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db/queries/companies', () => ({ getCompanyById: mocks.getCompanyById }));
vi.mock('@/lib/db/queries/signals', () => ({ listSignalsForCompany: mocks.listSignalsForCompany }));
vi.mock('@/lib/db/queries/companyPersonaRoles', () => ({ listPersonasForCompany: mocks.listPersonasForCompany }));
vi.mock('@/lib/db/queries/proposals', () => ({ countPendingProposalsForCompany: mocks.countPendingProposalsForCompany }));
vi.mock('@/lib/arcpedia', () => ({ fetchArcpediaArticles: mocks.fetchArcpediaArticles }));
vi.mock('@/lib/db/queries/analysisRuns', () => ({ listAnalysisRunsForSubject: mocks.listAnalysisRunsForSubject }));
vi.mock('@/lib/db/queries/confirmedCandidates', () => ({
  listConfirmedCandidateOfferingsForSubject: mocks.listConfirmedCandidateOfferingsForSubject,
}));
vi.mock('@/lib/db/queries/analysisResults', () => ({ getAnalysisPacket: mocks.getAnalysisPacket }));
vi.mock('@/lib/auth/requireStaffAccess', () => ({ requireStaffAccess: mocks.requireStaffAccess }));
vi.mock('@/components/enrichment/enrichment-review-dialog', () => ({
  EnrichMenu: () => <button type="button">Actions</button>,
}));
vi.mock('@/components/explorer/explorer-table-behavior', () => ({
  ExplorerCloseButton: () => <button type="button">Close</button>,
}));
vi.mock('@/components/dashboard/record-view-tracker', () => ({
  RecordViewTracker: () => null,
}));
vi.mock('@/components/analysis/analysis-history', () => ({
  AnalysisHistory: ({ rows }: { readonly rows: readonly unknown[] | null }) => (
    <section>
      <h2>Analysis</h2>
      <p>{rows === null ? 'Analysis load failed' : 'Analysis loaded'}</p>
    </section>
  ),
  projectRunReviewCards: mocks.projectRunReviewCards,
}));
vi.mock('@/components/analysis/confirmed-candidate-offerings', () => ({
  ConfirmedCandidateOfferings: ({ items }: { readonly items: readonly unknown[] | null }) => (
    <section>
      <h2>Confirmed Candidate Offerings</h2>
      <p>{items === null ? 'Offerings load failed' : 'Offerings loaded'}</p>
    </section>
  ),
}));

import { CompanyDetail } from './company-detail';

const company = {
  id: 42,
  name: 'Acme Corporation',
  industry: 'Technology',
  employeeCountBand: '51_200',
  hqLocation: 'New York',
  revenueBand: 'under_50m',
  ownershipType: 'private',
  techStack: ['SAP'],
  domain: 'acme.example',
  fieldSources: {},
};

const personaRoles = [
  {
    persona: { id: 7, name: 'Ada Lovelace' },
    role: { title: 'CFO' },
  },
];

async function renderTab(tab: 'general' | 'personas' | 'knowledge' | 'analysis'): Promise<string> {
  return renderToStaticMarkup(await CompanyDetail({ id: 42, tab }));
}

describe('CompanyDetail lazy tab query boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireStaffAccess.mockResolvedValue({ userId: 'staff-1' });
    mocks.getCompanyById.mockResolvedValue(company);
    mocks.listSignalsForCompany.mockResolvedValue([]);
    mocks.listPersonasForCompany.mockResolvedValue([]);
    mocks.countPendingProposalsForCompany.mockResolvedValue(2);
    mocks.fetchArcpediaArticles.mockResolvedValue([]);
    mocks.listAnalysisRunsForSubject.mockResolvedValue([]);
    mocks.listConfirmedCandidateOfferingsForSubject.mockResolvedValue([]);
    mocks.projectRunReviewCards.mockResolvedValue([]);
  });

  it('loads only shared company and General data for the default tab', async () => {
    const markup = await renderTab('general');

    expect(mocks.getCompanyById).toHaveBeenCalledWith(42);
    expect(mocks.listSignalsForCompany).toHaveBeenCalledWith(42);
    expect(mocks.countPendingProposalsForCompany).toHaveBeenCalledWith(42);
    expect(mocks.listPersonasForCompany).not.toHaveBeenCalled();
    expect(mocks.fetchArcpediaArticles).not.toHaveBeenCalled();
    expect(mocks.listAnalysisRunsForSubject).not.toHaveBeenCalled();
    expect(mocks.listConfirmedCandidateOfferingsForSubject).not.toHaveBeenCalled();
    expect(markup).toContain('Firmographics');
    expect(markup).toContain('Tech Stack');
    expect(markup).toContain('Buying Signals');
    expect(markup).not.toMatch(/<h2[^>]*>Linked Personas<\/h2>/);
    expect(markup).not.toMatch(/<h2[^>]*>Related Knowledge<\/h2>/);
    expect(markup).not.toMatch(/<h2[^>]*>Analysis<\/h2>/);
  });

  it.each(['general', 'personas', 'knowledge', 'analysis'] as const)(
    'keeps company identity, Agent actions, and tab navigation on the %s tab',
    async (tab) => {
      const markup = await renderTab(tab);

      expect(markup).toContain('Acme Corporation');
      expect(markup).toContain('Technology');
      expect(markup).toContain('Actions');
      expect(markup).toContain('Close');
      expect(markup).toContain('Company detail sections');
    },
  );

  it('loads linked personas only for the Personas tab', async () => {
    mocks.listPersonasForCompany.mockResolvedValue(personaRoles);

    const markup = await renderTab('personas');

    expect(mocks.getCompanyById).toHaveBeenCalledWith(42);
    expect(mocks.listPersonasForCompany).toHaveBeenCalledWith(42);
    expect(mocks.listSignalsForCompany).not.toHaveBeenCalled();
    expect(mocks.countPendingProposalsForCompany).not.toHaveBeenCalled();
    expect(mocks.fetchArcpediaArticles).not.toHaveBeenCalled();
    expect(mocks.listAnalysisRunsForSubject).not.toHaveBeenCalled();
    expect(markup).toContain('Linked Personas');
    expect(markup).toContain('Ada Lovelace');
    expect(markup).not.toMatch(/<h2[^>]*>Firmographics<\/h2>/);
  });

  it('renders the linked-personas empty state without loading another tab', async () => {
    const markup = await renderTab('personas');

    expect(markup).toContain('No linked personas.');
    expect(mocks.listPersonasForCompany).toHaveBeenCalledWith(42);
    expect(mocks.listSignalsForCompany).not.toHaveBeenCalled();
    expect(mocks.fetchArcpediaArticles).not.toHaveBeenCalled();
  });

  it('loads Arcpedia only for the Knowledge tab and renders a safe empty state', async () => {
    const markup = await renderTab('knowledge');

    expect(mocks.fetchArcpediaArticles).toHaveBeenCalledWith('Acme Corporation');
    expect(mocks.listSignalsForCompany).not.toHaveBeenCalled();
    expect(mocks.listPersonasForCompany).not.toHaveBeenCalled();
    expect(mocks.listAnalysisRunsForSubject).not.toHaveBeenCalled();
    expect(markup).toContain('No related knowledge found.');

    mocks.fetchArcpediaArticles.mockRejectedValueOnce(new Error('Arcpedia timeout'));
    const failedMarkup = await renderTab('knowledge');

    expect(failedMarkup).not.toContain("Couldn't load company");
    expect(failedMarkup).toContain('No related knowledge found.');
  });

  it('loads analysis history and offerings only for the Analysis tab', async () => {
    const markup = await renderTab('analysis');

    expect(mocks.listAnalysisRunsForSubject).toHaveBeenCalledWith({ targetType: 'company', subjectId: 42 });
    expect(mocks.listConfirmedCandidateOfferingsForSubject).toHaveBeenCalledWith({
      targetType: 'company',
      subjectId: 42,
    });
    expect(mocks.listSignalsForCompany).not.toHaveBeenCalled();
    expect(mocks.listPersonasForCompany).not.toHaveBeenCalled();
    expect(mocks.fetchArcpediaArticles).not.toHaveBeenCalled();
    expect(markup).toContain('Analysis');
    expect(markup).toContain('Confirmed Candidate Offerings');
    expect(markup).not.toMatch(/<h2[^>]*>Firmographics<\/h2>/);
  });

  it('keeps analysis and offerings failures independent', async () => {
    mocks.listAnalysisRunsForSubject.mockRejectedValueOnce(new Error('analysis unavailable'));
    mocks.listConfirmedCandidateOfferingsForSubject.mockRejectedValueOnce(new Error('offerings unavailable'));

    const markup = await renderTab('analysis');

    expect(markup).toContain('Analysis load failed');
    expect(markup).toContain('Offerings load failed');
    expect(markup).not.toContain("Couldn't load company");
  });

  it('keeps the primary company error card for shared or General database failures', async () => {
    mocks.getCompanyById.mockRejectedValueOnce(new Error('database unavailable'));

    const markup = await renderTab('general');

    expect(markup).toContain('Couldn&#x27;t load company');
    expect(markup).toContain('Try refreshing the page');
    expect(mocks.listSignalsForCompany).not.toHaveBeenCalled();

    mocks.getCompanyById.mockResolvedValueOnce(company);
    mocks.listSignalsForCompany.mockRejectedValueOnce(new Error('database unavailable'));
    const generalFailureMarkup = await renderTab('general');

    expect(generalFailureMarkup).toContain('Couldn&#x27;t load company');
    expect(mocks.countPendingProposalsForCompany).toHaveBeenCalledTimes(1);
  });

  it('uses the primary company error card when the Personas query fails', async () => {
    mocks.listPersonasForCompany.mockRejectedValueOnce(new Error('database unavailable'));

    const markup = await renderTab('personas');

    expect(markup).toContain('Couldn&#x27;t load company');
    expect(markup).not.toContain('No linked personas');
  });
});
