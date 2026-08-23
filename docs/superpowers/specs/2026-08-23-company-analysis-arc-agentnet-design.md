# Company Analysis Arc-agentnet Execution Target

**Status:** Approved design specification  
**Date:** 2026-08-23  
**Scope:** Company Analysis only

## 1. Purpose and approved decisions

This specification adds Arc-agentnet as an execution target for Company Analysis in the 360 application. It preserves the existing internal analysis agent and its bridge contract. The feature adds a second transport path behind the existing Analysis Launcher rather than replacing or altering the current internal path.

The approved decisions are:

1. Use approach A. The 360 server resolves and bounds the request, then submits the bounded job to Arc-agentnet. The browser never calls Arc-agentnet directly.
2. Support Company Analysis only. Persona Analysis remains on the existing internal path and is not exposed as an Arc-agentnet target.
3. Keep the existing template and custom agent selector as the analysis-template selector. The selected fixed template or custom agent version remains the authored analysis definition.
4. Add a separate execution-target selector with exactly two choices: `360 internal` and `Arc-agentnet`.
5. When `Arc-agentnet` is selected, the selected existing template or custom agent is used as the transport target. No dedicated Arc-agentnet template is introduced.
6. Keep the existing 360 Partner Bridge contract unchanged. Existing partner job endpoints, callback verification, durable mapping, and callback route remain the integration boundary.

The implementation must not add Persona support, browser-side partner credentials, arbitrary callback configuration, `ADMIN_API_KEY` usage, or direct browser calls to Arc-agentnet.

## 2. Current modules and integration boundaries

The design is grounded in the current 360 modules:

| Area | Current module or route | Role in this design |
| --- | --- | --- |
| Launcher UI | `src/components/analysis/AnalysisLauncher.tsx` | Adds the Company-only target selector while retaining Practice Area, Buying Signal Category, and template/custom agent selection. |
| Browser request helpers | `src/components/analysis/analysisLauncherClient.ts` | Sends only opaque subject and selection identities to 360 server routes. It must not contain partner credentials or authored instructions. |
| Existing internal submit route | `src/app/api/analysis-runs/route.ts` | Remains the unchanged internal launch entry point and regression path. |
| Existing internal launch service | `src/lib/analysis/launchAnalysisRun.ts` | Remains responsible for internal template resolution, snapshots, workflow dispatch, and internal status transitions. |
| Existing internal status route | `src/app/api/analysis-runs/[id]/route.ts` | Remains the authoritative status route for internal runs. |
| Existing polling client | `src/lib/analysis/pollingClient.ts` | Continues to poll internal runs. An Arc-agentnet target uses a separate 360 target status route with equivalent safe UI semantics. |
| Partner client | `src/lib/arc-agentnet/client.ts` | Server-only transport for `POST /partner/jobs`, `GET /partner/jobs/:job_id`, cancel, and delete. It sends `X-Partner-Key`, `Idempotency-Key`, `cache: no-store`, and `redirect: error`. |
| Callback verifier | `src/lib/arc-agentnet/callback.ts` | Verifies the fixed callback host allowlist, timestamp, event ID, HMAC-SHA256 signature, payload shape, replay window, and 5 MB result limit. |
| Durable partner mapping | `src/lib/db/queries/partnerCallbacks.ts` | Persists partner job ID, request ID, idempotency key, status, callback events, hashes, results, and replay outcomes. |
| Existing callback route | `src/app/api/arc-agentnet/callbacks/analyze/route.ts` | Remains the HMAC-protected callback endpoint and returns accepted, replay, conflict, and failure envelopes. |
| Existing environment boundary | `src/lib/env` and server-only modules | Holds partner configuration. Partner secrets are available only to server code. |

The existing `AnalysisLauncher` currently submits either the ordinary route or the debug route based on a confirmed debug preference. The new execution target is independent of that debug preference. The internal target keeps the current preference behavior. The Arc-agentnet target always uses the new staff-authenticated server-only Arc-agentnet submit route and never uses the debug route.

## 3. User interface and selection model

### 3.1 Company-only behavior

The target selector is rendered only when `subjectType === 'company'`. For Persona Analysis, the current launcher remains unchanged: it has no Arc-agentnet target choice and cannot produce an Arc-agentnet request.

The Company launcher retains this order:

1. Practice Area
2. Buying Signal Category
3. Existing analysis-template selector, containing the current fixed and custom agent options
4. Execution target selector, containing exactly `360 internal` and `Arc-agentnet`
5. Resolved preview
6. Start analysis

