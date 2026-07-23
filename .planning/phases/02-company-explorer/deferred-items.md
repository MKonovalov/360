# Deferred Items — Phase 02 Company Explorer

Pre-existing issues discovered during execution that are out of scope for the
task that discovered them (not caused by that task's changes). Logged per
executor scope-boundary rules, not auto-fixed.

## From Plan 02-04 (`npm run lint`, discovered during Task 2 verification)

Pre-existing lint errors in files not touched by Plan 02-04 (originate from
Plans 02-02/02-03):

- `src/app/page.tsx:37` — `@next/next/no-html-link-for-pages`: raw `<a>` used to navigate to `/sign-in/`, should be `next/link`'s `<Link />`.
- `src/components/layout/sidebar-resize-handle.tsx:33` — `react-hooks/immutability`: `handlePointerUp` referenced (in a `removeEventListener` cleanup) before its `useCallback` declaration.
- `src/hooks/use-mobile.ts:14` — `react-hooks/set-state-in-effect`: `setIsMobile` called synchronously inside a `useEffect` body rather than only via the `mql` change-listener callback.

None of these three files are in Plan 02-04's `files_modified` list; none of Plan 02-04's tasks read or wrote them. Recommended: fix in a follow-up chore pass (Phase 3 kickoff or a dedicated cleanup plan), not blocking this phase's completion.
