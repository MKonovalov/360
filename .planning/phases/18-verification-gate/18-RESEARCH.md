# Phase 18: Verification Gate - Research

**Researched:** 2026-08-02
**Domain:** Verification-only phase — Vitest matrices, live-browser UAT, deployed-environment proof, checklist traceability
**Confidence:** HIGH (all claims ground-truthed against the actual codebase in this session)

## Summary

Phase 18 is a verification gate, not a feature phase: it proves the v1.3 milestone's correctness claims via (a) Vitest loop-level tests filling 4 failover-taxonomy gaps, (b) a VER-01 matrix artifact mapping requirement → test → assertion, (c) a live-browser settings→Analyze→`model_used` UAT, and (d) a Vercel-preview no-opencode proof. Every claim in CONTEXT.md's D-18-01..04 was verified against source in this session; the research found **two count discrepancies** (checklist is 13 items not 12; `catalog.test.ts` has 9 tests not 11) that the planner must carry into the matrix artifact, plus three coverage-verdict corrections (partial-chain and real-snapshot gaps in VER-02, the `usedFallback`-is-response-only nuance for the VER-03 audit assertion, and the integration-test self-skip caveat for the concurrent-save checklist item).

**Primary recommendation:** One plan (`18-01-PLAN.md`) executing four tasks in dependency order — (1) add the 4 missing loop-level tests to `runAgent.test.ts` (401, 403, output/schema, RetryError-404) + optionally the real-snapshot catalog test, (2) author the `18-VER-01-MATRIX.md` artifact mapping the 13-item PITFALLS checklist onto VER-01..04, (3) run the live-browser UAT absorbing the 16-HUMAN-UAT and 17-03 deferred items, (4) open the PR → Vercel preview + zero-hit grep gate. No new packages, no forced-fail mechanism, no checklist rewrite.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Failover taxonomy proof (VER-01) | API / Backend (pure module tests) | — | `classifyModelError`/`isFailoverEligible` are pure functions in `src/lib/agents/modelConfig.ts` (D-16); Vitest is the only proof tier — zero live calls |
| Failover loop behavior (VER-01) | API / Backend (seam test) | — | `runAgent` is the mockable seam (09-01-01 anchor); loop tests mock `generateText`/`@ai-sdk/anthropic` — no live provider |
| Catalog filter + chain resolution (VER-02) | API / Backend (pure module tests) | Data layer (committed snapshot) | `getAllowlistedServableIds`/`opencodeSlugToModelId`/`resolveModelChain` are pure; the committed `catalog.json` is the fixture of record |
| Settings→Analyze→audit loop (VER-03) | Browser / Client → API / Backend | Database / Storage | UAT drives the UI (`/settings` form + company detail Analyze button); the assertion target is the `agent_run` row (`model_used`/`model_chain`) — the DB is the durable truth (D-14) |
| No-opencode deployed proof (VER-04) | CDN / Static (Vercel preview) | API / Backend | The preview build must render `/settings` from the committed snapshot with zero local opencode — the grep gate is local, the render proof is on the deployed URL |
| Checklist traceability (D-18-04) | Planning artifact | — | The 13-item PITFALLS checklist maps onto VER-01..04; no new checklist content |

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-18-01 (VER-01):** **Fill the loop-level test gaps and document the matrix.** Existing coverage proves the taxonomy at `classifyModelError` level (400/401/403/422 → input/auth never eligible; output/schema/config errors never eligible; RetryError-429 never; RetryError-5xx eligible; direct 404 eligible; `NoSuchModelError` eligible — all in `modelConfig.test.ts`) and at the `runAgent` loop level (404 advances, 400/429 never advance, exhaustion rethrows last error, RetryError-5xx unwraps, budget clamps). **Missing at loop level:** 401, 403, output/schema errors, and a RetryError-wrapped 404. Phase 18 adds these cases to `runAgent.test.ts` AND writes an explicit VER-01 matrix artifact (requirement → test → assertion mapping) so the failover taxonomy claim is provable at a glance.
- **D-18-02 (VER-03):** **No forced-fail mechanism is built.** The fallback-serves proof comes from Vitest loop-level tests (RetryError-wrapped 404 advances, chain exhaustion rethrows last error) — NOT from a live-browser forced failure. The live-browser UAT proves only the happy path: Settings → pick primary → save → run Analyze → `agent_run.model_used` reflects the chosen model. **This narrows ROADMAP SC-3's "forced-fail primary shows the fallback serving" clause** — the planner and verifier must treat the Vitest loop tests as the forced-fail evidence and record the SC-3 wording as satisfied-by-extension. Do NOT add an env-var fail hook or a temporary invalid-model trick.
- **D-18-03 (VER-04):** **PR → Vercel auto-preview.** The phase branch is pushed, a PR opens against main, Vercel's existing GitHub integration builds a preview deployment, and the `/settings` model list is verified on the preview URL (renders from the committed snapshot, no 500, no empty list, zero `opencode/` leakage). No local `vercel` CLI install, no `--prebuilt` flow. Verify the `exec|spawn|child_process` zero-hit grep in `src/` locally as part of the same plan.
- **D-18-04:** **Map the existing 12-item checklist, do not rewrite it.** `.planning/research/PITFALLS.md` `## Looks Done But Isn't Checklist` (12 items) is the authoritative list. Phase 18 maps each item onto VER-01..04 as the phase's verification backbone — each becomes an explicit test / UAT line / grep-check in the plan, marked `covered-by-existing-test` vs `new-work`. No new checklist content; the checklist is the traceability anchor.

> ⚠️ **Researched correction to D-18-04:** the checklist at `PITFALLS.md:345` contains **13 items** (lines 347–359), not 12. See Common Pitfall 1. The mapping covers all 13.

### Claude's Discretion

