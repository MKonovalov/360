# Debug Failure Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture a bounded, redacted failure record for each failed analysis whose immutable run snapshot has `debugCaptureEnabled === true`, persist it in the existing failed-attempt artifact, mirror it on the Langfuse `analyze-company` parent span, and expose only the closed Debug-admin projection.

**Architecture:** Add one shared failure contract and normalizer beside the existing raw-attempt contracts. Classified execution boundaries pass the original caught value, provider-safe context, and correlation IDs into that normalizer before converting the error to a public failure reason. The workflow remains authoritative for terminal database state, while the artifact writer and Langfuse adapter consume the same normalized record. The API and viewer read a versioned projection, never the database JSON blob.

**Tech Stack:** TypeScript, Next.js App Router, Zod 4, Vitest, Drizzle ORM with Neon Postgres, Workflow SDK, Vercel AI SDK, Langfuse OpenTelemetry and client integrations, React.

## Global Constraints

- Capture only when `run.executionSnapshot.debugCaptureEnabled === true`; use the immutable snapshot, never current configuration, client input, Clerk identity, or mutable settings.
- Keep `RawAttemptArtifact` schema version `1`, redaction version `1`, existing collection limits, the 256 KiB serialized artifact bound, and the 14-day retention and cleanup behavior.
- Add failure-only data; successful raw capture, ordinary failures, normalized result semantics, review decisions, candidate eligibility, and existing retention behavior stay unchanged.
- Use exactly one closed stage: `provider | agent_step | validation | normalization | persistence | workflow | unknown`.
- Never retain prompts, system or developer messages, hidden chain-of-thought, private reasoning, credentials, headers, cookies, request bodies, raw causes, arbitrary exception fields, or unrestricted provider responses.
- Use fake secret markers only in tests, such as `TEST_API_KEY_NOT_REAL`. Never place live secrets, private company data, or raw Langfuse payloads in tests, docs, or logs.
- `errorName` is trimmed UTF-8 text capped at 160 characters. `errorMessage` is normalized to one line and capped at 2,000 characters. `stackExcerpt` is nullable and capped at 8,000 characters. `providerPayload` is nullable redacted bounded text capped at 32 KiB before artifact-size calculation.
- Correlation identifiers are nullable, validated safe identifiers capped at 200 characters. `runId` is always the positive application run ID. Never invent IDs or use user email addresses.
- Diagnostic serialization, redaction, and Langfuse delivery are best effort. They must not turn a failure into success or replace the database-authoritative terminal-state write.
- Do not add visual companion work. Viewer changes are limited to rendering the approved backend projection and its explicit redaction states.
- Do not run a commit while executing this plan in the current task. Future implementation workers commit each focused task as specified below.

---

## File and Responsibility Map

The implementation should touch only the following responsibilities. Keep the existing large modules intact unless a helper extraction is required to keep a single concern testable.

| File | Responsibility in this plan |
| --- | --- |
| `src/lib/analysis/rawAttemptContracts.ts` | Define `FailureStage`, `RedactedBoundedText`, `DebugFailureRecord`, failure schema, and failure-specific limits inside the closed artifact schema. |
| `src/lib/analysis/rawAttemptRedaction.ts` | Reuse existing text and URL rules and add allowlist-first recursive provider projection plus bounded redacted text helpers. |
| `src/lib/analysis/failureDiagnostics.ts` | Normalize caught values, structured provider errors, stacks, and correlation context into one deterministic `DebugFailureRecord`; format Langfuse status text. |
| `src/lib/analysis/rawAttempt.ts` | Accept optional failure context in failed input, build the record into failed artifacts, and preserve the existing 256 KiB reduction order. |
| `src/lib/analysis/execution.ts` | Carry immutable debug and telemetry context through provider, agent, validation, and normalization failures without changing public failure reasons. |
| `src/lib/agents/runAgent.ts` and `src/lib/agents/analyzeCompany.ts` | Preserve provider and agent-step classification at the catch boundaries and expose safe provider context only through the shared adapter. |
| `src/lib/analysis/executionValidation.ts` | Mark contract rejection as `validation`, with deterministic test seams. |
| `src/lib/db/queries/analysisRawAttempts.ts` and `src/workflows/analysisRunLifecycle.ts` | Pass the normalized record to the existing authoritative failed-attempt write and classify persistence and workflow failures. |
| `src/lib/telemetry/langfuse.ts` | Add the structured failure annotation adapter to the active parent span, retain `ERROR`, set the bounded status message, and flush best effort. |
| `src/lib/analysis/debugDiagnostics.ts` and `src/app/api/debug/analysis-runs/[id]/route.ts` | Define and return the closed projection with failure details and correlation IDs. |
| `src/components/reviews/debug-analysis-run-view.tsx` | Render the failure details section with explicit `Redacted`, `Not recorded`, and `Truncated` states. |
| Existing tests beside each module, plus new `src/lib/analysis/failureDiagnostics.test.ts` | Lock contracts, redaction, bounds, every failure boundary, destination consistency, gate behavior, replay safety, access control, and viewer behavior. |

