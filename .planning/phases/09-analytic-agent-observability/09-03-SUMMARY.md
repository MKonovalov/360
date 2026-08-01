---
phase: 09-analytic-agent-observability
plan: 03
subsystem: api
tags: [nextjs, app-router, route-handler, server-actions, zod, langfuse, shadcn, tdd, vitest]

# Dependency graph
requires:
  - phase: 09-analytic-agent-observability
    provides: 09-02 analyzeCompany orchestration + runs/proposals/corrections query modules (createRun/insertProposals/listPendingProposals/acceptProposal/rejectProposal/countPendingProposals) + langfuse telemetry
provides:
  - first Route Handler in the codebase: POST /api/companies/[id]/analyze — staff-gated, maxDuration=60, separate AI/DB try-catch domains with distinct fail-loud bodies (gate_failed/not_configured/analysis_failed/persist_failed)
  - reviews server actions: acceptProposalAction + rejectProposalAction (staff-gated, zod-validated reject reason, fail-loud envelope, revalidatePath)
  - /reviews review queue UI with inline evidence, per-card Accept/Reject state machine, View-trace link to Langfuse
  - live Menu Analyze slot (CustomEvent bridge) + AnalyzeRunStatus run-feedback strip with 4+ failure states
  - amber per-company pending badge + sidebar Reviews entry with global pending-count badge
affects: [end-of-phase verification / gsd-verify-work, future enrichment, milestone close]

# Tech tracking
tech-stack:
  added: [none - reused existing nextjs app-router, server actions, zod, lucide-react, existing shadcn Dialog/Select/Input/Badge/Button]
  patterns: [first Route Handler in codebase (Next 16 async params, export const maxDuration, single requireStaffAccess gate), sibling client-component coordination via window CustomEvent, distinct try/catch domains per failure class, server-action fail-loud { ok: false } envelope, additive optional props to keep secondary call sites compiling]

key-files:
  created:
    - src/app/api/companies/[id]/analyze/route.ts
    - src/app/actions/reviews.ts
    - src/app/actions/reviews.test.ts
    - src/app/(dashboard)/reviews/page.tsx
    - src/components/reviews/review-queue.tsx
    - src/components/reviews/reject-dialog.tsx
    - src/components/companies/proposal-badge.tsx
    - src/components/agents/analyze-run-status.tsx
  modified:
    - src/components/enrichment/enrichment-review-dialog.tsx
    - src/components/companies/company-detail.tsx
    - src/components/layout/app-shell-layout.tsx
    - src/components/layout/app-sidebar.tsx
    - src/lib/db/queries/proposals.ts
    - src/lib/db/queries/proposals.test.ts

key-decisions:
  - "First Route Handler = new architectural pattern: Next 16 App Router (params is a Promise, awaited), export const maxDuration = 60 (Hobby ceiling), requireStaffAccess() as the single gate FIRST (D-06), proxy.ts matcher already covers /api"
  - "Route handler keeps TWO separate try/catch domains (AI/tool vs DB persist) so gate_failed / not_configured / analysis_failed / persist_failed are distinct, fail-loud bodies — never copied arcpedia.ts's silent-[] shape (D-08)"
  - "Menu Analyze trigger implemented as a window CustomEvent bridge (ANALYZE_START_EVENT) between sibling client components (EnrichMenu → AnalyzeRunStatus) instead of an inline fetch in the dropdown item — menu onSelect fires before the strip mounts and the strip lives elsewhere in the page tree; keeps results surfacing via strip + /reviews, never navigating away"
  - "EnrichMenu grew optional canAnalyze/analyzeDisabledReason props (default false / 'Agent not configured') so the persona-detail call site compiles unchanged while company-detail gates on the analyzeCompany env check"
  - "Sidebar global pending badge fetches countPendingProposals() with try/catch → 0, degrading to a hidden badge on fetch failure (never a hard error on the shell)"
  - "Per-company badge uses new countPendingProposalsForCompany(companyId) export added to proposals.ts (ANLZ-04 wording); listPendingProposals gained the agent_run innerJoin for trace linkage"

