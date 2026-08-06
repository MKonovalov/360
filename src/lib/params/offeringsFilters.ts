// Next's searchParams type is `string | string[] | undefined` per key —
// take the first array element if a key is ever repeated in the URL.
// Byte-identical to signalFilters.ts's firstValue (D-02 shared shape).
export function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export interface OfferingsFiltersShape {
  practiceAreaId?: number;
}

// Single shared parser for the /offerings Matrix tab filter bar (OFR-05's one
// filter dimension: practiceArea). practiceAreaId is the only numeric field —
// a malformed param degrades to undefined (NaN guard) rather than leaking a
// NaN into a downstream Drizzle eq() call (T-30-09-03: the id itself is
// non-sensitive; the underlying data fetch stays staff-gated at the page).
export function parseOfferingsFilters(params: {
  [key: string]: string | string[] | undefined;
}): OfferingsFiltersShape {
  const rawPracticeArea = firstValue(params.practiceArea);
  const practiceAreaId = rawPracticeArea === undefined
    ? undefined
    : (() => {
        const n = Number(rawPracticeArea);
        return Number.isNaN(n) ? undefined : n;
      })();
  return { practiceAreaId };
}