### Shared interfaces fixed before boundary wiring

Implement these exact names and shapes. Later tasks must not create alternate copies.

```ts
export const FAILURE_STAGES = [
  'provider', 'agent_step', 'validation', 'normalization',
  'persistence', 'workflow', 'unknown',
] as const;
export type FailureStage = (typeof FAILURE_STAGES)[number];

export type RedactedBoundedText = Readonly<{
  value: string | null;
  sha256: string;
  originalLength: number;
  redaction: 'none' | 'sensitive' | 'unsafe_url' | 'metadata_only';
  truncated: boolean;
}>;

export type DebugFailureRecord = Readonly<{
  schemaVersion: 1;
  failureStage: FailureStage;
  errorName: string;
  errorMessage: string;
  stackExcerpt: RedactedBoundedText | null;
  providerPayload: RedactedBoundedText | null;
  correlation: Readonly<{
    runId: number;
    traceId: string | null;
    observationId: string | null;
    parentObservationId: string | null;
  }>;
}>;

export type FailureDiagnosticContext = Readonly<{
  runId: number;
  traceId?: unknown;
  observationId?: unknown;
  parentObservationId?: unknown;
  providerPayload?: unknown;
}>;

export function normalizeDebugFailure(
  error: unknown,
  failureStage: FailureStage,
  context: FailureDiagnosticContext,
): DebugFailureRecord;

export function formatDebugFailureStatusMessage(record: DebugFailureRecord): string;

export type DebugFailureSpan = Readonly<{
  update: (input: Readonly<Record<string, unknown>>) => void;
}>;

export function annotateDebugFailure(span: DebugFailureSpan, record: DebugFailureRecord): void;
```

The approved spec's `stackExcerpt: string | null` is represented in storage as the same `RedactedBoundedText` metadata shape used for every bounded text value. The projected API exposes the complete metadata object, including `value`, `redaction`, and `truncated`, so omission is distinguishable from an empty string.

---

## Dependency Order

1. Contract and normalizer, because every boundary and destination consumes those exact types.
2. Redaction and artifact integration, because the database writer must accept a closed, bounded artifact before workflow wiring.
3. Langfuse adapter, because the execution seam needs a stable annotation callback and parent-span identifiers.
4. Execution and agent boundary classification, then workflow persistence wiring.
5. API projection and viewer rendering.
6. Cross-destination consistency, lifecycle, access, and rollout verification.

## Implementation Tasks

### Task 1: Define the closed failure contract and normalizer

**Files:**
- Modify: `src/lib/analysis/rawAttemptContracts.ts`
- Create: `src/lib/analysis/failureDiagnostics.ts`
- Test: `src/lib/analysis/failureDiagnostics.test.ts`
- Test: `src/lib/analysis/rawAttempt.test.ts`

**Interfaces:**
- Consumes: existing `redactRawAttemptText`, `redactRawAttemptUrl`, `telemetryIdentifierSchema`, and `RawAttemptArtifact` limits.
- Produces: `FailureStage`, `FAILURE_STAGES`, `RedactedBoundedText`, `DebugFailureRecord`, `FailureDiagnosticContext`, `normalizeDebugFailure`, `formatDebugFailureStatusMessage`.

