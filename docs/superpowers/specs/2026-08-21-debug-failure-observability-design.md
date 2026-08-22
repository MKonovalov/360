# Debug Failure Observability

**Status:** Approved design specification
**Date:** 2026-08-21
**Scope:** Newly executed analysis attempts whose immutable run snapshot has `debugCaptureEnabled === true`

## 1. Summary

When a Debug-enabled analysis attempt fails, preserve the actual sanitized exception or error reason and the stage at which it failed. Store that bounded record in the existing ArcLumen failed-attempt debug artifact and mirror the same safe facts as structured metadata on the Langfuse `analyze-company` parent span.

This change replaces the current loss of diagnostic detail, where a failed parent span can contain only `{ schemaVersion: 1, status: "failed" }`, with a precise, privacy-safe explanation. It does not make ordinary runs verbose, does not expose raw exceptions to users, and does not capture private model reasoning.

The existing successful raw-capture policy remains unchanged. Successful Debug-enabled attempts continue to use the bounded, redacted artifact contract approved for all-attempt capture. This specification adds failure observability to failed attempts and does not expand successful capture beyond that policy.

## 2. Goals

1. Capture the actual failure stage for every Debug-enabled failed analysis attempt.
2. Preserve a bounded, redacted error record that explains the failure without storing unrestricted exception objects or provider responses.
3. Make the failed-attempt artifact and the Langfuse parent span agree on stage, safe message, and correlation identifiers.
4. Let a Debug admin inspect the failure through the existing private, no-store diagnostics route and viewer.
5. Keep the existing artifact redaction rules, collection limits, 256 KiB serialized artifact limit, and 14-day retention policy.
6. Keep ordinary runs and existing successful raw-capture behavior unchanged.
7. Make each boundary testable with deterministic failures and secret-bearing fixtures that prove sanitization.

## 3. Non-goals

1. Do not enable failure capture for runs where `debugCaptureEnabled !== true`.
2. Do not change the server-derived launch decision or immutable run snapshot semantics.
3. Do not capture or display prompts, system messages, developer messages, hidden chain-of-thought, private reasoning, credentials, headers, cookies, or unrestricted provider responses.
4. Do not promise that every internal value is observable. Only the explicitly allowlisted provider output and error projection is retained.
5. Do not change normalized result semantics, review decisions, candidate eligibility, ordinary run retention, or successful raw-capture policy.
6. Do not backfill existing runs or rewrite existing artifacts.
7. Do not send live secrets, private company data, or raw Langfuse payloads to tests, documentation, or logs.

## 4. Capture boundary and Debug gate

The capture decision is read from the persisted run snapshot. The failure observer must begin with this exact guard:

```text
if (run.executionSnapshot.debugCaptureEnabled !== true) {
  use the existing safe failure path without diagnostic error capture
}
```

The observer must not consult current environment configuration, current Clerk identity, client input, or mutable debug settings. A retry or detached Workflow invocation uses the same snapshot as the original run.

The observer is invoked at every failure boundary before the error is converted into a generic public failure reason. It receives the original caught value, the known run context, the current attempt number, and any provider or Langfuse correlation identifiers already available. If a lower layer already classified the failure, that classification is preserved. If an exception escapes without classification, the outer workflow boundary records `unknown`.

The observer must never cause a Debug failure to become a success. If diagnostic serialization, redaction, or Langfuse annotation fails, the workflow keeps the original failure outcome and records only the existing safe operational fallback. The database-authoritative failed-attempt write remains responsible for establishing terminal run state.

## 5. Failure stages

`failureStage` is a closed enum. The implementation must assign exactly one value to every captured failure.

| Stage | Boundary | Examples |
| --- | --- | --- |
| `provider` | Provider SDK or network boundary | HTTP failure, rate limit, billing rejection, provider timeout, provider service error, or an allowlisted provider error payload |
| `agent_step` | Agent orchestration or tool step boundary | Tool invocation exception, failed step transition, malformed tool result before domain validation |
| `validation` | Contract and input/output validation boundary | Zod contract failure, required field failure, invalid model selection, or rejected provider output shape |
| `normalization` | Grounded packet normalization boundary | `normalizeGroundedPacket` rejection or inability to build the canonical packet |
| `persistence` | Database and normalized-result persistence boundary | Packet insert failure, transaction failure, packet hash conflict, or failed raw-artifact persistence after the execution result is known |
| `workflow` | Workflow lifecycle and terminal-state boundary | Claim failure, retry exhaustion, state transition failure, cancellation race, or failure while reconciling an authoritative state |
| `unknown` | Final uncategorized boundary | Any error that escapes the classified boundaries without a more precise stage |

