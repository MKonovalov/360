---
phase: 22-verification-gate
plan: 02
subsystem: security
tags: [vitest, ver-04, security-matrix, grep, verification-gate, canary]

# Dependency graph
requires:
  - phase: 22-verification-gate
    provides: D-22-07 (codified grep as a permanent gate) + the VERIFIED 2026-08-03 baseline from 22-RESEARCH Pattern 3 (exactly 3 non-test server files hold OPENROUTER)
provides:
  - A permanent automated gate for VER-04 "no OpenRouter key-name leakage to the client bundle / Server Action returns / NEXT_PUBLIC_*" — runs with every `npm test`, no manual grep step ever again (D-22-07)
  - An allowlist canary (Test 4) proving the gate is non-vacuous (Pitfall 6 — a token rename fails loudly instead of silently passing)
affects: [22-verification-gate later plans, verify phase UAT evidence for VER-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Node-env fs-scanning security gate: readdirSync/statSync recursive walk over src/ + readFileSync('.env.example') (process.cwd()-relative, seed.ts:26 style); node builtins only, no @/ alias needed for cwd-relative paths"
    - "Self-file exclusion (test-1 + test-3): the gate's own file legitimately holds the leak literals ('use client', 'OPENROUTER', 'NEXT_PUBLIC_OPENROUTER') under test, so each assertion loop skips it — every other src/ file + .env.example stays scanned, the leak-detection assertions are not weakened, and the canary keeps the gate non-vacuous"
    - "Canary-vs-vacuous guard (Pitfall 6): Test 4 asserts the allowlisted server files DO contain OPENROUTER_API_KEY — a rename to a casing variant fails loudly instead of the gate silently passing"

key-files:
  created:
    - src/lib/verification/security-grep.test.ts (the permanent VER-04 gate, 4 it() blocks)
  modified: []

key-decisions:
  - "VER-04 (22-02): the security-matrix grep is codified as a permanent Vitest gate (D-22-07) via a node-env fs-scanning test that fails on any OPENROUTER key-name in client-reachable code (`'use client'` components, src/components, Server Actions) and any NEXT_PUBLIC_OPENROUTER in src/ or .env.example, while .env.example still declares server-only OPENROUTER_API_KEY; the allowlist Set (lib/env.ts, lib/agents/modelFactory.ts, lib/agents/analyzeCompany.ts) matches the VERIFIED 2026-08-03 baseline and is anchored by a canary so the gate is never vacuous"

patterns-established:
  - "VER-04 gate as a permanent Vitest test: the four-assertion structure (client scan, actions scan, NEXT_PUBLIC + .env.example scan, canary) locks 'no key-name leakage' forever instead of a one-off manual grep"
  - "Self-determined gate: a security test whose own source holds leak-token literals must exclude itself from those scans (via `if (rel === 'lib/verification/security-grep.test.ts') continue;`) so it passes its own source without weakening any leak-detection assertion"

requirements-completed: [VER-04]

# Metrics
duration: 4min
completed: 2026-08-03
---

# Phase 22 Plan 2: VER-04 Security-Matrix Grep → Permanent Gate Summary

**The VER-04 security-matrix grep is now a permanent Vitest gate (D-22-07): a node-env test that scans `src/**` + `.env.example` and fails on any `OPENROUTER` in client-reachable code (`'use client'` components, `src/components`, Server Actions) or any `NEXT_PUBLIC_OPENROUTER` in `src/` or `.env.example`, with an allowlist (exactly 3 non-test server files) + a non-vacuous canary — green on both the targeted file and the full 377-test suite.**

## Performance

- **Duration:** ~4 min
- **Tasks:** 1 (Task 1 — CREATE the gate; committed)
- **Files modified:** 1 (`src/lib/verification/security-grep.test.ts`)

## Accomplishments

- **Task 1 — Codified the VER-04 gate as `src/lib/verification/security-grep.test.ts`.** Four `it()` blocks from RESEARCH Pattern 3: (1) no `OPENROUTER` in client components (`src.includes("'use client'")` or `rel.startsWith('components/')`); (2) no `OPENROUTER` in Server Actions (`app/actions/`); (3) no `NEXT_PUBLIC_OPENROUTER` in any src file or `.env.example` + `.env.example` still declares `OPENROUTER_API_KEY`; (4) allowlist canary — each of `lib/env.ts`, `lib/agents/modelFactory.ts`, `lib/agents/analyzeCompany.ts` MUST contain `OPENROUTER_API_KEY`.
- **The gate runs with every `npm test`** via the existing `src/**/*.test.ts` include glob — zero config change, no manual step (D-22-07 requirement "no manual step ever again").
- **Verified green — baseline locked:** targeted run 4/4 pass; full `npm test` 377 passed | 6 skipped (33 files) — no regression.

## Task Commits

Each task committed atomically:

1. **Task 1: Create the security-grep Vitest gate with allowlist + canary assertions** - `d412723e` (test(22-02): codified the VER-04 gate)

**Plan metadata commit:** (docs commit of SUMMARY + STATE + ROADMAP, see completion notes)

## Files Created/Modified

- `src/lib/verification/security-grep.test.ts` (NEW, 67 lines) — header why-comment (D-22-07 permanent gate; source-level only, no build-time coupling per CONTEXT §Deferred), `ALLOWED` Set = exactly the 3-verified server files, `walk()` recursive fs-walk over `src/`, and the four `it()` blocks. Node builtins (`readdirSync`, `readFileSync`, `statSync`, `join`) — no `@/` alias, cwd-relative paths like `seed.ts`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test-1 self-file skip required — the plan's "ONE deviation only (Test 3)" would make the gate fail its own Test 1**
- **Found during:** Task 1 (verifying the RESEARCH skeleton against the gate's own source)
- **Issue:** The plan mandates the ONLY skeleton deviation be Test 3's self-skip, but Test 1 (`isClient = src.includes("'use client'") || rel.startsWith('components/')`) trips on the gate's OWN file: its isClient predicate literally contains `'use client'` (3 occurrences) and the file contains `OPENROUTER` (15 occurrences). Without a Test-1 self-skip, `isClient` → true for the gate file and `expect(src).not.toContain('OPENROUTER')` fails — the gate can never pass its own source, directly contradicting the plan's `done` criterion ("green on the current tree … passes its own source"). The RESEARCH Pattern 3 skeleton mis-flagged only the NEXT_PUBLIC literal as the self-collision.
- **Fix:** Added `if (rel === 'lib/verification/security-grep.test.ts') continue;` at the top of Test 1's loop, with the same why-comment reasoning as Test 3 (this file legitimately holds the literals under test). Every real client file — a genuine `'use client'` component or a `src/components` file — is still scanned for `OPENROUTER`; no leak-detection assertion is weakened. Verified genuinely required, not an excuse to weaken: targeted run 4/4 green, full suite green.
- **Files modified:** `src/lib/verification/security-grep.test.ts`
- **Commit:** `d412723e`
- **Plan deviation attribution:** The plan mandated "copy the verified skeleton verbatim" with Test 3's skip as THE one deviation; the Test 1-self-defect was a defect in that skeleton, so a Rule-1 auto-fix was applied and documented rather than re-authoring the file without it (which would not satisfy the plan's own green-on-own-source criterion).

**2. [Documented situational deviation — pre-existing uncommitted deliverable]** The Task-1 deliverable was already present as an uncommitted file in the working tree when execution began (matching the 22-01 precedent in this phase). The existing file was verified line-by-line against RESEARCH Pattern 3 + PATTERNS.md and against every acceptance criterion, then the Rule-1 Test-1 skip (above) was confirmed/kept and it was committed as Task-1's deliverable rather than re-authored.

### Verified-no-weakening confirmation

- `grep -c "security-grep.test.ts" src/lib/verification/security-grep.test.ts` → 2 (self-skip present)
- `grep -c "NEXT_PUBLIC_OPENROUTER" src/lib/verification/security-grep.test.ts` → 4 (the literal is asserted; the exclusion does not remove it)
- `grep -c "'use client'"` → 3 (the client marker is present → gives the isClient predicate the self-collision it must be excluded from)
- ALLOWED set matches exactly `lib/env.ts, lib/agents/modelFactory.ts, lib/agents/analyzeCompany.ts`
- Canary input real: `OPENROUTER_API_KEY` present in all three ALLOWED files (confirmed in the earlier baseline grep)

## Issues Encountered

- No build/lint/test failures in the deliverable; the only narrative issue was the pre-existing working-tree state + the Test-1 self-defect in the RESEARCH skeleton (both documented above).

## User Setup Required

- None - this plan introduces no new installs (threat_model confirms: T-22-XX accept), requires no external service config, and needs no env/keys to run (the gate reads file text only).

## Next Phase Readiness

- Phase 22 plan progress **2/7** (22-01 and 22-02 both committed). Remaining Wave 1: 22-03 (Playwright harness). Wave 2 (22-04..22-07 live-key/static/loader evidence) blocked on Wave 1 operator prerequisites:
  - a dedicated Clerk test staff account (provisioned in 22-03) and a credited OPENROUTER_API_KEY (verified by the 22-4/22-05 `curl` credit check) — per ROADMAP footnote.
- VER-04 is now continuously provable by the permanent gate (this plan), with the canary keeping it honest.

---

*Phase: 22-verification-gate*
*Completed: 2026-08-03*

## Self-Check: PASSED

- [x] `src/lib/verification/security-grep.test.ts` exists (67 lines), 4 `it()` blocks present (`grep -c "it("` → 4)
- [x] ALLOWED set exactly `['lib/env.ts', 'lib/agents/modelFactory.ts', 'lib/agents/analyzeCompany.ts']`
- [x] Commit `d412723e` (test(22-02)) exists in `git log`
- [x] `npx vitest run src/lib/verification/security-grep.test.ts` → exit 0 (4 passed)
- [x] `npm test` → exit 0 (377 passed | 6 skipped, 33 files — gate auto-discovered)
- [x] `grep -c "security-grep.test.ts"` ≥ 1 (Test-3 self-skip present); `grep -c "NEXT_PUBLIC_OPENROUTER"` ≥ 1 (literal kept)