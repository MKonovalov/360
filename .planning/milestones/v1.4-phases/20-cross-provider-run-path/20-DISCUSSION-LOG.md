# Phase 20: Cross-Provider Run Path - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-02
**Phase:** 20-cross-provider-run-path
**Areas discussed:** Cross-provider gate UX, Mid-stream 429 handling, 429 helper scope, Error reason surfacing

---

## Cross-provider gate UX

| Option | Description | Selected |
|--------|-------------|----------|
| Name the missing key | Structured not_configured naming exactly which key is missing | ✓ |
| Bare not_configured | No key name — simpler but user can't tell which provider to configure | |
| Key name + hint | Key name AND a hint about where to set it — most verbose | |

**User's choice:** Name the missing key
**Notes:** All-or-nothing at entry (not primary-only); FIRECRAWL_API_KEY stays as a hard requirement alongside provider keys; gate-only (no Settings UI surface in Phase 20).

---

## Mid-stream 429 handling

| Option | Description | Selected |
|--------|-------------|----------|
| Accept + document | Keep 'output' classification, add code comment + telemetry note | ✓ |
| Detect + reclassify | Detect finish_reason:"error" and reclassify as rate_limited — riskier within budget | |
| Reclassify + hop-aware | Reclassify AND make it hop-aware — highest effort, most behavior change | |

**User's choice:** Accept + document
**Notes:** Comment-only depth (no distinct stream_aborted reason code); Phase 22's error matrix records the expected behavior.

---

## 429 helper scope

| Option | Description | Selected |
|--------|-------------|----------|
| Diagnostics only | Helper informs telemetry + reason string only; decision = pure provider matrix | ✓ |
| Gates the cross-provider hop | Helper gates OR→Anthropic hop (platform-level allows, upstream pass-through blocks) | |

**User's choice:** Diagnostics only
**Notes:** Separate loop-side helper, NOT inside the pure classifier (keeps D-16 zero-live-call tests intact).

---

## Error reason surfacing

| Option | Description | Selected |
|--------|-------------|----------|
| Distinct HTTP statuses | not_configured→400, rate_limited→429, billing→402, gate_failed→422 | ✓ |
| Generic 502 + reason string | Simpler route, UI can't branch on status | |

**User's choice:** Distinct HTTP statuses
**Notes:** Structured reason strings (billing = "provider credits exhausted"); only the NEW classes get distinct statuses — existing 502 analysis_failed propagation untouched.

---

## Claude's Discretion

- Exact reason-string wording for billing / not_configured
- `shouldAdvance` signature + composition with `isFailoverEligible`
- 4-cell Vitest matrix file placement + fixture style
- FAL-05 audit column population mechanics (Phase 19 already wired instantiateChain/defaultChain)
- 502/503 comment wording in the classifier

## Deferred Ideas

- Mid-stream 429 detection/reclassification (revisit only if telemetry misleads)
- Distinct `stream_aborted` reason code
- Settings-side missing-key warning (Phase 21)
- Full status map for all error classes
