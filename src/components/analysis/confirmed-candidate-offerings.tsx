import type { ConfirmedCandidateDisplayRow } from '@/lib/analysis/experienceContracts';

type ConfirmedCandidateOfferingsProps = {
  readonly items: readonly ConfirmedCandidateDisplayRow[] | null;
};

export function ConfirmedCandidateOfferings({ items }: ConfirmedCandidateOfferingsProps) {
  return (
    <section aria-labelledby="confirmed-candidate-offerings-heading" className="space-y-3">
      <h2
        id="confirmed-candidate-offerings-heading"
        className="text-[18px] font-semibold leading-[1.2] text-slate-900"
      >
        Confirmed Candidate Offerings
      </h2>
      {items === null ? (
        <div className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-6 text-center">
          <p className="text-[18px] font-semibold leading-[1.2] text-slate-900">
            Couldn&apos;t load confirmed candidate offerings
          </p>
          <p className="text-sm text-slate-500">Something went wrong fetching this data. Try refreshing the page.</p>
        </div>
      ) : items.length === 0 ? (
        <p className="text-[14px] font-normal leading-[1.5] text-slate-500">
          No confirmed candidate offerings for this record.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={`${item.offeringId}-${item.findingRowId}-${item.sourceRowId}`}
              data-candidate-source-row-id={item.sourceRowId}
              className="space-y-2 rounded-lg border border-slate-200 bg-white p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[14px] font-semibold leading-[1.5] text-slate-900">{item.offeringName}</h3>
                <span className="inline-flex rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                  {item.evidenceStatus}
                </span>
              </div>
              <p className="text-[14px] leading-[1.5] text-slate-600">Triggering signal: {item.signalName}</p>
              <a
                href={item.canonicalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[13px] text-indigo-600 hover:text-indigo-800 hover:underline"
              >
                {item.sourceTitle}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export const CandidateSection = ConfirmedCandidateOfferings;
