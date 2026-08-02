# Phase 18: Verification Gate - Context

**Gathered:** 2026-08-02
**Status:** Ready for planning

<domain>
## Phase Boundary

The milestone's correctness claims are proven — Vitest matrices lock the failover taxonomy and catalog/chain logic (VER-01, VER-02), live-browser UAT proves the settings→Analyze→`model_used` loop end-to-end (VER-03), and a Vercel preview proves the model list renders with no local opencode (VER-04). This is a verification phase: it produces tests, UAT runs, and proof artifacts — not new product features.

Delivers: VER-01..04 (the final phase of milestone v1.3, no phase after it). The verification matrix is built on the `Looks Done But Isn't` checklist already authored in `.planning/research/PITFALLS.md`.

</domain>

<decisions>
## Implementation Decisions

### VER-01 — Failover Matrix (user-discussed)
- **D-18-01:** **Fill the loop-level test gaps and document the matrix.** Existing coverage proves the taxonomy at `classifyModelError` level (400/401/403/422 → input/auth never eligible; output/schema/config errors never eligible; RetryError-429 never; RetryError-5xx eligible; direct 404 eligible; `NoSuchModelError` eligible — all in `modelConfig.test.ts`) and at the `runAgent` loop level (404 advances, 400/429 never advance, exhaustion rethrows last error, RetryError-5xx unwraps, budget clamps). **Missing at loop level:** 401, 403, output/schema errors, and a RetryError-wrapped 404. Phase 18 adds these cases to `runAgent.test.ts` AND writes an explicit VER-01 matrix artifact (requirement → test → assertion mapping) so the failover taxonomy claim is provable at a glance.

### VER-03 — Forced-Fail Proof (user-discussed)
- **D-18-02:** **No forced-fail mechanism is built.** The fallback-serves proof comes from Vitest loop-level tests (RetryError-wrapped 404 advances, chain exhaustion rethrows last error) — NOT from a live-browser forced failure. The live-browser UAT proves only the happy path: Settings → pick primary → save → run Analyze → `agent_run.model_used` reflects the chosen model. **This narrows ROADMAP SC-3's "forced-fail primary shows the fallback serving" clause** — the planner and verifier must treat the Vitest loop tests as the forced-fail evidence and record the SC-3 wording as satisfied-by-extension. Do NOT add an env-var fail hook or a temporary invalid-model trick.

### VER-04 — Vercel Preview (user-discussed)
- **D-18-03:** **PR → Vercel auto-preview.** The phase branch is pushed, a PR opens against main, Vercel's existing GitHub integration builds a preview deployment, and the `/settings` model list is verified on the preview URL (renders from the committed snapshot, no 500, no empty list, zero `opencode/` leakage). No local `vercel` CLI install, no `--prebuilt` flow. Verify the `exec|spawn|child_process` zero-hit grep in `src/` locally as part of the same plan.

### Looks-Done-But-Isn't Checklist (user-discussed)
- **D-18-04:** **Map the existing 12-item checklist, do not rewrite it.** `.planning/research/PITFALLS.md` `## Looks Done But Isn't Checklist` (12 items) is the authoritative list. Phase 18 maps each item onto VER-01..04 as the phase's verification backbone — each becomes an explicit test / UAT line / grep-check in the plan, marked `covered-by-existing-test` vs `new-work`. No new checklist content; the checklist is the traceability anchor.

