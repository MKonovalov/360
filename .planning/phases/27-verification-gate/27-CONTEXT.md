# Phase 27: Verification Gate - Context

**Gathered:** 2026-08-04
**Status:** Ready for planning

<domain>
## Phase Boundary

The v1.5 milestone's correctness claims are proven end-to-end for all 4 providers. This is the final phase of v1.5 — it does NOT build new features (beyond the two Phase 26 code-review fixes folded in below); it PROVES what Phases 23-26 shipped:
- **VER-01 (matrices):** the collision resolution + 16-cell 429 hop matrix are audited for complete 4-provider coverage
- **VER-02 (E2E UAT):** saving a NousResearch or OpenCode primary then running Analyze records `agent_run.model_used` matching the saved id
- **VER-03 (single-key chains):** an OpenCode-only chain runs with only `OPENCODE_API_KEY`; a NousResearch-only chain runs with only `NOUSRESEARCH_API_KEY`
- **VER-04 (security-matrix grep):** extended to `NOUSRESEARCH`/`OPENCODE` key-leak scanning
- **VER-05 (live-browser UAT):** the 4-entry selector, Zen/Go captions, Hermes captions, and badge disambiguation — proven via extended Playwright coverage, closing Phase 26's 4 deferred `HUMAN-UAT.md` items — plus the live `json_schema` probe gating the `supportsStructuredOutputs` flip (RUN-06)

**Folded in from Phase 26 debt (not new scope — fixing already-shipped work the verification touches):** CR-01 (save-in-flight race showing a false "Saved." confirmation) and CR-02 (missing `try/catch` around `saveSettingsAction` leaving the form stuck on "Saving…" on transport failure), both in `model-settings-form.tsx`.