The stage describes where the application observed the failure, not a claim about the provider's internal cause. For example, a provider response that fails a local schema check is `validation`, while a provider HTTP 500 is `provider`.

## 6. Bounded error record

The existing `RawAttemptArtifact` gains a versioned, optional failure record. It is present only when `outcome` is `failed`. The artifact remains a closed schema validated by the existing raw-attempt parser.

```ts
type DebugFailureRecord = {
  schemaVersion: 1;
  failureStage: 'provider' | 'agent_step' | 'validation' | 'normalization'
    | 'persistence' | 'workflow' | 'unknown';
  errorName: string;
  errorMessage: string;
  stackExcerpt: string | null;
  providerPayload: RedactedBoundedText | null;
  correlation: {
    runId: number;
    traceId: string | null;
    observationId: string | null;
    parentObservationId: string | null;
  };
};
```

The concrete bounds are:

* `errorName`: trimmed UTF-8 text, maximum 160 characters.
* `errorMessage`: normalized single-line text, maximum 2,000 characters.
* `stackExcerpt`: optional normalized text, maximum 8,000 characters. Keep the first bounded portion, preserve line breaks only where useful, and mark truncation in the redacted value metadata.
* `providerPayload`: an optional redacted bounded text value, maximum 32 KiB before the overall artifact-size calculation. It is a projection of public provider response data, not `JSON.stringify(error)` or the complete response body.
* `runId`: the positive application run ID.
* `traceId`, `observationId`, and `parentObservationId`: nullable safe identifiers, each trimmed to the existing telemetry identifier limit of 200 characters. Invalid identifiers become `null`.

`errorName` and `errorMessage` are produced from the caught value using an explicit `Error` and structured-provider-error adapter. Unknown values become `UnknownError` with the safe message `Unrecognized failure` rather than being stringified indiscriminately. Messages and stack excerpts pass the existing text redaction rules before truncation. The record includes no `cause` object, request object, environment object, or arbitrary enumerable exception fields.

The artifact must retain the existing `schemaVersion`, `redactionVersion`, attempt, model, findings, citations, tool results, counts, byte counts, and truncation behavior. The new record participates in the existing 256 KiB serialized limit. If the combined artifact reaches that limit, provider payload is truncated first, then stack excerpt, then the existing bounded collections according to the current artifact truncation policy. The final artifact must never exceed 256 KiB.

## 7. Redaction and permitted content

Redaction is allowlist-first and uses the existing raw-attempt redaction implementation. A field is omitted or converted to metadata-only when it cannot be proven safe.

The following are always excluded or redacted:

* API keys, bearer tokens, JWTs, private keys, passwords, credentials, database URLs, session values, Clerk values, authorization fields, authentication headers, cookies, and signed URLs.
* Request headers, request bodies, prompt text, system instructions, developer instructions, hidden chain-of-thought, private reasoning, internal deliberation, and model scratchpad content.
* Raw exception causes, nested exception objects, arbitrary provider response fields, response headers, and unbounded response bodies.
* Email addresses, phone numbers, government identifiers, and other sensitive text detected by the existing redaction rules.
* URLs with credentials, non-public hosts, unsafe query keys, or unsafe fragments.

The provider payload projection may retain public company facts and provider output that is explicitly permitted by the provider adapter, after recursive key filtering, text redaction, URL redaction, and byte truncation. Public facts are not a blanket exemption: a fact containing a secret, personal data, private source content, or hidden reasoning is still removed. The record must preserve enough sanitized provider status information to identify a public error such as a rate limit or service-unavailable response, without retaining the raw response.

Hashes and original lengths may remain as diagnostic metadata for redacted values. They are not a substitute for removing the value itself.

## 8. Langfuse parent span metadata

For a Debug-enabled failed run, the `analyze-company` parent span created by `runWithPhase33Trace` is updated before the original error is rethrown or converted to the workflow failure result. The existing Langfuse privacy sanitizer remains in force.

The parent span receives a structured metadata object with this shape:

```ts
{
  schemaVersion: 1,
  debugFailure: {
    enabled: true,
    failureStage: 'provider' | 'agent_step' | 'validation' | 'normalization'
      | 'persistence' | 'workflow' | 'unknown',
    errorName: string,
    errorMessage: string,
    stackExcerpt: string | null,
    providerPayload: RedactedBoundedText | null,
    runId: number,
    traceId: string | null,
    observationId: string | null,
    parentObservationId: string | null,
  },
}
```

