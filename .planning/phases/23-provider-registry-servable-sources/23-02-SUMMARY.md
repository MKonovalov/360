---
phase: 23-provider-registry-servable-sources
plan: 02
subsystem: config / env
tags: [typescript, zod, env, server-only, provider-registry, degrade-gracefully]

# Dependency graph
requires:
  - phase: 23-provider-registry-servable-sources (23-01)
    provides: the 4-provider registry keystone (ModelProviderId × 4, PROVIDER_GATES) whose Phase 25 chain-aware env gate will read these keys by name
provides:
  - NOUSRESEARCH_API_KEY + OPENCODE_API_KEY declared optional server-only in src/lib/env.ts (z.string().optional(), D-15), byte-for-byte mirroring the OPENROUTER_API_KEY precedent
  - Both keys declared in .env.example with no value and their Get-from sources
  - Import-time parse proven safe with the keys absent AND present (T-23-07 degrade-gracefully)
affects: [Phase 25 (chain-aware env gate reads the keys by name — no schema change needed; explicit apiKey at construction per v1.5 SUMMARY finding 3), Phase 25 ops (Vercel `env add` for both keys, server-only Preview+Production), Phase 27 (VER-04 security-matrix grep extension), Phase 24 (data rows unaffected — declaration-only)]

# Tech tracking
tech-stack:
  added: []  # zero new packages this plan (threat model T-23-SC: no npm installs; @ai-sdk/openai-compatible remains a Phase 25 install)
  patterns:
    - "Optional server-only env keys, z.string().optional(), degrade-gracefully (D-15) — non-PUBLIC_ prefix = server-only, never logged, never sent to client"
    - "Declaration-only phase boundary: key NAMES cross into repo/Vercel config, key VALUES never do (T-23-05)"

key-files:
  created: []
  modified:
    - src/lib/env.ts
    - .env.example

key-decisions:
  - "Both new keys mirror OPENROUTER_API_KEY byte-for-byte: z.string().optional(), non-PUBLIC_ prefix, degrade-gracefully (D-15) — an unset key never fails the schema parse at import time (T-23-07)"
  - "Declaration-only this phase: no consumer, no client import, no PUBLIC_ variant — the chain-aware env gate is Phase 25, the Vercel env add is deferred to Phase 25 key-provisioning (research Open Question 2)"
  - "Comments cite Phase 25's EXPLICIT apiKey-at-construction (no SDK env auto-load — v1.5 SUMMARY finding 3) so the non-obvious wiring decision survives to Phase 25"
  - "The plan's Task 1 acceptance `'KEY' in env` check is unsatisfiable with any correct .optional() implementation (zod v4 omits absent optional keys from the parsed object) — verified the intended truths instead: parse-no-crash + undefined read path (absent) + value round-trip (present)"

patterns-established:
  - "Pattern: env-schema key declaration carries a 4-line why-comment (REG ref, degrade-gracefully doctrine, server-only scope, Phase-gate placement) — the OPENROUTER precedent extended"
  - "Pattern: .env.example optional-key block documents Get-from sources in the same comment block as the declarations"

requirements-completed: [REG-02]

# Metrics
duration: 3min
completed: 2026-08-03
---

# Phase 23 Plan 2: REG-02 Declaration Half — Optional Server-Only Env Keys Summary

REG-02's declaration half shipped: `NOUSRESEARCH_API_KEY` and `OPENCODE_API_KEY` are now optional server-only zod declarations in `src/lib/env.ts` (`z.string().optional()`, byte-for-byte mirror of the `OPENROUTER_API_KEY` precedent at l.36-41 — D-15 degrade-gracefully, non-`PUBLIC_` prefix = server-only, never logged, never sent to client), plus empty-value placeholder lines for both keys in `.env.example` with their Get-from sources (`portal.nousresearch.com → API Keys`; `opencode.ai → Zen settings`, one key shared Zen + Go). Import-time parse is proven safe with the keys absent **and** present (T-23-07). Purely declaration-only: zero consumers, zero PUBLIC_ variants, zero installs, zero Vercel env changes this phase — the Phase 25 chain-aware env gate and the Vercel `env add` ops step (deferred to key-provisioning, research Open Question 2) read these declarations by name without any schema change.

## Performance

- **Duration:** 3 min
- **Started:** 2026-08-03T22:44:37Z
- **Completed:** 2026-08-03T22:47:30Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `src/lib/env.ts` declares `NOUSRESEARCH_API_KEY` + `OPENCODE_API_KEY` as `z.string().optional()` immediately after `OPENROUTER_API_KEY`, with why-comments citing Phase 23 (REG-02), the Phase 25 chain-aware gate, and the explicit-apiKey-at-construction rule (v1.5 SUMMARY finding 3 — no SDK env auto-load)
- `.env.example` lists both keys with **no value** (provisioned Phase 25) and the Get-from block names both sources; the OpenCode shared-key note (one key Zen + Go) is preserved
- Prove-both-ways smoke: schema parses with the keys absent (`parse-absent OK`, read path `undefined`) AND with the keys present (values round-trip) — the T-23-07 no-crash guarantee and the D-15 degrade-gracefully read path are both locked
- VER-04 security-grep gate stays green (5/5) — `.env.example` gains no `NEXT_PUBLIC_` variant; `tsc --noEmit` clean; zero package.json/lockfile change

## Task Commits

Each task was committed atomically:

1. **Task 1: env.ts — NOUSRESEARCH_API_KEY + OPENCODE_API_KEY optional server-only declarations** - `9d8fdf81` (feat)
2. **Task 2: .env.example — placeholder declarations for both new keys (no value)** - `68811a10` (chore)

**Plan metadata:** `(pending — docs commit follows this summary)`

## Files Created/Modified

