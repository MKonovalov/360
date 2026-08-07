---
phase: 33-grounded-analysis-execution-evidence
plan: 04
subsystem: grounded-execution
tags: [typescript, vitest, model-factory, firecrawl, bounded-execution, retrieval]

# Dependency graph
requires:
  - phase: 33-grounded-analysis-execution-evidence
    plan: 01
    provides: Deferred policy, typed grounded execution contracts, and Persona fail-closed policy
  - phase: 33-grounded-analysis-execution-evidence
    plan: 03
    provides: Server-derived evidence normalization and canonical source rules
provides:
  - Policy-gated provider-neutral grounded execution adapter
  - Bounded Firecrawl-only search tool and server-owned page retrieval
  - Safe adapter/tool regression coverage with no network or provider spend
affects: [33-05, 33-06]

# Tech tracking
tech-stack:
  added: []
  patterns: [snapshot model-chain resolution, typed safe failure union, opaque search-result ownership, bounded Firecrawl seam]

key-files:
  created:
    - src/lib/analysis/execution.ts
    - src/lib/analysis/execution.test.ts
    - src/lib/analysis/evidenceRetrieval.ts
    - src/lib/analysis/evidenceRetrieval.test.ts
  modified:
    - src/lib/agents/runAgent.ts
    - src/lib/agents/runAgent.test.ts
    - src/lib/agents/tools.ts

key-decisions:
  - "Execution resolves only the validated snapshot modelChain through instantiateChain; mutable Settings and provider branches remain outside the adapter."
  - "The deferred Phase 33 policy remains fail closed: Company and Persona requests return safe policy reasons without model or Firecrawl dispatch."
  - "Page retrieval is not a model tool; it requires canonical URL membership in a server-owned opaque search-result set and revalidates public HTTPS identity."

# Metrics
metrics:
  duration: "~1h"
  completed: 2026-08-07
  tasks: 2
  files: 7
---

# Phase 33 Plan 04: Provider-Neutral Grounded Execution Summary

**A policy-gated grounded adapter now reuses the existing modelFactory/runAgent failover seam and bounded Firecrawl search, while typed page retrieval remains server-owned and cannot fetch arbitrary model URLs.**

## Accomplishments

- Added `GroundedExecutionAdapter` with validated scalar input, snapshotted model-chain resolution, safe structured output, model/fallback identity, usage/timing, bounded tool results, and typed non-secret failure reasons.
- Generalized `runAgent` with injectable prompt/output-schema/tool-loop bounds without changing its existing Company callers or provider/failover behavior.
- Kept execution fail closed while the approved Phase 33 policy is absent; deferred Company and Persona requests do not instantiate models or call Firecrawl.
- Hardened `webSearchTool` with query, result, timeout, public-HTTPS, malformed-result, prompt-injection, and content bounds. The map remains Firecrawl-only.
- Added `retrieveFirecrawlPage` with canonical URL normalization, opaque server-owned search-result membership, public-host revalidation, bounded markdown/excerpt output, timeout cleanup, and safe error mapping.
- Covered success, fallback identity, malformed output, timeout, missing key, tool-policy/prompt-injection, source-budget, retrieval membership, unsafe URL, malformed page, and Persona policy-unavailable cases with mocked tests.

## Verification Evidence

- `npm test -- src/lib/analysis/evidenceRetrieval.test.ts src/lib/analysis/execution.test.ts src/lib/analysis/evidence.test.ts src/lib/analysis/results.test.ts src/lib/agents/runAgent.test.ts` — **passed, 5 files / 59 tests**.
- `npx tsc --noEmit` — **passed**.
- No provider credentials, Firecrawl credentials, database connection, live model call, or external network request was used.
- `codegraph_explore` was attempted but the checkout has no `.codegraph` index; built-in file inspection was used instead.

## Policy and Dependency Limitations

- The Phase 33 approval record remains deferred with `executionEnabled: false`; this plan therefore proves the adapter contract and fail-closed boundary only, not live provider execution.
- Database-backed Phase 33 evidence remains unavailable because `TEST_DATABASE_URL` is absent; no database evidence was fabricated.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Enforced approved policy source budgets in the adapter**
- **Found during:** Task 1 implementation review
- **Issue:** The first adapter pass bounded the AI step count but did not cap model attempts or aggregate source count/bytes against the approved policy.
- **Fix:** Slice the immutable model chain to `maxAttempts` and reject tool output exceeding source count, source bytes, or excerpt bounds.
- **Files modified:** `src/lib/analysis/execution.ts`, `src/lib/analysis/execution.test.ts`
- **Commit:** `9f8e97b0`

## Auth Gates

None.

## Known Stubs

None. The deferred policy is an intentional fail-closed state, not a placeholder; no empty result is exposed as successful execution.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: model-tool-boundary | `src/lib/analysis/execution.ts` | Snapshot-derived prompts and untrusted Firecrawl tool results enter a bounded, unpersisted adapter output with safe failure mapping. |
| threat_flag: server-owned-retrieval | `src/lib/analysis/evidenceRetrieval.ts` | Scrape requires opaque membership in the server-owned search-result set plus HTTPS/public-host validation and byte bounds. |
| threat_flag: external-search-input | `src/lib/agents/tools.ts` | Model search queries and Firecrawl responses cross a bounded public-web boundary with injection and malformed-result rejection. |

## Self-Check: PASSED

- All seven Plan 04 source/test files and this summary exist.
- Task commits are present: `940e9976`, `d8bd22e9`, `01c82d49`, `9f8e97b0`.
- Focused mocked tests and TypeScript diagnostics passed.
- No Exa import, new provider SDK, package change, persistence call, or live credential/network call was introduced.

---
*Phase: 33-grounded-analysis-execution-evidence*
*Plan: 04*
*Completed: 2026-08-07*
