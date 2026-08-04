---
phase: 27-verification-gate
plan: 02
subsystem: ai-agents
tags: [vitest, ai-sdk, openai-compatible, structured-outputs, modelFactory, nousresearch, opencode]

# Dependency graph
requires:
  - phase: 25-run-path-modelfactory-seam
    provides: the 3 openai-compatible module-singleton instances (nousresearch, openaiCompatibleZen, openaiCompatibleGo) with supportsStructuredOutputs deliberately unset (D-25-03)
provides:
  - A live-key-gated Vitest probe (structured-outputs-probe.test.ts) that round-trips the REAL production outputSchema against each of the 3 new openai-compatible instances via generateText/Output.object, per-instance skip-guarded
  - Named exports of the 3 raw modelFactory instances (nousresearch, openaiCompatibleZen, openaiCompatibleGo) for the probe test to import
  - Dated, per-instance comments in modelFactory.ts recording each probe's outcome (all 3 skipped in this execution environment — no live keys), so the supportsStructuredOutputs flag stays honestly documented rather than silently unset
affects: [27-06-verification-summary, future-re-probe-with-live-keys]

# Tech tracking
tech-stack:
  added: []
  patterns: [per-instance describe.skipIf live-key probe (never a shared hasLiveKeys), .languageModel(id, { supportsStructuredOutputs: true }) per-call override for probing before a permanent constructor flip]

key-files:
  created: [src/lib/agents/structured-outputs-probe.test.ts]
  modified: [src/lib/agents/modelFactory.ts]

key-decisions:
  - "All 3 probes skipped in this worktree (no NOUSRESEARCH_API_KEY/OPENCODE_API_KEY locally available) — per D-27-06 this is a legitimate per-instance outcome, not a failure; each instance's supportsStructuredOutputs flag stays unchanged (implicitly false, json_object fallback) with a dated comment, never force-flipped"

patterns-established:
  - "structured-outputs-probe.test.ts: first-of-its-kind live capability probe in this repo — forces supportsStructuredOutputs: true at the per-call .languageModel() override to test the real endpoint's json_schema support BEFORE any permanent constructor-level flip, keeping the probe fully reversible/re-runnable"

requirements-completed: [VER-05]

# Metrics
duration: 13min
completed: 2026-08-04
---

# Phase 27 Plan 02: RUN-06 Live structuredOutputs Probe Summary

**Live-key-gated Vitest probe round-trips the real production outputSchema against nousresearch/opencode-zen/opencode-go via generateText/Output.object; all 3 probes skipped in this isolated worktree (no live keys), so each instance's supportsStructuredOutputs flag stays honestly documented at false pending a re-probe with credentials.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-08-04T22:42:47+02:00
- **Completed:** 2026-08-04T22:55:54+02:00
- **Tasks:** 2 completed
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments
- Created `structured-outputs-probe.test.ts`: 3 independent `describe.skipIf` blocks (per-instance `NOUSRESEARCH_API_KEY`/`OPENCODE_API_KEY` guards — never a shared skip flag), each forcing `supportsStructuredOutputs: true` via the per-call `.languageModel(id, { supportsStructuredOutputs: true })` override and asserting `outputSchema.safeParse(result.output).success === true` against the REAL production schema from `types.ts`
- Exported the 3 raw `createOpenAICompatible` instances (`nousresearch`, `openaiCompatibleZen`, `openaiCompatibleGo`) from `modelFactory.ts` for the probe to import — the only change to those 3 declarations; `instantiateModel`'s dispatch logic and `anthropicZen`/`anthropicGo`/`openrouter` untouched
- Ran the probe locally: all 3 cases legitimately skipped (this worktree has no `.env.local`, so neither `NOUSRESEARCH_API_KEY` nor `OPENCODE_API_KEY` is set) — recorded per-instance, dated comments in `modelFactory.ts` at each constructor call site documenting the skip outcome, per D-27-06's "skipped (key absent) stays false" guidance
- `npx tsc --noEmit` clean; full suite 448 passed / 10 skipped (7 pre-existing skips + 3 new probe skips), no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the live structuredOutputs probe + export the 3 raw instances** - `eed08d63` (test)
2. **Task 2: Apply the per-instance supportsStructuredOutputs flip based on real probe results** - `bd4cc523` (docs)

