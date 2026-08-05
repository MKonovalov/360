import type { catalogStatusEnum } from '@/lib/db/schema';

// Next's searchParams type is `string | string[] | undefined` per key —
// take the first array element if a key is ever repeated in the URL.
// Byte-identical to companyFilters.ts's firstValue (D-02 shared shape).
export function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export interface SignalFiltersShape {
  search?: string;
  practiceAreaId?: number;
  category?: string;
  // Type-only import of catalogStatusEnum (Pitfall 5: use the 3-value
  // catalog_status enum, NOT the 2-value practice_area_status enum —
  // the latter is for practice_area rows, not signals).
  status?: (typeof catalogStatusEnum.enumValues)[number];
}

// Single shared parser for the /signals filter bar (SIG-03's four filter
// dimensions: practiceArea / category / status / search). practiceAreaId is
// the only numeric field — a malformed param degrades to undefined (NaN guard)
// rather than leaking a NaN into a downstream Drizzle eq() call (T-29-02-01).
export function parseSignalFilters(params: {
  [key: string]: string | string[] | undefined;
}): SignalFiltersShape {
  const rawPracticeArea = firstValue(params.practiceArea);
  const practiceAreaId = rawPracticeArea === undefined
    ? undefined
    : (() => {
        const n = Number(rawPracticeArea);
        return Number.isNaN(n) ? undefined : n;
      })();
  return {
    search: firstValue(params.search),
    practiceAreaId,
    category: firstValue(params.category),
    status: firstValue(params.status) as SignalFiltersShape['status'],
  };
}