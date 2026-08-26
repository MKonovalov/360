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
import { listActiveSearchTemplateProjections } from '@/lib/db/queries/searchTemplates';
import { getActiveSearchStatusProjection } from '@/lib/search/searchRuns';
import { isSearchEnabled } from '@/lib/search/templateContracts';
import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { AnalysisHistory, projectRunReviewCards } from '@/components/analysis/analysis-history';
import { ConfirmedCandidateOfferings } from '@/components/analysis/confirmed-candidate-offerings';

export async function CompanyDetail({ id }: { id: number }) {
  const { userId } = await requireStaffAccess();

  // EXPL-06/D-09: mirrors company-list.tsx's try/catch error-card pattern —
  // a DB-fetch failure degrades to known-good UI, never Next.js's default
  // 500 page. The not-found check below is deliberately OUTSIDE this
  // try/catch: wrapping it in a try/catch would swallow Next.js's internal
  // not-found signal and render the wrong UI.
  let company: Awaited<ReturnType<typeof getCompanyById>>;
  let signals: Awaited<ReturnType<typeof listSignalsForCompany>> = [];
  let personaRoles: Awaited<ReturnType<typeof listPersonasForCompany>> = [];
  let pendingProposalCount = 0;
  try {
    company = await getCompanyById(id);
    if (company) {
      [signals, personaRoles, pendingProposalCount] = await Promise.all([
        listSignalsForCompany(id),
        listPersonasForCompany(id),
        countPendingProposalsForCompany(id),
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

  let searchTemplates: Awaited<ReturnType<typeof listActiveSearchTemplateProjections>> = [];
  let activeSearchRun: Awaited<ReturnType<typeof getActiveSearchStatusProjection>>;
  if (isSearchEnabled()) {
    try {
      [searchTemplates, activeSearchRun] = await Promise.all([
        listActiveSearchTemplateProjections(),
        getActiveSearchStatusProjection(company.id, userId),
      ]);
    } catch {
      // Search availability is additive; a failed projection must not block the Company detail.
      searchTemplates = [];
      activeSearchRun = undefined;
    }
  }

  return (
    <div className="space-y-8 bg-white p-4 sm:p-8">
      <RecordViewTracker recordType="company" recordId={company.id} />
      <div className="absolute top-3 right-3 flex items-center gap-1">
        <EnrichMenu
          entityType="company"
          recordId={company.id}
          canEnrich={Boolean(company.domain && env.APOLLO_API_KEY && env.ENRICHMENT_REVIEW_SECRET)}
          disabledReason={!company.domain ? 'Add a domain first' : 'Company enrichment is not configured'}
          canAnalyze
          { ...(isSearchEnabled() ? {
            search: {
              company: { id: company.id, name: company.name, domain: company.domain },
              templates: searchTemplates,
              activeRun: activeSearchRun ?? null,
            },
          } : {}) }
        />
        <ExplorerCloseButton />
      </div>
      <div>
        <h1 className="text-[24px] font-semibold leading-[1.2] text-slate-900">{company.name}</h1>
        <div className="flex items-center gap-2">
          <p className="text-[14px] font-normal leading-[1.5] text-slate-500">
            {company.industry ?? '—'}
          </p>
          <FieldSourceBadge source={company.fieldSources?.industry} />
        </div>
      </div>

      <section>
        <h2 className="mb-4 text-[18px] font-semibold leading-[1.2] text-slate-900">
          Firmographics
        </h2>
        <div className="grid grid-cols-2 gap-4 @lg:grid-cols-4">
          <FirmographicField label="Employee Count" value={company.employeeCountBand ?? '—'} source={company.fieldSources?.employeeCountBand} />
          <FirmographicField label="HQ Location" value={company.hqLocation ?? '—'} source={company.fieldSources?.hqLocation} />
          <FirmographicField label="Revenue Band" value={humanizeEnum(company.revenueBand)} source={company.fieldSources?.revenueBand} />
          <FirmographicField label="Ownership Type" value={humanizeEnum(company.ownershipType)} source={company.fieldSources?.ownershipType} />
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-[18px] font-semibold leading-[1.2] text-slate-900">Tech Stack</h2>
          <FieldSourceBadge source={company.fieldSources?.techStack} />
        </div>
        {company.techStack && company.techStack.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {company.techStack.map((tool) => (
              <Badge key={tool} variant="outline">
                {tool}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-[14px] font-normal leading-[1.5] text-slate-500">
            No tech stack recorded.
          </p>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-[18px] font-semibold leading-[1.2] text-slate-900">
            Buying Signals
          </h2>
          <ProposalBadge count={pendingProposalCount} />
        </div>
        {signals.length > 0 ? (
          <ul className="space-y-2">
            {signals.map((signal) => (
              <li key={signal.id} className="flex flex-wrap items-center gap-2">
                <SignalBadge signalType={signal.signalType} />
                <span className="text-[12px] font-normal leading-[1.4] text-slate-500">
                  {signal.source ?? 'Unknown source'} · {dateFormatter.format(new Date(signal.detectedAt))}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[14px] font-normal leading-[1.5] text-slate-500">
            No buying signals recorded.
          </p>
        )}
      </section>

      <ConfirmedCandidateOfferings items={confirmedCandidateOfferings} />

      <AnalysisHistory rows={analysisRuns} reviewCards={reviewCards} />

      <section>
        <h2 className="mb-4 text-[18px] font-semibold leading-[1.2] text-slate-900">
          Linked Personas
        </h2>
        {personaRoles.length > 0 ? (
          <ul className="space-y-2">
            {personaRoles.map(({ persona, role }) => (
              <li key={persona.id} className="text-[14px] font-normal leading-[1.5] text-slate-900">
                {persona.name}
                {role.title ? ` — ${role.title}` : ''}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[14px] font-normal leading-[1.5] text-slate-500">
            No linked personas.
          </p>
        )}
      </section>

      <CompanyDetailTabs id={company.id} activeTab={tab} />
      {content}
    </div>
  );
}
