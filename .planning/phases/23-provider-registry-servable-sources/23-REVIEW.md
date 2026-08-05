---
phase: 23-provider-registry-servable-sources
reviewed: 2026-08-04T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - src/lib/models/catalog.ts
  - src/lib/models/catalog.test.ts
  - src/lib/agents/modelFactory.ts
  - src/lib/agents/modelFactory.test.ts
  - src/lib/env.ts
  - .env.example
  - src/app/actions/settings.ts
  - src/app/actions/settings.test.ts
  - src/components/settings/model-picker-logic.ts
  - src/components/settings/model-picker-logic.test.ts
  - src/app/(dashboard)/settings/page.tsx
findings:
  critical: 0
  warning: 2
  info: 5
  total: 7
status: issues_found
---

# Phase 23: Code Review Report

**Reviewed:** 2026-08-04T00:00:00Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Reviewed the 4-provider registry keystone (`catalog.ts` union/gates/`dedupeProviderRows`/servable-membership resolver), the `PROVIDER_DEFAULT_MODELS` 4-entry map, the optional server-only env declarations, the REG-07 cross-provider save case, and the registry-driven `PROVIDER_NAMES`/`trimRow` rewiring. `src/components/settings/model-settings-form.tsx` was read as cross-reference to confirm reachability of the provider-switch path (not a phase-modified file).

The core registry logic is correct and well-locked: the 87 tests across the four changed test files pass, `tsc --noEmit` is clean per phase records, the 39-count/23+16 npm split, the 65-row no-flip pool, and the 375-row union were all re-verified against the committed snapshot during this review. Dedup-then-gate ordering, `PROVIDER_PRECEDENCE` ranking, and fail-closed `null` resolution all behave as documented.

Two non-blocking issues surfaced: (1) the Settings page now exposes a **NousResearch provider option with zero servable models** — a user-reachable dead-end state shipped one phase before the data lands; (2) a latent ordering hazard in `getServableIdsForProvider` where the deprecated filter runs *after* dedup, which can silently drop a model if a future refresh ever produces a dual-listed id with a deprecated Zen row and an active Go row. No security vulnerabilities found (keys are optional, server-only, no `PUBLIC_` variant, `settings.ts` untouched, no injection surface).

## Warnings

### WR-01: NousResearch provider entry is selectable with zero servable models — empty-picker dead-end state

**File:** `src/app/(dashboard)/settings/page.tsx:102` (also `src/lib/agents/modelFactory.ts:31`, `src/components/settings/model-picker-logic.ts:69-79`)

**Issue:** `SERVABLE_PROVIDERS` includes `'nousresearch'` while `getServableIdsForProvider(catalogJson, 'nousresearch')` returns `[]` until Phase 24 lands the snapshot rows (documented Pitfall 5). The 4-entry selector from 23-04 therefore renders "NousResearch" as a fully selectable option today. Reaching it produces a user-visible dead-end:

1. `handleProviderChange('nousresearch')` → `primaryAfterProviderSwitch` (model-picker-logic.ts:75) sees an empty servable list → `valid === false` → resets primary to `NOUSRESEARCH_DEFAULT_MODEL_ID`.
2. The primary picker's `options` array is empty (`optionsForSlot(..., servableByProvider['nousresearch'])` = `[]`), and `pinnedSelection` returns `onlyModel: true` — rendering the "only available NousResearch model" explanation, which is **factually wrong** (zero NousResearch models are servable; the pinned id is an openrouter mirror row).
3. Verified against the snapshot: `'nousresearch/hermes-4-70b'` is union-servable **only via its active openrouter mirror row** (name "Hermes 4 70B"). So a Save in this state *succeeds*, but the persisted chain resolves to `openrouter` at run time today — and will silently re-badge to `nousresearch` (with the Phase 25 chain-aware gate then requiring `NOUSRESEARCH_API_KEY` instead of `OPENROUTER_API_KEY`) the moment Phase 24 rows land. That is exactly the silent-swap class the phase's own comment (catalog.ts:152-154) claims to prevent, now introduced on the UI side for the *allowlisted* hermes pins.

