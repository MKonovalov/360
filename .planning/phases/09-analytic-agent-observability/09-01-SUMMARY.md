---
phase: 09-analytic-agent-observability
plan: 01
subsystem: ai
tags: [ai-sdk, anthropic, firecrawl, langfuse, neon, drizzle, zod, vitest]

# Dependency graph
requires:
  - phase: 07-csv-import
    provides: company.domain dedup-key foundation + live-signal data flow (listSignalsForCompany pre-scoping)
  - phase: 08-enrichment-api
    provides: env-gate patterns (arcpedia fail-loud precedent), vitest suite infrastructure, Neon DB access patterns
provides:
  - signal_proposal / agent_run / correction tables + unique index signal(company_id, signal_type)
  - Five optional server-only Phase-9 env keys (degrade gracefully, never crash at import)
  - Langfuse telemetry bootstrap (initLangfuse test-guarded, getTraceUrl, mirrorCorrectionAnnotation)
  - Fail-closed AIRS gate port (5 rules) + sample-valid.json canonical fixture
  - Agent core seam: single-source zod types, env-gated Firecrawl webSearch tool, prompt builder, flat v7 runAgent, pure dedup
affects: [09-02 (analyzeCompany route + proposal accept), 09-03 (review/correction flows)]

# Tech tracking
tech-stack:
  added:
    - ai@7.0.45 (generateText, tool, isStepCount, Output.object — flat tool-loop contract)
    - @ai-sdk/anthropic (claude-sonnet-4-20250514 fast-model default)
    - firecrawl v4 (webSearch tool, SearchResultWeb|Document union mapping)
    - langfuse (telemetry bootstrap; initLangfuse guarded so tests never register)
  patterns:
    - Mockable agent seam: vi.hoisted + vi.mock('ai') spreading the real module, overriding generateText/Output.object — zero live calls (D-16)
    - Single-source-of-truth zod shapes in agents/types.ts, re-exported by validation/airsRules.ts (plan L158)
    - Fail-loud tool factory with lazy client (diverges from arcpedia.ts silent-`[]` envelope, D-06/Pitfall 5)

key-files:
  created:
    - src/lib/agents/types.ts — single source of truth: signalTypeValues/signalStrengthValues, reliability/confidence schemas, proposalSignalSchema, evidenceAppendixSchema, outputSchema, CompanyInput, LiveSignalInput
    - src/lib/agents/prompt.ts — buildAnalyzePrompt (D-11 skip list, D-02 no-fabrication rule, D-07 lean)
    - src/lib/agents/dedup.ts — dedupProposals + alreadyCoveredSignalTypes (pure)
    - src/lib/agents/tools.ts — env-gated Firecrawl webSearch tool mapping v4 union
    - src/lib/agents/runAgent.ts — flat v7 generateText seam returning raw { output, usage, steps }
    - src/lib/telemetry/langfuse.ts — initLangfuse (test-guarded), getTraceUrl, mirrorCorrectionAnnotation
    - src/lib/validation/fixtures/sample-valid.json — canonical gate fixture (verbatim port)
    - src/lib/validation/airsRules.test.ts — fixture-driven gate tests
    - src/lib/agents/runAgent.test.ts — seam contract tests (9 assertions incl. Output.object spy)
    - src/lib/agents/dedup.test.ts — pre/post dedup cases incl. within-set
  modified:
    - src/lib/db/schema.ts — signal_proposal/agent_run/correction tables, proposalStatusEnum, correctionReasonEnum, unique index
    - src/lib/env.ts — 5 optional Phase-9 keys
    - src/lib/validation/airsRules.ts — shapes re-exported from agents/types.ts; rules import used schemas locally
    - src/lib/validation/validateReport.ts — fail-closed gate over the 5 ported rules
    - package.json / package-lock.json — ai, @ai-sdk/anthropic, firecrawl, langfuse
    - .env.example — new optional keys documented

key-decisions:
  - "Flat v7 generateText contract for the agent seam — plan L190-195's ToolLoopAgent/agent:/result.object syntax is stale for ai@7.0.45; the flat contract runs the same tool loop via stopWhen + tools and is what the RED tests pin"
  - "Shared output shapes single-sourced in src/lib/agents/types.ts; airsRules.ts re-exports them (plan L158 — gate validates the SAME schemas the model emits against)"
  - "Firecrawl v4 results read from res.web union (SearchResultWeb | Document) via 'url' in narrowing; plan's res.data shape is v1-era"
  - "maxDuration omitted — not a v7 generateText option; cost control (T-09-05) via stopWhen isStepCount(12) + lean prompt (D-07)"
  - "Output.object runtime spec has no top-level schema key — test pins schema wiring on the factory spy instead of the returned spec"