**Plan metadata:** (pending — created by this SUMMARY commit)

## Files Created/Modified
- `src/lib/agents/structured-outputs-probe.test.ts` - 3 independent live-key-gated probes proving (or not) each openai-compatible instance's json_schema support against the real production outputSchema
- `src/lib/agents/modelFactory.ts` - 3 `const` → `export const` (no other change to Task 1); Task 2 added a dated per-instance comment at each of the 3 constructor call sites recording the probe outcome; flag left unchanged (false) on all 3 since all probes skipped locally

## Decisions Made
- All 3 probes skipped rather than passed/failed, because this isolated worktree checkout has no `.env.local` (gitignored, not part of the worktree). This is the exact "key absent" branch the plan anticipated (D-27-06/Task 2 acceptance criteria) — the flag was left unchanged with a dated comment rather than assumed-flipped. No live network calls were made from this worktree.

## Deviations from Plan

None - plan executed exactly as written. The plan's Task 2 explicitly anticipates and provides the correct handling for a skipped-probe outcome ("If its probe FAILED or SKIPPED (key absent locally), leave the constructor unchanged... add a comment noting the outcome... e.g. 'RUN-06: probe skipped (no local key) — stays false until re-probed'"), which is exactly what was applied to all 3 instances.

## Issues Encountered
- This worktree ships without `node_modules` and without `.env.local` (both gitignored, neither part of the git-tracked worktree checkout). Ran `npm install` to get a working `node_modules` for `vitest`/`tsc`. No `.env.local` means the 3 live probes cannot exercise real network calls in this environment — this is an environmental limitation of the isolated worktree, not a code defect. The probe file and modelFactory changes are correct and ready to be re-run with live keys in an environment that has `.env.local` populated (e.g. the main checkout) to produce a real pass/fail per instance and, per D-27-05, flip any instance that passes.

## User Setup Required

None - no external service configuration required for this plan itself. **Recommended follow-up (not blocking this plan):** re-run `npx vitest run src/lib/agents/structured-outputs-probe.test.ts` in an environment with `.env.local` populated (`NOUSRESEARCH_API_KEY`, `OPENCODE_API_KEY`) to get real per-instance pass/fail results, then flip `supportsStructuredOutputs: true` on any instance whose probe passes (per-instance, per D-27-06), replacing that instance's "skipped" comment with a "probed, passed" comment and the flag.

## Next Phase Readiness
- The probe infrastructure is complete, correct, and ready to run — Plan 27-06's VERIFICATION.md can cite this plan's mechanism (per-instance live probe + per-call override before a permanent flip) as delivered.
- **Carried-forward item for Plan 27-06 / operator follow-up:** the actual live pass/fail/flip has not yet happened due to this worktree's lack of live credentials. Someone with `.env.local` populated needs to re-run the probe and apply any resulting flips before VER-05/RUN-06 can be marked as having a genuinely-tested `true` flip (as opposed to a documented-skip `false`). This does not block this plan's own completion (all must-haves — the probe existing, exporting the 3 raw instances, and per-instance flag decisions being real-probe-driven rather than assumed — are satisfied; "assumed" here means the flag reflects an ACTUAL skip result, not a guess).

---
*Phase: 27-verification-gate*
*Completed: 2026-08-04*

## Self-Check: PASSED

- FOUND: src/lib/agents/structured-outputs-probe.test.ts
- FOUND: .planning/phases/27-verification-gate/27-02-SUMMARY.md
- FOUND commit: eed08d63 (Task 1)
- FOUND commit: bd4cc523 (Task 2)
- FOUND commit: 35dfa90a (SUMMARY)
