import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = resolve(process.cwd());
const phaseDirectory = resolve(root, '.planning/phases/39-security-review-boundaries-end-to-end-verification');

function readPhaseFile(name: string): string {
  return readFileSync(resolve(phaseDirectory, name), 'utf8');
}

describe('Phase 39 final scope audit', () => {
  it('requires all prior summaries and an exclusive evidence ledger', () => {
    const summaries = Array.from({ length: 7 }, (_, index) => `39-0${index + 1}-SUMMARY.md`);

    expect(summaries.every((summary) => existsSync(resolve(phaseDirectory, summary)))).toBe(true);
    expect(readPhaseFile('39-EVIDENCE.md')).toContain('## Final Disposition');
  });

  it('requires every final gate row to carry an honest execution status', () => {
    const evidence = readPhaseFile('39-EVIDENCE.md');
    const rows = evidence.split('\n').filter((line) => line.startsWith('| ') && line.endsWith(' |'));

    expect(rows.length).toBeGreaterThan(1);
    for (const row of rows.filter((line) => !line.includes('| Status |') && !line.includes('|---'))) {
      expect(row).toMatch(/\| (PASS|BLOCKED|NOT-RUN) \|/);
      if (row.includes('| BLOCKED |') || row.includes('| NOT-RUN |')) {
        expect(row).not.toMatch(/\| PASS \|/);
      }
    }
  });

  it('keeps required route and exclusion canaries non-vacuous', () => {
    const scopeAudit = readPhaseFile('39-SCOPE-AUDIT.md');
    const agentsPage = readFileSync(resolve(root, 'src/app/(dashboard)/agents/page.tsx'), 'utf8');
    const fixtures = readFileSync(resolve(root, 'src/lib/verification/phase39Fixtures.ts'), 'utf8');

    expect(agentsPage).toContain("export default async function AgentsPage");
    expect(scopeAudit).toContain('No `/reviews/agents` application route.');
    expect(scopeAudit).toContain('writesAllowed=false');
    expect(fixtures).toContain("writesAllowed: false");
    expect(existsSync(resolve(root, 'src/app/(dashboard)/reviews/agents'))).toBe(false);
    expect(existsSync(resolve(root, 'src/app/reviews/agents'))).toBe(false);
  });
});
