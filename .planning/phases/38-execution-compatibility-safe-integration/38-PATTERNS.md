# Phase 38: Execution Compatibility & Safe Integration - Pattern Map

**Mapped:** 2026-08-11
**Files analyzed:** 25 likely implementation/test/schema seams
**Analogs found:** 25 / 25 (all have a repository analog; the compatibility resolver itself is a new seam)

Phase 38 should be an adapter around the fixed v1.7 path. Do not create a second executor, run ledger, review path, candidate projection, or provider boundary. The fixed branch must remain an allowlisted regression path; the custom branch resolves server-side and converges before `createAnalysisRun`.

## File Classification

| New/Modified File or Seam | Role | Data Flow | Closest Analog | Status / Match |
|---|---|---|---|---|
| `src/app/api/analysis-options/route.ts` | route/controller | request-response | current options route, lines 14-45 | **modify; exact** |
| `src/app/api/analysis-preview/route.ts` | route/controller | request-response | current preview route, lines 15-82 | **modify; exact** |
| `src/app/api/analysis-runs/route.ts` | route/controller | request-response + durable dispatch | current launch route, lines 33-119 | **modify; exact** |
| `src/components/analysis/AnalysisLauncher.tsx` | component/controller | request-response + polling | current launcher, lines 58-259 | **modify; exact** |
| `src/components/analysis/analysisLauncherClient.ts` | contract/client utility | request-response transform | current client parser/payload, lines 5-122 | **modify; exact** |
| `src/lib/analysis/experienceContracts.ts` | contract/model | transform + request-response | preview schemas, lines 23-71 | **modify; role-match** |
| `src/lib/analysis/contracts.ts` | contract/model | transform + snapshot validation | snapshot schemas/policy, lines 148-212 and existing Phase 33 schemas | **modify; exact** |
| `src/lib/analysis/subjects.ts` | resolver/service | CRUD lookup + request-response | typed subject/template/Practice Area resolvers, lines 42-110 | **modify; exact** |
| `src/lib/analysis/checklist.ts` | service/utility | CRUD-to-transform | `deriveActiveChecklist`, lines 10-55 | **read-only or minimal modify; exact** |
| `src/lib/analysis/customAgentContracts.ts` | contract/validator | transform | Phase 37 bounded parser, lines 226-252 | **read-only or adapter reuse; exact** |
| `src/lib/analysis/capabilityPresets.ts` | policy/utility | transform | server allowlist validator, lines 21-104 | **read-only or minimal modify; exact** |
| `src/lib/analysis/snapshots.ts` | service/validator | transform + immutable persistence input | `buildPhase33AnalysisSnapshots`, lines 73-110 | **modify; exact** |
| `src/lib/analysis/execution.ts` | service/adapter | streaming/durable execution | `GroundedExecutionAdapter.execute`, lines 147-228 | **modify only if output adapter is required; exact** |
| `src/lib/analysis/groundedContracts.ts` | contract/model | request-response + execution | grounded input contract consumed by execution, `execution.ts:9,36-38` | **read-only or additive adapter; role-match** |
| `src/lib/db/queries/customAgents.ts` | query/service | CRUD/read resolution | grouped immutable identity/version query, lines 80-133 | **modify; exact** |
| `src/lib/db/queries/analysisTemplates.ts` | query/service | CRUD/read resolution | fixed-template allowlisted reads (called by options/preview/subjects) | **read-only reference; exact** |
| `src/lib/db/queries/analysisRuns.ts` | query/service | CRUD + event-ledger | atomic create/transition CTE, lines 172-347 | **modify only for input type; exact** |
| `src/workflows/analysisRun.ts` | workflow/executor | durable workflow + streaming/transform | scalar-ID claim/reload/execute path, lines 28-123, 135-302 | **read-only preferred; exact** |
| `src/lib/db/schema.ts` | model/schema | CRUD persistence | custom template/version + five run JSONB snapshots, lines 553-655 | **read-only if JSONB suffices; additive only if needed** |
| `drizzle/0007_custom_agent_definition.sql` | migration | batch schema transform | custom discriminator/check constraints, lines 1-35 | **read-only migration analog** |
| `drizzle/00NN_*.sql`, `drizzle/meta/*` | migration/config | batch schema transform | journaled migration convention, `38-RESEARCH.md:265-269` | **conditional modify only** |
| `src/lib/analysis/compatibility.ts` (likely new) | service/resolver | request-response transform | `subjects.ts` resolution result taxonomy + route gates | **new; compose exact analogs** |
| `src/lib/analysis/*compatibility*.test.ts` (likely new) | test | deterministic transform | `subjects.test.ts:25-215` plus route mock seams | **new; role/data-flow match** |
| `src/app/api/analysis-*/route.test.ts` or route-focused compatibility test (likely new) | test | request-response | existing route contracts and `AnalysisLauncher.test.ts:5-20` | **new; role-match** |
| `src/lib/analysis/snapshots.test.ts` | test | deterministic transform/immutability | existing snapshot fixture and mutation checks, lines 43-231 | **modify; exact** |
| `src/lib/analysis/execution.test.ts` | test | injected execution/streaming | dependency injection and safe failure matrix, lines 67-260 | **modify only for additive output adapter; exact** |
| `src/lib/db/queries/analysisRuns.test.ts` / Workflow fixtures | test | DB CTE + durable workflow | mocked DB and SQL flattening, lines 6-36; `analysisRun.ts` scalar seam | **modify/add fixtures; exact** |

