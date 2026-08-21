# Analysis Debug All-Attempt Capture

**Status:** Approved design specification  
**Date:** 2026-08-20  
**Scope:** Analysis runs launched after this change is enabled

## 1. Summary

Change analysis debug capture from failed-only capture to all-attempt capture for configured debug-admin launches.

When `ANALYSIS_DEBUG_CAPTURE_ENABLED=true`, a launch by a user whose Clerk ID is in `ANALYSIS_DEBUG_ADMIN_USER_IDS` snapshots `debugCaptureEnabled=true` into the new run. The snapshot causes a bounded, redacted artifact to be retained for every newly executed attempt, whether the attempt succeeds or fails. The artifact uses the existing redaction bounds, remains available only through the debug-admin surface with `Cache-Control: private, no-store`, and expires after 14 days.

Ordinary staff launches remain disabled. Existing runs are not changed or backfilled. Run 61 remains unchanged.

## 2. Goals

* Give allowlisted debug admins visibility into both successful and failed execution attempts.
* Make capture enablement a server-derived launch decision, not a client-controlled option.
* Preserve the immutable per-run snapshot so later configuration changes cannot change an already launched run.
* Preserve the current bounded artifact shape, redaction rules, admin-only access, no-store responses, and 14-day retention.
* Make success and failure artifacts obey one replay-safe, database-authoritative lifecycle.
* Keep the normal staff experience and non-debug runs unchanged.

## 3. Non-goals

* Do not capture attempts for ordinary staff or anonymous users.
* Do not enable capture on existing queued, running, completed, failed, cancelled, pending-review, confirmed, or dismissed runs.
* Do not backfill historical artifacts. Run 61 is explicitly excluded from migration and remains unchanged.
* Do not expand the artifact into a general provider trace, prompt store, credential store, log archive, or model reasoning store.
* Do not change normalized analysis result semantics, candidate eligibility, review decisions, or ordinary run retention.
* Do not add a client-side debug override or expose the admin allowlist to the browser.

## 4. Current behavior and required change

The current launch path accepts a server-provided `debugCaptureEnabled` value while stripping client keys named `debugCaptureEnabled` and `debugAdminUserIds` from the request body. The run snapshot stores the resulting flag in `executionSnapshot.debugCaptureEnabled`, and the workflow passes that snapshot to the execution adapter.

The current lifecycle only calls `captureAndFailAnalysisRawAttempt` on a debug-enabled failure. The raw-attempt input, artifact builder, persistence CTE, and database check are consequently failure-shaped:

* `rawAttempt.ts` accepts only `outcome: 'failed'`.
* The raw artifact requires failure stage and failure reason fields.
* `analysis_raw_attempt.status` defaults to and is constrained to `'failed'`.
* Capture persistence changes the authoritative run to `failed`.
* Capture observation treats any status other than `failed` as a conflict.
* The replay event key is specifically `running->failed`.

The implementation must replace these failure-only assumptions with a status-aware capture contract. It must not merely call the existing failed-only function for successful executions.

## 5. Server-derived enablement

The launch handler must derive the capture decision from server authentication and the parsed global configuration:

```text
captureForLaunch =
  debugAdminConfig.captureEnabled
  AND authenticatedUserId is present
  AND debugAdminConfig.adminUserIds contains authenticatedUserId
```

The route or server action must pass this derived boolean into snapshot construction. Client request fields remain ignored and stripped as defense in depth. A client cannot enable capture by sending either `debugCaptureEnabled` or `debugAdminUserIds`.

The global gate is fail closed. Invalid or incomplete configuration produces a disabled configuration. The allowlist is parsed and deduplicated on the server. Membership uses the authenticated Clerk user ID, not a display name, email address, or client-supplied value.

An allowlisted debug admin's normal launch is sufficient to enable capture. There is no separate launch checkbox or debug-only launch mode. A non-allowlisted staff member receives the same ordinary launch behavior as today, with `executionSnapshot.debugCaptureEnabled=false`.

## 6. Launch snapshot semantics

At run creation, snapshot the derived decision into the immutable execution snapshot. The snapshot is the sole authority used by detached workflow execution.

* A later environment change does not disable or enable capture for a run already created.
* A user removed from the allowlist does not change an existing captured run.
* A user added to the allowlist does not change an existing non-captured run.
* A global gate change does not change queued or running runs already created.
* Retries and workflow re-entry read the persisted run snapshot, never current environment variables or current auth state.

The run creator remains responsible for the snapshot. The workflow must not attempt to reconstruct launch authorization from workflow metadata, mutable settings, provider configuration, or client input.

## 7. Artifact contract

### 7.1 Common bounded artifact

