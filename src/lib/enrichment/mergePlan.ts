// Pure merge-planning: given the current DB record and Apollo's mapped fields,
// classify each incoming field as 'fill' (target empty → pre-accepted) or
// 'conflict' (target populated & differs → opt-in). Identical values produce no
// row. This is the ENRC-02 auto-fill-empty-only policy as testable logic.
// No network, no DB.

import type { EnrichedField } from './apolloMap';

export type EnrichmentPlanRow = {
  field: string;
  currentValue: string | string[] | null;
  incomingValue: string | string[];
  confidence?: number;
  classification: 'fill' | 'conflict';
  preAccepted: boolean;
};

function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

// Order-insensitive equality for the two supported value shapes (string, string[]).
function valuesEqual(a: unknown, b: string | string[]): boolean {
  if (Array.isArray(b)) {
    if (!Array.isArray(a)) return false;
    if (a.length !== b.length) return false;
    const sa = [...(a as string[])].map((x) => String(x).toLowerCase()).sort();
    const sb = [...b].map((x) => x.toLowerCase()).sort();
    return sa.every((x, i) => x === sb[i]);
  }
  if (Array.isArray(a)) return false;
  return String(a) === String(b);
}

// Builds the review plan. `current` is the DB record (any extra keys ignored);
// only the fields present in `incoming` are considered.
export function buildEnrichmentPlan(
  current: Record<string, unknown>,
  incoming: EnrichedField[]
): EnrichmentPlanRow[] {
  const rows: EnrichmentPlanRow[] = [];
  for (const f of incoming) {
    const cur = current[f.field];
    if (isEmpty(cur)) {
      rows.push({
        field: f.field,
        currentValue: null,
        incomingValue: f.incomingValue,
        confidence: f.confidence,
        classification: 'fill',
        preAccepted: true,
      });
      continue;
    }
    // populated — skip if identical, else surface as an opt-in conflict
    if (valuesEqual(cur, f.incomingValue)) continue;
    rows.push({
      field: f.field,
      currentValue: cur as string | string[],
      incomingValue: f.incomingValue,
      confidence: f.confidence,
      classification: 'conflict',
      preAccepted: false,
    });
  }
  return rows;
}