- [x] **Step 1: Write failing contract and normalizer tests.** Assert that an `Error('provider unavailable')` with stage `provider` produces `errorName: 'Error'`, the one-line message, a redacted stack value, and the required `runId`. Assert that a structured provider error with an allowlisted status and public code retains only those fields. Assert that `Symbol('x')`, `null`, and an object with a throwing getter become `UnknownError` and `Unrecognized failure` without stringifying the object.
- [x] **Step 2: Run the focused tests.** Run `npx vitest run src/lib/analysis/failureDiagnostics.test.ts src/lib/analysis/rawAttempt.test.ts`. Expected failure: missing `failureDiagnostics` exports and missing failure fields in the raw artifact schema.
- [x] **Step 3: Implement the schemas and normalizer.** Add strict Zod schemas, constants for 160, 2,000, 8,000, 32 KiB, and 200 character bounds, safe identifier parsing, error-versus-structured-provider extraction, single-line message normalization, first-portion stack truncation, and allowlist-only provider projection. Use the existing redaction functions for text and URLs. Return `null` for invalid correlation identifiers.
- [x] **Step 4: Add exact redaction and bound tests.** Use fake markers for bearer tokens, API keys, cookies, credentials, signed URLs, prompts, private reasoning, and hidden chain-of-thought. Assert public company facts and explicitly allowlisted provider status survive, unsafe URLs become metadata-only, and all byte and character limits are enforced.
- [x] **Step 5: Run the focused tests.** Run the same Vitest command. Expected result: PASS, with no prohibited marker in `JSON.stringify(record)`.
- [x] **Step 6: Commit the contract only.** `git add src/lib/analysis/rawAttemptContracts.ts src/lib/analysis/failureDiagnostics.ts src/lib/analysis/failureDiagnostics.test.ts src/lib/analysis/rawAttempt.test.ts && git commit -m "feat: define debug failure diagnostics contract"`

### Task 2: Embed failure records in bounded raw-attempt artifacts

**Files:**
- Modify: `src/lib/analysis/rawAttempt.ts`
- Modify: `src/lib/analysis/rawAttemptContracts.ts`
- Test: `src/lib/analysis/rawAttempt.test.ts`
- Test: `src/lib/analysis/rawAttemptRedaction.adversarial.test.ts`

**Interfaces:**
- Consumes: `DebugFailureRecord` and `normalizeDebugFailure` from Task 1.
- Produces: `failedRawAttemptInputSchema` with optional `failure`, and `RawAttemptArtifact.failure: DebugFailureRecord | null` for failed artifacts. Successful input must continue to reject or omit failure data according to the existing success contract.

- [x] **Step 1: Write failing artifact tests.** Assert a failed input preserves the exact normalized record, an old artifact without `failure` parses as `failure: null` or the chosen backward-compatible optional representation, and a successful artifact has no fabricated failure record. Add a multibyte fixture that forces the complete artifact over 256 KiB and assert `bytes.serialized <= RAW_ATTEMPT_MAX_SERIALIZED_BYTES`.
- [x] **Step 2: Run the focused tests.** Run `npx vitest run src/lib/analysis/rawAttempt.test.ts src/lib/analysis/rawAttemptRedaction.adversarial.test.ts`. Expected failure: strict schema rejects the new field and the artifact builder does not account for failure bytes.
- [x] **Step 3: Implement the artifact field and reduction order.** Add the nullable versioned failure field to the strict schema and failed input. Build it before the existing collections. When oversized, reduce provider payload first, then stack excerpt, then existing bounded collections. Preserve the existing collection order and counts, `truncated` flag, received bytes, payload hashing, and successful artifact shape.
- [x] **Step 4: Run the focused tests.** Expected result: PASS, including parsing fixtures created before the new field and no successful-capture expansion.
- [x] **Step 5: Commit the artifact contract.** `git add src/lib/analysis/rawAttempt.ts src/lib/analysis/rawAttemptContracts.ts src/lib/analysis/rawAttempt.test.ts src/lib/analysis/rawAttemptRedaction.adversarial.test.ts && git commit -m "feat: store bounded failure records in artifacts"`

