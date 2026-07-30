---
phase: 06-shared-menu-component-start-page
reviewed: 2026-07-30T00:00:00Z
depth: standard
files_reviewed: 22
files_reviewed_list:
  - src/app/(dashboard)/layout.tsx
  - src/app/(dashboard)/page.tsx
  - src/app/actions.ts
  - src/app/companies/layout.tsx
  - src/app/companies/page.tsx
  - src/app/personas/layout.tsx
  - src/app/personas/page.tsx
  - src/components/companies/company-detail.tsx
  - src/components/dashboard/needs-attention.tsx
  - src/components/dashboard/recent-signals.tsx
  - src/components/dashboard/recently-viewed.tsx
  - src/components/dashboard/record-view-tracker.tsx
  - src/components/dashboard/signal-breakdown.tsx
  - src/components/dashboard/stat-card.tsx
  - src/components/explorer/explorer-menu.tsx
  - src/components/explorer/explorer-table-behavior.tsx
  - src/components/layout/app-shell-layout.tsx
  - src/components/layout/app-sidebar.tsx
  - src/components/personas/persona-detail.tsx
  - src/components/ui/dropdown-menu.tsx
  - src/lib/db/queries/recentlyViewed.ts
  - src/lib/db/queries/stats.ts
  - src/lib/db/schema.ts
findings:
  critical: 3
  warning: 3
  info: 2
  total: 8
status: issues_found
---

# Phase 06: Code Review Report

**Reviewed:** 2026-07-30T00:00:00Z
**Depth:** standard
**Files Reviewed:** 22
**Status:** issues_found

## Summary

Reviewed the Shared Menu Component + Start Page phase: the new `AppShellLayout`/`ExplorerMenu` extraction, the four Start Page dashboard widgets, the `recentlyViewed` table + queries, and the `recordView` Server Action.

The layout extraction (`AppShellLayout`, `AppSidebar`, `ExplorerMenu`) is clean and matches the stated de-duplication goal (`companies/layout.tsx` and `personas/layout.tsx` now delegate to one shared component; verified via diff). `RecordViewTracker`'s fire-and-forget `.catch(() => {})` correctly follows the codebase's "never surface, never block" convention for non-critical telemetry, and `requireStaffAccess()` is correctly re-derived server-side (not passed from the client) in the `recordView` action so a caller cannot spoof another user's row.

However, the phase's own repeatedly-stated design invariant — "this widget's own try/catch is fully independent of the other ... widgets; a failure here must never blank the rest of the page" — is only partially implemented. Three separate places perform an *additional*, un-guarded async DB call after the widget's initial try/catch succeeds, and none of them have any error.tsx/error boundary anywhere in `src/app` as a backstop. That gap is the core of the Critical findings below. There are also secondary robustness/consistency issues around the un-validated `recordView` Server Action and a stray relative-import style in `actions.ts`.

## Critical Issues

### CR-01: Start Page crashes entirely on any dashboard-stats query failure