- Exact test organization for the VER-01 matrix artifact (single `VER-01-MATRIX.md` vs inline table in a test file) — keep it a phase artifact downstream agents and the verifier can consume.
- VER-02 organization: whether existing `catalog.test.ts` + `modelConfig.test.ts` coverage needs additive cases for the default/partial/full chain matrix or just a mapping artifact (existing 11+12 tests likely already cover the filter + resolution — verify, don't assume).
- Which checklist items are already satisfied by existing tests vs which need new work (the planner maps them; the verifier confirms).
- Whether VER-03's live-browser UAT runs against local dev (`npm run dev`) or the Vercel preview URL — the 16-HUMAN-UAT / 17-UAT precedent used local dev with a staff Clerk account.
- How the deferred human-verify items from Phase 17's form check (17-03 `<human-check>`) are folded into VER-03's live-browser run.

### Deferred Ideas (OUT OF SCOPE)

- **Live forced-fail UAT** (browser-level proof that a failing primary serves a fallback): user chose Vitest-only proof for VER-03 (D-18-02). If a future milestone wants browser-level failover proof, it belongs in a new phase (needs an env-gated fail hook or test infrastructure).
- **`--prebuilt` / local-CLI deploy flow** for future previews: D-18-03 chose PR auto-preview; the CLI flow stays available via the `vercel-cli-with-tokens` skill if the GitHub integration ever needs a fallback.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VER-01 | Vitest covers the failover matrix — 401/403 and output/schema errors do NOT advance the chain, retryable connection/model-not-found errors DO, and the chain exhausts to the last model | Loop-level gaps confirmed and specified (4 new tests, exact describe block + assertion shapes in Code Examples); taxonomy level fully covered (7 `classifyModelError` + 7 loop tests already exist) |
| VER-02 | Vitest locks the catalog filter (allowlist ∩ snapshot → servable provider IDs) and the model-chain resolution (default, partial, full chains) | Filter + dated-ID/no-opencode guard covered (catalog.test.ts, 9 tests — count corrected from claimed 11); resolution covered (modelConfig.test.ts, 5 `resolveModelChain` tests); 2 optional additive cases identified (real-snapshot test, explicit partial-chain test) |
| VER-03 | Live-browser UAT proves the end-to-end flow: Settings → pick primary + fallback → save → run Analyze → `model_used` reflects the chosen model (and a fallback when the primary is forced to fail) | Audit surface confirmed end-to-end (route.ts:107-115 → createRun → `agent_run.model_used`/`model_chain`, schema.ts:247-248); `usedFallback` is response-only (not a DB column — assertion nuance); absorbs 16-HUMAN-UAT 2 pending items + 17-03 deferred `<human-check>`; forced-fail clause satisfied-by-extension via Vitest (D-18-02) |
| VER-04 | The deployed (Vercel preview) app loads the model list without any local opencode — committed snapshot fallback works | Zero-hit grep verified in this session (0 × `child_process`, 0 × `spawn(`/`exec(` in src/); snapshot source confirmed (`src/lib/models/catalog.json`, 1131 models, committed); `.vercel/project.json` links project 360-arclumen (Node 24.x); PR-preview path via Vercel GitHub integration (dashboard config not repo-verifiable — LOW-risk checkpoint with CLI fallback) |
</phase_requirements>

## Standard Stack

### Core — Verification Tooling (no new packages)
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| Vitest | 4.1.10 (installed) | Unit/matrix tests for VER-01/02 | Repo-wide convention since Phase 9 (D-16: pure functions, zero live calls); 30 test files already run under it |
| `npm test` | — | `vitest run` (package.json:14) | The full-suite gate — checklist item 12 ("existing tests still pass") |
| grep (zero-hit gate) | — | `grep -rE "node:child_process\|execFileSync(\|execSync(\|spawnSync(\|spawn\(" src/` → 0 hits | Exact command established in 15-VERIFICATION Truth 8; re-run as the VER-04 gate |
| gh CLI | 2.96.0 (installed) | PR creation for D-18-03 preview flow | `gh pr create` from the phase branch |
| Postgres (psql/Neon) | — | VER-03 UAT assertion target | Query `agent_run` row after Analyze to prove `model_used` matches the saved primary |

### Supporting — Phase-artifact conventions
| Artifact | Precedent | When to Use |
|----------|-----------|-------------|
| `NN-UAT.md` | `17-UAT.md` (6 numbered tests, expected/result), `16-HUMAN-UAT.md` | VER-03's live run records into `18-UAT.md` (extends 17-UAT's settings surface to the Analyze loop) |
| `NN-VERIFICATION.md` | `15-VERIFICATION.md` (YAML frontmatter + Observable Truths table + human_verification items), `16-VERIFICATION.md` (human_needed, 2 items) | The phase-gate evidence artifact; VER-03's live run closes 16-VERIFICATION's 2 pending items |
| `NN-VALIDATION.md` | `16-VALIDATION.md` (YAML frontmatter: phase/slug/status/nyquist_compliant/wave_0_complete + validation contract) | Produced by this phase's Validation Architecture section |
| `VER-01-MATRIX.md` | No direct precedent — nearest are the 17-UAT numbered lists and 15-VERIFICATION truth tables | The NEW explicit matrix artifact (D-18-01): requirement → test file → describe block → test name → assertion |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vitest (existing) | New test framework (Jest/Playwright unit) | Zero reason — Vitest 4.1.10 installed, 287 `it()` already in the suite, vitest.config.ts exists |
| PR → Vercel auto-preview (D-18-03) | `vercel deploy --prebuilt` via CLI | Rejected by user decision; CLI (54.0.0 installed) stays as fallback only |
| Vitest-only forced-fail proof (D-18-02) | Env-gated fail hook / invalid-model trick | Explicitly rejected — would add test-only surface to production code |
| 13-item checklist mapping (D-18-04) | Rewritten checklist | Explicitly rejected — the PITFALLS.md list is the traceability anchor |

**Installation:** none — this phase installs zero packages. Do not add a package to "make verification easier" (no Playwright, no supertest, no new assertion libs — the existing Vitest + mockable-seam pattern covers everything, per D-16).

## Package Legitimacy Audit

> Phase 18 installs **no external packages** — it adds tests, a matrix artifact, UAT runs, and grep gates to the existing codebase. The Package Legitimacy Gate protocol (slopcheck) is therefore vacuous for this phase; the only packages involved are already-installed devDependencies (`vitest@4.1.10`) with 30 consumer test files in-repo. No `[SLOP]`/`[SUS]` dispositions apply. If the planner is tempted to add a package during planning, it must first pass the gate in a follow-up research pass.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| vitest 4.1.10 | npm (installed devDep) | established | high | github.com/vitest-dev/vitest | [OK] | No action — already installed, no install task |
| gh 2.96.0 | Homebrew (installed) | established | — | github.com/cli/cli | [OK] | No action — CLI, not a repo dep |

**Packages removed due to slopcheck [SLOP] verdict:** none (no packages proposed)
**Packages flagged as suspicious [SUS]:** none
**Planner instruction:** add a `checkpoint:human-verify` task *only if* planning introduces a package — which this research recommends against.

## Architecture Patterns

