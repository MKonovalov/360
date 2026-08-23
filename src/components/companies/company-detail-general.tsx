import type { getCompanyById } from '@/lib/db/queries/companies';
import type { listSignalsForCompany } from '@/lib/db/queries/signals';
import { Badge } from '@/components/ui/badge';
import { SignalBadge } from '@/components/companies/signal-badge';
import { ProposalBadge } from '@/components/companies/proposal-badge';
import { humanizeEnum, dateFormatter, FirmographicField, FieldSourceBadge } from '@/components/explorer/explorer-format';

type Company = NonNullable<Awaited<ReturnType<typeof getCompanyById>>>;
type Signals = Awaited<ReturnType<typeof listSignalsForCompany>>;

export function CompanyDetailGeneral({
  company,
  signals,
  pendingProposalCount,
}: {
  readonly company: Company;
  readonly signals: Signals;
  readonly pendingProposalCount: number;
}) {
  return (
    <>
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
    </>
  );
}
