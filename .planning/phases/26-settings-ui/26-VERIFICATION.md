---
phase: 26-settings-ui
verified: 2026-08-04T17:51:58Z
status: passed
score: 5/5 roadmap success criteria verified in code + tests (6/6 SET-0X requirements have code evidence); all 4 human_verification items closed by Phase 27's live Playwright pass
overrides_applied: 0
human_verification: []
re_verification:
  previous_status: human_needed
  gaps_closed:
    - "All 4 human_verification items below closed by Plan 27-05's extended e2e/ver-05-settings.spec.ts, proven live (13/13 passed, 29.8s, real Clerk account) — see 26-HUMAN-UAT.md for the exact test-name -> item mapping and .planning/phases/27-verification-gate/27-VERIFICATION.md for the full evidence record."
  status_change_note: "This status field was left stale at human_needed after Plan 27-06 closed 26-HUMAN-UAT.md's items (status: resolved, 2026-08-04T21:41:22Z) — the underlying evidence existed but this file's frontmatter was never re-run to match. Flipped to passed at v1.5 milestone-ship time after confirming 26-HUMAN-UAT.md's resolution against the actual passing test names."
---

# Phase 26: Settings UI Verification Report

**Phase Goal:** Staff can see and configure all four providers in the Settings AI Model Configuration card with honest captions and unambiguous badges.
**Verified:** 2026-08-04T17:51:58Z
**Status:** passed — all 4 human_verification items closed by Phase 27's live Playwright run (13/13 passed). See `26-HUMAN-UAT.md` for the exact test-name → item mapping.
**Re-verification:** Yes — status field synced with 26-HUMAN-UAT.md's already-resolved state (previously stale at `human_needed`).

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP Success Criterion) | Status | Evidence |
|---|---|---|---|
| 1 | AI Provider selector renders 4 always-valued entries (Anthropic, OpenRouter, NousResearch, OpenCode) in `SERVABLE_PROVIDERS` order | ✓ VERIFIED (code) — visual confirmation outstanding | `src/app/(dashboard)/settings/page.tsx:110` `const providers = SERVABLE_PROVIDERS.map((id) => ({ id, name: providerName(id) }))`; `SERVABLE_PROVIDERS` = `['anthropic','openrouter','nousresearch','opencode']` (`src/lib/models/catalog.ts:102`, locked by test `catalog.test.ts:420-421`); rendered via `<Select>` iterating `providers.map(...)` (`model-settings-form.tsx:236-240`). Note: this code path was landed in phase 23 (commit `cb9f05aa`), not phase 26 — see Requirements Coverage below for the REQUIREMENTS.md bookkeeping discrepancy this creates. |
| 2 | Selecting a provider refreshes the Primary model picker from that provider's servable source | ✓ VERIFIED | `servableByProvider` built per-provider in `page.tsx:77-82`; `ModelPicker`'s `options={optionsForSlot(primary, fallbacks, -1, servableByProvider[provider])}` (`model-settings-form.tsx:266`); `primaryAfterProviderSwitch` unit-tested with a real 4-provider fixture (nousresearch/opencode-Zen/opencode-Go rows) in `model-picker-logic.test.ts`. Live counts at time of verification: anthropic=1, openrouter=337, nousresearch=2, opencode=40 (measured directly against `catalog.json` — differs from the ROADMAP text's "opencode 49/openrouter 336" figures; this is expected, acknowledged catalog-refresh drift per `catalog.test.ts:266` comment and RESEARCH Pitfall 5, not a functional defect — `COUNT-STABILITY` canaries lock the *mechanism*, not a frozen count). |
| 3 | OpenCode rows render `· Zen` / `· Go` endpoint caption in the same caption slot as suffix labels, in BOTH the provider-scoped primary and union fallback pickers | ✓ VERIFIED | `endpoint` field derived server-side once in `trimRow` (`page.tsx:72`) and flows into both `servableByProvider` and `unionServableModels` (same function, both call sites, `page.tsx:80` / `page.tsx:92`); `model-picker.tsx:172-174` renders `rowCaption(m)` in the single `CommandItem` used by both `grouped=false` (primary) and `grouped=true` (union fallback) picker instances — same component, same caption call site, both modes covered by construction. Unit-tested: `rowCaption` composes endpoint→suffix→hermes in locked order, including the synthetic compound case. |
| 4 | NousResearch Hermes rows render honest capability captions with per-MTok cost captions | ✓ VERIFIED | `hermesCaptionLabel('nousresearch')` → `'chat/reasoning-tuned'`, keyed on resolved `providerID` not `family` (excludes the openrouter mirror row) — unit-tested including `hermesCaptionLabel('openrouter')` → `null` assertion (`model-picker-logic.test.ts:206`). Cost caption (`model-picker.tsx:180-187`) is unconditional — no `providerID ===` suppression found around it (grep-verified), matching D-26-05 corrected. |
| 5 | Provider badges cover all 4 providers and disambiguate same-name models; union pickers group by all 4 providers; save + staleness verified end-to-end against 4-provider chains | ✓ VERIFIED | Primary trigger badge: `badge={resolveBadgeProvider(primary, unionServableModels, provider)}` (`model-settings-form.tsx:283`), replacing the prior raw-dropdown-value bug; unit-tested for both real collisions (`claude-sonnet-4-6` → anthropic not opencode; `nousresearch/hermes-4-70b` → nousresearch not openrouter) plus the fallback case. Fallback picker badge already resolves from `unionServableModels` (`model-settings-form.tsx:333`). `groupByProvider` buckets by `providerID`, unit-tested with a 4-provider fixture. Save/staleness: `src/app/actions/settings.test.ts:67` `'REG-07 (4-provider): a cross-provider chain spanning the new providers saves against the widened union'` — passing, part of the green 448-test suite. |

**Score:** 5/5 roadmap success criteria have code + automated-test evidence. All 5 also carry a live-browser confirmation step that is explicitly deferred per this phase's `workflow.human_verify_mode: end-of-phase` annotations (see `26-01-PLAN.md`/`26-02-PLAN.md` acceptance criteria "Behavior (deferred to end-of-phase manual verification...)" and `26-VALIDATION.md`'s "Manual-Only Verifications" table) — no `26-HUMAN-UAT.md` exists yet, confirming these checks have not been executed.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/components/settings/model-picker-logic.ts` | endpoint field + endpointLabel/hermesCaptionLabel/rowCaption/resolveBadgeProvider + endpoint-aware searchValue | ✓ VERIFIED | All 4 new exports present, single definitions each (`grep -c` confirms exactly 1 match per function); `ServableModel.endpoint: 'zen' \| 'go' \| null` is a required field. |
| `src/components/settings/model-picker-logic.test.ts` | unit coverage for every new function + 4-provider fixture | ✓ VERIFIED | 53/53 tests pass (`npx vitest run` re-run independently); includes `resolveBadgeProvider` collision cases, `hermesCaptionLabel('openrouter')` exclusion assertion, `rowCaption` compound-caption synthetic case, 4-provider `primaryAfterProviderSwitch`/`groupByProvider` fixture. |
| `src/app/(dashboard)/settings/page.tsx` | server-side endpoint derivation in trimRow, flowing to both consumers | ✓ VERIFIED | `endpoint: provider === 'opencode' ? (m?.providerID === 'opencode-go' ? 'go' : 'zen') : null` at line 72, single shared `trimRow` feeding `servableByProvider` and `unionServableModels`. |
| `src/components/settings/model-picker.tsx` | composed row-caption rendering via rowCaption() | ✓ VERIFIED | `rowCaption(m)` call at line 172-174 replaces the old suffix-only span; `grep -c "suffixLabel(m.id)"` = 0 (fully replaced, not duplicated). |
| `src/components/settings/model-settings-form.tsx` | resolveBadgeProvider-driven badge, endpoint-aware recap, corrected reset-hint copy | ✓ VERIFIED (with 2 advisory-severity code-review findings — see below) | `badge={resolveBadgeProvider(...)}` at line 283; `endpointLabel(resolved.endpoint)` recap caption at line 412; generic collision-detecting reset-hint at lines 184-191, matches locked UI-SPEC copy for the live collision case. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `page.tsx` trimRow | `model-picker-logic.ts` ServableModel type | return-object field assignment | ✓ WIRED | `endpoint:` field populated once, consumed by both `servableByProvider` and `unionServableModels`. |
| `model-picker.tsx` CommandItem caption span | `model-picker-logic.ts` rowCaption | function call | ✓ WIRED | `rowCaption(m)` — single call site serving both grouped and ungrouped picker modes. |
| `model-settings-form.tsx` primary badge prop | `model-picker-logic.ts` resolveBadgeProvider | function call | ✓ WIRED | `badge={resolveBadgeProvider(primary, unionServableModels, provider)}` — exactly 1 match. |
| `model-settings-form.tsx` saved-chain recap | `model-picker-logic.ts` endpointLabel | function call on union-resolved row | ✓ WIRED | `endpointLabel(resolved.endpoint)` — exactly 1 match; `resolved` captured once per iteration, reused for badge + caption. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `model-settings-form.tsx` provider selector | `providers` prop | `page.tsx`: `SERVABLE_PROVIDERS.map(...)` reading the registry constant | Yes — 4 fixed, always-populated entries, no DB/network dependency | ✓ FLOWING |
| `ModelPicker` (primary) options | `servableByProvider[provider]` | `page.tsx`: `getServableIdsForProvider(catalogJson, p).map(trimRow)` — reads the committed `catalog.json` snapshot, not a static array | Yes — measured live counts (1/337/2/40) differ from stale ROADMAP text, confirming this is a real, live-computed read, not a hardcoded stub | ✓ FLOWING |
| `ModelPicker` (union fallback) options | `unionServableModels` | `page.tsx`: `getUnionServableIds(catalogJson).map(...)` | Yes — 377 rows measured live | ✓ FLOWING |
| `endpoint` field on every `ServableModel` | `trimRow`'s matched catalog row `m` | `dedupeProviderRows(catalogJson, provider).find(...)` | Yes — derived from the actual matched snapshot row's `providerID`, never re-derived from the id string client-side (per this plan's own threat model T-26-02) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Logic-module unit suite (endpoint/Hermes/badge/4-provider fixture) | `npx vitest run src/components/settings/model-picker-logic.test.ts` | 53/53 passed | ✓ PASS |
| Project-wide type-check | `npx tsc --noEmit` | exit 0, no output | ✓ PASS |
| Full test suite | `npm test` | 448 passed / 1 failed / 6 skipped (34 files) | ⚠️ 1 unrelated failure — `src/lib/agents/openrouter-only-chain.test.ts` (`VER-03 openrouter-only chain`), a live-network/live-key test in a file phase 26 never touched (VER-03 belongs to phase 27's requirement set); not caused by this phase's changes. |
| Security-grep gate | `npx vitest run src/lib/verification/security-grep.test.ts` | 5/5 passed | ✓ PASS |
| Production build | `VERCEL=1 npm run build` | exit 0, `/settings` route present in manifest | ✓ PASS |
| Save-path 4-provider regression test | (included in `npm test` — `src/app/actions/settings.test.ts`) | `REG-07 (4-provider)` test passing | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| SET-01 | 26-01, 26-02 | Provider selector renders 4 always-valued entries in `SERVABLE_PROVIDERS` order | ✓ SATISFIED (code) — ⚠️ REQUIREMENTS.md bookkeeping stale | Implemented in phase 23 (`cb9f05aa feat(23-04)`), not modified by phase 26 (phase 26's `git log` on `page.tsx` shows only the one `a2e51a59` endpoint-field commit touching this file). REQUIREMENTS.md's traceability table (line 100) still marks `SET-01 | 26 | Pending` even though both phase-26 plans declare `requirements: [SET-01, ...]` and both SUMMARYs claim `requirements-completed: [SET-01, ...]`. The underlying code satisfies the requirement text; the checkbox/table entry was never flipped to Complete. This is a documentation gap, not a functional one — flagged as a WARNING, not a BLOCKER. |
| SET-02 | 26-01 | Provider switch refreshes Primary picker from servable source | ✓ SATISFIED | See Truth #2 above; REQUIREMENTS.md correctly marks Complete. |
| SET-03 | 26-01, 26-02 | OpenCode `· Zen`/`· Go` endpoint captions, both pickers | ✓ SATISFIED | See Truth #3 above. |
| SET-04 | 26-01, 26-02 | Hermes capability + cost captions | ✓ SATISFIED | See Truth #4 above. |
| SET-05 | 26-01, 26-02 | Badge disambiguation across 4 providers | ✓ SATISFIED | See Truth #5 above. |
| SET-06 | 26-01, 26-02 | Union grouping + save/staleness end-to-end vs. 4-provider chains | ✓ SATISFIED | See Truth #5 above (REG-07 4-provider save test). |

No orphaned requirements: REQUIREMENTS.md maps exactly SET-01..SET-06 to Phase 26, and all 6 appear in the `requirements:` frontmatter of at least one of the two phase-26 plans.

### Anti-Patterns Found

No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers, stub returns, or hardcoded-empty-data patterns found in any of the 5 files this phase modified (grep-scanned; zero matches).

The independent code-review pass (`26-REVIEW.md`, already run prior to this verification) found 2 Critical and 3 Warning findings, concentrated in `model-settings-form.tsx`. These are advisory/non-blocking per the code-review gate contract, but are reproduced here because they bear on whether "staff can... configure... providers" is *soundly* achieved, not just rendered:

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `model-settings-form.tsx` | 101-135 | Save-in-flight race: `setStatus('saved')` fires unconditionally on the in-flight request's resolution, even if the draft changed (to an un-sent value) while the save was pending; only the "Saved chain" recap sub-line is gated on draft-equals-lastSaved, not the parent "Saved." text | 🛑 Critical (advisory, non-blocking per review gate) | A staff member can see "Saved." confirming a value that was never actually persisted, and lose that edit if they navigate away trusting it. Directly touches this phase's "configure... providers" goal. |
| `model-settings-form.tsx` | 101-126 | `handleSave` has no `try/catch` around the `saveSettingsAction` call — a client-side transport failure (offline, dropped connection) leaves `status` stuck at `'saving'` forever with an unhandled promise rejection, contradicting CLAUDE.md's documented "fail safe, fail silent" error-handling convention that the sibling file (`page.tsx`) follows correctly | 🛑 Critical (advisory, non-blocking per review gate) | Save can silently hang with no error shown and no way to retry short of a page reload. |
| `model-settings-form.tsx` | 309-371 | Array-index React `key` on a reorderable/removable fallback-row list | ⚠️ Warning | Popover open/closed state can attach to the wrong row after a reorder/remove. |
| `model-picker.tsx` | 68-73 | Ungrouped picker's section header falls back to a hardcoded `'anthropic'` when `options` is empty, instead of the caller-supplied `badge` | ⚠️ Warning | Currently masked because Anthropic happens to be the one single-model provider today; would mislabel a future single-model NousResearch/OpenCode/OpenRouter scenario. |
| `model-picker-logic.ts` | 141-145 | `groupByProvider`'s return type claims all 4 keys always present; only present providers actually get keys | ⚠️ Warning | Type-level footgun for a future direct-index caller; no current call site is affected. |

None of these findings block any of the 5 roadmap Success Criteria as literally stated (all 5 have passing code + test evidence), so they do not change this report's `status` field — but CR-01/CR-02 materially weaken confidence in the "configure" half of the phase goal and are worth a developer decision on whether to open a fast-follow fix before Phase 27's live-browser UAT.

### Human Verification Required

None outstanding. All 4 items closed by Plan 27-05's extended `e2e/ver-05-settings.spec.ts`, proven live (13/13 passed, 29.8s, real Clerk account) — see `26-HUMAN-UAT.md` for the exact test-name → item mapping:

1. Full 4-provider Select → Picker → Save round trip in the live browser (SET-01/02/06). — resolved
2. OpenCode Zen/Go caption rendering in the live Combobox + saved-chain recap (SET-03). — resolved
3. Reset-hint copy accuracy for the claude-sonnet-4-6 collision case (SET-05/D-26-09). — resolved
4. Trigger badge accuracy for both verified collision ids (SET-05/D-26-11). — resolved

### Gaps Summary

No BLOCKER-level gaps found. Every artifact this phase's plans declared exists, is substantive (not a stub), is wired into both the primary and union picker paths, and is backed by passing unit tests (53/53 in the logic module, 448/449 in the full suite — the 1 failure is a pre-existing, phase-26-unrelated live-network test). `tsc`, the security-grep gate, and a production build (`VERCEL=1 npm run build`, including the `/settings` route) all pass.

Two items merit developer attention, both explicitly non-blocking per this project's gate contracts:

- **SET-01 REQUIREMENTS.md bookkeeping**: the requirement is functionally satisfied (implemented in phase 23, still correct after phase 26), but the traceability table's status column was never updated from "Pending" to "Complete." Recommend a documentation-only fix (flip the checkbox/table row) rather than a code change.
- **CR-01/CR-02 save-flow correctness bugs** (from `26-REVIEW.md`, reproduced above): advisory per the code-review gate, but both degrade trust in the Save action specifically, which is central to "staff can... configure... providers." Recommend scheduling a fast-follow fix before or alongside Phase 27.

Status is `passed` — the 4 manual/live-browser checks deferred at this phase's own close (per `human_verify_mode: end-of-phase`) were subsequently closed by Phase 27's live Playwright run, recorded in `26-HUMAN-UAT.md`.

---

_Verified: 2026-08-04T17:51:58Z (initial); status synced to passed at v1.5 milestone-ship time after confirming 26-HUMAN-UAT.md's resolution_
_Verifier: Claude (gsd-verifier)_
