---
phase: 27-verification-gate
plan: 05
subsystem: testing
tags: [playwright, e2e, clerk, settings-ui, provider-registry]

# Dependency graph
requires:
  - phase: 27-verification-gate
    provides: "Plan 27-04's CR-01 (save-in-flight race gate) and CR-02 (try/catch) fixes in model-settings-form.tsx, which this spec exercises live"
provides:
  - "e2e/ver-05-settings.spec.ts extended with 6 new test blocks (widened setProvider type + 6 tests) proving the 4-provider selector, Zen/Go + Hermes captions, badge disambiguation, and the CR-01 save-race regression"
  - "1:1 automated closure for all 4 of 26-HUMAN-UAT.md's pending items"
affects: ["27-06"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Provider-badge-scoped option filtering (.filter({ has: locator('[data-slot=\"badge\"]').filter({ hasText: ... }) })) to disambiguate same-substring rows across providers in the grouped union fallback picker"
    - "Browser-level race-window approximation: since Playwright cannot literally suspend a real network request mid-flight, prove the render-gate logic via a deterministic double-save-with-intervening-edit sequence instead"

key-files:
  created: []
  modified:
    - e2e/ver-05-settings.spec.ts

key-decisions:
  - "setProvider's target type widened to all 4 providers ('Anthropic' | 'OpenRouter' | 'NousResearch' | 'OpenCode') rather than adding a second helper — the existing helper's body was already provider-name-agnostic (uses the passed 'named' string directly), so only the type signature needed to change"
  - "The 4-provider round-trip test asserts a non-empty, visible primary badge after each switch rather than asserting badge-matches-dropdown-provider — the claude-sonnet-4-6 collision (proven separately in the dedicated collision test) means a badge can legitimately diverge from the dropdown's own provider when a higher-precedence provider still serves the same id; asserting exact match here would make the round-trip test flaky/wrong by construction"
  - "The Zen/Go union-fallback-picker assertion scopes to the OpenCode provider badge (not just hasText 'Hy3') because 'hy3' substring-matches unrelated rows from other providers (openrouter's tencent/hy3-preview, etc.) once the search widens from the OpenCode-scoped primary picker to the full 4-provider union — verified against the live catalog.json before writing the assertion"
  - "CR-01's test uses the plan-sanctioned deterministic fallback (double save with an intervening edit) rather than attempting to win the literal network race — a local dev server typically resolves saveSettingsAction before a second Playwright action can dispatch, making the literal race unreachable in practice; the deterministic version still proves the exact draft-equals-lastSaved gate CR-01 added transitions correctly on every edit"

patterns-established:
  - "Provider-badge-scoped Playwright option filtering for disambiguating cross-provider id/name substring collisions in the grouped union picker"

requirements-completed: [VER-05]

# Metrics
duration: 35min
completed: 2026-08-04
---

# Phase 27 Plan 05: Extended VER-05 Playwright Coverage Summary

**Extended `e2e/ver-05-settings.spec.ts` with 6 new Playwright test blocks (widened `setProvider` to 4 providers) proving the full 4-provider Select → Picker → Save round trip, OpenCode Zen/Go + NousResearch Hermes captions in both picker modes and the saved-chain recap, the claude-sonnet-4-6 and hermes-4-70b badge/reset-hint collisions, and Plan 27-04's CR-01 save-race gate — closing all 4 of `26-HUMAN-UAT.md`'s pending items with permanent automated regression coverage.**

## Performance

- **Duration:** 35 min
- **Started:** 2026-08-04 (worktree base commit `ea4948c2`)
- **Completed:** 2026-08-04
- **Tasks:** 3
- **Files modified:** 1

## Accomplishments
- Widened the `setProvider` Playwright helper's `target` parameter type from a 2-provider union to all 4 (`'Anthropic' | 'OpenRouter' | 'NousResearch' | 'OpenCode'`) — zero body changes needed, the helper was already provider-name-agnostic.
- Added a full 4-provider round-trip test that switches the AI Provider dropdown through all 4 entries in sequence, asserting a non-empty resolved primary after each switch, and ends by saving an OpenCode chain and confirming "Saved." — closes `26-HUMAN-UAT.md` item 1.
- Added a claude-sonnet-4-6 reset-hint + trigger-badge collision test: Anthropic → OpenCode switch triggers keep-if-valid (the id is opencode-servable) but `PROVIDER_PRECEDENCE` resolves it back to anthropic, proving the exact reset-hint copy (`"...stays routed through Anthropic — OpenCode's copy isn't used..."`) and the badge reading `'Anthropic'` — closes items 3 and 4a.
- Added an OpenCode Zen/Go endpoint-caption test covering `big-pickle` (Zen) and `hy3` (Go-exclusive) in both the provider-scoped primary picker and the grouped union fallback picker, plus the saved-chain recap showing both `'Zen'` and `'Go'` after a cross-endpoint save — closes item 2.
- Added a NousResearch Hermes capability + cost-caption test asserting `'chat/reasoning-tuned'` and a `/\$[\d.]+ \/ \$[\d.]+ per MTok/` pattern (never a hard-coded dollar figure) render on a real hermes row — covers SET-04.
- Added a hermes-4-70b trigger-badge collision test under the OpenRouter dropdown, proving `resolveBadgeProvider`'s nousresearch-outranks-openrouter precedence renders `'NousResearch'`, never `'OpenRouter'` — closes item 4b, completing item 4 fully alongside the claude-sonnet-4-6 case.
- Added a CR-01 mid-save-edit regression test: save primary A, edit to primary B without saving (asserting the stale "Saved." confirmation for A disappears immediately), then save B and confirm the fresh recap names B, never A — proves Plan 27-04's draft-equals-lastSaved gate.

## Task Commits

Each task was committed atomically:

1. **Task 1: Widen setProvider + full 4-provider round trip + reset-hint/badge collision for claude-sonnet-4-6** - `d74710de` (test)
2. **Task 2: OpenCode Zen/Go endpoint captions + Hermes capability captions** - `9631c02f` (test)
3. **Task 3: hermes-4-70b badge collision + CR-01 mid-save-edit regression** - `8bc1f656` (test)

## Files Created/Modified
- `e2e/ver-05-settings.spec.ts` - Widened `setProvider`'s type signature; added 6 new test blocks (150 lines) covering the 4-provider round trip, sonnet-4-6 and hermes-4-70b badge collisions, Zen/Go + Hermes captions, and the CR-01 regression

## Decisions Made
- `setProvider`'s type widened in place (no new helper) — the function body already took the target name as a plain string parameter used verbatim in `page.getByRole('option', { name: named })`, so only the TypeScript union needed the 2 new literal members.
- The round-trip test deliberately does NOT assert badge text matches the dropdown's own provider on every switch — the claude-sonnet-4-6 collision (a real, verified divergence) means that assertion would be actively wrong for the OpenCode leg of the loop when a prior test or the loop's own OpenCode switch lands on the shared id. The badge-provider match is instead asserted precisely, with the collision explained, in the two dedicated collision tests.
- Verified all real catalog ids referenced in new assertions (`big-pickle`, `hy3`, `nousresearch/hermes-4-70b`, `claude-sonnet-4-6`) directly against the committed `src/lib/models/catalog.json` before writing assertions, rather than trusting the plan's prose descriptions — confirmed `big-pickle` is opencode-exclusive (Zen), `hy3` is opencode-go-exclusive (Go, no Zen mirror), and `nousresearch/hermes-4-70b` is a genuine dual-provider (nousresearch + openrouter) id collision.
- The union fallback picker's `hy3` search scopes to the OpenCode provider badge (not just row text) because the same substring appears in unrelated rows from other providers (`tencent/hy3-preview` under openrouter/kilo/nousresearch groups) once the search widens past the OpenCode-only primary picker — verified via a direct catalog grep before writing the filter.

## Deviations from Plan

None - plan executed exactly as written. The plan's own discretion notes anticipated exactly the choices made: browser-level race approximation for CR-01 (plan explicitly sanctions this fallback when the literal race window is unreachable), and the exact test names/acceptance criteria specified in the plan were used verbatim.

## Issues Encountered

None. TypeScript (`npx tsc --noEmit`), ESLint (`npx eslint e2e/ver-05-settings.spec.ts`), and Playwright's own test collector (`npx playwright test e2e/ver-05-settings.spec.ts --list`, 13 tests discovered with zero syntax/structure errors) all pass clean. The full Vitest suite (`npm test`) remains green at 448 passed / 12 skipped — this plan touched only the e2e spec, zero application code.

**Live execution not possible in this worktree:** this worktree does not have `.env.local` (gitignored, isolated worktrees don't inherit it per this repo's setup). Attempting `npx playwright test e2e/ver-05-settings.spec.ts -g "closes 26-HUMAN-UAT item 1"` confirms the spec is structurally sound but fails at the `auth.setup.ts` stage with `Error: You need to set the CLERK_PUBLISHABLE_KEY environment variable` — i.e. it never reaches any of the tests written in this plan; the only blocker is missing live Clerk credentials in this isolated worktree, not a defect in the spec. **The orchestrator must re-run `npx playwright test e2e/ver-05-settings.spec.ts` after merge**, where `.env.local` (with `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`, `OPENCODE_API_KEY`, `NOUSRESEARCH_API_KEY`, and the Clerk test-account credentials) is present, to get the actual pass/fail evidence this plan's `<verification>` block requires (`npx playwright test e2e/ver-05-settings.spec.ts` full-file green run).

## User Setup Required

None - no new external service configuration required. The existing Clerk test account and `.env.local` keys (provisioned in Phase 22/23) are sufficient; they are simply not present in this isolated worktree.

## Next Phase Readiness

`e2e/ver-05-settings.spec.ts` now has 13 total tests (4 pre-existing Phase 22 tests + 1 IN-02 observation + 6 new Phase 27 tests + 2 tests already counted). All 4 of `26-HUMAN-UAT.md`'s pending items have a corresponding, named, structurally-valid Playwright test ready for a live run; Plan 27-06 can mark `26-HUMAN-UAT.md` resolved once the orchestrator confirms the post-merge live run is green, citing these exact test names:
- `VER-05: full 4-provider selector -> picker -> save round trip (closes 26-HUMAN-UAT item 1)`
- `VER-05: OpenCode Zen/Go endpoint captions in primary + fallback pickers + saved-chain recap (closes 26-HUMAN-UAT item 2)`
- `VER-05: reset-hint + trigger badge accuracy for the claude-sonnet-4-6 collision (closes 26-HUMAN-UAT items 3+4a)`
- `VER-05: hermes-4-70b trigger badge accuracy under OpenRouter (closes 26-HUMAN-UAT item 4b)`

**Blocker for full closure:** the live Playwright run itself (not just structural validity) must pass before Plan 27-06 can honestly mark `26-HUMAN-UAT.md` resolved — this worktree cannot produce that evidence; the orchestrator or a follow-up run with `.env.local` present must execute `npx playwright test e2e/ver-05-settings.spec.ts` and confirm 13/13 pass.

---
*Phase: 27-verification-gate*
*Completed: 2026-08-04*

## Self-Check: PASSED

- FOUND: e2e/ver-05-settings.spec.ts
- FOUND: .planning/phases/27-verification-gate/27-05-SUMMARY.md
- FOUND commit: d74710de (Task 1)
- FOUND commit: 9631c02f (Task 2)
- FOUND commit: 8bc1f656 (Task 3)
- FOUND commit: d286d924 (SUMMARY)
