# Task 2 findings

- Failed raw-attempt inputs now default `failure` to `null`, allowing strict parsing of legacy artifacts while making new artifacts deterministic.
- Artifact sizing clears `providerPayload`, then `stackExcerpt`, before trimming tool results, citations, and findings from the end; received-byte accounting remains based on the original UTF-8 input.
- Failure records reuse Task 1 normalization and redaction, so adversarial markers remain absent from serialized artifacts.

# Task 3 findings

- Langfuse failure annotations consume only the already-normalized immutable record; the optional `debugFailure` trace input is the Debug gate, so current settings are never re-read.
- The parent span receives the closed metadata envelope, `ERROR` level, and the shared bounded status message; annotation and processor flush failures remain best effort around the original analysis error.

# Task 4 findings

- `runAgent` reports each provider/agent-step attempt through a non-terminal observer; the grounded execution boundary normalizes only the final original error once, so fallback attempts remain replay-safe.
- Provider diagnostics pass only model provider and status code; request headers, bodies, response payloads, and raw causes stay outside the diagnostic context.
- Grounded failure diagnostics use the immutable execution snapshot for the Debug gate and correlation fields, while public `failureReason` mapping remains unchanged.

# Task 5 findings

- Local Zod v3/v4 contract and output-shape failures are wrapped at the validation seam, preserving the original error for bounded diagnostics while keeping public failure reasons stable and preventing provider misclassification.
- Normalization failures retain `AnalysisPacketValidationError` reasons and now carry a private `normalization` stage, including unexpected canonical packet construction errors.
- Execution failure context is held in a WeakMap, so later workflow observers can recover the original error and stage without adding raw failure fields to serialized success or failure JSON.

# Task 6 findings

- The lifecycle recovers the original execution error and classified stage from the execution-failure WeakMap, while explicit lifecycle failures retain their private error and immutable snapshot context without changing public safe reasons.
- The authoritative raw-attempt input carries the normalized failure record; the writer folds it into the existing artifact before hashing, so duplicate workflow replays retain one artifact and one event while payload conflicts remain detectable.
- Debug capture remains gated only by the snapshotted `debugCaptureEnabled` value. Disabled failures use the existing terminal transition path, and diagnostic or Langfuse errors cannot promote a failed database run to success.

# Task 7 findings

- The public failure DTO maps only the closed stage, bounded error text, redacted/truncated stack and provider metadata, and the four approved correlation IDs; `schemaVersion`, model identity, and arbitrary stored fields stay private.
- The shared redacted-value shape now accepts `metadata_only` for failure diagnostics while retaining `persona` for legacy raw fields. Missing failure fields normalize to `failure: null`; malformed stored artifacts use the existing no-store unavailable response.
- Database JSON remains `unknown` until the route applies strict `rawAttemptArtifactSchema` validation, keeping authorization first and preventing unapproved columns from crossing the API boundary.

# Task 8 findings

- The viewer consumes the closed `failure` projection directly and conditionally renders one semantic section before the raw-attempt panels; it performs no fetching, parsing, or field inference.
- Stack and provider payload values never render. Their bounded states are explicit: `Redacted` for redaction metadata, `Not recorded` for absent values, and `Truncated` when the projection marks a value truncated.
- Component coverage locks the complete failure view, null-failure compatibility, correlation IDs, and absence of forbidden payload markers.