The same bounds and redaction rules apply to Langfuse metadata. The parent span status remains `ERROR`. Its status message is the bounded safe message, formatted as `Analysis failed during <failureStage>: <errorMessage>`, with no secrets or private reasoning. The metadata and status message are written only for Debug-enabled failures. Non-Debug failures retain the current generic output and do not receive this diagnostic record.

The span's existing model, token, duration, and fallback metadata remain available for model comparison. The new fields are additive and use stable names so comparisons can group by `failureStage`, `errorName`, provider, model, and redacted correlation IDs. Langfuse delivery is best effort and must be flushed using the existing telemetry lifecycle. A Langfuse outage must not alter the database failure artifact or terminal run state.

If a parent span or observation ID is unavailable, the field is `null`. The application `runId` is still required. The implementation must not invent IDs or use user email addresses as correlation identifiers.

## 9. ArcLumen artifact persistence and viewer

The existing failed-attempt persistence path remains the first durable destination. Its database-authoritative predicates, replay identity, payload hash, event idempotency, no-backfill behavior, 14-day TTL, and cleanup job remain unchanged. The new failure record is written inside the same bounded artifact that is persisted for the failed attempt.

The debug diagnostics API continues to require `requireDebugAdminAccess`, return `Cache-Control: private, no-store`, and project the closed schema rather than returning the database JSON blob verbatim. Its projected diagnostic adds:

* Failure stage.
* Error name and sanitized error message.
* A redacted or metadata-only stack excerpt, with truncation state.
* A redacted or metadata-only provider payload, with truncation state.
* Run, trace, observation, and parent observation correlation IDs.

The viewer adds a clearly labeled `Failure details` section near the existing lifecycle reason and raw-attempt panels. It shows the stage first, then the sanitized message, error name, stack excerpt state, provider payload state, and correlation IDs. It must show explicit `Redacted`, `Not recorded`, or `Truncated` states rather than implying that an omitted value was empty. It must not render hidden reasoning, prompts, raw response bodies, headers, cookies, or the database artifact wholesale.

Successful artifacts retain their current viewer and API behavior. No failure-only fields are fabricated for successful attempts.

## 10. Data flow

1. The launch path persists the immutable `debugCaptureEnabled` snapshot as it does today.
2. The analysis execution or workflow boundary catches an error while the original value and provider context are still available.
3. The boundary assigns one `failureStage` and passes the error through the shared failure normalizer.
4. The normalizer extracts bounded `errorName`, `errorMessage`, `stackExcerpt`, the allowlisted provider payload, and correlation IDs.
5. The normalizer applies existing redaction, URL checks, identifier checks, field allowlists, and size bounds. It excludes private chain-of-thought and private reasoning before serialization.
6. When `debugCaptureEnabled === true`, the workflow builds the failed-attempt artifact with the failure record and persists it through the existing authoritative failed-attempt operation.
7. The Langfuse parent span receives the same sanitized record as structured metadata and a bounded status message. The original failure still drives the `ERROR` status.
8. The debug route reads the artifact, parses the versioned schema, projects only approved fields, and returns it to an authorized Debug admin with no-store headers.
9. The viewer renders the projected record. Expired, missing, unauthorized, or malformed records follow the existing unavailable or not-found behavior without revealing prior artifact existence.

## 11. Testing requirements

### 11.1 Failure boundary coverage

Use deterministic fakes to force one failure at each boundary and assert that the captured record contains the expected stage:

* Provider failure produces `provider`.
* Agent tool or step failure produces `agent_step`.
* Contract or schema rejection produces `validation`.
* Grounded packet conversion failure produces `normalization`.
* Database or packet persistence failure produces `persistence`.
* Lifecycle, transition, retry, or reconciliation failure produces `workflow`.
* An uncategorized thrown value at the outer boundary produces `unknown`.

Each test verifies the sanitized error name, message, stack excerpt behavior, and `runId`. Where telemetry context exists, it also verifies `traceId`, `observationId`, and `parentObservationId`. Missing or malformed correlation IDs become `null`.

### 11.2 Redaction and bounds

Fixtures must include representative secret markers, but must use fake values such as `TEST_API_KEY_NOT_REAL`, never real credentials. Tests assert that API keys, auth headers, bearer tokens, cookies, credentials, signed URLs, prompts, private reasoning, and hidden chain-of-thought do not appear in the artifact or Langfuse metadata.