patterns-established:
  - "Pattern 1: agent seam test pattern — vi.hoisted mocks + vi.mock('ai', spread-actual) so tool/isStepCount stay real while generateText/Output.object are spied"
  - "Pattern 2: single-source zod shape re-export — types.ts owns the schemas, consumers re-export for a stable import surface"
  - "Pattern 3: fail-loud lazy tool client — unset env key throws at first execute (not silent empty results)"

requirements-completed: [ANLZ-01, ANLZ-02, ANLZ-05]

# Metrics
duration: 80min
completed: 2026-07-31
---

# Phase 09 Plan 01: Analytic Agent + Observability Foundation Summary

**Agent-core seam (flat ai@7 generateText + env-gated Firecrawl webSearch + single-source zod output schema), fail-closed AIRS gate port, and signal/agent-run/correction tables on Neon with optional server-only keys**

## Performance

- **Duration:** 1h 20m (22:06 → 23:26 +0200)
- **Started:** 2026-07-31T20:06:12Z
- **Completed:** 2026-07-31T21:26:42Z
- **Tasks:** 4 (all auto; TDD tasks 3 + 4)
- **Files modified:** 16

## Accomplishments
- Task 1: `signal_proposal`, `agent_run`, `correction` tables + `proposalStatusEnum`/`correctionReasonEnum` + unique index `signal(company_id, signal_type)` (race guard, T-09-07)
- Task 2: five optional server-only Phase-9 env keys (optional-degrade, never crash at import) + Langfuse telemetry bootstrap with test-guarded `initLangfuse()`
- Task 3: fail-closed AIRS gate ported to TS (every_citation_must_resolve, R/C enums in range, no-R3C3-on-strong, key_uncertainties non-empty, empty_signals_implies_no_intent) validated against the verbatim `sample-valid.json` fixture
- Task 4: agent core GREEN — single-source zod types, env-gated fail-loud Firecrawl webSearch tool, `buildAnalyzePrompt` (D-11 skip list + D-02 no-fabrication), flat v7 `runAgent` seam returning raw `{ output, usage, steps }`, pure `dedupProposals`; runAgent + dedup tests green with zero live calls (D-16)

## Task Commits

Each task was committed atomically:

1. **Task 1: DB schema** - `0dc10bfe` (feat)
2. **Task 2: deps + env keys + telemetry** - `f94449f4` (feat)
3. **Task 3: AIRS gate** - `af82a782` (test) → `7b630d8b` (feat)
4. **Task 4: agent core** - `bf804f17` (test) → `d9e87b5b` (test fix) → `025b3108` (feat)

**Plan metadata:** `(pending docs commit)`

_Note: TDD tasks 3 + 4 followed RED → GREEN with atomic test/feat commits._

## Files Created/Modified
- `src/lib/agents/types.ts` - Single source of truth for proposal/output schemas + CompanyInput/LiveSignalInput seams
- `src/lib/agents/runAgent.ts` - Flat v7 generateText seam (stopWhen isStepCount(12), Output.object), returns raw result
- `src/lib/agents/tools.ts` - Lazy fail-loud Firecrawl webSearch tool mapping `res.web` SearchResultWeb|Document union
- `src/lib/agents/prompt.ts` - buildAnalyzePrompt: skip list, no-fabrication citation rule, lean 60s-budget instruction
- `src/lib/agents/dedup.ts` - dedupProposals (live-signal + within-set dedup) and alreadyCoveredSignalTypes
- `src/lib/agents/runAgent.test.ts` - Seam contract tests: mocks 'ai'/'firecrawl'/env, asserts schema wiring + flat call shape
- `src/lib/agents/dedup.test.ts` - Pure dedup contract: drop-live, keep-rest, within-set-first
- `src/lib/validation/airsRules.ts` - Shapes re-exported from agents/types.ts; 5 ported gate rules kept local
- `src/lib/validation/validateReport.ts` - validateRunArtifacts: rejects on ANY rule violation (Pitfall 4)
- `src/lib/validation/airsRules.test.ts` - Fixture-driven gate tests (per-rule violations)
- `src/lib/validation/fixtures/sample-valid.json` - Canonical valid fixture (verbatim from standards repo)
- `src/lib/telemetry/langfuse.ts` - initLangfuse (import-guarded), getTraceUrl, mirrorCorrectionAnnotation
- `src/lib/db/schema.ts` - signal_proposal/agent_run/correction tables + unique index + enums
- `src/lib/env.ts` - 5 optional Phase-9 keys (ANTHROPIC_API_KEY, FIRECRAWL_API_KEY, LANGFUSE_*)
- `package.json` / `package-lock.json` - ai@7, @ai-sdk/anthropic, firecrawl, langfuse
- `.env.example` - New optional keys documented