### Task 3: Add the Langfuse failure annotation adapter

**Files:**
- Modify: `src/lib/telemetry/langfuse.ts`
- Test: `src/lib/telemetry/langfuse.test.ts`
- Modify: `src/lib/analysis/failureDiagnostics.ts`
- Test: `src/lib/analysis/failureDiagnostics.test.ts`

**Interfaces:**
- Consumes: `DebugFailureRecord`, existing `runWithPhase33Trace`, `startActiveObservation`, and `flushLangfuse` lifecycle.
- Produces: `buildDebugFailureMetadata(record): { schemaVersion: 1; debugFailure: DebugFailureRecord & { enabled: true } }`, and `annotateDebugFailure(span, record): void` as the only adapter used by the active parent span.

- [x] **Step 1: Write failing telemetry tests.** Mock an active parent span and assert a Debug failure updates metadata with `{ schemaVersion: 1, debugFailure: { enabled: true, ...record } }`, updates the status to `ERROR`, and sets `statusMessage` to `Analysis failed during <stage>: <errorMessage>`. Assert no annotation occurs when the gate is false, and a rejected annotation or flush does not reject the original failure path.
- [x] **Step 2: Run the focused tests.** Run `npx vitest run src/lib/telemetry/langfuse.test.ts`. Expected failure: no failure metadata builder or span annotation exists, and the current catch writes only `{ schemaVersion: 1, status: 'failed' }`.
- [x] **Step 3: Implement the adapter.** Keep the existing privacy sanitizer, model, token, duration, and fallback metadata. Add the failure metadata only inside the Debug-enabled failure path. Do not call Langfuse in test mode. Flush through the existing processor lifecycle and swallow only telemetry delivery errors after the original error remains authoritative.
- [x] **Step 4: Run the focused tests.** Expected result: PASS, including a simulated Langfuse outage and exact status message bounds.
- [x] **Step 5: Commit the telemetry adapter.** `git add src/lib/telemetry/langfuse.ts src/lib/telemetry/langfuse.test.ts src/lib/analysis/failureDiagnostics.ts src/lib/analysis/failureDiagnostics.test.ts && git commit -m "feat: annotate debug failures in Langfuse"`

### Task 4: Wire provider and agent-step boundaries

**Files:**
- Modify: `src/lib/agents/runAgent.ts`
- Modify: `src/lib/agents/analyzeCompany.ts`
- Modify: `src/lib/analysis/execution.ts`
- Test: `src/lib/agents/runAgent.test.ts`
- Test: `src/lib/agents/analyzeCompany.test.ts`
- Test: `src/lib/analysis/execution.test.ts`

**Interfaces:**
- Consumes: `normalizeDebugFailure`, `FailureStage`, `FailureDiagnosticContext`, and the immutable `GroundedExecutionContext` snapshot.
- Produces: provider SDK or network exceptions classified as `provider`; tool invocation and step-transition exceptions classified as `agent_step`; provider context limited to the adapter's allowlisted payload shape; no changed public `GroundedExecutionFailure.failureReason` values.

- [x] **Step 1: Write deterministic boundary tests.** Inject a provider fake that throws an AI SDK API error with fake headers and payload, and assert the normalized record stage is `provider`. Inject a tool or step fake that throws, and assert `agent_step`. Assert fallback retries do not create a duplicate terminal capture and the final original error remains available to the outer boundary.
- [x] **Step 2: Run the focused tests.** Run `npx vitest run src/lib/agents/runAgent.test.ts src/lib/agents/analyzeCompany.test.ts src/lib/analysis/execution.test.ts`. Expected failure: no stage-bearing diagnostic is emitted and the tests cannot observe the original caught error at the required boundary.
- [x] **Step 3: Implement the narrow seams.** Preserve provider classification from `classifyModelError`, identify tool and step errors at the orchestration catch, pass only `providerPayload` fields accepted by the provider adapter, and attach `traceId` plus available observation IDs to `GroundedExecutionContext`. Do not read current debug settings and do not capture prompts.
- [x] **Step 4: Run the focused tests.** Expected result: PASS, with ordinary non-Debug execution returning the same public result and no diagnostic record.
- [x] **Step 5: Commit provider and agent wiring.** `git add src/lib/agents/runAgent.ts src/lib/agents/analyzeCompany.ts src/lib/analysis/execution.ts src/lib/agents/runAgent.test.ts src/lib/agents/analyzeCompany.test.ts src/lib/analysis/execution.test.ts && git commit -m "feat: classify provider and agent failures"`

