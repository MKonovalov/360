import { describe, expect, it } from 'vitest';

import { runPhase38ScopeAudit } from './phase38-scope-audit';

describe('Phase 38 implementation scope audit', () => {
  it('reports the selected tracked scope and the Phase 39 handoff', () => {
    const report = runPhase38ScopeAudit();

    expect(report.phase).toBe(38);
    expect(report.scannedFiles.length).toBeGreaterThan(0);
    expect(report.handoff.phase39).toContain('Owns broad adversarial verification');
  });

  it('keeps the quarantine facade and internal normalizer on the allowed packet path', () => {
    const report = runPhase38ScopeAudit();

    expect(report.scannedFiles).toContain('src/lib/analysis/results.ts');
    expect(report.findings).toEqual([]);
    expect(report.findingCount).toBe(0);
  });
});