Successful and failed artifacts use the same redaction version, schema versioning mechanism, size limit, collection limits, URL checks, hash metadata, and truncation behavior already defined for raw attempts. The artifact may contain only the explicitly allowlisted diagnostic projection:

* target type and attempt number
* bounded failure stage and safe failure reason when applicable
* bounded model provider and model ID when available
* bounded findings with IDs, signal IDs, status, confidence, redacted claim, and redacted reasoning summary
* bounded citations with finding ID, source ID, redacted URL, content hash, redacted locator, and support role
* bounded web-search tool results with source ID, redacted URL, content hash, redacted title, and redacted excerpt
* counts, serialized byte size, truncation state, schema version, and redaction version

The successful artifact is not a dump of the successful provider response. It is the same bounded diagnostic projection applied to the successful execution context. Successful artifacts do not include prompts, credentials, PII, chain-of-thought, raw stacks, or arbitrary provider fields. They must not include custom provider payloads, request headers, authorization material, hidden system or developer instructions, or unbounded workflow metadata.

For a success, the artifact records a success outcome and uses a nullable or explicitly absent failure stage and failure reason according to the versioned contract. The representation must be closed and schema validated, not an arbitrary JSON extension. For a failure, the existing safe failure reason and failure stage remain available.

### 7.2 Redaction and bounds

The existing redaction implementation remains the authority. It must be reused for both outcomes and not bypassed for successful data. In particular:

* Persona text and URLs remain metadata-only under the current persona rule.
* Sensitive text is replaced with a null value plus SHA-256, original length, and redaction reason.
* URLs must remain public HTTPS URLs without credentials or sensitive query and fragment fields, or become metadata-only.
* Email addresses, phone numbers, government identifiers, API keys, bearer tokens, JWTs, private keys, password-like fields, authorization fields, session and cookie material, and reasoning or system-message markers remain redacted.
* Collection limits and the 256 KiB serialized artifact limit remain enforced.
* Hashes and lengths may support diagnosis but are not a substitute for redaction.

Any new successful-input extractor must use an allowlist and the existing raw-attempt schemas. It must never serialize an entire execution, provider response, exception object, request, prompt, or workflow context.

## 8. Database schema and artifact union

The existing database model is failed-only and requires a status migration. The design requires a successful and failed union, not a second table and not a failed-only check left in place.

Required schema decisions:

1. Replace the `analysis_raw_attempt.status = 'failed'` check with a closed status set containing `success` and `failed`.
2. Make `safe_reason` nullable for successful rows. A successful attempt has no failure reason.
3. Make `failure_stage` nullable for successful rows. A successful attempt has no failure stage.
4. Migrate the replay key to `(analysis_run_id, attempt, status)`. This permits at most one artifact for each run attempt and outcome and prevents duplicate capture of the same outcome. The failure stage remains diagnostic data, not row identity.
5. Preserve payload hash, schema version, redaction version, captured timestamp, expiry timestamp, and artifact size checks.
6. Add database checks that ensure the row status agrees with the artifact outcome and that successful rows have null failure fields while failed rows have non-null failure fields.
7. Update query result types, diagnostic projection, and API schemas to accept the union while keeping the public response closed and redacted.

The migration must be additive and backward compatible with existing failed rows. Existing rows remain valid failed artifacts. No historical row is rewritten, and no new successful row is inserted for an old run.

## 9. Workflow timing and authority

### 9.1 Successful attempts

For a debug-enabled run that produces a normalized result:

1. Execute using the immutable run snapshot.
2. Build the bounded successful artifact from the allowlisted execution data.
3. Persist the normalized result and its packet hash using the existing normalized-result authority.
4. Capture the successful raw artifact with the same run ID, attempt, captured time, and 14-day expiry.
5. Complete or reconcile the run only through the existing authoritative state transition.

The successful capture must not become the authority for whether analysis succeeded. A capture insert or retry failure cannot convert a successful normalized run into a failed run. If artifact capture is temporarily unavailable after normalized persistence, the run remains successful and the system records a safe operational failure for retry or alerting according to the existing observability policy. Capture retries are bounded and idempotent.

The exact transaction boundary must ensure that the success artifact cannot be observed as a completed successful diagnostic while the normalized result is absent. A successful raw row is inserted only when the normalized result exists and its packet hash matches the execution being captured. If capture occurs before the completion transition, the database check still requires the normalized result and uses the packet hash as the race guard.

### 9.2 Failed attempts

For a debug-enabled failure, preserve the current state-establishing behavior, with the generalized status-aware capture operation:

* Capture and fail remain one authoritative operation where the failure is the terminal outcome.
* A failed row may be inserted only while the run is eligible and no normalized result has won the race.
* The operation transitions the run to `failed` and writes the corresponding event exactly once.
* If a normalized result already exists, the operation must return the existing normalized result outcome rather than overwrite it with failure.

### 9.3 Cancelled and stale outcomes

Cancellation and stale-run paths do not invent a success or failure artifact. If an execution produced an allowlisted diagnostic payload before cancellation, capture is permitted only when the outcome contract and authoritative database state identify a concrete attempt outcome. Otherwise the run remains governed by the existing cancellation or stale-state path.

## 10. Normalized authority, races, and idempotency

The normalized result remains authoritative for successful analysis. The design must explicitly handle these races:

* A success path persists a normalized result while a failure path tries to capture the same attempt. Packet hash comparison decides whether the failure is stale or conflicting.
* A duplicate workflow invocation retries a success capture. The same replay key and payload hash return `replayed`, not a second row.
* A duplicate workflow invocation retries a failed capture. Existing failed behavior remains replay-safe.
* A database response is lost after insertion. Reconciliation reads the authoritative row and returns `captured` or `replayed` based on the stored payload hash.
* A conflicting payload for the same run, attempt, and outcome fails closed with a payload conflict. It must not overwrite immutable history.
* A normalized result exists with a different packet hash. The system raises the existing packet conflict outcome and does not create a misleading failure artifact.
* A raw row exists but has expired. It is not treated as a valid replay. A retry waits for cleanup to delete the expired row before inserting a fresh row under the same replay identity, and returns a retryable or unavailable outcome before cleanup rather than treating the expired row as current.

All writes must use database-authoritative predicates and locks already used by the run outcome guard. Workflow metadata is never used as the source of truth for run status, packet identity, or capture authorization.

## 11. Diagnostics access and privacy

The existing debug-admin boundary remains mandatory for both outcomes:

* Page and API access require the current authenticated Clerk user to pass `requireDebugAdminAccess`.
* The global capture gate and allowlist remain required for access.
* Unauthorized or non-debug users receive the existing not-found behavior rather than artifact existence information.
* The diagnostics API remains dynamic, unrevalidated, and `Cache-Control: private, no-store`.
* Browser fetches continue to use `cache: 'no-store'`.
* Diagnostic projection exposes only the closed, redacted artifact fields. It must not return the database JSON blob verbatim.
* Expired or missing artifacts return the existing unavailable/not-found behavior without revealing whether an artifact once existed.

The 14-day TTL starts from `captured_at` for each artifact, with `expires_at` computed server side. The cleanup job continues deleting rows where `expires_at <= now`, in bounded batches. Cleanup must apply equally to successful and failed rows.

## 12. Migration

The migration must:

1. Alter the raw-attempt status constraint to the closed success and failure union.
2. Adjust nullable columns and outcome consistency checks as required by the new artifact contract.
3. Replace the replay key with `(analysis_run_id, attempt, status)` and retain indexes needed for run diagnostics and expiry cleanup.
4. Preserve all existing failed rows without rewriting their artifact JSON.
5. Preserve the expiry index and cleanup query behavior.
6. Avoid any backfill. Existing runs, including run 61, produce no new successful artifact because of this migration.
7. Verify that deployment can run while old application instances still write failed artifacts, if rolling deployment is supported. If compatibility cannot be guaranteed, gate the application rollout until the migration is complete.

No migration may read or modify `.env.local`, generated bundles, or unrelated application data.

## 13. Testing requirements

### Configuration and launch

* Global gate false, allowlisted user: snapshot is disabled.
* Global gate true, allowlisted user: ordinary launch snapshots capture enabled.
* Global gate true, ordinary staff user: snapshot is disabled.
* Invalid allowlist or gate input: configuration fails closed.
* Client sends `debugCaptureEnabled: true`: server-derived decision remains authoritative.
* Client sends `debugAdminUserIds`: the value is ignored and does not affect the snapshot.
* A configuration change after launch does not change the stored snapshot.

### Artifact contract and privacy

* A valid successful execution produces a success artifact with bounded findings, citations, and tool results.
* A failed execution produces the existing failed artifact shape under the generalized union.
* Successful artifacts reject or omit prompts, credentials, PII, chain-of-thought, raw stacks, arbitrary provider fields, headers, cookies, and provider payload extensions.
* Sensitive text, URLs, persona values, encoded secrets, and oversized collections use the existing redaction and truncation rules.
* Serialized artifacts never exceed 256 KiB.
* Schema and redaction version fields agree between row and artifact.

### Workflow and database races