requirements-completed: [ANLZ-01, ANLZ-02, ANLZ-03, ANLZ-04, ANLZ-05, OBSV-01, OBSV-02]

# Metrics
duration: 10h16m
completed: 2026-08-01
---

# Phase 09 Plan 03: Review Queue Delivery Summary

**First Route Handler (POST /api/companies/[id]/analyze) with distinct fail-loud error domains, staff-gated accept/reject server actions, /reviews review queue UI with inline evidence + Langfuse trace links, live Menu Analyze trigger with run-feedback strip, amber pending badge, and sidebar Reviews entry — the analytic agent's full propose→review→accept/reject user loop, UAT-approved live**

## Performance

- **Duration:** 10h 16m wall span (2026-08-01 00:18Z → 10:34Z — includes human UAT pass + checkpoint approval wait; active execution ~2h)
- **Started:** 2026-08-01T00:18Z (first commit)
- **Completed:** 2026-08-01T10:34Z (final UAT fix)
- **Tasks:** 3
- **Files modified:** 18 (13 plan files + 5 touched by the 2 orchestrator UAT fixes)

## Accomplishments
- **First Route Handler in the codebase** — `POST /api/companies/[id]/analyze`: `await requireStaffAccess()` first (single gate, D-06), `maxDuration = 60` (Hobby ceiling, D-07), zod-validated int company id, two separate try/catch domains so `gate_failed` (422) / `not_configured` (503) / `analysis_failed` (502) / `persist_failed` (502) are distinct fail-loud bodies (D-08) — no silent-`[]` copy of arcpedia.ts.
- **Staff-gated reviews server actions** — `acceptProposalAction` (idempotent: surfaces `already_resolved`/`duplicate_signal` as info) and `rejectProposalAction` (zod-validates reason against the DB enum before any write; `invalid_reason` envelope; optional note; Langfuse traceId from the proposal's run). Both fail-loud `{ ok: false, reason }`, never throw to the client; `revalidatePath('/reviews')` + `('/companies')` refresh badge/queue.
- **/reviews review queue** — server page → `<ReviewQueue>` cards with inline evidenceUrl link, evidenceSnippet, R/C rating, reasoning, per-card Accept (pending → success/already_resolved/duplicate_signal) / Reject (4-reason dialog + optional note) state machine, and a per-card "View trace" link to the Langfuse traceUrl (OBSV-01).
- **Live Menu Analyze + run-feedback strip** — the disabled Analyze item is now live: CustomEvent bridge (`ANALYZE_START_EVENT`) → `AnalyzeRunStatus` strip with running ("Analyzing {company}…", ≤1 min), success ("Analysis complete — Review {N} proposals" + auto `router.refresh()`), no-new, gate-failure (422 errors inline), not-configured (503), and analysis/persist failure (502) states; `canAnalyze` gate mirrors `analyzeCompany`'s env check so the button disables cleanly when keys are missing.
- **Pending badges** — amber per-company badge beside "Buying Signals" (new `countPendingProposalsForCompany` on proposals.ts, ANLZ-04) and a sidebar Reviews entry with a global pending-count badge (degrades to hidden on fetch failure).
- **Full verification** — `npx tsc --noEmit` clean, 212 passed | 2 skipped, production build green (routes include `/reviews` and `/api/companies/[id]/analyze`), and all 3 manual UAT steps passed live (Analyze → proposals in /reviews with evidence; Langfuse trace visible with View-trace link; Reject → correction traceId + Langfuse annotation mirror).

## Task Commits

Each task was committed atomically:

1. **Task 1: Route Handler POST /api/companies/[id]/analyze (first in codebase)** — `9c7a2df8` (feat)
2. **Task 2: reviews server actions — accept + reject** — `c67a2fd4` (feat)
3. **Task 2 fixup: join company in listPendingProposals + per-company pending count** — `944a93ff` (fix)
4. **Task 3: review queue UI — /reviews page, components, Analyze wiring, badge, sidebar** — `41723dcc` (feat)
5. **UAT fix: valid Anthropic model string** — `16a52b36` (fix, landed by orchestrator during UAT)
6. **UAT fix: citation URL variance tolerance** — `bf3fceae` (fix, landed by orchestrator during UAT)

## Files Created/Modified
- `src/app/api/companies/[id]/analyze/route.ts` - First Route Handler; staff-gated, maxDuration=60, separate AI/DB try-catch domains, fail-loud 422/503/502 bodies (created)
- `src/app/actions/reviews.ts` - acceptProposalAction / rejectProposalAction server actions (created)
- `src/app/actions/reviews.test.ts` - 3 behavior tests (staff gate first, zod reason validation, fail-loud envelope) (created)
- `src/app/(dashboard)/reviews/page.tsx` - Server Component: listPendingProposals → ReviewQueue (created)
- `src/components/reviews/review-queue.tsx` - 'use client' pending-proposal cards with inline evidence, per-card Accept/Reject state machine, View-trace link, empty state (created)
- `src/components/reviews/reject-dialog.tsx` - 'use client' confirm-dialog: 4 correction reasons + optional note, loading/error states (created)
- `src/components/companies/proposal-badge.tsx` - amber pending-count badge, renders nothing when 0 (created)
- `src/components/agents/analyze-run-status.tsx` - run feedback strip: 6 states, generation-ref guard, auto-refresh on success (created)
- `src/components/enrichment/enrichment-review-dialog.tsx` - live Menu Analyze slot via ANALYZE_START_EVENT; new optional canAnalyze/analyzeDisabledReason props (modified)
- `src/components/companies/company-detail.tsx` - mounts AnalyzeRunStatus + ProposalBadge; passes canAnalyze gate (modified)
- `src/components/layout/app-shell-layout.tsx` - fetches global pending count (try/catch → 0) for sidebar badge (modified)
- `src/components/layout/app-sidebar.tsx` - Reviews nav item (Inbox icon, /reviews active match) + pending-count SidebarMenuBadge (modified)
- `src/lib/db/queries/proposals.ts` - agent_run innerJoin in listPendingProposals + new countPendingProposalsForCompany (modified)
- `src/lib/db/queries/proposals.test.ts` - mock chain extended for innerJoin (modified)
- `src/lib/agents/runAgent.ts` / `runAgent.test.ts` - FAST_MODEL_ID → claude-sonnet-4-6 (UAT fix, modified)
- `src/lib/validation/airsRules.ts` / `airsRules.test.ts` - citation URL normalization + extend-at-path-segment tolerance (UAT fix, modified)

## Decisions Made
- First Route Handler as a deliberate new pattern (Next 16 async `params`, `export const maxDuration`, single `requireStaffAccess` gate first) — documented in-file.
- Two separate try/catch domains (AI vs DB) with distinct fail-loud bodies — a 502 persist failure is never reported as an AI error (D-08).
- Menu Analyze wired through a window CustomEvent bridge rather than an inline fetch — the strip is a sibling component mounted elsewhere in company-detail; results surface via the strip + queue page, never navigating away.
- Optional `canAnalyze`/`analyzeDisabledReason` props on EnrichMenu keep the persona call site compiling while company-detail gates on the real env check.
- Per-company badge uses a new `countPendingProposalsForCompany` (ANLZ-04 wording); sidebar global badge degrades silently to hidden on fetch failure.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] proposals.test.ts mock missing innerJoin after listPendingProposals join**
- **Found during:** Task 2 verification (after `944a93ff`)
- **Issue:** `944a93ff` added the `agent_run` innerJoin to `listPendingProposals` (trace-linkage fixup) but the existing test's mock chain stopped at `leftJoin` — `db.select().from().innerJoin is not a function` failing the full suite.
- **Fix:** Extended the mock chain to `from → innerJoin → leftJoin → where → orderBy` and added `company` to the schema imports; added an assertion covering the join.
- **Files modified:** `src/lib/db/queries/proposals.test.ts`
- **Verification:** Full suite green after fix.
- **Committed in:** `944a93ff` (Task 2 fixup commit)

