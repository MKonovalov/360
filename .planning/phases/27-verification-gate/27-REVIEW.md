---
phase: 27-verification-gate
reviewed: 2026-08-04T22:15:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - e2e/ver-05-settings.spec.ts
  - scripts/probe-nousresearch-only.ts
  - scripts/probe-opencode-only.ts
  - src/components/settings/model-settings-form.tsx
  - src/lib/agents/modelFactory.ts
  - src/lib/agents/nousresearch-only-chain.test.ts
  - src/lib/agents/opencode-only-chain.test.ts
  - src/lib/agents/structured-outputs-probe.test.ts
  - src/lib/verification/security-grep.test.ts
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 27: Code Review Report

**Reviewed:** 2026-08-04T22:15:00Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Phase 27 adds live-key-gated isolation/round-trip probes for NousResearch and OpenCode, a per-instance `supportsStructuredOutputs` live probe, widens the security-grep gate to the two new provider tokens, fixes two previously-shipped Critical findings in `model-settings-form.tsx` (CR-01 save-in-flight race, CR-02 missing try/catch), and extends the Playwright settings spec. The two defects the task description flagged as "already found and fixed" (the ESM import-hoisting bug in `structured-outputs-probe.test.ts`, and the 3 live-run-only Playwright bugs) were independently re-verified against the current on-disk state and are genuinely fixed — not re-flagged here.

Direct verification of the three areas called out for extra scrutiny:
- **`model-settings-form.tsx` CR-01/CR-02**: both fixes are logically correct — traced through the save-in-flight race by hand (closure-captured `primary`/`fallbacks` at click time vs. live state at resolution time) and confirmed the outer "Saved." gate can never render over an edited-but-unsaved draft, and the `try/catch` correctly wraps the `await` + both result branches as the first statement inside the `startTransition` callback. One maintainability issue found (WR-equivalent, see WARNING below): the 4-line equality check is duplicated instead of computed once.
- **`modelFactory.ts` new exports / comment accuracy**: the 3 `export const` changes are exactly as scoped (no dispatch-logic change). The per-instance dated comments were cross-checked against git history (`23c946b4`) and are accurate — they reflect a genuine post-fix live re-probe, not a fabricated claim.
- **`security-grep.test.ts` widened matrix**: independently re-derived every claim (walked `src/`, grepped `.env.example`, confirmed all 3 allowlisted files genuinely contain all 3 `_API_KEY` tokens, confirmed no client component/Server Action currently leaks any of the 3 tokens). No leakage gaps found; the widening is non-vacuous and correctly scoped.

One structural issue not previously documented anywhere in the phase's plans/summaries was found: a genuine data race between the three provider-isolation Vitest files sharing one Postgres row (see WARNING 1).

## Warnings

### WR-01: Shared-row race condition across the 3 provider-isolation probes

**File:** `src/lib/agents/nousresearch-only-chain.test.ts`, `src/lib/agents/opencode-only-chain.test.ts` (new in this phase), and the pre-existing sibling `src/lib/agents/openrouter-only-chain.test.ts`

**Issue:** All three files independently call `upsertModelSettings({ userId, primaryModel, fallbackModels: [] })` for the **same** Clerk `userId` (resolved from `E2E_CLERK_USER_EMAIL`, the one dedicated E2E test account — confirmed via `scripts/probe-nousresearch-only.ts:41-54`, `scripts/probe-opencode-only.ts:41-54`, and `scripts/probe-openrouter-only.ts`), then each spawns a child process that calls `analyzeCompany(row.id, userId)`, which internally reads back the **same** row via `getModelSettingsForUser(userId)` (`src/lib/agents/analyzeCompany.ts:87`). `upsertModelSettings` is a full-value atomic overwrite keyed on `userId` (`src/lib/db/queries/userModelSettings.ts:18-33`) — there is no per-test isolation (no per-run synthetic userId, no locking, no serialization).

Vitest's default `fileParallelism: true` (confirmed: `vitest.config.ts` sets no `pool`/`sequence`/`fileParallelism` override, and this repo's `test` script is a bare `vitest run`) schedules `*.test.ts` files across workers concurrently. Before Phase 27, only one file (`openrouter-only-chain.test.ts`) wrote to this row, so there was nothing to race against. Phase 27 adds two more concurrent writers to the exact same row, so the window between one probe's `upsertModelSettings` write and a *different* probe's own `analyzeCompany`→`getModelSettingsForUser` read is now a real, three-way race: probe B's overwrite can land between probe A's write and probe A's own read-back, causing `analyzeCompany` to resolve a chain for the WRONG provider inside probe A's child process. Depending on timing, this can make `missingProviderKey` reject on a key the probe's own `childEnv` deliberately stripped (since all three probes strip each other's keys), producing a non-deterministic `not_configured`/wrong-`modelUsed` failure that has nothing to do with the actual live-account condition (billing/schema-mismatch) these tests are meant to document. This directly undermines the very thing VER-02/VER-03 exist to prove (that each chain isolates its own provider key) — a flaky failure here is indistinguishable from a real isolation regression without manual investigation.