### System Diagram — Phase 18 Verification Flow

```text
 ┌───────────────────────────── Phase 18: Verification Gate ─────────────────────────────┐
 │                                                                                        │
 │  VER-01 (Vitest, automated)          VER-02 (Vitest, automated)                        │
 │  ┌──────────────────────────┐        ┌──────────────────────────────┐                  │
 │  │ modelConfig.test.ts (12) │        │ catalog.test.ts (9)          │                  │
 │  │  classifyModelError 7 ✓  │        │  slug filter 4 ✓             │                  │
 │  │  resolveModelChain 5 ✓   │        │  allowlist∩snapshot 1 ✓      │                  │
 │  └──────────────────────────┘        │  allowlist/FAST 2 ✓          │                  │
 │  ┌──────────────────────────┐        │  displayName 2 ✓             │                  │
 │  │ runAgent.test.ts (13)    │        └──────────────────────────────┘                  │
 │  │  happy path 4 ✓          │        (fixture-based — see Pitfall 4)                   │
 │  │  loop: 404✓ 400✓ 429✓    │        + settings.test.ts (7, action gate)               │
 │  │  exhaust✓ budget✓ clamp✓ │                                                    │
 │  │  RetryError-5xx✓         │        → optional additive: real-snapshot test            │
 │  │  NEW: 401, 403, output/  │        → 18-VER-02 mapping (matrix row in artifact)       │
 │  │        schema, RetryErr- │                                                          │
 │  │        404  ← +4 tests   │                                                          │
 │  └──────────────────────────┘                                                          │
 │            │ npm test (vitest run) → full suite green (≈291 its after +4)              │
 │            ▼                                                                           │
 │  18-VER-01-MATRIX.md  ← 13-item PITFALLS checklist mapped (D-18-04), each              │
 │  item marked covered-by-existing-test | new-work with file/UAT-line/grep proof          │
 │                                                                                        │
 │  VER-03 (live browser, human)          VER-04 (deployed, human+gate)                   │
 │  npm run dev + staff Clerk acct        git push → PR → Vercel GitHub integration        │
 │  /settings → pick primary+fallback     → preview URL → /settings renders from           │
 │  → save → Analyze on a company          committed catalog.json (no 500, no empty)       │
 │  → agent_run.model_used == saved        zero opencode/ leakage                          │
 │  primary; model_chain == snapshot       local gate: grep exec|spawn|child_process       │
 │  absorbs 16-HUMAN-UAT 2 items +         in src/ → 0 hits (re-verified)                  │
 │  17-03 <human-check>                                                                    │
 │                                                                                        │
 └────────────────────────────────────────────────────────────────────────────────────────┘
```

The three proof tiers are independent in evidence but chained in ordering: VER-01/02 Vitest green before the VER-01 matrix is authored; the matrix before the live UAT (so UAT asserts the checklist rows); the live UAT before the PR/VER-04 (so the preview is the final proof). Each checklist item lands in exactly one proof surface.

### Recommended Project Structure (new files this phase)

```text
.planning/phases/18-verification-gate/
├── 18-RESEARCH.md            # this file
├── 18-CONTEXT.md             # locked decisions (exists)
├── 18-VER-01-MATRIX.md       # NEW — D-18-01: requirement → test → assertion, 13-item checklist map
├── 18-UAT.md                 # NEW — VER-03 live run (17-UAT.md format: numbered tests, expected/result)
├── 18-VALIDATION.md          # NEW — validation contract (16-VALIDATION.md format)
└── 18-VERIFICATION.md        # NEW — phase gate evidence (15/16-VERIFICATION.md format)

src/lib/agents/runAgent.test.ts   # EDIT — +4 loop tests (401, 403, output/schema, RetryError-404)
src/lib/models/catalog.test.ts    # EDIT (optional) — real-snapshot test for getAllowlistedServableIds
```

### Pattern 1: The mockable-seam test pattern (runAgent loop)
**What:** Mock `ai`'s `generateText` + `Output.object` factory and `@ai-sdk/anthropic`'s model constructor; keep the real error classes (`APICallError`/`RetryError` via `importOriginal` spread) so `classifyModelError` (unmocked) classifies them by marker + statusCode. Reject-once-then-resolve proves advancement; reject-only proves fail-loud.
**When to use:** Any VER-01 loop-level case. The 4 new tests go in the existing `describe('runAgent failover loop (FAL-03/04)')` block (runAgent.test.ts:124) — do NOT create a new describe block or file.
**Example (source: `src/lib/agents/runAgent.test.ts:136-171`, existing patterns to mirror):**
```typescript
const apiErr = (statusCode: number) =>
  new APICallError({ message: `http ${statusCode}`, url: 'u', requestBodyValues: {}, statusCode });

// 400 pattern to mirror for 401/403:
it('400 never advances — single attempt, throws (Pitfall 2)', async () => {
  mocks.generateText.mockRejectedValueOnce(apiErr(400));
  await expect(
    runAgent({ company, liveSignals: [], models: [mocks.anthropic(), mocks.anthropic()] }),
  ).rejects.toThrow();
  expect(mocks.generateText).toHaveBeenCalledTimes(1);
});
```

### Pattern 2: Phase-artifact evidence format
**What:** `15-VERIFICATION.md` / `17-UAT.md` define the house format: YAML frontmatter (status, phase, source, timestamps) + numbered evidence items with `expected` / `result` fields, plus a Summary block with totals. VER-03's UAT and the VER-01 matrix follow these shapes so downstream agents and the verifier can consume them.
**When to use:** All new Phase-18 artifacts.

