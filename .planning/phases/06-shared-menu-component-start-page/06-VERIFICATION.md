---
phase: 06-shared-menu-component-start-page
verified: 2026-07-30T14:05:00Z
status: passed
score: 15/15 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 14/15
  gaps_closed:
    - "Each of the four dashboard widgets fails independently on its own fetch error — one widget's failure never blanks the other three"
  gaps_remaining: []
  regressions: []
---

# Phase 6: Shared Menu Component + Start Page Verification Report

**Phase Goal:** Staff land on a dashboard that shows pipeline health at a glance, and both explorers gain a shared "Menu" affordance ready to host the Import and Analyze actions built in later phases.
**Verified:** 2026-07-30T14:05:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure (commit `f00a43a7`)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Visiting `/` (signed in) shows the Start Page dashboard (3 stat cards, recent signals, recently viewed, needs attention, signal breakdown) — not the old status page | VERIFIED (regression check) | `src/app/(dashboard)/page.tsx` still renders all 5 sections; `src/app/page.tsx` confirmed absent; `npm run build` shows `/` as a route, no duplicate-route error |
| 2 | Visiting `/` (signed out) redirects to `/sign-in`, same as every other protected route | VERIFIED (regression check) | `requireStaffAccess()` still gates the layout/page; no change to auth path in this fix commit |
| 3 | Recent-signals list, newest first, each linked to its Company | VERIFIED (regression check) | `recent-signals.tsx` unchanged by fix commit; previously confirmed `desc(signal.detectedAt)` + `Link` to `/companies?selected=` |
| 4 | Recently-viewed list of Companies/Personas the current user opened, server-tracked, cross-device | VERIFIED (regression check) | `recentlyViewed` table, `recordView` Server Action, `RecentlyViewed` widget's primary fetch path unchanged |
| 5 | "Needs attention" section — Companies with high-strength signals not recently reviewed | VERIFIED (regression check) | `listNeedsAttention` query and initial-fetch guard unchanged |
| 6 | Signal-type breakdown widget covering the 4 named signal types | VERIFIED (regression check) | `signal-breakdown.tsx` untouched by fix commit; zero-fill logic still present |
| 7 | Company and Persona list pages show a "Menu" dropdown button top-right containing an Import action | VERIFIED (regression check) | `grep` confirms `<ExplorerMenu variant="labeled" items={[{ label: 'Import', disabled: true }]} />` present in both `companies/page.tsx` and `personas/page.tsx` |
| 8 | Company and Persona detail panels show a "Menu" dropdown button top-right containing an Analyze action | VERIFIED (regression check) | `<ExplorerMenu variant="icon" items={[{ label: 'Analyze', disabled: true }]} />` present in both `company-detail.tsx` and `persona-detail.tsx` |
| 9 | `recently_viewed` table upserts on repeat views instead of duplicating rows | VERIFIED (regression check) | `unique('recently_viewed_user_record_unique')` in `schema.ts`, `onConflictDoUpdate` in `recentlyViewed.ts` — both unchanged |
| 10 | Dashboard aggregate data fetchable via dedicated, parameterized query functions | VERIFIED (regression check) | `stats.ts` exports unchanged by fix commit |
| 11 | `recordView` Server Action always derives `userId` server-side, never a client-supplied argument | VERIFIED (regression check) | `actions.ts` untouched by fix commit; 2-param signature confirmed still in place |
| 12 | `companies/layout.tsx`/`personas/layout.tsx` no longer duplicate the sidebar shell — both delegate to shared `AppShellLayout` | VERIFIED (regression check) | Both files confirmed still delegating to `<AppShellLayout>` |
| 13 | Shared `ExplorerMenu` (shadcn dropdown-menu) reused by both list-page (labeled) and detail-panel (icon) placements | VERIFIED (regression check) | Single component, `variant` prop, confirmed used in all 4 call sites |
| 14 | Sidebar shows "Start" nav item above Companies/Key Personas, highlighted only when pathname is exactly `/` | VERIFIED (regression check) | `app-sidebar.tsx`: `isActive={pathname === '/'}` still exact equality |
| 15 | Each of the four dashboard widgets fails independently on its own fetch error — one widget's failure never blanks the other three | **VERIFIED** | Fix commit `f00a43a7` wraps all 3 previously-unguarded call sites: `(dashboard)/page.tsx` line 21-25 now `try { counts = await getDashboardCounts(); } catch { counts = null; }` with `StatCard` rendering `'—'` fallback per stat (StatCard's `value` prop widened to `number \| string`); `needs-attention.tsx` lines 44-65 now wrap the per-company `Promise.all(listSignalsForCompany...)` in try/catch returning the widget's existing "Couldn't load needs attention" fallback card; `recently-viewed.tsx` lines 58-79 now wrap the per-row `Promise.all(getCompanyById/getPersonaById...)` in try/catch returning the widget's existing "Couldn't load recently viewed" fallback card. Read all 3 files directly — confirmed by code reading, not just diff stat. Every async data-fetch in the Start Page render path is now individually guarded; no single widget's failure can propagate past its own boundary. `npx tsc --noEmit` and `npm run build` both pass cleanly post-fix. |

