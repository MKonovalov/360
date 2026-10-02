import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { getPersonaById } from '@/lib/db/queries/personas';
import { listCompanyRolesForPersona } from '@/lib/db/queries/companyPersonaRoles';
import { fetchArcpediaArticles } from '@/lib/arcpedia';
import { PersonaDetailErrorState } from '@/components/personas/persona-detail-states';
import { PersonaDetailTabs } from '@/components/personas/persona-detail-tabs';
import { EnrichMenu } from '@/components/enrichment/enrichment-review-dialog';
import { RecordViewTracker } from '@/components/dashboard/record-view-tracker';
import { humanizeEnum, dateFormatter, FirmographicField, FieldSourceBadge } from '@/components/explorer/explorer-format';
import { Button } from '@/components/ui/button';
import { env } from '@/lib/env';
import { listAnalysisRunsForSubject } from '@/lib/db/queries/analysisRuns';
import { listConfirmedCandidateOfferingsForSubject } from '@/lib/db/queries/confirmedCandidates';
import { getAnalysisPacket } from '@/lib/db/queries/analysisResults';
import { AnalysisHistory, projectRunReviewCards } from '@/components/analysis/analysis-history';
import { ConfirmedCandidateOfferings } from '@/components/analysis/confirmed-candidate-offerings';
import type { PersonaTab } from '@/lib/params/personaRoute';
import { XIcon } from 'lucide-react';

type Persona = NonNullable<Awaited<ReturnType<typeof getPersonaById>>>;
type CompanyRoles = Awaited<ReturnType<typeof listCompanyRolesForPersona>>;
type KnowledgeArticles = Awaited<ReturnType<typeof fetchArcpediaArticles>>;
type AnalysisRuns = Awaited<ReturnType<typeof listAnalysisRunsForSubject>>;
type CandidateOfferings = Awaited<ReturnType<typeof listConfirmedCandidateOfferingsForSubject>>;
type ReviewCards = Awaited<ReturnType<typeof projectRunReviewCards>>;

type PersonaDetailTabData =
  | { readonly tab: 'general'; readonly roles: CompanyRoles }
  | { readonly tab: 'knowledge'; readonly articles: KnowledgeArticles }
  | {
      readonly tab: 'analysis';
      readonly analysisRuns: AnalysisRuns | null;
      readonly reviewCards: ReviewCards;
      readonly confirmedCandidateOfferings: CandidateOfferings | null;
    };

function assertNever(value: never): never {
  throw new Error(`Unhandled persona detail tab: ${value}`);
}

// WR-06: enrichment/programmatic writes into persona data are on the
// near-term roadmap (CLAUDE.md Constraints) — once linkedinUrl is populated
// by an automated pipeline rather than typed in by staff, a non-http(s)
// scheme (e.g. `javascript:`) must never render as a clickable anchor href.
function isSafeUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

