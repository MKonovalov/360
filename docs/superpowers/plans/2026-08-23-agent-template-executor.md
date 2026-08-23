# Persisted Agent Template Executor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist an `internal | arc-agentnet` executor on every immutable analysis template version, expose it in `/agents`, and route each launch from the server-resolved version without changing existing internal or Persona behavior.

**Architecture:** Treat the executor as authored version content on `analysis_template_version`. The template management action, query layer, options response, snapshots, and launch resolver all carry the same persisted value. Internal launches continue through `/api/analysis-runs`; Company Arc-agentnet launches reuse the existing submit, local-run, status, callback, quota, idempotency, and result-projection boundaries. The browser may display the resolved value and send only an optional consistency hint. It cannot select or authorize a different executor.

**Tech Stack:** Next.js App Router, React, TypeScript strict mode, Zod, Clerk `requireStaffAccess()`, Neon Postgres, Drizzle ORM and SQL migrations, Vitest, React Testing Library, and the repository's configured Playwright E2E runner.

## Global Constraints

- The canonical persisted type is exactly `AnalysisExecutor = 'internal' | 'arc-agentnet'`.
- Store the executor on `analysis_template_version.executor`, never on the parent template and never as user preference or mutable global UI state.
- The column is non-null, constrained to the two values, defaulted to `internal`, and backfilled to `internal` for every existing row.
- Existing template IDs, version numbers, content, efforts, budgets, status, authors, timestamps, and analysis-run meaning must remain unchanged.
- Saving a changed executor appends an immutable template version. Historical versions keep their original executor and are read-only.
- Existing internal Company and Persona launches continue through `/api/analysis-runs`, `launchAnalysisRun`, and `analysisRun` with unchanged statuses, snapshots, debug preference behavior, cancellation, review, and polling semantics.
- Arc-agentnet is Company-only. Persona plus Arc-agentnet is rejected by the server with HTTP 409 `executor_target_mismatch` and makes no partner call.
- Arc-agentnet failures never fall back to internal execution. Disabled flags, quota failures, partner failures, persistence failures, and status failures remain explicit safe Arc-agentnet failures.
- `COMPANY_ANALYSIS_ARC_AGENTNET_ENABLED` defaults to disabled for unset, `false`, `0`, and `off`; `true`, `1`, and `on` enable it; any other value is invalid configuration treated as disabled with a deployment diagnostic.
- The flag is enforced in `/agents` management, analysis options and launch resolution, and the Arc-agentnet submit route. It never rewrites persisted values.
- The browser sends opaque subject, Practice Area, category, template/custom identity, idempotency, and optional executor consistency data only. It never sends instructions, partner IDs, callback URLs, credentials, headers, provider configuration, or raw partner payloads.
- Reuse the existing Arc-agentnet protocol and lifecycle infrastructure. Do not add a second partner protocol or duplicate polling, callback, quota, idempotency, or projection infrastructure.
- Every state-bearing response uses `Cache-Control: no-store`. Existing authorization and safe error-envelope conventions remain authoritative.
- Every implementation task follows red, run-fail, minimal green implementation, run-pass, and focused commit.
- Do not change package files, unrelated application behavior, or the existing Arc-agentnet service.

---

## File and Responsibility Map

### Shared contracts and configuration

- `src/lib/analysis/templateContracts.ts`: define `AnalysisExecutor`, strict content input, version-read fields, and executor availability result reasons.
- `src/lib/analysis/executionTarget.ts`: reuse the executor vocabulary at launch boundaries. If this existing module already owns the same union, export the canonical type there and import it into template contracts rather than defining a second union.
- `src/lib/env.ts`: parse `COMPANY_ANALYSIS_ARC_AGENTNET_ENABLED` once through the existing server environment boundary.

### Persistence and version management

- `src/lib/db/schema.ts`: add the non-null constrained/defaulted `analysisTemplateVersion.executor` column using the existing Drizzle enum or check-constraint style.
- `drizzle/0016_agent_template_executor.sql`: add, backfill, validate, and retain the executor default after the existing `0015_company_arc_agentnet_execution.sql` migration.
- `src/lib/db/queries/analysisTemplates.ts`: select executor in latest/history/options/version reads, insert it into new versions, and repeat target/flag validation at the write boundary.
- `src/app/actions/analysisTemplates.ts`: retain `requireStaffAccess()`, parse the strict content action, validate target compatibility and availability, and return stable safe reasons.
- `src/scripts/seedAnalysisTemplates.ts`: declare `executor: 'internal'` for both fixed seeds and treat a stored non-internal value as intentional configuration, not seed drift.

### `/agents` UI

- `src/components/agents/agent-template-card.tsx`: initialize the control from `template.latest.executor`, render it immediately to the right of Default effort, preserve unsaved values on failure, and show executor in history.
- `src/app/(dashboard)/agents/page.tsx`: pass server-projected availability metadata without exposing authorization configuration.
- Existing paired component/action tests beside these files: cover order, Company/Persona options, save, failure, latest version, and history.

### Options and launch resolution

- `src/app/api/analysis-options/route.ts`: include persisted executor in each fixed and custom selectable version and project Company availability without converting persisted Arc-agentnet to internal.
- `src/components/analysis/analysisLauncherClient.ts`: parse the read-only executor response and optional launch consistency hint; never turn the options response into authority.
- `src/lib/analysis/subjects.ts` and `src/lib/analysis/compatibility.ts`: resolve selected current version/custom version and executor, then enforce target compatibility and inactive/stale checks.
- `src/lib/analysis/launchAnalysisRun.ts`: preserve the existing internal path and snapshot behavior. If executor is internal, route exactly as before. If executor is Arc-agentnet, delegate to the existing Arc-agentnet composition instead of dispatching the internal workflow.
- `src/app/api/analysis-runs/route.ts`: preserve the existing internal route and add only the minimum server-resolved executor dispatch seam if the current shared handler requires it.

### Arc-agentnet reuse and lifecycle