## Decisions Made
- Flat v7 `generateText` contract for the agent seam (plan's `ToolLoopAgent`/`agent:`/`result.object` syntax is stale for ai@7.0.45 — verified in `node_modules/ai/dist/index.d.ts`); `isStepCount(12)` caps tool-loop iterations
- Shared output shapes single-sourced in `src/lib/agents/types.ts`; `airsRules.ts` re-exports (plan L158)
- Firecrawl v4 results read from `res.web` union (`SearchResultWeb | Document`) via `'url' in` narrowing — plan's `res.data` shape is v1-era
- `maxDuration` omitted (not a v7 generateText option); cost control via `stopWhen` + lean prompt (D-07)
- `Output.object` runtime spec has no top-level `schema` key — tests pin schema wiring on the factory spy

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] airsRules re-export left rule functions without local schema bindings**
- **Found during:** Task 4 (airsRules single-source rewire)
- **Issue:** After re-exporting shapes from `agents/types.ts`, `checkRCEnumsInRange`/`checkCitationsResolve`/etc. still referenced `reliabilitySchema`/`confidenceSchema`/`outputSchema` locally — `tsc` errored (TS2304/TS7006) and 6 gate tests failed with `ReferenceError: reliabilitySchema is not defined`
- **Fix:** Imported the used schemas into airsRules.ts scope locally alongside the re-export
- **Files modified:** src/lib/validation/airsRules.ts
- **Verification:** Full suite 179 passed / 2 skipped; `npx tsc --noEmit` clean
- **Committed in:** `025b3108` (part of Task 4 commit)

### Research-Verified Plan Divergences (documented, not bugs)

**2. Flat v7 contract instead of plan's ToolLoopAgent syntax** — plan L190-195 specified `new ToolLoopAgent(...)` + `generateText({ model, agent, ... })` + `result.object`. Verified `ToolLoopAgent` exists in ai@7.0.45 (class at index.d.ts:5149) but the flat `generateText({ model, tools, prompt, stopWhen, output })` contract is the native v7 path and is what the committed RED tests pin (`result.object`/`res.data` shapes don't exist on v7 returns).
**3. Firecrawl v4 `res.web` mapping** — plan L186 said `res.data.map(...)`; firecrawl v4 `search()` returns `SearchData.web?: Array<SearchResultWeb | Document>` (Document carries url/title/description inside `metadata`), mapped via `'url' in r` narrowing.
**4. `maxDuration` omission** — not a v7 `generateText` option (verified in d.ts); the `isStepCount(12)` cap + lean prompt is the implemented cost control for T-09-05.
**5. Output.object factory-spy pin** — v7 runtime spec has no top-level `schema` key (schema folds into `responseFormat`), so the RED test was realigned in `d9e87b5b` to assert the factory call + returned spec.

---

**Total deviations:** 1 auto-fixed (Rule 1) + 4 research-verified plan-syntax divergences
**Impact on plan:** All divergences necessary for correctness against the installed ai@7.0.45/firecrawl v4 APIs. No scope creep; the flat contract preserves the plan's intent (tool loop capped at 12 steps, structured output, zero live calls in tests).

## Issues Encountered
- airsRules rewire regression (6 gate tests + tsc failures) — root-caused to re-export-not-binding semantics, fixed with local imports (see Auto-fixed Issue 1)
- `Output.object` runtime spec mismatch surfaced during RED — realigned test to factory spy before GREEN (commit `d9e87b5b`)

## User Setup Required

None - no external service configuration required for tests. For live Analyze (Plan 02): set `ANTHROPIC_API_KEY`, `FIRECRAWL_API_KEY`, and `LANGFUSE_*` keys in Vercel (all optional — Analyze surfaces "not configured" when unset).

## Next Phase Readiness
- **Ready:** agent seam (`runAgent`), gate (`validateRunArtifacts`), dedup, env-gated tool, and the DB tables/unique index — all foundations for Plan 02's `analyzeCompany` (09-01-03) + proposal accept path
- **Noted:** `maxDuration` ceiling question (Vercel plan tier) remains open for the async strategy decision in Plan 02 planning — the current seam runs synchronously
- **Blockers:** none

---

*Phase: 09-analytic-agent-observability*
*Completed: 2026-07-31*

## Self-Check: PASSED
- Verified 15/15 created/modified files exist (agents/*, validation/*, telemetry/langfuse.ts, db/schema.ts, env.ts, SUMMARY)
- Verified 7/7 plan commits exist in git log: `0dc10bfe`, `f94449f4`, `af82a782`, `7b630d8b`, `bf804f17`, `d9e87b5b`, `025b3108`