## Pattern Assignments

### Options, preview, and launch routes

#### `src/app/api/analysis-options/route.ts` (modify)

**Analog:** `src/app/api/analysis-options/route.ts:14-45`.

**Server gate and parsing** (lines 14-21):

```typescript
export async function GET(request: Request) {
  await requireStaffAccess();
  const query = Object.fromEntries(new URL(request.url).searchParams.entries());
  const parsed = optionsQuerySchema.safeParse(query);
  if (!parsed.success) return Response.json({ error: 'invalid_input' }, { status: 400 });
```

Keep `requireStaffAccess()` first. Project options from the server; query parameters are not authorization. The fixed option must come first/default, and custom options must be separately returned after the selected Practice Area is known. Filter in the query/resolver by `kind = 'custom'`, `status = 'active'`, target type, and selected active Practice Area. Never rank or silently choose between multiple custom matches.

**Current parallel read pattern** (lines 23-43):

```typescript
const [templates, practiceAreas] = await Promise.all([
  listActiveAnalysisTemplates(parsed.data.subjectType),
  listActivePracticeAreas(),
]);
return Response.json({
  templates: templates.map((template) => ({
    templateId: template.templateId,
    templateVersionId: template.templateVersionId,
    key: template.key,
    name: template.name,
    targetType: template.targetType,
    version: template.version,
    supportedEfforts: template.supportedEfforts,
    defaultEffort: template.defaultEffort,
  })),
  practiceAreas: practiceAreas.map((practiceArea) => ({ id: practiceArea.id, name: practiceArea.name, shortCode: practiceArea.shortCode })),
});
```

Extend the projection rather than exposing raw DB rows. Preserve the fixed-template query allowlist: `listActiveAnalysisTemplates` is a fixed v1.7 compatibility boundary and must not become a mixed fixed/custom query accidentally.

#### `src/app/api/analysis-preview/route.ts` (modify)

**Analog:** `src/app/api/analysis-preview/route.ts:15-82`.

The route has the required order: staff gate, JSON parse, strict contract parse, fixed compatibility lookup, subject resolution, active Practice Area resolution, checklist derivation, response schema parse. Reuse its `resolutionErrorResponse` taxonomy at lines 85-113 for safe 400/404/409 outcomes. Preview is advisory: accept a discriminated fixed/custom selection and resolve the current immutable version again, but do not treat preview configuration as authoritative for launch.

**Checklist/response construction** (lines 58-80):

