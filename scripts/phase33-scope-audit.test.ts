import { describe, expect, it } from 'vitest';

import { PHASE33_HISTORICAL_REFS, runScopeAudit } from './phase33-scope-audit';

describe('Phase 33 source scope audit', () => {
  it('finds the tracked Phase 33 inventory and no forbidden production surface', () => {
    const result = runScopeAudit(process.cwd());

    expect(result.mode).toBe('historical');
    expect(result.targetRef).toBe(PHASE33_HISTORICAL_REFS.targetRef);
    expect(result.baseRef).toBe(PHASE33_HISTORICAL_REFS.baseRef);
    expect(result.scannedFileCount).toBeGreaterThan(0);
    expect(result.scannedCategories).toEqual(
      expect.arrayContaining(['source', 'scripts', 'manifests', 'schema/query']),
    );
    expect(result.findings).toEqual([]);
  });
});
