# Task 2 findings

- Failed raw-attempt inputs now default `failure` to `null`, allowing strict parsing of legacy artifacts while making new artifacts deterministic.
- Artifact sizing clears `providerPayload`, then `stackExcerpt`, before trimming tool results, citations, and findings from the end; received-byte accounting remains based on the original UTF-8 input.
- Failure records reuse Task 1 normalization and redaction, so adversarial markers remain absent from serialized artifacts.
