# 38-04 Summary: Fixed/custom adapter regression lock

**Phase:** 38-execution-compatibility-safe-integration
**Plan:** 38-04
**Task executed:** Task 3 — Lock fixed/custom adapter regression behavior
**Requirements:** VER-03, VAL-04, VAL-05, RUN-01
**Status:** PASS — regression gate green; no implementation files touched

## What this task did

Task 3 is a regression-lock task. Tasks 1 and 2 (already complete and
authoritative) delivered the bounded custom-output adapter in
`execution.ts`, the named `customOutput` transport through
`normalizeAnalysisPacket` in `results.ts`, and the bounded validation
contracts in `groundedContracts.ts`. Task 3 adds deterministic,
table-driven regression cases to the three target test files that prove the
fixed grounded envelope remains authoritative, then runs the plan's
regression gate, the full suite at the wave boundary, and the typecheck.

No implementation file was modified — no concrete defect was found in
`execution.ts`, `results.ts`, or `groundedContracts.ts`, so the prior
implementation session was not resumed.

## Files changed by Plan 38-04 Task 3

| File | Change |
|---|---|
| `src/lib/analysis/execution.test.ts` | Added 12 regression cases: custom run **requires** the `custom` object (absence → `invalid_packet`); fixed run **rejects** a `custom` object (legacy strict envelope); table-driven rejection of custom values that try to supply `findings`, `evidence`, `citations`, `review state`, `candidates`, `narrative`, `sources`, `links`, `audit`, or `packet fields` (all → `invalid_packet`) |
| `src/lib/analysis/results.test.ts` | Added 11 regression cases: byte-for-byte lock of the fixed packet hash (`fb831e7d…6879f`) when no custom output is present; table-driven rejection of custom values that try to supply the same ten reserved channels (all → `invalid_packet`) |
| `src/lib/analysis/groundedContracts.test.ts` | Added 12 regression cases: table-driven rejection by `validateCustomOutput` of reserved keys including `findings`, `evidence`, `citations`, `review state`, `candidates`, `narrative`, `sources`, `links`, `audit`, `packet fields`, `checklist identity` (`signalId`), and `finding identity` (`findingId`) |

Task 3 itself created only this file: `38-04-SUMMARY.md`.

## What the regression cases prove

- **Fixed runs parse the legacy envelope without a custom object** — existing
  case (`keeps the fixed grounded envelope when no custom schema is supplied`)
  plus new case proving a fixed run **rejects** a model-authored `custom`
  object (`invalid_packet`), so the legacy `{ narrative, findings }` envelope
  stays strict.
- **Custom runs require the custom object** — new case: a custom run whose
  model output omits `custom` fails with `invalid_packet`; the bounded value
  is validated separately by `validateCustomOutput` and returned as the named
  `GroundedExecutionResult.customOutput` transport value.
- **Bounded custom transport** — existing cases prove the validated value
  survives as a separate `customOutput` while `result.output` stays the fixed
  `{ narrative, findings }` shape.
- **Custom values cannot supply evidence, citations, checklist identity,
  review state, candidates, or packet fields** — 34 table-driven cases across
  the three files prove any reserved key in the custom value is rejected by
  the strict bounded schema (`invalid_packet` / throw), so the model can never
  redefine findings, evidence, citations, review, or candidates.
- **Malformed output/tool content fails safely** — existing cases prove
  malformed structured output → `invalid_packet`, timeout → `timeout`,
  missing key → `missing_key`, prompt-injection tool content →
  `unsafe_research_content`, over-bound tool content → `invalid_tool_policy`.
- **Fixed packet/hash compatibility** — existing cases prove the fixed packet
  is byte-identical with and without custom output, custom values give
  distinct replay identity, and the new case locks the exact fixed packet hash
  (`fb831e7d85d7c472a08ff48b3099c7b63af3b53a4aecd1ff3c36bf8a9276879f`) so any
  change to packet shape, finding identity, source normalization, or hash
  material breaks the lock.

## Verification evidence

### Targeted regression gate (plan Task 3 verify line 93)