**2. [Rule 1 - Bug] Dead Anthropic model string returned 404 in live UAT**
- **Found during:** Live end-to-end UAT (2026-08-01)
- **Issue:** `runAgent`'s FAST_MODEL_ID `'claude-sonnet-4-20250514'` was removed from the live Anthropic model roster — the dated ID returns 404, so the live analyze run could not execute.
- **Fix:** Updated FAST_MODEL_ID to the valid current model `'claude-sonnet-4-6'` (verified via GET /v1/models 2026-08-01); `runAgent.test.ts` assertions updated to match.
- **Files modified:** `src/lib/agents/runAgent.ts`, `src/lib/agents/runAgent.test.ts`
- **Verification:** Live UAT analyze flow passed after fix.
- **Committed in:** `16a52b36` (orchestrator fix during UAT)

**3. [Rule 1 - Bug] Citation gate rejected valid citations that extend a fetched URL**
- **Found during:** Live UAT — a live run cited `.../714139/trade` while Firecrawl returned `.../714139/` (the model lifted the URL from the snippet text).
- **Issue:** `checkCitationsResolve` treated any path deviation as a fabrication, failing the fail-closed gate on legitimate content.
- **Fix:** `airsRules.ts` now normalizes URLs (scheme/query/fragment/case/trailing slash) and allows a citation to EXTEND a fetched URL at a path-segment boundary; the reverse direction (citing a parent of the fetched URL) remains forbidden. 5 new tests in `airsRules.test.ts`.
- **Files modified:** `src/lib/validation/airsRules.ts`, `src/lib/validation/airsRules.test.ts`
- **Verification:** New unit tests green; live UAT passed after fix.
- **Committed in:** `bf3fceae` (orchestrator fix during UAT)

