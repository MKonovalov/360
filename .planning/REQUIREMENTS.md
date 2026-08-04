# Requirements: ArcLumen 360 — v1.5 Additional AI Providers (NousResearch + OpenCode)

**Defined:** 2026-08-03
**Core Value:** Fast, shared ICP lookup — anyone on the team can pull up a company or persona and see a complete, trustworthy 360 view with buying signals in seconds.

## v1 Requirements

Requirements for milestone v1.5. Each maps to a roadmap phase.

### Provider Registry + Servable Model Sources

- [x] **REG-01**: User can select the AI Provider for their model configuration — Anthropic, OpenRouter (existing), **NousResearch** and **OpenCode** (new) — in the Settings AI Model Configuration card; `SERVABLE_PROVIDERS` grows to 4 and `providerName()` becomes a registry-driven map (no new hardcoded branch)
- [x] **REG-02**: `@ai-sdk/openai-compatible@^3.0.20` is installed; `NOUSRESEARCH_API_KEY` + `OPENCODE_API_KEY` declared in `env.ts` (optional, non-`PUBLIC_`, degrade-gracefully mirroring `OPENROUTER_API_KEY`), `.env.example`, and Vercel env
- [x] **REG-03**: OpenCode is ONE logical provider spanning two snapshot providerIDs (`opencode` = Zen, `opencode-go` = Go); servable set = the gated rows (chat-completions 30 + Claude 19 = 49 of 77), with dual-listed ids deduped by a deterministic Zen-wins rule (5 Go-exclusive ids keep their Go rows) locked by a no-flip canary
- [x] **REG-04**: NousResearch servable set = curated `PROVIDER_GATES.nousresearch` allowlist of native `nousresearch/*` ids (Hermes-4 pair today, ~2 rows) — NOT the full 292-row portal roster (OpenRouter mirror, mass collision)
- [x] **REG-05**: `getProviderForModelId` widens to the 4 logical providers with an EXPLICIT precedence order (nousresearch row wins over openrouter for the 2 shared hermes ids; opencode scope includes both `opencode` + `opencode-go` row ids); the anthropic default `claude-sonnet-4-6` keeps resolving to anthropic (priority-order regression lock); collision canary extended + passing
- [x] **REG-06**: `PROVIDER_DEFAULT_MODELS` gains `nousresearch` (Hermes-4 pair member) + `opencode` (pinned concrete id chosen in planning) reset-to-provider-default targets
- [x] **REG-07**: Union-wide save validation + staleness gate cover all 4 providers automatically (membership-based `saveSettingsAction` unchanged structurally); cross-provider chains spanning the new providers save and validate

### Refresh Script + Catalog Data

- [x] **CAT-01**: `scripts/refresh-model-catalog.ts` gains an anonymous `GET https://inference-api.nousresearch.com/v1/models` source (verified HTTP 200, 292 rows) mapping rows to `providerID: 'nousresearch'`, `api.url = https://inference-api.nousresearch.com/v1`, `api.npm = @ai-sdk/openai-compatible`
- [x] **CAT-02**: Nous `pricing.prompt/completion` converted per-token → per-MTok (×1e6) to match the snapshot's cost convention; `supported_parameters` live-joined to the `structuredOutputs` flag (mirroring the OpenRouter join, throws-not-degrades on failure)
- [x] **CAT-03**: Nous `family` derived from the id prefix (`nousresearch/hermes-4-*` → `hermes`); snapshot regenerated and committed with the new `nousresearch` rows + refreshed Go roster (17 → 25 live rows)
- [x] **CAT-04**: OpenCode Zen/Go roster-verify per the D-02 doctrine; the Zen-wins dual-listed-id dedup is expressed once (refresh script or `getServableIdsForProvider`) and survives regeneration

### Run Path / modelFactory Seam