The template selector and execution-target selector must remain visibly and semantically separate. Changing the template changes the selected analysis definition. Changing the target changes only the transport path. Neither selector may silently change the other.

### 3.2 Opaque client selection state

The browser may hold these selection identities:

```text
subjectType: "company"
subjectId: positive integer
practiceAreaId: positive integer
signalCategory: non-empty string
selection:
  fixed: { kind: "fixed", templateVersionId: positive integer }
  custom: { kind: "custom", customAgentId: opaque string, templateVersionId: positive integer }
executionTarget: "internal" | "arc-agentnet"
```

The browser must not hold or submit authored instructions, research queries, output schemas, capability presets, model chains, budgets, policy, provider names, tool definitions, partner job IDs, request IDs, callback URLs, or secrets. The server re-resolves all authored data from the selected template or custom agent version at submit time.

### 3.3 Preview behavior

The existing preview remains the source of truth for the resolved analysis definition. Selecting `Arc-agentnet` may add a transport summary to the preview, such as `Execution target: Arc-agentnet`, but must not expose the partner payload or credentials.

The Start button is disabled until the selected Company, Practice Area, Buying Signal Category, existing template/custom agent, execution target, and resolved preview are valid. A target change invalidates the current preview and requests a fresh preview so a stale selection cannot be submitted.

The UI must show a clear target-specific status after submission:

* Internal: existing wording and internal run number behavior.
* Arc-agentnet: `Company analysis job #<360 run id> submitted to Arc-agentnet`, followed by `Queued`, `Running`, `Completed`, `Failed`, or `Cancelled` using the safe projected status.

## 4. Server routes and contracts

All new routes are App Router route handlers. Every route calls `requireStaffAccess()` before reading or acting on a run. Every response that contains job or result state sets `Cache-Control: no-store`. No route returns partner credentials or raw callback signatures.

### 4.1 Server-only submit route

**Route:** `POST /api/analysis-runs/arc-agentnet`

This route is the only 360 browser entry point for Arc-agentnet submission. It is server-only in the architectural sense: it imports the partner client and database mapping only through server modules, and it must never be callable as a partner proxy with caller-supplied destination, headers, or callback configuration.

**Request:**

```json
{
  "subject": { "type": "company", "id": 123 },
  "practiceAreaId": 7,
  "signalCategory": "Cost pressure",
  "selection": {
    "kind": "custom",
    "customAgentId": "opaque-custom-agent-id",
    "templateVersionId": 42
  },
  "idempotencyKey": "client-generated-opaque-request-key"
}
```

The server accepts `type: "company"` only. The client-provided idempotency key is treated as an opaque retry key, scoped to the authenticated Clerk user and request payload. The server may replace it with a server-generated key derived from the authenticated user, subject, selected template version, and retry nonce. It must never trust a client key as authorization.

**Success, HTTP 201:**

```json
{
  "executionTarget": "arc-agentnet",
  "applicationRunId": 901,
  "status": "queued",
  "partnerJobId": "opaque-partner-job-id"
}
```

`partnerJobId` is returned only to the authenticated initiating staff member and is not used by the browser for subsequent polling. The browser polls by the opaque 360 `applicationRunId`.

**Error envelope:**

```json
{ "error": "invalid_input" }
```

Required status mapping:

| Condition | HTTP status | Error |
| --- | ---: | --- |
| Malformed JSON, unknown fields that violate the route schema, non-company subject, invalid IDs, empty category, or invalid target selection | 400 | `invalid_input` |
| Authenticated user lacks staff access | 401 or 403, as returned by `requireStaffAccess` | Existing auth response, with no partner detail |
| Company, Practice Area, category, template version, or custom agent is missing | 404 | Existing safe domain error, such as `subject_not_found` or `template_version_not_found` |
| Selected template is inactive or incompatible with Company Analysis | 409 | `template_not_active` or `subject_type_mismatch` |
| An active Arc-agentnet or internal run already exists for the same Company and compatible selection | 409 | `active_run_exists` |
| Arc-agentnet is not configured, partner submit is unavailable, or the response cannot be persisted | 502 or 503 | `dispatch_failed` |
| Same idempotency key maps to the same durable submission | 200 | Existing `applicationRunId`, with `replayed: true` |
| Same idempotency key conflicts with another payload | 409 | `idempotency_conflict` |