```typescript
const subjectResolution = await resolveAnalysisSubject(parsed.data.subject, targetType);
if (!subjectResolution.ok) return resolutionErrorResponse(subjectResolution.reason);
const practiceAreaResolution = await resolveActivePracticeArea(parsed.data.practiceAreaId);
if (!practiceAreaResolution.ok) return resolutionErrorResponse(practiceAreaResolution.reason);
const checklist = await deriveActiveChecklist(subjectResolution.value.type, practiceAreaResolution.value);
const preview = analysisPreviewResponseSchema.parse({
  subject: subjectResolution.value,
  template: { templateId: template.templateId, templateVersionId: template.templateVersionId, key: template.key, name: template.name, targetType: template.targetType, version: template.version },
  instruction: template.instruction,
  practiceArea: practiceAreaResolution.value,
  checklist,
  effort: 'standard',
});
```

The custom preview may display name, behavior, bounded output summary, capability cards, checklist, and effort only from server projections. Do not add provider/tool/model fields to the client response as selectable authority.

#### `src/app/api/analysis-runs/route.ts` (modify)

**Analog:** `src/app/api/analysis-runs/route.ts:33-119`.

This is the authoritative compatibility gate. Preserve the existing sequence and put all custom checks before `createAnalysisRun`: `requireStaffAccess()` (lines 33-34), strict request parsing (lines 36-49), subject/Practice Area resolution (lines 51-67), server model-chain resolution (lines 67-68), snapshot building (lines 70-88), atomic create (lines 90-96), and only then Workflow dispatch (lines 98-119).

**Convergence seam** (lines 90-119):

```typescript
const created = await createAnalysisRun({ ...snapshots, createdBy: userId });
if (!created.ok) return Response.json({ error: 'active_run_exists' }, { status: 409 });
const applicationRunId = created.run.id;
try {
  await start(analysisRun, [applicationRunId]);
} catch {
  await transitionAnalysisRun({
    runId: applicationRunId,
    expectedStatus: 'queued',
    toStatus: 'failed',
    actorKind: 'system', actorId: DISPATCH_ACTOR_ID,
    safeReason: 'dispatch_failed', attempt: 0,
  });
  return Response.json({ error: 'dispatch_failed', applicationRunId }, { status: 502 });
}
```

Use a discriminated selection at the request boundary (fixed `templateVersionId` or opaque custom identity/version reference). The route reloads status, target, Practice Area, current immutable version, active checklist, supported/default effort, capabilities, structured-output policy, server model chain, and execution policy. A rejected compatibility result must return before `createAnalysisRun`; never create a queued row and then mark it failed for a compatibility rejection.

### Launcher and client contracts

#### `src/components/analysis/analysisLauncherClient.ts` (modify)

**Analog:** `src/components/analysis/analysisLauncherClient.ts:5-27, 33-51, 57-122`.

Continue strict Zod parsing and safe error-copy mapping. Replace the fixed-only payload with a discriminated fixed/custom selection while retaining the subject and Practice Area fields. Do not send behavior text, output schema, capability IDs, actor ID, model chain, budget, tool, or provider data.

**Existing payload boundary** (lines 33-51):

```typescript
export interface AnalysisRunPayloadInput {
  readonly templateVersionId: number;
  readonly subjectType: AnalysisSubjectType;
  readonly subjectId: number;
  readonly practiceAreaId: number;
}
export function createAnalysisRunPayload(input: AnalysisRunPayloadInput) {
  return {
    templateVersionId: input.templateVersionId,
    subject: { type: input.subjectType, id: input.subjectId },
    practiceAreaId: input.practiceAreaId,
  };
}
```

Preserve `readJson`'s SyntaxError behavior (lines 115-121) and `getErrorCopy`'s unknown-error fallback (lines 101-108). Add deterministic parser tests for fixed omission compatibility, custom selection, multiple matches, and malformed response payloads.

#### `src/components/analysis/AnalysisLauncher.tsx` (modify)

**Analog:** `src/components/analysis/AnalysisLauncher.tsx:86-118, 154-207, 214-251`.

