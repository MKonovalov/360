import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPersonaById } from '@/lib/db/queries/personas';
import { listCompanyRolesForPersona } from '@/lib/db/queries/companyPersonaRoles';

// seniority is a fixed-but-extensible pgEnum storing slug values
// (e.g. "c_level") — humanize for display rather than showing the raw slug
// to a mixed/leadership audience (mirrors company-detail.tsx's convention).
function humanizeEnum(value: string | null): string {
  if (!value) return '—';
  return value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

function FirmographicField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[12px] font-normal leading-[1.4] text-slate-500">{label}</p>
      <p className="text-[14px] font-normal leading-[1.5] text-slate-900">{value}</p>
    </div>
  );
}

export async function PersonaDetail({ id }: { id: number }) {
  const persona = await getPersonaById(id);
  // Mirrors CompanyDetail's convention: a structurally invalid/nonexistent
  // id is a real 404, distinct from PersonaList's "fetch failed" error copy.
  if (!persona) {
    notFound();
  }

  const roles = await listCompanyRolesForPersona(id);
  // D-04: Current Company is shown separate from Career History.
  const current = roles.find((r) => r.role.isCurrent);
  const history = roles.filter((r) => !r.role.isCurrent);

  return (
    <div className="space-y-12 rounded-lg border border-slate-200 bg-white p-8">
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
          <FirmographicField label="Title" value={persona.title ?? '—'} />
          <FirmographicField label="Seniority" value={humanizeEnum(persona.seniority)} />
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
              <p>
                <a
                  href={`mailto:${persona.email}`}
                  className="text-[14px] font-normal leading-[1.5] text-indigo-600"
                >
                  {persona.email}
                </a>
              </p>
            ) : null}
            {persona.linkedinUrl ? (
              <p>
                <a
                  href={persona.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[14px] font-normal leading-[1.5] text-indigo-600"
                >
                  {persona.linkedinUrl}
                </a>
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
