# Database migrations

Drizzle migration SQL and legacy v7 metadata under `drizzle/` are source-controlled. The normal schema-change path is:

```sh
npm run db:validate
npm run db:check
npm run db:migrate
```

`db:migrate` uses `drizzle.config.ts`, the checked-in `./drizzle` directory, and `DATABASE_URL`. It applies only migrations absent from Drizzle's database migration table. Do not run it against the existing Production database until the one-time `0007` ledger repair below is complete.

## Failed 0002 and the 0008 forward repair

`0002_phase33_34_correction.sql` is a failed historical artifact. Its
Production execution rolled back at SQLSTATE `42883`, and it is archived under
`drizzle/archive/` with a hash-checked `failed-not-applied` entry in
`drizzle/migration-archive.json`. It is intentionally absent from
`drizzle/meta/_journal.json`; restoring its journal entry or moving it back to
the active migration directory would make `drizzle-kit migrate` replay unsafe
DDL. Never run that SQL again.

`0008_phase33_34_packet_review_forward_repair.sql` is the active forward path.
It adds only the packet/review enum types, tables, constraints, and indexes
that are missing from the current schema. It does not alter the existing
eight-label `analysis_run_status` enum, the active-run index, signals, or
existing data. Production application must use a reviewed explicit PostgreSQL
transaction with catalog-only preflight and postflight; do not use `db:push`,
the old 0002 artifact, or application reconciliation queries for this repair.

## 0009 provider/model metadata (prepared, not applied)

`0009_provider_model_metadata.sql` adds nullable primary-provider metadata and
ordered fallback-provider metadata to `user_model_settings`, plus separate
provider identity columns for both agent-run audit paths. The SQL, snapshot, and
journal entry are reviewed artifacts only: this task did not run `db:migrate`,
`db:push`, or any direct DDL against Preview or Production. Apply 0009 only
through the protected, explicitly dispatched migration workflow after a DBA
review confirms the four additive columns are absent and the migration hash is
unchanged.

## 0007 baseline boundary

`drizzle/0007_custom_agent_definition.sql` is unchanged, manually applied Production SQL. Its SHA-256 is recorded in `drizzle/migration-baseline.json`. It is intentionally not fabricated into `_journal.json` or given a fabricated snapshot: doing so would not repair the database migration table and could cause duplicate DDL.

Before the first Production migration job:

1. Pause the Production application promotion and take the normal database backup.
2. A database owner performs a read-only catalog check against the exact 0007 SQL and confirms the enum, columns, constraints, indexes, and data checks recorded in `.debug-journal.md`.
3. In a separately reviewed, transactional DBA repair, record 0007 as already applied in the installed Drizzle legacy migration table only when the read-only check passes. Use the hash/table shape produced by the pinned Drizzle Kit version; do not execute the 0007 SQL and do not use `db:push`.
4. Verify `npm run db:migrate` is a no-op against that database using the protected migration workflow. This step is the first permitted migration-runner access to Production.

This repository does not automate step 3 because it requires Production access and an operator decision. If the catalog check fails, stop and use a forward repair migration after review; never reset or replay 0007.

## Environments and deployment gate

- Pull requests run `db:validate`, `db:check`, and an untracked-artifact check without database credentials.
- Production migration execution is only available through the manually dispatched `Drizzle migrations` workflow, with the `production-migrations` GitHub environment, required reviewers, an environment-scoped `DATABASE_URL` secret, and serialized concurrency.
- The workflow requires an explicit 0007 baseline-repaired confirmation. It is not called by Vercel builds and never runs for Preview builds.
- Production application promotion must happen only after the protected migration job is green. Vercel's automatic Git integration remains separate; do not use a Vercel build hook to run migrations.

The concurrency group prevents overlapping runners. Drizzle's migration table makes a correctly recorded rerun idempotent, but it does not replace the CI serialization gate.

## Development-only schema pushing

`npm run db:push` is an alias for `db:push:dev` and refuses to run unless both `NODE_ENV=development` and `ALLOW_DB_PUSH=1` are set. Prefer generated, reviewed SQL migrations. Never use `db:push` for Preview or Production.

Fresh disposable databases can replay the complete checked-in sequence, including 0007. Existing databases require the explicit baseline repair boundary above.

## Rollback policy

There is no automatic down-migration. Prefer expand/contract changes: add compatible structures, deploy code, backfill, then remove old structures in a later migration. If a migration fails, stop promotion and apply a reviewed forward-fix. Restore from backup only for a confirmed destructive incident; do not edit committed migration history.
