---
phase: 22-verification-gate
plan: 03
subsystem: testing
tags: [playwright, clerk, e2e, ver-02, ver-05, verification-gate, storageState]

# Dependency graph
requires:
  - phase: 22-verification-gate
    provides: D-22-04 (Playwright as devDependency) + D-22-05 (real Clerk login e2e) decisions from 22-CONTEXT; RESEARCH Pattern 1 skeleton (webServer + project-based setup), Pitfall 3 (project-based clerkSetup), Pitfall 7 (dotenv .env.local), Open Questions 1 (account provisioning) from 22-RESEARCH; PATTERNS.md config/setup/package.json/.gitignore contracts; vitest.config.ts defineConfig analog + dotenv-load precedent at src/scripts/seed.ts:3-12
provides:
  - A working `npm run e2e` Playwright harness: webServer auto-starts `npm run dev` (reuses an already-running one locally), workers: 1, fullyParallel: false, dotenv .env.local loaded (Pitfall 7), baseURL http://localhost:3000
  - Project-based Clerk auth: `auth-setup` (clerkSetup + clerk.signIn through the REAL Clerk hosted login) → `chromium` (storageState dependency) — Pitfall 3 (never globalSetup) avoided; e2e/.clerk/user.json storageState with real __session cookie, gitignored
  - The dedicated Clerk test staff account `e2e-staff@arclumenpartners.com` (id user_3HP0JhduDv4oMe4oapuec2eX4Xq, E2E TestStaff), provisioned via Clerk Backend API (createClerkClient().users.createUser) with E2E_CLERK_USER_EMAIL + E2E_CLERK_USER_PASSWORD in .env.local (gitignored) — the VER-02/VER-05 operator prerequisite resolved
affects: [22-verification-gate plans 22-04..22-07, verify phase UAT evidence for VER-02 and VER-05]

# Tech tracking
tech-stack:
  added:
    - "@playwright/test@^1.62.1 (devDependency, D-22-04)"
    - "@clerk/testing@^2.2.16 (devDependency, D-22-04)"
    - "Playwright chromium browser (npx playwright install chromium)"
  patterns:
    - "webServer auto-start: playwright.config.ts `webServer: { command: 'npm run dev', url: 'http://localhost:3000', timeout: 120_000, reuseExistingServer: !process.env.CI }` — Playwright boots the dev server for CI, reuses a running one locally"
    - "Project-based Clerk auth setup (Pitfall 3): clerkSetup() in e2e/auth.setup.ts project, NOT a function globalSetup — globalSetup runs in a separate process so CLERK_FAPI/CLERK_TESTING_TOKEN never propagate ('Clerk Frontend API URL is required')"
    - "StorageState handoff: auth-setup project writes e2e/.clerk/user.json; chromium project consumes it via `use: { storageState: 'e2e/.clerk/user.json' }` + `dependencies: ['auth-setup']` — the dependency edge forces setup-first serial ordering"
    - "dotenv .env.local load at config top (Pitfall 7): Playwright does NOT auto-load .env.local; `import { config } from 'dotenv'; config({ path: '.env.local' });` mirrors seed.ts:12 precedent"
    - "Explicit post-login navigation: clerk.signIn sets the __session cookie but does not auto-redirect; the setup navigates to '/' explicitly and asserts the requireStaffAccess() gate passes — proving real auth instead of assuming a dashboard URL pattern"

key-files:
  created:
    - playwright.config.ts (E2E harness: webServer, workers: 1, two projects auth-setup → chromium, storageState, dotenv load)
    - e2e/auth.setup.ts (real Clerk login: clerkSetup + clerk.signIn + storageState write)
  modified:
    - package.json (e2e script + @playwright/test + @clerk/testing devDependencies)
    - package-lock.json (devDep install)
    - .gitignore (e2e/.clerk/ storageState + test-results/ + playwright-report/ generated output)
    - .env.local (E2E_CLERK_USER_EMAIL + E2E_CLERK_USER_PASSWORD — gitignored, not committed)

