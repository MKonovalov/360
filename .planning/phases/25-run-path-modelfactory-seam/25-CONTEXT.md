# Phase 25: Run Path / modelFactory Seam - Context

**Gathered:** 2026-08-04
**Status:** Ready for planning

<domain>
## Phase Boundary

The Analytic Agent instantiates and runs cross-provider chains across all four providers safely, with provider-accurate audit and safe structured-output defaults. This phase delivers the modelFactory seam extensions (three `createOpenAICompatible` instances + two `createAnthropic` baseURL-override instances), the chain-aware env gate widened to 4 providers, the 4-provider shouldAdvance matrix (verify-only), and the `supportsStructuredOutputs` false-start on all new instances. It is NOT the Settings UI (Phase 26) and NOT the verification gate (Phase 27).

</domain>

<decisions>
## Implementation Decisions

### Anthropic-Instance Topology (RUN-02)
- **D-25-01:** Two module-scope `createAnthropic` instances serve the opencode Claude rows — `anthropicZen` (baseURL `https://opencode.ai/zen/v1`) and `anthropicGo` (baseURL `https://opencode.ai/zen/go/v1`) — BOTH with `apiKey: process.env.OPENCODE_API_KEY` passed EXPLICITLY. The existing `anthropic` instance (real Anthropic, `@ai-sdk/anthropic` default) stays untouched for the `anthropic` provider. Rationale: the regenerated snapshot has 20 anthropic-npm rows spanning BOTH endpoints (14 Zen: claude-* + qwen3.5-plus/qwen3.6-plus; 6 Go: minimax-m2.7/m3, qwen3.7-max/plus, qwen3.8-max, qwen3.6-plus dup) — a single `{baseURL: zen}` instance (research/RUN-02 literal) would 404/misroute the 6 Go rows. `@ai-sdk/anthropic` baseURL is a constructor option, NOT per-call — instance-per-endpoint is the only correct topology.
- **D-25-02:** `instantiateModel` dispatches opencode rows by the matched row's `api.url` (Anti-Pattern 1 scoped-row find on providerID 'opencode'/'opencode-go', never a bare id find): `api.url === 'https://opencode.ai/zen/v1'` → zen instance; `=== 'https://opencode.ai/zen/go/v1'` → go instance. Dispatch order: anthropic → openrouter → nousresearch → opencode (zen/go by url, npm @ai-sdk/anthropic → anthropicZen/Go, npm @ai-sdk/openai-compatible → openaiCompatibleZen/Go).

### Structured-Output Degrade Path (RUN-06)
- **D-25-03:** `supportsStructuredOutputs` is an INSTANCE-level flag on `createOpenAICompatible` (default **false** — no per-model equivalent; verified dist: with false, schema requests degrade to `response_format: {type: 'json_object'}` + warning, and `Output.object` still works via JSON mode + client-side parse/validate). Start all three openai-compatible instances with the flag UNSET (false). **ZERO changes to runAgent.ts** — the app's `Output.object({schema})` (runAgent.ts:74) keeps working unchanged. The live key-backed `json_schema` probe that would flip the flag is Phase 27 VER-05 (roadmap-locked) — NO probe work in Phase 25.

### shouldAdvance Matrix (RUN-04)
- **D-25-04:** RUN-04 is **verify-only — zero production code change.** `shouldAdvance`'s `from !== to` check already treats Zen↔Go as SAME-provider because `getProviderForModelId` returns the logical `opencode` for BOTH `opencode` and `opencode-go` snapshot rows (catalog.ts `SNAPSHOT_PROVIDER_IDS.opencode = ['opencode','opencode-go']`, verified). Cross-provider 429 advances; same-provider never-advance preserved; 402 billing stays never-eligible (`isFailoverEligible` false); 404/5xx/connection stay provider-agnostic advance. Deliverable = extend the 4-cell matrix tests to cover nousresearch + opencode chains (16-cell matrix), plus the collision canary widening if needed.

### Env-Gate Widening + Defaults (RUN-03)
- **D-25-05:** `missingProviderKey` widens to all 4 logical providers with zero special-casing — `getProviderForModelId` already collapses both snapshot ids to logical `opencode`, so the dual-id→single-key mapping (`opencode` + `opencode-go` → `OPENCODE_API_KEY`) is free. Extend the Set type filter to `p !== null` over all ModelProviderIds and add guard clauses: `nousresearch` → `NOUSRESEARCH_API_KEY`, `opencode` → `OPENCODE_API_KEY` (keep the existing anthropic/openrouter guards). Guard pattern preserved: `has(provider) && !key → return key`, first-hit wins, all-or-nothing at run entry.
- **D-25-06:** `defaultChain()` STAYS `[anthropic(FAST_MODEL_ID)]` — the D-11 doctrine is unchanged. `PROVIDER_DEFAULT_MODELS` (incl. `NOUSRESEARCH_DEFAULT_MODEL_ID`, `OPENCODE_DEFAULT_MODEL_ID`) remain Phase 26's provider-switch RESET targets, NOT the no-settings default. Zero behavior change.

### Claude's Discretion
- Instance naming details for the two openai-compatible instances (`openaiCompatibleZen`/`openaiCompatibleGo` or similar) beyond the anthropic pair — planner picks a consistent scheme; must mirror the anthropicZen/anthropicGo convention.
- Whether the opencode dispatch reads `api.url` per row via `getAllModels(catalogJson).find(m => m.id === id && (m.providerID === 'opencode' || m.providerID === 'opencode-go'))` or a helper — planner's call; Anti-Pattern 1 scoped-row find is mandatory.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked decisions + phase scope
- `.planning/ROADMAP.md` §Phase 25 — Goal, Requirements (RUN-01..06), Success Criteria. Read Phases 23, 24, 26, 27 too — Phase 25 is the instantiation seam between Phase 24's data and Phase 26/27's consumers.
- `.planning/REQUIREMENTS.md` §Run Path / modelFactory Seam — RUN-01..06 exact wording.

