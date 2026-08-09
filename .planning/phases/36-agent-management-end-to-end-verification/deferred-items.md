# Deferred Items

- `npx tsc --noEmit` still reports three pre-existing fixture-shape errors in
  `src/lib/db/queries/analysisProposalDerivation.test.ts` (`demonstrated`,
  `signalId`, and `signalRecordType`). These are outside the `/agents` task and
  are not changed here.
- TypeScript LSP diagnostics remain unavailable because the repository's
  TypeScript language server is not installed and installation was previously
  declined.
- The Bun no-excuse audit could not run because `bun` is not installed. The
  focused Vitest suite, Next production build, and repository typecheck path
  were run instead.
