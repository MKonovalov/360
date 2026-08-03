---
phase: 20-cross-provider-run-path
plan: 03
subsystem: agents
tags: [env-gate, chain-aware, missing-key, billing, rate-limit, openrouter, d16, fal-04]

# Dependency graph
requires:
  - phase: 20-cross-provider-run-path plan 02
    provides: isOpenRouterPlatformRateLimit diagnostics helper (runAgent module) for the 429 reason split; hop-aware failover loop
  - phase: 20-cross-provider-run-path plan 01
    provides: 'billing' error class + classifyModelError (402 → billing), 502/503 model-availability docs
provides:
  - Chain-aware all-or-nothing env gate at analyzeCompany entry (FAL-04): missingProviderKey(modelChain) derives the provider set from the RESOLVED chain via getProviderForModelId and returns the NAMED missing key (D-20-01/02) — never a mid-chain crash, never a lazy per-hop key check (ARCHITECTURE Pattern 4)
  - FIRECRAWL-only pre-DB fast gate (D-20-03): FIRECRAWL stays required regardless of provider with bare not_configured (no named-key semantics for a non-provider key); ANTHROPIC/OPENROUTER flow through the chain-aware named-key path
  - AnalyzeResult union extensions: 'billing' reason + missingKey?/message? payload fields
  - runAgent catch: 402 → billing 'provider credits exhausted' (FAL-02/D-20-10); 429 → rate_limited with the diagnostics-derived 'openrouter platform rate limit' vs 'upstream provider rate limit' message (D-20-07/08/10)
affects: [Plan 20-04 route status mapping (billing → 402, not_configured → 400 naming the key, rate_limited → 429), Phase 21 Settings UI missing-key hints (D-20-04), Phase 22 error matrix + openrouter-only-chain UAT]

# Tech tracking
tech-stack:
  added: []
  patterns: [entry-time provider-set env gate (ARCHITECTURE Pattern 4 — gated ONCE at entry, never per-hop), named-key not_configured structured reason (D-20-01), importActual-spread mock factory preserving real helpers while overriding the seam (D-16)]

key-files:
  created: []
  modified:
    - src/lib/agents/analyzeCompany.ts
    - src/lib/agents/analyzeCompany.test.ts

key-decisions:
  - "D-20-03 execution: the pre-DB fast gate is FIRECRAWL-only — ANTHROPIC is a provider key, so it moves into the chain-aware named-key path (an openrouter-only chain runs with only OPENROUTER set; an ANTHROPIC-missing anthropic chain names ANTHROPIC_API_KEY)"
  - "FAL-04/D-20-01/02: missingProviderKey checks the RESOLVED chain's provider set all-or-nothing at run entry; unknown ids (null provider) are skipped — the union servable gate upstream (resolveModelChain) already excludes non-servable ids"
  - "D-20-10: 402 maps to billing 'provider credits exhausted'; 429 maps to rate_limited with the diagnostics-split platform/upstream message — message values are fixed server-side constants (T-20-09), only key NAMES surface in missingKey (T-20-07)"

patterns-established:
  - "Pattern: named-key env gate — the chain-aware provider-set check returns the MISSING KEY NAME as a structured reason; the provider-independent FIRECRAWL key stays a bare not_configured"
  - "Pattern: importActual-spread mock factory — vi.mock factory spreads the real module then overrides the seam LAST (object-literal later-wins), preserving real helpers for genuine coverage while keeping runAgent mocked (D-16 zero-live-call)"

requirements-completed: [FAL-01, FAL-02, FAL-04]

# Metrics
duration: 8min
completed: 2026-08-02
---

# Phase 20 Plan 3: Chain-Aware Env Gate + Structured Reasons Summary

**Chain-aware all-or-nothing env gate at analyzeCompany entry (FAL-04) that derives the provider set from the RESOLVED chain and names the missing key (D-20-01/02), a FIRECRAWL-only fast gate (D-20-03), and the FAL-02 'billing' + diagnostics-split rate_limited structured reasons (D-20-10) — locked by 7 new tests behind a real-helper-preserving importActual mock spread**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-02T21:08:30Z
- **Completed:** 2026-08-02T21:16:56Z
- **Tasks:** 2 (both `type="auto"`, no checkpoints)
- **Files modified:** 2

