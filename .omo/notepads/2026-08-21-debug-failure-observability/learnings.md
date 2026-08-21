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
