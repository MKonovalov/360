---
phase: 18-verification-gate
reviewed: 2026-08-02T19:10:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - src/lib/agents/runAgent.test.ts
  - src/lib/models/catalog.test.ts
  - src/lib/agents/modelConfig.test.ts
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 18: Code Review Report

**Reviewed:** 2026-08-02T19:10:00Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Reviewed the three test suites that constitute the Phase 18 verification-gate deliverable (D-18-02: zero production changes; +61/−1 lines, all in test files). The diff confirms the claimed scope: 4 new loop-level failover tests in `runAgent.test.ts` (401 never-advance, 403 never-advance, output/schema never-advance, RetryError-wrapped 404 advances), 1 real-snapshot catalog test, and 1 explicit partial-chain resolve test. All 40 tests in the three files pass (`npx vitest run` — 3 files, 40 tests, green).

**High-level assessment:** The new tests genuinely lock the core VER-01/VER-02 semantics. I traced each new test against the production implementations (`runAgent.ts` loop, `modelConfig.ts` classification/chain resolution, `catalog.ts` allowlist gate) and verified the assertions hold: the never-advance tests' `generateText` call-count of exactly 1x against a 2-model chain would catch a regression in `isFailoverEligible`; the RetryError-404 unwrap is valid (verified `RetryError.lastError = errors[errors.length-1]` in the installed `ai@7.0.45`); the real-snapshot test's `toEqual(['claude-sonnet-4-6'])` holds against the committed 1131-model `catalog.json` (17 anthropic entries, all `active`, only `claude-sonnet-4-6` allowlisted); the partial-chain test correctly distinguishes pass-through from the D-10 cap and D-08 dedupe.

Two warnings: (1) the 16-HUMAN-UAT prototype-getter regression test is **vacuous** — it passes against the buggy spread implementation it claims to lock (empirically confirmed); (2) the pre-existing FAL-04 budget test asserts strict equality on a millisecond-boundary-sensitive value — a latent flake that this phase re-certifies as VER-01 proof. Three minor info items follow.

## Warnings

### WR-01: Prototype-getter regression test is vacuous — passes against the buggy `{ ...result }` implementation it claims to lock

**File:** `src/lib/agents/runAgent.test.ts:93-111`
**Issue:** The test titled "preserves prototype getters on the result (output/usage survive — 16-HUMAN-UAT regression)" does not assert what it claims. The real ai@7 `DefaultGenerateTextResult` (verified in `node_modules/ai/dist/index.js:6087+`) exposes `output`/`usage`/`finishReason` as **prototype** getters — only `steps`, `initialResponseMessages`, `_output`, `totalUsage` are own properties. A `{ ...result }` spread therefore drops `output`/`usage`, which is the regression the fix (`Object.assign(Object.create(Object.getPrototypeOf(result)), ...)`) addresses. But the mock builds the getters as **own enumerable accessor properties** on `getterRun` (`Object.defineProperty(getterRun, 'output', ...)`, lines 99-101). Object spread copies own enumerable keys by invoking the getter, so the buggy spread produces a plain object with `output`/`usage`/`steps` intact. I confirmed empirically: against the buggy implementation, all three assertions at lines 106-108 pass. The test therefore cannot distinguish the fixed code from the regression it exists to prevent — a false-positive lock in a phase whose entire purpose is locking regressions. (The actual production fix at `runAgent.ts:83` is correct — the test just fails to pin it.)
**Fix:** Place the getters on the prototype chain so the mock faithfully reproduces the real result shape:
```ts
const proto = {
  get output() { return resolvedRun.output; },
  get usage() { return resolvedRun.usage; },
} as typeof resolvedRun;
const getterRun = Object.create(proto) as typeof resolvedRun;
Object.defineProperty(getterRun, 'steps', { value: resolvedRun.steps, enumerable: true });
```
With this shape, `{ ...getterRun }` yields `{}` (own props: only `steps`) — `result.output`/`result.usage` become `undefined` under the buggy spread and the test fails on regression, passes on the fix.

### WR-02: FAL-04 budget test asserts a millisecond-boundary-sensitive value — latent flake

