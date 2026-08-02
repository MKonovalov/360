---
gsd_state_version: 1.0
milestone: v1.4
milestone_name: Multi-Provider AI Model Configuration
status: planning
last_updated: "2026-08-02T20:27:23.497Z"
last_activity: 2026-08-02
progress:
  total_phases: 4
  completed_phases: 1
  total_plans: 5
  completed_plans: 5
  percent: 25
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-02)

**Core value:** Fast, shared ICP lookup — anyone on the team can pull up a company or persona and see a complete, trustworthy 360 view with buying signals in seconds.
**Current focus:** Phase 20 — cross provider run path

## Current Position

Phase: 20
Plan: Not started
Status: Ready to plan
Last activity: 2026-08-02

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**

- Total plans completed: 68 (v1.0: 14 + v1.1: 27 + v1.2: 10 + v1.3: 12)
- Average duration: - min
- Total execution time: - hours (v1.4 not started)

**By Phase (v1.4):**

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| - | - | - | - | - |

**Recent Trend:**

- Last milestone (v1.3): 12 plans across 4 phases, all completed same-day (2026-08-02)
- Trend: Stable — v1.3 delivered its full 4-phase cycle in one day

*Updated after each plan completion*
| Phase 19 P1 | 3 min | 3 tasks | 5 files |
| Phase 19 P02 | 5 | 3 tasks | 5 files |
| Phase 19 P03 | 3min | 2 tasks | 2 files |
| Phase 19 P04 | 3min | 2 tasks | 2 files |
| Phase 19 P05 | 6min | 3 tasks | 4 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- **Roadmap (v1.4): Phase structure follows research SUMMARY "Implications for Roadmap"** — Phase 19 (A) Provider Registry + Servable Model Source (REG-01..07) → Phase 20 (B) Cross-Provider Run Path (FAL-01..05) → Phase 21 (C) Settings UI (SET-01..08) → Phase 22 (D) Verification Gate (VER-01..05). Sequential numbering continues from v1.3's Phase 18.
- **Roadmap (v1.4): Requirement count is 25, not 24** — REG-01..07 (7) + FAL-01..05 (5) + SET-01..08 (8) + VER-01..05 (5) = 25. All 25 mapped, no orphans. REQUIREMENTS.md coverage footer corrected from the initial 24 (traceability table already had 25 rows).
- **Roadmap (v1.4): Locked product decisions (research overrides — do NOT re-litigate)** — `~latest` aliases and `:free` variants INCLUDED in the OpenRouter servable set and LABELED (overrides PITFALLS 2/4 exclusion; SET-07 labels); cross-provider 429 is hop-aware advance (`rate_limited` advances only when next model is on a different provider — FAL-03, overrides the blanket never/always debate); OpenRouter default primary = pinned concrete slug CHOSEN IN PLANNING (SET-03); picker = grouping + Command-pattern search BOTH in P1 (SET-06); provider DERIVED from catalog, NO `user_model_settings` schema change (REG-05).
- **Roadmap (v1.4): REG-01 (user selects provider) is the UI-facing half of the registry** — the provider-selector capability lands fully in Phase 21 (SET-01); Phase 19 delivers the registry + servable source + validation that makes the selector meaningful. The requirement maps to Phase 19 per the requirement category grouping (registry/servable foundation), with SET-01 carrying the visible selector.
- **Roadmap (v1.4): OpenRouter default primary (Conflict 8) decided at planning** — pinned concrete slug (avoids `~`/`:free`/auto issues, stable cost captions); must be roster-verified against the committed snapshot before Phase 21 pickers render it.
- **Roadmap (v1.4): structured-output strict pass (Conflict 9) is a Phase 19 curation decision** — identify which servable OpenRouter models need `openrouter(id, { structuredOutputs: { strict: false } })` during Phase 19's servable-set work; never a global `strict: false`.
- **Roadmap (v1.4): Vendor curation posture (Conflict 7) resolved toward full catalog + labels** — full 336-row catalog ships (REG-03) with vendor badges + egress copy + cost captions (SET-05/SET-08) rather than a curated subset; `openai/o1-pro` $150/M warning included.
- [Phase 19 pre-flag]: small targeted re-verification at phase start only — createOpenRouter strict-compat + structured-output + env-key against the INSTALLED package (PITFALLS G; tarball d.ts already verified in research but re-check post-install).
- [Phase 20 pre-flag]: confirm `APICallError.responseBody` is populated by the installed provider before writing `isOpenRouterPlatformRateLimit` (PITFALLS 3, AI-SDK drift discipline).
- [Phase 19]: getAllowlistedServableIds removed outright (D-05 remove-and-migrate) — no deprecated alias; all 3 callers migrated in the same change so next build stays green
- [Phase 19]: PROVIDER_GATES data map: anthropic = ANTHROPIC_ALLOWLIST (sonnet-only, REG-04), openrouter = {} (full active catalog per D-02/SET-07)
- [Phase 19]: getProviderForModelId scopes the find to the two servable providerIDs — never a bare id find (Anti-Pattern 1 / T-19-03 collision canary)
- [Phase 19]: saveSettingsAction widens to getUnionServableIds (REG-07) — cross-provider chains accepted, non-servable ids rejected with invalid_model
- [Phase 19]: structuredOutputs is a first-class snapshot field derived from live OpenRouter supported_parameters by exact-id join (D-08) — never a code-side map, never a global strict:false
- [Phase 19]: refresh-model-catalog.ts throws (aborts, no write) if the live OpenRouter fetch fails — the committed snapshot stays usable (T-19-06)
- [Phase 19]: modelFactory is the single provider-aware instantiation seam (constraint 11) — instantiateModel dispatches by catalog providerID with raw ids verbatim (D-04); instantiateChain maps once at entry (FAL-01); defaultChain stays the Anthropic fast path in Phase 19 (D-11)
- [Phase 19]: OPENROUTER_DEFAULT_MODEL_ID = 'anthropic/claude-sonnet-4.6' + PROVIDER_DEFAULT_MODELS exported as named constants for Phase 21's provider-switch reset (D-07)
- [Phase 19]: createOpenRouter({ compatibility: 'strict' }) with the option EXPLICIT (bare defaults to 'compatible'); no apiKey (auto-loads OPENROUTER_API_KEY); D-08 per-model structuredOutputs strict:false only for snapshot-flagged non-strict models — never global
- [Phase 19]: openrouter row lookup for the D-08 flag is provider-scoped (m.providerID === 'openrouter') — a bare id find reads the inert kilo/vercel flag for 54 dual-listed non-strict models and silently skips the opt-out (Rule 1 auto-fix)
- [Phase 19]: resolveModelChain default widens from ANTHROPIC_ALLOWLIST to getUnionServableIds(catalogJson) (D-06) — only behavioral change of 19-04; dedupe/cap-2/REG-05 default byte-identical (provider-agnostic)
- [Phase 19]: resolveModelChain param renamed allowlist → servableIds; ANTHROPIC_ALLOWLIST import kept (plan-mandated, noUnusedLocals off)
- [Phase 19]: modelConfig imports catalog.json directly mirroring catalog.ts (ARCHITECTURE.md Pattern 2) — pure-module contract intact (constraint 11)
- [Phase 19]: runAgent defaults via defaultChain() — last hardcoded anthropic(FAST_MODEL_ID) default gone from the run path; factory default stays Anthropic fast path (D-11)
- [Phase 19]: analyzeCompany maps chain ids once at entry via instantiateChain(modelChain) — Pitfall 11 comment preserved; env gate untouched (D-11/FAL-04 is Phase 20)
- [Phase 19]: Explicit-models tests use string-form LanguageModel stubs ('m1') — plan's {provider,modelId} literals fail tsc against the LanguageModel union (Rule 1 fix)