* Successful capture occurs only with a matching normalized result and packet hash.
* Successful capture does not change a completed run to failed when capture storage is unavailable.
* Failed capture still establishes failure exactly once when no normalized result exists.
* A normalized result winning a failure race causes reconciliation to return the normalized result outcome.
* Duplicate success and failure calls return replay outcomes without duplicate rows or events.
* Lost insert responses reconcile to the stored row.
* Same replay identity with a different payload hash fails closed.
* Expired rows are excluded from diagnostics and are deleted by cleanup for both statuses.

### Access and retention

* Allowlisted debug admin can load both successful and failed diagnostics.
* Ordinary staff, anonymous users, and removed admins cannot load diagnostics.
* API responses include `private, no-store` and do not reveal expired artifact existence.
* A captured artifact is available before expiry and unavailable after expiry.

### Backward compatibility

* Existing failed rows parse and render unchanged.
* Existing non-debug runs do not gain capture.
* Run 61 remains unchanged and has no backfilled successful artifact.
* Existing ordinary launch, review, normalized result, and candidate flows pass without debug capture enabled.

## 14. Rollout and rollback

Roll out in this order:

1. Apply the backward-compatible database migration.
2. Deploy the generalized schemas, queries, diagnostics projection, and workflow support with the global gate still false.
3. Run unit, integration, and migration checks against a disposable database.
4. Set `ANALYSIS_DEBUG_CAPTURE_ENABLED=true` only after the allowlist and operational monitoring are confirmed.
5. Enable the gate for the intended debug-admin users and verify one successful and one failed launch.
6. Monitor artifact counts by status, capture failures, payload conflict events, cleanup counts, row sizes, and diagnostics access failures.

Rollback must first disable the global gate. New launches then snapshot capture disabled, while already captured runs remain readable until their TTL under the existing admin-only boundary. If application rollback is required, the database migration must remain compatible with the prior failed-only writer, or rollback must be coordinated with a database constraint rollback. No rollback step may delete or rewrite existing artifacts without an explicit retention decision.

## 15. Open operational prerequisites

These are prerequisites for implementation and rollout, not product behavior decisions:

* Confirm the production migration execution path and verify that the status constraint and replay identity can be changed without downtime.
* Confirm the scheduler invokes raw-attempt cleanup often enough to enforce the intended 14-day practical retention window.
* Confirm `ANALYSIS_DEBUG_ADMIN_USER_IDS` is populated only with approved Clerk IDs and is not exposed to client bundles or logs.
* Confirm monitoring and alerting for capture-unavailable, payload-conflict, schema-parse, and cleanup failures.
* Confirm the disposable `TEST_DATABASE_URL` and workflow test prerequisites are available for integration evidence.
* Confirm the debug-admin audit and incident-response owner for retained artifacts.
* Confirm that cleanup runs before any retry that needs to reuse a replay identity after expiry, and encode this ordering in the migration and tests.

## 16. Acceptance criteria

The design is implemented only when all of the following are true:

1. With the global gate true, an allowlisted admin's ordinary new launch stores `debugCaptureEnabled=true` from server-derived auth and config.
2. Ordinary staff launches store `debugCaptureEnabled=false` and cannot override it through request input.
3. Every newly launched debug-enabled run captures both successful and failed attempts using one closed, schema-validated artifact union.
4. Successful artifacts are explicitly bounded and redacted and contain none of the prohibited prompt, credential, PII, chain-of-thought, raw-stack, or arbitrary-provider data.
5. The database no longer enforces a failed-only raw-attempt status or failed-only capture identity.
6. Normalized result state remains authoritative in success and failure races, with packet-hash conflict detection and replay-safe idempotency.
7. Diagnostics remain admin-only, dynamic, private, and no-store.
8. Both statuses use the same 14-day TTL and cleanup path.
9. Existing runs are not backfilled or changed, and run 61 remains unchanged.
10. The concrete test cases in this specification pass, including migration, workflow race, privacy, access, and backward-compatibility coverage.

## 17. Self-review checklist

Before this specification is accepted for implementation planning, verify:

* No placeholder text remains.
* “Successful” and “failed” are used consistently with the proposed status union.
* The launch snapshot rule does not conflict with the admin-only access rule.
* Existing runs and run 61 are explicitly excluded from backfill.
* The database migration requirement is explicit and does not imply that the current failed-only check can remain.
* Successful capture cannot override normalized result authority.
* Privacy exclusions name prompts, credentials, PII, chain-of-thought, raw stacks, and arbitrary provider fields explicitly.
* Retention, no-store access, and cleanup apply to both outcomes.
* Open operational prerequisites are separated from product requirements.
* The document describes behavior and verification requirements only. It does not prescribe an implementation plan or modify product code.