key-decisions:
  - "VER-02/VER-05 (22-03): the Playwright harness authenticates through the REAL Clerk hosted login (clerkSetup + clerk.signIn) per D-22-05 — never a cookie-injection stub — and persists the session to gitignored storageState e2e/.clerk/user.json; the auth-setup smoke (green) proves the real auth gate end-to-end"
  - "D-22-05 account mechanics: the dedicated test staff account (e2e-staff@arclumenpartners.com) was provisioned via Clerk Backend API createClerkClient().users.createUser (RESEARCH Open Questions 1 first path) — no dashboard fallback or human checkpoint needed; E2E_CLERK_USER_EMAIL/PASSWORD written to .env.local only"
  - "Post-login navigation target: RESEARCH Pattern 1's literal waitForURL('**/companies/**') assumed a recall.ai-style dashboard redirect, but this app's post-login dashboard is '/' (the (dashboard) route group); the setup navigates to '/' explicitly and asserts the ArcLumen 360 dashboard renders (requireStaffAccess passes) — same real-auth proof intent, correct target (deviation, see below)"

patterns-established:
  - "Playwright e2e harness pattern for this repo: webServer-managed dev server + project-based Clerk auth setup + storageState handoff — reusable by 22-05 (VER-02 live-key analyze) and 22-06 (browser UAT) spec plans verbatim"
  - "Real-Clerk-login proof pattern: after clerk.signIn, explicit page.goto('/') + expect(dashboard text).toBeVisible() — the requireStaffAccess() gate passing (not a /sign-in bounce) is the proof the session is real, not a stub"

requirements-completed: [VER-02, VER-05]

# Metrics
duration: 12min
completed: 2026-08-03
---

# Phase 22 Plan 3: Playwright E2E Harness with Real Clerk Login Summary

**The shared Playwright e2e foundation for VER-02 and VER-05 is live: @playwright/test@^1.62.1 + @clerk/testing@^2.2.16 devDeps, chromium downloaded, `npm run e2e` wiring, a webServer-managed harness with project-based Clerk auth (auth-setup → chromium storageState dependency), and the dedicated Clerk test staff account provisioned via Backend API — the auth-setup project signs in through the REAL Clerk hosted login and persists a gitignored storageState, proven green end-to-end.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-08-03T10:48:05Z
- **Completed:** 2026-08-03T10:59:53Z
- **Tasks:** 3
- **Files modified:** 6 (package.json, package-lock.json, playwright.config.ts, e2e/auth.setup.ts, .gitignore, .env.local)

## Accomplishments

- **Task 1 — Installed the harness deps + browser (D-22-04).** `npm install --save-dev @playwright/test@^1.62.1 @clerk/testing@^2.2.16` (MANDATORY `--save-dev` per RESEARCH §Installation — the slopcheck research install that wrote to `dependencies` was NOT repeated), `npx playwright install chromium` downloaded, `"e2e": "playwright test"` added to scripts after `"test": "vitest run"`, `.gitignore` gained `e2e/.clerk/`. No `yarn.lock` introduced (npm-managed repo).
- **Task 2 — Built the harness config + real-login auth setup.** `playwright.config.ts`: dotenv `.env.local` load at top (Pitfall 7), `testDir: './e2e'`, `timeout: 60_000`, `workers: 1`, `fullyParallel: false` (live-key runs never overlap), webServer `npm run dev` on :3000 with `reuseExistingServer: !process.env.CI`, `baseURL: 'http://localhost:3000'`, and the two-project structure `auth-setup` (testMatch auth.setup.ts) + `chromium` (storageState + `dependencies: ['auth-setup']`). `e2e/auth.setup.ts`: serial mode, `clerkSetup()` (project-based — Pitfall 3, never a function globalSetup), then real `clerk.signIn` + storageState write to `e2e/.clerk/user.json`.
- **Task 3 — Provisioned the test account + smoke-verified the real login (D-22-05).** The account `e2e-staff@arclumenpartners.com` (E2E TestStaff) was created via `createClerkClient({ secretKey }).users.createUser` from `@clerk/backend` (Backend API path from RESEARCH Open Questions 1 — no dashboard fallback needed); `E2E_CLERK_USER_EMAIL`/`E2E_CLERK_USER_PASSWORD` written to `.env.local` (gitignored); the one-off provisioning script deleted (no scripts/ convention). Smoke run green: `npx playwright test --project=auth-setup` → 2 passed, `e2e/.clerk/user.json` produced with the real `__session` cookie (domain=localhost), and `git status --porcelain e2e/.clerk/` empty.
- **All four plan verification items pass:** (1) auth-setup project green + storageState produced; (2) `npx playwright test --list` parses, both projects listed; (3) `git status --porcelain e2e/.clerk/` empty; (4) `npm run e2e` exits 0 (2 passed, no specs yet — specs arrive in 22-05/22-06).

## Task Commits

Each task committed atomically:

1. **Task 1: Install Playwright + Clerk testing devDeps, download chromium, add e2e script, gitignore storageState** - `92b8b1ec` (chore(22-03))
2. **Task 2: Create playwright.config.ts + e2e/auth.setup.ts (real Clerk login, project-based setup)** - `1a07de59` (chore(22-03))
3. **Task 3: Provision the Clerk test staff account + smoke-run the auth-setup project** - `5d3c7840` (fix(22-03): correct auth-setup post-login target to '/' — includes the Task-3 smoke gate fix + gitignore additions)

**Plan metadata:** (docs commit of SUMMARY + STATE + ROADMAP, see completion notes)

## Files Created/Modified

- `package.json` (MOD) — `"e2e": "playwright test"` script after `"test"`; `@playwright/test@^1.62.1` + `@clerk/testing@^2.2.16` under `devDependencies` (NOT `dependencies`).
- `package-lock.json` (MOD) — devDep install lock entries.
- `playwright.config.ts` (NEW) — full harness: dotenv `.env.local` load (Pitfall 7, why-comment citing seed.ts precedent), webServer auto-start/reuse, workers: 1 + fullyParallel: false (Pitfall 5), two projects auth-setup → chromium with storageState `e2e/.clerk/user.json` + `dependencies: ['auth-setup']` (Pitfall 3 why-comment).
- `e2e/auth.setup.ts` (NEW) — serial project-based setup: `clerkSetup()` mints the testing token; `clerk.signIn` through the real Clerk hosted flow; explicit `page.goto('/')` + `expect(getByText('ArcLumen 360')).toBeVisible()` proves the requireStaffAccess gate; storageState written to `.clerk/user.json`.
- `.gitignore` (MOD) — `e2e/.clerk/` (session cookies, never commit) + `test-results/` + `playwright-report/` (generated Playwright output).
- `.env.local` (MOD, gitignored) — `E2E_CLERK_USER_EMAIL=e2e-staff@arclumenpartners.com`, `E2E_CLERK_USER_PASSWORD=<generated>`.

## Decisions Made