Retain the existing generation/AbortController race protection and polling handoff. The UI order must be Practice Area first, then an agent picker whose first option is the fixed v1.7 template and whose remaining options are matching active custom agents. Multiple custom matches remain explicit choices. Selecting the fixed option must preserve the current fixed payload behavior.

**Race-safe effects** (lines 86-118): reset state on subject/dialog changes; abort stale requests; only preview after a valid selected Practice Area; compare generation and abort state before committing response state. **Launch/poll seam** (lines 154-207): POST the client contract, refresh immediately, then poll by scalar application run ID. Do not put compatibility logic or live agent configuration in the browser.

### Resolver, checklist, contracts, and snapshots

#### `src/lib/analysis/subjects.ts` (modify/compose)

**Analog:** `resolveAnalysisSubject`, `resolveAnalysisTemplateVersion`, and `resolveActivePracticeArea` at lines 42-110.

Use the existing `Resolution<T> = { ok: true, value } | { ok: false, reason }` shape (lines 26-28), positive ID parsing (line 40), target discriminator rejection before DB lookup (lines 46-50), and allowlisted identity projection (lines 52-67). Add a custom selection resolver beside—not inside—the fixed resolver, returning a typed reason for missing, retired, stale/current-version, target, Practice Area, effort, capability, or output-policy incompatibility. Keep the fixed consumer shape free of custom fields, matching `subjects.test.ts:163-187`.

#### `src/lib/analysis/checklist.ts` (reference)

**Analog:** `deriveActiveChecklist` lines 10-55.

The launch resolver must call this at POST time, not trust client or preview checklist rows. It queries target-specific active Company or Persona signals, emits `status: 'active'`, copies only safe signal identity/display fields (Persona also copies `buyerRoleId`), and sorts deterministically by signal ID (lines 14-50). This is the Practice Area/signal compatibility and snapshot input seam.

#### `src/lib/analysis/customAgentContracts.ts` and `capabilityPresets.ts` (reference/reuse)

**Analog excerpts:** bounded schema limits and strict authored input at `customAgentContracts.ts:10-23, 85-113`; normalized output and reserved-channel checks at `:179-223`; capability server policy at `capabilityPresets.ts:21-46, 78-104`.

Reuse the Phase 37 normalized version contract. Capability IDs are opaque availability presets, not executable tools: `CAPABILITY_PRESETS` maps only `none` and `web-research` to server-owned runtime metadata, and `validateCapabilitySelection` rejects unknown, duplicate, incompatible, or invalid combinations. The compatibility resolver should validate again against the selected target/Practice Area and resolve runtime limits/tools on the server. Do not accept provider, credential, tool, data-source, budget, or model fields from the launch client.

#### `src/lib/analysis/contracts.ts`, `experienceContracts.ts` (modify)

**Analogs:** target/effort/model refs and snapshot schemas in `contracts.ts:148-212`; preview discriminants/invariants in `experienceContracts.ts:23-71`.

Use strict discriminated Zod unions for fixed/custom selection and preserve `subject`/target and checklist/Practice Area cross-field invariants. Extend snapshot types only as needed for immutable custom identity/version/configuration; keep behavior separate from bounded output schema and retain `writesAllowed: false`, bounded limits, and server policy fields. Do not lock the unresolved nesting choice in this map; tests should lock boundedness, immutability, reserved-field protection, and fixed/custom convergence.

#### `src/lib/analysis/snapshots.ts` (modify)

**Analog:** `buildPhase33AnalysisSnapshots` lines 73-110.

```typescript
const validatedInput = buildAnalysisSnapshotsInputSchema.parse(input);
const policy = phase33PolicySnapshotSchema.parse(policyDecision);
const snapshot = parseAnalysisSnapshot({
  schemaVersion: 1,
  template: validatedInput.template,
  subject: validatedInput.subject,
  checklist: validatedInput.checklist,
  execution: {
    schemaVersion: 1,
    effort: validatedInput.template.effort,
    resolvedModelChain: validatedInput.resolvedModelChain,
    futureBudget: STANDARD_EXECUTION_BUDGET,
    policy,
  },
  policy,
  templateVersionId: validatedInput.template.templateVersionId,
  subjectType: validatedInput.subject.type,
  subjectId: validatedInput.subject.id,
  practiceAreaId: validatedInput.checklist.practiceAreaId,
});
```