Tests also assert that public company facts and explicitly permitted provider output survive filtering, unsafe URLs become metadata-only, error fields truncate at their declared limits, collection limits remain unchanged, and the serialized artifact never exceeds 256 KiB.

### 11.3 Destination consistency

For each representative failure, compare the artifact record with the parent span metadata and assert matching stage, error name, sanitized message, and correlation IDs. The Langfuse status is `ERROR` and its status message is bounded. A Langfuse failure does not prevent failed-attempt persistence or change the terminal database state.

### 11.4 Debug gate and lifecycle

* A Debug-enabled failed run stores the error record in the existing failed-attempt artifact.
* A run with `debugCaptureEnabled === false` follows the existing safe failure path and stores no diagnostic error record.
* A client field or current configuration change cannot enable failure capture after launch.
* Duplicate workflow execution remains replay-safe and does not create duplicate artifacts or events.
* Existing failed artifacts without the new optional record continue to parse and render.
* Existing successful raw-capture tests and retention tests remain unchanged and pass.

### 11.5 Access and viewer

* An authorized Debug admin can view the new fields through the projected API response.
* Ordinary staff, anonymous users, and removed admins cannot infer artifact contents or existence.
* API responses include `private, no-store`.
* The viewer labels redacted, omitted, and truncated values clearly and never renders prohibited data.

## 12. Rollout and rollback

1. Deploy the schema and shared normalizer with diagnostic emission disabled in production by the existing Debug gate.
2. Run unit, workflow, telemetry, route, viewer, and disposable database tests with deterministic provider and boundary failures.
3. Enable Debug capture only for the approved Debug-admin configuration.
4. Trigger one controlled provider failure and one controlled validation or persistence failure. Verify the ArcLumen artifact, stage, message, stack handling, correlation IDs, and Langfuse parent span.
5. Monitor captured failure counts by stage, redaction decisions, truncation counts, artifact sizes, Langfuse annotation failures, and diagnostics access failures. Do not log raw error payloads.

Rollback first disables the Debug gate for new launches. Existing captured artifacts remain readable to Debug admins until the existing 14-day TTL expires. If application code is rolled back, the database must remain compatible with the existing failed-attempt artifact and writer. No rollback step deletes or rewrites artifacts, and no rollback step enables capture for ordinary runs.

## 13. Acceptance criteria

The design is implemented only when all of the following are true:

1. Failure diagnostics are captured only when `debugCaptureEnabled === true` in the immutable run snapshot.
2. Every captured failure has exactly one stage from `provider`, `agent_step`, `validation`, `normalization`, `persistence`, `workflow`, or `unknown`.
3. The existing failed-attempt artifact stores bounded `errorName`, `errorMessage`, stack excerpt, redacted provider payload, and run, trace, observation, and parent observation correlation IDs.
4. The overall artifact remains within the existing 256 KiB bound and 14-day retention policy.
5. Langfuse marks the Debug-enabled parent span `ERROR` and receives matching structured failure metadata plus a bounded status message.
6. API and viewer changes expose only the closed, redacted projection through the existing Debug-admin, private, no-store boundary.
7. API keys, auth headers, cookies, credentials, prompts, hidden chain-of-thought, private reasoning, raw exception causes, and unrestricted provider payloads never reach either destination.
8. Public company facts and explicitly permitted provider output remain available after filtering.
9. Tests force every failure boundary and verify stage, message, stack behavior, secret removal, bounds, and correlation IDs.
10. Successful raw capture, ordinary non-Debug failures, existing artifacts, retention, and terminal state authority remain unchanged.

## 14. Self-review checklist

* The Debug-only guard uses `debugCaptureEnabled === true` and does not depend on current auth or configuration.
* All seven failure stages are closed and defined.
* Both durable destinations are specified: the existing failed-attempt artifact and the Langfuse parent span.
* Error name, message, stack excerpt, provider payload, and correlation IDs have explicit bounds and null behavior.
* Redaction excludes credentials and private reasoning while permitting filtered public facts and provider output.
* Existing successful raw-capture policy, artifact size limit, collection limits, and retention are preserved.
* Viewer and API requirements do not expose the database blob or imply unrestricted observability.
* Each boundary has a deterministic test requirement.
* No real secrets, private data, live payloads, or unresolved placeholders appear in this specification.