### Anti-Patterns to Avoid
- **New describe block or new test file for the 4 loop cases:** they belong in the existing `runAgent failover loop (FAL-03/04)` block — a new file fragments the seam's mock setup.
- **Asserting `used_fallback` as a DB column:** `usedFallback` exists only in the analyze route's 201 response (route.ts:111); the durable proof is `model_used` (= fallback's raw id when a fallback served) plus `model_chain` (= the attempted set including the dead primary). UAT assertions must target the DB columns.
- **Deleting/weakening the default-model test:** checklist item 12 explicitly pins `runAgent.test.ts:113` (`anthropic('claude-sonnet-4-6')`) — update deliberately, never delete.
- **Re-running the full grep with a sloppy pattern:** use the exact 15-VERIFICATION Truth 8 command so the 0-hit result is comparable across phases.
- **Forced-fail mechanism in prod code:** D-18-02 forbids env-var fail hooks and invalid-model tricks — the Vitest loop tests are the forced-fail evidence.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Forced-fail browser proof (VER-03 SC-3 clause) | Env-gated `ANALYZE_FORCE_PRIMARY_FAIL` hook or temporary invalid-model catalog entry | Existing Vitest loop tests (RetryError-404 advances; exhaustion rethrows last error) | D-18-02 locked; a fail hook adds test-only surface to production code and an invalid model pollutes the committed snapshot |
| New failover taxonomy | Rewrite/extend `classifyModelError` | Existing `modelConfig.ts` classifier — add only loop-level TESTS | The taxonomy is complete and 7× covered; VER-01's gap is test coverage, not logic |
| New checklist | 13-item rewrite of PITFALLS.md | Map the existing checklist onto VER-01..04 (D-18-04) | The checklist is the traceability anchor; rewriting breaks cross-phase provenance |
| Preview deployment | Local `vercel` CLI + `--prebuilt` flow | Vercel GitHub integration PR auto-preview | D-18-03 locked; CLI (54.0.0, installed) is the fallback only |
| Integration-test DB harness | Point integration tests at prod `DATABASE_URL` | Respect the `describeWithDatabase` self-skip (TEST_DATABASE_URL) | The 15-VERIFICATION executed the concurrent-save case 4/4 against a test DB; plain `npm test` skips it — cite that evidence |

**Key insight:** This is a verification phase — the only "new code" is tests. Every temptation to add a mechanism (fail hook, new deploy path, new checklist, new framework) was explicitly rejected in discuss-phase. The plan should be ~90% "run these existing gates and record the evidence."

## Runtime State Inventory

> Omit-for-greenfield does not apply (this is not a rename/refactor phase), but the verification gate touches runtime state — a short inventory of what the UAT/verification reads is required for accurate planning.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `agent_run` rows (model_used text, model_chain jsonb — schema.ts:247-248); `user_model_settings` rows (primary_model text, fallback_models text[] — schema.ts:288-296) | VER-03 UAT reads a live `agent_run` row after Analyze; VER-02 real-snapshot test reads committed `catalog.json` (no DB) |
| Live service config | Vercel project `360-arclumen` (`.vercel/project.json`: prj_DbEzimzON9nzF7Nmk7Nueta7k00V, Node 24.x); GitHub remote `MKonovalov/360` | None changed — VER-04 uses existing linkage; PR-preview config lives in the Vercel dashboard (not repo-verifiable — see Open Question 4) |
| OS-registered state | None | — |
| Secrets/env vars | `.env.local` has real keys (DATABASE_URL, Clerk, ANTHROPIC_API_KEY, FIRECRAWL_API_KEY, Langfuse) | VER-03 requires these for the live loop; `TEST_DATABASE_URL` unset → integration tests self-skip (do not change this) |
| Build artifacts | `src/lib/models/catalog.json` (committed, 1131 models, generatedAt 2026-08-02T09:33:54.568Z) | VER-04's render source; no regeneration this phase (regenerating would drift `generatedAt`) |

## Common Pitfalls

### Pitfall 1: The checklist is 13 items, not 12
**What goes wrong:** CONTEXT D-18-04 and the discussion log say "12 items"; the actual PITFALLS.md:345 checklist has **13** (verified by direct line count, lines 347–359). A matrix artifact written for 12 would silently drop "Failover is observable in the trace."
**Why it happens:** The checklist grew (last item added ~Phase 16 planning) and the count was carried forward from memory.
**How to avoid:** The matrix artifact must map all 13 items — copy the list verbatim from PITFALLS.md:347-359 and mark each row; do not trust the "12" in any prior doc.
**Warning signs:** A matrix with exactly 12 rows; the last item missing from the map.

### Pitfall 2: `catalog.test.ts` has 9 tests, not the claimed 11
**What goes wrong:** CONTEXT (canonical refs) and the research brief both claim 11 tests. Verified count: **9** (4 slug-filter + 1 allowlist∩snapshot + 1 allowlist + 1 FAST_MODEL_ID + 2 displayName). Phase-15 VERIFICATION said 6 — the file grew since.
**Why it happens:** The claim was written from memory during discuss-phase.
**How to avoid:** Use the verified 9 in the VER-02 matrix rows; the coverage verdict (filter + guards covered) is unchanged, but the count must be right in the artifact.
**Warning signs:** Any artifact quoting "11 tests in catalog.test.ts".

### Pitfall 3: Integration tests self-skip — the concurrent-save evidence is a skipped suite in plain `npm test`
**What goes wrong:** Checklist item "Concurrent saves don't lose updates" is proven by `userModelSettings.integration.test.ts` (Promise.all concurrent upserts never half-merge — 15-VERIFICATION Truth 1), but that suite `describe.skip`s without `TEST_DATABASE_URL`. A verifier running plain `npm test` sees it skipped and may mark the item unproven.
**Why it happens:** D-16 zero-live-call discipline + no test DB configured.
**How to avoid:** Matrix row must cite the 15-VERIFICATION executed run (4/4, 2026-08-02) as the evidence, or the planner adds an optional task to run the integration suite against a writable test DB. Do not point it at the live `DATABASE_URL`.
**Warning signs:** `npm test` output shows "skipped" for userModelSettings.integration.test.ts and the matrix row cites it as green.

### Pitfall 4: Fixture-based catalog tests don't prove the committed snapshot
**What goes wrong:** `catalog.test.ts` uses an inline 4-model fixture (deliberately decoupled, D-16) — it proves the filter semantics but NOT that the committed 1131-model `catalog.json` yields exactly `['claude-sonnet-4-6']` with zero leakage. The real-snapshot execution happened ad-hoc in 15-VERIFICATION Truth 6, not as a test.
**Why it happens:** The fixture convention avoids snapshot drift on refresh (test comment lines 11-13).
**How to avoid:** Optional additive test: `expect(getAllowlistedServableIds(catalogJson)).toEqual(['claude-sonnet-4-6'])` in `catalog.test.ts` — cheap, pins the shipped artifact against drift, directly proves CAT-03/SET-07's no-leakage claim (recommended; planner's discretion).
**Warning signs:** VER-02 matrix claims "no opencode/ leakage" citing only the fixture test.

