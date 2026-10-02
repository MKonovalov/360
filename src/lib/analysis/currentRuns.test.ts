import { describe, expect, it } from 'vitest';

import { currentInternalRuns, currentPartnerRuns } from './currentRuns';

const runs = (statuses: string[]) => statuses.map((status, index) => ({ runId: index + 1, status }));

describe('current Analysis runs', () => {
  it('keeps only in-flight and awaiting-review internal runs', () => {
    const all = runs(['queued', 'running', 'pending_review', 'failed', 'cancelled', 'confirmed', 'dismissed', 'completed']);

    expect(currentInternalRuns(all).map((run) => run.status)).toEqual(['queued', 'running', 'pending_review']);
  });

  it('keeps in-flight and completed partner runs, dropping failed and cancelled ones', () => {
    const all = runs(['queued', 'running', 'completed', 'failed', 'cancelled']);

    expect(currentPartnerRuns(all).map((run) => run.status)).toEqual(['queued', 'running', 'completed']);
  });
});
