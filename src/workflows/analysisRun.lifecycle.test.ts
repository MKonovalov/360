import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('analysisRun review lifecycle wiring', () => {
  it('reconciles a persisted completed run before returning from workflow completion', () => {
    const source = readFileSync(new URL('./analysisRun.ts', import.meta.url), 'utf8');

    expect(source).toContain('reconcileCompletedRun,');
    expect(source).toContain('await reconcileCompletedRun(applicationRunId);');
  });
});
