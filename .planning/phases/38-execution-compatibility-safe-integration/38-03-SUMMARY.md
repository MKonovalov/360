# 38-03 Summary: Launcher regression + project build gate

**Phase:** 38-execution-compatibility-safe-integration
**Plan:** 38-03
**Task executed:** Task 3 — Run launcher regression and project build gate
**Requirements:** VAL-02, VAL-03, RUN-01
**Status:** PASS — no defects found, no source files touched

## What this gate did

Task 3 is a verification-only gate. It runs the complete launcher/client focused
test matrix and the project build, then inspects the final diff for accidental
client authority, template-picker regressions outside the locked custom picker,
or a second execution/provider/tool import path. No implementation files were
modified — Tasks 1 and 2 (already complete) delivered the code; this task
confirms it holds together and creates this summary.

## Files changed by Plan 38-03 (Tasks 1+2, verified by Task 3)

| File | Change |
|---|---|
| `src/components/analysis/analysisLauncherClient.ts` | Two-step options contract (`fetchAnalysisOptions(subjectType, practiceAreaId?, signal)`), discriminated `AgentSelection` (`fixed` \| `custom`), `createAnalysisRunPayload` builds opaque fixed (flat, no `selection` wrapper) or custom (`{selection: {kind:'custom', customAgentId, templateVersionId}}`) payloads only |
| `src/components/analysis/AnalysisLauncher.tsx` | Practice-Area-first flow: initial `fetchAnalysisOptions(subjectType, undefined, signal)` renders only the Practice Area selector; on Practice Area change, follow-up `fetchAnalysisOptions(subjectType, practiceAreaId, signal)` renders the agent picker (fixed first, defaulted; custom matches require explicit staff selection) |
| `src/components/analysis/AnalysisLauncher.test.tsx` | Component regression coverage: initial-request-shape, no-agent-picker-before-follow-up, fixed-first-default, explicit-multiple-custom-choice, preview/launch payload wiring, existing abort/generation/polling behavior preserved |
| `src/components/analysis/analysisLauncherClient.test.ts` | Client parser tests: initial/follow-up URL shape, response variants, fixed-omission compatibility, valid custom identity/version, malformed options, multiple matches, and all forbidden fields (see below) |

Task 3 itself created only this file: `38-03-SUMMARY.md`.

## Diff inspection (client authority / second execution path)

Reviewed `git diff -- src/components/analysis/AnalysisLauncher.tsx src/components/analysis/analysisLauncherClient.ts` in full plus a `codegraph_explore` of the launcher/client call graph (`AnalysisLauncher` → `loadOptions` → `fetchAnalysisOptions`; sole caller of `AnalysisLauncher` is `enrichment-review-dialog.tsx`, unchanged).

- **Imports** — `AnalysisLauncher.tsx` imports only: React/Next hooks, `@/lib/analysis/experienceContracts` (response schema), `@/components/ui/*` (Dialog/Button/Select), `./AnalysisPreviewPanel`, `@/lib/analysis/pollingClient` (existing `pollAnalysisRun`/`isTerminalAnalysisStatus`), and `./analysisLauncherClient`. `analysisLauncherClient.ts` imports only `zod` and `@/lib/analysis/experienceContracts`. **No direct execution/provider/tool/model imports in either file.**
- **No second execution path** — the only network calls are the existing three: `GET /api/analysis-options`, `POST /api/analysis-preview`, `POST /api/analysis-runs`, plus the pre-existing `pollAnalysisRun` (scalar `applicationRunId` polling, unchanged). No new fetch target, no client-side execution, no bypass of server re-resolution.
- **Forbidden-field discipline** — `createAnalysisRunPayload`/`createAnalysisPreviewPayload` build the request object with explicit named fields only (never object-spread from the selection), so no extra property on `AgentSelection` can leak into the wire payload. `analysisLauncherClient.test.ts` asserts (lines ~185-231) that `instruction`, `researchQuery`, `outputSchema`, `capabilityPresetIds`, `actorId`, `effort`, `effortOverride`, `modelChain`, `budget`, `policy`, `provider`, `tool`, `credential`, and `dataSource` are all absent from both fixed and custom payloads.
- **Fixed compatibility** — fixed selection produces the exact legacy flat shape `{ templateVersionId, subject, practiceAreaId }` (no `selection` wrapper), matching D-38-03/D-38-06. `defaultAnalysisAgentKey` auto-selects fixed only; custom is never auto-selected (`analysisAgentSelection`/agent-picker logic requires an explicit `selectedAgentKey`).
- **Custom path** — carries only opaque `{ kind: 'custom', customAgentId, templateVersionId }` plus `subject`/`practiceAreaId`; server re-resolution of the custom agent's active version remains server-owned (unchanged server route, not touched in Plan 38-03).
- **Scalar `applicationRunId` polling** — `startPolling`/`pollAnalysisRun` call sites are byte-identical to pre-Plan-38-03 behavior; only the launch payload construction changed.

