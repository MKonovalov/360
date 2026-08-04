---
phase: 22
slug: verification-gate
status: verified
threats_open: 0
asvs_level: 1
created: 2026-08-03
---

# Phase 22 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| test code → source under test | Unit tests exercise pure exports (classifyModelError, isOpenRouterPlatformRateLimit) — no live-call trust surface; D-16 zero-live-call doctrine keeps suites offline | none (no real data) |
| src/** + .env.example → security-grep test | Gate reads every source file's text for the OPENROUTER key-name — static scan, no execution; the test is the control | source text (no secrets) |
| npm registry → node_modules | Two new devDependencies (@playwright/test, @clerk/testing) cross into the repo — both slopcheck-[OK], dev-only | third-party code |
| Playwright harness → Clerk auth + browser | E2E authenticates through Clerk's REAL sign-in with a testing token; real session cookies written to e2e/.clerk/ storageState | Clerk session cookies, storageState |
| page.request → analyze route → OpenRouter | Live analyze POST drives a REAL provider call with REAL credits (VER-02) | provider request, response shapes |
| test process → child process → OpenRouter/Neon/Firecrawl | VER-03 child runs real analyzeCompany with modified env against live DB + providers | live keys, credits, DB writes |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-22-01 (22-01) | Tampering | runAgent.test.ts / modelConfig.test.ts assertions | mitigate | Task 1 audit gates keep existing matrix assertions green+untouched; Task 2 adds only the two documented gaps — blind rewrite silently cannot change locked cells (D-22-06) | accepted |
| T-22-02 (22-01) | Tampering | WR-01 comment sites (modelConfig.ts:65-72, runAgent.ts:48-51,104-105) | mitigate | Task 1 verifies comments already say 'input' (corrected Phase 20/21); any fix is comment-only with a `// WR-01 (Phase 22 verified)` marker — behavior untouched | accepted |
| T-22-01 (22-02) | Information Disclosure | client components / Server Actions / NEXT_PUBLIC_* env | mitigate | This plan IS the mitigation: the gate fails on any OPENROUTER in client-reachable code or NEXT_PUBLIC_OPENROUTER outside the gate's own test file; runs with every npm test (D-22-07) | accepted |
| T-22-02 (22-02) | Tampering | the gate itself (vacuous pass after token rename) | mitigate | Allowlist canary (Test 4): the three server files MUST contain OPENROUTER_API_KEY — a token rename fails the gate loudly, never silently passes (Pitfall 6) | accepted |
| T-22-03 (22-02) | Information Disclosure | .env.example server-only declarations | mitigate | Test 3 asserts OPENROUTER_API_KEY stays server-only (non-PUBLIC_) and NEXT_PUBLIC_OPENROUTER never appears — a PUBLIC_-prefix regression fails the suite | accepted |
| T-22-04 (22-03) | Information Disclosure | e2e/.clerk/user.json (real Clerk session cookies) | mitigate | .gitignore entry for e2e/.clerk/ (Task 1) + Task 3 git status --porcelain empty gate — session state can never be committed | accepted |
| T-22-05 (22-03) | Information Disclosure | test credentials (E2E_CLERK_USER_EMAIL/PASSWORD) | mitigate | Written to .env.local only (gitignored by existing `.env.*` rule); never in committed files; provisioning script deleted after use | accepted |
| T-22-06 (22-03) | Spoofing | e2e auth via cookie-injection stub | mitigate | D-22-05 mandates real Clerk login — clerkSetup + clerk.signIn through Clerk's actual infrastructure; auth-setup smoke proves real gate (waitForURL **/companies/**) | accepted |
| T-22-03 (22-04/05/07) | Information Disclosure | live-key values leaking into test evidence | mitigate | Probe prints ONLY shapes ({ ok, modelUsed, modelChain }); evidence records status/JSON shapes only; acceptance greps `! grep -rq "sk-or-"` on specs + phase dir + VERIFICATION/HUMAN-UAT | accepted |
| T-22-07 (22-04) | Tampering | parent env mutation in the test | mitigate | Child env `{ ...process.env, ANTHROPIC_API_KEY: '' }` is the only mutation site; `delete process.env` prohibited + grep-gated; other tests/dev shell keep keys | accepted |
| T-22-08 (22-04) | Tampering | live-key runs overlapping (rate limits, doubled credit spend) | mitigate | Test lives in vitest (separate npm test run); plan 22-05 depends_on this plan — wave ordering serializes live-key surfaces (Pitfall 5); Playwright workers:1; credit check runs before the live child (billing failure documented, never silent skip) | accepted |
| T-22-09 (22-04) | Spoofing | seeded-company identity drift (growing ids) | mitigate | Company looked up BY NAME ('Acme Test Co', committed CSV) — never hard-coded id (Pitfall 4); *.test domain (acmetest.arclumen.test) never collides with real ICP data | accepted |
| T-22-10 (22-05) | Spoofing | uncredited/fake key producing a false pass | mitigate | Task 1 automated `curl /auth/key` verifies live validity + positive balance BEFORE run; Task 2 blocking checkpoint is operator confirm | accepted |
| T-22-11 (22-05) | Tampering | hitting the wrong company (real ICP data) | mitigate | Company targeted BY NAME ('Acme Test Co') with *.test domain — never hard-coded serial id; spec fails loudly if row absent | accepted |
| T-22-12 (22-05) | Tampering | weakened assertions to force a pass | mitigate | Task 3 forbids lowering status below 201 or weakening verbatim modelUsed; genuine bugs fixed, claims never relaxed | accepted |
| T-22-13 (22-06) | Spoofing | e2e auth bypass via cookie stub | mitigate | D-22-05 mandates real Clerk login — auth-setup project signs in through real infrastructure; spec consumes resulting storageState | accepted |
| T-22-14 (22-06) | Tampering | spec asserting implementation details | mitigate | Spec uses web-first user-visible assertions (labels, badges, group headings, rendered label text); unit logic locked in model-picker-logic.test.ts | accepted |
| T-22-15 (22-06) | Tampering | ~/:free label claim drifting savable-without-label | mitigate | SET-07 assertion: saved-chain recap must render suffix label for any ~/:free id (suffixLabel unit-locked; spec verifies rendered text — no raw id without label) | accepted |
| T-22-16 (22-07) | Repudiation | evidence not traceable to reproducible commands | mitigate | Every truth row cites the producing plan's SUMMARY + re-runnable command; no invented evidence — executor re-runs the targeted command when missing | accepted |
| T-22-SC (all) | Tampering | npm installs | accept | No installs in 6/7 plans; 22-03's two devDeps (@playwright/test, @clerk/testing) both slopcheck-[OK] — official repos, high downloads, installed --save-dev; `npx playwright install chromium` is official browser download | accepted |

*Status: open · closed · accepted · transfer*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-22-01 | T-22-01..T-22-16, T-22-SC | Operator selected "Accept all — document in accepted risks log, mark all CLOSED". The phase's entire purpose is automated verification/security testing; the mitigations for the mitigate-dispositioned threats were implemented in-phase (security-grep gate 4 passed, no-key-leak greps clean, real-Clerk auth, no secrets in commits, e2e/.clerk/ gitignored — all re-verified during code review and verify-work). Accepted as documented rather than re-audited. | operator (mkonovalov) | 2026-08-03 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-03 | 20 | 20 | 0 | gsd-secure-phase (orchestrator + operator accept-all) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-03