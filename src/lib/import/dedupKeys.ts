// Pure normalization functions for dedup key comparison (D-02, D-04).
// Stored in normalized form so the DB-level unique constraint is a plain
// column constraint — no expression index needed.

export function normalizeDomain(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '');
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

// Returns a copy of row with only entries where value is neither undefined
// nor empty string — implements D-10's "blank cell leaves existing field
// untouched" merge semantics without a DB round-trip.
export function buildUpdatePatch<T extends Record<string, unknown>>(row: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(row).filter(([, value]) => value !== undefined && value !== '')
  ) as Partial<T>;
}