**Score:** 15/15 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/db/schema.ts` | `recentlyViewed` table + `recordTypeEnum` | VERIFIED | Unchanged, still present |
| `src/lib/db/queries/stats.ts` | 4 dashboard aggregate queries | VERIFIED | Unchanged, still present |
| `src/lib/db/queries/recentlyViewed.ts` | upsert + list queries | VERIFIED | Unchanged, still present |
| `src/app/actions.ts` | `recordView` Server Action | VERIFIED | Unchanged, still present |
| `src/components/layout/app-shell-layout.tsx` | shared sidebar shell | VERIFIED | Unchanged |
| `src/components/ui/dropdown-menu.tsx` | vendored Radix primitive | VERIFIED | Unchanged |
| `src/components/explorer/explorer-menu.tsx` | shared Menu dropdown | VERIFIED | Unchanged |
| `src/components/dashboard/record-view-tracker.tsx` | mount-effect trigger | VERIFIED | Unchanged |
| `src/app/(dashboard)/page.tsx` | Start Page route | VERIFIED | `getDashboardCounts()` now guarded with try/catch, `counts` typed nullable, `StatCard` values fall back to `'—'` on failure |
| `src/app/(dashboard)/layout.tsx` | dashboard route group auth + shell | VERIFIED | Unchanged |
| `src/components/dashboard/stat-card.tsx` | `StatCard` | VERIFIED | `value` prop widened `number \| string` to accept `'—'` fallback |
| `src/components/dashboard/recent-signals.tsx` | `RecentSignals` | VERIFIED | Unchanged |
| `src/components/dashboard/recently-viewed.tsx` | `RecentlyViewed` | VERIFIED | Secondary `Promise.all` now guarded, returns existing error fallback card on failure |
| `src/components/dashboard/needs-attention.tsx` | `NeedsAttention` | VERIFIED | Secondary `Promise.all` now guarded, returns existing error fallback card on failure |
| `src/components/dashboard/signal-breakdown.tsx` | `SignalBreakdown` | VERIFIED | Unchanged |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `src/app/actions.ts` | `recentlyViewed.ts` | `recordViewQuery(...)` call | WIRED | Unchanged |
| `stats.ts` | `schema.ts` | table imports | WIRED | Unchanged |
| `recentlyViewed.ts` | `schema.ts` | table imports | WIRED | Unchanged |
| `companies/layout.tsx` / `personas/layout.tsx` | `app-shell-layout.tsx` | renders `<AppShellLayout>` | WIRED | Unchanged |
| `explorer-menu.tsx` | `dropdown-menu.tsx` | imports 4 primitives | WIRED | Unchanged |
| `company-detail.tsx` / `persona-detail.tsx` | `record-view-tracker.tsx` | renders after `notFound()` guard | WIRED | Unchanged |
| `record-view-tracker.tsx` | `src/app/actions.ts` | `useEffect` calls `recordView(...)` | WIRED | Unchanged |
| `companies/page.tsx` / `personas/page.tsx` | `explorer-menu.tsx` | `<ExplorerMenu variant="labeled">` | WIRED | Unchanged |
| `(dashboard)/page.tsx` | `stats.ts` | `getDashboardCounts()` | WIRED (now guarded) | Call now wrapped in try/catch, failure isolated to stat-card row |
| `recently-viewed.tsx` | `recentlyViewed.ts` | `listRecentlyViewedForUser(userId, 5)` | WIRED | Unchanged |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `RecentSignals` | `rows` | `listRecentSignals(5)` → real `innerJoin` query | Yes | FLOWING |
| `RecentlyViewed` | `rows` / `resolvedRows` | `listRecentlyViewedForUser` → real query; names resolved via `getCompanyById`/`getPersonaById`, both fetch stages now independently guarded | Yes | FLOWING |
| `NeedsAttention` | `companies` / `rowsWithHighSignals` | `listNeedsAttention(14)` → real EXISTS/NOT EXISTS query; `listSignalsForCompany` per row, both fetch stages now independently guarded | Yes | FLOWING |
| `SignalBreakdown` | `rows` | `getSignalTypeBreakdown()` → real `groupBy` query, zero-filled | Yes | FLOWING |
| `StatCard` x3 | `counts?.companies/personas/signals` | `getDashboardCounts()` → real `count()` queries, now guarded with `'—'` fallback on failure | Yes | FLOWING |

Data flows genuinely from Neon Postgres through to the rendered UI in all 5 widgets. Failure-isolation robustness (previously the sole open gap) is now closed at every call site.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| MENU-01 | 06-02, 06-03 | Company/Persona list pages have a Menu dropdown with Import | SATISFIED | Truths #7, #13 |
| MENU-02 | 06-02, 06-03 | Company/Persona detail panels have a Menu dropdown with Analyze | SATISFIED | Truths #8, #13 |
| START-01 | 06-01, 06-04 | Overview dashboard as landing page with 3 stat cards | SATISFIED | Truth #1 |
| START-02 | 06-01, 06-04 | Recent signals list, newest first, linked to Company | SATISFIED | Truth #3 |
| START-03 | 06-01, 06-03, 06-04 | Recently-viewed list, server-tracked, cross-device | SATISFIED | Truths #4, #9, #11 |
| START-04 | 06-01, 06-04 | "Needs attention" section | SATISFIED | Truth #5; secondary fetch now guarded (Truth #15) |
| START-05 | 06-01, 06-04 | Signal-type breakdown widget, 4 named types | SATISFIED | Truth #6 |

No orphaned requirements — REQUIREMENTS.md maps exactly MENU-01, MENU-02, START-01..05 to Phase 6, and all 7 appear in the `requirements:` frontmatter of one or more of the 4 plans. (Note: REQUIREMENTS.md's own status column still reads "Pending" for these rows — that column is a separate manual tracking artifact and is out of scope for this codebase-evidence verification; it does not affect the SATISFIED determination above, which is based on actual code.)

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/app/actions.ts` | 20-23 | No runtime validation of `recordType`/`recordId` on the `recordView` Server Action (TS-only enforcement) | ⚠️ Warning | Explicitly accepted in the 06-01 plan's own threat model (T-06-04, disposition: accept); not new, not a phase-goal blocker |
| `src/app/actions.ts` | 3-5 | Relative imports (`../lib/...`) instead of `@/*` alias | ℹ️ Info | Pre-existing style from before Phase 6, cosmetic only |
| `src/lib/db/queries/stats.ts` / `src/components/dashboard/needs-attention.tsx` | 28 / 12 | `notReviewedDays`/`14` magic number duplicated | ℹ️ Info | Minor DRY issue, no functional risk |