Keep strict parse, deep-copy/deep-freeze behavior, scalar identity fields, and the existing five JSONB snapshot columns. Add the smallest custom template snapshot fields that let replay reconstruct the selected immutable version and resolved inputs. Do not snapshot mutable custom-agent lookup only; copy the required validated values before insertion.

### Query, schema, ledger, and durable workflow

#### `src/lib/db/queries/customAgents.ts` (modify)

**Analog:** `listManagedCustomAgents` lines 80-133 and its SQL projection lines 105-130.

Retain the `kind = 'custom'`, lifecycle status, version kind, and `ORDER BY t.id ASC, v.version DESC` fences. The grouped read gives stable custom identity, target, Practice Area, status, latest immutable version, and history. Add a narrow launch/options query rather than making management reads client-authoritative. Prefer a Neon-safe single SQL query/CTE when resolving selected identity and current version; return a server projection with stable identity/version display data.

#### `src/lib/db/queries/analysisTemplates.ts` (read-only reference)

`listActiveAnalysisTemplates` is the fixed v1.7 allowlist boundary used by options/preview and must continue selecting only the two fixed templates. Do not widen fixed queries to custom rows. Custom option/resolution queries belong in `customAgents.ts` or a narrow compatibility query.

#### `src/lib/db/queries/analysisRuns.ts` (modify only if shape requires)

**Analog:** `createAnalysisRun` lines 172-247 and `transitionAnalysisRun` lines 250-347.

```typescript
const result = await db.execute(sql`
  WITH inserted_run AS (... INSERT INTO analysis_run (... snapshot columns ...)
    VALUES (... ${JSON.stringify(input.templateSnapshot)}::jsonb ...)
    RETURNING id),
  inserted_event AS (... SELECT inserted_run.id, ... FROM inserted_run RETURNING ...)
  SELECT ... FROM inserted_run JOIN inserted_event ...
`);
```

Preserve the one data-modifying CTE because Neon HTTP does not support interactive transaction callbacks. Preserve SQLSTATE `23505` → `active_run_exists` only, and the guarded expected-status transition/event pattern for replay safety. The existing partial unique index is `(subject_type, subject_id, template_id)` for queued/running/pending-review; do not broaden it to one run per subject without an explicit product/schema decision.

#### `src/workflows/analysisRun.ts` (read-only preferred)

**Analog:** `analysisRun` lines 28-76 and `executeGroundedAnalysis` lines 97-123.

The workflow input remains only `applicationRunId`; it reloads DB-authoritative snapshots, claims with guarded transition, invokes the existing adapter, persists the packet before completion, reconciles review, and observes authoritative state on races. Custom behavior must arrive through snapshotted fields/dependency inputs. Do not read mutable custom-agent rows, Workflow metadata, client data, or provider settings inside execution. If an output adapter is unavoidable, make the smallest step-local change and prove the fixed path unchanged.

#### `src/lib/analysis/execution.ts` (conditional modify)

**Analog:** `GroundedExecutionAdapter` lines 147-228.

Keep injected `runAgent`/`instantiateChain` dependencies (lines 86-89, 147-152), policy short-circuit (lines 154-170), snapshotted model chain and bounded limits (lines 172-191), strict grounded output parse (lines 202-203), safe tool normalization, and coarse safe failure mapping (lines 219-227). A custom structured-output adapter can only add bounded fields around the fixed grounded envelope; it cannot redefine findings, citations, evidence, source identity, review, or candidate eligibility. Add collision and malformed-output tests; never add a second provider/tool boundary.

### Tests and fixtures

#### Deterministic contract/resolver tests (new plus existing anchors)