### Task 5: Wire validation and normalization boundaries

**Files:**
- Modify: `src/lib/analysis/executionValidation.ts`
- Modify: `src/lib/analysis/execution.ts`
- Modify: `src/lib/analysis/results.ts`
- Test: `src/lib/analysis/executionValidation.test.ts`
- Test: `src/lib/analysis/execution.test.ts`
- Test: `src/lib/analysis/results.test.ts`

**Interfaces:**
- Consumes: `FailureStage` and `normalizeDebugFailure`.
- Produces: contract and output-shape failures tagged `validation`; `normalizeGroundedPacket` rejection or canonical packet construction failures tagged `normalization`; unchanged successful output and normalized result types.

- [x] **Step 1: Write failing tests.** Force Zod v3 and Zod v4 output rejection, invalid custom output, and unsafe tool policy to assert `validation`. Force `normalizeGroundedPacket` to throw and assert `normalization`. Verify a provider response that is syntactically valid but fails local schema is never tagged `provider`.
- [x] **Step 2: Run the focused tests.** Run `npx vitest run src/lib/analysis/executionValidation.test.ts src/lib/analysis/execution.test.ts src/lib/analysis/results.test.ts`. Expected failure: failures collapse into the existing generic reason without a stage or shared record.
- [x] **Step 3: Implement classification at observation points.** Keep `mapFailure` and public safe reasons stable, but retain a private classified failure context containing the original error and exact stage until the workflow observes it. Use `validation` for contract rejection and `normalization` for grounded packet conversion only.
- [x] **Step 4: Run the focused tests.** Expected result: PASS, including successful runs with no failure-only fields.
- [x] **Step 5: Commit validation and normalization wiring.** `git add src/lib/analysis/executionValidation.ts src/lib/analysis/execution.ts src/lib/analysis/results.ts src/lib/analysis/executionValidation.test.ts src/lib/analysis/execution.test.ts src/lib/analysis/results.test.ts && git commit -m "feat: classify validation and normalization failures"`

### Task 6: Wire persistence, workflow, gate, and replay behavior

**Files:**
- Modify: `src/workflows/analysisRunLifecycle.ts`
- Modify: `src/lib/db/queries/analysisRawAttempts.ts`
- Modify: `src/lib/db/queries/analysisRawAttemptPersistence.ts`
- Test: `src/lib/db/queries/analysisRawAttempts.test.ts`
- Test: `src/lib/db/queries/analysisRawAttempts.packetHash.test.ts`
- Test: `src/lib/db/queries/analysisRawAttempts.integration.test.ts`
- Test: `src/lib/db/queries/analysisRunTransitions.characterization.test.ts`

**Interfaces:**
- Consumes: `ExecutionFailure` extended with `error: unknown`, `failureStage: FailureStage`, `context`, and correlation IDs; `captureAndFailAnalysisRawAttempt` remains the authoritative writer.
- Produces: `CaptureFailedRawAttemptInput.failure: DebugFailureRecord | null`; persistence errors are staged `persistence`; lifecycle, transition, retry, cancellation, reconciliation, and uncategorized outer errors are staged `workflow` or `unknown`.