**Fix:** Either exclude `nousresearch` from the selector until servable rows exist (`providers.filter`/disable the `SelectItem` when the provider's servable list is empty), or gate the option with a "coming in Phase 24" disabled state. Minimum: pass `disabled={servableByProvider[p].length === 0}` per `SelectItem`. Add a canary asserting the selector never offers a provider whose servable list is empty, so the Phase 24 data landing flips it on deliberately rather than by accident.

### WR-02: Deprecated filter runs *after* dedup in `getServableIdsForProvider` — dual-listed model can silently vanish

**File:** `src/lib/models/catalog.ts:132`

**Issue:** The pipeline is `dedupeProviderRows(...)` (first-providerID-wins) **then** `.filter((m) => m.status !== 'deprecated')`. If a future refresh (Phase 24 `refresh-model-catalog.ts` regeneration, or any OpenCode roster change) ever produces a dual-listed id whose **Zen row is `deprecated` but whose Go row is `active`**, dedup keeps the deprecated Zen row (first-wins), the status filter then removes it, and the *active* Go row was already discarded — the model silently disappears from the servable set even though a servable row exists. Data-safe today (verified: 0 deprecated rows among the 77 opencode/opencode-go rows; no id's first row is deprecated), but the ordering is a latent correctness hazard that the no-flip canaries do not pin (they assert counts/URLs on the current snapshot, not the ordering property).

**Fix:** Filter deprecated *before* dedup:
```ts
const pool = dedupeProviderRows(
  catalog,
  provider,
).filter((m) => m.status !== 'deprecated');
```
becomes
```ts
const rows = catalog.models.filter(
  (m) => SNAPSHOT_PROVIDER_IDS[provider].includes(m.providerID) && m.status !== 'deprecated',
);
const seen = new Set<string>();
const pool = rows.filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)));
```
For all current data the output is byte-identical (no deprecated rows exist); for the edge case the active Go row survives and the id stays servable. Optionally add a fixture canary with a deprecated-Zen/active-Go pair to lock the ordering.

## Info

### IN-01: `.env.example` empty-value keys contradict the documented "undefined read path"

**File:** `.env.example:40-41`

The new keys ship as `NOUSRESEARCH_API_KEY=` / `OPENCODE_API_KEY=` (empty) while every other optional key uses an `xxxxxxxx` placeholder. After the README's `cp .env.example .env` workflow, the parsed values are `''` (empty string — valid under `z.string().optional()`, which has no `min(1)`), **not** `undefined` as 23-02-SUMMARY's read-path proof documents ("`env.NOUSRESEARCH_API_KEY === undefined`"). The Phase 25 chain-aware gate must use falsy checks (`if (!env.NOUSRESEARCH_API_KEY)`) rather than `=== undefined`; also worth recording in the 23-02 deviation note so the D-15 convention stays consistent. Suggest matching the placeholder convention (`NOUSRESEARCH_API_KEY=nr-xxxxxxxx` etc.) or documenting why empty is intentional.

### IN-02: Redundant `gate.npm!` non-null assertion

**File:** `src/lib/models/catalog.ts:134`

```ts
if (gate.npm) return pool.filter((m) => gate.npm!.includes(m.api.npm)).map((m) => m.id);
```
The `!` is unnecessary — TS already narrows `gate.npm` to `readonly string[]` after the truthiness check on the const-bound `gate`. Same pattern on line 135 (`gate.allowlist!`). Drop the assertions; the gate then also reads as pure data.

### IN-03: Stale "337 rows" comment in the picker-logic test fixture header

**File:** `src/components/settings/model-picker-logic.test.ts:21-23`

The header still claims "The production union servable set is 337 rows (336 openrouter + 1 anthropic servable)". Post-23-04 it is 375 (336 + 1 + 39 − 1 overlap). The file was modified this phase (fixture records widened) and the page.tsx comments were refreshed to 375 — this one was missed. Misleading for the next maintainer reasoning about the fixture.

### IN-04: VER-04 security-matrix grep does not yet cover the two new key names

**File:** `src/lib/verification/security-grep.test.ts` (cross-reference — not phase-modified)

The permanent grep gate flags `OPENROUTER` in client-reachable code but has no patterns for `NOUSRESEARCH_API_KEY` / `OPENCODE_API_KEY`. A future `NEXT_PUBLIC_NOUSRESEARCH_API_KEY` (or similar) would pass the gate until Phase 27 extends it. The keys are correctly server-only today, so this is a coverage window, not a live leak. Consider adding the two names when the gate next changes, rather than waiting for Phase 27.

### IN-05: `getProviderForModelId` rescans every provider's full gated pool per call

**File:** `src/lib/models/catalog.ts:160-164`

Each call runs `getServableIdsForProvider` up to 4 times (filter + Set dedup + gate over the full snapshot per provider). `settings/page.tsx:83-85` calls it once per union id (375 × ~4 × 1131 row ops ≈ 1.7M per settings render), and Phase 25's `instantiateModel` dispatch will call it per model per analyze run. Out of v1 performance scope, but since the catalog is immutable per deploy, memoizing a `provider → Set<servableIds>` (or a single `id → provider` Map built once at module load) would remove the quadratic behavior and is worth doing before the run path makes it hot.

---

_Reviewed: 2026-08-04T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
