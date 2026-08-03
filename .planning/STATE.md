---
gsd_state_version: 1.0
milestone: v1.4
milestone_name: Multi-Provider AI Model Configuration
status: verifying
last_updated: "2026-08-03T14:20:59.656Z"
last_activity: 2026-08-03
progress:
  total_phases: 4
  completed_phases: 4
  total_plans: 23
  completed_plans: 23
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-02)

**Core value:** Fast, shared ICP lookup — anyone on the team can pull up a company or persona and see a complete, trustworthy 360 view with buying signals in seconds.
**Current focus:** Phase 22 — verification-gate

## Current Position

Phase: 22 (verification-gate) — EXECUTING
Plan: 7 of 7
Status: Phase complete — ready for verification
Last activity: 2026-08-03

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**

- Total plans completed: 79 (v1.0: 14 + v1.1: 27 + v1.2: 10 + v1.3: 12)
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
| Phase 20-cross-provider-run-path P01 | 3min | 2 tasks | 2 files |
| Phase 20-cross-provider-run-path P02 | 5 | 2 tasks | 2 files |
| Phase 20-cross-provider-run-path P03 | 8min | 2 tasks | 2 files |
| Phase 20-cross-provider-run-path P04 | 2min | 2 tasks | 1 files |
| Phase 21-settings-ui P01 | 12min | 1 tasks | 6 files |
| Phase 21-settings-ui P02 | 3min | 2 tasks | 2 files |
| Phase 21-settings-ui P03 | 11 | 1 tasks | 2 files |
| Phase 21-settings-ui P04 | 20min | 1 tasks | 1 files |
| Phase 21-settings-ui P05 | 5min | 2 tasks | 1 files |
| Phase 21-settings-ui P06 | 3min | 2 tasks | 3 files |
| Phase 21-settings-ui P07 | 2min | 2 tasks | 1 files |
| Phase 22-verification-gate P22-01 | 2min | 2 tasks | 2 files |
| Phase 22-verification-gate P22-02 | 4min | 1 task | 1 file |
| Phase 22-verification-gate P3 | 12min | 3 tasks | 6 files |
| Phase 22-verification-gate P04 | 45min | 2 tasks | 3 files |
| Phase 22-verification-gate P06 | 25min | 1 tasks | 1 files |
| Phase 22-verification-gate P05 | 75 | 3 tasks | 1 files |
| Phase 22-verification-gate P07 | 3min | 2 tasks | 2 files |

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
- [Phase 20]: FAL-02/FAL-03 (plan 20-01): 402 → 'billing' (never failover-eligible, PITFALLS 3); 502/503 stay server_error/eligible as model-availability signals (comment-only); D-20-06 mid-stream-429 note on the output branch; shouldAdvance implements the locked 4-cell matrix — rate_limited advances ONLY cross-provider, all other eligible classes advance regardless, fail-closed on null provider identity; locked by the D-16 test matrix
- [Phase ?]: FAL-03 loop composition: (isFailoverEligible(cls) || cls === 'rate_limited') && shouldAdvance(cls, from, to) — the OR is REQUIRED because isFailoverEligible('rate_limited') is false by D-03; a literal AND would silently never advance cross-provider 429s
- [Phase ?]: from/to provider identity is catalog-derived via getProviderForModelId on model ids only (D-20-07) — never the error body; to === null (last model / catalog drift) fail-closes a 429 advance
- [Phase ?]: isOpenRouterPlatformRateLimit is loop-side diagnostics-only (D-20-08): informs reason strings + telemetry, structurally unable to flip the advance decision
- [Phase ?]: Audit identity untouched: modelUsed = modelIdOf(models[i]) records the served id verbatim incl. slashed OpenRouter slugs + ~latest aliases (FAL-05)
- [Phase ?]: D-20-03 execution: the pre-DB fast gate is FIRECRAWL-only — ANTHROPIC is a provider key, so it moves into the chain-aware named-key path (an openrouter-only chain runs with only OPENROUTER set; an ANTHROPIC-missing anthropic chain names ANTHROPIC_API_KEY)
- [Phase ?]: FAL-04/D-20-01/02: missingProviderKey checks the RESOLVED chain's provider set all-or-nothing at run entry; unknown ids (null provider) are skipped — the union servable gate upstream (resolveModelChain) already excludes non-servable ids
- [Phase ?]: D-20-10: 402 maps to billing 'provider credits exhausted'; 429 maps to rate_limited with the diagnostics-split platform/upstream message — message values are fixed server-side constants (T-20-09), only key NAMES surface in missingKey (T-20-07)
- [Phase ?]: D-20-09/10/11 execution: not_configured -> 400 with message naming the missing key (undefined on the bare FIRECRAWL fast-gate path - JSON drops it); billing -> 402 'provider credits exhausted'; rate_limited -> 429 with result.message; the 502 family untouched
- [Phase ?]: FAL-05 is verification-only (RESEARCH caveat 6): Phase 19/20-02 already wired modelUsed/modelChain; proven by 3 greps + a tsx identity smoke rather than new code
- [Phase ?]: The catalog stores ~latest aliases with a LEADING ~ ('~anthropic/claude-sonnet-latest'), not 'anthropic/claude-sonnet-latest' - the plan's smoke literal would fail; corrected smoke uses the real alias and still proves the FAL-05 intent (ids resolve to providers, flow verbatim)
- [Phase 21-settings-ui]: SET-06 infra shipped (21-01): vendored shadcn Command/Popover via official CLI; cmdk@^1.1.1 is the phase's single new npm dep, recorded in package-lock.json via npm (no yarn.lock). The v4 CommandGroup heading contract is the compiled descendant form (**[[cmdk-group-heading]]:text-xs...), NOT the literal class string. Wrapper (21-04) MUST pass data-checked per CommandItem — vendored CheckIcon is gated on group-data-[checked=true] but cmdk only emits data-selected/aria-selected (PATTERNS Pitfall 1). SET-06 stays open until 21-05
- [Phase 21-settings-ui]: ServableModel six-field shape { id, name, family, providerID, costInput, costOutput } defined once in model-picker-logic.ts — the shared prop type page.tsx (21-03), model-picker.tsx (21-04), and the form (21-05) all import — Avoids three drifting local copies of the trimmed prop shape
- [Phase 21-settings-ui]: model-picker-logic.ts's ONLY import is import type { ModelProviderId } from '@/lib/models/catalog' — erased at compile; a value import would drag the 1131-row snapshot into the client bundle (T-17-09) — Client-safety canary grep (catalog.json -> 0) stays clean; the union cannot drift from catalog.ts
- [Phase 21-settings-ui]: Task 1/2 executed as one TDD cycle per the plan's tdd=true flag on Task 1: the full Vitest suite was authored in Task 1's RED phase (failing test commit) and the module implemented in GREEN — RED test commit 35617605 strictly precedes GREEN feat commit 0c69783f — the TDD gate is satisfied; Task 2's deliverable is the RED commit
- [Phase 21-settings-ui]: P03: settings/page.tsx delivers the five provider-aware props (providers SET-01, servableByProvider SET-02, unionServableModels SET-04, defaults from PROVIDER_DEFAULT_MODELS SET-03 source, savedChain SET-05) — all server-computed through a single provider-scoped trimRow (mm.id === id && mm.providerID === provider, Anti-Pattern 1 lock); catalog.json stays server-only (T-17-09); defaultPrimary deleted (defaults subsumes it)
- [Phase 21-settings-ui]: P03: Rule 3 auto-fix — model-settings-form re-pointed to the new props in this plan (type-only imports, union staleness gate, union option sources, sonnet-only branch removed) so the plan's tsc gate passes; 21-05 Task 1 lands the provider selector dimension on top. Flag for 21-05: import ModelProviderId from @/lib/models/catalog (canonical source) — model-picker-logic imports but does NOT re-export it (TS2459)
- [Phase 21-settings-ui]: P04: model-picker.tsx wrapper — no manual Check icon (vendored CommandItem auto-renders its CheckIcon gated on group-data-[checked=true]; a Check import would be dead code)
- [Phase 21-settings-ui]: P04: ModelProviderId deliberately NOT imported in the wrapper — the plan's import spec is self-contradictory (canonical-source import trips the lib/models/catalog->0 canary; model-picker-logic imports but does not re-export it -> TS2459). Resolved via ServableModel['providerID'] indexed access — same union, cannot drift, canary stays 0
- [Phase 21-settings-ui]: P04: trigger label uses the truthy-value form ({value ? selected?.name ?? value : placeholder}) — the plan's literal ??-chain renders a BLANK trigger for value='' (in-progress fallback row); the placeholder must show instead
- [Phase 21-settings-ui]: P04: row anatomy wrapped in a flex flex-col container so the family subtitle renders as line 2 — a block span as a direct flex child of the vendored CommandItem (flex items-center) would sit inline after the cost caption (UI-SPEC Row Anatomy is authoritative)
- [Phase 21-settings-ui]: P04: cn() used for the cost-caption conditional (justifies the plan-mandated cn import; tailwind-merge output identical to the plan's template literal)
- [Phase 21-settings-ui]: P05: initial provider = savedChain[0].providerID (saved primary's provider) else anthropic (REG-05 fast path); handleProviderChange is a function declaration calling primaryAfterProviderSwitch — hint set only on resetToDefault, fallbacks never touched (D-21-02), reset draft-only (D-07)
- [Phase 21-settings-ui]: P05: primary ModelPicker options = optionsForSlot(primary, fallbacks, -1, servableByProvider[provider]) — slotIndex -1 excludes primary + all fallback ids (Open Question 3) so Save can't hit duplicate_model; primary onChange also clears resetHint (hint lifecycle RESOLVED)
- [Phase 21-settings-ui]: P05: saved-chain recap entries resolve provider via unionServableModels lookup and name via savedChain with raw-id fallback (T-21-14/15); recap gated on a lastSaved snapshot equality check so it self-hides on any slot edit
- [Phase 21-settings-ui]: P06: triggerLabel precedence locked — '' → null (placeholder), non-empty valueName → valueName (CR-01 fix: the deduped options are NOT the trigger-name source for the primary slot), else options.find()?.name, else the raw value verbatim (UI-SPEC raw-id fallback)
- [Phase 21-settings-ui]: P06: pinnedSelection contract locked — null when !value or !valueName (stale/unknown stays on the staleLabel path), null when the value IS selectable (normal data-checked row), else { name: valueName, onlyModel: options.length === 0 }; onlyModel true = anthropic single-model empty-list case (WR-02)
- [Phase 21-settings-ui]: P06: pinned row carries data-checked (boolean true) — the vendored CommandItem auto-renders its CheckIcon on group-data-[checked=true], closing GAP-2's primary checkmark with the name-resolvable source review CR-01 names
- [Phase 21-settings-ui]: 21-07: valueName source = the already-trimmed unionServableModels prop (server-validated, T-17-09) — no new import, catalog.json stays server-only; every valid primary resolves, a stale id yields undefined so the raw-id fallback + staleLabel path stay untouched (CR-01 call-site fix)
- [Phase 21-settings-ui]: 21-07: markDirty uses the updater form setStatus((s) => (s === 'saving' ? s : 'idle')) — review WR-01 exact fix; a just-started save is never relabeled by a concurrent edit; markDirty fires from all six draft mutators and is NOT called from handleSave (it manages its own 'saving' → 'saved'|'error' transitions); setResetHint lifecycle untouched
- [Phase 22-verification-gate]: VER-01 (22-01): the two RESEARCH-documented test gaps (direct isOpenRouterPlatformRateLimit tests, statusCode-200 -> 'input' pin) are closed at their home files per D-16; the three locked matrices (collision canaries catalog.test.ts:182-192, 4-cell 429 hop modelConfig.test.ts:151-177, error classes :56-77) audited green and left byte-identical (D-22-06)
- [Phase 22-verification-gate]: VER-04 (22-02): the security-matrix grep is a permanent Vitest gate (D-22-07) — src/lib/verification/security-grep.test.ts fails on any OPENROUTER in client-reachable code ('use client'/components/Server Actions) or any NEXT_PUBLIC_OPENROUTER in src/ or .env.example; ALLOWED = lib/env.ts + modelFactory.ts + analyzeCompany.ts (verified 3-file baseline); Test 4 canary keeps it non-vacuous (Pitfall 6); Test-1 self-skip added (Rule 1 — the gate's own isClient predicate holds the 'use client' literal, so without the skip it fail-open on its own source); runs with every npm test (377 passed | 6 skipped)
- [Phase 22-verification-gate]: VER-02/VER-05 (22-03): Playwright e2e harness built — @playwright/test@^1.62.1 + @clerk/testing@^2.2.16 devDeps (D-22-04), webServer auto-start config, project-based Clerk auth setup (never globalSetup, Pitfall 3), real Clerk login via clerkSetup + clerk.signIn (D-22-05 — no cookie-injection stubs), storageState e2e/.clerk/user.json gitignored; auth-setup smoke green proves real auth end-to-end.

D-22-05 account mechanics: dedicated test staff account e2e-staff@arclumenpartners.com provisioned via Clerk Backend API createClerkClient().users.createUser (RESEARCH Open Questions 1 first path); E2E_CLERK_USER_EMAIL/E2E_CLERK_USER_PASSWORD written to .env.local only (gitignored); no dashboard fallback or human checkpoint needed.
Post-login navigation target (22-03 Rule 3 fix): RESEARCH Pattern 1's waitForURL('**/companies/**') is wrong for this app — the post-login dashboard is '/' (the (dashboard) route group behind requireStaffAccess), not a recall.ai-style /companies/**; clerk.signIn sets the __session cookie but does not auto-redirect, so the setup navigates to '/' explicitly and asserts the ArcLumen 360 dashboard renders — same real-auth proof intent, correct target.
VER-02/VER-05 requirement status: harness + test account (the operator prerequisite) are resolved by 22-03, but VER-02/VER-05 remain Pending in REQUIREMENTS.md — their evidence (live-key analyze e2e, browser UAT) lands in plans 22-05/22-06.

- [Phase 22]: Live collision pair for badge disambiguation is claude-sonnet-4-6 (anthropic) vs anthropic/claude-sonnet-4.6 (openrouter) — the plan's claude-sonnet-5 pair does not materialize (claude-sonnet-5 is opencode-only, not servable)
- [Phase 22]: Persisted-DB UI specs must tear down saved fallback rows per test (clearFallbacks) — the saved chain survives across runs and addFallback caps at 2 rows
- [Phase 22]: Badge locators scope to [data-slot=badge] DOM contract, not generic span+text filters that over-match row subtitles
- [Phase 22-verification-gate]: P05: VER-02 model-picker save step is state-tolerant (Rule 1/3 spec-determinism fix): the draft may already hold the target primary from the 22-04 probe (disabled WR-02 pinned row, data-checked+aria-disabled) — only open the picker when the trigger lacks the OpenRouter badge+name; click only enabled rows filtered by provider badge; tear down leftover fallbacks first (VER-05 clearFallbacks); assertions never weakened
- [Phase 22-verification-gate]: P05: VER-02 live run returned 402 from OpenRouter (key uncredited: limit null, is_free_tier true) — recorded as the documented pending-credit limitation (IN-03 billing observation for plan 22-07), no retry per plan, no assertion weakening; full stack through the provider contract proven (real Clerk login, Settings UI save, analyze route)
- [Phase 22-verification-gate]: 22-VERIFICATION.md status: passed (plan-mandated frontmatter) means the RECORD is complete — 5/5 success criteria mapped to executed evidence — not that every live assertion is green; VER-02/VER-03 live billing-success assertions (201 + modelUsed 'anthropic/claude-sonnet-4.6') are explicitly PENDING-credit (uncredited OPENROUTER_API_KEY, limit null, is_free_tier true) and flagged in the truth table, never falsely green. — The record's job is to map all five success criteria to executed evidence with re-runnable commands; the two live-key proofs are structurally delivered (full stack through the provider contract proven, assertions intact) but their 201/modelUsed evidence awaits key top-up. Flagging pending-credit keeps the record honest while still a complete 5/5 Evidence map.
- [Phase 22-verification-gate]: REQUIREMENTS.md honesty at the milestone's final verification-gate: VER-02/VER-03 remain Pending (their literal satisfaction — agent_run.model_used matching the saved OpenRouter slug; an OpenRouter-only chain running successfully — awaits a credited key's 201/modelUsed evidence); VER-01/VER-04/VER-05 stay Complete. This plan records evidence shapes; it does not fabricate requirement closure. — Requirement status must reflect proven fact, not aspiration. A 402-billing terminal state is durable evidence everything up to the money works, but it is not a satisfied "matches the saved slug" claim. Marking them Complete would corrupt REQUIREMENTS.md traceability for the milestone audit.

### Pending Todos

None yet.

### Blockers/Concerns

- **OpenRouter default primary slug (SET-03) is undecided** — must be pinned concrete slug chosen at Phase 21 (or earlier) planning; roster-verify against committed snapshot per D-02 doctrine.
- **`strict:false` per-model pass (Conflict 9)** — open-source models via OpenRouter may not honor strict JSON-schema; decide during Phase 19 servable-set curation, never global.
- **v1.3 "no `/`" invariant tests are now obsolete** — OpenRouter ids legitimately contain `/` and `~`; those tests must be reworked deliberately to provider-aware contracts (PITFALLS 7), not deleted.
- **Same-provider 429 invariants (D-01/D-03) must survive the hop-aware extension** — Phase 20's 4-cell matrix is the lock; v1.3's never-advance behavior within a provider is preserved verbatim.
- **60s ceiling is still a hard wall** — OpenRouter proxy latency + SDK retry pile-up must stay under the existing 54s loop clamp (FAL-04 budget); `maxDuration` stays at Hobby's 60.
- Carried from v1.1/v1.2: persona-side Arcpedia content gap (seed data); 3 VERIFICATION.md files still `human_needed`; "any authenticated Clerk user = staff" model has no role system (acceptable per PROJECT.md scope).
- OPENROUTER_API_KEY is UNCREDITED (limit: null, is_free_tier: true) — the VER-02 live analyze e2e (22-05) returns 402 and cannot produce its billing-success evidence (201 + modelUsed read-back) until credits are topped up; gates VER-02 requirement + plan 22-07 proof recording; re-run npx playwright test e2e/ver-02-analyze.spec.ts after top-up

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

Last session: 2026-08-03T14:20:24.967Z
Stopped at: Completed 22-07-PLAN.md
Resume file: None

## Operator Next Steps

- Run `/gsd-plan-phase 19` (Provider Registry + Servable Model Source) — starts with the small targeted @openrouter/ai-sdk-provider re-verification per the research flag