- [x] **Step 1: Write failing lifecycle and integration tests.** Cover all seven stages with deterministic fakes. Assert Debug-enabled runs persist one failure record, `debugCaptureEnabled === false` stores no diagnostic error record, a client field or current configuration cannot enable capture, duplicate workflow execution replays without duplicate artifact or event, and a Langfuse failure leaves the database run `failed`.
- [x] **Step 2: Run the focused unit tests.** Run `npx vitest run src/lib/db/queries/analysisRawAttempts.test.ts src/lib/db/queries/analysisRawAttempts.packetHash.test.ts src/lib/db/queries/analysisRunTransitions.characterization.test.ts`. Expected failure: the capture input has no failure record and the lifecycle only distinguishes `execution`, `normalization`, and `persistence`.
- [x] **Step 3: Implement the authoritative flow.** Start `failAnalysisRun` with the exact immutable snapshot guard. Normalize the original error before public reason conversion. Pass the same record to artifact capture and Langfuse annotation. Preserve retry and reconciliation predicates, event keys, payload hashes, terminal status authority, 14-day expiry, and no-backfill behavior. If diagnostic work fails, continue the existing safe fallback and never report success.
- [x] **Step 4: Run the disposable database tests.** Set `TEST_DATABASE_URL` to the disposable database and run `npm run test:integration:db -- src/lib/db/queries/analysisRawAttempts.integration.test.ts`. Expected result: PASS, including retention cleanup and replay identity.
- [x] **Step 5: Commit workflow and persistence wiring.** `git add src/workflows/analysisRunLifecycle.ts src/lib/db/queries/analysisRawAttempts.ts src/lib/db/queries/analysisRawAttemptPersistence.ts src/lib/db/queries/analysisRawAttempts.test.ts src/lib/db/queries/analysisRawAttempts.packetHash.test.ts src/lib/db/queries/analysisRawAttempts.integration.test.ts src/lib/db/queries/analysisRunTransitions.characterization.test.ts && git commit -m "feat: persist debug failure diagnostics"`

### Task 7: Add the closed API projection and compatibility behavior

**Files:**
- Modify: `src/lib/analysis/debugDiagnostics.ts`
- Modify: `src/app/api/debug/analysis-runs/[id]/route.ts`
- Modify: `src/lib/db/queries/analysisRawAttemptDiagnostics.ts`
- Test: `src/app/api/debug/analysis-runs/[id]/route.test.ts`
- Test: `src/lib/db/queries/analysisRawAttemptDiagnostics.test.ts`

**Interfaces:**
- Consumes: `RawAttemptArtifact.failure`, `DebugFailureRecord`, and existing `requireDebugAdminAccess` and no-store response helper.
- Produces: `DebugAnalysisRunDiagnostic.failure: { stage, errorName, errorMessage, stackExcerpt, providerPayload, correlation } | null`, with the same bounded redacted metadata and strict Zod validation. Old artifacts return `failure: null` and remain renderable.

- [x] **Step 1: Write failing route and query tests.** Assert the projection includes stage, sanitized message, error name, stack and provider payload redaction and truncation state, and all four correlation IDs. Assert old artifacts return `failure: null`, malformed failure records produce the existing safe unavailable behavior, denied users do not query raw data, and all 200, 400, and 404 responses include `Cache-Control: private, no-store`.
- [x] **Step 2: Run the focused tests.** Run `npx vitest run 'src/app/api/debug/analysis-runs/[id]/route.test.ts' src/lib/db/queries/analysisRawAttemptDiagnostics.test.ts`. Expected failure: schema and projection omit the failure record.
- [x] **Step 3: Implement the closed projection.** Parse the stored artifact with `rawAttemptArtifactSchema`, map only approved fields, do not return `modelId`, arbitrary provider data, raw JSON, exception causes, or database columns not already approved. Keep authorization before ID parsing and database access.
- [x] **Step 4: Run the focused tests.** Expected result: PASS, including no-store and no-existence-leak behavior.
- [x] **Step 5: Commit API projection.** `git add src/lib/analysis/debugDiagnostics.ts src/app/api/debug/analysis-runs/[id]/route.ts src/lib/db/queries/analysisRawAttemptDiagnostics.ts src/app/api/debug/analysis-runs/[id]/route.test.ts src/lib/db/queries/analysisRawAttemptDiagnostics.test.ts && git commit -m "feat: project debug failure details"`

### Task 8: Render the failure details viewer section