No accidental client authority or duplicate execution path found. **No source edit was required; original Task 2 session `ses_00d9772b9ffey2IEuPcImqFegr` was not resumed.**

## Verification evidence

### `git status --short` / `git diff --stat`
```
 M .debug-journal.md
 M .planning/STATE.md
 M src/components/analysis/AnalysisLauncher.test.tsx
 M src/components/analysis/AnalysisLauncher.tsx
 M src/components/analysis/analysisLauncherClient.ts
?? scripts/probe-step12-repro.ts
?? src/components/analysis/analysisLauncherClient.test.ts

 .debug-journal.md                                 | 428 ++++++++++++++++++++++
 .planning/STATE.md                                |  14 +-
 src/components/analysis/AnalysisLauncher.test.tsx | 147 +++++++-
 src/components/analysis/AnalysisLauncher.tsx      | 231 ++++++++++--
 src/components/analysis/analysisLauncherClient.ts | 107 +++++-
 5 files changed, 876 insertions(+), 51 deletions(-)
```
`.debug-journal.md`, `.planning/STATE.md`, and `scripts/probe-step12-repro.ts` are known **pre-existing, unrelated artifacts** from prior sessions (per Plan 38-03 context) — not touched by this gate, not part of Plan 38-03's `files_modified` list.

### TypeScript LSP
`typescript` LSP server is not installed (previously declined by user). Confirmed via `lsp_diagnostics` on both changed `.ts`/`.tsx` files — both returned "NOT INSTALLED; user previously declined installation." The compiler/build is the available type gate (see below); this matches the inherited-wisdom note from Task 2.

### Focused Vitest matrix
```
$ npm test -- --run src/components/analysis/AnalysisLauncher.test.tsx src/components/analysis/analysisLauncherClient.test.ts

 Test Files  2 passed (2)
      Tests  62 passed (62)
   Start at  22:19:49
   Duration  693ms
```
**PASS — 62/62.**

### Project build (`npm run build`)
```
$ npm run build

▲ Next.js 16.2.11 (Turbopack)
✓ Compiled successfully in 8.8s
  Running TypeScript ...
  Finished TypeScript in 9.8s ...
✓ Generating static pages using 11 workers (21/21) in 442ms
  Finalizing page optimization ...
```
**PASS.** Build includes a full `next build` TypeScript compile pass (9.8s), which is the type gate substituting for the unavailable standalone LSP. No errors, no warnings related to the changed files. Route table unchanged — no new routes introduced (`/api/analysis-options`, `/api/analysis-preview`, `/api/analysis-runs`, `/api/analysis-runs/[id]` all pre-existing).

## Playwright / authenticated UAT limitation

Per inherited wisdom from Task 2: local Playwright previously reached `http://localhost:3001/companies` (title "ArcLumen 360", 0 console errors, 1 warning) but **authenticated launcher interaction was not available** (no Clerk credentials/storage state in this environment). This gate did **not** attempt authenticated browser E2E and does **not** claim visual/authenticated Company or Persona launcher proof — that remains explicitly out of scope per the plan (`<verification>`: "Visual/authenticated Company and Persona proof is not claimed here; Phase 39 owns it and missing Clerk credentials remain blocked/not-run"). No `TEST_DATABASE_URL`-backed integration/database proof is claimed either.

## Requirements disposition

| Requirement | Status | Evidence |
|---|---|---|
| VAL-02 (fixed compatibility preserved) | ✅ Verified | Flat legacy payload shape confirmed in code + tests; 62/62 pass |
| VAL-03 (custom path server re-resolution only) | ✅ Verified | Opaque identity/version only on wire; no client authority found in diff/import inspection |
| RUN-01 (scalar `applicationRunId` polling intact) | ✅ Verified | `startPolling`/`pollAnalysisRun` call sites unchanged from pre-38-03 |

## Phase 39 handoff (explicit)

Plan 38-03 (and Phase 38 overall, for the launcher/client surface) is **build-green and test-green** with no client-side authored execution configuration and no second execution path. The following remain **explicitly deferred to Phase 39** and were **not** attempted here:

1. **Authenticated browser E2E** for the Company and Persona launcher flows (Clerk sign-in, Practice-Area-first dialog interaction, fixed-default and explicit-custom-selection through the live UI).
2. **Settled result/review/candidate proof** — confirming a launched analysis run reaches a terminal state and its review/candidate output surfaces correctly end-to-end.
3. Any database-backed integration proof requiring `TEST_DATABASE_URL` (not available in this environment; not attempted).

No new dependencies were added. No unrelated artifacts (`.debug-journal.md`, `.planning/STATE.md`, `scripts/probe-step12-repro.ts`) were modified by this gate.
