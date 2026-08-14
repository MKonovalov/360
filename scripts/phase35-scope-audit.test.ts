import { describe, expect, it } from 'vitest';

import { PHASE35_HISTORICAL_REFS, runScopeAudit } from './phase35-scope-audit';

describe('Phase 35 source scope audit', () => {
  it('finds the historical Phase 35 inventory and no forbidden boundary surface', () => {
    const result = runScopeAudit(process.cwd());

    expect(result.mode).toBe('historical');
    expect(result.targetRef).toBe(PHASE35_HISTORICAL_REFS.targetRef);
    expect(result.baseRef).toBe(PHASE35_HISTORICAL_REFS.baseRef);
    expect(result.scannedFileCount).toBeGreaterThan(0);
    expect(result.scannedCategories).toEqual(expect.arrayContaining(['source', 'scripts', 'manifests', 'e2e']));
    expect(result.findings).toEqual([]);
  });
});