- Existing Arc-agentnet submit route and client, including `createArcAgentnetClient().submit()` and `POST /partner/jobs`: accept only server-resolved Company data and use the persisted executor to enter the route.
- Existing status route, callback route, `src/lib/db/queries/arcAgentnetRuns.ts`, `src/lib/db/queries/partnerCallbacks.ts`, quota checks, idempotency checks, and result projection: extend only at the existing boundaries so local run snapshots record the executor.
- `src/lib/analysis/arcAgentnetContracts.ts`: keep Company-only request and bounded payload contracts; add executor only where it is a local persisted/response property, not as partner transport configuration.

### Test and rollout evidence

- Existing template contract, action, query, seed, options, launcher, internal route, and Arc-agentnet route/callback tests: extend directly beside each changed boundary.
- Existing Playwright Company/Persona analysis spec under the configured E2E directory: add the approved browser scenarios there. Do not invent a parallel lifecycle harness.
- No source file, test file, migration, package file, or environment file is created by writing this plan.

---

## Shared Interfaces

Define these names before any consumer task. Later tasks must import them rather than create aliases.

```ts
export type AnalysisExecutor = 'internal' | 'arc-agentnet';

export const analysisExecutors = ['internal', 'arc-agentnet'] as const;

export type ExecutorAvailability = Readonly<{
  readonly companyArcAgentnetEnabled: boolean;
}>;

export type ExecutorResolution = Readonly<{
  readonly executor: AnalysisExecutor;
  readonly targetType: 'company' | 'persona';
  readonly companyArcAgentnetEnabled: boolean;
}>;

export type ExecutorValidationReason =
  | 'executor_target_mismatch'
  | 'executor_unavailable'
  | 'invalid_executor_configuration'
  | 'executor_conflict';
```

Extend the existing template contracts with these exact fields:

```ts
export type TemplateVersionRead = {
  readonly templateVersionId: number;
  readonly version: number;
  readonly instruction: string;
  readonly supportedEfforts: readonly AnalysisEffort[];
  readonly defaultEffort: AnalysisEffort;
  readonly executor: AnalysisExecutor;
  readonly futureBudget: typeof STANDARD_EXECUTION_BUDGET;
  readonly createdBy: string;
  readonly createdAt: string;
};

type ContentTemplateManagementInput = {
  readonly operation: 'content';
  readonly templateKey: FixedAnalysisTemplateKey;
  readonly expectedVersion: number;
  readonly instruction: string;
  readonly defaultEffort: AnalysisEffort;
  readonly executor: AnalysisExecutor;
};
```

The existing discriminated `TemplateManagementInput` remains the public inferred Zod type. The lifecycle variant remains unchanged. The existing `AgentOption` shape gains `readonly executor: AnalysisExecutor` for fixed and custom selectable versions. Any existing `ExecutionTarget` alias must be made a type alias of `AnalysisExecutor`, not a second vocabulary.

The existing Arc-agentnet status response and local run snapshot gain `executor: 'arc-agentnet'`; internal snapshots gain `executor: 'internal'`. The launch resolver returns a discriminated result:

```ts
type ResolvedExecutorLaunch =
  | { readonly ok: true; readonly executor: 'internal'; readonly value: ResolvedAnalysisLaunch } 
  | { readonly ok: true; readonly executor: 'arc-agentnet'; readonly value: ResolvedCompanyArcAgentnetLaunch }
  | { readonly ok: false; readonly reason: ExecutorValidationReason | ExistingResolutionReason };
```

The browser may send `executor?: AnalysisExecutor` only as a consistency hint. The server compares it with the persisted version and returns `executor_conflict` on disagreement. Omission is accepted. The server never uses the hint to select a route.

---

## Dependency Order

1. Canonical executor contract and feature-flag parser.
2. Schema migration, backfill, schema type, seed declaration, and query reads/writes.
3. Management action validation and immutable save semantics.
4. `/agents` selector, availability metadata, and history rendering.
5. Options response and launcher read-only contract.
6. Server launch resolution and internal regression seam.
7. Arc-agentnet dispatch composition and local snapshot/lifecycle reuse.
8. Focused route, component, integration, regression, and E2E tests.
9. Full verification, rollout, monitoring, and rollback evidence.

---

## Implementation Tasks

### Task 1: Lock the canonical executor contract and feature flag

**Files:**
- Modify: `src/lib/analysis/templateContracts.ts`
- Modify: `src/lib/analysis/executionTarget.ts` if the existing launch union is defined there
- Modify: `src/lib/env.ts`
- Test: `src/lib/analysis/templateContracts.test.ts`
- Test: `src/lib/analysis/executionTarget.test.ts` if that file exists, otherwise create it beside the contract
- Test: `src/lib/env.test.ts` or the repository's existing environment contract test

**Interfaces:**
- Produces the single `AnalysisExecutor` union, `analysisExecutors`, strict content input including `executor`, `ExecutorAvailability`, `ExecutorResolution`, and `ExecutorValidationReason`.
- Produces `isCompanyArcAgentnetEnabled(): boolean` using the exact flag values in Global Constraints.
- Consumes existing `AnalysisEffort`, `AnalysisTargetType`, `AgentSelection`, Zod, and environment parsing conventions.

- [x] **Step 1: Write failing contract tests.** Assert `internal` and `arc-agentnet` parse, every other string fails, unknown content keys fail, missing executor fails, Persona plus `arc-agentnet` is rejected by the compatibility helper, Company plus either value is accepted when availability allows it, and the feature flag maps unset, `false`, `0`, `off`, `true`, `1`, and `on` exactly. Assert mixed-case or arbitrary values are disabled rather than enabled.
- [x] **Step 2: Run the focused tests and confirm failure.** Run `npx vitest run src/lib/analysis/templateContracts.test.ts src/lib/analysis/executionTarget.test.ts src/lib/env.test.ts`. Expected failure: missing executor field/parser, missing shared type or flag reader, and missing compatibility result.
- [x] **Step 3: Implement the minimum contract and flag reader.** Use `z.enum(analysisExecutors)` in the strict content schema. Keep the lifecycle schema unchanged. Export one canonical union and make any existing execution-target type import it. Parse the flag at the server environment boundary and fail closed on invalid values.
- [x] **Step 4: Run the focused tests and confirm pass.** Run the same Vitest command. Expected: PASS with no aliases such as `360`, `partner`, `external`, `arc`, or `agentnet` accepted as persisted values.
- [x] **Step 5: Commit the contract seam.** Run `git add src/lib/analysis/templateContracts.ts src/lib/analysis/executionTarget.ts src/lib/env.ts src/lib/analysis/templateContracts.test.ts src/lib/analysis/executionTarget.test.ts src/lib/env.test.ts && git commit -m "feat: define persisted template executor contract"`.

