# Phase 22: Verification Gate - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-03
**Phase:** 22-verification-gate
**Areas discussed:** E2E Proof Mode, Browser UAT Tooling, Matrix Scope, Key Leak Gate, E2E follow-ups, VER-03 env proof, Clerk auth in e2e, Grep scope

---

## E2E Proof Mode (VER-02/03)

| Option | Description | Selected |
|--------|-------------|----------|
| Live real-key run (Recommended) | Real Analyze against real OpenRouter with OPENROUTER_API_KEY set, assert model_used matches the saved slug. Strongest proof, ~cents of credits. | ✓ |
| Hybrid: live + SDK-mocked | One live run for VER-02 (model_used audit), SDK-mocked tests for the OpenRouter-only env-gate path (VER-03). | |
| Fully mocked | Mock the OpenRouter provider SDK everywhere. Cheap/deterministic but does not prove the real provider contract to the DB audit columns. | |

**User's choice:** Live real-key run (Recommended)
**Notes:** User chose the strongest literal proof of the milestone claim.

### E2E Target follow-up

| Option | Description | Selected |
|--------|-------------|----------|
| Seeded test company (Recommended) | Create/pick a known seed Company (test-domain), save an OpenRouter primary, run Analyze, assert model_used == saved slug. Deterministic. | ✓ |
| Real production company | Run against an arbitrary real company row from production data. More "real" but outcome varies by company. | |

**User's choice:** Seeded test company (Recommended)

---

## Browser UAT Tooling (VER-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Add Playwright devDep (Recommended) | Small e2e spec for the 3 VER-05 behaviors against the dev server. Reusable, matches "matrices lock" spirit. Adds devDependency + browser download. | ✓ |
| Manual scripted UAT + screenshots | Repo precedent (Phases 5/14): structured UAT matrix file + human browser session + screenshots. No new infra, not automated. | |
| Automated + manual hybrid | Playwright for search/grouping/badges, manual checklist for draft-preservation timing nuances. | |

**User's choice:** Add Playwright devDep (Recommended)

### Clerk auth in e2e follow-up

| Option | Description | Selected |
|--------|-------------|----------|
| Real Clerk login flow (Recommended) | Playwright logs in through the real Clerk hosted flow with a dedicated test staff account. True end-to-end. | ✓ |
| Cookie injection stub | Stub/route Clerk auth in the Playwright session to skip hosted login. Faster/offline, not a true auth-flow test. | |

**User's choice:** Real Clerk login flow (Recommended)

---

## Matrix Scope (VER-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Audit + fill gaps (Recommended) | Verify each existing matrix covers every locked cell, add only genuinely-missing cases, consolidate into a named verification-matrix section. No blind rewrites. | ✓ |
| Add full matrices from scratch | Write comprehensive dedicated matrices even where cells duplicate existing tests. Risks redundant/conflicting assertions. | |
| Existing tests already lock it | Treat VER-01 as verification-only: confirm coverage, document the mapping, no new test code. | |

**User's choice:** Audit + fill gaps (Recommended)

---

## Key Leak Gate (VER-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Codified as a Vitest test (Recommended) | A test scanning client-component files + Server Action return shapes + NEXT_PUBLIC_* usage, failing on any leak. Runs with every npm test — permanent gate. | ✓ |
| Script in scripts/ + documented run | A grep-based script run manually at phase close, output committed as evidence. One-off, not suite-enforced. | |
| Both test + script | Vitest gate for common cases plus a standalone script for ad-hoc forensic grep (full bundle scan). | |

**User's choice:** Codified as a Vitest test (Recommended)

### Grep scope follow-up

| Option | Description | Selected |
|--------|-------------|----------|
| Client + actions + env (Recommended) | Scan all src/ client components ('use client') + Server Action return shapes + .env.example + NEXT_PUBLIC_* usage. Matches VER-04 wording exactly. | ✓ |
| Add bundle scan too | Also include a full production bundle scan (post-build) for the literal key-name string. Stronger but adds build-time coupling. | |

**User's choice:** Client + actions + env (Recommended)

---

## VER-03 env proof follow-up

| Option | Description | Selected |
|--------|-------------|----------|
| Child-env integration test (Recommended) | Spawn analyzeCompany with OPENROUTER_API_KEY set and ANTHROPIC_API_KEY unset in a child env, asserting it succeeds. Automated, repeatable, structural key isolation. | ✓ |
| Manual scripted probe | Temporarily unset ANTHROPIC_API_KEY, run a scripted tsx probe, capture output as evidence. Simpler but one-off. | |

**User's choice:** Child-env integration test (Recommended)

---

## Claude's Discretion

- Exact Playwright spec file placement, test account setup mechanics, single-file vs split spec.
- Where the named verification-matrix Vitest section lives (follows modelConfig.test.ts / runAgent.test.ts D-16 conventions).
- The seeded test company's exact domain/identity (must be a test-domain).
- Whether the child-env test (D-22-03) skips gracefully when OPENROUTER_API_KEY is absent in CI, and the exact skip guard.
- Whether VER-05's e2e spec gates on the dev server being up, or starts it itself.

## Deferred Ideas

- Automated coverage thresholds (% coverage gate) — not in scope; targeted matrices + E2E prove specific claims.
- Full CI pipeline (GitHub Actions running Vitest + Playwright on every push) — future infra phase.
- Post-build bundle scan for key-name strings — deferred (adds build-time coupling to the test).