**File:** `src/lib/agents/runAgent.test.ts:219`
**Issue:** `expect(mocks.generateText.mock.calls[0][0].timeout).toEqual({ totalMs: 54000 })` requires `elapsedMs === 0` at attempt 0. `runAgent.ts:56-59` computes `totalMs = Math.min(attemptMs, LOOP_BUDGET_MS - (Date.now() - startedAt))` — any 1 ms boundary crossing between the two `Date.now()` calls yields `totalMs = 53999`, and the strict `toEqual` fails. The sibling WR-03 test (line 238-241) correctly uses `toBeLessThanOrEqual`; this one does not. The 4000 ms slack on the attempt-1 assertion (`totalMs: 50000`, line 220) is safe, but attempt 0 has zero tolerance. The suite passed in this run, but under CI load, coverage instrumentation, or JIT warmup the boundary is genuinely crossable — and this test is now re-certified as the VER-01 "per-attempt budgets" proof row in `18-VER-01-MATRIX.md:29`.
**Fix:** Match the WR-03 pattern — assert a range rather than exact equality:
```ts
expect(mocks.generateText.mock.calls[0][0].timeout.totalMs).toBeLessThanOrEqual(54000);
expect(mocks.generateText.mock.calls[0][0].timeout.totalMs).toBeGreaterThan(50000);
expect(mocks.generateText.mock.calls[1][0].timeout).toEqual({ totalMs: 50000 });
```

## Info

### IN-01: Never-advance tests use bare `.rejects.toThrow()` — error identity not pinned

**File:** `src/lib/agents/runAgent.test.ts:158-160, 166-169, 176-179, 184-187, 195-197`
**Issue:** The five never-advance tests assert "throws something" plus the 1x call count. The call count is the meaningful lock (it catches an `isFailoverEligible` regression), but a regression that rethrew a *different* error (e.g., wrapping the original) would still pass. The matrix row claims "fail loud in one attempt with the right structured reason" — the reason identity is only locked at taxonomy level (`modelConfig.test.ts`), not at loop level. Since `runAgent.ts:89` rethrows the original `err` object, pinning identity is cheap and makes the fail-loud semantics airtight.
**Fix:** `await expect(runAgent({...})).rejects.toThrow(apiErr(401));` (vitest `toThrow` with an Error instance compares by reference — the original error is rethrown, so this holds).

### IN-02: Real-snapshot test hard-codes count and allowlist outcome — intentional tripwire, but brittle coupling

**File:** `src/lib/models/catalog.test.ts:84-87`
**Issue:** The test title hard-codes "1131-model" — a snapshot refresh (documented standing maintenance in `catalog.ts:11`) will silently stale the title without failing. More substantively, `toEqual(['claude-sonnet-4-6'])` couples the test to both the snapshot's statuses *and* the hand-curated allowlist: any legitimate allowlist expansion (e.g., adding `claude-haiku-4-5`, which the committed snapshot already contains as `active`) breaks this test and the fixture test at line 81 simultaneously. This is a defensible tripwire (allowlist changes are deliberate code changes), but the coupling is worth documenting in the header comment (lines 12-14 currently claim the fixture is "deliberately decoupled" — it is decoupled from the *snapshot*, not from the *allowlist*).
**Fix:** Optionally drop the hard-coded count from the title (e.g., "committed snapshot yields exactly the servable allowlist"), and add one line to the comment noting that allowlist growth requires updating both `toEqual` assertions by design.

### IN-03: Redundant no-slash assertion

**File:** `src/lib/models/catalog.test.ts:86`
**Issue:** `expect(getAllowlistedServableIds(catalogJson).some((id) => id.includes('/'))).toBe(false)` is subsumed by the preceding `toEqual(['claude-sonnet-4-6'])` — an exact-match assertion on the whole array already guarantees no `/` in any element. Harmless, but it reads as a second independent check when it isn't.
**Fix:** Remove line 86, or restate as a comment on line 85 explaining the zero-leakage intent (matrix row 40 cites both assertions as separate proof surfaces, so if removed, update `18-VER-01-MATRIX.md:40` accordingly).

---

## VER-01 / VER-02 lock assessment (per review scope)

- **Failover never-advance semantics (VER-01):** Genuinely locked at loop level by the new tests. Traced each against `classifyModelError`/`isFailoverEligible`/the loop: 401→`auth`, 403→`auth`, `InvalidResponseDataError`→`output`, 429→`rate_limited` all land on the never-advance branch; RetryError-404 unwraps via `lastError` to `model_not_found` and advances. Call-count assertions would catch a gate regression. Caveats: WR-01 and IN-01 above.
- **Allowlist integrity (VER-02):** The real-snapshot test holds against the committed `catalog.json` (verified: 17 anthropic entries, all `active`, intersection with `ANTHROPIC_ALLOWLIST` is exactly `['claude-sonnet-4-6']`). Genuine lock on real data; coupling caveat in IN-02.
- **Partial-chain pass-through (VER-02):** Correct and non-redundant with the existing cap test — it pins the 2-element chain surviving dedupe/cap/allowlist intact, the exact "default/partial/full" matrix cell. No issues found.

_Reviewed: 2026-08-02T19:10:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
