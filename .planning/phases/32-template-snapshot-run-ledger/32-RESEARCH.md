# Phase 32: Template, Snapshot & Run Ledger - Research

**Researched:** 2026-08-07  
**Domain:** Additive Drizzle/Neon/Postgres template and durable analysis-run ledger in Next.js App Router  
**Confidence:** HIGH for boundaries, contracts, and existing patterns; runtime evidence now confirms that interactive `db.transaction` is unsupported by the installed `neon-http` driver, so Wave 0 must prove the single-statement SQL CTE fallback before ledger implementation proceeds.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-32-01:** Seeded template lifecycle

Phase 32 seeds exactly two active GBS templates:

- Company Buying Signal Analysis
- Persona Buying Signal Analysis

Each template has immutable versions. Admin editing, activation/retirement,
and template-management UI are deferred to Phase 36. Phase 32 must still
model the lifecycle fields needed by that later management surface.

- **D-32-02:** Run lifecycle and history

The run ledger supports these states:

```text
queued → running → completed | failed | cancelled
completed → pending_review → confirmed | dismissed
```

Only a successfully completed execution can enter `pending_review`; failed and
cancelled executions remain terminal. Every transition is guarded and produces
an append-only history event with actor and timestamp. The ledger preserves
queued, running, terminal, review, actor, and timestamp history after reload.

- **D-32-03:** JSON snapshot payload

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

- **D-32-04:** Duplicate active-run guard

Reject a new run when the same subject and template already have any nonterminal
run, regardless of which staff member started it. The uniqueness/guard must be
database-backed and race-safe, not only a UI pre-check.

- **D-32-05:** Subject compatibility and checklist derivation

- A template's target type must match the selected subject kind.
- A Practice Area is required for run creation.
- The checklist is derived only from active Company or Persona Signals matching
  both the selected target kind and Practice Area.
- An empty active checklist is valid and must be snapshotted as empty rather
  than rejected.

The exact subject-input shape and API error contract remain planning details,
but Company and Persona IDs must not be interchangeable.

- **D-32-06:** Additive legacy compatibility

Create new v1.7 template/version/run/snapshot/history structures additively.
Leave legacy `agent_run`, enrichment proposals, and the existing Reviews
surface untouched in this phase. Phase 34 will connect completed v1.7 runs to
the whole-run review flow; no migration or repurposing of legacy records is
authorized in Phase 32.

### Claude's Discretion
None stated in `32-CONTEXT.md`; exact subject-input shape and API error contract remain planning details under D-32-05.

### Deferred Ideas (OUT OF SCOPE)
- Real model or Firecrawl execution and evidence packets (Phase 33).
- Admin template editor, activation/retirement workflows, and management UI (Phase 36).
- Whole-run Confirm/Dismiss actions and Reviews integration (Phase 34).
- Company/Persona launch/history/detail UI polish beyond the minimum needed to create and observe the ledger (Phase 35).
- Legacy `agent_run` migration or proposal/review data conversion.
- Bulk, scheduled, automatic, or per-finding analysis.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research support |
|---|---|---|
| CON-01 | Two active GBS templates: Company and Persona Buying Signal Analysis. | Seed exactly two natural-keyed templates and one immutable version each; no editor behavior. |
| CON-02 | Target type, instruction, supported effort default, lifecycle status, immutable version history. | Separate template and version rows; retain lifecycle/audit fields needed by Phase 36. |
| CON-03 | Immutable template, instruction, subject, checklist, effort, model-chain, and policy snapshots before execution. | Create-time validated JSONB snapshot objects plus relational lookup/index columns; exclude snapshots from update paths. |
| CON-04 | Checklist contains only active signals for target kind and Practice Area. | Subject-kind-discriminated query modules use `status = 'active'` and required `practiceAreaId`; empty result is valid. |
| CON-05 | Incompatible target pairings are rejected. | Validate template target type against subject kind before insert and preserve the discriminator in the database. |
| RUN-01 | One on-demand run remains visible after navigation/reload. | Reuse Phase 31 create-before-start and database-authoritative GET pattern, now with analysis-run IDs. |
| RUN-02 | Full lifecycle and actor/timestamp audit survive reload. | Guarded transitions plus append-only event rows; status endpoint reads application DB, not Workflow status. |
| RUN-05 | Duplicate active runs rejected; attempts/audit bounded. | Partial unique index over nonterminal statuses plus bounded attempt counters and transition events. |
| RUN-06 | Invalid, failed, timed-out, cancelled, and successful runs retain safe audit records. | Typed failure/cancel reasons, terminal timestamps, and history events; Phase 33 owns actual execution/evidence. |
</phase_requirements>

## Summary

Phase 32 should add a new v1.7 domain beside the current `agent_run`, `signal_proposal`, Reviews, and Phase 31 proof tables. The existing schema already uses PostgreSQL enums, `jsonb().$type<...>()`, explicit audit columns, unique indexes, and polymorphic `recordType + recordId` pairs where a foreign key cannot target two tables. [VERIFIED: codebase] The new ledger should reuse those conventions but must make the Company/Persona discriminator and Practice Area explicit in both validation and indexed identity columns. [VERIFIED: 32-CONTEXT.md] [VERIFIED: codebase]