### Pitfall 5: `usedFallback` is response-only — don't assert a DB column for it
**What goes wrong:** VER-03's fallback assertion could look for a `used_fallback` column that doesn't exist. `agent_run` carries only `model_used` + `model_chain`; `usedFallback` rides the 201 response body (route.ts:111) and `modelUsedName` is server-computed display text (:112).
**Why it happens:** REG-04 scoped the durable columns to model_used/model_chain; the boolean was a UI convenience.
**How to avoid:** UAT asserts: (a) happy path — `model_used` == saved primary id; (b) fallback-eligibility proof — Vitest loop tests (D-18-02). If the live run happens to serve a fallback naturally, assert `model_used` == the fallback id in `model_chain`.
**Warning signs:** A UAT step that queries `agent_run.used_fallback`.

### Pitfall 6: ROADMAP SC-3's forced-fail clause reads unmet without the satisfied-by-extension record
**What goes wrong:** ROADMAP:146 says "a forced-fail primary shows the fallback serving and recorded." With D-18-02 there is no browser-level forced fail — a naive verifier flags SC-3 unmet.
**Why it happens:** SC-3 was written before the discuss-phase narrowed the proof to Vitest.
**How to avoid:** The plan and the VERIFICATION artifact must explicitly record "SC-3 forced-fail clause satisfied-by-extension via runAgent.test.ts RetryError-404 + exhaustion tests (D-18-02)".
**Warning signs:** VERIFICATION.md lacks any SC-3 disposition note.

### Pitfall 7: Stale CLAUDE.md stack block (Astro-era) can confuse the preview/grep work
**What goes wrong:** CLAUDE.md's GSD:stack section describes Astro + `@astrojs/vercel` pinned `nodejs20.x` — the repo migrated to Next.js 16.2.11 (package.json:34). The Vercel project runs Node 24.x per `.vercel/project.json`.
**Why it happens:** CLAUDE.md stack was captured at the Astro migration and not regenerated.
**How to avoid:** Ignore the nodejs20.x adapter references for this phase; the VER-04 preview builds under the Next.js preset with Node 24.x (project setting). Not Phase 18's job to fix CLAUDE.md (out of scope), but don't let it drive decisions.
**Warning signs:** A plan that pins a Node 20 runtime for the preview build.

## Code Examples

Verified patterns from the actual test suite (all shapes below are copy-adaptable into `runAgent.test.ts`):

### 1. 401 never advances (loop level) — mirrors the existing 400 test (runAgent.test.ts:164-171)
```typescript
// Add to describe('runAgent failover loop (FAL-03/04)') — runAgent.test.ts:124
it('401 never advances — single attempt, throws (Pitfall 2)', async () => {
  mocks.generateText.mockRejectedValueOnce(apiErr(401));
  await expect(
    runAgent({ company, liveSignals: [], models: [mocks.anthropic(), mocks.anthropic()] }),
  ).rejects.toThrow();
  expect(mocks.generateText).toHaveBeenCalledTimes(1);
});
```
**Assertion contract:** `classifyModelError(apiErr(401)) === 'auth'` → `isFailoverEligible('auth') === false` → loop `throw err` on attempt 0 (runAgent.ts:89). Assert: rejects + exactly 1 call + the 2-model chain never attempted.

### 2. 403 never advances (loop level) — identical shape to 401
```typescript
it('403 never advances — single attempt, throws (Pitfall 2)', async () => {
  mocks.generateText.mockRejectedValueOnce(apiErr(403));
  await expect(
    runAgent({ company, liveSignals: [], models: [mocks.anthropic(), mocks.anthropic()] }),
  ).rejects.toThrow();
  expect(mocks.generateText).toHaveBeenCalledTimes(1);
});
```

### 3. Output/schema error never advances (loop level) — real SDK instance, constructor shape verified in modelConfig.test.ts:80
```typescript
it('output/schema errors never advance — single attempt, throws (D-01)', async () => {
  mocks.generateText.mockRejectedValueOnce(new InvalidResponseDataError({ data: {} }));
  await expect(
    runAgent({ company, liveSignals: [], models: [mocks.anthropic(), mocks.anthropic()] }),
  ).rejects.toThrow();
  expect(mocks.generateText).toHaveBeenCalledTimes(1);
});
```
Import `InvalidResponseDataError` alongside `APICallError, RetryError` at runAgent.test.ts:2 (it survives the `importOriginal` spread — same mechanism that keeps RetryError real, test comment lines 132-135).

### 4. RetryError-wrapped 404 advances (loop level) — mirrors the RetryError-5xx test (runAgent.test.ts:217-236)
```typescript
it('RetryError-wrapped 404 unwraps to model_not_found and still advances (Pitfall 3)', async () => {
  mocks.generateText
    .mockRejectedValueOnce(
      new RetryError({
        message: 'max retries exceeded',
        reason: 'maxRetriesExceeded',
        errors: [apiErr(404)],
      }),
    )
    .mockResolvedValueOnce(resolvedRun);

  const result = await runAgent({
    company,
    liveSignals: [],
    models: [mocks.anthropic(), mocks.anthropic()],
  });

  expect(mocks.generateText).toHaveBeenCalledTimes(2);
  expect(result).toEqual({ ...resolvedRun, modelUsed: 'claude-sonnet-4-6', usedFallback: true });
});
```
**Why this passes with zero classifier changes:** `classifyModelError` unwraps `RetryError.isInstance(err)` → recurses on `err.lastError` (modelConfig.ts:34-35) → the inner `APICallError(404)` maps to `'model_not_found'` (:43) → `isFailoverEligible` true (:65-67). Verified correct by code inspection this session; the taxonomy level tests 429/5xx wrappers but NOT a wrapped 404 — the loop test closes that.

### 5. Optional VER-02 real-snapshot test (catalog.test.ts) — proves the shipped artifact, not just the fixture
```typescript
// Add to describe('getAllowlistedServableIds') — catalog.test.ts:78
it('committed 1131-model snapshot yields exactly the servable allowlist — zero leakage (CAT-03)', () => {
  // import catalogJson from './catalog.json' at top of file (catalog.ts:1 pattern)
  expect(getAllowlistedServableIds(catalogJson)).toEqual(['claude-sonnet-4-6']);
  expect(getAllowlistedServableIds(catalogJson).some((id) => id.includes('/'))).toBe(false);
});
```