The route must persist the local run and durable partner mapping before returning success. If partner submission succeeds but local mapping cannot be persisted, the route must not return a successful launch. It must record or safely surface a dispatch or persistence failure and prevent an untracked job from being presented as launched.

### 4.2 Arc-agentnet status and polling route

**Route:** `GET /api/analysis-runs/arc-agentnet/:id`

The route accepts only a positive local 360 run ID. It loads the local run and mapping, verifies that it is an Arc-agentnet run, and returns a safe projection. It must not accept a partner job ID from the browser.

**Response, HTTP 200:**

```json
{
  "applicationRunId": 901,
  "executionTarget": "arc-agentnet",
  "status": "running",
  "safeReason": null,
  "timestamps": {
    "createdAt": "2026-08-23T12:00:00.000Z",
    "startedAt": "2026-08-23T12:00:02.000Z",
    "completedAt": null,
    "terminalAt": null
  },
  "snapshotSummary": {
    "template": {
      "templateId": 10,
      "templateVersionId": 42,
      "key": "company-analysis",
      "name": "Cost Pressure Review",
      "targetType": "company",
      "version": 3
    },
    "subject": {
      "type": "company",
      "id": 123,
      "displayName": "Example Holdings"
    },
    "checklist": {
      "practiceAreaId": 7,
      "practiceAreaName": "Finance Transformation",
      "itemCount": 4
    }
  },
  "events": []
}
```

The safe projection may include counts, labels, timestamps, safe reasons, and an allowlisted result summary. It must never include partner credentials, raw HMAC headers, the full bounded transport input, internal secrets, hidden policy fields, unredacted provider traces, or arbitrary callback content.

**Status errors:**

* `400 { "error": "invalid_input" }` for an invalid local ID.
* `404 { "error": "analysis_run_not_found" }` for a missing run or a run that is not visible through the staff route.
* `503 { "error": "status_unavailable" }` only when authoritative status cannot be obtained after the route's bounded retry policy. The route must not fabricate `completed` or `failed` state.

The client polling cadence is two seconds initially, matching `src/lib/analysis/pollingClient.ts`. It stops on `completed`, `failed`, or `cancelled`, and it aborts when the launcher closes or unmounts. The server is authoritative for state. Browser polling is a read operation and does not advance or finalize a job.

### 4.3 Existing callback route

**Route:** `POST /api/arc-agentnet/callbacks/analyze`

This route remains the callback boundary already implemented in `src/app/api/arc-agentnet/callbacks/analyze/route.ts`. It continues to call `receiveAnalyzeCallback` with `env.PARTNER_WEBHOOK_SECRET` and `durableCallbackEventStore`.

The callback route accepts only requests arriving on the confirmed host set:

* `360.arclumenpartners.com`
* `staging.360.arclumenpartners.com`
* `arc-agentnet.arclumen.de`

The route must not accept an arbitrary callback host from a request field or environment override. Successful new and replayed callbacks return HTTP 202 with `{ "accepted": true }` and `Cache-Control: no-store`. Existing failure mappings remain intact.

## 5. Bounded Arc-agentnet payload

The 360 server constructs the partner input only after staff authentication, Company lookup, template resolution, checklist resolution, and public evidence filtering. The selected existing template or custom agent supplies the resolved instructions and metadata. The server does not invent a dedicated Arc-agentnet template.

### 5.1 Payload contract

The partner `input` object sent through `createArcAgentnetClient().submit()` has this bounded shape:

```json
{
  "schemaVersion": 1,
  "analysis": {
    "subjectType": "company",
    "company": {
      "id": 123,
      "name": "Example Holdings",
      "domain": "example.com",
      "profile": {
        "industry": "Business services",
        "headcount": 1200,
        "headquarters": "Chicago, IL",
        "description": "Public company providing business services"
      }
    },
    "practiceArea": {
      "id": 7,
      "name": "Finance Transformation",
      "shortCode": "FIN"
    },
    "buyingSignalCategory": "Cost pressure",
    "template": {
      "kind": "custom",
      "templateId": 10,
      "templateVersionId": 42,
      "templateKey": "company-analysis",
      "templateName": "Cost Pressure Review",
      "templateVersion": 3,
      "targetType": "company",
      "customAgentId": "opaque-custom-agent-id",
      "customAgentName": "Finance signal reviewer",
      "customAgentVersion": 5
    },
    "resolvedInstructions": "Server-resolved instruction text from the selected active template version.",
    "checklist": [
      {
        "id": 1001,
        "label": "Assess evidence of financial cost pressure",
        "required": true
      }
    ],
    "publicEvidenceUrls": [
      "https://example.com/investor-update"
    ]
  }
}
```