async function loadPersonaDetailTab(persona: Persona, tab: PersonaTab): Promise<PersonaDetailTabData> {
  switch (tab) {
    case 'general': {
      const roles = await listCompanyRolesForPersona(persona.id);
      return { tab, roles };
    }
    case 'knowledge': {
      // D-03/D-10: sourced strictly from the persona's own name, never the
      // current company name. fetchArcpediaArticles never throws.
      const articles = await fetchArcpediaArticles(persona.name);
      return { tab, articles };
    }
    case 'analysis': {
      const [analysisRuns, confirmedCandidateOfferings] = await Promise.all([
        listAnalysisRunsForSubject({ targetType: 'persona', subjectId: persona.id }).catch(() => null),
        listConfirmedCandidateOfferingsForSubject({ targetType: 'persona', subjectId: persona.id }).catch(() => null),
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

function GeneralTab({ persona, roles }: { readonly persona: Persona; readonly roles: CompanyRoles }) {
  // D-04: Current Company is shown separate from Career History.
  const current = roles.find((r) => r.role.isCurrent);
  const history = roles.filter((r) => !r.role.isCurrent);

  return (
    <div className="space-y-12">
      <section>
        <h2 className="mb-4 text-[18px] font-semibold leading-[1.2] text-slate-900">
          Role & Seniority
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <FirmographicField label="Title" value={persona.title ?? '—'} source={persona.fieldSources?.title} />
          <FirmographicField label="Seniority" value={humanizeEnum(persona.seniority)} source={persona.fieldSources?.seniority} />
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-[18px] font-semibold leading-[1.2] text-slate-900">
          Current Company
        </h2>
        {current ? (
          <div>
            <Link
              href={`/companies/${current.company.id}`}
              className="text-[14px] font-normal leading-[1.5] text-indigo-600"
            >
              {current.company.name}
            </Link>
            <p className="text-[14px] font-normal leading-[1.5] text-slate-900">
              {current.role.title}
            </p>
          </div>
        ) : (
          <p className="text-[14px] font-normal leading-[1.5] text-slate-500">
            No current company on record.
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-[18px] font-semibold leading-[1.2] text-slate-900">
          Career History
        </h2>
        {history.length > 0 ? (
          <ul className="space-y-2">
            {history.map(({ company, role }) => (
              <li key={role.id} className="text-[14px] font-normal leading-[1.5] text-slate-900">
                {company.name}
                {role.title ? ` — ${role.title}` : ''}
                <span className="text-[12px] font-normal leading-[1.4] text-slate-500">
                  {' · '}
                  {role.startDate ? dateFormatter.format(new Date(role.startDate)) : '—'}
                  {' – '}
                  {role.endDate ? dateFormatter.format(new Date(role.endDate)) : 'Present'}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[14px] font-normal leading-[1.5] text-slate-500">
            No career history recorded.
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-[18px] font-semibold leading-[1.2] text-slate-900">
          Contact Info
        </h2>
        {persona.email || persona.linkedinUrl ? (
          <div className="space-y-2">
            {persona.email ? (
              <p className="flex items-center gap-2">
                <a
                  href={`mailto:${persona.email}`}
                  className="text-[14px] font-normal leading-[1.5] text-indigo-600"
                >
                  {persona.email}
                </a>
              </p>
            ) : null}
            {persona.linkedinUrl && isSafeUrl(persona.linkedinUrl) ? (
              <p className="flex items-start gap-2 [&>span]:shrink-0">
                <a
                  href={persona.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 break-all text-[14px] font-normal leading-[1.5] text-indigo-600"
                >
                  {persona.linkedinUrl}
                </a>
                <FieldSourceBadge source={persona.fieldSources?.linkedinUrl} />
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-[14px] font-normal leading-[1.5] text-slate-500">
            No contact info on record.
          </p>
        )}
      </section>

    </div>
  );
}

function KnowledgeTab({ articles }: { readonly articles: KnowledgeArticles }) {
  return (
    <section>
      <h2 className="mb-4 text-[18px] font-semibold leading-[1.2] text-slate-900">
        Related Knowledge
      </h2>
      {articles.length > 0 ? (
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
      ) : (
        <p className="text-[14px] font-normal leading-[1.5] text-slate-500">No related knowledge found.</p>
      )}
    </section>
  );
}

export async function PersonaDetail({
  id,
  tab = 'general',
}: {
  readonly id: number;
  readonly tab?: PersonaTab;
}) {
  // EXPL-06/D-09: a DB-fetch failure degrades to known-good UI, never
  // Next.js's default 500 page. The not-found check is deliberately OUTSIDE
  // the try/catch: wrapping it would swallow Next.js's internal not-found signal.
  let persona: Persona | undefined;
  try {
    persona = await getPersonaById(id);
  } catch {
    return <PersonaDetailErrorState />;
  }

  if (!persona) {
    notFound();
  }

  let tabData: PersonaDetailTabData;
  try {
    tabData = await loadPersonaDetailTab(persona, tab);
  } catch {
    return <PersonaDetailErrorState />;
  }

  let content: ReactNode;
  switch (tabData.tab) {
    case 'general':
      content = <GeneralTab persona={persona} roles={tabData.roles} />;
      break;
    case 'knowledge':
      content = <KnowledgeTab articles={tabData.articles} />;
      break;
    case 'analysis':
      content = (
        <>
          <ConfirmedCandidateOfferings items={tabData.confirmedCandidateOfferings} />
          <AnalysisHistory rows={tabData.analysisRuns} reviewCards={tabData.reviewCards} />
        </>
      );
      break;
    default:
      content = assertNever(tabData);
  }

  return (
    <div className="relative space-y-8 bg-white p-4 sm:p-8">
      {/* D-04/Pitfall 4: fired only after the confirmed-exists check above. */}
      <RecordViewTracker recordType="persona" recordId={persona.id} />
      <div className="absolute top-3 right-3 flex items-center gap-1">
        <EnrichMenu
          entityType="persona"
          recordId={persona.id}
          canEnrich={Boolean(persona.email && env.PROSPEO_API_KEY && env.ENRICHMENT_REVIEW_SECRET)}
          disabledReason={!persona.email ? 'Add an email first' : 'Persona enrichment is not configured'}
          canAnalyze
        />
        <Button asChild variant="ghost" size="icon" aria-label="Back to personas">
          <Link href="/personas">
            <XIcon />
          </Link>
        </Button>
      </div>
      <div>
        <h1 className="text-[24px] font-semibold leading-[1.2] text-slate-900">{persona.name}</h1>
        <p className="text-[14px] font-normal leading-[1.5] text-slate-500">
          {persona.title ?? '—'}
        </p>
      </div>
      <PersonaDetailTabs id={persona.id} activeTab={tab} />
      {content}
    </div>
  );
}
