# Phase 32: Template, Snapshot & Run Ledger — Context

**Gathered:** 2026-08-07
**Status:** Ready for research and planning

## Phase Boundary

Establish the additive template and immutable run-intent foundation required by
the v1.7 analysis flow. Staff can select a compatible reusable Company or
Persona template, resolve its active-signal checklist, and create a durable,
auditable run snapshot before execution begins.

This phase does **not** execute real AI/Firecrawl analysis, build the full
template-management UI, implement whole-run review decisions, or aggregate
candidate offerings. Those belong to Phases 33, 36, and 34 respectively.

## Prior Decisions That Remain Locked

- Phase 31's Vercel Workflow DevKit is the durable executor.
- The application database is authoritative for lifecycle state and audit.
- Existing `modelFactory` and Firecrawl remain the later execution stack; no Exa.
- Analysis is on-demand only; no bulk, scheduled, or automatic reruns.
- Review is one whole-run Confirm/Dismiss decision; no per-finding curation or
  auto-confirmation.
- Phase 32 adds a new v1.7 ledger rather than repurposing legacy analysis data.

## Decisions Made During Discussion

### D-32-01: Seeded template lifecycle

Phase 32 seeds exactly two active GBS templates:

- Company Buying Signal Analysis
- Persona Buying Signal Analysis

Each template has immutable versions. Admin editing, activation/retirement,
and template-management UI are deferred to Phase 36. Phase 32 must still model
the lifecycle fields needed by that later management surface.

### D-32-02: Run lifecycle and history

The run ledger supports these states:

```text
queued → running → completed | failed | cancelled
completed → pending_review → confirmed | dismissed
```

Only a successfully completed execution can enter `pending_review`; failed and
cancelled executions remain terminal. Every transition is guarded and produces
an append-only history event with actor and timestamp. The ledger preserves
queued, running, terminal, review, actor, and timestamp history after reload.

### D-32-03: JSON snapshot payload

Each run stores immutable JSON snapshots on the run record, including:

- selected template version;
- resolved instruction;
- subject input;
- active-signal checklist/schema;
- effort;
- resolved model chain;
- applicable policy snapshot.

Research must determine the exact JSONB column boundaries, validation shape,
and whether small relational identity columns are also needed for indexing. The
snapshot itself must remain immutable after run creation.

### D-32-04: Duplicate active-run guard

Reject a new run when the same subject and template already have any nonterminal
run, regardless of which staff member started it. The uniqueness/guard must be
database-backed and race-safe, not only a UI pre-check.

### D-32-05: Subject compatibility and checklist derivation

- A template's target type must match the selected subject kind.
- A Practice Area is required for run creation.
- The checklist is derived only from active Company or Persona Signals matching
  both the selected target kind and Practice Area.
- An empty active checklist is valid and must be snapshotted as empty rather
  than rejected.

The exact subject-input shape and API error contract remain planning details,
but Company and Persona IDs must not be interchangeable.

### D-32-06: Additive legacy compatibility

Create new v1.7 template/version/run/snapshot/history structures additively.
Leave legacy `agent_run`, enrichment proposals, and the existing Reviews
surface untouched in this phase. Phase 34 will connect completed v1.7 runs to
the whole-run review flow; no migration or repurposing of legacy records is
authorized in Phase 32.

## Requirements in Scope

- CON-01 through CON-05: two active typed templates, immutable versions,
  immutable run snapshots, active signal checklist derivation, and incompatible
  pairing rejection.
- RUN-01 and RUN-02: on-demand durable run creation, reload-safe visibility,
  complete lifecycle states, and actor/timestamp audit.
- RUN-05: duplicate active-run protection and bounded attempt/audit foundation.
- RUN-06: safe audit records for invalid, failed, timed-out, cancelled, and
  successful runs.

## Explicitly Out of Scope

- Real model or Firecrawl execution and evidence packets (Phase 33).
- Admin template editor, activation/retirement workflows, and management UI
  (Phase 36).
- Whole-run Confirm/Dismiss actions and Reviews integration (Phase 34).
- Company/Persona launch/history/detail UI polish beyond the minimum needed to
  create and observe the ledger (Phase 35).
- Legacy `agent_run` migration or proposal/review data conversion.
- Bulk, scheduled, automatic, or per-finding analysis.

## Research Questions for Planning

1. Which existing schema/query/action patterns best support immutable JSONB
   snapshots and append-only transition history?
2. How should the Phase 31 proof ledger and new v1.7 run ledger coexist without
   coupling the synthetic proof tables to future analysis records?
3. What Postgres constraint/index pattern safely rejects duplicate nonterminal
   subject/template runs under concurrent starts?
4. What minimum seed data and migration path creates the two active templates
   without introducing Phase 36 management behavior?
5. What minimum server/API and reload-safe UI surface satisfies RUN-01/02 while
   keeping real execution and review deferred?

## Next Step

Run Phase 32 research, then produce an implementation plan grounded in these
locked decisions. Do not reopen decisions D-32-01 through D-32-06 unless new
codebase evidence exposes a direct contradiction.