The exact company profile fields are the current 360 Company fields selected by an allowlist. Missing optional profile values are omitted or set to `null` according to the local schema convention. The payload must not include unrestricted database rows, auth claims, private notes, unpublished credentials, raw provider responses, or arbitrary user-supplied URLs.

### 5.2 Payload limits and validation

The route validates the complete serialized request before calling the partner client:

* Total partner request body: at most 1 MB.
* Any individual input value: at most 25 MB, although the total 1 MB request limit is stricter for this feature.
* Total partner job input and output accounting: at most 100 MB per job under the confirmed partner quota.
* Callback result stored and accepted: at most 5 MB, enforced by `MAX_CALLBACK_RESULT_BYTES`.
* `resolvedInstructions`: bounded to the selected template's configured maximum and included once.
* Checklist: bounded count and per-item label length, with required IDs and labels only.
* Public evidence URLs: HTTPS only, no credentials, fragments, localhost, loopback, `.local`, or `.internal` hosts. Deduplicate URLs and enforce a fixed count and length limit.
* Company domain: normalized hostname form only. Do not send a URL with credentials, path, fragment, or arbitrary scheme as the domain field.

The route rejects an oversized or invalid payload before partner submission with `invalid_input` or `payload_too_large`. The client must use explicit field selection, never object spreading from a database record or request body.

### 5.3 Backend controlled analysis identity

The Arc-agentnet bridge already forces the production `ANALYZE_SPEC_ID` on the backend. The new 360 route does not accept an analysis spec ID, callback URL, partner base URL, or partner headers from the browser. It passes only the bounded `input` object and a server-generated idempotency key to the existing client.

## 6. Submit, polling, and callback flow

### 6.1 Submit flow

1. Staff opens Company Analysis through the existing `EnrichMenu` to `AnalysisLauncher` path.
2. The launcher loads the existing Practice Areas, Buying Signal Categories, and fixed/custom template options through the existing options and preview routes.
3. Staff chooses an existing template/custom agent and the separate execution target `Arc-agentnet`.
4. The launcher sends the opaque Company selection to `POST /api/analysis-runs/arc-agentnet`.
5. The route calls `requireStaffAccess()`, validates `subject.type === "company"`, and resolves the Company, Practice Area, category, and selected template/custom version.
6. The route snapshots the resolved template metadata, resolved instructions, Company profile and domain, checklist, and public evidence URLs into a bounded local run record.
7. The route creates or reuses a durable idempotency record. Repeated submission with the same scoped idempotency key returns the original local run rather than creating a second partner job.
8. The route calls `arcAgentnetClient.submit({ idempotencyKey, input })`. The existing client sends `POST /partner/jobs` with `X-Partner-Key`, `Idempotency-Key`, `cache: no-store`, and `redirect: error`.
9. The existing client registers the returned partner job ID and request ID in `partnerJobMapping`. The local run stores the mapping relation and execution target.
10. The route returns the local 360 `applicationRunId`. The browser does not use the partner job ID to poll.

### 6.2 Authoritative status flow

1. The browser polls `GET /api/analysis-runs/arc-agentnet/:id` every two seconds with `Cache-Control: no-store` on the response.
2. The status handler resolves the local mapping and obtains current partner status through the server-only `poll({ jobId })` operation when the local record is nonterminal or stale.
3. The handler persists only the allowlisted partner status and safe result projection. It maps partner `queued` and `running` to local active states, and partner `succeeded`, `failed`, and `cancelled` to local terminal states.
4. If a callback has already applied a terminal state, polling cannot overwrite it with a nonterminal or conflicting terminal state. The durable transition guard wins.
5. If the partner returns HTTP 410, the local run becomes `failed` with safe reason `job_expired`, without exposing the partner response body.
6. If polling is temporarily unavailable, the route returns the last durable nonterminal state only when it is known to be fresh under the bounded freshness window. Otherwise it returns `status_unavailable`; it never claims success.
7. The browser stops polling on a terminal state, aborts on close, and refreshes the Company view using the existing launcher behavior.

