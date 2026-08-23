# Persisted Agent Template Executor Selection

**Status:** Approved design specification  
**Date:** 2026-08-23  
**Scope:** Agent template versions and analysis launch routing

## 1. Purpose and approved decisions

This specification adds a persisted executor choice to every agent template version. The choice determines whether a selected analysis runs through the existing 360 internal executor or through the existing Arc-agentnet integration.

The approved decisions are:

1. The executor is persisted on `analysis_template_version`, not as mutable global UI state and not as a separate user preference.
2. The only allowed values are `internal` and `arc-agentnet`.
3. Every existing template version is backfilled to `internal`.
4. The selector appears in `/agents`, immediately to the right of `Default effort`.
5. Saving executor changes follows the existing immutable version workflow. A changed executor creates a new template version. Previous versions retain their executor value.
6. Internal execution continues through the existing `/api/analysis-runs` route and workflow path.
7. Arc-agentnet execution continues through the existing safe submit, status, callback, quota, idempotency, and result projection infrastructure. This feature does not create a new partner protocol.
8. Arc-agentnet is Company-only. A Persona template version may never execute through Arc-agentnet. The server rejects an unsupported Persona and Arc-agentnet combination even if a caller bypasses the UI.
9. Arc-agentnet never silently falls back to internal execution. Configuration, feature availability, partner, quota, or persistence failures remain explicit failures.
10. The existing Arc-agentnet feature flag remains server-enforced. It is `COMPANY_ANALYSIS_ARC_AGENTNET_ENABLED`, disabled by default. Disabling it prevents new Arc-agentnet saves and launches, but does not rewrite persisted values or route them internally.

## 2. Current integration boundaries

| Area | Existing location | Required behavior |
| --- | --- | --- |
| Template editor | `src/components/agents/agent-template-card.tsx` | Render and submit the executor beside `Default effort`. |
| Template management action | `src/app/actions/analysisTemplates.ts` | Parse the executor in the content contract, require staff access, and save it as versioned content. |
| Template query layer | `src/lib/db/queries/analysisTemplates.ts` | Read executor for the latest version and all history, and insert it into each new version. |
| Template contracts | `src/lib/analysis/templateContracts.ts` | Define the exact executor union and strict management input. |
| Template storage | `analysis_template_version` | Store one non-null executor value per version. |
| Analysis options | Existing analysis options route and `analysisLauncherClient.ts` | Return the resolved executor with each selectable template version. The browser does not choose a different executor at launch time. |
| Analysis resolution | `src/lib/analysis/subjects.ts` and existing compatibility resolution | Resolve the selected current version and its persisted executor, then enforce target compatibility. |
| Internal launch | `src/app/api/analysis-runs/route.ts`, `src/lib/analysis/launchAnalysisRun.ts`, and `src/workflows/analysisRun.ts` | Preserve the current route, snapshots, workflow dispatch, statuses, and Persona behavior. |
| Arc-agentnet launch | Existing Arc-agentnet submit route and client | Submit only server-resolved Company data through the existing client and durable local run relation. |
| Arc-agentnet lifecycle | Existing status route, callback route, quota checks, idempotency, and projection queries | Remain the only partner lifecycle boundary. |

The executor is part of the authored template version. The existing analysis template selector remains the selector for the analysis definition. The launcher must not add a second free-form transport selector that can override the persisted executor.

## 3. Domain model

### 3.1 Allowed values

The canonical domain type is:

```ts
export type AnalysisExecutor = 'internal' | 'arc-agentnet';
```

The database enum or check constraint, Zod schema, query result type, action input, launch resolution type, and API response type must all use this same vocabulary. No aliases such as `360`, `partner`, `external`, `arc`, or `agentnet` are valid persisted values.

### 3.2 Template version ownership

`analysis_template_version.executor` is:

* non-null;
* constrained to `internal` or `arc-agentnet`;
* defaulted to `internal` for safe insertion and migration compatibility;
* included in reads, history, snapshots, and launch resolution;
* immutable after the version is created.

The parent `analysis_template` does not carry the executor. The latest version determines the executor presented by `/agents` and used by new launches. Historical versions retain their own executor so existing run inspection remains truthful.

