# Phase 32 Transaction Probe

## Status

**VERIFIED — parent executed the guarded probe against the explicit test database.**

Failures now report only sanitized error `name`, optional `code`, bounded
`message`, and a bounded Error `cause` message. URLs and credential-shaped
values are redacted; raw driver objects are never printed.

The installed Drizzle interactive API remains explicitly unsupported:

```text
No transactions support in neon-http driver
```

The probe does not retry or use that API as the application fallback.

## Request and session diagnosis

Plain neon-http requests do not share PostgreSQL temporary-table sessions. The
first probe therefore failed when a later request could not find its temporary
relation, and a plain multi-command prepared statement is also invalid because
the driver rejects multiple commands in one prepared statement.

The revised harness uses the documented `neon().transaction([...])` non-interactive
HTTP batch API for exactly one `DO` statement. The `DO` block creates temporary
relations, runs all setup/assertion SQL in that transaction-scoped session, and
uses `ON COMMIT DROP`. No Phase 31 proof relation, production relation, legacy
ledger relation, or application schema is used.

## Selected mechanism under test

Inside the disposable `DO` block, the actual transition/event operation is one
SQL data-modifying CTE:

```text
WITH updated AS (UPDATE phase32_cte_run_probe ... RETURNING id),
inserted AS (INSERT INTO phase32_cte_event_probe SELECT ... FROM updated)
SELECT counts
```

The successful CTE must update one queued row and insert one event. A second CTE
updates another queued row, inserts its event, and then evaluates a deliberate
invalid integer cast. The deliberate CTE is now a top-level PL/pgSQL `WITH ...
SELECT ... INTO deliberate_value` statement. This both gives the result-producing
query a valid destination and preserves PostgreSQL's requirement that
data-modifying CTEs remain top-level. The nested PL/pgSQL exception block catches that exact SQL error,
then checks the same transaction-scoped relations: the row must still be queued
and its event count must be zero. Any failed assertion aborts the harness.

The successful harness transaction commits only after all assertions pass; its
temporary relations are dropped automatically. The harness API is probe-only and
must not be copied as the Phase 32 application implementation. Plan 32-04 must
implement the transition and event as one SQL statement/CTE through the selected
Drizzle neon-http client, not through `db.transaction`.

## Evidence

| Check | Result |
|---|---|
| Interactive Drizzle callback | Rejected with `No transactions support in neon-http driver` |
| Temporary-table visibility across plain requests | Disproved by missing-relation error |
| Isolated harness | Implemented with `neon().transaction([single DO statement])` |
| Successful CTE update + event | **PASS** — `committedCteUpdate: true`, `committedCteEventInsert: true` |
| Deliberate-error CTE rollback | **PASS** — `deliberateErrorRejectedAndValidated: true`, `deliberateErrorRolledBack: true` |
| Last parent failure | PostgreSQL `42702`: rollback assertion `status` was ambiguous |
| Prior parent failure | PostgreSQL `P0001`: `COUNT(*)` counted the null-extended LEFT JOIN row |
| Phase 31/prod/application relation reuse | None |
| Permanent schema/data side effects after success | None intended; `ON COMMIT DROP` cleanup |
| Credential output | None |

### Sanitized success result

```text
committedCteUpdate: true
committedCteEventInsert: true
deliberateErrorRejectedAndValidated: true
deliberateErrorRolledBack: true
temporaryRelations: true
permanentSchemaChanges: false
credentialOutput: false
```

The `42702` failure was corrected by qualifying the rollback assertion as
`phase32_cte_run_probe.status` in both its projection and `GROUP BY`. CTE
atomicity is now proven by the parent’s successful guarded rerun.

The later `P0001` assertion failure was caused by `COUNT(*)` counting the
null-extended parent row from the `LEFT JOIN`; the rollback aggregate now counts
`phase32_cte_event_probe.id`, which is null when no event matches.

The evidence is ready for parent acceptance. Plan 32-04 must use one guarded SQL
data-modifying CTE for transition plus append-only event persistence through the
Drizzle neon-http client. The probe-only `neon().transaction([single DO
statement])` harness must not become the application implementation, and the
unsupported Drizzle callback remains excluded.