### Pending Todos

None yet.

### Blockers/Concerns

- **OpenRouter default primary slug (SET-03) is undecided** — must be pinned concrete slug chosen at Phase 21 (or earlier) planning; roster-verify against committed snapshot per D-02 doctrine.
- **`strict:false` per-model pass (Conflict 9)** — open-source models via OpenRouter may not honor strict JSON-schema; decide during Phase 19 servable-set curation, never global.
- **v1.3 "no `/`" invariant tests are now obsolete** — OpenRouter ids legitimately contain `/` and `~`; those tests must be reworked deliberately to provider-aware contracts (PITFALLS 7), not deleted.
- **Same-provider 429 invariants (D-01/D-03) must survive the hop-aware extension** — Phase 20's 4-cell matrix is the lock; v1.3's never-advance behavior within a provider is preserved verbatim.
- **60s ceiling is still a hard wall** — OpenRouter proxy latency + SDK retry pile-up must stay under the existing 54s loop clamp (FAL-04 budget); `maxDuration` stays at Hobby's 60.
- Carried from v1.1/v1.2: persona-side Arcpedia content gap (seed data); 3 VERIFICATION.md files still `human_needed`; "any authenticated Clerk user = staff" model has no role system (acceptable per PROJECT.md scope).

## Deferred Items

Items acknowledged and carried forward from v1.3 milestone close, still open:

| Category | Item | Status |
|----------|------|--------|
| uat_gap | Persona-side "Related Knowledge" (Arcpedia) end-to-end with real matches | pending — code path proven identical to Company, seed data lacks a matching name |
| uat_gap | 01-HUMAN-UAT.md | partial — 2 pending scenarios |
| uat_gap | 02-HUMAN-UAT.md | partial — 4 pending scenarios |
| uat_gap | 04-HUMAN-UAT.md | partial — 1 pending scenario (Persona-side Arcpedia content gap) |
| verification_gap | 01/02/03/04-VERIFICATION.md | human_needed |
| tech_debt | CAT-03 `opencodeSlugToModelId` has no production consumer (tested only) | open — and MUST NOT be generalized to OpenRouter ids (PITFALLS 1) |
| tech_debt | Stale root docs (README/CLAUDE.md still describe pre-Next.js stack) | open |

## Session Continuity

Last session: 2026-08-02T20:27:23.485Z
Stopped at: Phase 20 context gathered
Resume file: .planning/phases/20-cross-provider-run-path/20-CONTEXT.md

## Operator Next Steps

- Run `/gsd-plan-phase 19` (Provider Registry + Servable Model Source) — starts with the small targeted @openrouter/ai-sdk-provider re-verification per the research flag