Use separate template and immutable-version records, then create an analysis run with validated immutable snapshot objects and a guarded status machine. Persist the selected template version, subject kind/id, and Practice Area relationally for indexing and joins; persist the resolved instruction, subject snapshot, checklist/schema, effort, model chain, and policy snapshot as JSONB. [VERIFIED: 32-CONTEXT.md] A partial unique index over `(subject_type, subject_id, template_id)` for `queued`, `running`, and `pending_review` is the database race backstop for the locked duplicate rule; a UI pre-check may improve messaging but must never be the only guard. [CITED: https://orm.drizzle.team/docs/indexes-constraints] [VERIFIED: 32-CONTEXT.md]

The minimum surface is a staff-gated create boundary that follows Phase 31's create-before-start shape, a staff-gated reload-safe run/status/history read, and a narrow launch/status presentation on the existing consolidated Company and Persona pages. [VERIFIED: Phase 31 summaries] [VERIFIED: codebase] Do not dispatch modelFactory or Firecrawl work in this phase, do not connect completed runs to Reviews, and do not add bulk/scheduled behavior. [VERIFIED: 32-CONTEXT.md]

**Primary recommendation:** Add four logical concerns—templates, immutable versions, analysis runs, and append-only run events—with a typed create pipeline and a database-enforced partial unique active-run index; keep Phase 31 proof tables and all legacy analysis/review records isolated.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Template/version catalog and two-row seed | Database / Storage | API / Backend | Templates and versions must be stable, queryable, and ready for Phase 36 lifecycle management. [VERIFIED: 32-CONTEXT.md] |
| Subject/template compatibility validation | API / Backend | Database / Storage | The create boundary can return a typed error; persisted `subjectType` and `template.targetType` make the invariant auditable. [VERIFIED: codebase] |
| Active checklist derivation | Database / Storage | API / Backend | Company and Persona signal tables are separate; queries must filter by Practice Area and active status. [VERIFIED: codegraph/codebase] |
| Immutable intent snapshots | Database / Storage | API / Backend | Snapshots must survive reload and later source-catalog changes; the API validates and inserts them once. [VERIFIED: 32-CONTEXT.md] |
| Lifecycle transition and audit | Database / Storage | API / Backend | Conditional SQL is the authoritative guard; event history is product truth, as proven by Phase 31. [VERIFIED: Phase 31 verification] |
| Workflow dispatch | API / Backend | Frontend Server (SSR) | Phase 31 selected Workflow DevKit; Phase 32 may create/dispatch the durable run but must not implement real AI work. [VERIFIED: 31-CONTEXT.md] [VERIFIED: 32-CONTEXT.md] |
| Reload-safe visibility | Database / Storage | Browser / Client | Reads must come from the application run and event tables, not executor metadata. [VERIFIED: Phase 31 verification] |

## Project Constraints (from CLAUDE.md)

- Use Next.js App Router, Node 22.x, the existing Clerk project via `@clerk/nextjs`, Neon Postgres, and Drizzle; do not introduce custom auth. [VERIFIED: CLAUDE.md]
- Keep strict TypeScript, `interface` for record shapes, camelCase, named exports, 2-space indentation, single quotes, and semicolons. [VERIFIED: CLAUDE.md]
- Protected writes must call `requireStaffAccess()` at the Server Action or Route Handler boundary. [VERIFIED: CLAUDE.md] [VERIFIED: codebase]
- Query modules are pure DB access and do not own the staff gate or UI error handling. [VERIFIED: codebase]
- Do not modify `agent_run`, `signal_proposal`, `correction`, existing Reviews UI, or Phase 31 proof tables in this phase. [VERIFIED: 32-CONTEXT.md]
- Keep server-only values out of client bundles and do not expose database URLs, Clerk secrets, model credentials, or policy secrets in snapshots or responses. [VERIFIED: CLAUDE.md]

## Existing Codebase Findings and Compatibility Inventory

### Current relational structures

| Area | Existing location | Compatibility implication |
|---|---|---|
| Company/Persona identity | `src/lib/db/schema.ts:48-93`, `company`, `persona` | Both use serial integer IDs; no shared FK can point to both. Use `subjectType` plus bare `subjectId`, then validate the selected table before insert. [VERIFIED: codebase] |
| Practice Area | `src/lib/db/schema.ts:321-332`, `practiceArea` | Required FK target for the new run; active picker query is already `listActivePracticeAreas()` in `src/lib/db/queries/practiceAreas.ts`. [VERIFIED: codegraph/codebase] |
| Company signals | `src/lib/db/schema.ts:414-425`, `companySignal` | `practiceAreaId`, free-text category, and shared `catalog_status`; checklist query must filter `status = 'active'`. [VERIFIED: codebase] |
| Persona signals | `src/lib/db/schema.ts:429-441`, `personaSignal` | Same Practice Area/status shape plus required `buyerRoleId`; checklist query must preserve buyer-role identity in the snapshot. [VERIFIED: codebase] |
| Legacy agent run | `src/lib/db/schema.ts:233-250`, `agentRun`; `src/lib/db/queries/runs.ts` | Company-only, completed-analysis metadata, nullable proposal linkage; not a suitable v1.7 lifecycle table. [VERIFIED: codegraph/codebase] |
| Legacy proposals/Reviews | `signalProposal`, `correction`, `src/lib/db/queries/proposals.ts`, `src/app/actions/reviews.ts` | Per-proposal pending/accepted/rejected flow and live-signal writes; incompatible with whole-run v1.7 review and explicitly untouched until Phase 34. [VERIFIED: codegraph/codebase] [VERIFIED: 32-CONTEXT.md] |
| Phase 31 proof ledger | `workflowProofRun`, `workflowProofRunEvent`, `src/lib/db/queries/workflowProofRuns.ts`, `/api/workflow-proof-runs/*`, `src/workflows/workflowProof.ts` | Synthetic executor proof only; its `workflow_proof_status` enum and proof event keys must remain isolated from analysis-run statuses and events. [VERIFIED: codebase] [VERIFIED: Phase 31 verification] |

### Phase 31 coexistence rule

Do not add a nullable foreign key from `workflow_proof_run` to the analysis ledger, do not rename or broaden `workflow_proof_status`, and do not make future analysis rows reuse proof IDs. [VERIFIED: 31-CONTEXT.md] The proof ledger records synthetic executor diagnostics; the v1.7 ledger records product analysis intent and lifecycle. [VERIFIED: 31-01-SUMMARY.md] Shared query helpers may be structurally similar, but table names, enums, event keys, and tests should stay separate.

## Standard Stack

### Core

| Library | Version | Purpose | Why standard |
|---|---:|---|---|
| Drizzle ORM | `^0.45.2` | Typed PostgreSQL schema, queries, indexes, inferred row types | Already installed and is the repository's schema/query layer. [VERIFIED: package.json] |
| `@neondatabase/serverless` | `^1.1.0` | Neon driver behind `drizzle-orm/neon-http` | Existing DB client in `src/lib/db/index.ts`; HTTP is optimized for single/non-interactive serverless queries. [VERIFIED: codebase] [CITED: https://orm.drizzle.team/docs/connect-neon] |
| Next.js | `16.2.11` | App Router pages, Route Handlers, and existing Workflow integration | Existing application framework and Phase 31 start/status precedent. [VERIFIED: package.json] [VERIFIED: Phase 31 summaries] |
| Zod | installed | Runtime validation at action/route boundaries and discriminated subject/snapshot inputs | Existing actions and legacy proposal code validate unknown inputs with Zod. [VERIFIED: codegraph/codebase] |
| Workflow DevKit | `4.8.0` | Durable dispatch selected in Phase 31 | Existing pinned executor; Phase 32 must use it only as the future execution handoff, not for model work. [VERIFIED: 31-RESEARCH.md] |

### Supporting

| Library/tool | Version | Purpose | When to use |
|---|---:|---|---|
| Vitest | `^4.1.10` | Query, state-machine, and pure derivation tests | Existing `npm test` suite and focused query tests. [VERIFIED: package.json] |
| Playwright | `^1.62.1` | Reload/navigation smoke for the minimum run surface | Use only if Phase 32 adds a browser-visible launch/status surface; Phase 31 proved deployed-origin auth setup. [VERIFIED: package.json] [VERIFIED: 31-03-SUMMARY.md] |
| Drizzle Kit | `^0.31.10` | Schema migration generation/application | Existing `drizzle.config.ts` points at `src/lib/db/schema.ts` and `./drizzle`. [VERIFIED: package.json] [VERIFIED: drizzle.config.ts] |

### Alternatives considered

| Instead of | Could use | Tradeoff |
|---|---|---|
| New v1.7 ledger | Extend `agent_run` | Rejected: legacy table is Company-only and lacks the required lifecycle/snapshot/review semantics. [VERIFIED: codebase] [VERIFIED: 32-CONTEXT.md] |
| Partial unique index | UI pre-check or application-only query | Rejected: concurrent starts can pass the pre-check; the database constraint is required. [VERIFIED: 32-CONTEXT.md] |
| Polymorphic `(subjectType, subjectId)` | Nullable `companyId` plus nullable `personaId` | Prefer the explicit discriminator used elsewhere; two nullable FKs add invalid states and do not naturally support one subject identity key. [VERIFIED: codebase] [ASSUMED] |
| JSON-only identity | All fields inside one JSONB object | Rejected for indexed duplicate protection and efficient history/record joins; retain small relational identity columns. [VERIFIED: 32-CONTEXT.md] [ASSUMED] |

**Installation:** No package installation is required or authorized for Phase 32. Existing versions are sufficient. [VERIFIED: package.json]  
**Package legitimacy audit:** Not applicable; this research recommends no new external package.

## Architecture Patterns

### System Architecture Diagram

```text
Staff browser / Company or Persona page
  │ authenticated create request
  ▼
Run create boundary
  ├─ requireStaffAccess()
  ├─ validate subject kind/id, template version, Practice Area, effort
  ├─ load active signals for matching kind + Practice Area
  ├─ resolve model chain and policy without exposing secrets
  ├─ build immutable snapshot objects
  ├─ INSERT analysis_run + initial queued event
  │    └─ DB partial unique index rejects duplicate queued/running/pending_review
  ├─ dispatch existing Phase 31 Workflow executor (no real AI in Phase 32)
  └─ return application run ID / typed result
       │
       ▼
Application database (product truth)
  ├─ analysis_template → analysis_template_version
  ├─ analysis_run (relational identity + immutable JSONB snapshots)
  └─ analysis_run_event (append-only from/to status, actor, timestamp, reason)
       │
       └─ GET/revalidation after navigation or reload → status + ordered history

Phase 33 later consumes the snapshotted run; Phase 34 later consumes only
completed runs for whole-run review. Phase 36 later edits/activates/ retires
templates and creates new immutable versions.
```

### Recommended Project Structure

```text
src/
├── lib/db/schema.ts                         # additive template/version/run/event tables
├── lib/db/queries/analysisTemplates.ts      # template/version reads and seed helpers
├── lib/db/queries/analysisRuns.ts            # create, guarded transitions, history reads
├── lib/analysis/snapshots.ts                 # Zod schemas + server-side snapshot builder
├── lib/analysis/checklist.ts                 # typed active-signal derivation
├── app/api/analysis-runs/route.ts            # staff-gated create/dispatch boundary
├── app/api/analysis-runs/[id]/route.ts       # staff-gated reload-safe status/history read
├── app/actions/analysisRuns.ts               # only if the launch UI needs a Server Action
└── scripts/seed-analysis-templates.ts        # idempotent two-template/two-version seed
```

### Pattern 1: Separate template identity from immutable version

**What:** `analysis_template` owns stable key, display name, target type, lifecycle status, and future management audit fields. `analysis_template_version` owns monotonically increasing version number, instruction, supported effort/default, and creation actor/time. A run references the version and also snapshots its resolved content. [VERIFIED: 32-CONTEXT.md]

**When to use:** Always for Phase 32; the two seed rows are active, and Phase 36 must be able to save a new version without mutating a version already used by a run. [VERIFIED: 32-CONTEXT.md]

```typescript
// Illustrative shape only; planner should align names with repository conventions.
const templateSnapshot = {
  templateId,
  templateVersionId,
  templateKey,
  targetType,
  version,
  instruction,
};
```

### Pattern 2: Build and validate snapshots before the run insert

**What:** Resolve all mutable inputs first, validate a discriminated union, then insert snapshots in the same create path. The run stores `templateVersionId`, `subjectType`, `subjectId`, and `practiceAreaId` relationally, while JSONB stores the exact execution intent. [VERIFIED: 32-CONTEXT.md] Drizzle's `jsonb().$type<T>()` provides compile-time shape protection but not runtime validation, so Zod is still required at the boundary. [CITED: https://github.com/drizzle-team/drizzle-orm-docs/blob/main/src/content/docs/cockroach/column-types.mdx] [VERIFIED: codebase]

Recommended JSONB boundaries:

| JSONB field | Required contents | Immutability rule |
|---|---|---|
| `templateSnapshot` | Template key/name, target type, version ID/number, resolved instruction | Set only at insert; never update. |
| `subjectSnapshot` | `{ type, id, displayName }` plus only safe, non-secret input fields needed by later execution | Set only at insert; do not copy unrestricted company/persona rows. |
| `checklistSnapshot` | Schema version, target type, Practice Area identity, ordered active signal items with signal IDs/name/category/description and Persona buyer-role identity where applicable | Set only at insert; empty `items: []` is valid. |
| `executionSnapshot` | Effort, resolved model chain IDs, bounded limits, applicable policy snapshot | Set only at insert; omit API keys and private reasoning. |

Keep `templateVersionId`, `subjectType`, `subjectId`, and `practiceAreaId` as scalar columns even when duplicated in JSONB. [VERIFIED: 32-CONTEXT.md] The duplicated values are intentional: JSONB is the immutable replay input; scalar columns support duplicate indexes and joins. [ASSUMED]

### Pattern 3: Guard every lifecycle transition and append an event

Use a narrow transition API such as `transitionAnalysisRun(runId, expectedStatus, nextStatus, actor, reason)`. The update must predicate on the expected current status, and the event must carry `fromStatus`, `toStatus`, `actorId`, `occurredAt`, attempt/recovery counters, and a safe reason code. Replays that update zero rows must reload the run and return its current terminal/status result rather than append a duplicate event. [VERIFIED: Phase 31 query patterns]

The event table must have no application update/delete helper. Use a stable event key or a database uniqueness constraint for the transition identity if retries can replay the same transition. [VERIFIED: Phase 31 research] Exact actor semantics should be explicit: staff-created transitions use the Clerk user ID; executor transitions use a server actor such as `workflow`; system timeout/cancellation transitions use a stable system actor plus reason. [ASSUMED]

### Pattern 4: Database-backed duplicate guard

Represent nonterminal statuses explicitly and define the partial unique index over the subject/template identity:

```typescript
uniqueIndex('analysis_run_active_subject_template_idx')
  .on(table.subjectType, table.subjectId, table.templateId)
  .where(sql`${table.status} in ('queued', 'running', 'pending_review')`);
```

The exact Drizzle expression may need raw SQL for enum literals; the important behavior is the PostgreSQL partial unique index predicate. Drizzle documents `.where()` for partial indexes. [CITED: https://orm.drizzle.team/docs/indexes-constraints] Catch SQLSTATE `23505` at the action/route boundary and translate it to a stable `active_run_exists` result; do not first query and assume the answer remains true. [VERIFIED: codebase] The `pending_review` inclusion follows the locked “all nonterminal runs” rule; confirmed and dismissed are terminal. [VERIFIED: 32-CONTEXT.md]

### Pattern 5: Seed by stable natural keys, not serial IDs

Seed exactly two template keys and one initial version per template. Use stable keys such as `company-buying-signal-analysis` and `persona-buying-signal-analysis`, then resolve the generated template IDs before inserting versions. Make the seed idempotent and fail if an existing key has conflicting target type/content; do not silently mutate an existing immutable version. [VERIFIED: 32-CONTEXT.md] [ASSUMED]

### Anti-Patterns to Avoid

- **Reusing `agent_run`:** It would couple Company-only legacy analysis/proposals to typed v1.7 lifecycle and violate additive compatibility. [VERIFIED: codebase] [VERIFIED: 32-CONTEXT.md]
- **Using `signal` or legacy proposal rows for the checklist:** Those are entity-level/legacy analysis records, not the reusable Practice Area catalog. [VERIFIED: codebase]
- **Updating snapshot columns during execution:** Later model/evidence work must consume the intent captured before execution; mutation destroys auditability. [VERIFIED: 32-CONTEXT.md]
- **Checking duplicate runs only in UI or with select-then-insert:** Concurrent starts can race; only the partial unique index is authoritative. [VERIFIED: 32-CONTEXT.md]
- **Treating a numeric subject ID without a discriminator as sufficient:** Company 42 and Persona 42 are different records. [VERIFIED: 32-CONTEXT.md] [VERIFIED: codebase]
- **Making empty checklists invalid:** An active-signal query can legitimately return no rows and must snapshot `items: []`. [VERIFIED: 32-CONTEXT.md]
- **Using Workflow status as product status:** Phase 31 explicitly makes the application database authoritative. [VERIFIED: Phase 31 verification]

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---|---|---|---|
| Race-safe active-run uniqueness | UI pre-check, in-memory lock, or advisory application flag | PostgreSQL partial unique index via Drizzle | Concurrent requests must converge at the database. [CITED: https://orm.drizzle.team/docs/indexes-constraints] |
| Runtime snapshot validation | Trust TypeScript or `$type` alone | Zod discriminated schemas at the create boundary | Drizzle `$type` is compile-time protection; it is not runtime validation. [CITED: https://github.com/drizzle-team/drizzle-orm-docs/blob/main/src/content/docs/cockroach/column-types.mdx] |
| Durable lifecycle audit | Mutable `status_history` JSON array on the run | Append-only `analysis_run_event` rows | Rows are queryable, independently auditable, and preserve actor/time history. [VERIFIED: Phase 31 pattern] |
| Subject polymorphism | Two nullable FKs with unchecked combinations | `subjectType` + `subjectId` plus server-side existence/type checks | Matches existing polymorphic `recordType` pattern and avoids invalid dual-null/dual-set states. [VERIFIED: codebase] |
| Durable dispatch | In-process promise or request-bound AI call | Existing Phase 31 Workflow DevKit boundary | Detached execution is already selected and proven; real work is Phase 33. [VERIFIED: 31-CONTEXT.md] |

**Key insight:** The snapshot is not merely cached display data; it is the immutable contract between constructor intent (Phase 32), execution (Phase 33), and later review (Phase 34). [VERIFIED: 32-CONTEXT.md]

## Common Pitfalls

### Pitfall 1: Transaction assumption is stale

**What goes wrong:** The installed Drizzle `neon-http` driver rejects the interactive callback form with `No transactions support in neon-http driver`; relying on that API would block execution at runtime. Neon documentation distinguishes non-interactive batching from interactive/session transactions, but the installed runtime is authoritative for this phase. [VERIFIED: runtime] [CITED: https://github.com/neondatabase/serverless/blob/main/README.md] [CITED: https://orm.drizzle.team/docs/connect-neon]

**How to avoid:** Do not use `db.transaction` with the installed `neon-http` client and do not add a driver or package. Use one SQL statement/CTE per guarded transition so the conditional run update and append-only event insert share one database statement; prove success, zero-row guard behavior, and deliberate-error atomicity in Wave 0 before ledger implementation. [VERIFIED: runtime] [CITED: https://orm.drizzle.team/docs/connect-neon]

### Pitfall 2: Partial-index predicate omits a nonterminal state

**What goes wrong:** If `pending_review` is excluded, a second run can start while the first completed execution is still awaiting the whole-run review. [VERIFIED: 32-CONTEXT.md]

**How to avoid:** Define a single shared nonterminal-status list for the partial index, duplicate guard tests, and application result mapping: `queued`, `running`, `pending_review`. [VERIFIED: 32-CONTEXT.md]

### Pitfall 3: Checklist query leaks drafts/retired signals or crosses kinds

**What goes wrong:** `companySignal` and `personaSignal` are separate tables with `catalog_status`; existing query modules intentionally expose both all-status admin lists and active-only picker lists. [VERIFIED: codegraph/codebase]

**How to avoid:** Use dedicated `listActive...ForPracticeArea` queries, require the target-kind branch before querying, and snapshot only returned active rows. Add tests with active, draft, retired, wrong-Practice-Area, and empty fixtures. [VERIFIED: codegraph/codebase]

### Pitfall 4: Snapshot accidentally contains secrets or mutable source rows

**What goes wrong:** Copying full settings/company/persona records can expose credentials or make later interpretation ambiguous. [VERIFIED: CLAUDE.md] [ASSUMED]

**How to avoid:** Define allowlisted Zod snapshot schemas; store model IDs and policy values, never API keys; store minimal safe subject/checklist fields and IDs needed for provenance. [VERIFIED: 32-CONTEXT.md] [VERIFIED: CLAUDE.md]

### Pitfall 5: Transition event race produces missing or duplicate audit rows

**What goes wrong:** A guarded status update and event insert in separate requests can split under failure; retries can append duplicate events. [VERIFIED: Phase 31 query patterns]

**How to avoid:** Make transition + event one atomic DB operation where the current driver supports it, or use a single CTE/unique event key; assert one winning transition and one event under concurrent/replayed calls. [CITED: https://orm.drizzle.team/docs/connect-neon]

### Pitfall 6: Seed changes an immutable version

**What goes wrong:** A rerun of the seed script overwrites instruction/default effort used by an existing run. [VERIFIED: 32-CONTEXT.md]

**How to avoid:** Stable natural keys and conflict detection; only insert version `1` when absent. Any future edit creates a new version in Phase 36. [VERIFIED: 32-CONTEXT.md] [ASSUMED]

### Pitfall 7: Phase boundary drift

**What goes wrong:** The constructor path starts real model/Firecrawl work, creates review items, or adds admin template editing before the foundation is proven. [VERIFIED: 32-CONTEXT.md]

**How to avoid:** Use a no-op/synthetic handoff to the selected executor if dispatch is needed, assert no provider/Firecrawl imports in Phase 32 paths, and keep Review integration and management UI out of the plan. [VERIFIED: 32-CONTEXT.md] [VERIFIED: 31-03-SUMMARY.md]

## Code Examples

### JSONB compile-time typing plus runtime validation

```typescript
// Source: https://github.com/drizzle-team/drizzle-orm-docs/blob/main/src/content/docs/cockroach/column-types.mdx
jsonb('checklist_snapshot').$type<ChecklistSnapshot>().notNull();
```

Pair this with a Zod schema before insert; `$type` does not validate untrusted Server Action/Route Handler input at runtime. [CITED: official Drizzle docs]

### Partial unique index

```typescript
// Source: https://orm.drizzle.team/docs/indexes-constraints
uniqueIndex('analysis_run_active_subject_template_idx')
  .on(table.subjectType, table.subjectId, table.templateId)
  .where(sql`${table.status} in ('queued', 'running', 'pending_review')`);
```

The planner should verify generated SQL against the actual Postgres enum type and add a concurrency integration test. [CITED: official Drizzle docs] [ASSUMED]

### Existing action/route security shape

```typescript
// Existing repository pattern: src/app/actions/signals.ts and
// src/app/api/workflow-proof-runs/route.ts
const { userId } = await requireStaffAccess();
const parsed = inputSchema.safeParse(input);
if (!parsed.success) return { ok: false, reason: 'invalid_input' };
```

Next.js security guidance also requires re-verifying authorization inside Server Actions because page-level checks do not protect direct action invocation. [CITED: https://github.com/vercel/next.js/blob/canary/docs/01-app/02-guides/data-security.mdx]

## Recommended Implementation Decomposition and Ordering

1. **Wave 0 - contract tests and schema design:** Define lifecycle/status unions, snapshot Zod schemas, subject compatibility matrix, nonterminal status list, and migration test fixtures. Confirm the single-statement SQL CTE mechanism for `transition + event` with the installed `neon-http`/Drizzle combination; `db.transaction` is known unsupported at runtime. [VERIFIED: runtime] [CITED: https://orm.drizzle.team/docs/connect-neon]
2. **Wave 1 - additive schema/migration:** Add template, template-version, analysis-run, and analysis-run-event tables/enums/indexes. Apply the migration and verify no changes to `agent_run`, proposal/Review, or Phase 31 proof tables. [VERIFIED: 32-CONTEXT.md] [VERIFIED: drizzle.config.ts]
3. **Wave 2 - template seed and catalog queries:** Seed exactly the two active templates and initial immutable versions; add active-template/version reads and conflict-safe idempotent seed tests. Keep Phase 36 mutation operations absent. [VERIFIED: 32-CONTEXT.md]
4. **Wave 3 - checklist and snapshot builder:** Add target-discriminated Company/Persona subject lookup, required Practice Area validation, active signal derivation, empty-list support, model-chain/policy resolution, and allowlisted snapshot construction. [VERIFIED: 32-CONTEXT.md]
5. **Wave 4 - run ledger queries:** Add create, guarded transitions, bounded attempt/cancel/fail helpers, append-only history reads, partial-index error mapping, and replay/concurrency tests. [VERIFIED: Phase 31 patterns]
6. **Wave 5 - API/executor handoff:** Add staff-gated create/status/history boundaries following Phase 31's scalar application-ID pattern; dispatch only the selected durable executor handoff, not modelFactory/Firecrawl. [VERIFIED: Phase 31 summaries] [VERIFIED: 32-CONTEXT.md]
7. **Wave 6 - minimum reload-safe UI and verification:** Add only the smallest Company/Persona launch/status/history presentation required for RUN-01/RUN-02; prove navigation/reload, all statuses, actor/timestamp history, invalid pairing, empty checklist, and duplicate races. Leave polished detail/history UX to Phase 35. [VERIFIED: ROADMAP.md] [VERIFIED: 32-CONTEXT.md]

## Runtime State Inventory

This is an additive schema/ledger phase, not a rename/refactor/migration of existing runtime data.

| Category | Items found | Action required |
|---|---|---|
| Stored data | Existing `agent_run`, proposals, Reviews, and `workflow_proof_run` data are present conceptually and must remain untouched. [VERIFIED: codebase] | Add new tables only; no legacy migration or conversion. |
| Live service config | Phase 31 Workflow integration/config is already deployed; no separate v1.7 template service config was found in the repository. [VERIFIED: 31 summaries] [VERIFIED: codebase] | Reuse existing executor configuration; do not add provider configuration. |
| OS-registered state | None identified for this additive DB phase; no OS task registration is involved. [VERIFIED: environment/codebase inspection] | None. |
| Secrets/env vars | Existing `DATABASE_URL`, Clerk, provider, and policy-related server configuration are outside the snapshot payload. [VERIFIED: CLAUDE.md] | Do not add or expose secrets; resolve model/policy values server-side and snapshot only safe values. |
| Build artifacts/installed packages | Existing Next/Drizzle/Workflow packages are installed; no new package is required. [VERIFIED: package.json] | No package install or artifact migration. |

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|---|---|---:|---|---|
| Node.js | Next/Drizzle scripts | ✓ | `v22.23.1` | — [VERIFIED: local environment] |
| npm | tests and DB scripts | ✓ | `10.9.8` | — [VERIFIED: local environment] |
| Drizzle Kit | schema migration | ✓ project dependency | `^0.31.10` | — [VERIFIED: package.json] |
| Neon Postgres | integration/migration and durable ledger | configured in project; credential not printed | package driver `^1.1.0` | Planner must use the existing configured database; no secret values belong in artifacts. [VERIFIED: package.json] |
| Workflow DevKit | durable handoff | ✓ project dependency | `4.8.0` | — [VERIFIED: 31-RESEARCH.md] |
| `psql` CLI | optional direct DB inspection | not found in PATH | — | Use Drizzle/Neon integration tests and existing DB scripts. [VERIFIED: local environment] |

**Missing dependencies with no fallback:** none identified.  
**Missing dependencies with fallback:** `psql` is absent, but it is not required if the existing Drizzle/Neon test and migration path is used. [VERIFIED: local environment]

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Framework | Vitest `^4.1.10`; existing Node environment. [VERIFIED: package.json] |
| Config file | `vitest.config.ts`; workflow-specific `vitest.workflow.config.ts` already exists from Phase 31. [VERIFIED: codebase] |
| Quick run command | `npm test -- src/lib/analysis/snapshots.test.ts src/lib/analysis/checklist.test.ts` (planned focused files) |
| Phase 32 release gate | Focused Phase 32 unit/integration suites, explicit test-database migration/seed metadata checks, `npm run test:workflow`, `npm run build`, and `npm run e2e -- e2e/analysis-runs.spec.ts`; ordinary repository-wide `npm test` remains informational because of unrelated Phase 31 baseline failures. [VERIFIED: package.json] [VERIFIED: Phase 31 verification] |

### Phase Requirements → Test Map

| Req ID | Behavior | Test type | Automated command | File exists? |
|---|---|---|---|---|
| CON-01/02 | Exactly two active typed templates and immutable version reads | integration + query | `npm test -- src/lib/db/queries/analysisTemplates.test.ts` | No - Wave 0 |
| CON-03 | All required snapshots validate, are inserted, and cannot be changed by update helpers | unit + integration | `npm test -- src/lib/analysis/snapshots.test.ts src/lib/db/queries/analysisRuns.test.ts` | No - Wave 0 |
| CON-04 | Active-only, kind-correct, Practice Area-correct checklist; empty list accepted | unit + integration | `npm test -- src/lib/analysis/checklist.test.ts` | No - Wave 0 |
| CON-05 | Company/Persona mismatch and nonexistent subject are rejected | unit + route/action | `npm test -- src/app/api/analysis-runs/route.test.ts` | No - Wave 0 |
| RUN-01/02 | Create, reload-safe status, ordered history, actor/timestamps across lifecycle | integration + route | `npm test -- src/lib/db/queries/analysisRuns.test.ts src/app/api/analysis-runs/route.test.ts` | No - Wave 0 |
| RUN-05 | Concurrent duplicate starts yield one success and one `active_run_exists`; attempt bound is enforced | DB integration | `npm test -- src/lib/db/queries/analysisRuns.integration.test.ts` | No - Wave 0 |
| RUN-06 | Invalid, dispatch-failed, failed, cancelled, timed-out, and successful outcomes retain safe reasons/events | integration | `npm test -- src/lib/db/queries/analysisRuns.integration.test.ts` | No - Wave 0 |
| RUN-01/02/05 | Browser can navigate/reload and later read DB-authoritative terminal/history state | Playwright smoke | `npm run e2e -- e2e/analysis-runs.spec.ts` | No - Wave 0 |

### Sampling Rate

- **Per task:** focused unit/query test for the changed module.
- **Per wave:** focused DB integration tests plus `npm run build`.
- **Phase gate:** `npm test && npm run build`, database migration/seed verification, and authenticated reload-safe smoke; if the Workflow handoff is changed, also run the existing isolated `npm run test:workflow` gate. [VERIFIED: package.json] [VERIFIED: Phase 31 verification]

### Wave 0 Gaps

- [ ] Snapshot Zod schemas and tests.
- [ ] Typed Company/Persona subject compatibility tests.
- [ ] Active checklist derivation module and tests.
- [ ] Template/version query tests and idempotent seed verification.
- [ ] Analysis-run transition/event query tests, including replay and concurrent duplicate-start integration.
- [ ] Route/action boundary tests for auth-first, invalid input, mismatch, duplicate, and safe result mapping.
- [ ] Reload/navigation E2E only if the minimum UI/API surface is included in the plan.

## Security Domain

### Applicable ASVS Categories

| ASVS category | Applies | Standard control |
|---|---|---|
| V2 Authentication | yes | `requireStaffAccess()` is first in create and status/history boundaries. [VERIFIED: codebase] |
| V3 Session Management | yes | Do not put Clerk sessions/cookies in Workflow args or JSON snapshots; authenticate each request independently. [VERIFIED: 31-CONTEXT.md] |
| V4 Access Control | yes | Server derives actor identity and verifies subject/template/version ownership/existence; client cannot choose another actor. [VERIFIED: CLAUDE.md] |
| V5 Input Validation | yes | Zod discriminated unions validate kind, positive IDs, effort, snapshot shape, and bounded reason strings before writes. [VERIFIED: codegraph/codebase] |
| V6 Cryptography | no new operation | No new cryptographic primitive; reuse Clerk/transport secret handling and never persist credentials. [VERIFIED: 32-CONTEXT.md] |

### Known Threat Patterns for Next.js + Drizzle/Neon

| Pattern | STRIDE | Standard mitigation |
|---|---|---|
| Forged subject/template pairing | Tampering / Elevation | Server-side subject lookup, template target comparison, explicit `subjectType`, no client-trusted display names. [VERIFIED: 32-CONTEXT.md] |
| Duplicate concurrent starts | Tampering / Cost abuse | Partial unique index and SQLSTATE `23505` mapping; UI pre-check is advisory only. [VERIFIED: 32-CONTEXT.md] |
| Snapshot secret leakage | Information disclosure | Allowlist snapshot fields; never store provider keys, database URLs, Clerk credentials, or private model reasoning. [VERIFIED: CLAUDE.md] |
| Unauthorized history read | Information disclosure | Staff-gate status/history route; do not infer access from the page gate. [CITED: https://github.com/vercel/next.js/blob/canary/docs/01-app/02-guides/data-security.mdx] |
| Replay/duplicate transition writes | Tampering | Expected-status predicates, unique event keys, bounded attempts, and atomic transition/event persistence. [VERIFIED: Phase 31 patterns] |
| Scope drift into AI execution | Cost abuse / Information disclosure | No modelFactory/Firecrawl execution or evidence writes in Phase 32; leave those to Phase 33. [VERIFIED: 32-CONTEXT.md] |

## State of the Art

| Old approach | Current approach | When changed | Impact |
|---|---|---|---|
| Request-bound legacy Company `agent_run` | Additive typed analysis-run ledger with durable executor handoff | Phase 32 design | Company and Persona runs share a consistent lifecycle without legacy migration. [VERIFIED: codebase] [VERIFIED: 32-CONTEXT.md] |
| UI/query duplicate check | PostgreSQL partial unique index | Phase 32 design | Concurrent starts are rejected by the database. [CITED: https://orm.drizzle.team/docs/indexes-constraints] |
| Mutable current status only | Status plus append-only actor/timestamp event history | Phase 31 pattern carried forward | Reload exposes audit history, not just the latest state. [VERIFIED: Phase 31 verification] |
| JSON as unvalidated bag | Zod-validated, allowlisted versioned snapshot objects with Drizzle compile-time typing | Phase 32 design | Phase 33 can consume a stable, immutable intent contract. [VERIFIED: 32-CONTEXT.md] |

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | `subjectType + subjectId` is preferable to two nullable subject FKs for this phase. | Alternatives / snapshot design | Planner may need a different DB integrity strategy if product requires hard FKs to both subject tables. |
| A2 | Small scalar identity columns may intentionally duplicate snapshot identity values for indexing and joins. | Snapshot boundaries | A planner that omits them would make the duplicate guard and subject history queries harder or unsafe. |
| A3 | Stable natural template keys and conflict-detecting idempotent seed behavior are the safest seed contract. | Seed pattern | An existing deployed seed could need a one-time human reconciliation if keys/content differ. |
| A4 | Executor/system actors can use stable non-Clerk actor labels such as `workflow` or `system`. | Event pattern | Audit schema may instead require nullable Clerk actor IDs plus an actor-kind enum. |
| A5 | The single-statement SQL CTE mechanism will be accepted only after the isolated Wave 0 atomicity probe passes; the installed interactive `db.transaction` API is rejected by runtime evidence. | Transaction pitfall / wave 0 | A failed CTE probe blocks ledger implementation; no independent requests, driver change, or dependency change is authorized. |

## Open Questions (RESOLVED)

1. **Transaction mechanism:** Runtime evidence rejected the installed Drizzle
   `neon-http` interactive `db.transaction(async (tx) => ...)` API with `No
   transactions support in neon-http driver`. The selected mechanism is now one
   SQL statement using CTEs for conditional run update plus append-only event
   insertion. Wave 0 runs `scripts/probe-neon-http-transaction.ts` with a
   separately constructed client from `TEST_DATABASE_URL`, proves success and
   deliberate-error atomicity, and records the result in
   `32-TRANSACTION-PROBE.md`. If the CTE probe fails, execution stops before
   Plan 32-04 rather than falling back to independent requests, a new driver,
   or a dependency change. [VERIFIED: runtime] [CITED: https://orm.drizzle.team/docs/connect-neon]
2. **Duplicate status set:** `pending_review` is nonterminal and blocks a
   duplicate alongside `queued` and `running`. `confirmed` and `dismissed` are
   the review terminal states, exactly as required by D-32-02 and D-32-04.
3. **Effort:** Both seeded version-1 templates support exactly the `standard`
   effort. The immutable future execution budget is
   `{ maxAttempts: 2, maxToolCalls: 12, maxExecutionSeconds: 300, maxSpendUsd: 2.5 }`.
4. **Phase 32 policy:** Every Phase 32 no-op handoff snapshots the versioned
   safe policy `{ schemaVersion: 1, mode: 'phase32_noop', networkAccess: false,
   writesAllowed: false, effectiveMaxAttempts: 1, effectiveMaxToolCalls: 0,
   effectiveMaxExecutionSeconds: 5, effectiveMaxSpendUsd: 0 }`. This bounds the
   no-op proof without inventing Phase 33 provider/tool behavior and leaves the
   future budget shape available for later execution.

## Sources

### Primary (HIGH confidence)

- `.planning/phases/32-template-snapshot-run-ledger/32-CONTEXT.md` - locked scope, lifecycle, snapshot contents, duplicate guard, compatibility, and phase boundary. [VERIFIED: 32-CONTEXT.md]
- `.planning/REQUIREMENTS.md` and `.planning/ROADMAP.md` - Phase 32 requirements and Phase 33-36 boundaries. [VERIFIED: planning files]
- `src/lib/db/schema.ts`, `src/lib/db/index.ts`, existing query/action modules - installed Drizzle/Neon schema, audit, JSONB, polymorphic identity, signal, legacy run, and auth patterns. [VERIFIED: codebase]
- `.planning/phases/31-durable-executor-selection-validation/31-CONTEXT.md`, summaries, verification, and research - durable executor and database-authoritative lifecycle precedent. [VERIFIED: planning files]
- Drizzle PostgreSQL indexes/constraints: https://orm.drizzle.team/docs/indexes-constraints - unique and partial index syntax. [CITED: official docs]
- Drizzle Neon connection guide: https://orm.drizzle.team/docs/connect-neon - HTTP vs WebSocket transaction guidance. [CITED: official docs]
- Drizzle JSONB typing docs: https://github.com/drizzle-team/drizzle-orm-docs/blob/main/src/content/docs/cockroach/column-types.mdx - `$type` compile-time typing. [CITED: official docs]
- Neon serverless README: https://github.com/neondatabase/serverless/blob/main/README.md - HTTP request/session/transaction behavior. [CITED: official docs]
- Next.js data security guide: https://github.com/vercel/next.js/blob/canary/docs/01-app/02-guides/data-security.mdx - re-authenticate inside Server Actions. [CITED: official docs]

### Secondary (MEDIUM confidence)

- None needed; existing code and official documentation covered the phase's technical questions.

### Tertiary (LOW confidence)

- None.

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** - versions and usage are present in `package.json` and official Drizzle/Next documentation confirms the relevant APIs. [VERIFIED: codebase] [CITED: official docs]
- Architecture: **HIGH** - lifecycle authority, additive boundary, and executor separation are locked and proven by Phase 31. [VERIFIED: 32-CONTEXT.md] [VERIFIED: Phase 31 verification]
- Snapshot schema details: **HIGH for Phase 32** - `standard`, the future budget, and the versioned no-op policy are fixed in the resolved planning contract; Phase 33 may extend execution semantics without mutating Phase 32 snapshots. [VERIFIED: 32-CONTEXT.md] [RESOLVED: planning]
- Transaction implementation: **HIGH** - installed runtime rejects interactive `db.transaction`; the permitted implementation path is a single-statement SQL CTE, and the isolated probe is a mandatory gate. [VERIFIED: runtime] [RESOLVED: planning]
- Pitfalls: **HIGH** - derived from current schema/query patterns, Phase 31 tests, and official index/transaction/security documentation. [VERIFIED: codebase] [CITED: official docs]

**Research date:** 2026-08-07  
**Valid until:** 2026-08-21 (re-check the installed Drizzle/Neon SQL behavior before implementation; the application-level locked decisions remain valid unless CONTEXT.md changes).

## Task 32-02-01 Implementation Note (2026-08-07)

- Schema convention: Phase 32 reuses `catalog_status` for template lifecycle and adds isolated target, effort, run-status, and actor-kind enums beside the untouched Phase 31 proof enum/tables.
- Migration caveat: the repository had no checked-in Drizzle migration baseline. Drizzle generated the full current snapshot as `0001_snapshot.json`; the reviewed SQL artifact was reduced to Phase 32-only `CREATE` statements with inline foreign keys, so it contains no legacy/proof `DROP`, `ALTER`, or recreation.
- Verification: migration static metadata test passed; `npx tsc --noEmit` and `npm run build` passed. Live catalog and concurrent uniqueness evidence remains blocked because `TEST_DATABASE_URL` was absent; the focused suite fails closed with `TEST_DATABASE_URL is required for Phase 32 migration evidence`. TypeScript LSP diagnostics were requested but the server is unavailable because installation was previously declined.
- Continuation verification: the pre-apply audit again passed with 14 additive `CREATE` statements, the exact queued/running/pending_review predicate, valid metadata JSON, and no destructive or protected-object statements. The current tool process still did not receive `TEST_DATABASE_URL`, so `db:push` and the live suite were not run; the URL value was never read or printed. TypeScript LSP remains unavailable because installation was previously declined.