**Files:**
- Modify: `src/components/reviews/debug-analysis-run-view.tsx`
- Test: `src/components/reviews/debug-analysis-run.test.tsx`
- Test: `src/components/reviews/debug-analysis-run-view.test.tsx`

**Interfaces:**
- Consumes: `DebugAnalysisRunDiagnostic.failure` from Task 7.
- Produces: a `Failure details` section near lifecycle reason and raw-attempt panels that shows stage first, sanitized message, error name, stack state, provider payload state, and correlation IDs.

- [x] **Step 1: Write failing component tests.** Render a complete failure and assert visible stage, message, name, correlation IDs, and explicit labels for `Redacted`, `Not recorded`, and `Truncated`. Render `failure: null` and assert no failure-only section is fabricated. Assert forbidden prompt, reasoning, headers, cookies, and raw provider text never appear.
- [x] **Step 2: Run the focused tests.** Run `npx vitest run src/components/reviews/debug-analysis-run.test.tsx src/components/reviews/debug-analysis-run-view.test.tsx`. Expected failure: the view has no failure details section and no failure fixture type.
- [x] **Step 3: Implement the presentation only.** Add semantic headings and compact metadata rows. Treat `value: null` plus a redaction reason as `Redacted`, `null` without a redaction record as `Not recorded`, and `truncated: true` as `Truncated`. Do not add client fetching, artifact parsing, or new authorization logic.
- [x] **Step 4: Run the focused tests.** Expected result: PASS.
- [x] **Step 5: Commit the viewer projection.** `git add src/components/reviews/debug-analysis-run-view.tsx src/components/reviews/debug-analysis-run.test.tsx src/components/reviews/debug-analysis-run-view.test.tsx && git commit -m "feat: show debug failure details"`

### Task 9: Lock destination consistency and end-to-end boundary coverage

**Files:**
- Create: `src/lib/analysis/debugFailureConsistency.test.ts`
- Modify: `src/workflows/analysisRunLifecycle.ts`
- Modify: `src/lib/telemetry/langfuse.ts`
- Test: `src/lib/telemetry/langfuse.test.ts`
- Test: `src/lib/db/queries/analysisRawAttempts.integration.test.ts`

**Interfaces:**
- Consumes: the shared `DebugFailureRecord`, capture input, Langfuse metadata builder, and deterministic boundary fakes from Tasks 1 through 8.
- Produces: one table-driven contract test proving artifact and parent-span metadata match on stage, error name, sanitized message, and all correlation IDs.

- [x] **Step 1: Write the consistency test first.** For representative provider, agent step, validation, normalization, persistence, workflow, and unknown failures, call the same normalizer and feed its result to both destination adapters. Assert exact equality for the shared fields, Langfuse status `ERROR`, bounded status message, artifact size bound, and no prohibited marker in either serialized destination.
- [x] **Step 2: Run the focused consistency test.** Run `npx vitest run src/lib/analysis/debugFailureConsistency.test.ts`. Expected failure: the artifact and Langfuse destination adapters either lack the shared input or produce divergent shapes.
- [x] **Step 3: Implement only adapter corrections.** Route both destinations through the same immutable normalized object. Do not duplicate normalization logic. Ensure a simulated annotation exception is swallowed after the artifact write and terminal state remain successful from the database perspective.
- [x] **Step 4: Run the focused tests and integration case.** Run `npx vitest run src/lib/analysis/debugFailureConsistency.test.ts src/lib/telemetry/langfuse.test.ts src/lib/db/queries/analysisRawAttempts.integration.test.ts`. Expected result: PASS.
- [x] **Step 5: Commit consistency coverage.** `git add src/lib/analysis/debugFailureConsistency.test.ts src/workflows/analysisRunLifecycle.ts src/lib/telemetry/langfuse.ts src/lib/telemetry/langfuse.test.ts src/lib/db/queries/analysisRawAttempts.integration.test.ts && git commit -m "test: verify failure destination consistency"`

## Full Verification

Run these after all implementation tasks, with no live provider calls and a disposable database for integration tests:

