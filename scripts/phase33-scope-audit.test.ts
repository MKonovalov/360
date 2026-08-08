import { describe, expect, it } from 'vitest';

import { runScopeAudit } from './phase33-scope-audit';

describe('Phase 33 source scope audit', () => {
  it('finds the tracked Phase 33 inventory and no forbidden production surface', () => {
    const result = runScopeAudit(process.cwd());

    expect(result.scannedFileCount).toBeGreaterThan(0);
    expect(result.scannedCategories).toEqual(
      expect.arrayContaining(['source', 'scripts', 'manifests', 'schema/query']),
    );
    expect(result.findings).toEqual([]);
  });
});
