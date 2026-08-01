// Shared formatting helpers for entity list/detail views (companies +
// personas). Previously duplicated verbatim across company-detail.tsx,
// company-list.tsx, persona-detail.tsx, and persona-list.tsx — the same
// drift risk the project already closed once for
// parseCompanyFilters/parsePersonaFilters (see
// src/lib/params/companyFilters.ts:9-11, 03-REVIEW.md CR-01).

// revenue_band/ownership_type/seniority are fixed-but-extensible pgEnums
// storing slug values (e.g. "under_50m", "c_level") — humanize for display
// rather than showing the raw slug to a mixed/leadership audience.
export function humanizeEnum(value: string | null): string {
  if (!value) return '—';
  return value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export const dateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

export type FieldSource = 'manual' | 'apollo' | 'prospeo';

const SOURCE_LABELS: Record<FieldSource, string> = {
  manual: 'Manual',
  apollo: 'Apollo',
  prospeo: 'Prospeo',
};

export function FieldSourceBadge({ source = 'manual' }: { source?: FieldSource }) {
  return (
    <span className="inline-flex rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
      {SOURCE_LABELS[source]}
    </span>
  );
}

export function FirmographicField({
  label,
  value,
  source,
}: {
  label: string;
  value: string;
  source?: FieldSource;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <p className="text-[12px] font-normal leading-[1.4] text-slate-500">{label}</p>
        <FieldSourceBadge source={source} />
      </div>
      <p className="text-[14px] font-normal leading-[1.5] text-slate-900">{value}</p>
    </div>
  );
}
