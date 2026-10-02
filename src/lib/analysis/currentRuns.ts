// The Analysis tab shows only runs that still matter: ones in flight, internal
// runs awaiting review, and partner runs whose findings are the current result.
// Failed, cancelled, confirmed and dismissed runs are history; they stay in the
// database and remain visible in Settings > Logs.
const CURRENT_INTERNAL_STATUSES: ReadonlySet<string> = new Set(['queued', 'running', 'pending_review']);
const CURRENT_PARTNER_STATUSES: ReadonlySet<string> = new Set(['queued', 'running', 'completed']);

export function currentInternalRuns<T extends { readonly status: string }>(runs: readonly T[]): T[] {
  return runs.filter((run) => CURRENT_INTERNAL_STATUSES.has(run.status));
}

export function currentPartnerRuns<T extends { readonly status: string }>(runs: readonly T[]): T[] {
  return runs.filter((run) => CURRENT_PARTNER_STATUSES.has(run.status));
}
