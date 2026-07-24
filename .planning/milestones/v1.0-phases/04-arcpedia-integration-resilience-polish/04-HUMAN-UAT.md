---
status: partial
phase: 04-arcpedia-integration-resilience-polish
source: [04-VERIFICATION.md]
started: 2026-07-24T14:05:00Z
updated: 2026-07-24T14:05:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Persona 360 view showing real Arcpedia articles

expected: At least one live Persona 360 view demonstrably shows real Arcpedia content — closing the literal wording of 04-02-PLAN.md's must_haves truth #2 ("At least one Company and one Persona 360 view demonstrably show real Arcpedia articles end-to-end").

Test: Find or seed a Persona whose `name` matches real Arcpedia content (search Arcpedia's own UI directly for a candidate name first), open that Persona's 360 detail view, and confirm the "Related Knowledge" section renders up to 3 real articles with working new-tab links.

Why human: Re-querying all 10 current seed personas live against Arcpedia's real `/api/wiki/search` endpoint during verification returned zero matches for every one. The code path (`fetchArcpediaArticles(persona.name)`) is structurally identical to the Company path, which was independently proven working live during this verification (8/9 seed companies returned real matches). This is very likely a synthetic-seed-data content gap, not a code defect — confirming that requires either updating seed data or accepting the gap as a data-availability limitation, a product/data decision.

result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