- [x] **RUN-01**: `modelFactory` gains three module-scope `createOpenAICompatible` instances — `nousresearch` (baseURL `https://inference-api.nousresearch.com/v1`, key `NOUSRESEARCH_API_KEY`), `opencode-zen` (`https://opencode.ai/zen/v1`, key `OPENCODE_API_KEY`), `opencode-go` (`https://opencode.ai/zen/go/v1`, same key) — with `apiKey` passed EXPLICITLY (no SDK env auto-load); constraint 11 (modelFactory = only SDK-importing module) holds
- [x] **RUN-02**: `instantiateModel` dispatches OpenCode rows to the zen-vs-go instance by the matched row's `api.url` (Anti-Pattern 1 scoped-row find); the 19 Claude rows instantiate via the already-installed `@ai-sdk/anthropic` with a `createAnthropic({ baseURL: 'https://opencode.ai/zen/v1', apiKey })` override — zero new packages beyond openai-compatible
- [ ] **RUN-03**: Chain-aware env gate names the new keys — a resolved chain containing a nousresearch model requires `NOUSRESEARCH_API_KEY`; an opencode model requires `OPENCODE_API_KEY` (all-or-nothing, `missingProviderKey` names the exact key)
- [ ] **RUN-04**: `shouldAdvance` failover semantics extend to 4 providers — cross-provider 429 advances, same-provider never-advance preserved; OpenCode Zen↔Go is SAME-provider (one key, never advances on 429); 402 billing stays never-eligible
- [ ] **RUN-05**: `model_used`/`model_chain` audit records the served provider accurately for all 4 providers (OpenCode rows recorded by their bare id; provider derivation via the priority-ordered registry)
- [x] **RUN-06**: `supportsStructuredOutputs` starts FALSE on the new instances (safe `json_object` fallback + client-side validation) until a live key-backed probe proves `json_schema` acceptance at Zen/Go/Nous; per-provider flip only after verification

### Settings UI

