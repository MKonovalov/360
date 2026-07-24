---
phase: 04-arcpedia-integration-resilience-polish
plan: 02
subsystem: infra
tags: [cloudflare-access, clerk, zero-trust, env-config]

requires:
  - phase: 04-arcpedia-integration-resilience-polish
    provides: "fetchArcpediaArticles() and detail-pane wiring built in Plan 01, waiting on a working Access token"
provides:
  - "Working Cloudflare Access Service Token (arclumen-360-server) authenticating ArcLumen 360 to arcpedia.arclumen.de in local (.env.local) and Vercel Production environments"
  - "End-to-end confirmation that ARCP-01, ARCP-02, and EXPL-06 hold in a live environment, not just in code review"
affects: [phase-05, milestone-completion]

tech-stack:
  added: []
  patterns:
    - "Cloudflare Access Service Token must be added to the SAME Access application's policy that actually gates the requested path (multiple Access apps can exist on one domain, scoped to different path patterns) — adding a token to the wrong app's policy silently keeps returning 302"
    - "Local dev against a pk_live_ Clerk instance fails silently in the browser (_baseFetch console error, stuck on /sign-in) because production Clerk instances restrict allowed origins to configured domains; local dev requires a separate pk_test_/sk_test_ Clerk development instance"

key-files:
  created: []
  modified:
    - ".env.local (gitignored — ARCPEDIA_BASE_URL, ARCPEDIA_ACCESS_CLIENT_ID, ARCPEDIA_ACCESS_CLIENT_SECRET, and dev-instance Clerk keys)"

key-decisions:
  - "Provisioned a dedicated arclumen-360-server Service Token rather than reusing task-consumer's token, matching RESEARCH.md's Assumption A1 guidance to scope narrowly"
  - "Switched local dev to a Clerk pk_test_/sk_test_ development instance instead of adding localhost to the production instance's allowed origins — avoids widening the production Clerk instance's origin allowlist for a local-only need"

requirements-completed: [ARCP-01, ARCP-02, EXPL-06]

duration: ~35min
completed: 2026-07-24
---

# Phase 04: Arcpedia Integration & Resilience Polish Summary

**Cloudflare Access Service Token provisioned for arcpedia.arclumen.de; Related Knowledge sections and detail-pane error cards confirmed working end-to-end in a live environment**

## Performance

- **Duration:** ~35 min (interactive checkpoint plan — human-action + human-verify, executed inline with the orchestrator, no worktree agent spawned since files_modified is limited to gitignored `.env.local`)
- **Completed:** 2026-07-24
- **Tasks:** 2/2
- **Files modified:** 0 tracked (`.env.local` only, gitignored by design)

## Accomplishments
- Cloudflare Zero Trust Service Token (`arclumen-360-server`) created and added to the correct Access application's policy (the one actually gating `/api/wiki/search`, distinct from the root-domain app)
- `.env.local` and Vercel Production env vars both populated with working `ARCPEDIA_BASE_URL`/`ARCPEDIA_ACCESS_CLIENT_ID`/`ARCPEDIA_ACCESS_CLIENT_SECRET`
- Direct `curl` sanity check against `/api/wiki/search?q=test` with the token's headers returns `200` with real JSON
- Live UAT pass: Related Knowledge renders real articles (title+snippet, new-tab links) for a matching company; is fully absent for a persona with no match; DB-fetch error cards render correctly on a forced failure for both Company and Persona detail routes; loading skeletons unaffected; `grep -c "method:" src/lib/arcpedia.ts` re-confirmed at 0

## Task Commits

No task-level commits — this plan's only file change (`.env.local`) is gitignored by design (T-04-07: secrets never committed). This SUMMARY.md is the sole artifact.

## Files Created/Modified
- `.env.local` (not tracked in git) — 3 Arcpedia vars + switched Clerk keys to a `pk_test_`/`sk_test_` development instance for local sign-in

## Decisions Made
- Dedicated Service Token (`arclumen-360-server`), not a shared/reused token — matches RESEARCH.md Assumption A1's narrow-scoping guidance
- Local dev now runs against a separate Clerk development instance rather than widening the production instance's allowed origins to include `localhost`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Diagnosed and resolved an unrelated Clerk sign-in blocker discovered during Task 2's live verification**
- **Found during:** Task 2 (end-to-end verification — could not sign in locally to run the checklist)
- **Issue:** `.env.local` had a `pk_live_` (production) Clerk publishable key. Production Clerk instances restrict the Frontend API to their configured allowed origins (`arclumenpartners.com`/`360.arclumenpartners.com` per this repo's existing constraints); `localhost:3000` was never on that list, so the browser's `_baseFetch` call failed silently and sign-in never completed — unrelated to Phase 4's code changes (pre-existing local-dev environment gap, not touched by Plan 01 or Plan 02's file scope).
- **Fix:** User switched `.env.local` to a Clerk development instance's `pk_test_`/`sk_test_` keys (dev instances allow `localhost` by default, no origin config needed) and restarted `npm run dev`.
- **Files modified:** `.env.local` only (gitignored, not committed)
- **Verification:** Sign-in succeeded; all 5 remaining Task 2 checklist items subsequently passed
- **Committed in:** N/A — env-only change, nothing to commit

**2. [Rule 3 - Blocking] Diagnosed a Cloudflare Access policy-scoping issue during Task 1**
- **Found during:** Task 1 (Service Token provisioning — first curl sanity check returned 302 instead of 200)
- **Issue:** `arcpedia.arclumen.de` has more than one Cloudflare Access application configured, scoped to different path patterns. The new Service Token was initially added only to a root-domain-level app's policy, not the narrower app actually gating `/api/wiki/search` — RESEARCH.md's Assumption A1 flagged this exact risk ("if the Access policy is scoped more narrowly... could require an additional Access policy change"). A second false start was a copy-paste placeholder left in the diagnostic curl command (isolation test against `task-consumer`'s known-working token also initially "failed" due to the same placeholder mistake, which helped pinpoint the real vs. apparent failure).
- **Fix:** User located the Access application whose path pattern actually matches `/api/wiki/search` (the same one `task-consumer`'s token is already authorized against) and added the new token to that app's policy instead.
- **Files modified:** None (Cloudflare Zero Trust dashboard configuration only, outside this repo)
- **Verification:** `curl` sanity check with real (non-placeholder) header values returned `200` with JSON body
- **Committed in:** N/A — infra-only change

---

**Total deviations:** 2 auto-resolved (both Rule 3 - Blocking, both diagnosis-and-fix of blockers external to this repo's code — no scope creep, no source files touched beyond the plan's declared `.env.local`)
**Impact on plan:** Neither deviation touched application code; both were infra/environment diagnosis required to actually complete Task 2's live verification as specified.

## Issues Encountered
- See Deviations above — both issues were external-to-repo blockers (Cloudflare Access policy scoping, Clerk production-vs-dev instance origin restrictions) diagnosed collaboratively and resolved by the user in their respective dashboards.

## User Setup Required
None further — Cloudflare Access Service Token and Vercel Production env vars are already provisioned as of this plan's completion. Local dev now depends on a Clerk development instance's keys being present in `.env.local` (not committed; each developer's local setup should switch to dev-instance keys if replicating this locally).

## Next Phase Readiness
- Milestone 1's last two open requirements (ARCP-01, ARCP-02) and EXPL-06 are now fully closed — verified end-to-end, not just implemented
- No blockers for subsequent phases or milestone completion

---
*Phase: 04-arcpedia-integration-resilience-polish*
*Completed: 2026-07-24*
