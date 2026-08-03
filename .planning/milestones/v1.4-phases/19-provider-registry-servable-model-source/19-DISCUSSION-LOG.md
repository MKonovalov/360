# Phase 19: Provider Registry + Servable Model Source - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-02
**Phase:** 19-provider-registry-servable-model-source
**Areas discussed:** OpenRouter default primary, Strict-output pass, Env-gate scope

---

## OpenRouter default primary

| Option | Description | Selected |
|--------|-------------|----------|
| claude-sonnet-4.6 | `anthropic/claude-sonnet-4.6` ($3/$15 per M) mirrors the existing Anthropic FAST_MODEL_ID (claude-sonnet-4-6) — same sonnet-class quality, team-familiar behavior, stable cost captions. Matches roadmap's "pinned concrete slug" recommendation. | ✓ |
| claude-opus-4.6 | `anthropic/claude-opus-4.6` ($5/$25 per M) — higher-capability default, ~2x cost of sonnet. | |
| Defer to planning | Let the planner pick after roster-verification against the committed snapshot during planning — the roadmap's default posture (SET-03 deferred decision). | |

**User's choice:** claude-sonnet-4.6
**Notes:** Concrete catalog data verified live (336 active openrouter rows; `anthropic/claude-sonnet-4.6` present at $3/$15). The pinned concrete slug avoids `~`/`:free`/auto issues and gives stable cost captions.

---

## Strict-output pass

| Option | Description | Selected |
|--------|-------------|----------|
| Open-source families | Non-strict only for open-source families (qwen, llama, deepseek, mistral, gemma, glm, phi), closed models keep strict:true. Matches research's per-model recommendation. | |
| All strict initially | Ship everything strict:true. Simplest, zero curation; risk: open-source models fail-loud as 'output' with no fallback. | |
| Capability flag per model | Catalog rows carrying an explicit structured-output capability flag gate strict mode per-model (snapshot-driven). More schema surface; cleaner long-term but adds a data dependency. | ✓ |

**User's choice:** Capability flag per model

Follow-up question — flag source:

| Option | Description | Selected |
|--------|-------------|----------|
| Snapshot field | Extend refresh-model-catalog.ts + CatalogModel with a per-row flag sourced from the OpenRouter API's supported_parameters, regenerate snapshot once. Auto-maintained on refresh; changes snapshot schema + refresh script. | ✓ |
| Curated code map | Code-side curated map (STRICT_OUTPUT_EXCEPTIONS) in modelFactory.ts, decided during Phase 19. No snapshot schema change; drifts on catalog refresh. | |
| Clarify semantics first | Discuss flag's default semantics (absent flag = strict or non-strict?) before picking a source. | |

**User's choice:** Snapshot field
**Notes:** Sourcing mechanism must be re-verified against the INSTALLED `@openrouter/ai-sdk-provider` + live API at phase start (Phase 19 research flag — small targeted re-verification only). Never global `strict: false`.

---

## Env-gate scope

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 20 | Phase 19 ships only registry + servable source + save validation (REG-01..07); per-provider key gate lands with FAL-04 in Phase 20. Keeps Phase 19 pure/testable foundation, no run-path changes. Consistent with roadmap boundary. | ✓ |
| Phase 19 | Pull the chain-aware env gate into Phase 19 as research originally proposed. Phase 19 gains a run-path change; Phase 20 slims down. | |
| Let planner decide | Leave the boundary fuzzy; planner decides after reading roadmap + research SUMMARY. | |

**User's choice:** Phase 20
**Notes:** Resolves the research-vs-roadmap discrepancy (research SUMMARY listed the gate under Phase 19 deliverables; roadmap assigns it to FAL-04/Phase 20). Phase 19 ships only the OPENROUTER_API_KEY declaration (REG-02), not its enforcement.

---

## Claude's Discretion

- Naming of the renamed provider-gated function (`getAllowlistedServableIds` → `getServableIdsForProvider` or similar) and the snapshot capability field.
- `modelFactory.ts` module shape — follow research ARCHITECTURE.md spec.
- Save-validation error reason codes for union-wide checks (REG-07).
- Which closed-source families keep strict:true beyond Anthropic/OpenAI/Google.

## Deferred Ideas

- Per-slot provider selectors for fallbacks (Conflict 6 alternative) — only if Phase 21 UAT shows the union picker is confusing.
- Provider-scoped cost caps / BYOK for OpenRouter — v2+.
- Third+ providers (OpenAI first-party, Google) — future work.
- `strict:false` fail-loud remediation for any model slipping through the flag — Phase 22 VER surface.
- Chain-aware env gate — moved to Phase 20 (FAL-04) by decision.