No blocker-level anti-patterns remain. The three previously-blocking unguarded fetches are now resolved.

### Human Verification Required

None outstanding as blockers to phase status. The following were already flagged in the prior verification pass as requiring live-session confirmation (interactive/visual behavior that grep/read cannot fully confirm) and remain open recommendations for a human pass before/after deploy, but do not block phase completion since all codebase-verifiable must-haves now pass:

### 1. Dropdown Menu Interactivity

**Test:** Click the "Menu" button on `/companies`, `/personas`, and on an open Company/Persona detail panel.
**Expected:** Dropdown opens showing "Import" (list pages) or "Analyze" (detail panels), rendered visibly disabled.
**Why human:** Radix dropdown open/close and disabled-item styling is a real-time client interaction.

### 2. Dashboard Visual Layout

**Test:** Sign in and visit `/`.
**Expected:** 3 stat cards in a row, then Recent Signals + Recently Viewed side-by-side, then Needs Attention + Signal Breakdown side-by-side, inside the same sidebar shell as `/companies`/`/personas`, with "Start" nav item highlighted only on this page.
**Why human:** Visual grid/spacing correctness requires eyes-on confirmation.

### 3. Recently-Viewed cross-device / cross-session consistency

**Test:** Open a Company detail panel, then check "Recently Viewed" in a different browser/session signed in as the same user.
**Expected:** Same Company appears in both sessions' lists.
**Why human:** Requires two real signed-in sessions to observe end-to-end.

These are advisory/visual-QA items only — status is `passed` because every must-have that can be verified against the codebase is now VERIFIED, and none of these three items were flagged as failing must-haves in the prior pass (they were listed for completeness, not as blockers).

### Gaps Summary

No gaps remain. The single failing truth from the initial verification pass — "each of the four dashboard widgets fails independently on its own fetch error" — is now closed by commit `f00a43a7`, which wraps all three previously-unguarded async call sites (`getDashboardCounts()` in `(dashboard)/page.tsx`, the per-company `Promise.all` in `needs-attention.tsx`, and the per-row `Promise.all` in `recently-viewed.tsx`) in try/catch blocks matching the fail-safe pattern already used by every other fetch in this phase's code. Verified by direct code reading of all three files (not diff stats or SUMMARY claims), confirmed `npx tsc --noEmit` and `npm run build` both pass cleanly, and confirmed no regression in the 14 previously-passing truths via targeted grep/read spot-checks. Phase goal is fully achieved: staff land on a dashboard showing pipeline health at a glance with fully independent widget failure isolation, and both explorers have a shared Menu affordance ready to host Import/Analyze.

---

_Verified: 2026-07-30T14:05:00Z_
_Verifier: Claude (gsd-verifier)_
