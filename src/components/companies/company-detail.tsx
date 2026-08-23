import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { getCompanyById } from '@/lib/db/queries/companies';
import { listSignalsForCompany } from '@/lib/db/queries/signals';
import { listPersonasForCompany } from '@/lib/db/queries/companyPersonaRoles';
import { countPendingProposalsForCompany } from '@/lib/db/queries/proposals';
import { fetchArcpediaArticles } from '@/lib/arcpedia';
import { CompanyDetailErrorState } from '@/components/companies/company-detail-states';
import { CompanyDetailHeader } from '@/components/companies/company-detail-header';
import { CompanyDetailAnalysis } from '@/components/companies/company-detail-analysis';
import { CompanyDetailGeneral } from '@/components/companies/company-detail-general';
import { CompanyDetailKnowledge } from '@/components/companies/company-detail-knowledge';
import { CompanyDetailPersonas } from '@/components/companies/company-detail-personas';
import { CompanyDetailTabs } from '@/components/companies/company-detail-tabs';
import { RecordViewTracker } from '@/components/dashboard/record-view-tracker';
import { env } from '@/lib/env';
import { listAnalysisRunsForSubject } from '@/lib/db/queries/analysisRuns';
import { listConfirmedCandidateOfferingsForSubject } from '@/lib/db/queries/confirmedCandidates';
import { getAnalysisPacket } from '@/lib/db/queries/analysisResults';
import { projectRunReviewCards } from '@/components/analysis/analysis-history';
import type { CompanyTab } from '@/lib/params/companyRoute';

type Company = NonNullable<Awaited<ReturnType<typeof getCompanyById>>>;
type Signals = Awaited<ReturnType<typeof listSignalsForCompany>>;
type PersonaRoles = Awaited<ReturnType<typeof listPersonasForCompany>>;
type KnowledgeArticles = Awaited<ReturnType<typeof fetchArcpediaArticles>>;
type AnalysisRuns = Awaited<ReturnType<typeof listAnalysisRunsForSubject>>;
type CandidateOfferings = Awaited<ReturnType<typeof listConfirmedCandidateOfferingsForSubject>>;
type ReviewCards = Awaited<ReturnType<typeof projectRunReviewCards>>;

type CompanyDetailTabData =
  | { readonly tab: 'general'; readonly signals: Signals; readonly pendingProposalCount: number }
  | { readonly tab: 'personas'; readonly personaRoles: PersonaRoles }
  | { readonly tab: 'knowledge'; readonly articles: KnowledgeArticles }
  | {
      readonly tab: 'analysis';
      readonly analysisRuns: AnalysisRuns | null;
      readonly reviewCards: ReviewCards;
      readonly confirmedCandidateOfferings: CandidateOfferings | null;
    };

function assertNever(value: never): never {
  throw new Error(`Unhandled company detail tab: ${value}`);
}

async function loadCompanyDetailTab(company: Company, tab: CompanyTab): Promise<CompanyDetailTabData> {
  switch (tab) {
    case 'general': {
      const [signals, pendingProposalCount] = await Promise.all([
        listSignalsForCompany(company.id),
        countPendingProposalsForCompany(company.id),
      ]);
      return { tab, signals, pendingProposalCount };
    }
    case 'personas': {
      const personaRoles = await listPersonasForCompany(company.id);
      return { tab, personaRoles };
    }
    case 'knowledge': {
      let articles: KnowledgeArticles = [];
      try {
        articles = await fetchArcpediaArticles(company.name);
      } catch {
        articles = [];
      }
      return { tab, articles };
    }
    case 'analysis': {
      const [analysisRuns, confirmedCandidateOfferings] = await Promise.all([
        listAnalysisRunsForSubject({ targetType: 'company', subjectId: company.id }).catch(() => null),
        listConfirmedCandidateOfferingsForSubject({ targetType: 'company', subjectId: company.id }).catch(() => null),
      ]);
      const reviewCards = analysisRuns
        ? await projectRunReviewCards(analysisRuns, getAnalysisPacket)
        : [];
      return { tab, analysisRuns, reviewCards, confirmedCandidateOfferings };
    }
    default:
      return assertNever(tab);
  }
}

export async function CompanyDetail({
  id,
  tab = 'general',
}: {
  readonly id: number;
  readonly tab?: CompanyTab;
}) {
  let company: Company | undefined;
  try {
    company = await getCompanyById(id);
  } catch {
    return <CompanyDetailErrorState />;
  }

  if (!company) {
    notFound();
  }

  let tabData: CompanyDetailTabData;
  try {
    tabData = await loadCompanyDetailTab(company, tab);
  } catch {
    return <CompanyDetailErrorState />;
  }

  let content: ReactNode;
  switch (tabData.tab) {
      case 'general': {
        content = (
          <CompanyDetailGeneral
            company={company}
            signals={tabData.signals}
            pendingProposalCount={tabData.pendingProposalCount}
          />
        );
        break;
      }
      case 'personas': {
        content = <CompanyDetailPersonas personaRoles={tabData.personaRoles} />;
        break;
      }
      case 'knowledge': {
        content = <CompanyDetailKnowledge articles={tabData.articles} />;
        break;
      }
      case 'analysis': {
        content = (
          <CompanyDetailAnalysis
            analysisRuns={tabData.analysisRuns}
            reviewCards={tabData.reviewCards}
            confirmedCandidateOfferings={tabData.confirmedCandidateOfferings}
          />
        );
        break;
      }
      default:
        content = assertNever(tabData);
  }

  return (
    <div className="space-y-8 bg-white p-4 sm:p-8">
      <RecordViewTracker recordType="company" recordId={company.id} />
      <CompanyDetailHeader
        companyName={company.name}
        industry={company.industry}
        industrySource={company.fieldSources?.industry}
        recordId={company.id}
        canEnrich={Boolean(company.domain && env.APOLLO_API_KEY && env.ENRICHMENT_REVIEW_SECRET)}
        disabledReason={!company.domain ? 'Add a domain first' : 'Company enrichment is not configured'}
      />

      <CompanyDetailTabs id={company.id} activeTab={tab} />
      {content}
    </div>
  );
}
