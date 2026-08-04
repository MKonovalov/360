---
phase: 24
reviewers: [codex]
reviewed_at: 2026-08-04T09:03:35Z
plans_reviewed:
  - 24-01-PLAN.md
  - 24-02-PLAN.md
  - 24-03-PLAN.md
  - 24-04-PLAN.md
note: Only one external reviewer ran. Claude was skipped for independence (this session is Claude Code); no other CLI (gemini/coderabbit/opencode/qwen/cursor) or local model server was detected on this machine. 24-01/24-02 are already executed (SUMMARY.md exists) — feedback there is retrospective. 24-03/24-04 are not yet executed — feedback on those can still change what gets built.
---

# Cross-AI Plan Review — Phase 24

## Codex Review

# Summary

The plans are well-structured and reflect the locked Phase 24 decisions, especially around provider grouping, strict roster verification, deduplication ownership, and snapshot canaries. However, overall execution risk is high: the required OpenCode Go roster is known not to match the installed CLI, and the plans do not provide a deterministic completion path if upgrading fails. The generator also lacks automated tests and robust validation for malformed successful responses, so Plans 03–04 mainly validate the committed artifact rather than proving the refresh pipeline is correct.

# Strengths

- Correct dependency order: schema migration, script extension, regeneration, then canary re-locking.
- Clear scope boundaries. Runtime provider instantiation and Settings UI are correctly deferred.
- Strong decisions around:
  - grouped snapshot ownership;
  - Zen-wins deduplication in `catalog.ts`;
  - raw `~latest` IDs;
  - pricing conversion;
  - strict drift failure before writing.
- Good canary intent:
  - explicit post-refresh counts;
  - Hermes pricing and capability checks;
  - alias self-exclusion;
  - fixture and committed-snapshot coverage.
- Security boundaries are appropriate: network/CLI code remains under `scripts/`, with no secrets or runtime fetches.
- Human checkpoints are placed around the two genuinely uncertain areas: CLI/live roster parity and canary-number review.

# Concerns

- **HIGH — The critical OpenCode CLI blocker remains unresolved.** Research shows CLI v1.18.11 exposes 18 Go models while the live endpoint exposes 25, and the researched npm latest is already v1.18.11. `opencode upgrade` may produce no change. Plans 03 and 04 cannot complete if parity remains unavailable; escalation is acknowledged but there is no executable fallback that still satisfies strict D-24-07.

- **HIGH — The refresh script has no automated test harness.** `fetchNousRoster`, `perMTok`, `deriveNousFamily`, `nousPreMap`, grouped writing, and strict drift comparison are validated only through live manual execution. The Phase 24 canaries inspect `catalog.json`; they do not prove that the generator produced it correctly.

- **HIGH — Successful but malformed HTTP responses are not rejected robustly.** The planned/current patterns cast untrusted JSON directly:
  - `body.data` is assumed to be an array;
  - rows are assumed non-null objects;
  - `supported_parameters` is assumed to be an array;
  - nested pricing and provider fields are not type-validated.

  A malformed response can either throw with an opaque error or, worse, produce rows with invalid types/defaulted values. This weakens the stated throws-not-degrades contract.

- **HIGH — Plan 02 includes unsafe restoration with `git checkout -- src/lib/models/catalog.json`.** That can destroy unrelated user changes. The plan should preserve and restore using a temporary copy or verified content hash, never a broad checkout.

- **MEDIUM — "Atomic" writing is not actually atomic.** `writeFileSync` after validation prevents writes on fetch failure, but a process crash during the write can leave a truncated JSON file. Use a temporary file in the same directory followed by rename.

- **MEDIUM — Drift diagnostics are order-dependent.** `missing` and `extra` are built from remote and CLI ordering, while acceptance criteria expect an exact message list. Sort both lists before reporting and assert set equality independently of ordering.

- **MEDIUM — Nous row count and shape are not validated before writing.** An HTTP 200 with an empty or partial `data` array can generate a snapshot with zero or incomplete Nous rows. Plan 03 catches this after the file has already been written, rather than making the refresh fail closed.