### Task 2: Add schema, migration, backfill, seed, and database assertions

**Files:**
- Modify: `src/lib/db/schema.ts`
- Create: `drizzle/0016_agent_template_executor.sql`
- Modify: `src/scripts/seedAnalysisTemplates.ts`
- Test: `src/lib/db/analysisSchema.integration.test.ts`
- Test: `src/lib/db/queries/analysisTemplates.integration.test.ts`
- Test: `src/scripts/seedAnalysisTemplates.integration.test.ts`

**Interfaces:**
- Produces `analysisTemplateVersion.executor` as a typed non-null `AnalysisExecutor` with database default `internal`.
- Produces migration `0016_agent_template_executor.sql`, following the existing journal after `0015_company_arc_agentnet_execution.sql`.
- Consumes the Task 1 union and existing template/version schema.

- [x] **Step 1: Write failing database tests.** Add assertions that the column exists, is non-null, accepts only `internal` and `arc-agentnet`, defaults new rows to `internal`, and backfills every pre-migration version to `internal`. Assert IDs, versions, content, effort, budget, author, timestamp, and existing run snapshot data are unchanged. Add seed tests proving both fixed seeds explicitly declare `internal`, and a stored Arc-agentnet executor is treated as deliberate configuration rather than overwritten.
- [x] **Step 2: Run the database tests and confirm failure.** Run `npm run db:check && npm run db:validate && npx vitest run src/lib/db/analysisSchema.integration.test.ts src/lib/db/queries/analysisTemplates.integration.test.ts src/scripts/seedAnalysisTemplates.integration.test.ts`. Expected failure: missing schema column, migration, seed field, or assertions against the absent constraint.
- [x] **Step 3: Implement the migration and schema declaration.** Add the constrained column with default `internal`, update every existing row, assert no null or unsupported value remains, and retain the default. Do not update analysis-run rows or reconstruct their snapshots. Add `executor: 'internal'` to both seed records and the seed conflict field union. Seed comparison must not overwrite a stored non-internal value.
- [x] **Step 4: Run migration and seed tests and confirm pass.** Run the same command. Expected: PASS with an empty legacy table, populated legacy rows, a deliberately Arc-agentnet-configured version, and repeated seed execution.
- [x] **Step 5: Commit the persistence foundation.** Run `git add src/lib/db/schema.ts drizzle/0016_agent_template_executor.sql src/scripts/seedAnalysisTemplates.ts src/lib/db/analysisSchema.integration.test.ts src/lib/db/queries/analysisTemplates.integration.test.ts src/scripts/seedAnalysisTemplates.integration.test.ts && git commit -m "feat: persist template executor with internal backfill"`.

### Task 3: Extend template query reads and immutable version writes

**Files:**
- Modify: `src/lib/db/queries/analysisTemplates.ts`
- Test: `src/lib/db/queries/analysisTemplates.test.ts`
- Test: `src/lib/db/queries/analysisTemplates.integration.test.ts`

**Interfaces:**
- Produces `executor` in `listActiveAnalysisTemplates`, `getAnalysisTemplateVersion`, `listManagedAnalysisTemplates`, `TemplateVersionRead.latest`, `TemplateVersionRead.history`, and new-version insert projections.
- `saveAnalysisTemplateVersion(input, actorId)` accepts the Task 1 content input and returns existing result kinds plus `executor_unavailable` or `invalid_input` through the existing result envelope.
- Consumes the Task 2 database column and Task 1 availability/compatibility helpers.

- [x] **Step 1: Write failing query tests.** Assert latest and every history row returns its stored executor, active option rows include executor, a Company executor-only change appends a new version, prior history remains unchanged, unchanged instruction/effort/executor is a no-op, and a concurrent expected-version conflict never loses the executor change. Assert Persona plus Arc-agentnet and Company plus disabled Arc-agentnet produce no insert.
- [x] **Step 2: Run the focused query tests and confirm failure.** Run `npx vitest run src/lib/db/queries/analysisTemplates.test.ts src/lib/db/queries/analysisTemplates.integration.test.ts`. Expected failure: query projections and insert SQL omit executor, and the new-version comparison cannot distinguish executor changes.
- [x] **Step 3: Implement read and write projections.** Add executor to every SELECT and `ManagedTemplateQueryRow`, map it in `toVersionRead`, insert it beside instruction, effort, and budget, and include it in the immutable change predicate and no-op predicate. Repeat target and flag checks at the write boundary after resolving the fixed template target. Preserve the existing expected-version conflict behavior.
- [x] **Step 4: Run the focused query tests and confirm pass.** Expected: PASS for executor-only versioning, history retention, no-op, conflict, target mismatch, disabled availability, and unchanged custom-agent query behavior.
- [x] **Step 5: Commit the query layer.** Run `git add src/lib/db/queries/analysisTemplates.ts src/lib/db/queries/analysisTemplates.test.ts src/lib/db/queries/analysisTemplates.integration.test.ts && git commit -m "feat: read and version template executors"`.

### Task 4: Enforce action contracts and server availability errors

**Files:**
- Modify: `src/app/actions/analysisTemplates.ts`
- Test: `src/app/actions/analysisTemplates.test.ts`

**Interfaces:**
- `saveAnalysisTemplateAction(input: unknown)` continues to require staff access before parsing and returns `invalid_input`, `executor_target_mismatch`, `executor_unavailable`, existing `conflict`, `not_found`, `action_failed`, or success results using the existing safe envelope.
- Consumes `templateManagementInputSchema`, `listManagedAnalysisTemplates`, `isCompanyArcAgentnetEnabled`, and `saveAnalysisTemplateVersion`.