Use `src/lib/analysis/subjects.test.ts:25-215` for hoisted DB mocks, `beforeEach(vi.clearAllMocks())`, positive-ID cases, target mismatch cases, inactive/current-version cases, and allowlisted identity assertions. Add a pure matrix over Company/Persona × fixed/custom × matching/mismatching target/Practice Area × active/retired/current/stale. Assert `createAnalysisRun` is not called on every rejection.

Use `src/lib/analysis/customAgentContracts.test.ts:24-129` for table-driven forbidden client fields and bounded output tests. Add effort/capability/provider/tool/policy rejection and reserved grounding/evidence/review/candidate collision cases.

Use `src/lib/analysis/checklist.test.ts` as the active-signal fixture anchor; assert archived/draft signals never enter the launch snapshot and ordering is deterministic.

#### Snapshot tests

**Analog:** `src/lib/analysis/snapshots.test.ts:43-231`.

Retain the existing exact identity/policy assertions, provider/model pair preservation (lines 43-53), injection rejection (lines 173-212), and source/result mutation freeze test (lines 214-231). Add custom version/configuration, checklist, model settings, and policy mutation after build; assert the built snapshot remains unchanged. Avoid asserting an unresolved custom output nesting shape.

#### Launcher tests

**Analogs:** `src/components/analysis/AnalysisLauncher.test.ts:5-20` and `.test.tsx:15-43`.

Keep the test that preview-only fields do not enter the durable request. Extend it to fixed omission compatibility, custom discriminant payloads, Practice Area-first UI/options, fixed-first default, and explicit multiple-custom selection. Keep the static render test's no-template-picker regression intent, adapting only the expected custom picker text/shape.

#### Execution and run-ledger tests

Use `src/lib/analysis/execution.test.ts:67-260` for injected executor/modelFactory fixtures, deferred-policy fail-closed behavior, snapshotted model-chain assertions, bounded call limits, trace seam, malformed output, timeout, missing key, and unsafe-tool safe reasons. Use `src/lib/db/queries/analysisRuns.test.ts:6-36` for hoisted DB mocks, SQL flattening, CTE assertions, duplicate conflict mapping, and guarded transition/replay cases. Add fixed/custom identity matrix tests without changing the CTE semantics.

DB/Workflow fixtures are conditional on `TEST_DATABASE_URL`; absent credentials are **blocked/not-run**, never pass. Workflow integration should use the existing scalar-ID workflow and deterministic executor dependency seam, covering custom claim/reload/replay/failure and packet-before-completion.

## Shared Patterns

### Authentication and actor ownership

**Source:** `src/lib/auth/requireStaffAccess.ts:4-15`, used by options/preview/launch routes.
**Apply to:** every Phase 38 route and any server action/query entrypoint.
Use `const { userId } = await requireStaffAccess()` and derive actor identity server-side. Never accept actor/user ID in the selection payload.

### Fixed-template allowlisting

**Sources:** `src/app/api/analysis-options/route.ts:23-38`, `src/app/api/analysis-preview/route.ts:34-52`, `src/lib/analysis/subjects.test.ts:163-187`.
**Apply to:** options, preview, launch, and regression tests.
Keep fixed v1.7 templates separate from custom rows; fixed omission means the existing `templateVersionId` request path and downstream surfaces remain unchanged.

### Practice Area-first resolution

**Sources:** `AnalysisLauncher.tsx:105-118, 239-248`, `checklist.ts:10-50`, `subjects.ts:89-110`.
**Apply to:** client picker, options response, preview, launch resolver.
Resolve/choose active Practice Area first, then return fixed + matching active custom agents. Filter by both target type and Practice Area; multiple matches require explicit staff choice.

### Server-owned execution policy

**Sources:** `customAgentContracts.ts:85-113`, `capabilityPresets.ts:21-46,78-104`, `execution.ts:154-191`, `contracts.ts:116-146`.
**Apply to:** compatibility resolver, snapshots, executor adapter.
Resolve effort, model chain, capabilities, tools, provider access, budget, and `writesAllowed: false` from server policy. Authored capability IDs are allowlisted metadata only.

### Resolve twice, snapshot once