### Research (verified dist behavior — do not re-litigate)
- `.planning/research/SUMMARY.md` — v1.5 research: `@ai-sdk/openai-compatible@3.0.20` is the one new runtime dep, instantiated three times; `createAnthropic` baseURL/apiKey constructor options (l.11, l.34, l.79).
- `.planning/research/STACK.md` — §structuredOutputs D-08 note (l.121): openai-compatible has NO per-model structuredOutputs; provider-level `supportsStructuredOutputs` default false → `json_object` + warning (dist l.525/557); `Output.object` still works. §l.148: flip-to-true only after live key-backed verification. §l.192: packed dist sources (no env auto-load l.1746-1749, `name` required).

### Prior phase context (carry-forward)
- `.planning/phases/23-provider-registry-servable-sources/23-CONTEXT.md` — Phase 23 locked decisions: PROVIDER_PRECEDENCE, SNAPSHOT_PROVIDER_IDS, getProviderForModelId, PROVIDER_DEFAULT_MODELS, NOUSRESEARCH_ALLOWLIST, OPENCODE_NPM_GATE.
- `.planning/phases/24-refresh-script-catalog-data/24-CONTEXT.md` — Phase 24: grouped snapshot shape, getAllModels() helper, D-24-07 amendment (known Go drift), hermes structuredOutputs: false (live-verified).

### Codebase contracts
- `src/lib/agents/modelFactory.ts` — the seam being extended: existing openrouter instance pattern, instantiateModel/instantiateChain/defaultChain, PROVIDER_DEFAULT_MODELS.
- `src/lib/agents/modelConfig.ts` — shouldAdvance (l.100), isFailoverEligible (l.88), resolveModelChain (l.111) — RUN-04 verify-only target.
- `src/lib/agents/analyzeCompany.ts` — missingProviderKey (l.54), the chain-aware gate call site (l.91), analyzeCompany orchestration.
- `src/lib/agents/runAgent.ts` — the loop (l.52-114): Output.object at l.74, modelUsed/usedFallback audit, LOOP_BUDGET_MS 54s clamp.
- `src/lib/env.ts` — NOUSRESEARCH_API_KEY (l.47) + OPENCODE_API_KEY (l.54) already declared optional server-only.
- `src/lib/models/catalog.ts` — getAllModels, getProviderForModelId (l.174), SNAPSHOT_PROVIDER_IDS (l.108), dedupeProviderRows (l.130).
- `.planning/codebase/ARCHITECTURE.md` — constraint 11 (modelFactory = only SDK-importing module), Pattern 2 (catalog.ts mirrors catalog.json import), Pattern 4 (no mid-chain key checks).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/agents/modelFactory.ts` — the seam: existing `createOpenRouter` module-singleton pattern (l.17) is the template for the new instances; `instantiateModel` dispatch skeleton already handles anthropic + openrouter.
- `getProviderForModelId` (catalog.ts:174) — the logical-provider identity source; already collapses opencode+opencode-go → 'opencode' (D-25-04/05 depend on this).
- `getAllModels(catalogJson)` — the flattening helper for scoped-row finds (Anti-Pattern 1).
- `env.ts` — both new keys already declared optional (l.47, l.54) — no env schema change needed.

### Established Patterns
- Module-singleton instance pattern (ARCHITECTURE.md l.181, sanity-client pattern) — every provider instance is module-scope, created once.
- Constraint 11: modelFactory.ts is the ONLY SDK-importing module — all new instances live there, never imported elsewhere.
- `apiKey` passed EXPLICITLY (no SDK env auto-load — dist-verified l.1746-1749): the openrouter instance is the precedent (though it relies on env auto-load, the NEW instances must pass apiKey explicitly since openai-compatible does NOT auto-load).
- Anti-Pattern 1 scoped-row find — every row lookup is provider-scoped, never a bare id find.
- Throws-not-degrades / fail-loud / fail-closed: 402 billing never eligible, null provider identity fail-closes 429 advance.

### Integration Points
- `analyzeCompany.ts:91` — the missingProviderKey gate call site (widened to 4 providers).
- `runAgent.ts:106-110` — the advance decision (from/to logical identity — verify-only for RUN-04).
- `modelFactory.ts:57-80` — instantiateModel dispatch grows the opencode branches.
- `settings/page.tsx` — consumes PROVIDER_DEFAULT_MODELS (unchanged by this phase; Phase 26's reset logic reads it).
</code_context>

<specifics>
## Specific Ideas

No specific requirements — decisions are fully captured above. The user's key steer: correctness over research-literalism where the regenerated snapshot diverged from pre-Phase-24 research (the 20-row anthropic-npm set spanning both endpoints drove D-25-01's two-instance topology).

</specifics>

<deferred>
## Deferred Ideas

- Live key-backed `json_schema` probe at Zen/Go/Nous (gates the `supportsStructuredOutputs` flip) — Phase 27 VER-05, roadmap-locked (research SUMMARY l.55/68).
- Vercel env declaration of `NOUSRESEARCH_API_KEY` + `OPENCODE_API_KEY` — operator dashboard action, scheduled alongside Phase 25/27 (STATE.md Operator Next Steps).
- OpenCode GPT-5 (Responses API) + Gemini rows — v2 deferred (non-chat-completions).

</deferred>

---

*Phase: 25-Run Path / modelFactory Seam*
*Context gathered: 2026-08-04*
