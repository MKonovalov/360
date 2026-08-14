import { describe, expect, it } from 'vitest';

import { PHASE34_HISTORICAL_REFS, runScopeAudit } from './phase34-scope-audit';

describe('Phase 34 source scope audit', () => {
  it('finds the tracked Phase 34 inventory and no forbidden boundary surface', () => {
    const result = runScopeAudit(process.cwd());

    expect(result.mode).toBe('historical');
    expect(result.targetRef).toBe(PHASE34_HISTORICAL_REFS.targetRef);
    expect(result.baseRef).toBe(PHASE34_HISTORICAL_REFS.baseRef);
    expect(result.scannedFileCount).toBeGreaterThan(0);
    expect(result.scannedCategories).toEqual(
      expect.arrayContaining(['source', 'scripts', 'manifests', 'schema/query']),
    );
    expect(result.findings).toEqual([]);
  });
});
