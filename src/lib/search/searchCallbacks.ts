import 'server-only';

import { reconcileSearchRun } from './searchArcAgentnet';
import { findSearchRunByPartnerJobId, listInFlightSearchRuns } from './searchRuns';

export type SearchCallbackIngestResult = 'ingested' | 'no_run' | 'failed';

interface IngestDependencies {
  readonly findRun?: typeof findSearchRunByPartnerJobId;
  readonly reconcile?: typeof reconcileSearchRun;
}

// A verified callback is only a trigger: ingestion re-polls the partner and
// runs the same reconcile path as the browser poll, so it never trusts the
// callback body for results and stays idempotent against a concurrent poll.
export async function ingestSearchCallback(
  partnerJobId: string,
  dependencies: IngestDependencies = {},
): Promise<SearchCallbackIngestResult> {
  const findRun = dependencies.findRun ?? findSearchRunByPartnerJobId;
  const reconcile = dependencies.reconcile ?? reconcileSearchRun;
  try {
    const run = await findRun(partnerJobId);
    if (!run) return 'no_run';
    await reconcile(run.id, run.initiatingUserId);
    return 'ingested';
  } catch {
    // The scheduled sweep (and any browser poll) retries the same run.
    return 'failed';
  }
}

const SWEEP_WINDOW_MS = 48 * 60 * 60 * 1000;
const SWEEP_LIMIT = 20;

export interface SearchSweepResult {
  readonly checked: number;
  readonly failed: number;
}

interface SweepDependencies {
  readonly listRuns?: typeof listInFlightSearchRuns;
  readonly reconcile?: typeof reconcileSearchRun;
  readonly now?: Date;
}

// Safety net for lost webhooks: reconcile every recent in-flight run.
export async function reconcileInFlightSearchRuns(dependencies: SweepDependencies = {}): Promise<SearchSweepResult> {
  const listRuns = dependencies.listRuns ?? listInFlightSearchRuns;
  const reconcile = dependencies.reconcile ?? reconcileSearchRun;
  const since = new Date((dependencies.now ?? new Date()).getTime() - SWEEP_WINDOW_MS);
  const runs = await listRuns(since, SWEEP_LIMIT);
  let failed = 0;
  for (const run of runs) {
    try {
      await reconcile(run.id, run.initiatingUserId);
    } catch {
      failed += 1;
    }
  }
  return { checked: runs.length, failed };
}