Local repro attempts (3x `npx vitest run` of the three files together) did not conclusively force the race to manifest (each run's failure matched the documented live-account condition for that provider), but the underlying architecture is unambiguous: three processes performing an unsynchronized read-after-write on one shared row, scheduled to start within milliseconds of each other by Vitest's default parallel file execution.

**Fix:** Either (a) give each probe its own synthetic settings row scope (e.g., a distinct Clerk test user per provider, mirroring `userModelSettings.integration.test.ts`'s `randomUUID()` pattern instead of sharing `E2E_CLERK_USER_EMAIL`'s single account), or (b) force these three files to run serially, e.g.:

```ts
// vitest.config.ts
export default defineConfig({
  test: {
    // ...
    sequence: { concurrent: false },
    fileParallelism: false, // or scope via a dedicated `test.include` project for *-only-chain.test.ts with poolOptions.forks.singleFork: true
  },
});
```
or narrower, tag the three files into a project/group that runs with `singleFork: true` so only these DB-state-sharing probes serialize, without slowing down the rest of the suite.

### WR-02: CR-01's draft-equality gate is duplicated instead of computed once

**File:** `src/components/settings/model-settings-form.tsx:395-398` and `:417-419`

**Issue:** The fix for CR-01 (Plan 27-04) adds a 4-line boolean expression — `status === 'saved' && lastSaved && primary === lastSaved.primary && fallbacks.filter((f) => f !== '').join('|') === lastSaved.fallbacks.join('|')` — that gates the outer "Saved." block. The pre-existing inner recap immediately below it (originally the *only* gate, per CR-01's bug report) still carries its own copy of the identical 4-line expression (`:417-419`), now redundant. Both copies must independently stay byte-identical for the fix to hold; if a future edit changes only one (e.g., someone "simplifies" the inner recap's check since it now looks redundant, or changes the join separator in only one place), the outer gate and inner recap can silently diverge again, and the exact CR-01 false-positive this phase just fixed can reappear without any test catching it (the two Playwright assertions that touch this path — `'VER-05: CR-01 mid-save-edit...'` — only exercise the currently-correct combined behavior, not the individual gates).

**Fix:** Compute the equality once and reuse it:
```tsx
const isDraftSaved =
  lastSaved !== null &&
  primary === lastSaved.primary &&
  fallbacks.filter((f) => f !== '').join('|') === lastSaved.fallbacks.join('|');
// ...
{status === 'saved' && isDraftSaved ? (
  <div className="flex flex-col gap-1">
    <p ...>Saved.</p>
    {isDraftSaved ? ( // trivially true here, but keep the guard cheap+explicit
      <p ...>Saved chain: ...</p>
    ) : null}
  </div>
) : ...}
```

## Info

### IN-01: Near-byte-identical duplication across the 3 provider probe/test pairs

**File:** `scripts/probe-nousresearch-only.ts`, `scripts/probe-opencode-only.ts` (and pre-existing `scripts/probe-openrouter-only.ts`); `src/lib/agents/nousresearch-only-chain.test.ts`, `src/lib/agents/opencode-only-chain.test.ts` (and pre-existing `src/lib/agents/openrouter-only-chain.test.ts`)

**Issue:** Each probe script is a ~95-line structural clone of the others (differing only in the upserted model id and which keys are stripped), and each `*-only-chain.test.ts` is a ~40-line clone differing only in the target key/model id. This was an explicit, deliberate mirroring choice per the plan (D-27-04) and is not wrong on its own, but it means the shared-row race (WR-01) and any future fix to the isolation pattern (timeout tuning, error-shape changes, DB-fixture strategy) must be applied identically in 3+ places by hand.

**Fix:** Consider extracting a single parameterized harness, e.g. `runProviderIsolationProbe({ provider, modelId, stripKeys })` in `scripts/`, and a matching `describeProviderIsolation(provider, modelId, keyEnvVar)` test helper. This would also be the natural place to fix WR-01 once, centrally (e.g., via a `test.concurrent: false` + shared mutex, or per-provider synthetic test users).

### IN-02: Provider error text flows into stderr/CI logs unfiltered

**File:** `scripts/probe-nousresearch-only.ts:91-96`, `scripts/probe-opencode-only.ts:97-102` (mirrors pre-existing `scripts/probe-openrouter-only.ts`)

**Issue:** `main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); })` prints the raw provider SDK error message to stderr, which the parent Vitest test then surfaces verbatim in its assertion failure output (`expect(result.status, result.stderr).toBe(0)`). This is an existing, inherited pattern (not introduced by this phase), but Phase 27 duplicates the exposure surface across two more files. Some provider APIs echo partial credential/account material in 401/403 error bodies; if that ever happens here, it would land in local terminal output / CI logs rather than being scrubbed. The task description's own security-domain framing for these probes (stdout restricted to `{ ok, modelUsed, modelChain }` — T-27-01) does not extend to the stderr/error path.

**Fix:** Not urgent given the same pattern has shipped since Phase 22 without incident, but worth a follow-up: catch and log only `error.name`/a redacted summary, or explicitly strip any substring matching the loaded API keys before printing, consistent with the stdout-only discipline already applied to the success path.

---

_Reviewed: 2026-08-04T22:15:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