```bash
npm run lint
npm test
npm run test:integration:db
npm run test:integration:analysis-reviews
npm run test:workflow:config
TEST_DATABASE_URL="$DISPOSABLE_TEST_DATABASE_URL" npm run test:workflow
npm run db:check
npm run db:validate
npm run build
```

Run targeted evidence commands as a final checklist:

```bash
npx vitest run \
  src/lib/analysis/failureDiagnostics.test.ts \
  src/lib/analysis/rawAttempt.test.ts \
  src/lib/telemetry/langfuse.test.ts \
  src/lib/analysis/execution.test.ts \
  src/lib/agents/runAgent.test.ts \
  src/app/api/debug/analysis-runs/[id]/route.test.ts \
  src/components/reviews/debug-analysis-run.test.tsx \
  src/components/reviews/debug-analysis-run-view.test.tsx \
  src/lib/analysis/debugFailureConsistency.test.ts
```

The final verification must demonstrate all of the following:

- Every captured record has exactly one of the seven closed stages.
- Provider, agent step, validation, normalization, persistence, workflow, and unknown deterministic failures each reach the expected stage.
- Error name, message, stack, provider payload, and identifiers obey their bounds and redaction rules.
- Public facts and explicitly permitted provider output survive filtering; unsafe URLs become metadata-only.
- No API key, auth header, cookie, credential, signed URL, prompt, hidden chain-of-thought, private reasoning, raw cause, or unrestricted provider response reaches either destination.
- Serialized artifacts never exceed 256 KiB, and existing collection limits, hashes, replay keys, event idempotency, cleanup, and 14-day TTL remain intact.
- Langfuse metadata and artifact fields match exactly, status remains `ERROR`, status message is bounded, and a Langfuse outage does not change database terminal state.
- Debug-disabled runs, successful runs, existing artifacts without failure data, ordinary non-Debug failures, and current access-control behavior remain unchanged.
- The API remains Debug-admin-only, private, and no-store. Missing, expired, unauthorized, and malformed records remain existence-safe.

## Rollout and Rollback Acceptance Checks

1. Deploy the shared schema and normalizer with no capture for ordinary runs. Confirm the immutable snapshot gate is the only emission gate.
2. Run the full unit, workflow, telemetry, route, viewer, and disposable database suites above with deterministic failures.
3. Enable the approved Debug-admin configuration only. Do not alter launch snapshot semantics.
4. Trigger one controlled provider failure and one controlled validation or persistence failure. Confirm artifact stage, safe message, stack truncation state, provider payload redaction, all correlation IDs, Langfuse parent `ERROR`, and the bounded status message.
5. Monitor counts by stage, redaction decision, truncation count, artifact size, Langfuse annotation failure, and diagnostics access failure. Metrics must not include raw error payloads.
6. For rollback, disable the Debug gate for new launches first. Leave existing artifacts readable until their existing 14-day TTL expires.
7. If application code is rolled back, keep the database compatible with the current failed-attempt artifact and writer. Do not delete or rewrite artifacts, backfill records, or enable capture for ordinary runs.

## Plan Self-Review

- Summary, goals, non-goals, gate, seven stages, bounded record, redaction, Langfuse metadata, artifact persistence, API, viewer, data flow, tests, rollout, rollback, and acceptance criteria are each covered by named tasks or final verification checks.
- All shared names used later are defined in the interface block or in the task that produces them.
- Every task includes exact files, a failing test, a failure command and expected failure, implementation steps, a passing command and expected result, and a focused commit.
- Existing successful capture and retention behavior is explicitly preserved in Tasks 2, 6, and Full Verification.
- No visual companion work, source implementation, migration, package change, or configuration change is included in this plan.
- The plan contains no unfinished markers or vague instructions.

## Append-only Review Findings

- F2 fixed: `analysisRun.ts` now preserves the adapter's normalized failure record and classified stage when crossing into the workflow failure boundary.
- F4 fixed: Debug-enabled execution supplies a failure factory to the active Langfuse parent observation; the factory normalizes once with the span trace ID, the exact record is annotated before rethrow, and the same record remains authoritative for artifact capture.
