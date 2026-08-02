---
phase: 17-settings-ui-list-source
verified: 2026-08-02T16:41:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
deferred:
  - truth: "Settings form interactive behavior (empty-state rendering, cost-captioned pickers, fallback add/remove/reorder, Save → 'Saved.' + persisted reload) verified in a live browser"
    addressed_in: "Phase 18 VER-03"
    evidence: "Plan 17-03 verification section: '<human-check> end-of-phase (deferred to Phase 18 VER-03): start npm run dev, sign in with a staff Clerk account, visit /settings ...' and Phase 18 success criteria: 'live-browser UAT proves the settings→Analyze→audit loop end-to-end'"
---

# Phase 17: Settings UI + List Source Verification Report

**Phase Goal:** Staff can open a Settings page from the shared navigation, see their current AI model configuration, and set/reorder a primary + ordered fallback chain — choosing only from models the app can actually run — with immediate, validated persistence.
**Verified:** 2026-08-02T16:41:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Staff can open a Settings page from a new "Settings" menu item in both the shared ExplorerMenu and the sidebar nav (Manage group, next to Reviews) — NavKey union grows 'settings' | ✓ VERIFIED | `src/lib/nav.ts:6` NavKey union includes `'settings'`; `nav.ts:16` exact-match `pathname === '/settings'` branch (no `startsWith('/settings/')`); `src/lib/sidebar-collapse.ts:16` `settings: 'Settings'` tooltip; `src/components/layout/app-sidebar.tsx:200-212` Manage-group Settings item below Reviews (`isActive={activeKey === 'settings'}`, `href="/settings"`, no badge); `src/app/companies/page.tsx:32` + `src/app/personas/page.tsx:30` `{ label: 'Settings', href: '/settings' }` ExplorerMenu entries. Locked by Vitest: `nav.test.ts:37-54` (`/settings` → 'settings', `/settings-archive` → null boundary guard), `sidebar-collapse.test.ts:17-22`. |
| 2 | The Settings page shows the staff member's current configuration — primary model + ordered fallback list, with a clear empty state when none is saved | ✓ VERIFIED | `src/app/(dashboard)/settings/page.tsx:22-35` fetches `getModelSettingsForUser(userId)` (real DB query, absence = undefined not throw) with try/catch → error card "Couldn't load your settings"; `page.tsx:62-64` maps to `saved` prop (null when none); `src/components/settings/model-settings-form.tsx:45-46` initializes draft from `saved`; `form:117-127` empty-state callout "No model configuration saved" with default-model copy when `saved === null`. |
| 3 | Staff can set their primary model from the runnable (Anthropic-allowlisted) list, add up to 2 ordered fallbacks, and remove or reorder fallbacks — an empty fallback list is allowed (primary-only runs) | ✓ VERIFIED | `form:141-160` primary picker over `servableModels`; `form:214-292` fallback rows with ArrowUp/ArrowDown/X ghost icon buttons (aria-labels "Move fallback up"/"Move fallback down"/"Remove fallback"); `form:98-100` `addFallback` caps at 2; `form:84-96` `moveFallback`/`removeFallback` operate on draft state only (D-07); `form:70` empty fallback rows filtered before send (`fallbacks.filter((id) => id !== '')`) and `staleIds` treats `''` as non-blocking (`form:60` `id &&` guard) — empty fallback list is saveable (SET-04). |
| 4 | Saving persists immediately via a Server Action (gated by `requireStaffAccess()`, zod-validated against the catalog) and the form reflects the saved state after reload | ✓ VERIFIED | `src/app/actions/settings.ts:34` `const { userId } = await requireStaffAccess()` FIRST (session-only key, schema has no userId field); `settings.ts:36-37` zod `safeParse` of unknown input; `settings.ts:40-44` every id validated against server-computed `getAllowlistedServableIds(catalogJson)`; `settings.ts:49-54` D-08/D-09 dedupe backstop → `duplicate_model`; `settings.ts:56-60` atomic `upsertModelSettings` keyed by session userId; `settings.ts:62-63` `revalidatePath('/settings')` + `{ ok: true }` on success only; `settings.ts:64-66` catch → `action_failed` (never throws). Reload freshness: server page refetches on navigation + revalidatePath invalidates the /settings cache. 7-case security matrix green (38/38 in the 4 suite run). |
| 5 | The model pickers show only models the app can actually run — the allowlist ∩ committed snapshot, never the raw opencode catalog rows | ✓ VERIFIED | `page.tsx:46` `getAllowlistedServableIds(catalogJson)` (allowlist ∩ snapshot, server-side); `page.tsx:47-55` maps to `{ id, name, costInput, costOutput }` filtering `providerID === 'anthropic'` (dual opencode/anthropic entries — provider filter load-bearing); `catalog.ts:43-47` filters `providerID === 'anthropic' && status !== 'deprecated'` before allowlist intersection. Live spot-check against the real committed snapshot: `getAllowlistedServableIds` logic → `["claude-sonnet-4-6"]` (sonnet anthropic entry active, cost `{input: 3, output: 15}`, generatedAt 2026-08-02T09:33:54.568Z). Client form receives `servableModels` props only — zero catalog imports in client code (grep-gated). |

