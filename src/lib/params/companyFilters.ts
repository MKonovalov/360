import type { CompanyFilters as CompanyFiltersShape } from '@/lib/db/queries/companies';

// Next's searchParams type is `string | string[] | undefined` per key —
// take the first array element if a key is ever repeated in the URL.
export function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Single shared implementation for both /companies and /companies/[id] — was
// previously duplicated per-page (companies/page.tsx, companies/[id]/page.tsx),
// the same drift risk personaFilters.ts already closed once (03-REVIEW.md CR-01).
export function parseCompanyFilters(params: {
  [key: string]: string | string[] | undefined;
}): CompanyFiltersShape {
  return {
    search: firstValue(params.search),
    industry: firstValue(params.industry),
    signalType: firstValue(params.signal),
    revenueBand: firstValue(params.revenueBand),
    ownershipType: firstValue(params.ownershipType),
  };
}

// The one definition of parseSelectedId in the codebase — personaFilters.ts
// re-exports this rather than duplicating it, per D-02's "one shared param
// name" for the `selected` query param used by both /companies and /personas.
export function parseSelectedId(params: {
  [key: string]: string | string[] | undefined;
}): number | undefined {
  const raw = firstValue(params.selected);
  const id = raw ? Number(raw) : NaN;
  return Number.isNaN(id) ? undefined : id;
}
