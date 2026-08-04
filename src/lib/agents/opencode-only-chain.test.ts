import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { config } from 'dotenv';
config({ path: '.env.local' }); // seed.ts:12 precedent — vitest does NOT auto-load .env.local

// Skip guard: live keys absent (CI) → whole suite skips gracefully, never fails.
const hasLiveKeys =
  !!process.env.OPENCODE_API_KEY && !!process.env.FIRECRAWL_API_KEY && !!process.env.DATABASE_URL;

// D-27-04 structural proof: the child env proves real key isolation — an
// OpenCode-only chain (analyzeCompany with opencode-only settings) runs with
// ONLY OPENCODE_API_KEY set. The child env object below is the ONLY mutation
// site; the parent process.env is never touched, so other tests and the dev
// shell keep their keys (Pitfall 2 discipline — strips ALL THREE other
// provider keys, not just one).
describe.skipIf(!hasLiveKeys)('VER-03 opencode-only chain (child-env, real keys)', () => {
  it(
    'runs analyzeCompany with ANTHROPIC_API_KEY, OPENROUTER_API_KEY, NOUSRESEARCH_API_KEY unset in the child env',
    { timeout: 120_000 }, // vitest default 5s would kill the real 43-50s run (Pitfall 1)
    () => {
      const childEnv = {
        ...process.env,
        ANTHROPIC_API_KEY: '',
        OPENROUTER_API_KEY: '',
        NOUSRESEARCH_API_KEY: '',
      }; // strip in CHILD env only — never delete parent (Anti-Pattern)
      const result = spawnSync(
        process.execPath,
        [require.resolve('tsx/cli'), 'scripts/probe-opencode-only.ts'],
        {
          env: childEnv,
          encoding: 'utf-8',
          timeout: 110_000,
        },
      );
      expect(result.status, result.stderr).toBe(0);
      const out = JSON.parse(result.stdout);
      expect(out.ok).toBe(true);
      expect(out.modelUsed).toBe('big-pickle'); // as-saved raw id verbatim (FAL-05)
    },
  );
});