**Sources:** preview route `:58-80`; launch route `:51-88`; snapshots `:73-110`.
Preview may become stale. POST must reload current active version/lifecycle, target, Practice Area, checklist, model chain, capability/output policy, and execution policy, then construct one immutable snapshot before the run CTE.

### Durable convergence and downstream boundaries

**Sources:** launch route `:90-119`; workflow `:28-76,97-123`; run ledger `analysisRuns.ts:172-347`.
Both fixed and custom selections converge at `createAnalysisRun` → `start(analysisRun, [id])` → `GroundedExecutionAdapter` → packet/review/candidate read path. No parallel executor, direct Signal/Offering write, or custom review/candidate path.

### No migration unless JSONB is insufficient

**Schema analog:** `src/lib/db/schema.ts:553-655`; migration analog `drizzle/0007_custom_agent_definition.sql:1-35`.
Existing `analysis_template.kind`, `practice_area_id`, immutable version fields, `templateVersionId`, and five run JSONB snapshots are intended to carry custom identity/configuration. First prefer contract-only snapshot extension. Add schema/migration/meta files only for a new scalar audit column, JSONB column, separate FK, or explicit uniqueness rule; then follow journaled Drizzle validation and run `npm run db:check && npm run db:validate`.

## Dependency Waves

| Wave | Work | Likely files |
|---|---|---|
| 0 | Decide discriminated selection, authoritative immutable version semantics, snapshot/output adapter shape, and whether existing JSONB is sufficient; add contract fixtures first. | `contracts.ts`, `experienceContracts.ts`, `snapshots.ts`, new compatibility contracts/tests, conditional schema/migration |
| 1 | Implement server compatibility resolver, fixed/custom option projection, target/Practice Area/checklist/version/capability/policy gates; preserve fixed query allowlist. | `compatibility.ts`, `subjects.ts`, `customAgents.ts`, `analysisTemplates.ts` (reference), `checklist.ts`, `capabilityPresets.ts`, route tests |
| 2 | Wire Practice Area-first options, preview, launcher state, discriminated payload/parser, fixed default and explicit custom selection. | options route, preview route, `analysisLauncherClient.ts`, `AnalysisLauncher.tsx`, launcher tests |
| 3 | Extend snapshot/run input and only the narrowest executor adapter if needed; preserve CTE, scalar workflow, packet-before-completion, review/candidate downstream semantics. | `snapshots.ts`, `analysisRuns.ts`, `execution.ts`, `groundedContracts.ts`, `analysisRun.ts` |
| 4 | Run deterministic full gate; run DB/Workflow and migration checks only with prerequisites; hand off Phase 39 browser/adversarial/review/no-live-write proof. | compatibility/snapshot/execution/run tests, workflow fixtures, migration metadata if changed |

## No New Analog Needed

| Potential seam | Why no separate implementation |
|---|---|
| Custom executor/queue/worker | Existing `analysisRun` Workflow and `GroundedExecutionAdapter` are the durable path. |
| Custom review/candidate tables/routes | Phase 34 whole-run review and confirmed-only SQL projection remain downstream boundaries. |
| Exa/provider/tool integration | `modelFactory`, capability presets, and Firecrawl contract are server-owned and locked. |
| `/reviews/agents` | `/agents` remains canonical; management is Phase 37/39 scope. |

## Metadata

**Analog search scope:** `src/app/api`, `src/components/analysis`, `src/lib/analysis`, `src/lib/db/queries`, `src/workflows`, `src/lib/db/schema.ts`, `drizzle`, and deterministic tests.
**Prerequisite evidence:** `TEST_DATABASE_URL` is unavailable in the current shell; Neon/Workflow proof remains blocked, not passed. Live provider and Clerk browser evidence remain outside this phase or prerequisite-gated.
**Phase 39 handoff:** adversarial prompt/evidence/tool checks, no-live-write proof, review idempotency, confirmed-only aggregation, canonical `/agents`, and authenticated Company/Persona E2E are not reclassified as Phase 38 implementation proof.
