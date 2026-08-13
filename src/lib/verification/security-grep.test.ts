// VER-04 security-matrix gate (D-22-07, widened D-27-13): scans src/** source
// files + .env.example and fails on any of the 3 provider key-name tokens
// (OPENROUTER, NOUSRESEARCH, OPENCODE) occurring in client-reachable code.
// This is a PERMANENT gate — it runs with every `npm test` (D-22-07), replacing the
// one-off manual grep. The scan is source-level only: a post-build bundle scan is
// deliberately deferred (CONTEXT §Deferred) so the test carries no build-time coupling.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(process.cwd(), 'src');
// Phase 27 (D-27-13): widened from OPENROUTER-only to all 3 provider key-name
// tokens with the exact same non-vacuous rigor — additive-only, no rewrite.
const TOKENS = ['OPENROUTER', 'NOUSRESEARCH', 'OPENCODE'] as const;
// The ONLY non-test server files allowed to mention any of the 3 tokens
// (OPENROUTER verified 2026-08-03; NOUSRESEARCH/OPENCODE verified 2026-08-04 —
// modelFactory.ts reads process.env.NOUSRESEARCH_API_KEY / OPENCODE_API_KEY
// directly, analyzeCompany.ts's missingProviderKey names all 3 keys, env.ts
// declares all 3 in its zod schema).
const ALLOWED = new Set(['lib/env.ts', 'lib/agents/modelFactory.ts', 'lib/agents/analyzeCompany.ts']);
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((e) => {
    const p = join(dir, e);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') || p.endsWith('.tsx') ? [p] : [];
  });
}

describe('VER-04 security-matrix grep (D-22-07, widened D-27-13)', () => {
  const files = walk(SRC).map((p) => p.replace(SRC + '/', ''));

  it('no OPENROUTER/NOUSRESEARCH/OPENCODE in client components ("use client") or src/components', () => {
    for (const rel of files) {
      // Self-file skip (same reasoning as Test 3): THIS file is not a client component — it holds the
      // literal "'use client'" in its own isClient predicate and the token strings in its own
      // assertions, so the isClient scan below would misclassify it as a client and fail. Excluding it
      // here costs nothing: every REAL client file (a genuine "'use client'" component or a
      // src/components file) is still scanned for all 3 tokens.
      if (rel === 'lib/verification/security-grep.test.ts') continue;
      const src = readFileSync(join(SRC, rel), 'utf8');
      const isClient = src.includes("'use client'") || rel.startsWith('components/');
      if (isClient) {
        for (const token of TOKENS) expect(src, `${rel} (${token})`).not.toContain(token);
      }
    }
  });

  it('no OPENROUTER/NOUSRESEARCH/OPENCODE in Server Actions', () => {
    for (const rel of files.filter((f) => f.startsWith('app/actions/'))) {
      const src = readFileSync(join(SRC, rel), 'utf8');
      for (const token of TOKENS) expect(src, `${rel} (${token})`).not.toContain(token);
    }
  });

  it('no NEXT_PUBLIC_<TOKEN> anywhere in src/ or .env.example; <TOKEN>_API_KEY present in .env.example', () => {
    for (const rel of files) {
      // Self-file skip: THIS file legitimately holds the literal 'NEXT_PUBLIC_<TOKEN>' strings as the
      // leak tokens under test (its own assertion strings + test title), so walking it would make
      // the gate fail on its own source forever. Every OTHER src file + .env.example stays scanned —
      // the leak-detection assertion is NOT weakened (a leak in any real file still fails the suite),
      // and the canaries (below) are untouched, so the gate remains non-vacuous.
      if (rel === 'lib/verification/security-grep.test.ts') continue;
      const src = readFileSync(join(SRC, rel), 'utf8');
      for (const token of TOKENS) expect(src, `${rel} (NEXT_PUBLIC_${token})`).not.toContain(`NEXT_PUBLIC_${token}`);
    }
    const example = readFileSync('.env.example', 'utf8');
    for (const token of TOKENS) {
      expect(example, `NEXT_PUBLIC_${token}`).not.toContain(`NEXT_PUBLIC_${token}`);
      expect(example, `${token}_API_KEY`).toContain(`${token}_API_KEY`);
    }
  });

  it('canary: the allowlisted server files DO contain <TOKEN>_API_KEY for all 3 tokens (the gate is not vacuous)', () => {
    // Pitfall 6: a refactor that renames a token to a casing variant would silently disable a
    // pattern-only gate. Asserting each token IS present in the allowlisted server files proves the
    // scan actually matches the token — the gate fails loudly on a rename instead of passing vacuously.
    for (const rel of ALLOWED) {
      const src = readFileSync(join(SRC, rel), 'utf8');
      for (const token of TOKENS) expect(src, `${rel} (${token}_API_KEY)`).toContain(`${token}_API_KEY`);
    }
  });

});
