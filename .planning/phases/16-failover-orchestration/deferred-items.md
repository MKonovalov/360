# Deferred Items — Phase 16 Failover Orchestration

Pre-existing issues discovered during execution that are out of scope for the
task that discovered them (not caused by that task's changes). Logged per
executor scope-boundary rules, not auto-fixed.

## From Plan 16-04 (`npm run lint`, discovered during Task 1 verification)

Pre-existing lint errors in the file modified by Plan 16-04 (verified present in
HEAD before this plan's changes):

- `src/components/agents/analyze-run-status.tsx:69/76` — `react-hooks/immutability`:
  `run` (an `async function` declaration at L76) is referenced inside the
  `useEffect` body's `handleStart` (L69 `void run()`) before its declaration.
  This pattern predates Plan 16-04 — the effect, `handleStart`, and the `run`
  declaration order were untouched by this plan's diff. The same rule is already
  logged for `sidebar-resize-handle.tsx` in the Phase 02 deferred-items and is a
  known repo-wide baseline (also fires in `app-sidebar.tsx`, `use-mobile.ts`).
  Recommended: fix in a follow-up cleanup plan (hoist `run` above the effect or
  wrap in `useCallback`), not blocking this phase's completion.