### Claude's Discretion
- Exact test organization for the VER-01 matrix artifact (single `VER-01-MATRIX.md` vs inline table in a test file) — keep it a phase artifact downstream agents and the verifier can consume.
- VER-02 organization: whether existing `catalog.test.ts` + `modelConfig.test.ts` coverage needs additive cases for the default/partial/full chain matrix or just a mapping artifact (existing 11+12 tests likely already cover the filter + resolution — verify, don't assume).
- Which checklist items are already satisfied by existing tests vs which need new work (the planner maps them; the verifier confirms).
- Whether VER-03's live-browser UAT runs against local dev (`npm run dev`) or the Vercel preview URL — the 16-HUMAN-UAT / 17-UAT precedent used local dev with a staff Clerk account.
- How the deferred human-verify items from Phase 17's form check (17-03 `<human-check>`) are folded into VER-03's live-browser run.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` — Phase 18 goal, success criteria (4 items), requirements VER-01..04, depends-on Phases 15/16/17, last phase of v1.3
- `.planning/REQUIREMENTS.md` — VER-01 through VER-04 definitions (§ Verification gate)

### The checklist (authoritative — mapped, not rewritten)
- `.planning/research/PITFALLS.md` — `## Looks Done But Isn't Checklist` (12 items, ~line 340): the verification backbone Phase 18 maps onto VER-01..04; also Pitfall 10 (settings-never-consumed — the milestone's core acceptance test), Pitfall 5 (audit), Pitfall 8 (no-opencode / no subprocess), Pitfall 9 (snapshot + last-write-wins)

### Prior phase decisions to carry forward
- `.planning/phases/15-model-registry-foundation-persistence/15-CONTEXT.md` — D-02 (roster re-verify standing practice), D-03 (allowlist is the gate, snapshot is the menu), D-16 (Vitest pure functions only, zero live calls)
- `.planning/phases/16-failover-orchestration/16-CONTEXT.md` — D-01 (429/4xx/output/config never advance), D-06 (fail loud, never silent switch), D-08 (chain dedupe), D-10 (primary + 1 fallback cap), snapshot-at-entry chain resolution
- `.planning/phases/17-settings-ui-list-source/17-CONTEXT.md` — D-01..D-15 settings decisions; 17-03's deferred `<human-check>` (the settings form live-browser check folded into VER-03)
- `.planning/PROJECT.md` — Key Decisions: D-14 (DB is durable truth), D-15 (degrade gracefully), D-16 (Vitest pure functions only); v1.3 milestone goal; "Settings-never-consumed risk (Pitfall 10)" must land as a Phase 18 UAT line
- `.planning/STATE.md` — Deferred Items (v1.1/v1.2: 4 partial HUMAN-UAT files, 4 human_needed VERIFICATION files — verify whether Phase 18's live UAT absorbs any)

### Codebase patterns to follow
- `src/lib/agents/runAgent.test.ts` — the existing failover loop test suite (13 tests); Phase 18 ADDS 401/403/output-schema/RetryError-404 loop cases here
- `src/lib/agents/modelConfig.test.ts` — the taxonomy test suite (12 tests); `classifyModelError` / `isFailoverEligible` / `resolveModelChain` already covered
- `src/lib/models/catalog.test.ts` — the catalog filter suite (11 tests); allowlist ∩ snapshot assertions incl. the `!/-20\d{6}/` dated-ID guard
- `src/app/api/companies/[id]/analyze/route.ts` — the analyze route that records `modelUsed` / `modelChain` / `usedFallback` / `modelUsedName` (the VER-03 audit surface)
- `src/lib/db/queries/userModelSettings.ts` — `getModelSettingsForUser` + `upsertModelSettings` (the settings row VER-03's `model_used` comparison reads)
- `.vercel/project.json` — Vercel project `360-arclumen` (prj_DbEzimzON9nzF7Nmk7Nueta7k00V), Node 24.x runtime, linked for PR auto-preview

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `runAgent.test.ts` / `modelConfig.test.ts` / `catalog.test.ts`: three existing suites that already prove most of VER-01/VER-02 — the planner should map before adding
- `17-UAT.md`: the Phase 17 settings UAT (6 tests, all passed) — the settings surface is already human-verified; VER-03 extends to the Analyze loop
- `16-HUMAN-UAT.md`: partial — 2 pending items from the failover phase (live-browser strip rendering, live-run audit trail) that VER-03's live run can absorb
- `deploy-to-vercel` / `vercel-cli-with-tokens` skills (user): available if the PR auto-preview needs a nudge, but D-18-03 prefers the GitHub integration path

### Established Patterns
- Vitest, pure functions only, zero live calls (Phase 15 D-16) — VER-01/VER-02 follow; VER-03's live run is the deliberate exception
- Fail loud on non-failover errors (Phase 16 D-06) — what the 400/401/403 loop-level tests must assert
- `{ ok } | { ok: false, reason }` Server Action pattern (reviews/settings) — how the analyze route's structured errors surface

### Integration Points
- The `agent_run` table (`model_used`, `model_chain`, `usedFallback`) — VER-03's assertion target
- `/settings` page + `saveSettingsAction` — the user-facing entry that feeds the chain VER-03 verifies
- Vercel preview build — VER-04's proof target (renders `/settings` model list from committed `catalog.json`)

</code_context>

<specifics>
## Specific Ideas

- The VER-01 matrix should be readable as "requirement → test → assertion" so a reviewer can confirm every failover claim in one artifact.
- VER-03's happy-path assertion is exactly Pitfall 10's wording: change primary → run Analyze → `agent_run.model_used` equals the saved primary.
- The `exec|spawn|child_process` zero-hit grep in `src/` (VER-04 / checklist item 11) is cheap and already proven in earlier phases — re-run as a gate.

</specifics>

<deferred>
## Deferred Ideas

- **Live forced-fail UAT** (browser-level proof that a failing primary serves a fallback): user chose Vitest-only proof for VER-03 (D-18-02). If a future milestone wants browser-level failover proof, it belongs in a new phase (needs an env-gated fail hook or test infrastructure).
- **`--prebuilt` / local-CLI deploy flow** for future previews: D-18-03 chose PR auto-preview; the CLI flow stays available via the `vercel-cli-with-tokens` skill if the GitHub integration ever needs a fallback.

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 18-Verification Gate*
*Context gathered: 2026-08-02*
