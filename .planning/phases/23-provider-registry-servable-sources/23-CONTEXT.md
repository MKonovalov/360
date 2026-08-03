# Phase 23: Provider Registry + Servable Sources - Context

**Gathered:** 2026-08-03
**Status:** Ready for planning

<domain>
## Phase Boundary

The app recognizes all four AI providers — Anthropic (existing), OpenRouter (existing), NousResearch (new), OpenCode (new) — from the committed catalog. Phase 23 delivers the registry foundation: `ModelProviderId` grows to 4 with `PROVIDER_GATES`/`SERVABLE_PROVIDERS` extended (OpenCode = ONE logical provider spanning the `opencode` + `opencode-go` snapshot rows; NousResearch = curated Hermes-4 allowlist), `getProviderForModelId` becomes priority-ordered (anthropic → openrouter → nousresearch-over-openrouter → opencode) with extended canaries, `providerName()` goes registry-driven, `PROVIDER_DEFAULT_MODELS` gains nousresearch + opencode reset targets, the two new env keys are declared optional server-only, and union-wide save validation covers all 4 providers.

**What this phase is NOT:** no data (the `nousresearch` rows + refreshed Go roster land in Phase 24), no run-path/instantiation changes (Phase 25), no Settings UI (Phase 26), no verification gate (Phase 27). The `@ai-sdk/openai-compatible` installation is a Phase 25 concern — Phase 23 ships registry code only.

</domain>

<decisions>
## Implementation Decisions

### OpenCode Gate Mechanism (REG-03)
- **D-23-01:** The opencode servable gate is **data-driven by `api.npm`** — `PROVIDER_GATES.opencode` holds an allowlist of npm package values (`['@ai-sdk/openai-compatible', '@ai-sdk/anthropic']`), not a hardcoded 49-id list. The 49-row count (30 chat-completions + 19 Claude) falls out of the data; GPT-5 (`@ai-sdk/openai`) and Gemini (`@ai-sdk/google`) rows self-exclude forever. New chat/Claude models OpenCode adds become servable on refresh — matches the "snapshot is the menu, gate is the lock" + full-catalog openrouter precedent (D-02).
- **D-23-02:** A **count-stability canary** locks the CURRENT committed snapshot's opencode servable shape (49 rows: 30 chat + 19 Claude, 0 GPT/Gemini) so Phase 24's regeneration cannot silently change the servable set — drift fails loudly, then gets re-verified intentionally (D-02 roster-verify doctrine).

