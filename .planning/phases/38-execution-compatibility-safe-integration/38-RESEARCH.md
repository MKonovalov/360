# Phase 38: Execution Compatibility & Safe Integration - Research

**Researched:** 2026-08-11
**Domain:** Custom-agent launch resolution, immutable analysis snapshots, and durable grounded execution
**Confidence:** HIGH for repository seams and compatibility constraints; HIGH for the selected custom snapshot/output-schema adapter shape; live execution remains prerequisite-gated

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Launch Resolution

- **D-38-01:** Practice Area is selected first.
- **D-38-02:** The agent picker then includes the fixed v1.7 template plus matching active custom agents.
- **D-38-03:** The fixed v1.7 template remains the default.
- **D-38-04:** Custom agents are filtered by target type and selected Practice Area.
- **D-38-05:** Multiple active custom agents for the same target type + Practice Area are allowed; staff explicitly chooses one.
- **D-38-06:** If no custom agent is selected, the existing fixed-template path remains unchanged.

#### Compatibility and Trust Boundaries

- **D-38-07:** An active custom agent may enter the existing v1.7 pipeline only after compatibility checks reject incompatible target type, Practice Area/signal mismatch, invalid effort, unsupported capability, or policy-invalid structured configuration before an active run is created.
- **D-38-08:** Fixed-template compatibility remains a regression boundary. Both fixed v1.7 templates must continue to use their existing target-scoped launch, evidence, run-history, review, and candidate surfaces.
- **D-38-09:** Custom execution reuses the existing durable executor, modelFactory, and Firecrawl/provider-agnostic contract. Staff-authored configuration cannot select arbitrary providers, tools, or server capabilities, and Exa or another research provider is not added.
- **D-38-10:** Every successful run remains subject to the existing whole-run review contract. Candidate offerings remain confirmed-only, with run/version/finding/source provenance; pending, failed, cancelled, and dismissed output is excluded.
- **D-38-11:** Custom execution never writes live Signals or signal-offering links directly. Review and candidate projection remain read-only/downstream boundaries as defined by v1.7.

#### Snapshot Boundary

- **D-38-12:** A compatible launch must snapshot the selected immutable custom-agent version and the server-resolved launch/execution inputs before durable execution. Later custom-agent edits must not change that run, its result, evidence, or review packet.
- **D-38-13:** The discussion resolved launch resolution only. Exact snapshot contents beyond the already-required immutable version and resolved inputs, structured-output integration details, and the final verification boundary remain research/planning discretion or later discussion unless already locked by requirements or prior phase context.

### Claude's Discretion

- Exact query, contract, action, component, and response-shape names for resolving Practice Area-first options and carrying the selected agent into preview and launch.
- Exact compatibility-check decomposition and error taxonomy, provided rejection happens before active-run creation and preserves fail-closed behavior.
- Exact extension of the existing snapshot builder and run-ledger inputs, provided immutable history, server-derived policy, model-chain resolution, bounded execution, and fixed-template behavior remain intact.
   - Exact structured-output adapter and verification seams, subject to VAL-05's bounded schema policy and the resolved representation below.
- Exact automated fixture/test partitioning and authenticated verification handoff to Phase 39, without reclassifying prerequisite-gated v1.7 evidence as passed.

### Deferred Ideas (OUT OF SCOPE)

- Exact snapshot field expansion and structured-output runtime integration are resolved by the plan's named JSONB paths and adapter contract; execution-policy availability remains intentionally prerequisite-gated rather than invented.
- Bulk, scheduled, automatic, or arbitrary custom-agent execution remains outside this phase and v1.8.
- New providers, Exa, arbitrary tools/data sources, per-finding curation, auto-confirmation, direct Signal/Offering writes, outreach/CRM, Hypotheses, and Persona Discovery remain out of scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VER-03 | Snapshot selected custom version and resolved configuration so later edits cannot change the run | Snapshot seam, database columns, immutability and replay risks below |
| VAL-02 | Reject target-incompatible custom runs before active-run creation | Server-side subject/agent compatibility gate below |
| VAL-03 | Resolve only active target/Practice Area Signals and snapshot the checklist/schema | `deriveActiveChecklist`, preview/launch re-resolution, and race guidance below |
| VAL-04 | Keep effort, limits, model chain, capabilities, tools, and providers server-owned | Existing model settings, policy snapshot, capability presets, and executor seams below |
| VAL-05 | Keep behavior separate from a shallow bounded output schema | Existing `customAgentContracts` policy and structured-output adapter recommendation |
| RUN-01 | Execute active compatible custom agents through the existing v1.7 durable path | Route → `createAnalysisRun` → Workflow → `GroundedExecutionAdapter` flow below |
| RUN-02 | Preserve duplicate protection, bounded execution, safe failure, recovery, and lifecycle behavior | Partial unique index, CTE writes, Workflow state machine, and test map below |
</phase_requirements>

## Summary

Phase 38 should be implemented as a compatibility adapter around the existing v1.7 launch/run pipeline, not as a second custom-agent executor. The current path already performs staff gating, server-side subject/template/Practice Area resolution, active-checklist derivation, model-chain resolution, immutable snapshot construction, atomic run creation, duplicate-active-run rejection, Workflow dispatch, grounded execution, evidence packet persistence, review reconciliation, and confirmed-only candidate reads. [VERIFIED: repository source — `src/app/api/analysis-runs/route.ts`, `src/lib/analysis/snapshots.ts`, `src/workflows/analysisRun.ts`, `src/lib/db/queries/confirmedCandidates.ts`]

The main integration seam is the identity/configuration handoff. A fixed launch must continue sending the existing fixed `templateVersionId` path. A custom launch must send an opaque custom identity/version reference, then have the server reload the active current version, validate target type + Practice Area + active checklist + effort + capability/output policy, resolve the server-owned model/policy inputs, and construct one run snapshot before inserting the run. [VERIFIED: repository source — `src/lib/db/queries/customAgents.ts`, `src/lib/analysis/customAgentContracts.ts`, `src/lib/analysis/subjects.ts`, `src/lib/db/queries/analysisRuns.ts`]

