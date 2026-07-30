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

export function FirmographicField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[12px] font-normal leading-[1.4] text-slate-500">{label}</p>
      <p className="text-[14px] font-normal leading-[1.5] text-slate-900">{value}</p>
    </div>
  );
}
