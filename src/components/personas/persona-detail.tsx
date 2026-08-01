import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPersonaById } from '@/lib/db/queries/personas';
import { listCompanyRolesForPersona } from '@/lib/db/queries/companyPersonaRoles';
import { fetchArcpediaArticles } from '@/lib/arcpedia';
import { ExplorerCloseButton } from '@/components/explorer/explorer-table-behavior';
import { EnrichMenu } from '@/components/enrichment/enrichment-review-dialog';
import { RecordViewTracker } from '@/components/dashboard/record-view-tracker';
import { humanizeEnum, dateFormatter, FirmographicField, FieldSourceBadge } from '@/components/explorer/explorer-format';
import { env } from '@/lib/env';

// WR-06: enrichment/programmatic writes into persona data are on the
// near-term roadmap (CLAUDE.md Constraints) — once linkedinUrl is populated
// by an automated pipeline rather than typed in by staff, a non-http(s)
// scheme (e.g. `javascript:`) must never render as a clickable anchor href.
function isSafeUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

export async function PersonaDetail({ id }: { id: number }) {
  // EXPL-06/D-09: mirrors CompanyDetail's try/catch error-card pattern — a
  // DB-fetch failure degrades to known-good UI, never Next.js's default 500
  // page. The not-found check below is deliberately OUTSIDE this try/catch:
  // wrapping it in a try/catch would swallow Next.js's internal not-found
  // signal and render the wrong UI.
  let persona: Awaited<ReturnType<typeof getPersonaById>>;
  let roles: Awaited<ReturnType<typeof listCompanyRolesForPersona>> = [];
  try {
    persona = await getPersonaById(id);
    if (persona) {
      roles = await listCompanyRolesForPersona(id);
    }
  } catch {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-8 text-center">
        <p className="text-[18px] font-semibold leading-[1.2] text-slate-900">
          {"Couldn't load persona"}
        </p>
        <p className="text-sm text-slate-500">
          Something went wrong fetching this data. Try refreshing the page.
        </p>
      </div>
    );
  }

  // Mirrors CompanyDetail's convention: a structurally invalid/nonexistent
  // id is a real 404, distinct from PersonaList's "fetch failed" error copy.
  if (!persona) {
    notFound();
  }

  // D-04/Pitfall 4: fired only after the confirmed-exists check above — a
  // broken/deleted-record deep link must never write a recentlyViewed row
  // for a nonexistent id.
  // D-04: Current Company is shown separate from Career History.
  const current = roles.find((r) => r.role.isCurrent);
  const history = roles.filter((r) => !r.role.isCurrent);

  // D-03/D-10: sourced strictly from the persona's own name, never
  // current.company.name — independent failure domain from the DB-fetch
  // try/catch above (fetchArcpediaArticles never throws, Task 1).
  const articles = await fetchArcpediaArticles(persona.name);

  return (
    <div className="relative space-y-12 bg-white p-8">
      <RecordViewTracker recordType="persona" recordId={persona.id} />
      <div className="absolute top-3 right-3 flex items-center gap-1">
        <EnrichMenu
          entityType="persona"
          recordId={persona.id}
          canEnrich={Boolean(persona.email && env.PROSPEO_API_KEY && env.ENRICHMENT_REVIEW_SECRET)}
          disabledReason={!persona.email ? 'Add an email first' : 'Persona enrichment is not configured'}
        />
        <ExplorerCloseButton />
      </div>
      <div>
        <h1 className="text-[24px] font-semibold leading-[1.2] text-slate-900">{persona.name}</h1>
        <p className="text-[14px] font-normal leading-[1.5] text-slate-500">
          {persona.title ?? '—'}
        </p>
      </div>

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
              href={`/companies?selected=${current.company.id}`}
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
