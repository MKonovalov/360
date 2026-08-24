# Task 1 implementation report

## Implementation notes

- Added the Search-owned `search_template`, `search_template_version`, `search_run`, `search_candidate`, `search_candidate_audit`, and `search_candidate_source` Drizzle declarations.
- Added explicit JSONB snapshot shapes for Company, Search template, Buyer Role, evidence policy, Persona, candidate Buyer Role proposals, deterministic matching, eligibility, terminal summaries, and audit changes. No new Search snapshot uses an unrestricted arbitrary record type.
- Added `company_persona_role_buyer_role` with foreign keys to `company_persona_role` and `buyer_role` plus a composite unique key. `offering_buyer_role` and `persona_signal` remain separate and untouched.
- Added the Company Persona Role composite reuse key and the Search launch, active-run, candidate replay, source replay, and audit-order indexes.
- Added `insertCompanyPersonaRoleIfMissing` and `insertCompanyPersonaRoleBuyerRoleIfMissing`. Both use `INSERT ... ON CONFLICT DO NOTHING RETURNING`, then select the deterministic existing row, so concurrent approval retries return one reused relationship rather than duplicate rows.
- Existing Persona, Company Persona Role columns, Buyer Role ownership, Analyze tables, and Analyze lifecycle declarations were not rewritten.
- `drizzle-kit generate` was used only to create the required `0017` schema snapshot. The pre-existing `drizzle/meta/0011_snapshot.json` was restored after generation overwrote that filename; the new journal entry is `0017_search_job` and the new snapshot is `0017_snapshot.json`.

## Test evidence

- Failing-first focused integration command before implementation:
  - `npm run test:integration:db -- src/lib/db/searchSchema.integration.test.ts src/lib/db/queries/companyPersonaRoles.integration.test.ts`
  - Blocked before test execution by repository preflight: `TEST_DATABASE_URL must carry the phase39-fixture marker`.
- Focused integration command after implementation:
  - Same command and same environment-only preflight blocker; Vitest reported both suites with `0 test` because setup stopped before suite execution.
- `npm run db:check`: passed (`Everything's fine`).
- `npm run db:validate`: passed (`Drizzle migration artifacts valid (11 journaled, 1 documented baseline exceptions).`).
- `npm run build`: passed; Next.js compilation, TypeScript, and static generation completed successfully.
- LSP diagnostics: no diagnostics for `src/lib/db/schema.ts`, `src/lib/db/queries/companyPersonaRoles.ts`, and `src/lib/db/queries/companyPersonaRoles.integration.test.ts`. The final request for `searchSchema.integration.test.ts` timed out in the LSP server; the production build TypeScript phase passed for the same file.
- TypeScript no-excuse audit could not run because `bun` is not installed in the environment.

## Concerns

- Live database assertions and the required concurrency proof remain unexecuted until `TEST_DATABASE_URL` is a distinct PostgreSQL fixture URL containing the `phase39-fixture` marker.
- `schema.ts` is an inherited 1,105-line schema module and is now 1,144 pure lines. The requested additive Task 1 scope does not permit splitting that existing module.