- [x] **Step 1: Write failing action tests.** Assert authorization runs before parsing or database access. Assert malformed and unknown fields return `invalid_input`; Persona plus Arc-agentnet returns `invalid_input` with a stable `executor` issue and no write; Company plus disabled Arc-agentnet returns `executor_unavailable` and no write; Company plus enabled Arc-agentnet writes; internal works for both targets; and executor-only changes return the new template read.
- [x] **Step 2: Run the action tests and confirm failure.** Run `npx vitest run src/app/actions/analysisTemplates.test.ts`. Expected failure: the existing action accepts no executor and does not enforce target or flag policy.
- [x] **Step 3: Implement action validation.** Preserve `requireStaffAccess()` as the first meaningful operation. Parse the strict content contract, resolve the fixed template target, apply an exhaustive compatibility decision, return the stable safe reason without writing on rejection, and delegate valid content to the query layer. Preserve existing lifecycle behavior.
- [x] **Step 4: Run the action tests and confirm pass.** Expected: PASS with staff authorization, strict parsing, Persona rejection, disabled flag rejection, enabled Company save, internal save, conflict, no-op, and unchanged lifecycle assertions.
- [x] **Step 5: Commit the action boundary.** Run `git add src/app/actions/analysisTemplates.ts src/app/actions/analysisTemplates.test.ts && git commit -m "feat: validate executor template saves"`.

### Task 5: Add the `/agents` executor control and history display

**Files:**
- Modify: `src/components/agents/agent-template-card.tsx`
- Modify: `src/app/(dashboard)/agents/page.tsx`
- Test: `src/components/agents/agent-template-card.test.tsx`
- Test: `e2e/36-agent-management.spec.ts`

**Interfaces:**
- `AgentTemplateCard` consumes `ManagedAnalysisTemplateRead` with `latest.executor`, `history[].executor`, and server-projected `ExecutorAvailability`.
- It submits the existing content fields plus `executor` to `saveAnalysisTemplateAction`.
- It produces a labeled select whose DOM order is `Current instruction`, `Default effort`, `Executor`, with exactly `Internal`/`internal` and `Arc-agentnet`/`arc-agentnet` for Company when enabled, and only `Internal` for Persona.

- [x] **Step 1: Write failing component tests.** Assert the Executor control is immediately after Default effort in DOM order at desktop markup and remains in that order when wrapped. Assert Company enabled exposes both exact labels and values, Persona exposes only Internal plus the Company-only note, latest persisted executor initializes the control, history displays the executor for every version, and a direct stale Persona Arc-agentnet value renders an invalid configuration state that cannot be saved.
- [x] **Step 2: Run the component tests and confirm failure.** Run `npx vitest run src/components/agents/agent-template-card.test.tsx`. Expected failure: no executor control, value, history text, or availability behavior exists.
- [x] **Step 3: Implement the minimum UI state and placement.** Initialize from `template.latest.executor`, mark dirty when it changes, place the labeled select immediately after Default effort, filter Arc-agentnet from Persona actionable options, and pass the exact executor in the existing save action payload. Preserve existing version and lifecycle controls.
- [x] **Step 4: Implement safe save and history behavior.** On successful version save, replace the card data with the returned latest/history and show the existing confirmation. On `executor_unavailable`, `invalid_input`, conflict, or action failure, retain the unsaved executor selection and show safe actionable copy. Render each historical executor read-only. Never infer availability from browser state.
- [x] **Step 5: Run the focused component tests and confirm pass.** Expected: PASS for control order, initialization, Company/Persona choices, successful executor-only save, failed-save preservation, history, and stale invalid state.
- [x] **Step 6: Commit the `/agents` UI.** Run `git add src/components/agents/agent-template-card.tsx 'src/app/(dashboard)/agents/page.tsx' src/components/agents/agent-template-card.test.tsx e2e/36-agent-management.spec.ts && git commit -m "feat: add persisted executor control to agents"`.

### Task 6: Extend analysis options and client contracts without granting authority

**Files:**
- Modify: `src/app/api/analysis-options/route.ts`
- Modify: `src/components/analysis/analysisLauncherClient.ts`
- Test: `src/app/api/analysis-options/route.test.ts`
- Test: `src/components/analysis/analysisLauncherClient.test.ts`

**Interfaces:**
- Each fixed and custom `AgentOption` includes `executor: AnalysisExecutor` from the resolved version.
- `followUpOptionsSchema` accepts optional `executionTargets` only for Company; Persona omits the key. A disabled flag does not rewrite persisted `arc-agentnet` to `internal`.
- `fetchAnalysisOptions` returns the persisted executor and availability metadata while continuing to return the existing practice areas, agents, and signal categories.

- [x] **Step 1: Write failing route and client tests.** With the flag disabled, assert Company responses expose no actionable Arc-agentnet availability while a persisted executor remains `arc-agentnet` in the server-resolved option or explicit unavailable metadata. Assert enabled Company options expose both allowed values, Persona responses omit execution targets and expose only Internal. Assert malformed executor values and unknown response keys fail closed. Assert the browser cannot turn options metadata into a route override.
- [x] **Step 2: Run focused tests and confirm failure.** Run `npx vitest run src/app/api/analysis-options/route.test.ts src/components/analysis/analysisLauncherClient.test.ts`. Expected failure: response projections omit executor and the client schema cannot parse the new field.
- [x] **Step 3: Implement server projection and strict client parsing.** Add executor from the active version query, add Company-only availability metadata, preserve persisted Arc-agentnet values, and keep all partner configuration server-only. Update `agentOptionSchema`, `followUpOptionsSchema`, and the returned `AnalysisOptionsResult` without changing initial-step behavior.
- [x] **Step 4: Run focused tests and confirm pass.** Expected: PASS for disabled/enabled Company, Persona omission, persisted stale value, strict parsing, and unchanged existing option selection.
- [x] **Step 5: Commit the options contract.** Run `git add src/app/api/analysis-options/route.ts src/components/analysis/analysisLauncherClient.ts src/app/api/analysis-options/route.test.ts src/components/analysis/analysisLauncherClient.test.ts && git commit -m "feat: project persisted executor in analysis options"`.

### Task 7: Resolve the persisted executor and preserve internal launch behavior