The executor is not part of the authored instruction text, effort value, or custom capability selection. It is a first-class version field with its own validation and audit visibility.

### 3.3 Target compatibility

The compatibility matrix is fixed:

| Template target type | `internal` | `arc-agentnet` |
| --- | --- | --- |
| `company` | Allowed | Allowed when the server feature flag is enabled and Arc-agentnet preflight succeeds |
| `persona` | Allowed | Rejected by the server with `executor_target_mismatch` |

The matrix is enforced at template save time and again at launch time. Save-time validation protects the data model. Launch-time validation protects against stale data, direct requests, migration defects, and future callers.

## 4. `/agents` editor behavior

### 4.1 Placement and controls

In each fixed template card, the controls appear in this order:

1. Current instruction
2. Default effort
3. Executor

The Executor control is immediately to the right of Default effort at desktop widths. At narrow widths the controls may wrap, but their DOM order and label order remain the same. The existing Save new version and lifecycle controls remain unchanged.

The Executor control is a labeled select with exactly these labels and values:

| Label | Value |
| --- | --- |
| Internal | `internal` |
| Arc-agentnet | `arc-agentnet` |

The UI must not display an Arc-agentnet choice for a Persona template as an actionable option. Persona cards display `Internal` as the only valid selection and may show a concise read-only note that Arc-agentnet supports Company templates only. A direct or stale `arc-agentnet` value on a Persona version is rendered as an invalid configuration state, cannot be saved as-is, and is never launched.

### 4.2 State and save semantics

The card initializes the selected executor from `template.latest.executor`. It marks the form dirty when the value changes and submits it with the existing instruction, expected version, and default effort fields.

The content action input is conceptually:

```json
{
  "operation": "content",
  "templateKey": "company-buying-signal-analysis",
  "expectedVersion": 3,
  "instruction": "...",
  "defaultEffort": "standard",
  "executor": "arc-agentnet"
}
```

A successful executor-only change appends a new immutable version. The response updates the card to the new latest version and reports the existing version-save confirmation. An unchanged executor, instruction, and effort produces the existing no-op result.

The history view includes `Executor: Internal` or `Executor: Arc-agentnet` for every prior version. History is read-only. A historical executor cannot be edited in place.

### 4.3 Feature availability in the editor

`COMPANY_ANALYSIS_ARC_AGENTNET_ENABLED` is evaluated on the server and projected to `/agents` as availability metadata, not as an authorization decision made by React.

When the flag is disabled:

* Company cards show the persisted executor value.
* A new or changed Company version cannot be saved with `arc-agentnet`.
* The server returns `executor_unavailable` and the card preserves the unsaved value with an actionable error.
* Existing persisted Arc-agentnet versions are not rewritten to `internal`.
* Existing Arc-agentnet versions cannot be launched while disabled. The launch response is `executor_unavailable`, with no internal submission.

When the flag is enabled, Company cards may save either allowed executor. The flag does not enable Arc-agentnet for Persona templates.

## 5. Persistence and migration

### 5.1 Schema change

Add `executor` to `analysis_template_version` using the repository's existing migration conventions. The preferred relational representation is a database enum or a check constraint with a non-null default of `internal`.

The migration must:

1. Add the constrained column with a temporary or direct default of `internal`.
2. Backfill every existing row to `internal`.
3. Verify no row is null and no row contains a value outside the two-value contract.
4. Retain the default for future seed and insert paths.
5. Preserve all template IDs, version numbers, instructions, efforts, budgets, status values, authors, timestamps, and run snapshots.

The migration must not rewrite historical analysis runs. A run snapshot already represents the executor used by that run, or the run is an existing internal run by definition. Existing runs remain internal and continue through the current internal inspection path.

### 5.2 Query and seed behavior

The template query layer includes `executor` in:

* `TemplateVersionRead`;
* `ManagedAnalysisTemplateRead.latest`;
* `ManagedAnalysisTemplateRead.history`;
* `getAnalysisTemplateVersion`;
* active analysis option rows;
* the new version insert projection.

`saveAnalysisTemplateVersion` carries forward only the values explicitly supplied by the validated action. It must insert the new executor alongside instruction, supported efforts, default effort, and budget. The version conflict check includes executor, so concurrent edits cannot silently discard an executor change.

