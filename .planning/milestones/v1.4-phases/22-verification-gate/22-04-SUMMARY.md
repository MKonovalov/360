---
phase: 22-verification-gate
plan: 04
subsystem: testing
tags: [ver-03, openrouter, child-env, vitest, dotenv, integration-test]

# Dependency graph
requires:
  - phase: 22-verification-gate
    provides: 22-03 Playwright e2e harness + provisioned E2E_CLERK_USER_EMAIL staff account that this plan reads the Clerk userId from
provides:
  - Structural VER-03 proof: an OpenRouter-only analyzeCompany chain is driven through a child process with ANTHROPIC_API_KEY stripped to '' in the child env only, with the parent env never mutated
  - Repo-root `scripts/probe-openrouter-only.ts` child probe (dotenv-loads .env.local, resolves Acme Test Co by name, stamps *.test domain, upserts OR-only settings, prints { ok, modelUsed, modelChain })
  - `src/lib/agents/openrouter-only-chain.test.ts` child-env integration test (skipIf guard, 120s timeout, credit-gated live run)
  - Seed idempotency fix: `src/scripts/seed.ts` now clears agent_run/signal_proposal/correction before company
affects: [22-verification-gate plans 05-07, verification evidence for VER-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Child-env key-isolation integration test: spawn tsx probe via spawnSync with { ...process.env, ANTHROPIC_API_KEY: '' } — never delete process.env in parent
    - Repo-root scripts/ for any probe that is only ever spawned as a child (kept out of src/ which greps zero child_process)
    - dotenv config({ path: '.env.local', quiet: true }) — banner suppressed when stdout is a JSON contract

key-files:
  created:
    - scripts/probe-openrouter-only.ts
    - src/lib/agents/openrouter-only-chain.test.ts
  modified:
    - src/scripts/seed.ts

key-decisions:
  - "Credit gate self-served by executor (curl auth/key): outcome for this run is UNCREDITED (free-tier key, zero balance) -> the live child run fails loudly on a billing rejection, which is the plan's documented Outcome-3 accepted failure mode; assertions NOT weakened to force a pass"
  - "Probe stdout must be pure JSON — dotenv's injected-env banner suppressed via quieter to keep the { ok, modelUsed, modelChain } contract parseable"
  - "seed.ts's child-first delete chain was incomplete for agent_run/signal_proposal/correction; extended it so npm run seed is idempotent on a DB with prior analyze runs (prerequisite for the probe to find Acme Test Co)"

patterns-established:
  - "VER-03 structural proof pattern: child-env spawn with stripped provider key proves key isolation without mutating the developer's env"
  - "skipIf-live-keys guard: describe.skipIf(!hasLiveKeys) keeps the live integration test CI-safe while running locally when keys exist"

requirements-completed: [VER-03]

# Metrics
duration: 45min
completed: 2026-08-03
---

# Phase 22 Verification-Gate: Plan 04 Summary

**Child-env structural proof of VER-03: an OpenRouter-only analyzeCompany chain runs end-to-end with ANTHROPIC_API_KEY stripped to '' in the child process env (parent untouched), via a spawned tsx probe that reports { ok, modelUsed, modelChain } as a strict JSON contract — skip-guarded and credit-gated, full suite green except the documented uncredited-key billing failure.**

## Performance

- **Duration:** 45 min
- **Started:** 2026-08-03T13:08:00Z
- **Completed:** 2026-08-03T13:56:00Z
- **Tasks:** 2 (Task 2 split into 1 fix + 1 test commit; Task 1 + 2 mandatory fixes below)
- **Files modified:** 3

## Accomplishments
- Built `scripts/probe-openrouter-only.ts` — dotenv-loads `.env.local`, resolves the seeded test staff user via Clerk Backend API (from `E2E_CLERK_USER_EMAIL`), looks up Acme Test Co BY NAME (Pitfall 4: seed ids drift), stamps a synthetic `*.test` domain, upserts OpenRouter-only settings (`anthropic/claude-sonnet-4.6`, no fallbacks), and runs a REAL `analyzeCompany` — emitting only `{ ok, modelUsed, modelChain }` shapes with zero key/Config leakage.
- Wrote `src/lib/agents/openrouter-only-chain.test.ts` — the D-22-03 structural child-env proof: `spawnSync(process.execPath, [require.resolve('tsx/cli'), 'scripts/probe-openrouter-only.ts'])` with `env: { ...process.env, ANTHROPIC_API_KEY: '' }` (strip in child only, never `delete process.env`), `describe.skipIf(!hasLiveKeys)` CI-safe skip guard, and per-`it` `{ timeout: 120_000 }`.
- Structurally proved the OpenRouter-only chain is the path that ran: with `ANTHROPIC_API_KEY: ''` the child reached OpenRouter and was rejected on BILLING (`provider credits exhausted`), NOT on a missing Anthropic key — confirming key isolation works while the uncredited balance stops a green model slug assertion.
- Fixed two blocking issues: (1) dotenv's stdout banner was corrupting the probe's JSON contract; (2) `seed.ts` re-run could not delete `company` because its child-first chain predated `agent_run`/`signal_proposal`/`correction`.

## Task Commits

Each task was committed atomically:

1. **Task 1: VER-03 child probe script** - `971014b6` (chore)
2. **Task 2: child-env integration test** - `ab9d176c` (test)
3. Fix: dotenv banner suppression in probe stdout - `a8810d31` (fix, Rule 3)
4. Fix: seed FK-clean chain (agent_run/signal_proposal/correction) before company - `bb928c36` (fix, Rule 3)

**Plan metadata:** pending `docs(22-04)` metadata commit.

## Files Created/Modified
- `scripts/probe-openrouter-only.ts` - VER-03 child probe: dotenv->company-by-name->test domain->OR-only settings->analyzeCompany->JSON out
- `src/lib/agents/openrouter-only-chain.test.ts` - child-env integration test: spawnSync tsx probe with stripped ANTHROPIC in child env, skip fix, 120s timeout, assert ok+slug
- `src/scripts/seed.ts` - cleared runtime FK-referencing tables (`correction -> signal_proposal -> agentRun`) before `delete(company)` so `npm run seed` is idempotent on a DB with prior analyze runs

## Decisions Made
- **Credit gate self-served (executor-run curl), not a human checkpoint.** Outcome for this run: key present but UNCREDITED (free-tier, `limit:null`). This is the plan's Task 2 Outcome-3 accepted failure mode: the live child run fails LOUDLY on provider billing, recorded as evidence, escalated to operator to top up before a green model-slug rerun. Did NOT weaken assertions to force a green.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] dotenv injected-env banner corrupted the probe's JSON contract**
- **Found during:** Task 2 live run (`JSON.parse` of qualified valid stdout)
- **Issue:** `config({ path: '.env.local' })` (dotenv 17.4.2) prints a "injected env" banner to stdout on every load; the test does `JSON.parse(result.stdout)` so the banner broke the strict JSON contract.
- **Fix:** Added `quiet: true` to the probe's `config()`; the probe's stdout remains only `{ ok, modelUsed, modelChain }`. Recorded the load-order + quiet rationale in a why-comment.
- **Files modified:** scripts/probe-openrouter-only.ts
- **Verification:** live probe now prints a single parsed JSON line; vitest failure removed the banner error (replaced by the real billing assertion).
- **Committed in:** `a8810d31`

**2. [Rule 3 - Blocking] seed.ts re-run failed on FK constraint, blocking the seeded Acme company the probe needs**
- **Found during:** Task 2 prerequisite — probe errors "Acme Test Co not found, run `npm run seed` first", and `npm run seed` itself failed with `agent_run_company_id_company_id_fk`.
- **Issue:** `seed.ts` clears `companyPersonaRole -> signal -> persona -> company`, but `agent_run`, `signal_proposal`, `correction` FK-referenceing company and were added after the seed's delete chain was written; a DB with prior analyze runs can't be re-seeded.
- **Fix:** Extended the delete chain to `correction -> signalProposal -> agentRun -> companyPersonaRole -> signal -> persona -> company`, with a why-comment documenting the FK ordering requirement.
- **Files modified:** `src/scripts/seed.ts`
- **Verification:** `npm run seed` exits 0 (9 companies, 10 personas, 12 signals, 13 roles); `Acme Test Co` id 105 present in db.
- **Committed in:** `bb928c36`

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** All auto-fixes were required to run the plan's declared verification. No scope creep.

## Issues Encountered
- **Uncredited provider key (recorded, not unblocked).** The live run reached OpenRouter and returned a billing rejection (`{ ok:false, reason:'billing', message:'provider credits exhausted' }`). This is the plan's accepted Outcome-3 failure mode. The operator must add credit to the OPENROUTER_API_KEY account, then re-run `npx vitest run src/lib/agents/openrouter-only-chain.test.ts` to turn the loud-failure into a green pass. This is the only failing test in an otherwise 377-pass suite.

## User Setup Required
None - no new external service configuration required by this plan. `OPENROUTER_API_KEY` already present in `.env.local`.

## Next Phase Readiness
- VER-03 is proven structurally (key isolation in a child env with parent env untouched). The uncredited key's billing rejection is durable evidence of the OpenRouter-only path and is escalated as an operator action for a green billing-bounded rerun.
- The skip guard keeps this test CI-safe.
- Next plans (22-05 VER-02, 22-06), 22-07 verification evidence file will record the { ok, modelUsed, modelChain } shapes from this plan.

---
*Phase: 22-verification-gate*
*Completed: 2026-08-03*