**Files:**
- Modify: `src/lib/analysis/subjects.ts`
- Modify: `src/lib/analysis/compatibility.ts`
- Modify: `src/lib/analysis/launchAnalysisRun.ts`
- Modify: `src/app/api/analysis-runs/route.ts` only if required to pass the trusted resolved executor
- Test: existing `src/lib/analysis/subjects.test.ts` and compatibility test file
- Test: `src/lib/analysis/launchAnalysisRun.test.ts`
- Test: `src/app/api/analysis-runs/route.test.ts`

**Interfaces:**
- Resolution reads `analysis_template_version.executor` from the selected current version and returns `ResolvedExecutorLaunch` from the shared interface block.
- Internal `executor === 'internal'` continues through the existing `resolveAnalysisLaunch`, `buildPhase33AnalysisSnapshots`, `createAnalysisRun`, and `start(analysisRun, [applicationRunId])` path.
- Consumes an optional browser `executor` hint only for equality checking; persisted database value remains authoritative.

- [x] **Step 1: Write failing resolution and regression tests.** Assert current fixed and custom versions resolve their persisted executor, stale/inactive versions reject, a conflicting hint returns `executor_conflict` with no run, unsupported Persona Arc-agentnet returns HTTP 409 `executor_target_mismatch` with no run, invalid persisted null/unknown data returns safe HTTP 500 `invalid_executor_configuration`, and internal Company/Persona requests continue to create the same snapshots and dispatch the same workflow.
- [x] **Step 2: Run focused tests and confirm failure.** Run `npx vitest run src/lib/analysis/subjects.test.ts src/lib/analysis/compatibility.test.ts src/lib/analysis/launchAnalysisRun.test.ts src/app/api/analysis-runs/route.test.ts`. Expected failure: resolution does not select or validate executor and internal snapshots do not record it.
- [x] **Step 3: Implement server-authoritative resolution.** Parse the optional hint strictly, resolve the current version, compare hint to stored executor when present, validate target compatibility, reject invalid persisted data without guessing, and thread the resolved executor into immutable snapshots. Keep the internal branch unchanged after the executor decision. Do not read current UI state or feature availability to turn an Arc-agentnet row into internal.
- [x] **Step 4: Run focused tests and confirm pass.** Expected: PASS for hint conflict, Company and Persona compatibility, invalid data, stale versions, internal dispatch, unchanged debug preference, unchanged cancellation/review/status behavior, and no Arc-agentnet call on internal launches.
- [x] **Step 5: Commit the server resolution seam.** Run `git add src/lib/analysis/subjects.ts src/lib/analysis/compatibility.ts src/lib/analysis/launchAnalysisRun.ts src/app/api/analysis-runs/route.ts src/lib/analysis/subjects.test.ts src/lib/analysis/compatibility.test.ts src/lib/analysis/launchAnalysisRun.test.ts src/app/api/analysis-runs/route.test.ts && git commit -m "feat: route launches from persisted executor"`.

### Task 8: Route Company Arc-agentnet launches through existing infrastructure

**Files:**
- Create: `src/app/api/analysis-runs/arc-agentnet/route.ts`
- Create: `src/app/api/analysis-runs/arc-agentnet/route.test.ts`
- Modify: `src/lib/analysis/arcAgentnetContracts.ts`
- Modify: `src/lib/db/queries/arcAgentnetRuns.ts`
- Modify: `src/lib/db/queries/arcAgentnetRunTypes.ts`
- Modify: `src/lib/db/queries/arcAgentnetRunTransitions.ts`
- Test: `src/app/api/analysis-runs/arc-agentnet/route.test.ts`
- Test: `src/lib/db/queries/arcAgentnetRuns.test.ts` and integration test

**Interfaces:**
- Arc-agentnet entry receives only the server-resolved `ResolvedCompanyArcAgentnetLaunch` and invokes existing `createArcAgentnetClient().submit()` exactly once for a valid request.
- Local run snapshots persist `executionTarget: 'arc-agentnet'`, executor, template ID/version, target type, initiating user, Company identity, resolved template/checklist snapshots, safe status, and partner mapping fields through existing query boundaries.
- Consumes existing `POST /partner/jobs`, scoped idempotency, active-job checks, quotas, bounded payload builder, and safe error projection. It does not create a new protocol.

- [x] **Step 1: Write failing route and persistence tests.** Cover disabled flag, Persona subject, Company plus Persona template, stale/inactive version, mismatched custom target, caller-supplied partner fields, missing configuration, quota rejection, active run, same-key replay, changed-payload conflict, submit failure, and local persistence failure. Assert no partner call before every preflight rejection, exactly one submit on valid Company Arc-agentnet, local executor snapshot persistence, and no internal fallback after any Arc-agentnet failure.
- [x] **Step 2: Run focused tests and confirm failure.** Run `npx vitest run src/app/api/analysis-runs/arc-agentnet/route.test.ts src/lib/db/queries/arcAgentnetRuns.test.ts` and `npm run test:integration:db -- src/lib/db/queries/arcAgentnetRuns.integration.test.ts`. Expected failure: the new route is absent and the launch composition does not consume the persisted executor or record it in the local run relation.
- [x] **Step 3: Implement the smallest composition change.** Authenticate, parse the strict local request, resolve Company and template data on the server, enforce feature flag and target policy, run existing quota/idempotency/active-job checks, build the existing bounded payload, create or replay the local relation, submit through the existing client, and persist returned IDs. Reject partner IDs, callback URLs, credentials, headers, and specifications from the browser. Keep the error mapping safe and route-specific.
- [x] **Step 4: Run focused tests and confirm pass.** Expected: PASS for one submit, replay/conflict, no partner calls on preflight failure, local executor snapshot, explicit Arc-agentnet failure, and no internal fallback.
- [x] **Step 5: Commit Arc-agentnet dispatch wiring.** Run `git add src/app/api/analysis-runs/arc-agentnet/route.ts src/app/api/analysis-runs/arc-agentnet/route.test.ts src/lib/analysis/arcAgentnetContracts.ts src/lib/db/queries/arcAgentnetRuns.ts src/lib/db/queries/arcAgentnetRunTypes.ts src/lib/db/queries/arcAgentnetRunTransitions.ts src/lib/db/queries/arcAgentnetRuns.test.ts src/lib/db/queries/arcAgentnetRuns.integration.test.ts && git commit -m "feat: dispatch persisted Company executor to Arc-agentnet"`.