**What this phase is NOT:** no new providers, no servable-set changes, no run-path structural changes, no new Settings UI features. This phase mirrors Phase 22 (v1.4's Verification Gate) widened to 4 providers.

</domain>

<decisions>
## Implementation Decisions

### Live E2E Proof Mode (VER-02/03)
- **D-27-01:** Live E2E scope is **the 2 new providers only** — NousResearch and OpenCode get full live proof (VER-02 Analyze round trip + VER-03 child-env isolation). Anthropic and OpenRouter were already proven live in Phase 22 (D-22-01/03) and haven't changed this milestone — re-proving them is not required. Cheaper, still proves everything genuinely new.
- **D-27-02:** **Investigate the currently-failing `openrouter-only-chain.test.ts` as a Phase 27 task**, not a pre-phase blocker or deferred item. Confirmed during Phase 26 execution: the test fails live in this repo (`out.ok: false`, `modelUsed: null`) despite all 4 provider keys being present in `.env.local`; `git diff --stat` against Phase 26's diff confirms zero relationship — this is a pre-existing regression from some other cause (model deprecation, API change, or infra drift), not something Phase 26 touched. Root-causing it IS verification-gate work — either the live chain still works and the test/probe script needs fixing, or something is genuinely broken and that's exactly what this phase exists to catch.
- **D-27-03:** VER-02's live Analyze round trip for NousResearch/OpenCode **reuses/extends Phase 22's same seeded test-domain company** (D-22-02 precedent) — no new fixture, consistent reproducibility.
- **D-27-04:** VER-03 for NousResearch-only and OpenCode-only chains uses the **same child-env spawned-process pattern** as `openrouter-only-chain.test.ts` (D-22-03) — spawn `analyzeCompany` with only the target provider's key set in the child env, assert success + correct `modelUsed`. Two new sibling test files (or an extended shared harness), same `skipIf(!hasLiveKeys)` guard convention.

### structuredOutputs Flip (VER-05/RUN-06)
- **D-27-05:** **Flip `supportsStructuredOutputs` to `true` if the live probe succeeds**, per instance — completes RUN-06's intent this phase rather than deferring the flip to a future change. Three instances (nousresearch, opencode-zen, opencode-go), independently probed.
- **D-27-06:** **Per-instance flip, not all-or-nothing.** Each instance's flag is set based on its own probe result — if NousResearch passes but OpenCode Go doesn't, NousResearch flips and OpenCode Go stays `false`. Matches how `supportsStructuredOutputs` already works as a per-instance constructor flag; no reason to couple unrelated providers' capability.
- **D-27-07:** The probe is a **Vitest live-key test** (`skipIf(!hasLiveKeys)`), consistent with the `openrouter-only-chain.test.ts` precedent — not a standalone manual script. Runs via `npm test`, repeatable, part of the regular suite (skips gracefully in CI/no-keys environments).
- **D-27-08:** The probe validates against the **actual production Zod schema** from `runAgent.ts`'s `Output.object` call — not a toy/minimal schema. Proves the real production path works, not a schema that might pass while the real one fails.

### Browser UAT Scope (VER-05)
- **D-27-09:** **Extend the existing `ver-05-settings.spec.ts` Playwright spec** (real Clerk test account, already provisioned from Phase 22) to cover the 4-provider selector, Zen/Go endpoint captions, Hermes capability captions, and badge disambiguation — becomes a permanent automated regression gate rather than one-off manual verification.
- **D-27-10:** The 4 new/extended Playwright assertions are **designed to explicitly close Phase 26's 4 pending `26-HUMAN-UAT.md` items** (full 4-provider round trip, Zen/Go caption rendering, reset-hint accuracy for the claude-sonnet-4-6 collision, trigger badge accuracy for real collision ids) — 1:1 mapping, not duplicate/parallel coverage. When Phase 27's Playwright spec proves these, Phase 26's HUMAN-UAT.md should be marked resolved as part of this phase's `close_parent_artifacts`-style cleanup (Phase 27 is not itself a `.1` gap-closure phase, so this needs an explicit task, not the automatic parent-UAT resolution step).
- **D-27-11:** **Fix Phase 26's CR-01 and CR-02** (`model-settings-form.tsx` save-in-flight race + missing try/catch) as part of this phase — they directly affect the Save action Phase 27's E2E/Playwright tests exercise, and leaving them unfixed would make the "verification gate" prove a flawed Save path. In scope because it's fixing already-shipped Phase 26 work the verification touches, not adding new capability.

### Matrix Widening Scope (VER-01)
- **D-27-12:** VER-01 is **audit + consolidate only**, mirroring Phase 22's D-22-06 precedent exactly. Phase 25 already built the 16-cell `shouldAdvance` matrix (`modelConfig.test.ts`) and Phase 23/24 already built the hermes collision canaries (`catalog.test.ts`). No rewrites. Verify existing coverage genuinely locks every cell/collision case for all 4 providers, consolidate into a named verification-matrix section if scattered across files, add ONLY genuinely-missing cases.
- **D-27-13:** The opencode dual-listed-id no-flip canary (12 Zen-wins ids, 5 Go-exclusive ids, locked in Phase 23/24) does **not** need an explicit named re-check — it's implicitly covered by "audit existing coverage passes" (running the full suite confirms it, no special-casing needed).

### Claude's Discretion
- Exact file/test placement for the two new child-env isolation tests (D-27-04) — sibling files next to `openrouter-only-chain.test.ts`, or a shared parameterized harness; planner's call, must keep the `skipIf(!hasLiveKeys)` per-provider-key guard pattern.
- The structuredOutputs probe's exact file location and whether it's one file covering all 3 instances or 3 separate probes — planner's call, must satisfy D-27-05..08.
- Root-cause investigation depth for D-27-02 (the failing `openrouter-only-chain.test.ts`) — planner/executor determines whether it's a test bug, an API/model change, or an infra issue, and fixes accordingly; if the underlying live API genuinely regressed (not fixable from this repo), document the finding in VERIFICATION.md rather than force a fix.
- Exact CR-01/CR-02 fix implementation (D-27-11) — planner's call on mechanism (e.g., an in-flight request guard/AbortController for CR-01, a try/catch with error state for CR-02), must not change the Server Action's validated order (requireStaffAccess → zod → servable check → dedupe → upsert).
- How Phase 26's `26-HUMAN-UAT.md` gets marked resolved once Phase 27's Playwright spec proves the 4 items (D-27-10) — planner's call on whether this is a dedicated task or happens naturally as part of writing VERIFICATION.md.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & requirements (locked scope)
- `.planning/ROADMAP.md` §Phase 27 — Goal, Depends on (Phases 23-26), Requirements (VER-01..05), Success Criteria (the 5 must-be-TRUE claims).
- `.planning/REQUIREMENTS.md` — VER-01..05 full text (lines 47-51), traceability table (lines 106-110, all currently `Pending`).

### v1.4 precedent (the direct template for this phase — read first)
- `.planning/milestones/v1.4-phases/22-verification-gate/22-CONTEXT.md` — the entire prior Verification Gate's decisions: D-22-01 (live real-key E2E), D-22-02 (seeded test company), D-22-03 (child-env isolation pattern), D-22-04/05 (Playwright + real Clerk test account), D-22-06 (audit + fill gaps, not rewrite), D-22-07 (security-grep as codified Vitest test).
- `.planning/milestones/v1.4-phases/22-verification-gate/22-VERIFICATION.md` + `22-SUMMARY.md` files — what Phase 22 actually proved and how, for the 2-provider baseline this phase widens.

### Prior phase context (carry-forward)
- `.planning/phases/23-provider-registry-servable-sources/23-CONTEXT.md` — registry decisions VER-01 audits against.
- `.planning/phases/24-refresh-script-catalog-data/24-CONTEXT.md` — D-24-11/12 (canary re-lock, hermes canary group) VER-01 audits.
- `.planning/phases/25-run-path-modelfactory-seam/25-CONTEXT.md` — D-25-01..03 (instance topology, structuredOutputs false-start — this phase's D-27-05..08 completes the deferred flip), D-25-04 (16-cell matrix, verify-only — VER-01's audit target).
- `.planning/phases/26-settings-ui/26-CONTEXT.md` — D-26-01..11 (caption/badge decisions VER-05's Playwright spec proves).
- `.planning/phases/26-settings-ui/26-HUMAN-UAT.md` — the 4 pending items D-27-10 closes.
- `.planning/phases/26-settings-ui/26-REVIEW.md` — CR-01/CR-02 findings D-27-11 fixes.
- `.planning/phases/26-settings-ui/26-VERIFICATION.md` — the human_needed verdict and code-evidence summary this phase's E2E work supersedes with live proof.

### Existing code (integration points + what the matrices must lock)
- `src/lib/models/catalog.ts` — `getServableIdsForProvider`, `getUnionServableIds`, `getProviderForModelId`, `PROVIDER_PRECEDENCE`, `dedupeProviderRows` (Zen-wins).
- `src/lib/models/catalog.test.ts` — existing collision canaries (hermes pair lines ~143-300, opencode dual-listed no-flip) VER-01 audits.
- `src/lib/agents/modelConfig.ts` — `classifyModelError`, `isFailoverEligible`, `shouldAdvance`, `resolveModelChain`.
- `src/lib/agents/modelConfig.test.ts` — the existing 16-cell matrix (lines 151-197, `shouldAdvance — 16-cell matrix ... RUN-04`) VER-01 audits/consolidates.
- `src/lib/agents/modelFactory.ts` — the 3 new openai-compatible instances (nousresearch, opencode-zen, opencode-go) whose `supportsStructuredOutputs` flag D-27-05..08 targets; `instantiateModel` dispatch.
- `src/lib/agents/runAgent.ts` — `Output.object` call (l.74) whose Zod schema D-27-08's probe must round-trip.
- `src/lib/agents/analyzeCompany.ts` — `missingProviderKey` chain-aware gate, the run entry D-27-04's child-env tests spawn against.
- `src/lib/agents/openrouter-only-chain.test.ts` — the exact pattern D-27-04 mirrors; also the currently-failing test D-27-02 investigates.
- `src/lib/verification/security-grep.test.ts` — the existing security-matrix grep VER-04 extends with `NOUSRESEARCH`/`OPENCODE` scanning.
- `e2e/ver-05-settings.spec.ts` + `e2e/auth.setup.ts` + `e2e/.clerk/user.json` — the existing Playwright spec + provisioned test account D-27-09/10 extends.
- `src/components/settings/model-settings-form.tsx` — CR-01/CR-02 fix target (D-27-11): the `handleSave` function (~lines 101-135) and the save-status state machine.
- `src/app/actions/settings.ts` — `saveSettingsAction`: requireStaffAccess FIRST → zod → union servable check → dedupe → atomic upsert — order must not change per D-27-11's discretion note.
- `.env.local` — confirmed present: `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`, `OPENCODE_API_KEY`, `NOUSRESEARCH_API_KEY` all set locally (live E2E/probes are feasible without new credential provisioning).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `openrouter-only-chain.test.ts` — the exact child-env spawn + `skipIf(!hasLiveKeys)` pattern to mirror for D-27-04's two new isolation tests, and the specific file this phase must first debug (D-27-02).
- `src/lib/verification/security-grep.test.ts` — the existing grep-scan harness (client components + Server Action returns + `NEXT_PUBLIC_*`) to extend with 2 more key names.
- `e2e/ver-05-settings.spec.ts` + `e2e/auth.setup.ts` — provisioned Playwright + real Clerk test account, ready to extend without new auth setup.
- `modelConfig.test.ts`'s 16-cell matrix + `catalog.test.ts`'s hermes canaries — both already exist; VER-01 audits rather than builds.

### Established Patterns
- Live-key proof pattern (`hasLiveKeys` guard, child-env isolation) — Phase 22/25's precedent, this phase's D-27-01..04 continues it unchanged.
- Throws-not-degrades / fail-loud — consistent with how the refresh script and env gate behave; D-27-02's investigation should follow this doctrine (find the real cause, don't paper over it).
- Per-instance capability flags (`supportsStructuredOutputs`) — D-27-06 follows the existing per-instance model, not a new coupling pattern.
- "Verification proves, doesn't build" — Phase 22's core discipline (D-22-06); this phase's only genuinely new code is the 2 child-env tests, the structuredOutputs probe, the Playwright extension, the security-grep extension, and the two CR fixes — everything else is audit.

### Integration Points
- `analyzeCompany.ts` → the entry point D-27-04's child-env tests spawn against for NousResearch-only/OpenCode-only proof.
- `modelFactory.ts`'s 3 new instances → D-27-05..08's flip target.
- `model-settings-form.tsx` handleSave → D-27-11's fix target, also the code path D-27-09's extended Playwright spec exercises live.
- `26-HUMAN-UAT.md` → D-27-10's closure target once the Playwright assertions pass.

</code_context>

<specifics>
## Specific Ideas

- The failing `openrouter-only-chain.test.ts` was discovered live during Phase 26's post-merge test gates (both waves) — confirmed via `git diff --stat` to be completely unrelated to Phase 26's file changes. The user wants this treated as real verification-gate work, not swept aside.
- User's steer throughout: default to the Phase 22 precedent wherever a direct analog exists (E2E pattern, child-env isolation, Playwright/Clerk reuse, audit-not-rewrite for matrices) — minimal new invention, maximum consistency with the milestone's own established verification doctrine.
- The two Phase 26 code-review Critical findings (CR-01/CR-02) and the four Phase 26 HUMAN-UAT items are explicitly folded into this phase's scope, not treated as separate future work — the user wants Phase 27 to leave the milestone in a genuinely clean, fully-verified state.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (CR-01/CR-02 and the HUMAN-UAT closure were evaluated as "fixing/proving already-shipped Phase 26 work the verification directly touches," not new capability, and folded in per the user's explicit choice — see D-27-10/11.)

</deferred>

---

*Phase: 27-Verification Gate*
*Context gathered: 2026-08-04*
