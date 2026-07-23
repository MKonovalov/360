import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/db/queries/companies';
import { listSignalsForCompany } from '@/lib/db/queries/signals';
import { listPersonasForCompany } from '@/lib/db/queries/companyPersonaRoles';
import { Badge } from '@/components/ui/badge';
import { SignalBadge } from '@/components/companies/signal-badge';

// revenue_band/ownership_type are fixed-but-extensible pgEnums storing slug
// values — humanize for display rather than showing the raw slug to a
// mixed/leadership audience (mirrors company-list.tsx's convention).
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

export async function CompanyDetail({ id }: { id: number }) {
  const company = await getCompanyById(id);
  // RESEARCH.md Open Question #1 (RESOLVED): a structurally invalid/nonexistent
  // id is a real 404, distinct from the UI-SPEC's "fetch failed" error copy.
  if (!company) {
    notFound();
  }

  const [signals, personaRoles] = await Promise.all([
    listSignalsForCompany(id),
    listPersonasForCompany(id),
  ]);

  return (
    <div className="space-y-12 rounded-lg border border-slate-200 bg-white p-8">
      <div>
        <h1 className="text-[24px] font-semibold leading-[1.2] text-slate-900">{company.name}</h1>
        <p className="text-[14px] font-normal leading-[1.5] text-slate-500">
          {company.industry ?? '—'}
        </p>
      </div>

      <section>
        <h2 className="mb-4 text-[18px] font-semibold leading-[1.2] text-slate-900">
          Firmographics
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <FirmographicField label="Employee Count" value={company.employeeCountBand ?? '—'} />
          <FirmographicField label="HQ Location" value={company.hqLocation ?? '—'} />
          <FirmographicField label="Revenue Band" value={humanizeEnum(company.revenueBand)} />
          <FirmographicField label="Ownership Type" value={humanizeEnum(company.ownershipType)} />
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-[18px] font-semibold leading-[1.2] text-slate-900">
          Tech Stack
        </h2>
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
        <h2 className="mb-4 text-[18px] font-semibold leading-[1.2] text-slate-900">
          Buying Signals
        </h2>
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
    </div>
  );
}