**Score:** 5/5 truths verified

### Deferred Items

Items not yet met but explicitly addressed in later milestone phases.

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | Live-browser verification of the settings form UI (empty-state rendering, cost-captioned pickers, fallback add/remove/reorder, Save → "Saved." + persisted reload) | Phase 18 VER-03 | Plan 17-03 verification: `<human-check> end-of-phase (deferred to Phase 18 VER-03): start npm run dev, sign in with a staff Clerk account, visit /settings ...`; Phase 18 SC: "live-browser UAT proves the settings→Analyze→audit loop end-to-end" |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/lib/nav.ts` | NavKey + getActiveNavKey cover 'settings' | ✓ VERIFIED | Line 6 union + line 16 exact-match; `startsWith('/settings/')` absent |
| `src/lib/sidebar-collapse.ts` | Tooltip label map 'settings' → 'Settings' | ✓ VERIFIED | Line 16; reviews branch untouched |
| `src/components/layout/app-sidebar.tsx` | Manage-group Settings item below Reviews, no badge | ✓ VERIFIED | Lines 200-212; className verbatim from Reviews item; href "/settings" |
| `src/app/companies/page.tsx` | ExplorerMenu items include Settings | ✓ VERIFIED | Line 32 |
| `src/app/personas/page.tsx` | ExplorerMenu items include Settings | ✓ VERIFIED | Line 30 |
| `src/lib/models/catalog.ts` | Roster-verified ANTHROPIC_ALLOWLIST | ✓ VERIFIED | Line 13 `['claude-sonnet-4-6']` per D-01 2026-08-02 verdict (undated haiku absent); roster-check comment lines 6-12 updated; no dated/invented IDs |
| `src/app/actions/settings.ts` | saveSettingsAction controller | ✓ VERIFIED | Gate → zod → servable-set → dedupe → atomic upsert → revalidate; never throws |
| `src/app/actions/settings.test.ts` | 7-case security matrix | ✓ VERIFIED | All 7 behaviors present; zero live calls (vi.mock registry); green in run |
| `src/app/(dashboard)/settings/page.tsx` | Server page (Reviews pattern) | ✓ VERIFIED | requireStaffAccess first; error card; servable models from allowlist ∩ snapshot; defaultPrimary + saved props |
| `src/components/settings/model-settings-form.tsx` | Client form with draft state, pickers, save lifecycle | ✓ VERIFIED | Empty state; D-08/D-09 option filtering; D-02-gated fallback section; stale gates (D-10/D-11); three-code ERROR_COPY; zero catalog imports |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| app-sidebar.tsx | nav.ts | `activeKey === 'settings'` | ✓ WIRED | Line 203 |
| app-sidebar.tsx | sidebar-collapse.ts | `getNavTooltipLabel('settings', pendingCount)` | ✓ WIRED | Line 204 |
| companies/personas pages | explorer-menu.tsx | `{ label: 'Settings', href: '/settings' }` items prop | ✓ WIRED | Both pages pass a 2-entry items array |
| settings.ts (action) | requireStaffAccess.ts | `await requireStaffAccess()` first statement | ✓ WIRED | Line 34; invocation-order pinned by test |
| settings.ts (action) | userModelSettings.ts | `upsertModelSettings({ userId, primaryModel, fallbackModels })` | ✓ WIRED | Line 56-60; exact args asserted in test |
| settings.ts (action) | catalog.ts | `getAllowlistedServableIds(catalogJson)` | ✓ WIRED | Line 40; real committed snapshot (value import) |
| settings/page.tsx | userModelSettings.ts | `getModelSettingsForUser(userId)` | ✓ WIRED | Page line 23; real DB query |
| settings/page.tsx | catalog.ts + catalog.json | `getAllowlistedServableIds(catalogJson)` + costs | ✓ WIRED | Page lines 46-55; anthropic entries verified live |
| model-settings-form.tsx | actions/settings.ts | `saveSettingsAction({ primaryModel, fallbacks })` in useTransition | ✓ WIRED | Form lines 63-82 |
| model-settings-form.tsx | explorer-format.tsx | `dateFormatter` for Catalog synced footer | ✓ WIRED | Form line 14, 318 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| settings/page.tsx | `settings` (saved config) | `getModelSettingsForUser(userId)` → `db.query.userModelSettings.findFirst` | ✓ real DB query; absence = undefined (REG-05, not an error) | ✓ FLOWING |
| settings/page.tsx | `servableModels` | `getAllowlistedServableIds(catalogJson)` ∩ anthropic entries | ✓ Live spot-check: `["claude-sonnet-4-6"]` with cost `{input: 3, output: 15}` from committed snapshot | ✓ FLOWING |
| model-settings-form.tsx | `primary`/`fallbacks` draft | Props from server page + local edits | ✓ Draft mirrors saved row at mount; persisted via action → atomic upsert | ✓ FLOWING |
| model-settings-form.tsx | Save lifecycle | `saveSettingsAction` → `upsertModelSettings` | ✓ Real DB write; revalidatePath keeps reload fresh | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Nav/sidebar/tooltip 'settings' cases green | `npx vitest run src/lib/nav.test.ts src/lib/sidebar-collapse.test.ts` | 18 passed | ✓ PASS |
| Action security matrix + allowlist gate green | `npx vitest run src/app/actions/settings.test.ts src/lib/models/catalog.test.ts` | 20 passed (7 action + catalog) | ✓ PASS |
| Servable set = allowlist ∩ snapshot against real snapshot | node repro of `getAllowlistedServableIds` | `["claude-sonnet-4-6"]` — sonnet anthropic entry active | ✓ PASS |
| /settings route built | `.next/server/app/(dashboard)/settings/page/*` artifacts | Present (page.js, manifests) | ✓ PASS |
| Client bundle gate | `grep -rn "lib/models/catalog" src/components/settings/ src/app/(dashboard)/settings/` | Only the server page's legitimate imports | ✓ PASS |

### Probe Execution

Step 7c: SKIPPED — phase declares no probes (`probe-*.sh`); the declared verification is Vitest + tsc + grep gates, all executed above.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| SET-01 | 17-01 | Settings menu item in ExplorerMenu + sidebar nav | ✓ SATISFIED | nav.ts union + exact-match; sidebar item; both ExplorerMenu entries; 4 new Vitest cases |
| SET-02 | 17-03 | Page shows current config + ordered fallback list | ✓ SATISFIED | page.tsx fetch → saved prop; form renders draft; empty state when null |
| SET-03 | 17-03 | Set primary from runnable (allowlist) list | ✓ SATISFIED | Primary picker over `servableModels` only |
| SET-04 | 17-03 | Add up to 2 ordered fallbacks; empty list allowed | ✓ SATISFIED | addFallback cap 2; empty rows filtered pre-send; sonnet-only note |
| SET-05 | 17-03 | Remove/reorder fallbacks (ordered chain) | ✓ SATISFIED | moveFallback/removeFallback on draft; up/down disabled at bounds |
| SET-06 | 17-02 + 17-03 | Immediate validated persistence via Server Action; reload reflects state | ✓ SATISFIED | saveSettingsAction (gate→zod→servable→dedupe→upsert→revalidate); 7-case matrix; page refetches + revalidatePath |
| SET-07 | 17-02 + 17-03 | Pickers show only allowlist ∩ snapshot | ✓ SATISFIED | getAllowlistedServableIds server-side; live spot-check `["claude-sonnet-4-6"]`; no raw catalog rows reach the client |

All 7 SET-* IDs are claimed by the 3 plans (17-01: SET-01; 17-02: SET-06/07; 17-03: SET-02..06) and all 7 appear in `.planning/REQUIREMENTS.md` mapped to Phase 17 with status Complete. No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | Debt markers (TBD/FIXME/XXX/TODO/PLACEHOLDER/coming soon) | none | No matches in any phase file |
| — | — | Empty implementations / hardcoded empty data | none | No stub returns; `saved === null` is the designed empty state; `?? 0` cost guard is defensive (anthropic entry verified present for allowlisted id) |

**Carried review findings (advisory, 0 critical — from 17-REVIEW.md, not blockers):**
- WR-01: `handleSave` (form:63-82) has no try/catch — a rejection of `saveSettingsAction` before the action's internal try (e.g. Clerk `auth()` failure in `requireStaffAccess()` at settings.ts:34) would leave `status` in `'saving'` with no error. The action's own `catch` covers all throws inside its try; this is a transport/auth-level edge case. Advisory.
- WR-02: after a successful save, editing any picker does not reset `status` from `'saved'` — "Saved." persists until the next Save. Cosmetic copy-state issue, draft still only persists on Save click. Advisory.
- IN-01: happy-path test uses a production-impossible fallback (mocked 2-model servable set vs. real sonnet-only set). Informational; the real sonnet-only happy path is exercised by the form's muted-note branch and the live servable spot-check.
- IN-02/IN-03: timezone rendering of the Catalog-synced date, and empty-row SelectItem missing-value dev warning. Informational, nil functional impact.

### Human Verification Required

None blocking — the interactive settings-form UI check (empty state, cost captions, add/remove/reorder, Save → "Saved." + reload persistence) is explicitly deferred by plan 17-03 to Phase 18 VER-03 (live-browser settings→Analyze→model_used UAT). It is recorded in the `deferred` section and is a Phase 18 responsibility, per the plan's explicit `<human-check>` deferral.

### Gaps Summary

No gaps. All 5 roadmap success criteria are verifiably true in the codebase: the nav surfaces reach `/settings` (SC1), the page reads and renders the saved configuration with a designed empty state (SC2), the form stages a draft primary + up-to-2 ordered fallback chain with add/remove/reorder and empty-list save (SC3), persistence runs through the gate-first → zod → servable-set → dedupe → atomic-upsert Server Action with reload freshness (SC4), and the pickers are fed exclusively from the allowlist ∩ committed snapshot (SC5) — confirmed by a live spot-check against the real catalog.json. The 7-case action security matrix and nav/tooltip suites pass (38/38), tsc/build were clean per prior gates (route table includes /settings), no debt markers exist, and all SET-01..07 requirements are satisfied and traceable.

---

_Verified: 2026-08-02T16:41:00Z_
_Verifier: Claude (gsd-verifier)_