- **Post-login navigation target:** clerk.signIn sets the real `__session` cookie but does not auto-redirect the page; navigating to `/` explicitly and asserting the dashboard renders through `requireStaffAccess()` is the correct real-auth proof for THIS app (see deviation below).
- **Account provisioning via Backend API:** `createClerkClient().users.createUser` succeeded on the first path — no Clerk Dashboard fallback, no human checkpoint required.
- **Deterministic test credentials:** password generated with `crypto.randomBytes(16).toString('hex') + 'Aa1!'` (Clerk policy-compliant), written only to gitignored `.env.local`, provisioning script deleted after use (T-22-05).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] RESEARCH Pattern 1's `waitForURL('**/companies/**')` times out — this app's post-login dashboard is '/', not '/companies/**'**
- **Found during:** Task 3 (auth-setup smoke run)
- **Issue:** The plan (Task 2 action, verbatim from RESEARCH Pattern 1) ends the sign-in setup with `await page.waitForURL('**/companies/**')` — the intent is "dashboard redirect proves the REAL auth gate" (D-22-05). But that literal target is wrong for this app: the authenticated dashboard is `/` (the `(dashboard)` route group behind `requireStaffAccess`), not a recall.ai-style `/companies/**` route. The smoke run failed: `clerk.signIn` resolved and the real `__session` cookie was set (debug confirmed `window.Clerk.session` present, and an explicit `page.goto('/')` rendered the full ArcLumen 360 dashboard with live data), yet the URL stayed on `/sign-in` (no auto-redirect after the testing-token sign-in) and the `waitForURL` timed out at 60s. The literal plan target could never pass.
- **Fix:** Replaced the `waitForURL('**/companies/**')` with the correct pattern: after `clerk.signIn`, `await page.goto('/')` then `await expect(page.getByText('ArcLumen 360')).toBeVisible()` — a full navigation through the `requireStaffAccess()` gate that renders the dashboard (not a `/sign-in` bounce) proves the real Clerk login end-to-end. Why-comment documents the deviation (D-22-05). Smoke now green: 2 passed, storageState with real `__session` cookie produced.
- **Files modified:** `e2e/auth.setup.ts`
- **Verification:** `npx playwright test --project=auth-setup` → exit 0, 2 passed; `e2e/.clerk/user.json` non-empty with `__session` cookie (domain=localhost); `npm run e2e` → exit 0.
- **Committed in:** `5d3c7840`

**2. [Rule 2 - Missing Critical] Playwright generated output (test-results/, playwright-report/) not gitignored**
- **Found during:** Task 3 (after the failed smoke runs left `test-results/` in the working tree)
- **Issue:** Playwright's failed-run artifacts land in `test-results/` (and `playwright-report/` when the HTML report is enabled); neither was covered by the plan's `.gitignore` additions, so they would show as untracked noise (and could be accidentally committed).
- **Fix:** Added `test-results/` and `playwright-report/` to the Playwright `.gitignore` block alongside `e2e/.clerk/`.
- **Files modified:** `.gitignore`
- **Verification:** `git status --short` clean of Playwright artifacts; `git check-ignore test-results/` passes.
- **Committed in:** `5d3c7840`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical)
**Impact on plan:** Both auto-fixes necessary for the plan's own acceptance criteria — without #1 the auth-setup smoke could never go green, and #2 keeps generated artifacts out of the repo. No scope creep; the harness matches the plan's must_haves and threat model (T-22-04/05/06 all mitigated as planned).

## Issues Encountered

- **`clerk.signIn` does not auto-redirect in this setup** — resolved by the explicit `page.goto('/')` pattern (deviation #1). Debug evidence: after signIn, `window.Clerk.session` = "present" but URL stayed on `/sign-in`; an explicit navigation to `/` rendered the authenticated dashboard (Companies 98, Personas 11, Active Signals 18) — server-side `requireStaffAccess()` validated the real session.
- **Clerk Backend API response shape:** `users.getUserList` returns `{ data, totalCount }` (not a bare array) in current `@clerk/backend` — the account verification reads `res.data[0]`. No code impact (verification one-liner only).

## User Setup Required

None additional — the operator prerequisite (dedicated Clerk test staff account, D-22-05) was **resolved by this plan** via Backend API provisioning. `E2E_CLERK_USER_EMAIL`/`E2E_CLERK_USER_PASSWORD` are in `.env.local` (gitignored); `CLERK_SECRET_KEY` (pre-existing) was used for provisioning. The RESEARCH "Environment Availability" blocker (l.556) for VER-02/VER-05 is cleared.

## Next Phase Readiness

- Phase 22 plan progress **3/7** (22-01, 22-02, 22-03 committed). Wave 2 plans 22-04..22-07 (live-key/static/loader evidence) can now consume the harness:
  - **VER-02 (22-05 live-key Analyze e2e):** `npm run e2e` harness + storageState + test account all ready — spec plan writes the analyze spec test reusing the auth-setup project.
  - **VER-05 (browser UAT):** same harness, same account.
  - Remaining Wave 2 prerequisite: a credited `OPENROUTER_API_KEY` (verified by the 22-04/22-05 `curl` credit check) — the only operator item left.
- Pattern for downstream plans: `webServer` auto-start, project-based clerkSetup, storageState handoff, and the explicit `goto('/')` + dashboard-assert real-auth proof — copy from this plan's committed files verbatim.

---

*Phase: 22-verification-gate*
*Completed: 2026-08-03*

## Self-Check: PASSED

- [x] `playwright.config.ts` exists — contains `webServer`, `reuseExistingServer`, `workers: 1`, `fullyParallel: false`, `storageState: 'e2e/.clerk/user.json'`, `dependencies: ['auth-setup']`, `config({ path: '.env.local' })`
- [x] `e2e/auth.setup.ts` exists — contains `clerkSetup()`, `clerk.signIn`, `E2E_CLERK_USER_EMAIL`, storageState write to `.clerk/user.json`
- [x] `package.json` — `"@playwright/test"` and `"@clerk/testing"` under devDependencies (each grep count 1), `"e2e": "playwright test"` present, no `yarn.lock`
- [x] `.gitignore` — `e2e/.clerk/`, `test-results/`, `playwright-report/` entries
- [x] `.env.local` — `E2E_CLERK_USER_EMAIL=` and `E2E_CLERK_USER_PASSWORD=` present (gitignored)
- [x] Backend API `users.getUserList({ emailAddress: [E2E_CLERK_USER_EMAIL] })` → 1 account (user_3HP0JhduDv4oMe4oapuec2eX4Xq, e2e-staff@arclumenpartners.com)
- [x] `npx playwright test --project=auth-setup` → exit 0 (2 passed); `e2e/.clerk/user.json` non-empty (9 cookies incl. `__session` domain=localhost)
- [x] `git status --porcelain e2e/.clerk/` → empty (gitignored)
- [x] `npx playwright test --list` → exit 0, both projects listed
- [x] `npm run e2e` → exit 0 (2 passed)
- [x] Commits `92b8b1ec`, `1a07de59`, `5d3c7840` exist in `git log`