- **MEDIUM — Existing CLI parse tolerance can silently drop unrelated providers.** `parseModels` skips malformed blocks, and the plan does not add provider-count or total-row invariants for Anthropic, OpenRouter, Kilo, Vercel, Google, and OpenAI. The new structural checks focus mainly on Nous, Zen, and Go.

- **MEDIUM — Verification stops short of a production build.** `tsc` and Vitest are useful, but the grouped JSON shape is consumed by Next.js bundling and server components. `npm run build` should be part of the final gate.

- **MEDIUM — The canary re-lock remains manually copied from the generated snapshot.** This is required by D-24-11, but without independent fixture-based generator tests, a bad generator and its matching re-locked constants could be accepted together.

- **LOW — `getAllModels()` repeatedly allocates flattened arrays.** Registry operations can flatten the 1,400+ row catalog multiple times per lookup. This is unlikely to be a blocker, but a cached flatten or provider-scoped access would reduce unnecessary allocations.

# Suggestions

- Treat CLI/live Go parity as a precondition before executing Plan 03. If the upgraded CLI does not produce the exact live ID set, stop and obtain an explicit decision rather than continuing with a knowingly incomplete phase.

- Add a small testable refresh module with injected `fetch` and CLI data. Cover:
  - pricing conversion;
  - family derivation, including aliases;
  - Nous row mapping;
  - malformed response rejection;
  - Zen/Go set comparison;
  - grouped output generation;
  - no-write behavior on failure.

- Validate external JSON explicitly before mapping:
  - `Array.isArray(body.data)`;
  - every row is a non-null object with a string `id`;
  - pricing fields are finite numeric strings when present;
  - nested arrays and objects have expected types;
  - Nous roster count is nonzero and, for this locked phase, exactly 292.

- Add provider-preservation invariants before writing. Compare expected provider IDs and counts against the pre-refresh snapshot, allowing only the explicitly intended changes: Nous addition and OpenCode-Go refresh.

- Replace the destructive restore command with a temporary backup plus SHA-256 comparison, and ensure the script refuses to overwrite a changed working tree unless explicitly requested.

- Write the generated JSON to a temporary same-directory path, then rename it into place.

- Record the exact `opencode --version`, Zen/Go live counts, and sorted ID-set hashes in the phase summary for reproducibility.

- Add `npm run build` and the existing security-grep gate to Plan 04's final verification.

# Risk Assessment

**Overall risk: HIGH.**

The catalog migration itself is controlled and likely low risk. The main risks are phase completion depending on an unresolved external CLI/data-registry mismatch, lack of automated coverage for the generator, and insufficient validation of untrusted successful responses. Until those are addressed, the plans can produce a green test suite while still failing to regenerate the required 25-row Go roster or silently accepting malformed/incomplete source data.

---

## Consensus Summary

Only one external reviewer (Codex) ran this pass, so there is no cross-model agreement to synthesize — treat the findings below as a single independent opinion, not a consensus.

### Codex's Top Concerns (by severity)
1. **HIGH** — OpenCode CLI/live Go roster parity (18 vs. 25 models) has no executable fallback if `opencode upgrade` doesn't close the gap — Plans 03/04 could stall on an unresolved external blocker.
2. **HIGH** — No automated test harness for the refresh script's pure functions (pricing conversion, family derivation, Nous row mapping, drift comparison) — canaries validate the committed artifact, not the generator logic.
3. **HIGH** — Untrusted HTTP responses (Nous API) are cast without runtime shape validation — a malformed-but-200 response could silently write bad data instead of failing closed.
4. **HIGH** — Plan 02's `git checkout -- src/lib/models/catalog.json` restore pattern is destructive to any unrelated uncommitted changes in that file.

### To get a second opinion
No other CLI/local model server was available on this machine at review time. Install `gemini`, run an Ollama/LM Studio/llama.cpp server, or re-run once another CLI is available for a true multi-model consensus.
