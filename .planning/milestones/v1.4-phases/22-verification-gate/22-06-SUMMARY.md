---
phase: 22-verification-gate
plan: 06
subsystem: testing
tags: [ver-05, playwright, clerk, model-picker, settings-ui, e2e]

# Dependency graph
requires:
  - phase: 22-verification-gate
    provides: 22-03 Playwright e2e harness (auth-setup → chromium storageState, serial workers) + provisioned E2E_CLERK_USER_EMAIL staff account this spec authenticates through
provides:
  - Live-browser UAT spec `e2e/ver-05-settings.spec.ts` (5 tests): SET-03 provider-switch draft preservation, SET-06 picker search/grouping/count, SET-05 badge disambiguation of same-name models, SET-07 ~/:free label discipline, IN-02 stale-primary badge guess observation
affects: [22-verification-gate plans 07, verification evidence for VER-05, future settings-UI work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Cross-run baseline hygiene for a persisted-DB UI: saved chains survive in Postgres between test runs AND addFallback caps at 2 rows, so every fallback-staging test first tears down saved fallback rows through the UI (clearFallbacks) instead of assuming slot 1 is empty
    - Keep-if-valid non-determinism: assert only what a provider switch FORCES (the reset-to-default path is deterministic; the pre-switch primary value is not — a prior save may leave any valid openrouter primary)
    - DOM-contract badge locators: scope to the actual render contract (span[data-slot="badge"]) instead of generic tag+text filters that over-match row subtitles
    - Declared-observation test: a limitation that cannot be driven through the UI (IN-02 stale-primary badge guess) is asserted as page-mount + documented, never force-driven green

key-files:
  created:
    - e2e/ver-05-settings.spec.ts
  modified: []

key-decisions:
  - "Plan's literal SET-05 collision example (claude-sonnet-5 vs anthropic/claude-sonnet-5) does NOT materialize: claude-sonnet-5 is opencode-only and NOT servable (allowlist is sonnet-only, catalog.ts:13); the real same-name pair is claude-sonnet-4-6 (anthropic) vs anthropic/claude-sonnet-4.6 (openrouter) — SET-05 targets the live pair after catalog verification"
  - "clearFallbacks() UI teardown is mandatory for cross-run determinism: the saved chain persists in Postgres across runs and addFallback caps at 2 rows, so a prior save would shift 'Add fallback' to 'Fallback model 2' and strand 'Fallback model 1' as a stale slot"
  - "SET-03 asserts nothing about the pre-switch primary value: keep-if-valid (D-21-01) preserves whatever openrouter primary a prior save left; only the post-switch-to-Anthropic force-reset (always reset-to-provider-default) is deterministic"
  - "SET-05 selects the ANTHROPIC collision row before Save so the persisted chain spans both providers and the recap has to disambiguate the same display name — the plan's flow saved with only the openrouter primary staged, which would not have proven the recap disambiguation"
  - "Badge locators scoped to [data-slot=\"badge\"] (badge.tsx DOM contract): generic locator('span') over-matches family subtitles and search-hit text spans"

patterns-established:
  - "Persisted-DB UI test hygiene: clearFallbacks() per staging test — never rely on a prior test's Save state"
  - "Deterministic-only assertions: assert forced-state outcomes (provider-switch resets, defaults) and leave preserved-state outcomes unasserted where a prior save makes them run-dependent"
  - "Catalog-verification-first spec authoring: verify the live catalog before writing collision/number assertions (336-row count, allowlist membership) — the plan's example pair was wrong; the data fixed it"

requirements-completed: [VER-05]

# Metrics
duration: 25min
completed: 2026-08-03
---

# Phase 22 Plan 06: Live-Browser Settings-UI UAT (VER-05) Summary

**Playwright spec proving the settings model-picker behavior layer through a real Clerk-authenticated browser: provider-switch draft preservation (SET-03), union-picker search/grouping/336-row count (SET-06), badge disambiguation of the same-name claude-sonnet-4.6 pair (SET-05), ~/:free label discipline in picker and saved recap (SET-07), and the IN-02 stale-primary badge guess recorded as an observation.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-08-03T12:28:00Z
- **Completed:** 2026-08-03T12:52:21Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Authored `e2e/ver-05-settings.spec.ts` (241 lines) and got it **green on the first run: 7/7 passed** (`npx playwright test e2e/ver-05-settings.spec.ts`, 19.6s, exit 0) — real Clerk auth via storageState from plan 22-03's auth-setup project, serial workers, no cookie stubs (D-22-05 honored).
- **SET-03** proves provider-switch draft preservation end-to-end: force OpenRouter baseline → stage an openrouter `:free` fallback → switch to Anthropic → the invalid primary resets with the non-blocking hint ("Primary model reset to Claude Sonnet 4.6 for Anthropic."), the primary picker shows the anthropic default, and the staged openrouter fallback survives the switch verbatim, still badge-labelled OpenRouter (D-21-01/D-21-02).
- **SET-06** proves the union fallback picker renders exactly **336 rows** (337 servable union minus the openrouter primary), grouped under `[cmdk-group-heading]` = `['Anthropic', 'OpenRouter']` in SERVABLE_PROVIDERS order, that type-to-filter (`:free`) collapses the list to <50 with grouping intact on clear, and that a no-match query lands cmdk's "No models found." empty state — never a 500.
- **SET-05** proves badge disambiguation of the **live** same-name pair: searching "sonnet" yields both `claude-sonnet-4-6` (Anthropic) and `anthropic/claude-sonnet-4.6` (OpenRouter) as two "Claude Sonnet 4.6" rows whose `[data-slot="badge"]` badges resolve to exactly `['Anthropic', 'OpenRouter']`; selecting the Anthropic row and saving persists a cross-provider chain whose recap disambiguates both names.
- **SET-07** proves `:free` rows render "free tier — 50 req/day shared" and `~latest` rows render "always the latest" as suffix labels, and that after saving a `~anthropic/claude-sonnet-latest` fallback the saved-chain recap shows the label ("Claude Sonnet Latest") and never a raw `~…`/`:free` id.
- **IN-02 observation** (21-REVIEW carry): the stale-primary badge guess is declared as an observation — the client staleness gate blanks Save and the picker only offers servable ids, so a catalog-absent saved primary cannot be minted through the UI; the spec records this rather than force-driving a green.

## Task Commits

1. **Task 1: Live-browser UAT spec** - `cde53675` (test)

## Files Created/Modified
- `e2e/ver-05-settings.spec.ts` - Live-browser UAT spec: 5 tests covering SET-03/SET-06/SET-05/SET-07 + IN-02 observation, plus `setProvider`/`clearFallbacks` helpers for baseline determinism.

## Verification

`npx playwright test e2e/ver-05-settings.spec.ts` — **7 passed (19.6s), exit 0**:

```
✓ 1 [auth-setup] global setup (315ms)
✓ 2 [auth-setup] authenticate and save state (5.1s)
✓ 3 [chromium] SET-03 provider-switch draft preservation (3.1s)
✓ 4 [chromium] SET-06 picker search + provider grouping (1.8s)
✓ 5 [chromium] SET-05 badges disambiguate same-name models (1.7s)
✓ 6 [chromium] SET-07 ~latest/:free ids never savable-or-served outside labels (1.6s)
✓ 7 [chromium] IN-02 stale-primary badge guess observed (987ms)
```

The auth-setup project signs in through Clerk's real infrastructure each run (no cookie injection); the settings pane rendered only because the real session passed `requireStaffAccess()`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Correctness] Plan's SET-05 collision pair does not exist in the live catalog**
- **Found during:** Task 1 (spec authoring, before any run)
- **Issue:** The plan's example pair (`claude-sonnet-5` vs `anthropic/claude-sonnet-5`) cannot render a collision: `claude-sonnet-5` is an `opencode`-provider row, excluded from the anthropic servable allowlist (catalog.ts:13 is sonnet-only) — so the "two rows, same name" scenario would never materialize and SET-05 would fail.
- **Fix:** Verified the catalog (node probe) and retargeted SET-05 at the real same-name pair: `claude-sonnet-4-6` (anthropic, "Claude Sonnet 4.6") vs `anthropic/claude-sonnet-4.6` (openrouter, "Claude Sonnet 4.6"). Both display "Claude Sonnet 4.6" and are servable — the badge-disambiguation proof holds on the live pair.
- **Files modified:** `e2e/ver-05-settings.spec.ts`
- **Commit:** `cde53675`

**2. [Rule 1 - Bug] Saved-chain recap in SET-05 would miss the Anthropic name**
- **Found during:** Task 1 (spec authoring)
- **Issue:** The plan's SET-05 flow saved with only the openrouter primary staged (the collision rows were inspected but never selected as a fallback), so the recap would contain only "OpenRouter/Grok" — `expect(recap).toContainText('Anthropic')` could never pass.
- **Fix:** Select the ANTHROPIC collision row as the fallback before Save, so the persisted chain spans both providers and the recap genuinely has to disambiguate the same display name across providers.
- **Files modified:** `e2e/ver-05-settings.spec.ts`
- **Commit:** `cde53675`

**3. [Rule 1 - Bug] Cross-run baseline contamination (determinism)**
- **Found during:** Task 1 (spec authoring)
- **Issue:** The saved chain persists in Postgres across test runs, and `addFallback` caps at 2 rows. A prior test that SAVES a fallback makes the next run's "Add fallback" create "Fallback model 2" — so tests staging "Fallback model 1" would index a stale or nonexistent slot on re-runs (the 22-04 probe already left an openrouter-only saved chain for this test user).
- **Fix:** Added `clearFallbacks()` — a per-test UI teardown that clicks "Remove fallback" until no saved rows remain — called at the top of every fallback-staging test (SET-03/05/06/07). Also removed the non-deterministic pre-switch primary assertion in SET-03 (keep-if-valid preserves whatever openrouter primary a prior save left; only the forced reset-to-default is stable).
- **Files modified:** `e2e/ver-05-settings.spec.ts`
- **Commit:** `cde53675`

### Declared Observations (not regressions)
- **IN-02 (stale-primary badge guess):** the saved-chain recap resolves a catalog-absent primary id to `providerID: null` and `providerName` falls back to `'anthropic'`, so a stale primary renders with the same "Anthropic" badge as a genuine anthropic model. Unreachable through the UI (staleness gate blanks Save), so recorded as an observation test (page-mount + documentation), not a forced-green regression.

## Known Stubs
None. The IN-02 test is a declared observation (page-mount + docs), which is the plan's intent, not a stub.

## Threat Flags
None. Test-only file; no new network endpoints, auth paths, or schema surface introduced.

## Self-Check: PASSED
- File `e2e/ver-05-settings.spec.ts` exists (241 lines). ✓
- Commit `cde53675` exists in `git log`. ✓
- Test run: 7 passed, exit 0. ✓
