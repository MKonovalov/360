// VER-04 security-matrix gate (D-22-07): scans src/** source files + .env.example
// and fails on any OPENROUTER key-name occurrence in client-reachable code.
// This is a PERMANENT gate — it runs with every `npm test` (D-22-07), replacing the
// one-off manual grep. The scan is source-level only: a post-build bundle scan is
// deliberately deferred (CONTEXT §Deferred) so the test carries no build-time coupling.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(process.cwd(), 'src');
// The ONLY non-test server files allowed to mention OPENROUTER (verified 2026-08-03)
const ALLOWED = new Set(['lib/env.ts', 'lib/agents/modelFactory.ts', 'lib/agents/analyzeCompany.ts']);
// Server Components are NOT client-reachable (no 'use client', server-only env) — same safety
// class as ALLOWED. company-detail.tsx reads env.OPENROUTER_API_KEY in the FAL-04 canAnalyze gate.
const SERVER_COMPONENT = new Set(['components/companies/company-detail.tsx']);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((e) => {
    const p = join(dir, e);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') || p.endsWith('.tsx') ? [p] : [];
  });
}

describe('VER-04 security-matrix grep (D-22-07)', () => {
  const files = walk(SRC).map((p) => p.replace(SRC + '/', ''));

  it('no OPENROUTER in client components ("use client") or src/components', () => {
    for (const rel of files) {
      // Self-file skip (same reasoning as Test 3): THIS file is not a client component — it holds the
      // literal "'use client'" in its own isClient predicate and "OPENROUTER" in its assertions, so
      // the isClient scan below would misclassify it as a client and fail. Excluding it here costs
      // nothing: every REAL client file (a genuine "'use client'" component or a src/components file)
      // is still scanned for OPENROUTER.
      if (rel === 'lib/verification/security-grep.test.ts' || SERVER_COMPONENT.has(rel)) continue;
      const src = readFileSync(join(SRC, rel), 'utf8');
      const isClient = src.includes("'use client'") || rel.startsWith('components/');
      if (isClient) expect(src, rel).not.toContain('OPENROUTER');
    }
  });

  it('no OPENROUTER in Server Actions', () => {
    for (const rel of files.filter((f) => f.startsWith('app/actions/'))) {
      expect(readFileSync(join(SRC, rel), 'utf8'), rel).not.toContain('OPENROUTER');
    }
  });

  it('no NEXT_PUBLIC_OPENROUTER anywhere in src/ or .env.example; OPENROUTER_API_KEY present in .env.example', () => {
    for (const rel of files) {
      // Self-file skip: THIS file legitimately holds the literal 'NEXT_PUBLIC_OPENROUTER' as the
      // leak token under test (its own assertion strings + test title), so walking it would make
      // the gate fail on its own source forever. Every OTHER src file + .env.example stays scanned —
      // the leak-detection assertion is NOT weakened (a leak in any real file still fails the suite),
      // and the canary (Test 4) is untouched, so the gate remains non-vacuous.
      if (rel === 'lib/verification/security-grep.test.ts') continue;
      expect(readFileSync(join(SRC, rel), 'utf8'), rel).not.toContain('NEXT_PUBLIC_OPENROUTER');
    }
    const example = readFileSync('.env.example', 'utf8');
    expect(example).not.toContain('NEXT_PUBLIC_OPENROUTER');
    expect(example).toContain('OPENROUTER_API_KEY');
  });

  it('canary: the allowlisted server files DO contain OPENROUTER_API_KEY (the gate is not vacuous)', () => {
    // Pitfall 6: a refactor that renames the token to a casing variant would silently disable a
    // pattern-only gate. Asserting the token IS present in the allowlisted server files proves the
    // scan actually matches the token — the gate fails loudly on a rename instead of passing vacuously.
    for (const rel of ALLOWED) {
      expect(readFileSync(join(SRC, rel), 'utf8'), rel).toContain('OPENROUTER_API_KEY');
    }
  });

  it('canary: SERVER_COMPONENT entries are genuine server components carrying the token (exemption not vacuous)', () => {
    // Same Pitfall 6 reasoning: the SERVER_COMPONENT exemption must only ever cover real server
    // components (no 'use client') that do mention OPENROUTER_API_KEY — if a refactor turns
    // company-detail.tsx into a client component, this fails loudly instead of silently exempting it.
    for (const rel of SERVER_COMPONENT) {
      const src = readFileSync(join(SRC, rel), 'utf8');
      expect(src, rel).not.toContain("'use client'");
      expect(src, rel).toContain('OPENROUTER_API_KEY');
    }
  });
});