### OpenCode Default Primary (REG-06)
- **D-23-03:** `PROVIDER_DEFAULT_MODELS.opencode` = **`claude-sonnet-4-6`** (the opencode row, via the Phase-25 `createAnthropic({ baseURL })` Claude-extension path). Mirrors the D-07 sonnet-class philosophy — same id as the anthropic default, team-familiar, stable cost captions. Roster-verified against the CURRENT snapshot's opencode dual row (sorts first), so no Phase-24 data dependency.
- **D-23-04:** **Keep-if-valid accepted.** Because the opencode default id equals the anthropic default id, switching providers in the Phase 26 UI keeps `claude-sonnet-4-6` (valid in opencode's servable set) — the entry re-badges to opencode; the badge carries provider identity. No forced reset on provider switch.

### NousResearch Allowlist + Default (REG-04, REG-06)
- **D-23-05:** `PROVIDER_GATES.nousresearch` = concrete pins **`nousresearch/hermes-4-70b` + `nousresearch/hermes-4-405b`** (the Hermes-4 pair). No `~latest` aliases — D-07 "never `~`/`:free`/auto in pins" doctrine. The allowlist is CODE declared in Phase 23; the rows land in the snapshot in Phase 24 and must be roster-verified there (D-02 doctrine).
- **D-23-06:** `PROVIDER_DEFAULT_MODELS.nousresearch` = **`nousresearch/hermes-4-70b`** — sonnet-class cost philosophy (cheaper/faster workhorse). The 405b stays servable but is not the reset target.
- **D-23-07:** The hermes → nousresearch collision canary is **fixture-based in Phase 23** (fixture mirrors the future roster shape: hermes ids present + their openrouter mirror rows present, proving nousresearch wins over openrouter), with the **live-snapshot canary added in Phase 24** when the rows land. Non-vacuous at every point — the priority-order logic is never tested against an empty provider.

### Zen-Wins Dedup + No-Flip Canary (REG-03, CAT-04 boundary)
- **D-23-08:** The Zen-wins dual-listed-id dedup lives in the **registry layer** — ONE helper spanning both `opencode` + `opencode-go` snapshot providerIDs under the single `'opencode'` logical provider; on duplicate id the Zen row wins. The refresh script stays format-only; the rule is expressed once and survives regeneration by construction (CAT-04).
- **D-23-09:** The no-flip canary locks **determinism + snapshot shape**: 12 dual-listed ids resolve to the Zen row, 5 Go-exclusive ids keep their Go rows, no id flips endpoint. A roster re-shuffle that changes the counts fails loudly and is re-verified intentionally.
- **D-23-10:** Ordering in the registry helper: **dedup first** (Zen row wins, its `api.npm` wins), **then apply the npm gate**. The deduped 65-row pool is provider-level truth; the gate selects servable rows from it.

### Claude's Discretion
- The `PROVIDER_GATES` shape extension to express the npm-value gate (e.g. an `npm?: readonly string[]` field alongside `allowlist`) and the exact registry helper naming — pick per CONVENTIONS.md, consistent with `getServableIdsForProvider`/`getUnionServableIds`/`getProviderForModelId`.
- The registry-driven `providerName()` map (REG-01) — must stay client-bundle-safe: `model-picker-logic.ts` imports only the type (`ModelProviderId`), never a catalog value (T-17-09). Display labels: "NousResearch", "OpenCode". Where the name map lives (client-safe meta module vs inline) is Claude's call, but the T-17-09 constraint is hard.
- `PROVIDER_DEFAULT_MODELS` typing when the map grows — `Record<ModelProviderId, string>` extends mechanically.
- Save-validation reason codes for union-wide checks (REG-07) — reuse `invalid_model` unless a distinct reason is clearly better.
- Whether the priority-ordered `getProviderForModelId` keeps the scoped-`find()` shape or switches to an explicit precedence iteration — research prescribes explicit iteration; exact shape is planner's choice.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone research (v1.5 — primary source of locked decisions)
- `.planning/research/SUMMARY.md` — v1.5 research summary (verified 2026-08-03): the `@ai-sdk/openai-compatible@3.0.20` single-package finding, the opencode 4-protocol `api.npm` split (30 chat + 19 Claude + 23 GPT-5 + 5 Gemini), Critical Pitfalls 1-5 (canary regression trap, Nous pricing unit mismatch ×1e6, no env auto-load in openai-compatible, Nous `~latest` aliases, structured-output unverified), Implications for Roadmap §1 (registry phase).
- `.planning/research/STACK.md` — registry changes spec: `ModelProviderId` → 4, priority-ordered `getProviderForModelId` (explicit precedence iteration), `PROVIDER_GATES`/`SERVABLE_PROVIDERS`/`PROVIDER_DEFAULT_MODELS` extension; opencode snapshot providerIDs → single `'opencode'` registry id.
- `.planning/research/PITFALLS.md` — Pitfall 1 (canary regression trap — dual-listed ids sort opencode-first), Pitfall 2 (Nous per-token pricing), Pitfall 3 (no env auto-load), Pitfall 4 (`~latest` pass-verbatim), Pitfall 5 (structured-output unverified).

### Roadmap & requirements (locked scope)
- `.planning/ROADMAP.md` §Phase 23 — Goal, Requirements (REG-01..07), Success Criteria. **Read the roadmap footnote (v1.5 line) — the locked product decisions list** (do NOT re-litigate). Read Phases 24-27 too — Phase 23 decisions feed them (Phase 24 CAT-04 dedup, Phase 25 defaults, Phase 26 selector/pickers, Phase 27 matrices).
- `.planning/REQUIREMENTS.md` — REG-01..07 full text + Out of Scope table (GPT-5/Gemini deferral, one-provider lock, allowlist-not-roster).

### Project state & decision records
- `.planning/STATE.md` — v1.5 locked product decisions; v1.4 phase decision logs referenced.
- `.planning/PROJECT.md` — Key Decisions table (D-07 default-primary doctrine, D-15 degrade-gracefully doctrine, D-01 derive-don't-persist).
- `.planning/milestones/v1.4-phases/19-provider-registry-servable-model-source/19-CONTEXT.md` — the v1.4 predecessor: D-01..D-11 precedent (gate-as-data, raw-ids-verbatim, priority-order regression lock). Phase 23 is its 4-provider analog.

### Existing code (integration points)
- `src/lib/models/catalog.ts` — `ModelProviderId`, `PROVIDER_GATES`, `SERVABLE_PROVIDERS`, `getServableIdsForProvider`, `getUnionServableIds`, `getProviderForModelId` (priority-order change), `ANTHROPIC_ALLOWLIST`, `FAST_MODEL_ID`.
- `src/lib/models/catalog.test.ts` — the canary suite to extend (fixture + live-snapshot dual canary convention; collision canary precedent `claude-sonnet-4-6` → anthropic).
- `src/lib/agents/modelFactory.ts` — `PROVIDER_DEFAULT_MODELS` (anthropic + openrouter today), `OPENROUTER_DEFAULT_MODEL_ID` (D-07 precedent), constraint 11 (only SDK-importing module).
- `src/components/settings/model-picker-logic.ts` — `providerName()` 2-way hardcoded branch to make registry-driven (REG-01); type-only import constraint (T-17-09).
- `src/lib/env.ts` — env schema (add `NOUSRESEARCH_API_KEY` + `OPENCODE_API_KEY` optional server-only, mirroring `OPENROUTER_API_KEY` at line 41).
- `.env.example` — add the two new keys (no value).
- `src/app/actions/settings.ts` — `saveSettingsAction` union validation to cover all 4 providers (REG-07, membership-based unchanged).
- `src/lib/agents/modelConfig.ts` — `resolveModelChain` allowlist default widens to the 4-provider union.
- `scripts/refresh-model-catalog.ts` — Phase 24 consumer; must stay format-only per D-23-08.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PROVIDER_GATES` data map (from `ANTHROPIC_ALLOWLIST`) — the per-provider gate-as-data template; extend its shape for the npm-value gate (D-23-01).
- `catalog.test.ts` dual-canary convention (fixture + committed snapshot) — template for the count-stability (D-23-02), hermes fixture (D-23-07), and no-flip (D-23-09) canaries.
- `getModelDisplayName` + first-match-by-id lookup — pattern for the priority-ordered resolver.
- `PROVIDER_DEFAULT_MODELS` + `OPENROUTER_DEFAULT_MODEL_ID` — the D-07 default map; gains the two new targets.

### Established Patterns
- Gates as DATA; provider identity derived from the catalog, never persisted (D-01).
- Raw ids pass VERBATIM — never `~`-stripped, never prefix-collapsed (D-04).
- Server-only optional env keys, `z.string().optional()`, degrade-gracefully (D-15) — the new keys mirror `OPENROUTER_API_KEY` byte-for-byte.
- Constraint 11: catalog.ts/modelConfig.ts stay pure; provider SDKs importable ONLY from modelFactory.ts.
- D-02 roster-verify doctrine: every allowlist/default must be verified against the live roster or committed snapshot; count drift fails loudly.

### Integration Points
- `catalog.ts` — the registry core (ModelProviderId, PROVIDER_GATES, SERVABLE_PROVIDERS, getProviderForModelId priority order).
- `modelFactory.ts` — `PROVIDER_DEFAULT_MODELS` gains nousresearch + opencode entries (D-23-03, D-23-06).
- `model-picker-logic.ts` — `providerName()` registry-driven, client-bundle-safe (REG-01).
- `env.ts` / `.env.example` — two new optional server-only keys (REG-02, declaration-only).
- `saveSettingsAction` — union validation covers 4 providers automatically (REG-07, membership-based).
- `/settings` page + `settings/page.tsx` — consumes `PROVIDER_DEFAULT_MODELS` for provider reset targets (Phase 26 UI consumer; Phase 23 provides the map entries).

</code_context>

<specifics>
## Specific Ideas

- The opencode default mirrors the D-07 philosophy exactly: sonnet-class, pinned concrete id, stable cost captions, roster-verified — the same id as the anthropic default is deliberate, with the provider badge as the disambiguator in Phase 26.
- The npm-value gate makes the 49-row servable set self-maintaining; the count-stability canary is the deliberate counterweight so growth is reviewed, not silent.
- Keep-if-valid across provider switches means an anthropic→opencode switch is a re-badge, not a reset — the smoothest possible path for the team-familiar default model.

</specifics>

<deferred>
## Deferred Ideas

- **`endpoint` derived field + `· Zen` / `· Go` captions** — SET-03, Phase 26 (the derived field is set at trim time from the matched row's providerID + `endpointLabel()` helper; not this phase).
- **`supportsStructuredOutputs` flip gating** — RUN-06, Phase 25 (new instances start false until a live key-backed probe).
- **Npm-gate auto-servable growth review** — the count-stability canary (D-23-02) trips at Phase 24's refresh; growth is then deliberately re-verified as part of Phase 24's data commit.
- **Provider display labels final check** — "NousResearch"/"OpenCode" labels land in code here but get their visual verification in Phase 26.

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 23-Provider Registry + Servable Sources*
*Context gathered: 2026-08-03*