- [ ] **SET-01**: AI Provider selector renders 4 always-valued entries (Anthropic, OpenRouter, NousResearch, OpenCode) in `SERVABLE_PROVIDERS` order
- [ ] **SET-02**: Selecting a provider refreshes the Primary model picker from that provider's servable source — opencode (49 rows incl. Claude rows), nousresearch (Hermes pair), anthropic (1), openrouter (336)
- [ ] **SET-03**: OpenCode rows render a `· Zen` / `· Go` endpoint caption (new derived `endpoint` field set at trim time from the matched row's providerID + `endpointLabel()` helper) in the same caption slot as suffix labels, in BOTH the provider-scoped primary and union fallback pickers
- [ ] **SET-04**: NousResearch Hermes rows render honest capability captions (chat/reasoning-tuned caveat, mirroring the `:free` fail-loud pattern) with per-MTok cost captions converted from the API's per-token pricing
- [ ] **SET-05**: Provider badges on picker rows + saved chain entries cover all 4 providers and disambiguate same-name models (hermes-4-70b via nousresearch vs openrouter; claude rows via opencode vs anthropic)
- [ ] **SET-06**: Union fallback pickers group by all 4 providers with correct badges; save/staleness verified end-to-end against 4-provider chains

### Verification Gate

- [ ] **VER-01**: Vitest collision matrix widened to 4 providers — same-name ids map to the correct provider (`claude-sonnet-4-6` → anthropic NOT opencode; `nousresearch/hermes-4-70b` → nousresearch NOT openrouter; opencode dual-listed ids resolve once, no endpoint flip), 4-provider 429 hop semantics
- [ ] **VER-02**: End-to-end UAT — save a NousResearch or OpenCode primary → Analyze on a company → `agent_run.model_used` matches the saved id
- [ ] **VER-03**: OpenCode-only chain runs with only `OPENCODE_API_KEY` set (no Anthropic/Nous key); NousResearch chain runs with only `NOUSRESEARCH_API_KEY`
- [ ] **VER-04**: Security-matrix grep extended — `NOUSRESEARCH`/`OPENCODE` absent from client components / Server Action returns / no `NEXT_PUBLIC_*` leakage; `SERVER_COMPONENT` exemption set covers `modelFactory.ts`'s explicit `process.env.*` reads; non-vacuous canary stays green
- [ ] **VER-05**: Live-browser UAT — 4-entry provider selector, Zen/Go endpoint captions, Hermes capability captions, badge disambiguation across 4 providers; live key-backed `json_schema` probe gates the `supportsStructuredOutputs` flip (RUN-06)

## v2 Requirements

Deferred to future releases. Tracked but not in the current roadmap.

- **OpenCode GPT-5 rows** (Responses API, 23 rows) + **Gemini rows** (5) — the non-chat-completions remainder of the opencode roster; deferred by the chat+Claude gate decision
- **Endpoint detail in the saved-chain recap** (`· Zen`/`· Go` on recap entries — caption-only once `endpoint` exists on `ServableModel`)
- **SCOP-01**: Saved/custom filter views and bulk seed-data editing UX (VIEW-01/02 from PROJECT.md Future Candidates)
- **PIPE-01/02**: Full scoring/prioritization algorithm over Company signals + prioritized target list output
- **PIPE-03/04**: CRM sync / outreach triggers (the pipeline's action stage)
- **ACCS-01**: Multi-user roles/permissions beyond "any authenticated Clerk user = staff"
- **ARCP-03**: AI-drafted, persona-tailored outreach content informed by Arcpedia

## Out of Scope

| Feature | Reason |
|---------|--------|
| OpenCode GPT-5 (Responses API) + Gemini rows in the servable set | Research-verified the 4-protocol split; chat+Claude gate (49 rows) is the milestone scope; Responses/Gemini need `@ai-sdk/openai`/`@ai-sdk/google` additions — deferred to v2 |
| Splitting OpenCode into two selector entries ("OpenCode Zen" / "OpenCode Go") | Milestone locks ONE OpenCode provider; both endpoints share `OPENCODE_API_KEY`; the `· Zen`/`· Go` caption gives staff the split without doubling the selector |
| Offering the full 292-row Nous portal roster | Portal is an OpenRouter mirror — nearly every id already exists as an openrouter row → mass union collisions + canary failure + silent provider swaps; curated `nousresearch/*` allowlist instead |
| Per-endpoint OpenCode keys (`OPENCODE_ZEN_API_KEY` + `OPENCODE_GO_API_KEY`) | PROJECT.md locked the 2-key decision; Zen + Go share one credential scope |
| Endpoint columns in `model_used`/`model_chain` audit | Audit contract stays provider-accurate; endpoint is recoverable from the catalog by id when needed |
| Excluding Hermes-4 from the Nous picker ("it's not agentic") | Milestone explicitly targets Hermes-family models; the chat-tuned caveat is informational, not prohibitive (fail-loud caption) |
| Live-fetching Nous/OpenCode rosters at runtime | Committed-snapshot discipline (v1.3 D-18-03); refresh is a dev-machine script act |
| BYOK per provider in Settings | Multi-tenant credential storage is a security program (v1.3/v1.4 anti-feature stays) |
| Auto-writing Analytic Agent proposals to the live Signal table | v1.1 contract — proposals stay in the review queue, staff-approved only |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| REG-01 | 23 | Complete |
| REG-02 | 23 | Complete |
| REG-03 | 23 | Complete |
| REG-04 | 23 | Complete |
| REG-05 | 23 | Complete |
| REG-06 | 23 | Complete |
| REG-07 | 23 | Complete |
| CAT-01 | 24 | Complete |
| CAT-02 | 24 | Complete |
| CAT-03 | 24 | Complete |
| CAT-04 | 24 | Complete |
| RUN-01 | 25 | Complete |
| RUN-02 | 25 | Complete |
| RUN-03 | 25 | Pending |
| RUN-04 | 25 | Pending |
| RUN-05 | 25 | Pending |
| RUN-06 | 25 | Complete |
| SET-01 | 26 | Pending |
| SET-02 | 26 | Pending |
| SET-03 | 26 | Pending |
| SET-04 | 26 | Pending |
| SET-05 | 26 | Pending |
| SET-06 | 26 | Pending |
| VER-01 | 27 | Pending |
| VER-02 | 27 | Pending |
| VER-03 | 27 | Pending |
| VER-04 | 27 | Pending |
| VER-05 | 27 | Pending |
