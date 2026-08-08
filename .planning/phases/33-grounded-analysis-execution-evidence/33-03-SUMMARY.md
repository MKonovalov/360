---
phase: 33-grounded-analysis-execution-evidence
plan: 03
subsystem: analysis-evidence
tags: [typescript, zod, vitest, firecrawl, evidence, checklist-snapshot, fail-closed]

# Dependency graph
requires:
  - phase: 33-grounded-analysis-execution-evidence
    plan: 01
    provides: Strict grounded packet contracts and immutable checklist identity rules
  - phase: 33-grounded-analysis-execution-evidence
    plan: 02
    provides: Persistence-ready normalized packet boundary and canonical source semantics
provides:
  - Pure Firecrawl evidence normalization with canonical public HTTPS identity, bounded excerpts, hashing, classification, and provenance
  - Fail-closed packet normalization against immutable checklist snapshots and exact source/content-hash citations
  - Adversarial tests for unsafe evidence, citation mismatch, duplicate links, support requirements, and explicit non-support statuses
affects: [33-04, 33-05, 33-06, 34-review]

# Tech tracking
tech-stack:
  added: []
  patterns: [server-derived evidence boundary, canonical URL/content identity, snapshot identity resolution, typed safe failure reasons]

key-files:
  created:
    - src/lib/analysis/evidence.ts
    - src/lib/analysis/evidence.test.ts
    - src/lib/analysis/results.ts
    - src/lib/analysis/results.test.ts
  modified: []

key-decisions:
  - "Evidence sources require an explicit Firecrawl origin/provider marker and bounded retrieved content; model-recited source triples cannot enter normalization."
  - "Citation resolution uses exact canonical URL plus content hash and excerpt anchoring; parent-page, URL-only, unresolved, duplicate, and mismatched links fail closed."
  - "Finding names, categories, and Persona buyer roles are copied only from the immutable checklist snapshot keyed by numeric signal ID."

patterns-established:
  - "Canonical duplicate source discovery keeps the first normalized source identity; repeated finding/source pairs reject."
  - "Strong and weak findings require support; no_evidence and inconclusive findings remain explicit and may be linkless."

requirements-completed: [EVD-01, EVD-02, EVD-03, EVD-04, EVD-05]

# Metrics
duration: "~45m"
completed: 2026-08-07
---

# Phase 33 Plan 03: Canonical Evidence and Normalized Packet Summary

**Server-owned Firecrawl results now become bounded canonical evidence only after public HTTPS, content, excerpt, provenance, and prompt-policy checks; findings resolve to immutable checklist identities and exact fetched support or explicit non-support statuses.**

## Accomplishments

- Added pure evidence normalization with Firecrawl provenance gating, canonical HTTPS URL normalization, private/reserved/local target rejection, credential/secret URL rejection, bounded content and excerpt checks, deterministic SHA-256 content identity, host classification, and provider metadata preservation.
- Added deterministic source deduplication that retains the first canonical URL/content identity.
- Added pure normalized packet construction that parses strict input, validates the immutable Phase 32 checklist snapshot, copies snapshot identity fields, resolves citations only against normalized server-derived sources, and rejects duplicate or mismatched links.
- Enforced support semantics: strong/weak findings require exact support; `no_evidence` and `inconclusive` remain explicit without links; unsafe Persona source classification is rejected.
- Added adversarial Vitest coverage with no network, database, provider, or external credential calls.

## Verification Evidence

- `npm test -- src/lib/analysis/results.test.ts src/lib/analysis/evidence.test.ts` — **passed, 2 files / 18 tests**.
- `npx tsc --noEmit` — **passed**.
- Source modules are pure and contain no Firecrawl client, network, database, persistence, model, or workflow calls.
- Individual touched source files remain below the 250 pure-LOC ceiling; `results.ts` is 215 pure LOC and remains within the warning band.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Rejected reserved and secret-bearing source targets**
- **Found during:** Task 1 implementation review
- **Issue:** Public-looking URL syntax alone could admit documentation/reserved IP ranges or URLs carrying secret/session markers.
- **Fix:** Added textual secret-marker rejection and reserved/link-local/private host checks before canonical identity is returned.
- **Files modified:** `src/lib/analysis/evidence.ts`
- **Commit:** `f1891665`

## Auth Gates

None.

## Known Stubs

None. All test fixtures exercise rejection or fully normalized data; no placeholder source or packet is emitted by production code.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: external-evidence-boundary | `src/lib/analysis/evidence.ts` | Firecrawl/web URLs and retrieved content cross into a server-owned normalized source boundary with SSRF, size, injection, and provenance controls. |
| threat_flag: immutable-checklist-resolution | `src/lib/analysis/results.ts` | Model finding labels are discarded and replaced by the snapshotted numeric checklist identity before packet validation. |

## Self-Check: PASSED

- All four Plan 03 source/test files and this summary exist.
- Task commits are present: `137b52d3`, `33eaaa4a`, `2ea17848`, `f1891665`, `70f4a7be`.
- Focused adversarial tests and TypeScript diagnostics passed.
- No network, database, provider, model, or external credential calls were used.
