import type { PersonaFilters as PersonaFiltersShape } from '@/lib/db/queries/personas';

// Next's searchParams type is `string | string[] | undefined` per key —
// take the first array element if a key is ever repeated in the URL.
export function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Single shared implementation for both /personas and /personas/[id] — was
// previously duplicated per-page, which let the hasSignals tri-state bug
// (03-REVIEW.md CR-01) drift independently in each copy.
export function parsePersonaFilters(params: {
  [key: string]: string | string[] | undefined;
}): PersonaFiltersShape {
  // Tri-state: 'true' -> true, 'false' -> false, anything else (including
  // absent) -> undefined. A collapsing `=== 'true'` boolean would conflate
  // "no filter applied" with "explicitly filtered to No" — the gap this
  // module exists to close.
  const hasSignalsRaw = firstValue(params.hasSignals);

  return {
    search: firstValue(params.search),
    seniority: firstValue(params.seniority),
    currentCompany: firstValue(params.currentCompany),
    hasSignals: hasSignalsRaw === 'true' ? true : hasSignalsRaw === 'false' ? false : undefined,
  };
}