### 6. Optional VER-02 explicit partial-chain test (modelConfig.test.ts) — completes the default/partial/full matrix
```typescript
// Add to describe('resolveModelChain') — modelConfig.test.ts:112
it('a partial chain (primary + one fallback) passes through intact when allowlisted', () => {
  expect(
    resolveModelChain({ primaryModel: 'a', fallbackModels: ['b'] }, ['a', 'b']),
  ).toEqual(['a', 'b']);
});
```
Coverage verdict: default (modelConfig.test.ts:113) and full/capped (:123) are covered; this fills the clean partial-cell (existing dedupe/allowlist-drop tests are partial-adjacent but not a clean pass-through).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Ad-hoc real-snapshot verification (15-VERIFICATION Truth 6 executed `getAllowlistedServableIds(catalogJson)` once by hand) | Committed test against the real snapshot (optional additive, Code Example 5) | Phase 18 | Leakage claims become continuously provable, not one-shot |
| Forced-fail browser UAT | Vitest loop tests as the forced-fail evidence (D-18-02) | Phase 18 discussion | Narrower but reproducible proof; SC-3 satisfied-by-extension |
| 12-item checklist count | 13-item checklist (actual) | Pre-Phase-18 (item added during Phase 16) | Matrix artifact must cover all 13 |
| Node 20 pin (Astro era, CLAUDE.md stale) | Node 24.x on Vercel project, Node 22.x local engines | Migration to Next.js | Ignore stale adapter pin for preview work |

**Deprecated/outdated:**
- `claude-sonnet-4-20250514` (dated ID — 404s on the live roster; replaced by `claude-sonnet-4-6`, catalog.ts:16-23) — do not appear in any test fixture or allowlist assertion.
- The `isRetryable || 404` failover example in ARCHITECTURE.md — superseded by D-01/D-03 (would advance on 429); modelConfig.ts:61-64 carries the why-comment. Do not copy it into new tests.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The Vercel GitHub integration on project `360-arclumen` auto-builds previews for PRs against `MKonovalov/360` | VER-04 | Not repo-verifiable (dashboard config). If absent, the PR has no preview URL → fallback is the installed `vercel` CLI 54.0.0 + `vercel-cli-with-tokens` skill. Mitigate with a plan checkpoint after PR creation: "preview URL appears within ~2 min, else use CLI fallback" |
| A2 | A staff Clerk account + real keys in `.env.local` are sufficient for the VER-03 live run (17-UAT precedent: local dev, staff account) | VER-03 | If `.env.local` lacks Anthropic/Firecrawl keys, Analyze returns `not_configured` (analyzeCompany.ts:44) — the UAT must verify key presence first. `.env.local` presence confirmed by CLAUDE.md stack notes |
| A3 | Postgres `DATABASE_URL` in `.env.local` is writable for the VER-03 live Analyze (createRun insert) | VER-03 | If read-only/unreachable, Analyze fails at persist (route.ts:98 persist_failed) — UAT must observe the `agent_run` row, which requires a working write path |
| A4 | `npm test` full suite stays green after the +4 loop tests (existing 287 `it()` + 4 ≈ 291) | VER-01/checklist 12 | If an existing test is environment-fragile (e.g., Langfuse key-dependent), the gate could flake — the suite is D-16 pure/mocked by convention, so low risk |
| A5 | The 4 partial `0x-HUMAN-UAT.md` + `0x-VERIFICATION.md` files from STATE.md:103-106 are v1.0/v1.1-era and out of scope for VER-03 | VER-03 absorption | STATE.md labels them "v1.1/v1.2" but the files are Phase 1-4 era (persona Arcpedia content, etc.) — unrelated to the settings loop. If the planner interprets "absorb any" broadly, scope creep. Recommended: explicitly record them as out-of-scope with the rationale |

## Open Questions

1. **Does the Vercel project have the GitHub integration enabled for PR auto-preview?**
   - What we know: `.vercel/project.json` links project `360-arclumen` (Node 24.x); production deploys exist; remote is `MKonovalov/360`.
   - What's unclear: whether the Vercel GitHub App is installed on this repo (dashboard-only state, not repo-verifiable).
   - Recommendation: plan a post-PR checkpoint ("preview URL present?") with the `vercel-cli-with-tokens` skill as the documented fallback (D-18-03 explicitly permits it as a nudge).

2. **Real-snapshot catalog test: additive or documented-step only?**
   - What we know: the filter semantics are fixture-tested (9 tests); the committed-snapshot execution was one-shot in 15-VERIFICATION.
   - What's unclear: whether VER-02 wants the additive test (Code Example 5) or an ad-hoc execution recorded in the matrix.
   - Recommendation: add the one test (cheap, drift-proof, closes Pitfall 4) — planner's discretion per CONTEXT.

3. **Partial-chain matrix cell: additive or mapped-as-covered?**
   - What we know: default and full/capped cells are explicit tests; the clean partial pass-through is not.
   - What's unclear: whether "partial" is adequately proven by the dedupe/allowlist-drop tests.
   - Recommendation: add the one 4-line test (Code Example 6) so the default/partial/full claim is cell-for-cell true — low cost, closes a literal reading of VER-02's wording.

4. **Which local dev server for VER-03: `npm run dev` (17-UAT precedent) or the preview URL?**
   - What we know: 16-HUMAN-UAT/17-UAT both used local dev with a staff Clerk account; D-18-03's preview is scoped to VER-04's list-render proof.
   - What's unclear: nothing material — the precedent is clear.
   - Recommendation: local dev for VER-03 (matches 17-UAT and keeps Langfuse/Anthropic keys local); the preview URL proves only the static render for VER-04. Absorb the 16-HUMAN-UAT status-strip + audit-trail items into the same local run.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | local dev/build (`npm run dev` for VER-03; `npm test`) | ✓ | 22.23.1 | — |
| npm | install/test scripts | ✓ | 10.9.8 | — |
| Vitest | VER-01/02 (`npm test` → `vitest run`) | ✓ | 4.1.10 (devDep) | — |
| `tsx` | optional script runs | ✓ | 4.23.1 (devDep) | — |
| Postgres (Neon via DATABASE_URL) | VER-03 live Analyze + `agent_run` row read | ✓ (in `.env.local`; connection assumed — see A3) | — | none |
| Clerk staff account | VER-03 sign-in | ✓ (precedent: 17-UAT) | — | none |
| Anthropic + Firecrawl keys | VER-03 Analyze (else `not_configured`, analyzeCompany.ts:44) | ✓ (in `.env.local` per CLAUDE.md; verify first) | — | UAT records not_configured and stops |
| Langfuse keys | VER-03 trace-span check (16-HUMAN-UAT item 2) | optional (D-15 no-op without keys) | — | audit survives absence (checklist item 10 — proven by runs.test.ts:44) |
| gh CLI | VER-04 PR creation | ✓ | 2.96.0 | git push + web PR |
| vercel CLI | VER-04 fallback deploy nudge | ✓ | 54.0.0 | — |
| Vercel GitHub integration | VER-04 PR auto-preview | assumed (A1) | — | vercel-cli-with-tokens skill |
| TEST_DATABASE_URL | integration suites (self-skip without it) | ✗ (unset) | — | cite 15-VERIFICATION executed run; do NOT point at live DB |