The confirmed partner quotas govern implementation throttling: no more than 30 submits per minute, 300 polls per minute, 5 active jobs, and 500 jobs per day. The 360 route should reject or defer new work before exceeding the active-job limit and return a safe `rate_limited` or `capacity_unavailable` error.

### 6.3 Callback flow

1. Arc-agentnet posts to the fixed callback route with `X-Partner-Timestamp`, `X-Partner-Event-Id`, and `X-Partner-Signature`.
2. `receiveAnalyzeCallback` verifies the confirmed host, required headers, timestamp format, event ID format, five-minute replay window, HMAC-SHA256 over `timestamp.event_id.sha256(raw_body)`, and callback schema.
3. The callback result is bounded to 5 MB before persistence.
4. `durableCallbackEventStore` applies the callback only when job ID and request ID match the durable mapping and the target is not already terminal.
5. Event ID and payload hash make identical deliveries replay-safe. A changed payload with the same event ID is a conflict.
6. The callback updates the durable partner mapping and local Arc-agentnet run projection through the integration boundary. It does not expose raw result content to an unauthenticated caller.
7. The route returns HTTP 202 for accepted and identical replayed events, 401 for signature failures, 404 for unknown or disallowed jobs and hosts, 409 for conflicts, 413 for oversized results, and 503 for persistence or configuration failure.

Callbacks are an optimization for prompt durable updates. Polling remains authoritative and must reconcile a missing or delayed callback. The design therefore does not depend on callback delivery for correctness.

## 7. Local persistence and result projection

The implementation uses the existing durable partner mapping and existing analysis run persistence patterns. Any schema extension must add an explicit execution target and local-to-partner relation without changing the meaning of existing internal run rows.

Each Arc-agentnet run stores, at minimum:

* `executionTarget = "arc-agentnet"`.
* Authenticated Clerk user ID that initiated the run.
* Company type and ID plus a display-name snapshot.
* Practice Area ID and name snapshot.
* Buying Signal Category.
* Existing template metadata, including fixed or custom kind, template ID, template version ID, key, name, target type, version, and custom identity metadata where applicable.
* Resolved instructions snapshot.
* Checklist snapshot.
* Company profile and normalized domain snapshot, limited to the approved allowlist.
* Public evidence URL snapshot.
* Partner mapping ID, partner job ID, request ID, and scoped idempotency key in server-only storage.
* Current safe status, safe reason, timestamps, and transition events.
* Result hash, byte count, and a safe result projection. The raw result is not sent to the browser.

The result projection must be allowlisted and schema validated. It may contain the final analysis summary, verdict, structured findings, and public evidence references needed by the Company view. It must omit secrets, credentials, hidden prompts, provider traces, arbitrary tool output, raw request data, and unrecognized fields. A malformed result is a safe failed outcome, not a reason to pass through unvalidated JSON.

## 8. Security and privacy requirements

### Authentication and authorization

* Every submit, status, cancel, and result route calls `requireStaffAccess()`.
* The Arc-agentnet target is available only to authenticated staff and only for Company subjects.
* Authorization is evaluated server-side for every request. A client-selected target or template identity never grants access.
* Debug authorization remains separate. Arc-agentnet submission never uses `ADMIN_API_KEY` and never inherits debug capture authorization.

### Secret handling

* `X_Partner_Key`, `PARTNER_WEBHOOK_SECRET`, Arc-agentnet base URL, and any provider credentials remain server-only environment values.
* No partner secret appears in browser JavaScript, rendered HTML, response headers, logs, analytics events, or error messages.
* The browser cannot provide a partner URL, callback URL, partner header, analysis spec ID, or transport configuration.
* The route uses the existing `createArcAgentnetClient` configuration and backend-forced production `ANALYZE_SPEC_ID` behavior.

### Request and callback protection

* Use Zod strict schemas for browser requests and explicit payload construction.
* Scope idempotency to authenticated user, Company, template selection, and target. Reject conflicting reuse.
* Use cryptographically strong opaque IDs for browser-visible local run identifiers where the existing numeric application run contract permits. Never expose partner IDs as authorization tokens.
* Keep `Cache-Control: no-store` on submit, status, callback, and result responses.
* Preserve `redirect: error` and HTTPS-only base URL normalization from the existing client.
* Enforce the fixed callback host allowlist and five-minute timestamp window.
* Compare callback HMAC values with a timing-safe comparison.
* Persist callback event ID, payload hash, request ID, and expiry to prevent replay and event substitution.
* Redact raw partner payloads, signatures, and callback bodies from application logs. Log only local run ID, safe status, byte count, and correlation identifiers that are not secrets.