The seed script declares `executor: 'internal'` for both existing fixed seed templates. Seed validation treats a stored non-internal value as a deliberate configuration difference rather than silently overwriting it. A seed run must not change a live template version's executor.

### 5.3 Invalid data handling

If a read encounters a null or unsupported executor after migration, it is a data integrity failure. The server must not infer Arc-agentnet and must not silently route internally. Management reads may surface a safe configuration error. Launch resolution rejects the version with `invalid_executor_configuration` and records no new run.

## 6. Contracts and server validation

### 6.1 Management action contract

Extend the strict content schema in `templateContracts.ts` with:

```ts
executor: z.enum(['internal', 'arc-agentnet'])
```

Unknown fields remain rejected. The action continues to call `requireStaffAccess()` before saving. The action then validates the selected executor against the template target type and feature availability:

* `internal` is valid for Company and Persona.
* `arc-agentnet` is valid only for Company and only when `COMPANY_ANALYSIS_ARC_AGENTNET_ENABLED` is enabled.
* Persona plus `arc-agentnet` returns `invalid_input` with a stable field issue on `executor` and does not write a version.
* Company plus disabled `arc-agentnet` returns `executor_unavailable` and does not write a version.

The query layer repeats the target check at its write boundary. Validation must not depend only on the card's filtered options.

### 6.2 Analysis options contract

Each fixed or custom selectable template version returned to the launcher includes its persisted executor. The option is a read-only launch property from the browser's perspective.

Conceptually:

```json
{
  "templateVersionId": 42,
  "targetType": "company",
  "executor": "arc-agentnet",
  "supportedEfforts": ["standard"],
  "defaultEffort": "standard"
}
```

The options route omits or marks Arc-agentnet unavailable when the feature flag is disabled, but it does not transform a persisted `arc-agentnet` value into `internal`. A stale client request cannot use the options response to bypass server resolution.

### 6.3 Launch contract

The browser continues to submit the selected subject, Practice Area, category, and opaque template or custom-agent selection. It may include the expected executor as a consistency hint, but the server treats the persisted database value as authoritative.

The server launch sequence is:

1. Authenticate the staff user.
2. Parse the strict request and reject malformed, unknown, or unsupported fields.
3. Resolve the selected current template or custom-agent version.
4. Read the persisted executor from that resolved version.
5. If a supplied consistency hint differs from the persisted executor, reject with `executor_conflict` and do not launch.
6. Validate target compatibility. Persona plus Arc-agentnet returns `executor_target_mismatch` with HTTP 409 and no partner call.
7. Validate Arc-agentnet feature availability when the persisted executor is Arc-agentnet.
8. Route according to the persisted executor.

No client field can grant Arc-agentnet access, change a Persona into a Company, supply partner configuration, or override the stored executor.

## 7. Routing behavior

### 7.1 Internal executor

For `executor === 'internal'`, the server uses the existing internal route and service:

* `/api/analysis-runs` remains the launch entry point.
* `launchAnalysisRun` resolves the template, subject, checklist, policy, and snapshots as it does today.
* `analysisRun` continues to dispatch the existing internal workflow.
* Existing internal statuses, debug preference behavior, cancellation, review semantics, and Persona support remain unchanged.

The executor field is copied into the run's immutable template or execution snapshot as `internal`. Existing internal queries continue to scope internal rows correctly. No Arc-agentnet client or callback path is called.

### 7.2 Arc-agentnet executor

For `executor === 'arc-agentnet'`, the server uses the existing Arc-agentnet infrastructure described in the approved Company Analysis Arc-agentnet specification:

* Only a Company subject is accepted.
* The server resolves and bounds the Company, Practice Area, category, selected template version, checklist, and public evidence URLs.
* The existing `createArcAgentnetClient().submit()` method is used for `POST /partner/jobs`.
* Existing scoped idempotency and active-job checks are applied.
* Existing local run and partner mapping persistence is used before a success response is returned.
* The browser polls by the local 360 application run ID through the existing Arc-agentnet status route.
* Existing callback verification, host allowlist, HMAC, replay protection, request matching, result-size limit, and safe result projection remain unchanged.
* Existing submit, poll, active-job, and daily quotas remain enforced.