**Missing dependencies with no fallback:** none — every requirement has a satisfied path.
**Missing dependencies with fallback:** TEST_DATABASE_URL (integration suites skip; evidence already recorded), Vercel GitHub integration (CLI fallback).

## Validation Architecture

> `workflow.nyquist_validation: true` (config.json) — section required. Evidence conventions: `16-VALIDATION.md` (YAML frontmatter + validation contract), `15/16/17-VERIFICATION.md` (Observable Truths + human_verification items), `17-UAT.md` (numbered live tests). Four distinct validation layers apply — automated, live-browser, deployed-environment, human-judgment.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 (`vitest.config.ts` — node env, `@` → `src`, include `src/**/*.test.ts`) |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run src/lib/agents/runAgent.test.ts src/lib/agents/modelConfig.test.ts src/lib/models/catalog.test.ts src/app/actions/settings.test.ts` |
| Full suite command | `npm test` (≈291 tests after the +4 loop cases) |
| Type gate | `npx tsc --noEmit` (17-03-PLAN verification precedent) |

### Validation Layer Map
| Layer | Covers | Evidence Artifact | Gate |
|-------|--------|-------------------|------|
| L1 — Automated Vitest | VER-01 (matrix + 4 new loop tests), VER-02 (existing 9+12, optional +2), checklist items 2,3,5,6,7,8,9,10,11,12 | `18-VER-01-MATRIX.md` + suite output | `npm test` green per task commit; full suite green at phase gate |
| L2 — Live-browser UAT (human) | VER-03 settings→Analyze→`model_used` loop; absorbs 16-HUMAN-UAT 2 items (status strip + audit trail) + 17-03 `<human-check>`; checklist items 1, 13 | `18-UAT.md` (17-UAT.md format) | Human pass/fail on `model_used` == saved primary; Postgres row query as evidence |
| L3 — Deployed environment | VER-04 `/settings` renders from committed catalog.json on preview URL (no 500, no empty, no `opencode/`); checklist item 4 | screenshot/URL in VERIFICATION + zero-hit grep output | Preview URL reachable + render verified |
| L4 — Human judgment | SC-3 forced-fail disposition (D-18-02 satisfied-by-extension); Vercel-integration fallback decision (A1); 13-item checklist map review | `18-VERIFICATION.md` disposition notes | Verifier confirms dispositions recorded |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VER-01 | 401/403 do NOT advance chain | unit (loop) | `npx vitest run src/lib/agents/runAgent.test.ts` | ❌ Wave 0 — add 2 tests |
| VER-01 | output/schema errors do NOT advance | unit (loop) | same | ❌ Wave 0 — add 1 test |
| VER-01 | RetryError-wrapped 404 DOES advance | unit (loop) | same | ❌ Wave 0 — add 1 test |
| VER-01 | taxonomy: 400/401/403/422/429/output/config never eligible; 404/5xx/connection/NoSuchModel eligible | unit (taxonomy) | same | ✅ `modelConfig.test.ts` (7 tests) |
| VER-01 | exhaustion rethrows last error; budgets clamp | unit (loop) | same | ✅ `runAgent.test.ts` (exhaust :173, budgets :183, clamp :196) |
| VER-02 | allowlist ∩ snapshot → servable IDs, no dated/opencode leak | unit | `npx vitest run src/lib/models/catalog.test.ts` | ✅ fixture test (:78) + optional real-snapshot ❌ |
| VER-02 | chain resolution default/partial/full | unit | `npx vitest run src/lib/agents/modelConfig.test.ts` | ✅ 5 tests + optional partial ❌ |
| VER-02 | save-side allowlist gate | unit | `npx vitest run src/app/actions/settings.test.ts` | ✅ 7 tests (security matrix) |
| VER-03 | settings→Analyze→`model_used` loop | live-browser UAT | manual (`npm run dev` + staff acct) + `SELECT model_used, model_chain FROM agent_run ORDER BY id DESC LIMIT 1;` | N/A — UAT artifact ❌ Wave 0 |
| VER-04 | no subprocess in src/ | grep gate | `grep -rE "node:child_process\|execFileSync(\|execSync(\|spawnSync(\|spawn\(" src/` → 0 hits | verified 0 in research; re-run as gate |
| VER-04 | preview renders from committed snapshot | deployed check | manual (preview URL) | N/A |

### Sampling Rate
- **Per task commit:** `npx vitest run <touched suite>` (the quick-run command for runAgent/catalog/modelConfig/settings)
- **Per wave merge:** `npm test` (full suite — checklist item 12) + `npx tsc --noEmit`
- **Phase gate:** full suite green + `18-UAT.md` human verdicts + preview URL evidence + zero-hit grep before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/lib/agents/runAgent.test.ts` — add 4 loop tests (401, 403, output/schema, RetryError-404) covering VER-01's missing cells; import `InvalidResponseDataError`
- [ ] `src/lib/models/catalog.test.ts` — (optional, recommended) real-snapshot test pinning the committed catalog.json to `['claude-sonnet-4-6']`
- [ ] `src/lib/agents/modelConfig.test.ts` — (optional) explicit partial-chain pass-through test
- [ ] `.planning/phases/18-verification-gate/18-VER-01-MATRIX.md` — the requirement → test → assertion + 13-item checklist map (D-18-01/D-18-04)
- [ ] `.planning/phases/18-verification-gate/18-UAT.md` — VER-03 live run record (absorbs 16-HUMAN-UAT + 17-03 items)
- [ ] `.planning/phases/18-verification-gate/18-VALIDATION.md` — this section rendered per `16-VALIDATION.md` format
- [ ] `.planning/phases/18-verification-gate/18-VERIFICATION.md` — phase-gate evidence incl. SC-3 satisfied-by-extension disposition

## Security Domain