- `src/lib/env.ts` - Added `NOUSRESEARCH_API_KEY: z.string().optional(),` + `OPENCODE_API_KEY: z.string().optional(),` after `OPENROUTER_API_KEY` (l.41), each with a 4-line why-comment (REG-02 ref, D-15 degrade-gracefully, server-only scope, Phase 25 explicit apiKey note). Schema parse (l.61) and fail-fast required keys untouched.
- `.env.example` - Added `NOUSRESEARCH_API_KEY=` + `OPENCODE_API_KEY=` (empty values) after `OPENROUTER_API_KEY=sk-or-xxxxxxxx`, and two Get-from comment lines (`NousResearch: portal.nousresearch.com → API Keys`, `OpenCode: opencode.ai → Zen settings (one key shared Zen + Go)`).

## Decisions Made

- Both keys declared optional server-only mirroring `OPENROUTER_API_KEY` byte-for-byte (D-15) — an unset key must never crash the app at import time (env.ts is imported app-wide via db/index.ts).
- Declaration-only: no consumption this phase, no `PUBLIC_` variant anywhere, no Vercel env changes — the plan's CONTEXT.md line-11 phase boundary and research Open Question 2 are honored verbatim.
- No `env.d.ts`/`ImportMetaEnv` additions — this repo reads env via the zod schema + `process.env`; the Astro-era `import.meta.env` contract is retired.

## Deviations from Plan

### Verification-artifact issue (plan command contradiction — not an implementation defect)

**1. Task 1 acceptance `'KEY' in env` check is unsatisfiable with any correct `.optional()` implementation**
- **Found during:** Task 1 (env.ts declarations) acceptance-criteria gate
- **Issue:** The plan's acceptance command `if (!('NOUSRESEARCH_API_KEY' in env) ...) throw` fails even with a byte-perfect implementation: zod v4 **omits** absent optional keys from the parsed output object (empirically proven — `z.object({ A: z.string().optional() }).parse({})` yields `Object.keys → []`, `'A' in out → false`). The plan's own must-have truth only requires "the env schema still parses when the keys are absent" plus an undefined read path — nothing requires the key to be *present* in the parsed object when absent from input.
- **Fix:** Verified the intended truths with a corrected smoke — (a) keys absent: parse succeeds, no import-time crash, `env.NOUSRESEARCH_API_KEY === undefined`, `env.OPENCODE_API_KEY === undefined` (the D-15 read path the FAL-04-style `if (!env.X)` gate relies on); (b) keys present: parse succeeds, values round-trip. Both pass. The implementation was left byte-for-byte as the plan mandates (it is the correct mirror of `OPENROUTER_API_KEY`, which behaves identically).
- **Files modified:** none (verification-only correction; `src/lib/env.ts` unchanged by this fix)
- **Verification:** `parse-absent OK` + `parse-present OK` both printed; `tsc --noEmit` clean
- **Committed in:** n/a (no code change — the `in`-check artifact is inherent to the plan's command, not the code)

**2. Bare-shell parse smoke requires the fail-fast required keys** (environmental note, not a defect)
- **Found during:** Task 1 acceptance-criteria gate
- **Issue:** The plan's literal `npx tsx -e "import { env } ..."` fails in a bare shell because the fail-fast-required keys (`DATABASE_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`) are absent from the shell env — by design (env.ts l.3-5 fail-fast doctrine). This is unrelated to the new optional keys.
- **Fix:** Ran the smoke with the three required keys supplied as inline env vars; the new optional keys absent/present cases then isolate exactly what the plan intends to prove.
- **Files modified:** none
- **Verification:** see deviation 1 — both smokes green
- **Committed in:** n/a

---

**Total deviations:** 2 documented (0 code changes — both are verification-command artifacts of the plan, resolved by proving the plan's stated intent rather than its literal-but-contradictory command)
**Impact on plan:** None on deliverables — both tasks' artifacts are exactly what the plan mandates; the deviations only affected how the acceptance proof was executed. No scope creep.

## Issues Encountered

- zod v4 `.optional()` output-shape behavior (`'KEY' in parsed` → false for absent keys) is a real trap for acceptance commands that assert key *presence* in the parsed object; future plans should assert `parsed.KEY === undefined` (read path) rather than `'KEY' in parsed` for optional keys. Worth noting for Phase 25's env-gate plan if it re-uses this pattern.

## User Setup Required

**Deferred to Phase 25 key-provisioning — no USER-SETUP.md generated this phase.**

The plan's `user_setup` block (Vercel `env add` for `NOUSRESEARCH_API_KEY` + `OPENCODE_API_KEY`, server-only, non-PUBLIC_, Preview + Production) is explicitly **non-blocking and deferred**: the keys have no real values until Phase 25 provisioning, and the Vercel CLI needs interactive auth. Code declarations (this plan) land now; the ops step is Phase 25's. No actionable external-service configuration exists for the user in Phase 23.

## Next Phase Readiness

- Ready for **23-03** (union-wide save validation REG-07) and **23-04** (settings page props) — this plan touches only env.ts + .env.example, no overlap.
- **Phase 25 seam:** the chain-aware env gate will read `NOUSRESEARCH_API_KEY` / `OPENCODE_API_KEY` from `env` by name with zero schema change, and pass them EXPLICITLY at construction (`createOpenAICompatible({ apiKey: env.NOUSRESEARCH_API_KEY })` style — no SDK env auto-load, v1.5 SUMMARY finding 3).
- **Phase 25 ops (human):** Vercel dashboard/CLI `env add` for both keys (server-only, Preview + Production) at key-provisioning time — recorded in STATE.md Operator Next Steps.
- **Phase 27:** VER-04 security-matrix grep extends to the new key names.

---
*Phase: 23-provider-registry-servable-sources*
*Completed: 2026-08-03*
