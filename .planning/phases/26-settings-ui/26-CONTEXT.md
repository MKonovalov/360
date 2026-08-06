# Phase 26: Settings UI - Context

**Gathered:** 2026-08-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Staff can see and configure all four providers in the Settings AI Model Configuration card with honest captions and unambiguous badges. This phase delivers: the 4-entry AI Provider selector in `SERVABLE_PROVIDERS` order, provider-scoped Primary refresh from each provider's servable source, the `· Zen`/`· Go` endpoint captions on OpenCode rows (derived `endpoint` field set at trim time + `endpointLabel()` helper) in both primary and union fallback pickers, honest Hermes capability + per-MTok cost captions for NousResearch, 4-provider badge disambiguation, and end-to-end save/staleness verification against 4-provider chains. It is NOT the run-path seam (Phase 25, done) and NOT the verification gate (Phase 27).

</domain>

<decisions>
## Implementation Decisions

### OpenCode Endpoint Captions (SET-03)
- **D-26-01:** Caption ordering when a row has BOTH an endpoint caption and a suffix label — **endpoint first, suffix second**: `· Zen · free tier — 50 req/day`. The endpoint is the primary identity cue (which endpoint serves this row); the suffix is secondary context.
- **D-26-02:** The `· Zen`/`· Go` endpoint caption appears on **picker rows AND the saved-chain recap** — the saved chain must disambiguate Zen vs Go after save, not just inside the pickers.
- **D-26-03:** `'zen'`/`'go'` join the Command **search index** (`searchValue`) — typing "go" filters to Go-endpoint rows. Composed into the existing id+name+family lowercase search string.

### NousResearch Honest Captions (SET-04)
- **D-26-04:** Both Hermes rows caption the **same uniform family descriptor** — `· chat/reasoning-tuned` — honest about what the model is, identical across hermes-4-70b and hermes-4-405b (no per-model tuning split). Mirrors the `:free` fail-loud honesty pattern (a visible, factual label in the caption slot).
- **D-26-05 [CORRECTED post-research]:** OpenRouter **mirror** rows (`nousresearch/hermes-4-70b`/`405b` via openrouter) show their **real cost caption**, same as NousResearch rows — per-MTok cost converted from the API's per-token pricing. Original premise ("mirror rows carry NO cost data") was factually wrong: the live snapshot shows real non-zero cost for both mirrors (hermes-4-70b: $0.13/$0.4 per MTok; hermes-4-405b: $1/$3). Showing the real, billable cost is more honest than suppressing it — matches this phase's "honest captions" goal. See `26-RESEARCH.md` Pitfall 2.