> `security_enforcement: true`, ASVS level 1 (config.json). This is a verification phase — it adds tests and UAT runs, zero new attack surface. The security work is *proving existing controls* rather than adding new ones.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Clerk session — unchanged; no new auth surface |
| V3 Session Management | no | Clerk `__session` — unchanged |
| V4 Access Control | yes | `requireStaffAccess()` gates `/settings` page, `saveSettingsAction`, and the analyze route (route.ts:28 — single gate, first call); verified existing |
| V5 Input Validation | yes | `saveSettingsAction` zod schema + server-side servable-set check (settings.ts:28-44, covered by 7 security-matrix tests); analyze route `companyIdSchema` (route.ts:21) |
| V6 Cryptography | no | none — no new crypto |
| V7 Malicious Code Search | yes | the `exec|spawn|child_process` zero-hit grep IS the ASVS V7 check for this phase (no subprocess surface in src/) |
| V12 Files/Resources | no | no new file handling |

### Known Threat Patterns for the verification surface
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthenticated preview URL exposing staff data (VER-04) | Information Disclosure | Preview builds are auth-gated like prod: `/settings` and the analyze route call `requireStaffAccess()` first (page.tsx:15, route.ts:28) — the UAT must confirm the preview prompts Clerk sign-in and shows no data anonymously |
| Test-only code leaking into production (D-18-02) | Tampering | No fail hook is added — forced-fail proof stays entirely in Vitest mocks; zero production code changes this phase |
| Snapshot tampering / stale allowlist (VER-02) | Tampering | Committed `catalog.json` is the single source; the optional real-snapshot test pins `['claude-sonnet-4-6']` so any drift fails CI |
| Client-supplied userId (VER-03 audit) | Spoofing | Already mitigated — analyze route captures `userId` from the session only (route.ts:28, T-16-04); settings.ts never accepts a client userId (T-17-02); UAT asserts the row is keyed by the session user |

## Sources

### Primary (HIGH confidence — verified against the codebase this session)
- `src/lib/agents/runAgent.test.ts` — 13 tests verified (4 happy-path + 7 loop + 2 prompt); the exact describe block (`runAgent failover loop (FAL-03/04)`, line 124) and mock-seam pattern for the 4 new tests; `apiErr` helper (:136), RetryError-5xx pattern (:217-236)
- `src/lib/agents/modelConfig.ts` — `classifyModelError` RetryError-unwrap-first (:34-35) → APICallError 404 → `model_not_found` (:43); `isFailoverEligible` set (:65-67); `resolveModelChain` dedupe→cap→allowlist→default (:71-82)
- `src/lib/agents/modelConfig.test.ts` — 12 tests verified (7 classify + 5 resolve); RetryError-404 NOT covered at taxonomy level (only 429/5xx wrappers)
- `src/lib/agents/runAgent.ts` — loop semantics (:52-92): eligibility gate throws immediately, exhaustion rethrows lastError, budget clamp (:56-59), modelUsed/usedFallback return (:83-86)
- `src/lib/models/catalog.test.ts` — **9 tests verified (not 11)**; fixture covers dated-ID + opencode/ + deprecated leakage (:14-58, :79-81); `!/-20\d{6}/` guard (:87)
- `src/lib/models/catalog.ts` — `ANTHROPIC_ALLOWLIST` sonnet-only (:13), `getAllowlistedServableIds` (:43-47), `opencodeSlugToModelId` (:36-39)
- `src/lib/models/catalog.json` — committed, 1131 models, generatedAt 2026-08-02T09:33:54.568Z (loaded + counted)
- `src/app/api/companies/[id]/analyze/route.ts` — audit surface (:107-115 flat 201 response incl. usedFallback/modelUsedName; :128-140 createRun persists modelUsed/modelChain); `usedFallback` is response-only
- `src/lib/db/queries/userModelSettings.ts` — `getModelSettingsForUser` (findFirst, absence → undefined) + atomic `upsertModelSettings` (insert...onConflictDoUpdate, Pitfall 9)
- `src/lib/db/schema.ts:233-250` — `agent_run` columns: `modelUsed: text('model_used')`, `modelChain: jsonb('model_chain').$type<string[]>()`
- `src/app/actions/settings.ts` + `settings.test.ts` — save-side gate (7 security-matrix tests verified)
- `src/app/(dashboard)/settings/page.tsx` — renders servableModels from `getAllowlistedServableIds(catalogJson)` server-side (:46-55)
- `src/lib/agents/analyzeCompany.ts` — snapshot-at-entry (:55-56), audit identity carry (:104-106), `not_configured` gate (:44)
- `src/lib/agents/analyzeCompany.test.ts` — FAL-01 snapshot (:218), REG-05 default (:236), FAL-05 audit identity (:257)
- `.planning/research/PITFALLS.md:345-359` — **13-item checklist verified (not 12)**
- `.planning/phases/15-model-registry-foundation-persistence/15-VERIFICATION.md` — the exact zero-hit grep command (Truth 8), real-snapshot execution (Truth 6), integration 4/4 (Truth 1)
- `.planning/phases/16-failover-orchestration/16-HUMAN-UAT.md` + `16-VERIFICATION.md` — 2 pending items (status strip, live audit trail) VER-03 absorbs
- `.planning/phases/17-settings-ui-list-source/17-UAT.md` (6 passed), `17-03-PLAN.md` `<human-check>` (:188), `17-03-SUMMARY.md` (:141,146), `17-SECURITY.md` threat register
- `package.json` (`test: vitest run`, vitest 4.1.10), `vitest.config.ts`, `.vercel/project.json` (project 360-arclumen, Node 24.x), `src/lib/telemetry/langfuse.ts` (D-15 no-op), `src/lib/env.ts` (optional keys)

### Secondary (MEDIUM confidence)
- Vercel GitHub integration state for PR auto-preview — inferred from `.vercel/project.json` + existing production deploys; dashboard config not repo-verifiable (flagged A1/Open Question 1)
- `deploy-to-vercel` / `vercel-cli-with-tokens` user skills (available at `~/.agents/skills/`, verified present) — fallback path per D-18-03

### Tertiary (LOW confidence)
- None — no WebSearch-derived claims; all findings are codebase-ground-truthed

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; Vitest/grep/gh/psql all verified installed or repo-established
- Architecture: HIGH — every mapping (checklist item → test file / UAT line / grep) verified against the actual suite contents
- Pitfalls: HIGH — the two count discrepancies and the three coverage nuances (partial chain, real snapshot, usedFallback) are directly observed, not inferred

**Research date:** 2026-08-02
**Valid until:** 2026-08-09 (7 days — the checklist/test counts can drift only if phases touch these files; codebase is stable at milestone end)