### Task 9: Preserve Arc-agentnet status, polling, callback, quota, idempotency, and projection boundaries

**Files:**
- Create: `src/app/api/analysis-runs/arc-agentnet/[id]/route.ts`
- Create: `src/app/api/analysis-runs/arc-agentnet/[id]/route.test.ts`
- Modify: `src/lib/arc-agentnet/client.ts`
- Modify: `src/lib/arc-agentnet/client.test.ts`
- Modify: `src/lib/db/queries/partnerCallbacks.ts` only for executor-bearing local projection data if required
- Modify: `src/app/api/arc-agentnet/callbacks/analyze/route.ts` only for the same projection wiring
- Modify: `src/lib/db/queries/arcAgentnetRuns.test.ts`
- Modify: `src/lib/db/queries/arcAgentnetRuns.integration.test.ts`

**Interfaces:**
- Status accepts only a positive local 360 application run ID, authorizes the initiating staff user, and returns the existing safe Arc-agentnet projection with executor and immutable snapshot summary.
- Polling uses the existing local-ID route and partner client, never a browser-supplied partner job ID. Existing queued, running, cancelling, succeeded, failed, cancelled, 410 `job_expired`, freshness, and terminal guards remain unchanged.
- Callback verification, hosts, HMAC, replay/conflict, request matching, result-size limit, quota, idempotency, and result projection remain the existing boundaries.

- [x] **Step 1: Write failing lifecycle tests.** Assert local-ID authorization, status polling and terminal mapping, 410 behavior, stale unavailable behavior, no partner ID in browser response where existing policy forbids it, accepted callback projection, replay once, conflict rejection, HMAC/host/request checks, quota limits, idempotency reuse, and terminal callback/poll non-overwrite. Assert existing internal-only queries never include Arc-agentnet rows merely because a client field is supplied.
- [x] **Step 2: Run focused lifecycle tests and confirm failure.** Run `npx vitest run src/app/api/analysis-runs/arc-agentnet/[id]/route.test.ts src/lib/arc-agentnet/client.test.ts src/lib/arc-agentnet/callback.test.ts` and `npm run test:integration:db -- src/lib/db/queries/partnerCallbacks.integration.test.ts`. Expected failure: the new status route is absent, executor is absent from the local projection, or a new launch path bypasses an existing guard.
- [x] **Step 3: Reuse, do not duplicate, lifecycle infrastructure.** Thread executor through existing local snapshots and safe response types only. Keep one reconciliation path, one callback verifier, one quota decision path, one idempotency key/mapping rule, and one result projection. Do not add fallback calls to `/api/analysis-runs` after Arc-agentnet errors.
- [x] **Step 4: Run focused lifecycle tests and confirm pass.** Expected: PASS with unchanged callback and lifecycle assertions plus executor-bearing inspection data and no-store state responses.
- [x] **Step 5: Commit lifecycle compatibility.** Run `git add 'src/app/api/analysis-runs/arc-agentnet/[id]/route.ts' 'src/app/api/analysis-runs/arc-agentnet/[id]/route.test.ts' src/lib/arc-agentnet/client.ts src/lib/arc-agentnet/client.test.ts src/lib/db/queries/partnerCallbacks.ts src/app/api/arc-agentnet/callbacks/analyze/route.ts src/app/api/arc-agentnet/callbacks/analyze/route.test.ts src/lib/arc-agentnet/callback.test.ts src/lib/db/queries/partnerCallbacks.integration.test.ts && git commit -m "test: preserve Arc-agentnet lifecycle boundaries"`.

### Task 10: Add launcher polling and Company-only browser behavior

**Files:**
- Modify: `src/components/analysis/analysisLauncherClient.ts`
- Modify: `src/components/analysis/AnalysisLauncher.tsx`
- Test: `src/components/analysis/analysisLauncherClient.test.ts`
- Test: `src/components/analysis/AnalysisLauncher.test.tsx`

**Interfaces:**
- The launcher consumes options' read-only `executor`, submits the optional consistency hint, and chooses the route only after server resolution data is loaded.
- Internal selections preserve the existing endpoint, payload, debug preference, preview, status polling, and Persona behavior.
- Arc-agentnet selections use the existing local application run ID status route, poll through the existing polling abstraction, stop on completed/failed/cancelled, abort on unmount, and refresh Company data only after terminal state.

- [x] **Step 1: Write failing client/UI tests.** Assert Company options show persisted Internal or Arc-agentnet, Persona has no Arc-agentnet action, executor is separate from the template selector, an executor change invalidates preview and reloads it, the request contains only opaque identities plus optional executor hint, a partner response polls by local application run ID, terminal polling stops, unmount aborts, and no partner failure triggers an internal retry.
- [x] **Step 2: Run focused tests and confirm failure.** Run `npx vitest run src/components/analysis/analysisLauncherClient.test.ts src/components/analysis/AnalysisLauncher.test.tsx`. Expected failure: launcher lacks persisted executor state, Arc-agentnet branch, and local-ID lifecycle polling.
- [x] **Step 3: Implement the minimal browser branch.** Keep the existing template selector as the analysis-definition selector. Derive the executor from the selected option, send it only as a consistency hint, clear preview on executor change, and select the existing internal or Arc-agentnet route once per submit. Do not expose partner credentials or transport configuration.
- [x] **Step 4: Implement lifecycle polling using existing infrastructure.** Reuse the current polling adapter if it can represent the Arc-agentnet terminal states; otherwise add one narrow adapter without changing internal polling semantics. Poll by local run ID, use `AbortSignal`, stop on terminal state, and display safe errors only.
- [x] **Step 5: Run focused tests and confirm pass.** Expected: PASS for Company/Persona visibility, route choice, opaque payload, local-ID polling, lifecycle abort, refresh timing, and no fallback.
- [x] **Step 6: Commit launcher behavior.** Run `git add src/components/analysis/analysisLauncherClient.ts src/components/analysis/AnalysisLauncher.tsx src/components/analysis/analysisLauncherClient.test.ts src/components/analysis/AnalysisLauncher.test.tsx && git commit -m "feat: launch analyses from resolved executor"`.