**Primary recommendation:** Extend the existing options/preview/launch contracts with a discriminated fixed-vs-custom selection, resolve everything again at POST on the server, and reuse `buildPhase33AnalysisSnapshots`/`createAnalysisRun`/`analysisRun`; add only the smallest additive snapshot payload needed to preserve custom behavior and audit identity. [RECOMMENDED: derived from verified repository seams; exact field shape remains discretionary]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Practice Area-first picker and preview | Browser / Client | API / Backend | Client presents server-projected options and preview; server owns compatibility and current-data resolution. [VERIFIED: repository source — `AnalysisLauncher.tsx`, preview/options routes] |
| Custom identity/version compatibility | API / Backend | Database / Storage | The client may select an ID, but target/status/current-version/checklist/policy checks must be server-derived before run insertion. [RECOMMENDED: security boundary from locked context; existing auth/query patterns verified] |
| Active signal checklist resolution | API / Backend | Database / Storage | `deriveActiveChecklist` queries active signals by target and Practice Area and produces the snapshot input. [VERIFIED: repository source — `src/lib/analysis/checklist.ts`] |
| Immutable run intent and execution policy | Database / Storage | API / Backend | JSONB snapshot columns are written in the run-create CTE; the API builds the values and the Workflow reloads them. [VERIFIED: repository source — `schema.ts`, `analysisRuns.ts`, `analysisRun.ts`] |
| Durable execution and recovery | API / Backend | Database / Storage | Vercel Workflow is the entrypoint, while DB status/events remain authoritative and the executor uses snapshotted inputs. [VERIFIED: repository source — `src/workflows/analysisRun.ts`; [CITED: https://useworkflow.dev/docs]] |
| Evidence, review, and candidates | Database / Storage | API / Backend | Grounded packet persistence, whole-run review, and confirmed-only SQL projection already form downstream boundaries; custom runs must enter these same rows. [VERIFIED: repository source — `analysisRun.ts`, `analysisReviews.ts`, `confirmedCandidates.ts`] |

## User Constraints

The locked decisions are copied verbatim in the first `<user_constraints>` section. The planner must preserve them, especially fixed-template omission behavior, server-owned capability/provider policy, immutable snapshots, and Phase 39's ownership of broad adversarial/authenticated E2E proof. [VERIFIED: `.planning/phases/38-execution-compatibility-safe-integration/38-CONTEXT.md`]

## Current v1.7 Flow and Exact Seams

```text
Company/Persona detail
  -> AnalysisRunLauncher loads GET /api/analysis-options?subjectType=...
  -> Practice Area selection
  -> POST /api/analysis-preview (subject + Practice Area)
  -> preview renders instruction/checklist/effort
  -> POST /api/analysis-runs (fixed templateVersionId today)
       -> requireStaffAccess() and strict parse
       -> resolve current/active template version
       -> resolve subject for template target type
       -> resolve active Practice Area
       -> deriveActiveChecklist(target, Practice Area)
       -> resolveModelChain(server user settings)
       -> buildPhase33AnalysisSnapshots(...)
       -> createAnalysisRun(one CTE; unique active-run guard)
       -> start(analysisRun, [applicationRunId])
  -> Workflow claims queued row and reloads DB-authoritative snapshots
  -> GroundedExecutionAdapter(modelFactory chain + Firecrawl tool)
  -> normalize/persist immutable packet before completed transition
  -> reconcile completed run to whole-run review
  -> Confirmed-only candidate SQL projection
```

Every arrow is an existing seam, except the fixed/custom selection resolution. [VERIFIED: repository source — `src/app/api/analysis-options/route.ts`, `src/app/api/analysis-preview/route.ts`, `src/app/api/analysis-runs/route.ts`, `src/workflows/analysisRun.ts`, `src/lib/db/queries/confirmedCandidates.ts`]

### Required identity handoff

Use a strict discriminated launch selection rather than overloading a client-supplied template version with custom meaning. The exact names are discretionary, but the semantics should be equivalent to:

```typescript
type AnalysisAgentSelection =
  | { readonly kind: 'fixed'; readonly templateVersionId: number }
  | { readonly kind: 'custom'; readonly customAgentId: string };
```

The client should submit the selected custom agent identity, not instruction, output schema, capability IDs, actor ID, resolved effort, model chain, tool names, provider names, budget, or policy. The POST route must reload the selected active custom agent and latest immutable version, then reject stale/retired/mismatched selections before `createAnalysisRun`. [RECOMMENDED: preserves Phase 37's server-owned input boundary and verified `customAgentContracts`/`customAgents` query shape]

The selected immutable version ID must be retained in the run's existing `templateVersionId` foreign key. The existing schema already models custom rows through `analysis_template.kind = 'custom'`, `practice_area_id`, and custom version columns. A separate custom-run table or parallel workflow is not indicated. [VERIFIED: repository source — `src/lib/db/schema.ts:555-605`, `drizzle/0007_custom_agent_definition.sql`]

### Practice Area-first options and preview

`GET /api/analysis-options` currently returns fixed templates and all active Practice Areas, while the client parser currently discards `templates` and only stores Practice Areas. [VERIFIED: repository source — `src/app/api/analysis-options/route.ts`, `src/components/analysis/analysisLauncherClient.ts`]

The planner should extend the response with a server-projected agent option list after Practice Area selection, or add a narrowly composed resolution endpoint. It must include the fixed template and only active custom agents whose persisted `targetType` equals the current subject type and whose persisted `practiceAreaId` equals the selected active Practice Area. Multiple custom matches must be returned as separate options with stable identity/version display metadata; no server or client ranking may silently select a custom agent. The fixed option is the first/default option. [RECOMMENDED: directly implements D-38-01 through D-38-06]

Preview must accept the same selection as launch or an equivalent custom identity. It should resolve the selected current version again, not trust preview text/configuration. A preview may show custom behavior instruction, bounded output summary, capability display metadata, checklist, effort, and Practice Area, but the POST launch is the authoritative compatibility/snapshot gate. [RECOMMENDED: avoids preview-to-launch TOCTOU and client tampering]

### Launch POST compatibility order

Keep `requireStaffAccess()` first. Then use strict parsing and a compatibility resolver with an explicit result taxonomy. Recommended order:

1. Parse positive subject ID, active Practice Area ID, and fixed/custom selection.
2. Resolve the real Company/Persona record and verify target type.
3. Resolve the active Practice Area.
4. For fixed selection, preserve current fixed-template resolution and behavior unchanged.
5. For custom selection, resolve the custom identity, require `kind='custom'`, `status='active'`, a current immutable version, and matching target type + Practice Area.
6. Derive the checklist using the selected target type and Practice Area; require the same target and Practice Area and preserve only `status='active'` items.
7. Validate custom capability IDs against `CAPABILITY_PRESETS`; resolve runtime capability/tool policy from the server, never from authored IDs.
8. Validate supported/default effort against the server-approved effort set; resolve the actual launch effort deterministically.
9. Resolve the user's server-owned model chain and validate it through the existing servable/modelFactory path; never accept provider/model entries from custom input.
10. Validate the optional bounded structured-output configuration and adapt it into the grounded executor without allowing grounding/evidence/review/candidate fields.
11. Resolve the current approved/deferred execution policy and build the complete immutable snapshot.
12. Insert the run through the existing atomic create boundary; only after success dispatch the Workflow.

All compatibility failures should return a non-active-run response (normally 400 for malformed/unsupported input, 404 for missing records, or 409 for stale/incompatible/lifecycle conflicts). The exact codes are discretionary, but the route must not create a queued row for a failed compatibility check. [RECOMMENDED: consistent with current `resolutionErrorResponse`; [VERIFIED: repository source — `analysis-runs/route.ts`, `subjects.ts`]]

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.2.11 | App Router pages and Route Handlers | Existing application framework; do not introduce a second server boundary. [VERIFIED: repository `package.json`] |
| TypeScript | ^5 | Strict application contracts | Existing typed route/query/executor code. [VERIFIED: repository `package.json`, `tsconfig.json`] |
| Zod | ^4.4.3 | Strict request, snapshot, output, and policy parsing | Existing analysis contracts use strict Zod schemas and discriminated outcomes. [VERIFIED: repository `package.json`, `src/lib/analysis/*Contracts.ts`] |
| Drizzle ORM + Neon HTTP | ^0.45.2 / ^1.1.0 | PostgreSQL schema and atomic query boundaries | Existing DB access uses Drizzle with Neon HTTP; interactive transaction callbacks are explicitly avoided. [VERIFIED: repository `package.json`, `src/lib/db/index.ts`, `analysisRuns.ts`] |
| Vercel Workflow | 4.8.0 | Durable detached run execution | Existing `start(analysisRun, [id])` and `'use workflow'/'use step'` path. [VERIFIED: repository `package.json`, `src/app/api/analysis-runs/route.ts`, `src/workflows/analysisRun.ts`; [CITED: https://useworkflow.dev/docs]] |

### Existing supporting seams (no new dependencies)

| Seam | Purpose | Use in Phase 38 |
|------|---------|-----------------|
| `customAgents.ts` | Custom identity, lifecycle, current version, history | Load server-authoritative selection and version. [VERIFIED: repository source] |
| `customAgentContracts.ts` | Bounded authored fields/output schema | Reuse validation; do not widen policy silently. [VERIFIED: repository source] |
| `capabilityPresets.ts` | `none` and `web-research` server-approved IDs | Resolve capability metadata/runtime server-side. [VERIFIED: repository source] |
| `modelConfig.ts` + `modelFactory.ts` | User chain resolution and provider instantiation | Keep model/provider boundary unchanged. [VERIFIED: repository source; canonical context] |
| `checklist.ts` | Active target-specific signal checklist | Use for preview and final snapshot, with launch-time recheck. [VERIFIED: repository source] |
| `snapshots.ts` + `analysisRuns.ts` | Immutable snapshot builder and run ledger | Extend minimally, preserving one create CTE. [VERIFIED: repository source] |

**Installation:** None. Phase 38 should not add packages or providers. [VERIFIED: repository `package.json`; [VERIFIED: locked Phase 38 context]]

## Package Legitimacy Audit

No external package installation is recommended for this phase. Existing packages are reused; therefore the package-legitimacy gate has no new package target and no slopcheck run is required. [VERIFIED: repository `package.json`; [VERIFIED: research scope]

## Architecture Patterns

### System Architecture Diagram

```text
Staff target page
  -> Practice Area options
  -> server-filtered fixed + active custom options
  -> preview (selection + server-resolved display data)
  -> launch POST
       -> auth + strict parse
       -> target/Practice Area/agent/version/checklist/policy compatibility
       -> model chain + capability + output adapter resolution
       -> immutable JSONB snapshots + scalar FK identities
       -> atomic queued run + queued event
       -> durable Workflow(applicationRunId)
            -> DB claim/reload snapshots
            -> existing modelFactory + Firecrawl grounded adapter
            -> immutable packet/evidence persistence
            -> completed -> pending_review reconciliation
            -> whole-run Confirm/Dismiss
            -> confirmed-only read projection
```

The custom branch must converge into the same snapshot, Workflow, packet, review, and candidate nodes as the fixed branch. [RECOMMENDED: compatibility-preserving architecture; downstream nodes verified in repository source]

### Recommended Project Structure

```text
src/app/api/analysis-options/route.ts       # Practice Area + filtered agent options
src/app/api/analysis-preview/route.ts       # fixed/custom preview resolution
src/app/api/analysis-runs/route.ts          # authoritative launch compatibility gate
src/components/analysis/AnalysisLauncher.tsx
src/components/analysis/analysisLauncherClient.ts # discriminated selection payload/response parser
src/lib/analysis/subjects.ts                # target, Practice Area, selected version resolution
src/lib/analysis/checklist.ts               # active signal checklist
src/lib/analysis/customAgentContracts.ts    # authored bounded config validation
src/lib/analysis/snapshots.ts               # immutable custom/fixed snapshot construction
src/lib/analysis/execution.ts               # exact bounded custom-output adapter
src/lib/db/queries/analysisRuns.ts          # atomic run insertion / duplicate boundary
src/lib/db/queries/customAgents.ts          # custom identity/version reads
src/workflows/analysisRun.ts                # scalar-ID reload and custom-output adapter wiring
src/lib/analysis/*test.ts                   # deterministic contract/compatibility tests
src/lib/db/queries/*integration.test.ts     # DB/CTE/migration tests when TEST_DATABASE_URL exists
```

### Pattern 1: Discriminated fixed/custom launch selection

**What:** Keep fixed-template and custom-agent selection distinguishable at the contract boundary. [RECOMMENDED]
**When to use:** Any options, preview, or launch request that can select a custom agent. [RECOMMENDED]

```typescript
const selectionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('fixed'), templateVersionId: z.number().int().positive() }).strict(),
  z.object({ kind: z.literal('custom'), customAgentId: z.string().trim().min(1).max(120) }).strict(),
]);
```

The exact schema may differ, but authored custom configuration must never cross from browser to executor as trusted input. [RECOMMENDED: follows existing strict route schemas and Phase 37 input boundary]

### Pattern 2: Resolve twice, snapshot once

Preview is advisory; launch is authoritative. At POST, reload active status/current immutable version, subject, active Practice Area, active checklist, server model chain, server capability policy, structured-output policy, and execution policy. Then build one snapshot and pass only that snapshot into `createAnalysisRun`. [RECOMMENDED: closes edits/lifecycle/checklist races; existing Workflow reload behavior verified]

### Pattern 3: One run ledger, one Workflow, one downstream contract

The Workflow input remains scalar `applicationRunId`; it reloads the DB row and executes only snapshot fields. Packet persistence precedes `completed`, then review reconciliation and confirmed-only aggregation remain unchanged. [VERIFIED: inherited Phase 33/34 contexts and repository `analysisRun.ts`]

### Pattern 4: Atomic create and duplicate protection

`createAnalysisRun` inserts the row and initial queued event in one data-modifying CTE. PostgreSQL unique violation is mapped only to `active_run_exists`. The existing partial unique index is keyed by `(subject_type, subject_id, template_id)` for queued/running/pending-review statuses. [VERIFIED: repository `analysisRuns.ts`, `schema.ts`, `drizzle/0001_phase32_template_snapshot_run_ledger.sql`]

**Resolved concurrency choice:** With custom agents represented by distinct `analysis_template.id` values, the existing index prevents duplicate active runs for the same subject and selected agent while allowing a fixed run and a custom run to be active concurrently. Phase 38 does not broaden the index to global subject uniqueness; any future product request for that behavior requires explicit authorization and a separate schema decision. [VERIFIED: repository schema; RESOLVED: D-38-13 planning choice]

## Snapshot and Database Findings

### Can the existing schema carry custom snapshots?

Mostly yes. `analysis_template` already has `kind`, `practiceAreaId`, and lifecycle status; `analysis_template_version` already stores custom name/description/research query/behavior instruction/structured output schema/capability preset IDs; `analysis_run` already stores `templateId`, `templateVersionId`, target/subject/Practice Area scalar identities, and five JSONB snapshots. [VERIFIED: repository `src/lib/db/schema.ts`, migration `drizzle/0007_custom_agent_definition.sql`]

The existing `templateSnapshot` contract currently contains resolved instruction and effort but no explicit custom metadata/output schema/capability snapshot. `executionSnapshot` contains effort, resolved model chain, budget, and policy. Phase 38 resolves this with a contract-only additive extension of the existing JSONB snapshot types: `analysis_run.template_snapshot.custom` stores the immutable custom identity/version and validated authored configuration, while `analysis_run.execution_snapshot.customOutputSchema` stores `{schemaVersion: 1, storage: 'analysis_run_result.raw_audit.customOutput', fields}`. [VERIFIED: repository `src/lib/analysis/contracts.ts`, `snapshots.ts`; RESOLVED: Phase 38 plan]

**Resolved migration decision:** No SQL migration is required or planned. The existing `template_snapshot`, `execution_snapshot`, and `analysis_run_result.raw_audit` JSONB columns carry the exact custom configuration, output schema, and persisted output path; the existing `templateVersionId` foreign key remains the immutable version identity. No scalar audit column, new JSONB column, separate custom-version FK, uniqueness change, or parallel custom-run table is introduced. [RESOLVED: Phase 38 plan; verified against `src/lib/db/schema.ts`]

If a migration is needed, update `src/lib/db/schema.ts`, create a journaled `drizzle/00NN_*.sql` plus matching `drizzle/meta/*_snapshot.json`, and run `npm run db:check`, `npm run db:validate`, and the schema integration test. The repository's migration validator requires every journaled SQL file and snapshot to be present, contiguous, and hash-consistent. [VERIFIED: `scripts/validate-drizzle-migrations.ts`, `drizzle/meta/_journal.json`]

`npm run db:push` is development-only and explicitly gated by `NODE_ENV=development` and `ALLOW_DB_PUSH=1`; it is not a substitute for a committed migration or production proof. [VERIFIED: `scripts/db-push-dev.mjs`]

### Snapshot contents required for VER-03

At minimum, the custom snapshot needs immutable copies or immutable references that let a replay reconstruct:

- selected custom identity and immutable version ID, kind, target type, Practice Area identity;
- resolved custom name/description as needed for display/audit;
- behavior instruction and research query after server validation;
- bounded structured-output schema, if accepted;
- capability preset IDs plus server-resolved capability/tool policy, not executable tool names from staff input;
- target/subject type, numeric ID, and display name snapshot;
- active checklist items including signal IDs, names, categories, descriptions, and Persona buyer-role IDs where applicable;
- resolved effort and server-owned model chain;
- future budget and approved/deferred execution policy.

The selected plan copies these values into `template_snapshot.custom` and `execution_snapshot.customOutputSchema` exactly; the Workflow reloads them from the run row and never rereads mutable custom-agent, checklist, settings, or policy rows. [RESOLVED: D-38-12/D-38-13 planning choice]

Do not store raw prompts, unrestricted model output, credentials, Clerk/session data, database URLs, private reasoning, or unrestricted retrieved pages. Existing snapshot tests explicitly reject those classes of input, and Phase 33 stores only allowlisted audit metadata plus bounded evidence. [VERIFIED: `src/lib/analysis/snapshots.test.ts`, inherited Phase 33 context]

### Concurrency and replay risks

1. **Preview-to-launch custom edit:** A custom version can be edited after preview. Launch must use identity/version resolution at POST and either explicitly require the selected version or deliberately resolve current version; the latter changes the meaning of a stale preview. Recommendation: carry the previewed immutable version ID and reject if it is no longer current/active, then refresh. [RECOMMENDED: preserves preview truth and immutable reproducibility]
2. **Retire/reactivate race:** Retirement after options load must cause launch rejection before run insertion. Reactivation must not mutate an already-created run; it only affects later launches. [VERIFIED: Phase 37 lifecycle decisions; [RECOMMENDED: launch gate behavior]]
3. **Signal status/name race:** Preview checklist can differ from launch checklist if a signal is archived or edited. Re-derive at launch and snapshot the launch result; if the UI must guarantee preview equivalence, compare a deterministic checklist digest and reject stale preview. Exact digest/rejection UX is open. [RECOMMENDED]
4. **Model settings race:** Resolve the user model chain during launch and copy it into execution snapshot. Workflow must not read mutable Settings later. [VERIFIED: inherited Phase 33 decision and `GroundedExecutionAdapter` tests]
5. **Concurrent duplicate starts:** Browser aborts do not cancel a server request. Keep the DB unique index/CTE mapping as the authority; do not rely on disabled buttons. [VERIFIED: `AnalysisRunLauncher.tsx`, `analysisRuns.ts`, schema]
6. **Workflow replay/claim race:** Workflow reloads scalar run ID and uses guarded status transitions. Custom logic must not use Workflow metadata or mutable custom-agent state during execution. [VERIFIED: `analysisRun.ts`, inherited Phase 33 context]
7. **Result/review replay:** Packet persistence is unique by run and packet hash, and review identity is unique by run/result. Custom fields must not create a second review/candidate path. [VERIFIED: `schema.ts`, Phase 34 context]

## VAL-04 and VAL-05 Compatibility Rules

### Server-owned execution policy

The custom contract currently accepts only `defaultEffort`, `capabilityPresetIds`, behavior/research text, and a normalized bounded output schema. `CAPABILITY_PRESETS` exposes only `none` and `web-research`; IDs are availability presets, not executable tool names or forced invocations. [VERIFIED: `customAgentContracts.ts`, `capabilityPresets.ts`]

The run resolver must:

- validate effort against `supportedEfforts` and the selected version's supported effort policy;
- resolve execution budget and effective limits from server policy, never custom JSON;
- resolve the user's model chain through existing `resolveModelChain` and validate it against the servable catalog/modelFactory path;
- map capability IDs to server-owned runtime capability, keeping Firecrawl/web search as the only existing research boundary;
- force `writesAllowed: false`, bounded public-web access, safe tool-result normalization, and existing timeout/attempt/spend limits;
- reject unknown, duplicate, incompatible, or malformed capability IDs before `createAnalysisRun`;
- reject any provider/tool/data-source field supplied by the client or stored as an unsupported custom field.

[VERIFIED: existing contracts and execution path; [RECOMMENDED: Phase 38 gate decomposition]]

### Structured output

The authored schema is already shallow and bounded: max 12 fields, primitive/array fields only, bounded names/descriptions/enums/array sizes/serialized bytes, duplicate-name rejection, and reserved names containing grounding/citation/evidence/review/candidate. [VERIFIED: `customAgentContracts.ts`]

Behavior instructions and output shape must remain separate. The existing grounded executor currently asks for its fixed `narrative`/`findings` object and then derives evidence/citations from server-owned tool results. [VERIFIED: `execution.ts`, `groundedContracts.ts`]

**Resolved output representation:** Treat custom fields as an additive model-output channel using the exact model envelope `{ narrative, findings, custom }`. The server-built adapter validates `custom` against `execution_snapshot.customOutputSchema.fields`, returns it as the named `GroundedExecutionResult.customOutput`, passes it through `normalizeAnalysisPacket({ ..., customOutput })`, and persists it as `analysis_run_result.raw_audit.customOutput`. The fixed `GroundedPacket` envelope remains unchanged; custom fields cannot redefine findings, citations, source identity, signal IDs, review state, or candidate eligibility. [RESOLVED: VAL-05/D-38-10/D-38-11 planning choice]

The top-level `custom` wrapper is the only model-output extension, and `raw_audit.customOutput` is the only persisted custom-output path. The fixed grounded packet and all normalized finding/evidence/review/candidate tables remain unchanged. [RESOLVED: no migration required]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Custom version loading/lifecycle | New custom version table or mutable run config | `customAgents.ts` + existing `analysis_template(_version)` | Phase 37 already established append-only versions and lifecycle. [VERIFIED: repository source] |
| Active checklist | Client signal list or custom signal copy | `deriveActiveChecklist(targetType, practiceArea)` | It selects active target-specific signals and emits the validated snapshot shape. [VERIFIED: `checklist.ts`] |
| Model/provider access | Provider switch or SDK call in custom code | `resolveModelChain` + `modelFactory`/`instantiateChain` | Existing provider policy, fallback, and audit semantics remain centralized. [VERIFIED: repository source and locked context] |
| Durable execution | New queue/worker/promise background job | `analysisRun` Workflow and DB-authoritative transitions | Claim/recovery/replay and scalar workflow input are already established. [VERIFIED: `analysisRun.ts`; [CITED: https://useworkflow.dev/docs]] |
| Evidence/citations | Trust model URLs or custom citations | `GroundedExecutionAdapter` + `evidence.ts` normalization | Firecrawl provenance, canonical URL/content hash, duplicate and unsafe checks are already fail-closed. [VERIFIED: repository source] |
| Review/candidates | Custom approval table or direct offering writes | Existing whole-run review and confirmed candidate SQL | One decision and confirmed-only provenance are locked. [VERIFIED: Phase 34 context and repository source] |
| DB concurrency | Client-only duplicate guard or interactive transaction callback | Existing unique index + Neon-safe CTE | Neon HTTP does not support the existing interactive callback pattern. [VERIFIED: `analysisRuns.ts`, `src/lib/db/index.ts`] |

## Common Pitfalls

### Pitfall 1: Client-only filtering

**What goes wrong:** The UI hides incompatible custom agents, but a forged POST selects another target/Practice Area. **Why:** options are treated as authorization. **How to avoid:** repeat all compatibility checks in preview and especially launch POST before `createAnalysisRun`. **Warning signs:** route trusts `customAgentId` without loading target/status/version/Practice Area. [RECOMMENDED: fail-closed boundary]

### Pitfall 2: Using the current version after selection

**What goes wrong:** Staff previews version N, edits save version N+1, and the launch silently runs N+1. **How to avoid:** carry and validate the selected immutable version ID or explicitly make the preview stale and require refresh; never let mutable current state change an already-created run. [RECOMMENDED; VER-03]

### Pitfall 3: Snapshotting only the custom ID

**What goes wrong:** Replay reloads mutable custom configuration, signal names, model settings, or policy and changes historical output. **How to avoid:** copy all resolved execution inputs into existing snapshot JSONB before insertion; Workflow reads only the run row. [VERIFIED: Phase 33 context and existing snapshot/executor code]

### Pitfall 4: Treating active custom agents as globally unique

**What goes wrong:** Multiple active agents are merged or one is auto-selected, violating explicit choice. **How to avoid:** return separate options; fixed remains default; submit the selected identity/version. [VERIFIED: D-38-02 through D-38-05]

### Pitfall 5: Accidentally changing fixed semantics

**What goes wrong:** Existing fixed launch payload changes from `templateVersionId` to a custom-shaped payload, or fixed template queries begin including custom rows. **How to avoid:** preserve fixed branch and add regression tests for options, preview, launch snapshots, evidence/review/candidate paths. [VERIFIED: `listActiveAnalysisTemplates` filters `kind='fixed'`; [RECOMMENDED: compatibility test strategy]]

### Pitfall 6: Capability IDs become executable tools

**What goes wrong:** Staff-authored strings reach tool invocation or provider selection. **How to avoid:** validate opaque IDs, map them through `CAPABILITY_PRESETS`, and construct runtime tools/policy only on the server. [VERIFIED: `capabilityPresets.ts`; [RECOMMENDED: VAL-04 gate]]

### Pitfall 7: Custom schema replaces grounded output

**What goes wrong:** Custom output omits fixed findings/citations or makes model-provided URLs authoritative. **How to avoid:** retain the fixed grounded envelope and server-owned evidence channel; custom fields are additive only. [VERIFIED: `execution.ts`; [RECOMMENDED: VAL-05 adapter]]

### Pitfall 8: Counting blocked prerequisites as proof

**What goes wrong:** Missing `TEST_DATABASE_URL` or provider credentials are reported as passed. **How to avoid:** preserve blocked/not-run classifications; deterministic tests prove contracts, while DB/Workflow and authenticated E2E are separately gated. [VERIFIED: `STATE.md`, environment audit, Phase 36 context]

## Plan Decomposition Recommendation

### Wave 0 — Contract and JSONB representation gate

1. Decide the discriminated fixed/custom selection and authoritative version semantics.
2. Decide the exact custom snapshot representation and structured-output adapter, documenting any fields that fit existing JSONB versus any additive SQL migration.
3. Lock the no-migration decision: existing JSONB paths are sufficient and the adapter/persistence contract is `customOutputSchema` → `GroundedExecutionResult.customOutput` → `normalizeAnalysisPacket` → `raw_audit.customOutput`.

Likely files: `src/lib/analysis/contracts.ts`, `src/lib/analysis/experienceContracts.ts`, `src/lib/analysis/snapshots.ts`, `src/lib/analysis/customAgentContracts.test.ts`, new compatibility contracts/tests. No schema/migration files. [RESOLVED]

### Wave 1 — Server compatibility/resolution core

1. Add fixed/custom option projection and selected-agent resolution in query/subject boundaries.
2. Add a shared resolver used by preview and launch: target, active Practice Area, custom lifecycle/current version, signal/checklist compatibility, effort, capability, output policy, model chain, and execution policy.
3. Preserve fixed-template query allowlisting and fixed behavior as a separate branch.

Likely files: `src/lib/db/queries/customAgents.ts`, `src/lib/db/queries/analysisTemplates.ts`, `src/lib/analysis/subjects.ts`, `src/lib/analysis/checklist.ts`, `src/lib/analysis/capabilityPresets.ts`, `src/lib/analysis/compatibility.ts`, plus route unit tests. [RESOLVED]

### Wave 2 — Preview/options and launcher

1. Make Practice Area selection precede the agent picker.
2. Render fixed default plus matching active custom alternatives; require explicit choice among multiple custom agents.
3. Carry selection through preview and POST launch while preserving fixed omission behavior and abort/generation race handling.

Likely files: `src/app/api/analysis-options/route.ts`, `src/app/api/analysis-preview/route.ts`, `src/components/analysis/analysisLauncherClient.ts`, `src/components/analysis/AnalysisLauncher.tsx`, preview tests. [RECOMMENDED]

### Wave 3 — Snapshot/run/workflow integration

1. Extend snapshot construction to include the chosen custom immutable configuration and server-resolved policy.
2. Pass the same `createAnalysisRun` input shape for fixed and custom rows; retain CTE duplicate mapping.
3. Keep Workflow input scalar `applicationRunId`, reload `template_snapshot.custom` and `execution_snapshot.customOutputSchema`, and explicitly pass the schema into `GroundedExecutionAdapter`.
4. Pass named `customOutput` through packet normalization and persistence to `analysis_run_result.raw_audit.customOutput`; do not change the fixed grounded packet or evidence/review/candidate projection.

Likely files: `src/lib/analysis/snapshots.ts`, `src/lib/analysis/contracts.ts`, `src/lib/analysis/execution.ts`, `src/lib/analysis/groundedContracts.ts`, `src/lib/analysis/results.ts`, `src/lib/db/queries/analysisResults.ts`, `src/lib/db/queries/analysisRuns.ts`, `src/workflows/analysisRun.ts`. No new executor or migration. [RESOLVED]

### Wave 4 — Deterministic compatibility gate

Add unit/fixture coverage for every rejection and success path, then DB/Workflow integration coverage where prerequisites exist. Leave Phase 39 authenticated/adversarial/review-boundary E2E as a separate handoff. [RECOMMENDED]

## Code Examples

### Snapshot adapter shape

```typescript
const snapshots = buildPhase33AnalysisSnapshots({
  template: {
    schemaVersion: 1,
    templateId: resolved.templateId,
    templateVersionId: resolved.versionId,
    templateKey: resolved.key,
    templateName: resolved.displayName,
    targetType: resolved.targetType,
    version: resolved.version,
    resolvedInstruction: resolved.behaviorInstruction,
    effort: resolved.effort,
    custom: resolved.kind === 'custom' ? {
      schemaVersion: 1,
      customAgentId: resolved.customAgentId,
      templateVersionId: resolved.templateVersionId,
      version: resolved.version,
      name: resolved.name,
      description: resolved.description,
      researchQuery: resolved.researchQuery,
      behaviorInstruction: resolved.behaviorInstruction,
      capabilityPresetIds: resolved.capabilityPresetIds,
      outputSchema: resolved.outputSchema,
    } : undefined,
  },
  subject: resolved.subject,
  checklist: resolved.checklist,
  resolvedModelChain: resolved.modelChain,
  customOutputSchema: resolved.outputSchema === null ? null : {
    schemaVersion: 1,
    storage: 'analysis_run_result.raw_audit.customOutput',
    fields: resolved.outputSchema,
  },
}, resolved.policy);
```

The custom fields and persistence path above are the locked Phase 38 plan representation; fixed snapshots omit both custom fields. [RESOLVED: D-38-13 planning choice; no migration]

### Existing Workflow convergence

```typescript
const created = await createAnalysisRun({ ...snapshots, createdBy: userId });
if (!created.ok) return Response.json({ error: 'active_run_exists' }, { status: 409 });
await start(analysisRun, [created.run.id]);
```

This is the required convergence point for fixed and custom launches. The Workflow receives only `applicationRunId`, reloads `template_snapshot.custom` and `execution_snapshot.customOutputSchema`, passes the schema to `GroundedExecutionAdapter`, then passes `GroundedExecutionResult.customOutput` through `normalizeAnalysisPacket` to `persistAnalysisPacket`, which writes `raw_audit.customOutput`. [RESOLVED: D-38-09/D-38-12]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10; Workflow Vitest config; Playwright 1.62.1 for authenticated E2E [VERIFIED: `package.json`] |
| Config file | `vitest.config.*` / `vitest.workflow.config.ts`; inspect exact project config during planning [VERIFIED: repository package scripts and test files] |
| Quick run command | `npm test -- --run src/lib/analysis/customAgentContracts.test.ts src/lib/analysis/capabilityPresets.test.ts src/lib/analysis/snapshots.test.ts` [RECOMMENDED command shape] |
| Full unit suite command | `npm test` [VERIFIED: `package.json`] |
| DB/Workflow suite | `npm run test:workflow` only with `TEST_DATABASE_URL`; absence is blocked, not pass [VERIFIED: `package.json`, `STATE.md`] |
| Migration checks | `npm run db:check && npm run db:validate` [VERIFIED: `package.json`] |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VER-03 | Custom version/config/checklist/model/policy snapshot remains unchanged after source mutation or later edit | unit + DB integration | `npm test -- --run src/lib/analysis/snapshots.test.ts`; integration when DB available | Unit exists; custom cases Wave 1 ❌ |
| VAL-02 | Wrong target type rejected before `createAnalysisRun` | unit route/resolver | targeted Vitest compatibility test | ❌ Wave 1 |
| VAL-03 | Only active target/Practice Area signals enter preview/launch snapshot; stale mismatch rejects or refreshes | unit + DB integration | checklist/route targeted tests; `npm run test:workflow` when DB available | Checklist tests exist; custom launch cases ❌ |
| VAL-04 | Invalid effort/capability/provider/tool/policy input rejected; server model/policy values win | unit | custom contract + compatibility tests | Contracts exist; launch matrix ❌ |
| VAL-05 | Bounded shallow schema accepted; reserved/oversized/nested/collision fields fail; grounded envelope remains | unit + executor | `npm test -- --run src/lib/analysis/customAgentContracts.test.ts src/lib/analysis/execution.test.ts` | Partial existing coverage; adapter cases ❌ |
| RUN-01 | Custom and fixed launches converge to same Workflow/executor/evidence path | integration fixture | `npm run test:workflow` with `TEST_DATABASE_URL`; fixture-only path where supported | Existing v1.7 tests; custom cases ❌ |
| RUN-02 | Duplicate active run, bounded failure, recovery/replay, and safe error behavior apply to both kinds | DB/workflow integration + unit race cases | `npm run test:workflow` with DB; targeted `analysisRuns.test.ts` | Existing run tests; custom identity matrix ❌ |

### Deterministic fixture/unit layers

- Extend custom contract tests for every Phase 37 bounded limit, capability ID, reserved field, and output collision. [VERIFIED: existing test locations; [RECOMMENDED: coverage]
- Add a pure compatibility resolver test matrix over `{company, persona}` × `{fixed, custom}` × target/Practice Area match/mismatch × active/retired/current/stale. [RECOMMENDED]
- Add snapshot mutation tests that alter custom source objects, version rows, model settings, checklist rows, and policy input after build; assert stored snapshot remains unchanged. [RECOMMENDED: VER-03]
- Add launch-route tests proving `createAnalysisRun` is not called for every compatibility rejection and is called once for valid custom/fixed input. [RECOMMENDED: VAL-02/04]
- Add duplicate identity matrix: same subject + same fixed template; same subject + same custom agent; fixed + custom if product allows concurrent distinct templates. Assert the chosen partial-index semantics rather than guessing. [RECOMMENDED; open concurrency choice]
- Add executor tests proving custom output fields cannot remove fixed grounded fields, cannot supply evidence/citations as authoritative data, and still map malformed output/tool content to safe failure. [RECOMMENDED: VAL-05]

### Phase 39 handoff

Phase 38 should provide deterministic seams and fixture IDs; Phase 39 owns broad authenticated and adversarial verification. Phase 39 must prove server-derived actor authorization, prompt/evidence/tool fail-closed behavior, no live Signal/Offering/link writes, one whole-run review idempotency, confirmed-only aggregation, canonical `/agents`, and Company/Persona browser flows. [VERIFIED: requirements and Phase 38 context]

Do not move Phase 39's review-boundary or authenticated custom-agent E2E into Phase 38 merely to claim RUN-01/RUN-02. Do not claim missing `TEST_DATABASE_URL` or live provider credentials as passing database/provider evidence. [VERIFIED: `STATE.md`, environment audit, inherited contexts]

### Sampling Rate

- **Per task:** targeted Vitest command for the changed contract/resolver/query. [RECOMMENDED]
- **Per wave merge:** `npm test`; `npm run db:check && npm run db:validate` if schema/migrations changed. [RECOMMENDED]
- **DB/Workflow gate:** `npm run test:workflow` only when `TEST_DATABASE_URL` is supplied; otherwise record blocked. [VERIFIED: package script]
- **Phase gate:** `npm test`, typecheck/build project command, migration validation, and Phase 39 handoff evidence are green or explicitly classified blocked/not-run. [RECOMMENDED]

### Wave 0 Gaps

- [ ] Compatibility resolver/route tests for fixed-vs-custom selection and pre-run rejection.
- [ ] Snapshot tests for custom configuration/version identity and edit/lifecycle/checklist/model/policy replay immutability.
- [ ] Structured-output adapter tests for bounded additive fields and reserved server-owned channel collisions.
- [ ] DB integration fixtures for custom template rows, duplicate active custom runs, and schema/migration state.
- [ ] Workflow integration fixtures for custom run claim/replay/failure using deterministic executor dependencies.

## Security Domain

Security enforcement is enabled at ASVS level 1. [VERIFIED: `.planning/config.json`]

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | yes | `requireStaffAccess()` first in options, preview, and launch routes. [VERIFIED: repository routes] |
| V3 Session Management | yes | Server-derived Clerk actor; never accept actor/user identity from launch payload. [VERIFIED: inherited contexts] |
| V4 Access Control | yes | Server-owned custom lifecycle/target/Practice Area/version/capability checks before run insert. [RECOMMENDED; locked D-38-07] |
| V5 Input Validation | yes | Strict Zod discriminated selection, bounded custom contracts, snapshot and policy schemas. [VERIFIED: repository contracts; [RECOMMENDED: new selection schema] |
| V6 Cryptography | limited | Reuse packet/content hashing and immutable packet identity; never invent a new evidence hash or trust client hashes. [VERIFIED: Phase 33/34 contexts and schema] |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Forged custom ID or target type | Tampering / Elevation | Reload identity/version/target/status and subject server-side; reject before run creation. [RECOMMENDED] |
| Stale preview after edit/retire/signal archive | Tampering | Re-resolve at POST; selected immutable version and checklist digest/version policy; fail closed on mismatch. [RECOMMENDED] |
| Provider/tool injection through custom JSON | Elevation | Allowlist capability IDs; server maps runtime tools/providers; no arbitrary names/URLs. [VERIFIED: capability preset design; [RECOMMENDED: launch gate] |
| Prompt injection in research content | Tampering | Existing safe tool-result filter and evidence normalization; Phase 39 adversarial proof. [VERIFIED: `execution.ts`, Phase 36 context] |
| Direct live Signal/Offering write | Tampering | Existing executor writesAllowed false; packet/review/candidate are additive/read-only downstream paths. [VERIFIED: contracts/schema/Phase 34 context] |
| Duplicate starts/replay | Denial of service / Tampering | Partial unique index, one-CТE create, guarded state transitions, idempotent packet/review identities. [VERIFIED: schema/query modules] |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Unit/build/scripts | ✓ | 22.23.1 | — [VERIFIED: environment audit] |
| npm | Unit/build/scripts | ✓ | 10.9.8 | — [VERIFIED: environment audit] |
| Drizzle CLI | Migration checks | ✗ direct command not found | — | Use project-local `npm run db:check`/`db:validate` if dependencies are installed; do not use DB push as production proof. [VERIFIED: environment audit, package scripts] |
| `TEST_DATABASE_URL` | Neon/Workflow integration | ✗ | — | Deterministic unit/fixture tests; record DB/Workflow evidence blocked. [VERIFIED: environment audit, STATE.md] |
| `FIRECRAWL_API_KEY` | Live grounded provider smoke | ✗ | — | Deterministic injected executor; live provider smoke non-gating/not-run. [VERIFIED: environment audit, Phase 36 context] |
| `CLERK_SECRET_KEY` | Authenticated browser proof | ✗ in shell | — | Phase 39's configured Playwright environment/storage state; do not claim local shell availability. [VERIFIED: environment audit, inherited context] |

**Missing dependencies with no fallback:** None for contract/unit planning. A real Neon/Workflow integration proof is blocked until `TEST_DATABASE_URL` is supplied. [VERIFIED: environment audit and STATE.md]

**Missing dependencies with fallback:** Firecrawl/provider smoke and authenticated E2E can use deterministic executor fixtures for Phase 38, with live/authenticated proof handed to Phase 39. [VERIFIED: Phase 36 context; [RECOMMENDED: scope separation]]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Mutable provider/settings reads during execution | Resolve model chain at launch and execute the snapshotted chain | Phase 33/previous model phases | Custom runs must copy model chain into execution snapshot. [VERIFIED: inherited Phase 33 context and `execution.ts`] |
| No-op/short request execution | Detached scalar-ID Workflow with DB-authoritative claim and transitions | Phases 31-33 | Custom code must converge on `analysisRun(applicationRunId)`. [VERIFIED: roadmap and workflow source] |
| Agent proposals directly associated with legacy queue | Immutable grounded packet → whole-run review → confirmed candidate read | Phases 33-34 | No custom parallel review or write path. [VERIFIED: Phase 34 context and schema] |
| Fixed-only launch options | Practice Area-first fixed + compatible active custom options | Phase 38 decision | Custom selection must remain explicit and server-filtered. [VERIFIED: D-38-01..06] |

**Deprecated/outdated:** The old v1.1 `agent_run`/proposal path is not the Phase 38 execution path; do not route custom runs through it. [VERIFIED: Phase 33/34 contexts and current routes]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Existing `templateId`/`templateVersionId` plus named JSONB paths represent custom execution without new scalar columns | Snapshot and Database Findings | No migration is planned; tests must prove `template_snapshot.custom`, `execution_snapshot.customOutputSchema`, and `raw_audit.customOutput`. [RESOLVED] |
| A2 | Selected custom immutable version is carried from preview and rejected if stale | Concurrency and replay risks | Stale preview is a safe refresh/retry outcome, never a silent version switch. [RESOLVED] |
| A3 | Distinct template IDs permit fixed/custom concurrency while same-template duplicates remain blocked | Duplicate protection | The existing partial index is preserved; no global subject uniqueness change is authorized. [RESOLVED] |
| A4 | Custom output can be adapted additively without changing the fixed packet schema | VAL-05 | Exact `{narrative, findings, custom}` → `customOutput` → `raw_audit.customOutput` tests prove the adapter. [RESOLVED] |
| A5 | Project-local dependencies are installed sufficiently for `npm test` despite direct `drizzle-kit` not being on PATH | Environment Availability | Commands may fail before tests; planner should run the dependency check first. [ASSUMED: environment fallback] |

## Open Questions

All Phase 38 implementation-critical questions are resolved below except execution-policy availability, which is intentionally deferred because it depends on external approval/credentials and remains explicitly prerequisite-gated.

1. **What exact immutable version does launch select? — RESOLVED**
   - What we know: Phase 37 versions are append-only and current; D-38-12 requires the selected immutable version in the run snapshot. [VERIFIED]
   - Resolution: Preview and launch carry the selected `templateVersionId`; POST reloads that exact active/current immutable version and rejects stale, retired, missing, or mismatched selections before `createAnalysisRun`. [RESOLVED: D-38-12/D-38-13]

2. **Can fixed and custom runs coexist for the same subject? — RESOLVED**
   - What we know: Current partial unique index includes `template_id`, so distinct templates do not conflict. [VERIFIED: schema]
   - Resolution: Preserve the existing `(subject_type, subject_id, template_id)` partial unique index. Same-subject fixed and custom runs may coexist because their template IDs differ; same-template active duplicates remain rejected. No global subject uniqueness change is authorized. [RESOLVED: D-38-13 planning choice]

3. **Where do custom fields persist? — RESOLVED**
   - What we know: Existing run has JSONB template/execution snapshots; result has fixed narrative/audit/finding/source columns. [VERIFIED: schema]
   - Resolution: Configuration is copied into `analysis_run.template_snapshot.custom`; the normalized schema is copied into `analysis_run.execution_snapshot.customOutputSchema`; validated output is persisted only at `analysis_run_result.raw_audit.customOutput`, included in the packet hash, and excluded from fixed packet/finding/source/review/candidate projections. [RESOLVED: no migration]

4. **What is the exact structured-output envelope? — RESOLVED**
   - What we know: Current executor requires `narrative` and `findings`; custom schema forbids reserved grounding/evidence/review/candidate names. [VERIFIED: `execution.ts`, `customAgentContracts.ts`]
   - Resolution: The model returns `{ narrative, findings, custom }`. `custom` contains only schema-approved shallow values; the adapter extracts it into `GroundedExecutionResult.customOutput`, so the persisted grounded packet remains the fixed v1.7 envelope. Reserved server-owned channels are rejected. [RESOLVED: VAL-05/D-38-10/D-38-11]

5. **What is the Phase 38 real-execution policy state? — INTENTIONALLY DEFERRED**
   - What we know: Phase 33 policy can be approved or deferred; environment lacks provider credentials in this shell. [VERIFIED: contracts and environment audit]
   - Resolution: The repository state remains `phase33_policy_deferred`/execution-disabled unless an already approved server policy is supplied by the target environment. Phase 38 plans deterministic injected execution; live provider smoke is optional and `not-run` with `policy_or_credentials_unavailable` without credentials and approved policy. No policy limits are invented. [INTENTIONALLY DEFERRED: prerequisite-gated]

## Sources

### Primary (HIGH confidence)

- `.planning/phases/38-execution-compatibility-safe-integration/38-CONTEXT.md` — locked launch, compatibility, snapshot, and scope decisions. [VERIFIED: repository source]
- `.planning/REQUIREMENTS.md` — VER-03, VAL-02..05, RUN-01..02 and Phase 39 boundary. [VERIFIED: repository source]
- `.planning/STATE.md` — inherited v1.7 snapshot, executor, evidence, review, candidate, migration, and prerequisite-gating decisions. [VERIFIED: repository source]
- `src/app/api/analysis-options/route.ts`, `analysis-preview/route.ts`, `analysis-runs/route.ts` — current request flow and fixed-template launch seam. [VERIFIED: repository source]
- `src/lib/analysis/{subjects,checklist,snapshots,contracts,customAgentContracts,capabilityPresets,execution,groundedContracts,evidence}.ts` — resolution, validation, snapshots, execution, and evidence contracts. [VERIFIED: repository source]
- `src/lib/db/{schema.ts,queries/analysisTemplates.ts,queries/customAgents.ts,queries/analysisRuns.ts}` — schema and persistence/concurrency boundaries. [VERIFIED: repository source]
- `src/workflows/analysisRun.ts` — durable claim, snapshot reload, grounded packet, safe failure, and review reconciliation. [VERIFIED: repository source]
- [CITED: https://useworkflow.dev/docs] — current Workflow SDK documentation overview checked for the existing durable execution technology.

### Secondary (MEDIUM confidence)

- `src/lib/analysis/*test.ts`, `src/lib/db/queries/*integration.test.ts`, `src/workflows/analysisRun.integration.test.ts`, `e2e/analysis-runs.spec.ts` — existing test seams and fixture patterns. [VERIFIED: repository source]
- `drizzle/0001_phase32_template_snapshot_run_ledger.sql`, `0007_custom_agent_definition.sql`, `0008_phase33_34_packet_review_forward_repair.sql` — migration history and additive schema evolution. [VERIFIED: repository source]
- `package.json`, `scripts/db-push-dev.mjs`, `scripts/validate-drizzle-migrations.ts` — available commands and migration gates. [VERIFIED: repository source]

### Tertiary (LOW confidence)

- None used for core findings. No new package/provider recommendation relies on training knowledge or unverified ecosystem search. [VERIFIED: research log]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — existing manifest and source seams; no new dependencies proposed.
- Architecture: HIGH — full fixed-template route-to-Workflow-to-candidate path traced in current source.
- Snapshot/output adapter: HIGH for the selected contract — existing JSONB paths and the exact `customOutput` adapter/persistence chain are now resolved in the Phase 38 plan; live execution remains prerequisite-gated.
- Pitfalls: HIGH — grounded in current unique index, CTE, snapshot, executor, and inherited phase decisions.

**Research date:** 2026-08-11
**Valid until:** 2026-09-10 for stable repository architecture; re-check Workflow/Next/Drizzle APIs if dependencies change before implementation.