### Abuse and availability limits

* Enforce 30 submits per minute, 300 polls per minute, 5 active jobs, and 500 jobs per day at the 360 boundary.
* Apply a bounded request timeout and bounded poll retry policy inherited from the existing partner client.
* Reject oversized instructions, checklists, profiles, evidence lists, and result projections before persistence or partner submission.
* Do not allow a failed callback or partner timeout to trigger unbounded automatic resubmission. A retry must reuse the same idempotency key or require an explicit new staff action.

## 9. Error and state mapping

The browser sees only the 360 local state model and safe reason copy. Partner-specific status text and HTTP bodies are never passed through.

| Arc-agentnet state or failure | Local state | Safe reason |
| --- | --- | --- |
| Accepted by partner, no work started | `queued` | `null` |
| Partner reports queued or running | `running` | `null` |
| Partner reports succeeded and projection validates | `completed` | `completed` |
| Partner reports failed | `failed` | `execution_failed` |
| Partner reports cancelled | `cancelled` | `cancelled` |
| Partner job returns 410 | `failed` | `job_expired` |
| HMAC failure or malformed callback | No local transition | `null`, callback error only |
| Callback result exceeds 5 MB | No local transition | `null`, callback error only |
| Callback job or request mismatch | No local transition | `null`, callback conflict only |
| Poll response is invalid | Preserve last known durable state or `failed` only after bounded policy | `status_unavailable` or `execution_failed` |
| Partner capacity quota reached | No job created | `rate_limited` |
| Local persistence fails | No successful launch response | `persistence_unavailable` |

The existing internal statuses and reasons remain unchanged. In particular, `pending_review`, `confirmed`, and `dismissed` continue to mean the existing internal review flow. Arc-agentnet must not silently route into or mutate that internal review behavior unless a later approved design explicitly adds a reviewed result workflow.

## 10. Acceptance test matrix

### UI and selection

| ID | Test | Expected result |
| --- | --- | --- |
| UI-01 | Open Company Analysis as staff | Existing Practice Area, Buying Signal Category, and fixed/custom template selectors load as before. |
| UI-02 | Inspect target selector | Exactly `360 internal` and `Arc-agentnet` are available, with no default dedicated partner template. |
| UI-03 | Open Persona Analysis | No execution-target selector appears and no Arc-agentnet request can be produced. |
| UI-04 | Change template after choosing Arc-agentnet | Preview reloads and the transport target remains Arc-agentnet. |
| UI-05 | Change execution target after preview | Preview invalidates and reloads; the old preview cannot be submitted. |
| UI-06 | Submit without a valid preview | Start is disabled and no submit request is sent. |

### Server contracts and payload

| ID | Test | Expected result |
| --- | --- | --- |
| API-01 | POST Arc-agentnet route without Clerk staff access | Auth failure; no partner call. |
| API-02 | POST with Persona subject | HTTP 400 `invalid_input`; no partner call. |
| API-03 | POST with invalid or inactive template identity | Safe 404 or 409 error; no partner call. |
| API-04 | POST valid Company selection | HTTP 201 returns local `applicationRunId`; partner receives one bounded payload. |
| API-05 | Inspect partner payload | It contains Company profile and domain, Practice Area, Buying Signal Category, selected template metadata, resolved instructions, checklist, and public evidence URLs, with no secret or unallowlisted field. |
| API-06 | Submit same scoped idempotency key twice | One partner job and one local run; second response replays the original run. |
| API-07 | Reuse idempotency key with different payload | HTTP 409 `idempotency_conflict`; no second job. |
| API-08 | Exceed 1 MB request or field bounds | Request rejected before partner submission. |
| API-09 | Exceed active-job, minute, or daily quota | Safe capacity or rate-limit response; no partner submission. |

### Polling and callbacks