### Task 11: Add regression, integration, security, and E2E coverage

**Files:**
- Modify: `src/app/actions/analysisTemplates.test.ts`
- Modify: `src/lib/db/queries/analysisTemplates.test.ts`
- Modify: `src/scripts/seedAnalysisTemplates.integration.test.ts`
- Modify: `src/app/api/analysis-options/route.test.ts`
- Modify: `src/app/api/analysis-runs/route.test.ts`
- Modify: `src/lib/analysis/launchAnalysisRun.test.ts`
- Modify: `src/components/analysis/AnalysisLauncher.test.tsx`
- Modify: `src/lib/arc-agentnet/client.test.ts`
- Modify: `src/lib/arc-agentnet/callback.test.ts`
- Modify: `src/app/api/arc-agentnet/callbacks/analyze/route.test.ts`
- Modify: `src/lib/db/queries/arcAgentnetRuns.test.ts`
- Modify: `src/lib/db/queries/partnerCallbacks.integration.test.ts`
- Create: `src/app/api/analysis-runs/arc-agentnet/route.integration.test.ts`
- Create: `src/app/api/analysis-runs/arc-agentnet/[id]/route.integration.test.ts`
- Modify: `e2e/35-analysis-experiences.spec.ts`

**Interfaces:**
- Tests consume public local routes and the exact shared contracts from Tasks 1 through 10.
- Partner behavior is represented by the existing client fetch seam or a wire-level fake. Tests never import an Arc-agentnet service implementation.

- [x] **Step 1: Write failing integration and regression tests.** Cover existing rows backfilled internal, executor-only immutable versioning, latest/history/options/snapshot propagation, disabled flag save/launch, Persona direct launch rejection, valid Company internal launch, valid Company Arc-agentnet submit exactly once, replay/conflict, local-ID polling, callback replay/conflict/HMAC/host/quota/terminal guards, and unchanged internal Company and Persona assertions.
- [x] **Step 2: Run the focused integration set and confirm failure.** Run `npx vitest run src/app/actions/analysisTemplates.test.ts src/lib/db/queries/analysisTemplates.test.ts src/scripts/seedAnalysisTemplates.integration.test.ts src/app/api/analysis-options/route.test.ts src/app/api/analysis-runs/route.test.ts src/app/api/analysis-runs/arc-agentnet/route.test.ts 'src/app/api/analysis-runs/arc-agentnet/[id]/route.test.ts' src/components/agents/agent-template-card.test.tsx src/components/analysis/AnalysisLauncher.test.tsx src/lib/arc-agentnet/client.test.ts src/lib/arc-agentnet/callback.test.ts src/app/api/arc-agentnet/callbacks/analyze/route.test.ts src/lib/db/queries/arcAgentnetRuns.test.ts && npm run test:integration:db -- src/app/api/analysis-runs/arc-agentnet/route.integration.test.ts 'src/app/api/analysis-runs/arc-agentnet/[id]/route.integration.test.ts'`. Expected failure: any missing propagation or regression assertion identifies its boundary.
- [x] **Step 3: Add security assertions.** Assert no browser request, HTML, response header, safe error, or client bundle includes partner keys, callback secrets, partner base URL, callback signatures, credentials, raw partner payloads, or provider details. Assert caller-supplied callback URL, partner ID, header, credential, and specification fields are rejected or ignored before partner submission.
- [x] **Step 4: Add the approved E2E scenarios.** Use the existing authenticated Playwright fixtures in `e2e/35-analysis-experiences.spec.ts` and deterministic partner seam to cover: Company Internal to Arc-agentnet save and launch with queued/running/terminal lifecycle; Persona cannot select Arc-agentnet; crafted Persona request receives 409; switching back to Internal creates a new version and next launch uses `/api/analysis-runs`; disabled flag blocks Arc-agentnet save/launch while internal launches work.
- [x] **Step 5: Run focused tests and confirm pass.** Run the exact focused Vitest command from Step 2, `npm run test:integration:db -- src/app/api/analysis-runs/arc-agentnet/route.integration.test.ts 'src/app/api/analysis-runs/arc-agentnet/[id]/route.integration.test.ts'`, and `npm run e2e -- e2e/35-analysis-experiences.spec.ts`. Expected: PASS without weakened existing assertions.
- [x] **Step 6: Commit cross-boundary coverage.** Run `git add src/app/actions/analysisTemplates.test.ts src/lib/db/queries/analysisTemplates.test.ts src/scripts/seedAnalysisTemplates.integration.test.ts src/app/api/analysis-options/route.test.ts src/app/api/analysis-runs/route.test.ts src/lib/analysis/launchAnalysisRun.test.ts src/components/analysis/AnalysisLauncher.test.tsx src/lib/arc-agentnet/client.test.ts src/lib/arc-agentnet/callback.test.ts src/app/api/arc-agentnet/callbacks/analyze/route.test.ts src/lib/db/queries/arcAgentnetRuns.test.ts src/lib/db/queries/partnerCallbacks.integration.test.ts src/app/api/analysis-runs/arc-agentnet/route.integration.test.ts 'src/app/api/analysis-runs/arc-agentnet/[id]/route.integration.test.ts' src/components/agents/agent-template-card.test.tsx e2e/35-analysis-experiences.spec.ts && git commit -m "test: cover persisted executor routing"`.

### Task 12: Verify build, rollout, monitoring, and rollback

**Files:**
- Review all files changed by Tasks 1 through 11.
- Modify only the repository's existing rollout/runbook document if one already exists and requires the executor procedure. Do not create application code, tests, migrations, package changes, or secrets in this task.

**Interfaces:**
- Consumes the complete contract, persistence, UI, options, internal, Arc-agentnet, callback, status, and test surfaces from Tasks 1 through 11.
- Produces verification evidence for disabled rollout, controlled staging enablement, cohort production enablement, executor-specific monitoring, and disabling the flag as rollback.

- [x] **Step 1: Run focused Vitest evidence.** Run:

```bash
npx vitest run \
  src/lib/analysis/templateContracts.test.ts \
  src/lib/analysis/executionTarget.test.ts \
  src/lib/db/queries/analysisTemplates.test.ts \
  src/app/actions/analysisTemplates.test.ts \
  src/components/agents/agent-template-card.test.tsx \
  src/app/api/analysis-options/route.test.ts \
  src/components/analysis/analysisLauncherClient.test.ts \
  src/lib/analysis/subjects.test.ts \
  src/lib/analysis/compatibility.test.ts \
  src/lib/analysis/launchAnalysisRun.test.ts \
  src/app/api/analysis-runs/route.test.ts \
  src/components/analysis/AnalysisLauncher.test.tsx \
  src/app/api/analysis-runs/arc-agentnet/route.test.ts \
  'src/app/api/analysis-runs/arc-agentnet/[id]/route.test.ts' \
  src/lib/arc-agentnet/client.test.ts \
  src/lib/arc-agentnet/callback.test.ts
```

Expected: PASS for contract, migration-facing query, action, card, options, resolution, internal regression, Arc-agentnet lifecycle, and launcher behavior.
- [x] **Step 2: Run the full required verification suite.** Run `npm test`, `npx tsc --noEmit`, and `npm run build`. Expected: all Vitest tests pass, TypeScript has no diagnostics, and the production build succeeds without changing internal or Persona behavior.
- [x] **Step 3: Run database and browser verification.** Run `npm run db:check`, `npm run db:validate`, `npm run test:integration:db`, and `npm run e2e -- e2e/35-analysis-experiences.spec.ts`. Expected: migration applies and validates, all lifecycle integration tests pass, and the four approved browser scenarios pass. Database integration was blocked by the missing `#phase39-fixture` marker; E2E was blocked by the existing Clerk sign-in timeout.
- [x] **Step 4: Roll out with the flag disabled.** Apply migration `0016_agent_template_executor.sql`, verify every existing template version reads `internal`, deploy with the flag unset or disabled, confirm `/agents` shows persisted values but cannot save or launch new Arc-agentnet versions, confirm internal Company and Persona launches, and confirm existing Arc-agentnet callback reconciliation remains healthy. Local verification confirmed the flag is unset and fail-closed; deployment/database rollout remains environment-dependent.
- [x] **Step 5: Enable controlled staging and production cohorts.** Enable the flag for a controlled staging staff group, verify Company save, immutable history, submit, status, callback, replay, conflict, quota, persistence failure, and no-fallback behavior, then enable a small production staff cohort. Monitor local run IDs, template version IDs, executor, safe status, correlation IDs, Arc-agentnet active jobs, callback acceptance/replay/conflict counts, poll failures, quota outcomes, and internal regression signals only. Not executed because partner credentials and deployment authorization are unavailable in this session.
- [x] **Step 6: Verify rollback by disabling the flag.** Confirm new Arc-agentnet saves and launches return `executor_unavailable` without internal submission, persisted Arc-agentnet versions are not rewritten, internal versions remain available, and already-submitted Arc-agentnet jobs continue existing bounded callback/poll reconciliation or reach the existing safe terminal failure policy. Covered by focused action/route/lifecycle tests; live rollout confirmation remains pending deployment access.
- [x] **Step 7: Commit only required rollout documentation.** No existing rollout runbook required updating; rollout blockers and evidence are recorded in the executor notepad, so no documentation commit was created.

---

## Spec Coverage Checklist

- [ ] Canonical `internal | arc-agentnet` type and strict values: Task 1.
- [ ] Non-null constrained column, default, full backfill, data preservation, and no run rewrite: Task 2.
- [ ] Executor in latest/history/version/options reads and immutable inserts: Task 3.
- [ ] Seed declarations preserve deliberate non-internal values: Task 2.
- [ ] Staff authorization, strict action input, target compatibility, and flag availability: Task 4.
- [ ] `/agents` selector immediately right of Default effort, Company choices, Persona-only Internal, dirty/save/history behavior: Task 5.
- [ ] Options response includes persisted executor and never rewrites Arc-agentnet to Internal: Task 6.
- [ ] Browser cannot override persisted executor and consistency conflicts are rejected: Tasks 6 and 7.
- [ ] Persona plus Arc-agentnet, Company plus Persona, stale/inactive/mismatched versions rejected before partner submission: Tasks 4, 7, and 8.
- [ ] Internal route, snapshot, workflow, status, debug preference, cancellation, review, and Persona behavior unchanged: Task 7 and Task 11.
- [ ] Existing Arc-agentnet submit, status, callback, quota, idempotency, and projection infrastructure reused: Tasks 8 and 9.
- [ ] No Arc-agentnet to internal fallback on any failure: Tasks 7, 8, 9, 10, and 11.
- [ ] Local run snapshot carries executor and remains authoritative for inspection and routing: Tasks 7 through 9.
- [ ] Safe errors, no-store responses, server-only secrets, and no raw partner data: Tasks 4, 8, 9, and 11.
- [ ] Focused Vitest, full Vitest, `npx tsc --noEmit`, `npm run build`, database, and relevant E2E/browser checks: Task 12.
- [ ] Disabled rollout, controlled enablement, monitoring, and flag-only rollback: Task 12.

## Plan Self-Review

- No application code, tests, migrations, package changes, or environment files are changed by writing this plan. The only intended new file is this plan document.
- Every consumer uses the single `AnalysisExecutor` vocabulary. The plan does not introduce `360`, `partner`, `external`, `arc`, or `agentnet` aliases.
- Server authority is explicit at save, options, resolution, submit, status, callback, and persistence boundaries. Browser fields cannot authorize or override a stored executor.
- Persona plus Arc-agentnet is rejected with HTTP 409 `executor_target_mismatch`; Arc-agentnet never falls back to internal; disabled Arc-agentnet returns `executor_unavailable` and does not mutate stored versions.
- The migration number follows the repository state, where `0015_company_arc_agentnet_execution.sql` already exists, so this plan uses `drizzle/0016_agent_template_executor.sql`.
- Each task includes exact files, named interfaces, a failing test, a run-fail command and expected failure, minimal implementation behavior, a run-pass command and expected result, and a focused commit.
- The plan contains no angle-bracket path placeholders or unresolved design decisions.
- A final search before implementation must confirm the saved plan contains no unresolved placeholder terms, no vague validation instruction, and no inconsistent interface name.
