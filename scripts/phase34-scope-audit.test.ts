import { describe, expect, it } from 'vitest';

import { runScopeAudit } from './phase34-scope-audit';

describe('Phase 34 source scope audit', () => {
  it('finds the tracked Phase 34 inventory and no forbidden boundary surface', () => {
    const result = runScopeAudit(process.cwd());

    expect(result.scannedFileCount).toBeGreaterThan(0);
    expect(result.scannedCategories).toEqual(
      expect.arrayContaining(['source', 'scripts', 'manifests', 'schema/query']),
    );
    expect(result.findings).toEqual([]);
  });
});