| ID | Test | Expected result |
| --- | --- | --- |
| FLOW-01 | Poll queued then running then succeeded | Local status progresses to `completed`; browser stops polling. |
| FLOW-02 | Receive valid succeeded callback before poll | Durable mapping and local projection update; next poll returns the same terminal state. |
| FLOW-03 | Receive identical callback twice | First is accepted, second is replayed, and state changes once. |
| FLOW-04 | Receive same event ID with changed body | HTTP 409 conflict and no state overwrite. |
| FLOW-05 | Receive invalid host, timestamp, signature, or event ID | HTTP 404 or 401 per existing mapping and no persistence. |
| FLOW-06 | Receive callback with result over 5 MB | HTTP 413 and no persistence. |
| FLOW-07 | Receive unknown job or request mismatch | HTTP 404 or 409 and no local transition. |
| FLOW-08 | Partner poll returns 410 | Local run becomes failed with safe `job_expired`; raw partner body is hidden. |
| FLOW-09 | Partner poll is unavailable | Last safe durable state is used only under the bounded freshness policy; otherwise status is unavailable, never falsely successful. |
| FLOW-10 | Close launcher during polling | Abort signal stops browser polling without a state mutation or unhandled rejection. |

### Security and regression

| ID | Test | Expected result |
| --- | --- | --- |
| SEC-01 | Inspect browser network and bundle output | No partner key, webhook secret, partner URL, callback signature, or `ADMIN_API_KEY`. |
| SEC-02 | Send caller-supplied callback host, spec ID, or partner headers | Fields are rejected or ignored; server uses fixed configuration. |
| SEC-03 | Request Arc-agentnet status with another user's local run ID | Authorization and safe not-found behavior prevent disclosure. |
| REG-01 | Launch existing `360 internal` Company Analysis | Existing `/api/analysis-runs` behavior, debug preference routing, snapshots, workflow dispatch, and internal polling remain unchanged. |
| REG-02 | Launch existing Persona Analysis | Existing internal behavior remains unchanged. |
| REG-03 | Run current Analysis Launcher and partner bridge test suites | Existing tests pass without weakening assertions around internal runs, HMAC, host allowlist, idempotency, or durable callbacks. |

## 11. Feature flag and rollout strategy

The target is protected by a server-evaluated feature flag, `COMPANY_ANALYSIS_ARC_AGENTNET_ENABLED`, defaulting to disabled. The flag is checked on options and submit routes, not only in the browser. When disabled:

* The target selector is omitted from the Company launcher.
* Arc-agentnet submit requests return 404 or a safe `execution_target_unavailable` response without contacting the partner.
* Existing internal and Persona flows behave exactly as before.

Rollout sequence:

1. Ship server contracts, persistence mapping, bounded payload builder, status projection, and tests with the flag disabled.
2. Enable in staging only, using the confirmed staging callback host and a controlled staff allowlist. Verify submit, poll, callback, replay, conflict, quota, and no-store behavior.
3. Enable for one production staff cohort. Monitor submit counts, active jobs, callback acceptance, replay conflicts, poll errors, result sizes, and internal-run regression signals. Logs contain local correlation IDs only.
4. Expand to all staff after the acceptance matrix passes in staging and the cohort shows no internal-path regression.
5. Disable the flag as the first rollback action. Existing internal analysis remains available. Partner jobs already submitted continue to be reconciled by polling and callback handling, or are safely marked failed after the bounded expiry policy.

The feature flag must not change the existing bridge host allowlist, HMAC scheme, partner endpoints, backend-forced `ANALYZE_SPEC_ID`, or internal analysis route behavior.

## 12. Implementation sequencing

1. Add the execution-target domain contract and Company-only validation, without changing the existing internal payload contract.
2. Add durable local execution-target and partner-run relation fields using the existing database query and migration conventions. Preserve all existing internal rows and transitions.
3. Implement the server-side bounded payload builder from resolved Company, Practice Area, category, selected template/custom version, checklist, and public evidence data.
4. Implement the server-only Arc-agentnet submit route with Clerk staff auth, scoped idempotency, quota checks, durable mapping, and the existing `createArcAgentnetClient` submit method.
5. Implement the Arc-agentnet status route and authoritative poll reconciliation with safe result projection and no-store responses.
6. Connect the existing callback route and durable callback store to the local Arc-agentnet run projection without changing HMAC, host, replay, or partner endpoint contracts.
7. Extend `analysisLauncherClient.ts` and `AnalysisLauncher.tsx` with the separate Company-only execution-target selector and target-specific polling branch. Keep the existing internal branch intact.
8. Add unit, route, integration, and end-to-end tests from the acceptance matrix, including regression tests for existing internal and Persona behavior.
9. Run the feature-flagged staging rollout, inspect security and quota telemetry, then enable production progressively.

Completion means the document's contracts above are implemented without changes to the existing internal analysis behavior or the confirmed 360 Partner Bridge contract.