The executor determines the route. The route must never call the internal service after an Arc-agentnet dispatch failure. A partner failure, timeout, quota rejection, unavailable flag, or local persistence failure returns a safe Arc-agentnet error.

### 7.3 Company-only safety

The server rejects all of these before partner submission:

* Persona subject with an Arc-agentnet template version;
* Company subject paired with a Persona template version;
* Arc-agentnet selection when the feature flag is disabled;
* stale or inactive template versions;
* mismatched template and custom-agent target types;
* caller-supplied partner job IDs, callback URLs, partner headers, credentials, or analysis specification IDs.

There is no fallback from a rejected or failed Arc-agentnet launch to internal execution. A later approved design may add Persona support, but that requires a new contract, payload policy, migration decision, and rollout. It is not implied by this design.

## 8. Run snapshots and lifecycle

Every new run snapshots the resolved executor with the selected template version. The snapshot is immutable and is the source of truth for run inspection, status routing, and audit display.

The local run relation contains or references:

* `executionTarget`, with `internal` or `arc-agentnet` mapped from the template executor;
* template ID and version ID;
* template target type;
* initiating staff user ID;
* Company or Persona subject identity;
* resolved template and checklist snapshots;
* partner mapping fields only for Arc-agentnet runs;
* local status and safe reason.

Existing internal rows are treated as `internal` during the migration backfill. Arc-agentnet rows are created only by the Arc-agentnet path and are never made visible through an internal-only query by changing a flag or a client field.

## 9. Error and failure behavior

All management and launch responses use existing safe error envelope conventions. Partner response bodies, credentials, signatures, callback bodies, and hidden provider details are not returned to the browser.

| Condition | Result | Partner call |
| --- | --- | --- |
| Malformed or unknown management input | `invalid_input` | No |
| Persona with Arc-agentnet executor | HTTP 409 `executor_target_mismatch` | No |
| Company with disabled Arc-agentnet flag | HTTP 409 `executor_unavailable` | No |
| Missing or inactive selected version | Existing safe 404 or 409 resolution error | No |
| Persisted executor is null or unsupported | HTTP 500 safe configuration error | No |
| Internal launch dispatch fails | Existing `dispatch_failed` behavior | Internal only |
| Arc-agentnet quota or capacity is exhausted | Existing safe `rate_limited` or `capacity_unavailable` | No |
| Arc-agentnet partner submit fails | HTTP 502 or 503 `dispatch_failed` | One bounded attempt |
| Arc-agentnet local persistence fails | HTTP 502 or 503 `persistence_unavailable` | No successful launch response |
| Arc-agentnet poll is unavailable | Existing last-known-state or `status_unavailable` behavior | Bounded poll only |
| Arc-agentnet callback is invalid | Existing callback rejection | No local transition |

Retries must reuse the existing idempotency key and durable mapping rules. The system must not create a second partner job because a browser request timed out. It must not auto-route a failed partner request internally.

## 10. Security and authorization

* `/agents` management actions require `requireStaffAccess()`.
* Server-side target and executor validation runs on every save and launch.
* The browser cannot modify the persisted executor except through the authenticated version action.
* Partner keys, webhook secrets, partner base URLs, callback URLs, analysis specification IDs, and provider credentials remain server-only.
* The browser submits opaque identities, not resolved instructions, database rows, raw partner payloads, or transport configuration.
* Arc-agentnet status and result routes authorize the initiating staff user and accept only local 360 run IDs.
* State-bearing responses use `Cache-Control: no-store`.
* Logs and telemetry include local run IDs, template version IDs, executor, safe status, and correlation identifiers only. They exclude secrets and raw partner content.
* The feature flag is not an authorization substitute. Staff authorization and Company-only policy remain separate checks.

## 11. Tests

### 11.1 Unit and contract tests

Cover:

* `internal` and `arc-agentnet` are the only accepted values.
* Unknown executor values and unknown input fields are rejected.
* Existing rows and missing legacy executor values normalize only through the migration default, never through a runtime Arc-agentnet guess.
* Persona plus Arc-agentnet is rejected.
* Company plus either executor is accepted when other validation passes.
* Executor-only changes append a version and preserve prior history.
* Concurrent version edits produce the existing conflict result and do not lose executor changes.

