---
phase: 06
slug: shared-menu-component-start-page
status: audited
threats_open: 0
asvs_level: 1
created: 2026-07-30
---

# Phase 06 — Shared Menu Component + Start Page — Security Audit

**Audit type:** From-scratch (State B — no prior SECURITY.md for this phase)
**Plans covered:** 06-01, 06-02, 06-03, 06-04 (all `register_authored_at_plan_time: true`)
**ASVS Level:** 1
**Block on:** high
**Scope:** Verification of declared threat mitigations only — no new-threat scan performed, per phase config. Also re-verified data-scoping guarantees after the post-register patch `f00a43a7` (CR-01/CR-02/CR-03 try/catch hardening).

## Threat Verification

| Threat ID | Category | Component | Disposition | Status | Evidence |
|-----------|----------|-----------|-------------|--------|----------|
| T-06-01 | Spoofing / Tampering | `recordView` Server Action | mitigate | **CLOSED** | `src/app/actions.ts:20-23` — `export async function recordView(recordType: 'company' \| 'persona', recordId: number)` has exactly two parameters (no `userId`); `const { userId } = await requireStaffAccess();` is the only source of `userId` passed into `recordViewQuery({ userId, recordType, recordId })`. A direct caller cannot supply `userId`. |
| T-06-02 | Elevation of Privilege | `recordView` Server Action, unauthenticated caller | mitigate | **CLOSED** | `src/app/actions.ts:21-22` — `requireStaffAccess()` is called and awaited (line 21) strictly before `recordViewQuery(...)` (line 22); no DB access precedes it in the function body. |
| T-06-03 | Tampering | `stats.ts` dashboard queries — SQL injection | mitigate | **CLOSED** | `src/lib/db/queries/stats.ts:1` imports only `and, count, desc, eq, exists, gte, not, sql` from `drizzle-orm`. The one `sql` usage (`sql\`1\``, lines 38/45) is a literal placeholder inside an `exists()` subquery, not interpolated user input. All filter legs use `eq()`/`gte()`/`exists()`/`not()`. No `sql.raw()` or template-interpolated user value anywhere in the file. |
| T-06-04 | Information Disclosure | `recordType` param on `recordView`, no DB-level constraint verification | accept | **CLOSED** | Rationale reproduced in Accepted Risks Log below; also independently confirmed: `src/app/actions.ts:20` types `recordType: 'company' \| 'persona'` (TS union) and `src/lib/db/schema.ts:103` defines `recordTypeEnum = pgEnum('record_type', ['company', 'persona'])` on the `recentlyViewed.recordType` column (schema.ts:111) as defense in depth. |
| T-06-05 | Tampering | `AppShellLayout` extraction dropping `requireStaffAccess()` from a route layout | mitigate | **CLOSED** | `grep -c requireStaffAccess src/components/layout/app-shell-layout.tsx` = 0 (confirmed by direct read — the component's own comment states auth is deliberately not checked there). `src/app/companies/layout.tsx:9` and `src/app/personas/layout.tsx:9` each call `await requireStaffAccess();` before rendering `<AppShellLayout>`. |
| T-06-06 | Information Disclosure | Menu dropdown items visibility | accept | **CLOSED** | Rationale reproduced in Accepted Risks Log below; confirmed `src/components/explorer/explorer-menu.tsx` renders `DropdownMenuItem disabled={item.disabled}` and both callers (`company-detail.tsx:62`, `persona-detail.tsx:67`) pass `{ label: 'Analyze', disabled: true }` — no action fires, no data path exists behind these items. |
| T-06-07 | Tampering / Information Disclosure | `RecordViewTracker` mount timing | mitigate | **CLOSED** | `src/components/companies/company-detail.tsx:45-60` — `if (!company) { notFound(); }` (line 45-47) appears strictly before `<RecordViewTracker recordType="company" recordId={company.id} />` (line 60). `src/components/personas/persona-detail.tsx:47-65` — identical ordering (`notFound()` at 47-49, tracker at 65). Both use the confirmed (non-null, post-guard) `.id`. |
| T-06-08 | Denial of Service (minor) | `recordView` repeated calls | accept | **CLOSED** | Rationale reproduced in Accepted Risks Log below; confirmed `src/lib/db/queries/recentlyViewed.ts:14-22` is a single `db.insert(...).onConflictDoUpdate(...)` call (one parameterized upsert, no loop/batch), and `src/components/dashboard/record-view-tracker.tsx:20` calls it fire-and-forget with an empty `.catch(() => {})`. |
| T-06-09 | Information Disclosure | Disabled Menu items on list pages | accept | **CLOSED** | Rationale reproduced in Accepted Risks Log below; confirmed `src/app/companies/page.tsx:28` and `src/app/personas/page.tsx:26` both pass `items={[{ label: 'Import', disabled: true }]}` to `ExplorerMenu`. |
| T-06-10 | Elevation of Privilege / Information Disclosure | `/` route (dashboard) | mitigate | **CLOSED** | `src/app/(dashboard)/layout.tsx:9` and `src/app/(dashboard)/page.tsx:14` both call `await requireStaffAccess();` — belt-and-suspenders, matching every other route in the app. `src/app/page.tsx` no longer exists (confirmed absent), so the app's one prior anonymous-access exception is fully closed. |
| T-06-11 | Tampering | 5 dashboard widget queries | mitigate | **CLOSED** | `src/lib/db/queries/stats.ts` (all 4 functions) and `src/lib/db/queries/recentlyViewed.ts` (`listRecentlyViewedForUser`) use only Drizzle's parameterized builder (`eq`, `gte`, `exists`, `count`, `desc`) — no raw SQL string interpolation in either file. |
| T-06-12 | Information Disclosure | `RecentlyViewed` widget cross-user leak | mitigate | **CLOSED** | `src/components/dashboard/recently-viewed.tsx:21,25` — `const { userId } = await requireStaffAccess();` then `listRecentlyViewedForUser(userId, 5)`; `userId` is never taken from a route param, query string, or prop. Re-verified against post-register patch `f00a43a7`: that commit only wrapped the *second* `Promise.all` (name-resolution via `getCompanyById`/`getPersonaById`) in its own try/catch — it did not touch the `userId`-scoped `listRecentlyViewedForUser` call or its inputs, so T-06-12's scoping guarantee is undisturbed. |

**Totals: 12/12 threats closed (8 mitigate — all verified present in code; 4 accept — all have a recorded, reproduced rationale).**

## Accepted Risks Log

The following threats carry an `accept` disposition. Each is reproduced here as the durable accepted-risk record for this phase (previously only living in `06-01-PLAN.md`/`06-02-PLAN.md`/`06-03-PLAN.md` threat-model blocks):

1. **T-06-04** — `recordType` accepted by `recordView` has no DB-level constraint verification beyond the TypeScript union at the call boundary. Accepted because the `recordTypeEnum` Postgres enum column (`src/lib/db/schema.ts:103,111`) additionally rejects any out-of-range value as defense in depth, and a nonexistent `recordId` merely produces an orphaned tracking row (no cross-tenant or auth impact) — not a security issue.
2. **T-06-06** — Menu dropdown items (Analyze/Import) are visible to any signed-in staff user with no distinction. Accepted because both items are inert `disabled` placeholders this phase (`src/components/explorer/explorer-menu.tsx`) — no action fires, no data is exposed — and matches the project's existing "any authenticated Clerk user = full access" model (no roles/scopes exist in Milestone 1).
3. **T-06-08** — `recordView` may be fired repeatedly by rapid detail-panel open/close/reopen. Accepted because each call is a single parameterized `onConflictDoUpdate` upsert, fire-and-forget with an empty catch (`src/components/dashboard/record-view-tracker.tsx:20`) — worst case is redundant `viewedAt` updates, not a correctness or availability issue at this record volume.
4. **T-06-09** — Disabled Menu items (Import) on the Company/Persona list pages are visible to any signed-in user. Accepted for the same reason as T-06-06 — inert placeholders, no functional access granted, matches the project-wide access model.

**Re-evaluate all four** when Import/Analyze become functional (Phase 7 CSV import, Phase 9 analytic agent per `06-02-SUMMARY.md`'s `affects` list) — at that point each will need its own STRIDE entry addressing the newly-live action, not just the visibility of a disabled button.

## Non-Blocking Observation (not a threat-model gap)

- **Post-register hardening commit `f00a43a7`** (`fix(06): guard remaining unhandled dashboard fetches`) wrapped previously-unguarded secondary fetches in `StartPage`, `NeedsAttention`, and `RecentlyViewed` in their own try/catch, per `06-REVIEW.md`/`06-VERIFICATION.md` findings (CR-01/CR-02/CR-03). This was an availability/error-handling fix, not a security mitigation — confirmed it does not alter T-06-11 (all affected queries remain Drizzle-parameterized) or T-06-12 (the `userId`-scoping call itself, `listRecentlyViewedForUser(userId, 5)`, was already guarded pre-patch and is untouched by this diff — only the downstream name-resolution `Promise.all` gained its own catch block).
- `isSafeUrl()` scheme-allowlist guard in `src/components/personas/persona-detail.tsx` (pre-dates this phase — added in Phase 05 commit `48bf2ab2`, tracked as accepted risk T-3-09 in `03-SECURITY.md`) was not modified by any Phase 06 plan; confirmed via `git log` that Phase 06's only touch to this file (`85784fd3`) added `ExplorerMenu`/`RecordViewTracker`, not the URL-rendering logic. Not re-flagged here as it is out of this phase's scope.

## Unregistered Flags

None. No `06-0X-SUMMARY.md` contains a `## Threat Flags` section (confirmed via grep across all four summaries) — the executor found no new attack surface to flag in any of the four plans, and independent review of the implemented files (dropdown-menu.tsx vendored primitive, app-sidebar.tsx nav item, dashboard widget components) surfaced no additional trust-boundary crossings beyond those already covered by T-06-01 through T-06-12.

## Verification Method Notes

- All `mitigate` threats verified by direct read/grep of the cited implementation files against the exact pattern named in each PLAN.md's Mitigation Plan column — not inferred from SUMMARY.md prose.
- All `accept` threats verified by confirming a durable rationale exists (now consolidated into this SECURITY.md's Accepted Risks Log, previously scattered across 3 separate PLAN.md files).
- T-06-12 additionally cross-checked against the post-register patch (`f00a43a7`) called out in the audit constraints, to confirm the availability fix did not silently alter the `userId`-scoping call.
- Implementation files were read-only for this audit; no source file was modified.

## Security Audit 2026-07-30

| Metric | Count |
|--------|-------|
| Threats found | 12 |
| Closed | 12 |
| Open | 0 |
