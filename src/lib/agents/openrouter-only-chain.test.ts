import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { config } from 'dotenv';
config({ path: '.env.local' }); // seed.ts:12 precedent — vitest does NOT auto-load .env.local

// Skip guard: live keys absent (CI) → whole suite skips gracefully, never fails.
// Claude's discretion per 22-CONTEXT; verified describe.skipIf present in vitest 4.1.10.
const hasLiveKeys =
  !!process.env.OPENROUTER_API_KEY && !!process.env.FIRECRAWL_API_KEY && !!process.env.DATABASE_URL;

// D-22-03 structural proof: the child env proves real key isolation — an
// OpenRouter-only chain (analyzeCompany with openrouter-only settings) runs with
// ONLY OPENROUTER_API_KEY set. The child env object below is the ONLY mutation
// site; the parent process.env is never touched, so other tests and the dev
// shell keep their keys (22-RESEARCH Anti-Pattern l.366-371).
describe.skipIf(!hasLiveKeys)('VER-03 openrouter-only chain (child-env, real keys)', () => {
  it(
    'runs analyzeCompany with ANTHROPIC_API_KEY unset in the child env',
    { timeout: 120_000 }, // vitest default 5s would kill the real 43-50s run (Pitfall 1)
    () => {
      const childEnv = { ...process.env, ANTHROPIC_API_KEY: '' }; // strip in CHILD env only — never delete parent (Anti-Pattern)
      const result = spawnSync(process.execPath, [require.resolve('tsx/cli'), 'scripts/probe-openrouter-only.ts'], {
        env: childEnv,
        encoding: 'utf-8',
        timeout: 110_000,
      });
      expect(result.status, result.stderr).toBe(0);
      const out = JSON.parse(result.stdout);
      expect(out.ok).toBe(true);
      expect(out.modelUsed).toBe('anthropic/claude-sonnet-4.6'); // as-saved slug verbatim (FAL-05)
    },
  );
});