### 11.2 `/agents` component tests

Cover:

* Executor is immediately right of Default effort in the rendered control order.
* Company cards offer Internal and Arc-agentnet when enabled.
* Persona cards expose only Internal.
* The initial value comes from the latest persisted version.
* Saving returns the new version and updates the visible value.
* A failed save keeps the unsaved selection and shows safe error copy.
* History displays the executor for every prior version.

### 11.3 Route and integration tests

Cover:

* Disabled flag blocks Arc-agentnet save and launch without a partner call.
* Direct Persona plus Arc-agentnet launch returns `executor_target_mismatch` without a partner call.
* Valid Company internal launch reaches the existing `/api/analysis-runs` path.
* Valid Company Arc-agentnet launch reaches the existing submit client exactly once.
* Arc-agentnet status uses local run IDs and existing safe projection.
* Callback replay, conflict, HMAC, host, quota, idempotency, and terminal guards remain intact.
* Existing internal Company and Persona launch tests pass without weakened assertions.

### 11.4 End to end scenarios

Cover:

1. Staff edits a Company template from Internal to Arc-agentnet, saves a new version, launches it, and observes the existing safe Arc-agentnet lifecycle.
2. Staff opens a Persona template and cannot select Arc-agentnet.
3. A crafted Persona Arc-agentnet request is rejected by the server.
4. Staff edits a template back to Internal, creates a new version, and confirms the next launch uses the internal route.
5. Disabling the feature flag hides or disables new Arc-agentnet configuration and leaves internal launches working.

## 12. Rollout and feature flag

The implementation ships behind `COMPANY_ANALYSIS_ARC_AGENTNET_ENABLED`, defaulting to disabled when unset, `false`, `0`, or `off`. Values `true`, `1`, and `on` enable the Company Arc-agentnet path. Any other value is invalid configuration and is treated as disabled with a startup or deployment diagnostic.

The flag is checked in three places:

1. `/agents` data loading and management action validation;
2. analysis options and launch resolution;
3. the Arc-agentnet submit route.

The client may use server-projected availability for presentation, but all three server checks remain mandatory.

Rollout sequence:

1. Apply the migration and backfill. Verify all existing versions read as `internal`.
2. Deploy with the flag disabled. Confirm `/agents`, internal Company launches, Persona launches, and existing Arc-agentnet callback handling remain healthy.
3. Enable the flag in staging for a controlled staff group. Verify Company save, version history, submit, status, callback, replay, conflict, quota, and rollback behavior.
4. Enable for a small production staff cohort. Monitor executor-specific launch counts, safe failures, active jobs, callback acceptance, poll failures, quota outcomes, and internal regression signals.
5. Expand to all staff after the acceptance matrix passes.

Rollback is disabling the flag. This blocks new Arc-agentnet saves and launches. It does not mutate stored versions and does not cancel already submitted partner jobs. Existing Arc-agentnet jobs continue through the existing bounded callback and polling reconciliation, or reach their existing safe terminal failure policy. Internal execution remains available only for versions whose persisted executor is `internal`.

## 13. Acceptance criteria

The design is complete when all of the following are true:

* `analysis_template_version` stores a non-null executor constrained to `internal | arc-agentnet`.
* Existing rows are backfilled to `internal` without changing historical template content or run meaning.
* `/agents` places the selector immediately right of Default effort and persists changes through immutable versions.
* Template reads, history, options, snapshots, and launch resolution include the executor.
* The server rejects invalid values, disabled Arc-agentnet configuration, stale versions, and Persona plus Arc-agentnet combinations.
* Internal executor versions use the unchanged internal analysis route and workflow behavior.
* Arc-agentnet Company versions reuse existing safe submit, status, callback, quota, idempotency, and projection infrastructure.
* Arc-agentnet failures never silently fall back to internal execution.
* Feature flag behavior, authorization, and rollback behavior are explicit and server-enforced.
* Unit, component, route, integration, regression, and end to end tests cover the contracts and failure paths above.
* The full verification suite passes with no secrets exposed and no application code or test behavior changed outside the approved implementation scope.