**File:** `src/app/(dashboard)/page.tsx:18`
**Issue:** `getDashboardCounts()` is awaited with no `try/catch`, unlike every other DB-touching component added in this phase (`RecentSignals`, `RecentlyViewed`, `NeedsAttention`, `SignalBreakdown`, and pre-existing `CompanyDetail`/`PersonaDetail`/`CompanyList`), all of which wrap their fetch in `try { ... } catch { return <fallback-card/> }`. `getDashboardCounts()` itself (`src/lib/db/queries/stats.ts:5-12`) runs 3 unguarded `Promise.all` queries and will reject on any transient DB error. Since there is no `error.tsx`/`global-error.tsx` anywhere under `src/app` (verified: none exist), a single failed count query throws during Server Component render and takes down the *entire* Start Page — the stat cards, and (because they're all in one synchronous return) the four widgets below them too — via Next.js's default error page. This directly contradicts the "fail safe, fail toward known-good UI" pattern this exact diff establishes everywhere else.
**Fix:**
```tsx
// src/app/(dashboard)/page.tsx
let counts: Awaited<ReturnType<typeof getDashboardCounts>> = { companies: 0, personas: 0, signals: 0 };
try {
  counts = await getDashboardCounts();
} catch {
  // render a small inline "counts unavailable" state instead of throwing
}
```

### CR-02: `NeedsAttention`'s per-company signal lookup is not covered by its own error boundary

**File:** `src/components/dashboard/needs-attention.tsx:41-49`
**Issue:** The widget wraps its initial `listNeedsAttention(14)` call in `try/catch` (lines 11-24), but the subsequent `Promise.all(companies.map(async (company) => { const signals = await listSignalsForCompany(company.id); ... }))` is *not* inside that try/catch (or any other). If `listSignalsForCompany` throws for even one company (transient DB blip, connection drop), the whole async component function throws unhandled. As in CR-01, there is no error boundary anywhere in `src/app`, so this crashes the whole Start Page rather than degrading to this widget's own error card — violating the comment on line 6-8 of this same file ("a failure here must never blank the rest of the page").
**Fix:**
```tsx
let rowsWithHighSignals: { company: typeof companies[number]; highStrengthTypes: string[] }[];
try {
  rowsWithHighSignals = await Promise.all(
    companies.map(async (company) => {
      const signals = await listSignalsForCompany(company.id);
      const highStrengthTypes = Array.from(
        new Set(signals.filter((s) => s.strength === 'high').map((s) => s.signalType))
      );
      return { company, highStrengthTypes };
    })
  );
} catch {
  return (/* same fallback error card as above */);
}
```

### CR-03: `RecentlyViewed`'s name-resolution lookup is not covered by its own error boundary

**File:** `src/components/dashboard/recently-viewed.tsx:55-63`
**Issue:** Same pattern as CR-02. The initial `listRecentlyViewedForUser(userId, 5)` call is guarded (lines 24-37), but the follow-up `Promise.all(rows.map(async (row) => { const name = row.recordType === 'company' ? (await getCompanyById(...))?.name : (await getPersonaById(...))?.name; ... }))` is not. Any failure in `getCompanyById`/`getPersonaById` throws unhandled and — with no `error.tsx` in the app — crashes the entire Start Page instead of this one widget.
**Fix:** Wrap the second `Promise.all` in its own `try/catch` returning the widget's existing fallback card, mirroring the guard already used for the first query.

## Warnings

### WR-01: `recordView` Server Action has no runtime validation of its inputs

**File:** `src/app/actions.ts:20-23`
**Issue:** `recordType` and `recordId` are typed as `'company' | 'persona'` and `number` respectively, but Next.js Server Actions are exposed as callable POST endpoints independent of the TypeScript signature — a client can invoke the action directly with an arbitrary payload, bypassing the compile-time type. There is no runtime check that `recordType` is actually one of the two enum values or that `recordId` is a positive integer before it reaches `recordViewQuery` (`src/lib/db/queries/recentlyViewed.ts:14-22`), which performs a raw `db.insert(...).values({ userId, recordType, recordId })`. An invalid `recordType` will surface as an unhandled Postgres enum-violation error at the action boundary (no logging, no graceful message), and an invalid/negative `recordId` will silently insert a garbage `recentlyViewed` row for that user (feeding into `listNeedsAttention`'s "not reviewed" logic with a value that can never match a real company).
**Fix:**
```ts
export async function recordView(recordType: 'company' | 'persona', recordId: number) {
  const { userId } = await requireStaffAccess();
  if (!Number.isInteger(recordId) || recordId <= 0) return;
  if (recordType !== 'company' && recordType !== 'persona') return;
  await recordViewQuery({ userId, recordType, recordId });
}
```

### WR-02: `src/app/actions.ts` breaks the established `@/` import-alias convention

**File:** `src/app/actions.ts:3-5`
**Issue:** Every other file touched in this phase (`(dashboard)/page.tsx`, `companies/layout.tsx`, `companies/page.tsx`, `personas/*`, all `components/*`) imports via the `@/*` path alias (`@/lib/auth/requireStaffAccess`, `@/lib/db/queries/companies`, etc.). `actions.ts` alone uses relative paths (`../lib/auth/requireStaffAccess`, `../lib/db/queries/companies`, `../lib/db/queries/recentlyViewed`). This is a one-off inconsistency that will silently break (wrong relative depth) if this file is ever moved, and makes the codebase's import style non-uniform for no functional reason.
**Fix:** Use the alias consistently:
```ts
import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { listCompanies } from '@/lib/db/queries/companies';
import { recordView as recordViewQuery } from '@/lib/db/queries/recentlyViewed';
```

### WR-03: "Needs attention" threshold (14 days) is duplicated as a magic number in two places

**File:** `src/lib/db/queries/stats.ts:28`, `src/components/dashboard/needs-attention.tsx:12`
**Issue:** `listNeedsAttention(notReviewedDays = 14)` declares a default of `14`, but the caller in `NeedsAttention` also hardcodes `listNeedsAttention(14)` explicitly, defeating the purpose of the default and creating two places that must be kept in sync if the threshold ever changes.
**Fix:** Export a single named constant (e.g. `NEEDS_ATTENTION_DAYS = 14`) from `stats.ts` and use it both as the default and at the call site, or simply drop the explicit `14` argument at the call site and rely on the function's own default.

## Info

### IN-01: `{ label: 'Import', disabled: true }` menu item duplicated verbatim across two pages

**File:** `src/app/companies/page.tsx:28`, `src/app/personas/page.tsx:26`
**Issue:** Both pages construct the identical inline array `[{ label: 'Import', disabled: true }]` for `ExplorerMenu`. Minor duplication; low risk since both call sites are meant to stay in sync (same placeholder feature), but if `ExplorerMenu`'s reuse story is meant to be a single shared investment (per its own header comment), the item list is an easy candidate to lift into a shared constant too.
**Fix:** Optional — extract `const IMPORT_MENU_ITEMS = [{ label: 'Import', disabled: true }] as const;` to a shared module if a third caller is added.

### IN-02: `RecordViewTracker` fires on every mount without de-duplicating rapid re-selections

**File:** `src/components/dashboard/record-view-tracker.tsx:19-21`
**Issue:** Not a functional bug (the DB write is an idempotent upsert), but worth noting: because the detail panel remounts on every row selection, quickly arrow-keying through several rows will fire one Server Action call per row even for rows the user only glanced at. Purely a minor efficiency/telemetry-accuracy note, not a correctness issue.
**Fix:** No action required; flagging for awareness only.

---

_Reviewed: 2026-07-30T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