## Accomplishments
- The pre-DB fast gate is now FIRECRAWL-only (`if (!env.FIRECRAWL_API_KEY)`) — FIRECRAWL is provider-independent (webSearch tool, D-20-03) and keeps its bare `not_configured`; the old `ANTHROPIC_API_KEY || FIRECRAWL_API_KEY` blanket gate is GONE so ANTHROPIC gets the named-key treatment and openrouter-only chains are never blocked by an unused ANTHROPIC key
- New `missingProviderKey(modelChain)` (FAL-04/D-20-01/02): derives the provider set from the RESOLVED chain via `getProviderForModelId(catalogJson, id)` (real catalog — never client input, never persisted), returns `'ANTHROPIC_API_KEY'` / `'OPENROUTER_API_KEY'` / `null`; gated ONCE at run entry after snapshot-at-entry, before `runAgent` — a chain spanning providers requires every provider's key up front
- `AnalyzeResult` ok:false union gains `'billing'` + `missingKey?: string` (D-20-01 named key) + `message?: string` (D-20-10 structured reason); route (plan 20-04) maps them to distinct HTTP statuses
- runAgent catch now: `isMisconfigurationError` → `not_configured`; `cls === 'billing'` (402, FAL-02/D-20-10) → `{ reason: 'billing', message: 'provider credits exhausted' }` — a distinct reason so nobody later "fixes" it into the advance set (PITFALLS 3); `cls === 'rate_limited'` (429, D-04 carve-out extended) → `message` split by the REAL `isOpenRouterPlatformRateLimit` helper (platform-level X-RateLimit headers vs upstream `metadata.provider_code` pass-through, D-20-07/08/10)
- `env.ANTHROPIC_API_KEY` appears exactly once in the file (inside `missingProviderKey`) — verified by grep

## Task Commits

Each task was committed atomically:

1. **Task 1: analyzeCompany.ts — chain-aware gate + missingProviderKey + billing/rate_limited structured reasons** - `407ff21a` (feat)
2. **Task 2: analyzeCompany.test.ts — OPENROUTER env seam + chain-aware gate tests + billing/rate_limited reason tests** - `86053940` (test)

## Files Created/Modified
- `src/lib/agents/analyzeCompany.ts` - Catalog imports (`getProviderForModelId` + `catalog.json`, both env-free); `isOpenRouterPlatformRateLimit` added to the existing `./runAgent` import; FIRECRAWL-only fast gate; `missingProviderKey` named export after the union; chain-aware gate after snapshot-at-entry; catch gains the billing carve-out + message-bearing rate_limited branch. Everything else (loadCompanyAndSignals, deriveEvidenceAppendix, retentionTagForUrl, deriveVerdict, isMisconfigurationError, the ok:true audit return) untouched
- `src/lib/agents/analyzeCompany.test.ts` - Hoisted env gains `OPENROUTER_API_KEY: 'test-key'`; `./runAgent` mock factory spreads `vi.importActual('./runAgent')` with `runAgent: mocks.runAgent` OVERRIDE LAST (real `isOpenRouterPlatformRateLimit` survives for the split tests, the mock seam stays — inverted order would un-mock runAgent → live generateText, D-16 breach); existing not_configured test reworked to clear ONLY `FIRECRAWL_API_KEY`; existing 429 test's expected shape gains `message: 'upstream provider rate limit'`; 7 new cases (ANTHROPIC-missing named key, OPENROUTER-missing named key, openrouter-only chain runs with ANTHROPIC unset, mixed chain runs end-to-end with both keys, 402 billing, 429 platform via responseHeaders, 429 upstream via `data.error.metadata.provider_code`)

## Decisions Made
None beyond the plan's locked decisions (D-20-01/02/03/04/07/08/10, FAL-01/FAL-02/FAL-04) — the plan was executed exactly as written, including the checker-revised FIRECRAWL-only fast gate and the mock-override-last importActual spread.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required (no installs, no env additions; both provider keys already declared in env.ts per Phase 19 REG-02).

## Next Phase Readiness
- Plan 20-04 (route) maps the new reasons to distinct statuses per D-20-09: `billing` → 402, `not_configured` → 400 with the named-key message (`result.missingKey ? \`${result.missingKey} not configured\` : undefined`), `rate_limited` → 429 with the helper-derived `result.message`; `gate_failed`/`company_not_found`/`db_error` + the 502 catch-all stay untouched (D-20-11 minimal blast radius)
- Phase 21 Settings UI surfaces missing-key hints (D-20-04) using the named `missingKey`
- Phase 22 UAT: openrouter-only chains run with only the OPENROUTER key set; the error matrix records billing/rate_limited/bare-not_configured behaviors

---

*Phase: 20-cross-provider-run-path*
*Completed: 2026-08-02*

## Self-Check: PASSED

- Files: `src/lib/agents/analyzeCompany.ts`, `src/lib/agents/analyzeCompany.test.ts`, `.planning/phases/20-cross-provider-run-path/20-03-SUMMARY.md` — all FOUND
- Commits: `407ff21a` (Task 1), `86053940` (Task 2) — both present in git log
- Full suite: 335 passed / 6 skipped (328 baseline + 7 new); `npx tsc --noEmit` exit 0
