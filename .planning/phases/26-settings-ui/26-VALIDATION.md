---
phase: 26
slug: settings-ui
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-04
---

# Phase 26 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4 (`vitest run`) — already established in this codebase |
| **Config file** | `vitest.config.ts` — `environment: 'node'`, `include: ['src/**/*.test.ts']` (note: `.tsx` files are never collected — components are not unit-tested, per established project convention; the pure logic module is the testable surface) |
| **Quick run command** | `npx vitest run src/components/settings/model-picker-logic.test.ts` |
| **Full suite command** | `npm test` (`vitest run`) |
| **Estimated runtime** | ~2-5 seconds (small pure-function suite, existing pattern) |

---

## Sampling Rate

- **Per task commit:** `npx vitest run src/components/settings/model-picker-logic.test.ts`
- **Per wave merge:** `npm test` (full suite — also re-runs `catalog.test.ts`'s row-count canaries, catching any accidental hardcoding of stale 49/336 numbers)
- **Phase gate (before `/gsd-verify-work`):** Full suite green + `npx tsc --noEmit` clean + `next build` exit 0

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 26-01/T1 | 26-01 | 1 | SET-01 | — | 4-entry selector order matches `SERVABLE_PROVIDERS` | unit (pure fn) | `npx vitest run src/components/settings/model-picker-logic.test.ts -t "PROVIDER_NAMES"` | ✅ (extend existing fixture-based tests) | ⬜ pending |
| 26-01/T1 | 26-01 | 1 | SET-02 | — | Provider switch refreshes primary picker's option set from that provider's servable source | unit (pure fn) | `npx vitest run src/components/settings/model-picker-logic.test.ts -t "primaryAfterProviderSwitch"` | ✅ existing 2-provider fixture — extended to 4-provider in 26-01/T1's `behavior` block | ⬜ pending |
| 26-01/T1, 26-02/T1 | 26-01, 26-02 | 1, 2 | SET-03 | — | `endpointLabel()`/`rowCaption()` render `· Zen`/`· Go`, compose with suffix per D-26-01, join `searchValue` (logic in 26-01/T1; render wiring in 26-02/T1) | unit (pure fn) | `npx vitest run src/components/settings/model-picker-logic.test.ts -t "endpoint"` | ✅ delivered by 26-01/T1 (was W0 gap, now closed by planning) | ⬜ pending |
| 26-01/T1, 26-02/T1 | 26-01, 26-02 | 1, 2 | SET-04 | — | Hermes capability caption + real cost caption (D-26-05 corrected) (logic in 26-01/T1; render wiring in 26-02/T1) | unit (pure fn) | `npx vitest run src/components/settings/model-picker-logic.test.ts -t "hermes"` | ✅ delivered by 26-01/T1 (was W0 gap, now closed by planning) | ⬜ pending |
| 26-01/T1, 26-02/T2 | 26-01, 26-02 | 1, 2 | SET-05 | T-26-01, T-26-04 | Primary trigger badge resolves to the TRUE provider (D-26-11 bug fix) for the 2 verified collision ids (extracted `resolveBadgeProvider` in 26-01/T1; call-site wiring in 26-02/T2) | unit (pure fn, extracted `resolveBadgeProvider`) | `npx vitest run src/components/settings/model-picker-logic.test.ts -t "badge"` | ✅ delivered by 26-01/T1 (was W0 gap, now closed by planning) | ⬜ pending |
| 26-01/T1 | 26-01 | 1 | SET-06 | — | Union grouping covers 4 providers; save/staleness end-to-end against a 4-provider chain | unit (`groupByProvider`) + existing action test | `npx vitest run src/components/settings/model-picker-logic.test.ts -t "groupByProvider"` + `npx vitest run src/app/actions/settings.test.ts` | ✅ save-path covered; grouping 4-provider fixture added in 26-01/T1's `behavior` block | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky (flips to ✅ per row as each plan's tasks execute and their `<verify>` commands pass — this table records the plan/wave assignment, not completed execution)*
*Task ID/Plan/Wave columns backfilled by the planner now that Plans 26-01 (wave 1) and 26-02 (wave 2, depends_on 26-01) exist.*

---

## Wave 0 Requirements

All four Wave 0 gaps are covered by Plan 26-01 Task 1's `behavior`/`action` blocks (TDD task, wave 1) — no separate Wave 0 plan was needed since the gaps were foldable into the existing logic-module task per RESEARCH.md Open Question 3's resolution.

- [x] `model-picker-logic.test.ts` — new `describe` block for `endpointLabel()`/`rowCaption()`/`searchValue()` endpoint composition (SET-03), synthetic fixture (no live row currently has a compound endpoint+suffix caption) — planned in 26-01 Task 1
- [x] `model-picker-logic.test.ts` — new `describe` block for the Hermes capability caption + real-cost caption (SET-04, per corrected D-26-05) — planned in 26-01 Task 1
- [x] `model-picker-logic.test.ts` — 4-provider fixture for `primaryAfterProviderSwitch`/`groupByProvider` (currently only a 2-provider fixture exists) — covers SET-02/06's verification gap — planned in 26-01 Task 1
- [x] Extract the badge-resolution fix (D-26-11) into a small named pure function (`resolveBadgeProvider`) in `model-picker-logic.ts` rather than inline JSX, so it gets unit coverage — highest-value test given it fixes a real, currently-shipping bug — planned in 26-01 Task 1

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Full 4-provider Select → Picker → Save round trip in the live browser | SET-01/02/06 | Component rendering isn't unit-tested per project convention; this is the first live exercise of the 4-provider path in one flow | Open Settings, switch AI Provider through all 4 entries, confirm Primary picker refreshes each time, save a 4-provider chain, reload and confirm persistence |
| OpenCode Zen/Go caption rendering in the actual Combobox UI | SET-03 | Visual/interactive caption composition | Pick an OpenCode row in the primary picker; confirm `· Zen`/`· Go` renders correctly ordered with any suffix label, in both the picker and the saved-chain recap |
| Reset-hint copy accuracy for claude-sonnet-4-6 (D-26-09 corrected) | SET-05 | Requires triggering the exact keep-if-valid provider-switch scenario in the live form | Set primary to claude-sonnet-4-6 under Anthropic, switch provider dropdown to OpenCode, confirm the hint states the true "stays routed through Anthropic" fact, not a false endpoint claim |
| Trigger badge accuracy for the 2 verified collision ids | SET-05 | Visual confirmation the D-26-11 fix renders correctly, not just passes unit tests | Select claude-sonnet-4-6 under the OpenCode dropdown as primary; confirm the closed trigger badge shows "Anthropic" (the true resolved provider), not "OpenCode" |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (26-01 T1/T2, 26-02 T1/T2 all carry `<verify><automated>`)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (4 tasks total, all 4 have `<automated>`)
- [x] Wave 0 covers all MISSING references (all 4 gaps folded into 26-01 Task 1, see Wave 0 Requirements above)
- [x] No watch-mode flags (all commands use `vitest run`/`tsc --noEmit`, never `--watch`)
- [x] Feedback latency < 10s (per Test Infrastructure "Estimated runtime" — small pure-function suite)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** plans 26-01/26-02 satisfy this validation contract in substance (all Wave 0 gaps planned, no 3 consecutive tasks without automated verify, no watch-mode flags); final execution sign-off still occurs at phase-gate per the Sampling Rate above.