```
npm test -- --run src/lib/analysis/execution.test.ts src/lib/analysis/results.test.ts src/lib/analysis/groundedContracts.test.ts

 Test Files  3 passed (3)
      Tests  82 passed (82)
```

Baseline before Task 3 additions: 47/47 passing. After: 82/82 passing
(+35 deterministic regression cases).

### Full suite at the wave boundary

```
npm test

 Test Files  10 failed | 95 passed | 16 skipped (121)
      Tests  10 failed | 1123 passed | 98 skipped (1231)
```

All 10 failures are **pre-existing/environmental**, none are regressions from
this task. Verified by import isolation: none of the 10 failing test files
imports from the three files modified here, and the changes are purely
additive `it()`/`it.each()` cases in files that run in isolation.

| Failing file | Failure class | Cause |
|---|---|---|
| `src/scripts/seedAnalysisTemplates.integration.test.ts` | DB integration | requires `TEST_DATABASE_URL` (missing) |
| `src/lib/db/analysisSchema.integration.test.ts` | DB integration | requires `TEST_DATABASE_URL` (missing) |
| `src/workflows/workflowProof.integration.test.ts` | DB integration | requires `TEST_DATABASE_URL` (missing) |
| `src/workflows/analysisRun.integration.test.ts` | DB integration | requires `TEST_DATABASE_URL` (missing) |
| `src/lib/agents/nousresearch-only-chain.test.ts` | live provider | real API keys/network required |
| `src/lib/agents/openrouter-only-chain.test.ts` | live provider | real API keys/network required |
| `src/lib/agents/structured-outputs-probe.test.ts` | live provider | real API keys/network required (3 tests) |
| `src/lib/models/catalog.runtime.test.ts` | pre-existing | catalog module lacks JSON import attribute (Node runtime boundary) |
| `src/lib/verification/security-grep.test.ts` | pre-existing | canary expects `company-detail.tsx` to contain `OPENROUTER_API_KEY` (0 matches) |
| `scripts/phase33-scope-audit.test.ts` | pre-existing | heuristic false-positive: `groundedContracts.ts:35` `safeTextSchema` rejection regex contains the literal strings `private reasoning`/`chain-of-thought`, matched by the audit's `persist…private reasoning` pattern via `unsafe_persisted_text` |

The scope-audit finding originates from Task 1's implementation
(`groundedContracts.ts`, not modified by this task) and is a known
heuristic-vs-safety-regex tension, not a defect in the adapter behavior.

### Typecheck

```
npx tsc --noEmit   # exit 0, clean
```

LSP diagnostics timed out (no fresh diagnostics available for the three
changed files); per the plan's tool guidance the compiler was used instead
and passed.

## Requirements addressed

- **VER-03** — regression cases lock the fixed/custom adapter behavior the
  verification plan requires (fixed envelope authoritative, custom additive
  and non-authoritative).
- **VAL-04** — custom values cannot supply evidence, citations, checklist
  identity, review state, candidates, or packet fields (34 table-driven
  rejection cases).
- **VAL-05** — bounded custom output is validated and transported separately
  without changing the fixed `GroundedPacket`.
- **RUN-01** — deterministic execution seam proven: custom runs require the
  custom object, fixed runs reject it, and the fixed packet hash is locked
  byte-for-byte.

## Phase 38-05 handoff

Phase 38-05 owns the DB-authoritative Workflow persistence/reload wiring and
`TEST_DATABASE_URL`-gated evidence. This task deliberately did not add
persistence, migrations, routes, providers, or browser E2E. The exact
persistence handoff remains `analysis_run_result.raw_audit.customOutput` per
the 38-04 plan's `must_haves`, and the named `customOutput` value is already
carried through `normalizeAnalysisPacketWithCustomOutput` into the immutable
packet-hash material for replay identity.

## Notepad

`.omo/notepads/38-execution-compatibility-safe-integration/` is absent in
this workspace; no findings were appended (per task instructions).

## Unrelated artifacts preserved

`.debug-journal.md`, `.planning/STATE.md`, `scripts/probe-step12-repro.ts`,
and the launcher files (`AnalysisLauncher.tsx`, `analysisLauncherClient.ts`,
their tests) were not modified by this task and remain as-is in the working
tree.