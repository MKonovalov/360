import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/db/queries/companies';
import { listSignalsForCompany } from '@/lib/db/queries/signals';
import { listPersonasForCompany } from '@/lib/db/queries/companyPersonaRoles';
import { countPendingProposalsForCompany } from '@/lib/db/queries/proposals';
import { Badge } from '@/components/ui/badge';
import { SignalBadge } from '@/components/companies/signal-badge';
import { ProposalBadge } from '@/components/companies/proposal-badge';
import { fetchArcpediaArticles } from '@/lib/arcpedia';
import { ExplorerCloseButton } from '@/components/explorer/explorer-table-behavior';
import { EnrichMenu } from '@/components/enrichment/enrichment-review-dialog';
import { RecordViewTracker } from '@/components/dashboard/record-view-tracker';
import { humanizeEnum, dateFormatter, FirmographicField, FieldSourceBadge } from '@/components/explorer/explorer-format';
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
    }
  } catch {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-8 text-center">
        <p className="text-[18px] font-semibold leading-[1.2] text-slate-900">
          {"Couldn't load company"}
        </p>
        <p className="text-sm text-slate-500">
          Something went wrong fetching this data. Try refreshing the page.
        </p>
      </div>
    );
  }

  // RESEARCH.md Open Question #1 (RESOLVED): a structurally invalid/nonexistent
  // id is a real 404, distinct from the UI-SPEC's "fetch failed" error copy.
  if (!company) {
    notFound();
  }

  const [analysisRuns, confirmedCandidateOfferings] = await Promise.all([
    listAnalysisRunsForSubject({ targetType: 'company', subjectId: company.id }).catch(() => null),
    listConfirmedCandidateOfferingsForSubject({ targetType: 'company', subjectId: company.id }).catch(() => null),
  ]);
  const reviewCards = analysisRuns
    ? await projectRunReviewCards(analysisRuns, getAnalysisPacket)
    : [];

  // D-04/Pitfall 4: fired only after the confirmed-exists check above — a
  // broken/deleted-record deep link must never write a recentlyViewed row
  // for a nonexistent id.
  // D-10: independent failure domain from the DB-fetch try/catch above —
  // fetchArcpediaArticles never throws (Task 1), so an Arcpedia
  // timeout/failure must never surface the DB error card above, and a
  // DB failure must never be masked as "no articles".
  const articles = await fetchArcpediaArticles(company.name);

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
    <div className="relative space-y-12 bg-white p-8">
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

      {articles.length > 0 ? (
        <section>
          <h2 className="mb-4 text-[18px] font-semibold leading-[1.2] text-slate-900">
            Related Knowledge
          </h2>
          <ul className="space-y-4">
            {articles.map((article) => (
              <li key={article.slug}>
                <a
                  href={`https://arcpedia.arclumen.de/wiki/${encodeURIComponent(article.slug)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[14px] font-normal leading-[1.5] text-indigo-600"
                >
                  {article.title}
                </a>
                <p className="text-[14px] font-normal leading-[1.5] text-slate-500">
                  {article.snippet}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