---

**Total deviations:** 3 auto-fixed (2 blocking/correctness in-session, 2 Rule-1 bugs surfaced by live UAT and fixed by the orchestrator)
**Impact on plan:** All fixes were necessary for the live end-to-end flow to work — the model-string fix and citation-tolerance fix could only surface with real API keys. No scope creep.

## Issues Encountered
- The working tree carried large uncommitted Phase 7/8 changes throughout (per STATE.md deferral). The 09-03 commits staged ONLY plan files by explicit path — no `git add .` / `-A`, no destructive git. `company-detail.tsx` and `enrichment-review-dialog.tsx` necessarily include previously-deferred Phase 8 content (the EnrichMenu swap + Analyze slot) because Task 3's Analyze item lives inside the Phase 8 menu — documented rather than split, since the two are inseparable at the JSX level.
- Live UAT required real Anthropic/Firecrawl/Langfuse keys — surfaced the two Rule-1 fixes above that mocked tests could not catch.

## User Setup Required
None - no new external service configuration required beyond the existing Phase 9 env keys (ANTHROPIC_API_KEY, FIRECRAWL_API_KEY, Langfuse public/secret keys) already documented in 09-01.

## Next Phase Readiness
- Plan 09-03 is the final plan of Phase 09 — the analytic agent's user loop is complete and UAT-approved. Remaining phase-gate re-runs (full suite + build + final manual UAT stamping) execute in end-of-phase verification per VALIDATION.md.
- The milestone's two heaviest open risks are retired: the async-execution/maxDuration question (answered: synchronous Route Handler, maxDuration=60) and the propose→approve boundary (now covered by the review queue with status-guarded idempotent accept/reject).
- Known follow-ups for future milestones: role system (ACCS-01 remains v2 — "any authenticated Clerk user = full access"), and the deferred Phase 7/8 git commit authorization.

## Self-Check: PASSED

All 13 plan files verified present on disk; all 6 commits (9c7a2df8, c67a2fd4, 944a93ff, 41723dcc, 16a52b36, bf3fceae) verified in git log.

---
*Phase: 09-analytic-agent-observability*
*Completed: 2026-08-01*