### Badge Disambiguation (SET-05)
- **D-26-06:** Badges are **provider-only** — `NousResearch` / `OpenCode` etc. Endpoint info lives exclusively in the caption slots (pickers) and recap captions (D-26-02). No `OpenCode · Zen` badge composite; one source per slot.
- **D-26-07:** **Uniform secondary badge variant** for all 4 providers (current Phase 21 style) — text differs, color doesn't. No new badge tokens, no per-provider tints. Same-name rows (hermes-4-70b, claude-sonnet-4-6) disambiguate by badge text + caption, not color.
- **D-26-11 [added post-research]:** **Fix the primary picker's trigger badge to show the row's true resolved provider, not the raw dropdown selection.** Research verified `model-settings-form.tsx:258` passes `badge={provider}` (the dropdown's `useState` value) instead of deriving from `unionServableModels`'s precedence-resolved `providerID`, the way every other badge site (fallback triggers, saved-chain recap, union rows) already does. This is a real, verified bug — for `claude-sonnet-4-6` (anthropic vs opencode) and the Hermes pair (nousresearch vs openrouter), the trigger badge can show a provider the model won't actually run through. Fix: `badge={unionServableModels.find((m) => m.id === primary)?.providerID ?? provider}`, mirroring the existing fallback-picker pattern. Required for SET-05's "unambiguous badges" — not optional cleanup. See `26-RESEARCH.md` Pitfall 3.

### Selector + Chain UX (SET-02/06)
- **D-26-08 [informational]:** The AI Provider selector entry is **plain `OpenCode`** — no Zen/Go hint in the entry label. Provider-level identity at the top; endpoint detail lives in the picker captions where it matters. Already satisfied by existing code (`PROVIDER_NAMES.opencode === 'OpenCode'`, no suffix) — nothing for this phase's plans to build, boundary/no-op decision.
- **D-26-09 [CORRECTED post-research]:** **Endpoint-aware reset hint**: when keep-if-valid preserves `claude-sonnet-4-6` across an anthropic→opencode switch, the existing non-blocking reset hint states the true routing fact — something like "Claude Sonnet 4.6 stays routed through Anthropic — OpenCode's copy isn't used while a higher-priority provider serves the same id." Original proposed copy ("now serves via OpenCode Zen") was factually false: this id ALWAYS resolves to native Anthropic regardless of the dropdown selection (Phase 23's locked `PROVIDER_PRECEDENCE` regression-lock — verified live). A phase whose goal is "honest captions" cannot ship a hint claiming a routing change that never happens. See `26-RESEARCH.md` Pitfall 7.
- **D-26-10:** **Silent for sparse providers** — no "only 2 servable models" note when picking NousResearch (Hermes pair) or anthropic (1). The small picker speaks for itself.

### Claude's Discretion
- The `endpoint` field name/type on `ServableModel` (e.g. `endpoint: 'zen' | 'go' | null` vs a label string) and the `endpointLabel()` helper values/format (`· Zen`/`· Go`) — must satisfy D-26-01..03 and stay client-bundle-safe (T-17-09: type-only catalog import; the endpoint derives from the already-trimmed server-validated ServableModel prop).
- Where the trim-time `endpoint` derivation lives (settings.ts `trimToServable`/servable-model mapping) and how dual-listed ids resolve (Zen-wins dedup already guarantees endpoint = Zen for the 12 dual-listed ids — planner verifies, no re-litigation).
- Reset-hint copy mechanics for D-26-09 (extend the existing D-21-01 hint state vs a new variant) — planner's call, must keep the hint non-blocking and draft-only.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked decisions + phase scope
- `.planning/ROADMAP.md` §Phase 26 — Goal, Requirements (SET-01..06), Success Criteria. Read Phases 23, 24, 25, 27 too — Phase 26 is the UI consumer of Phase 23/24's 4-provider data and Phase 25's run path.
- `.planning/REQUIREMENTS.md` §Settings UI — SET-01..06 exact wording (the 6 requirements this phase validates).

### Prior phase context (carry-forward)
- `.planning/phases/23-provider-registry-servable-sources/23-CONTEXT.md` — D-23-03 (`PROVIDER_DEFAULT_MODELS.opencode` = claude-sonnet-4-6), D-23-04 (keep-if-valid accepted), D-23-05 (nousresearch Hermes allowlist pins), D-23-06 (`PROVIDER_DEFAULT_MODELS.nousresearch` = hermes-4-70b), D-23-08/09/10 (Zen-wins dedup).
- `.planning/phases/24-refresh-script-catalog-data/24-CONTEXT.md` — D-24-01 (all 292 nous rows ship; Hermes allowlist gates), D-24-08/09 (`~latest` aliases ship verbatim, derivable from id at render — Phase 26 labels them), D-24-12 (hermes `structuredOutputs: false`, family from id prefix, ×1e6 pricing conversion).
- `.planning/phases/25-run-path-modelfactory-seam/25-CONTEXT.md` — D-25-06 (`PROVIDER_DEFAULT_MODELS` are Phase 26's provider-switch RESET targets; `defaultChain()` stays `[anthropic(FAST_MODEL_ID)]`), the anthropicZen/anthropicGo instance naming convention (mirror for endpoints).

### Existing UI contracts (Phase 21 — the form being extended)
- `.planning/phases/21-settings-ui/21-CONTEXT.md` — D-21-01 (keep-if-valid → reset-to-provider-default), D-21-02 (fallbacks NEVER touched on provider switch), D-21-03 (draft-only reset), D-21-07 (search index = id+name+family), D-21-08 (union grouping by provider), D-21-09 (PROVIDER_NAMES single source), D-21-10 (trigger badge), D-21-12 (suffixLabel id-derived), D-21-13 (high-cost threshold ≥$50/M), D-21-14 (union-wide staleness gate).

### Codebase contracts
- `src/components/settings/model-picker-logic.ts` — `ServableModel` type (needs `endpoint` field), `PROVIDER_NAMES` (already 4-entry), `suffixLabel` (id-derived caption), `searchValue` (add 'zen'/'go'), `providerName`, high-cost threshold. Client-bundle-safe (T-17-09: type-only `ModelProviderId` import).
- `src/components/settings/model-settings-form.tsx` — the form: provider switch (keep-if-valid → reset hint, D-21-01/03), fallbacks untouched (D-21-02), saved-chain recap, staleness (`computeStaleIds`).
- `src/components/settings/model-picker.tsx` — `byProvider` grouping (D-21-08), trigger badge (D-21-10), caption slot rendering.
- `src/app/(dashboard)/settings/page.tsx` — server page computing servable models per provider + union.
- `src/app/actions/settings.ts` — save validation (union servable gate), the trim-to-servable mapping where the derived `endpoint` field lands (SET-03).
- `src/lib/models/catalog.ts` — `SERVABLE_PROVIDERS` (l.102: anthropic → openrouter → nousresearch → opencode), `getServableIdsForProvider`, `getUnionServableIds`, `dedupeProviderRows` (Zen-wins).
- `src/components/ui/badge.tsx` — the badge primitive (secondary variant, D-26-07).
- `.planning/codebase/ARCHITECTURE.md` — constraint 11 (modelFactory = only SDK-importing module — untouched by UI), T-17-09 client-bundle rule.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `model-picker-logic.ts` — `PROVIDER_NAMES` already 4-entry (Phase 23 widened it); `suffixLabel`/`searchValue`/cost-caption helpers all exist — Phase 26 extends rather than rebuilds.
- `model-settings-form.tsx` — provider-switch keep-if-valid logic + non-blocking reset hint (D-21-01/03) is the hook point for D-26-09's endpoint-aware hint.
- `model-picker.tsx` — `byProvider` grouping + trigger badge + caption slot; the union fallback picker already groups by provider (extends to 4 groups).
- `catalog.ts` — Zen-wins dedup means the 12 dual-listed opencode ids already resolve endpoint = Zen; the 5 Go-exclusive ids are the `· Go` population.
- Badge primitive (secondary variant) — reused as-is for 4 providers (D-26-07).

### Established Patterns
- Client-bundle-safety (T-17-09): pickers import only the `ModelProviderId` type; everything derives from server-validated `ServableModel` props. The new `endpoint` field must follow — derived at trim time server-side, carried as a plain prop.
- Caption slot composition: suffix labels + cost captions live in one caption string (D-21-12/13); D-26-01 defines endpoint-first ordering within that slot.
- Fail-loud honesty: `:free` rows get an explicit shared-quota caption; Hermes rows get the uniform `· chat/reasoning-tuned` label (D-26-04) — same pattern, honest descriptor instead of limitation.
- Keep-if-valid / draft-only reset doctrine (D-21-01/03): nothing persists until Save; the endpoint-aware hint (D-26-09) follows the same non-blocking pattern.

### Integration Points
- `settings.ts` trim/servable mapping — the derived `endpoint` field lands here (SET-03), sourced from the matched row's `providerID` (`opencode` vs `opencode-go`).
- `model-picker-logic.ts` `ServableModel` — the type that gains `endpoint`; `searchValue` gains 'zen'/'go' (D-26-03).
- `model-settings-form.tsx` recap — endpoint caption in the saved-chain recap (D-26-02).
- Save/staleness path (`saveSettingsAction` + `computeStaleIds`) — verified end-to-end against 4-provider chains (SET-06).

</code_context>

<specifics>
## Specific Ideas

- Caption examples from discussion: `· Zen · free tier — 50 req/day` (endpoint-first composite, D-26-01) and `· chat/reasoning-tuned` (Hermes uniform label, D-26-04).
- Mirror-row cost behavior [corrected]: openrouter hermes mirror rows show their real cost caption, same as NousResearch rows (D-26-05, corrected post-research) — the live snapshot shows real non-zero cost for both mirrors; the original "no cost data" premise was wrong.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 26-Settings UI*
*Context gathered: 2026-08-04*
