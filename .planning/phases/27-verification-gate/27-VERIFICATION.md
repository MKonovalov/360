---
phase: 27-verification-gate
verified: 2026-08-04T22:09:37Z
status: human_needed
score: 3/5 fully verified (VER-01/04/05); 2/5 structurally proven but currently blocked on live account/endpoint conditions requiring operator action (VER-02/VER-03)
overrides_applied: 0
gaps: []
re_verification:
  previous_status: passed
  previous_score: "5/5 success criteria mapped to executed evidence (self-authored by Plan 27-06)"
  gaps_closed: []
  gaps_remaining:
    - "VER-02/VER-03 live round trip: independently reproduced FAIL for both NousResearch and OpenCode (see Truth 2/3 evidence) — not closed by this pass, correctly reclassified as human_needed rather than falsely passed"
  regressions: []
  status_change_note: "The prior record (self-authored by Plan 27-06, the phase's own deliverable) set status: passed with human_verification: [] despite VER-02/VER-03's round-trip assertions currently failing live and RUN-06 probes failing 3/3 live. This project's own precedent for the identical situation — 22-VERIFICATION.md, same milestone family — set status: human_needed for an uncredited-account condition, with explicit human_verification items requesting operator top-up + consent (recorded as GRANTED with a timestamp in 22-HUMAN-UAT.md). Phase 27's record neither declared a formal override (must_have/reason/accepted_by/accepted_at) nor listed human_verification items for the same class of gap — it self-granted a pass. Per the verifier decision tree (a FAIL/UNCERTAIN truth either needs a documented override or routes to human_needed) and this project's own convention, the accurate status is human_needed. No code defect found; independently re-verified the artifacts as genuinely solid."
deferred:
  - "NousResearch account credit top-up (nousresearch-only-chain.test.ts / structured-outputs-probe.test.ts's live 'Not Found' failures) — operator action, same class as the pre-existing OpenRouter D-27-02/22-VERIFICATION condition"
  - "OpenCode Zen account credit top-up (structured-outputs-probe.test.ts's 'Insufficient balance' failure) — operator action"
  - "OpenCode Go json_schema support / 400 provider error (structured-outputs-probe.test.ts) — needs further investigation, possibly provider-side, not fixable from this repo alone"
  - "OpenCode round-trip schema mismatch (opencode-only-chain.test.ts's AI_NoObjectGeneratedError / gate_failed, independently reproduced twice with different specific failure shapes across runs) — needs investigation once credits are available to get a clean signal"
  - "WR-01 (27-REVIEW.md): shared-Postgres-row race across the 3 *-only-chain.test.ts files under Vitest's default file parallelism — advisory per code review, but should be fixed (serialize the 3 files or give each its own synthetic user) before these tests' results are treated as fully trustworthy at scale"
human_verification:
  - test: "Top up NousResearch account credits, then re-run `npx vitest run src/lib/agents/nousresearch-only-chain.test.ts src/lib/agents/structured-outputs-probe.test.ts` (nousresearch case)"
    expected: "nousresearch-only-chain.test.ts: out.ok === true, out.modelUsed === 'nousresearch/hermes-4-70b'. structured-outputs-probe.test.ts (nousresearch): json_schema round trip succeeds, flag can then be flipped to true in modelFactory.ts."
    why_human: "Requires an operator decision to spend money crediting a third-party account; cannot be resolved from the codebase. Same class of decision Phase 22 explicitly routed to a human (22-HUMAN-UAT.md Item 3, GRANTED with timestamp)."
  - test: "Top up OpenCode account credits, then re-run `npx vitest run src/lib/agents/opencode-only-chain.test.ts src/lib/agents/structured-outputs-probe.test.ts` (opencode-zen/opencode-go cases)"
    expected: "opencode-only-chain.test.ts: out.ok === true, out.modelUsed === 'big-pickle'. structured-outputs-probe.test.ts (opencode-zen/opencode-go): json_schema round trip succeeds or fails on a genuine capability limit (not billing) — record whichever occurs."
    why_human: "Same operator credit/spend decision as above, plus (for opencode-go's 400) may require provider-side follow-up outside this repo's control."
  - test: "After credits are topped up, if opencode-only-chain.test.ts still fails with a schema mismatch (AI_NoObjectGeneratedError / gate_failed) rather than a billing error, investigate whether this is a prompt/schema tuning issue on the 'big-pickle' OpenCode Zen model or a genuine capability gap"
    expected: "Either the round trip passes, or a documented, non-billing root cause is recorded (e.g., model can't reliably follow the production schema without json_schema mode)"
    why_human: "Independent reproduction (see evidence below) shows this test's specific failure mode varies between runs (thrown AI_NoObjectGeneratedError in an isolated single-process run vs. a caught ok:false in a Vitest full-suite run) — worth a human look to confirm this variability is model non-determinism and not the WR-01 race, before trusting a future green run at face value."
---

# Phase 27: Verification Gate — Independent Verification Report

**Phase Goal:** The 4-provider milestone (NousResearch + OpenCode added to Anthropic + OpenRouter) is proven end-to-end with automated matrices, e2e, security gates, and live-browser evidence.
**Verified:** 2026-08-04T22:09:37Z
**Status:** human_needed — VER-01/VER-04/VER-05 are genuinely, independently re-verified green (I re-ran every command myself, not just read the prior record). VER-02/VER-03's live round trip is currently FALSE for both new providers, independently reproduced in isolated (non-concurrent) probe runs — a real, honest negative finding, not a code defect, but one that (per this project's own Phase 22 precedent for the identical situation) should route to `human_needed` with explicit operator-action items, not be silently upgraded to `passed`.
**Re-verification:** Yes — this supersedes the prior self-authored record (Plan 27-06's own deliverable, `status: passed`). This pass independently ran the test suites, the live probes in isolation, and the full Playwright spec against the actual codebase rather than trusting the SUMMARY/prior VERIFICATION narrative.

## Why This Differs From the Prior Record

The prior `27-VERIFICATION.md` was written by Plan 27-06 as the phase's own stated deliverable — it is evidence of what the phase *produced*, not an independent check of it. Its underlying evidence (test commands, artifact contents, the 13/13 Playwright run) is **substantively accurate** — I independently reproduced nearly all of it below. The disagreement is narrower and specific: **status classification**.

The prior record marks `status: passed` and `human_verification: []`, asserting the 6 live test failures (NousResearch credits, OpenCode schema mismatch, OpenRouter pre-existing billing, 3× structuredOutputs probe failures) are "account-state/endpoint-capability conditions... not gaps requiring a human decision." But this project already faced the **identical** situation one phase family ago: `22-VERIFICATION.md` (Phase 22, same milestone lineage) found `OPENROUTER_API_KEY` uncredited, blocking VER-02/VER-03's live round trip. That record's own re-verification pass explicitly corrected an earlier self-authored `passed` to `human_needed`, with the reasoning: *"passed is ONLY valid when the human verification section is empty... the accurate status is human_needed."* It then listed explicit human_verification items ("Live-key re-run consent + top-up... GRANTED 2026-08-03, operator approved ~cents spend") — a recorded, timestamped operator decision.

Phase 27 has the same shape of gap (two new providers, both blocked on live account/endpoint conditions) but no equivalent operator-consent record and no formal override entry (`overrides: []`, `overrides_applied: 0`) — it simply declared the gap out of scope for human review. That is inconsistent with this codebase's own established convention for the exact same category of finding. I am correcting the status accordingly; I am **not** disputing the underlying engineering, which is genuinely solid (see below).

## Goal Achievement

### Observable Truths

| # | Truth (Phase 27 / ROADMAP success criterion) | Status | Evidence (independently reproduced this pass) |
|---|---|---|---|
| 1 | **VER-01 — Vitest collision matrix widens to 4 providers; 16-cell 429 hop matrix passes** | ✓ VERIFIED | Independently ran `npx vitest run src/lib/models/catalog.test.ts src/lib/agents/modelConfig.test.ts src/lib/verification/security-grep.test.ts` → **3 files, 74 tests, exit 0**. Read `catalog.test.ts:322-604` and `modelConfig.test.ts:156-198` directly — collision canaries, COUNT-STABILITY/NO-FLIP groups, and the `SERVABLE_PROVIDERS`-driven 16-cell `shouldAdvance` matrix (including the Zen↔Go same-provider pin) are present and green, exactly as claimed. |
| 2 | **VER-02 — End-to-end UAT: saving a NousResearch or OpenCode primary then running Analyze records `agent_run.model_used` matching the saved id** | ✗ CURRENTLY FALSE (structurally proven, blocked on external conditions) | Independently reproduced with a standalone, non-concurrent Node script (bypassing Vitest entirely, so WR-01's race is structurally impossible): `spawnSync` of `scripts/probe-nousresearch-only.ts` with the other 3 keys stripped → **exit 1, stderr: "Not Found"**. Same for `scripts/probe-opencode-only.ts` → **exit 1, stderr: "No object generated: response did not match schema."** (an uncaught `AI_NoObjectGeneratedError` propagating through `analyzeCompany.ts`'s fail-loud `throw err` at line 135, since `classifyModelError` doesn't map it to `'billing'`/`'rate_limited'`). Also independently ran `npm test` with the real `.env.local` present in this worktree: **448 passed / 6 skipped / 6 failed** — same 6 failures the prior record documents, byte-for-byte matching error messages. Neither provider currently completes a successful round trip. This is a genuine, reproducible negative finding, not a flaky artifact — see the WR-01 discussion below for why I'm confident the race isn't the cause here. |
| 3 | **VER-03 — OpenCode-only / NousResearch-only chains run with only their own key set** | ⚠️ ISOLATION MECHANICS VERIFIED / ROUND TRIP CURRENTLY FALSE | Read `nousresearch-only-chain.test.ts` and `opencode-only-chain.test.ts` directly: both correctly strip ALL 3 other provider keys in a cloned `childEnv` (never mutating `process.env`), guarded by `describe.skipIf(!hasLiveKeys)`. Independently confirmed with no `.env.local` (fresh shell, `hasLiveKeys` false): both tests skip gracefully — no false failures in CI-equivalent conditions (part of the 448 passed / 12 skipped run). With real keys, isolation is real (no `not_configured`/missing-key error in either case — the child env gate correctly reaches the real provider), but per the literal wording "runs... with only X key set," a run that reaches the provider and then fails is not the same as a run that succeeds. Same disposition as Truth 2. |
| 4 | **VER-04 — Security-matrix grep extends to NOUSRESEARCH/OPENCODE with non-vacuous canaries** | ✓ VERIFIED | Read `src/lib/verification/security-grep.test.ts` directly — data-driven `TOKENS = ['OPENROUTER', 'NOUSRESEARCH', 'OPENCODE']` loop across all 5 `it()` blocks (client-component scan, Server Action scan, `NEXT_PUBLIC_*` scan, non-vacuous `ALLOWED`-set canary, `SERVER_COMPONENT` canary correctly scoped to OPENROUTER-only since `company-detail.tsx` genuinely never mentions the other 2 tokens). Independently ran `npx vitest run src/lib/verification/security-grep.test.ts` → **5/5 passed, exit 0**. |
| 5 | **VER-05 — Live-browser UAT (4-provider selector, Zen/Go + Hermes captions, badge disambiguation); RUN-06 `json_schema` probe gates the `supportsStructuredOutputs` flip** | ✓ VERIFIED | **Independently ran the live Playwright suite myself** (real Clerk auth, real dev server, real DB): `npx playwright test e2e/ver-05-settings.spec.ts` → **13 passed (30.5s), 0 failures** — genuine first-hand evidence, not a re-read of a recorded run. Confirmed 13 distinct test names via `--list`, matching the prior record's 26-HUMAN-UAT.md closure mapping. For RUN-06: read `modelFactory.ts` — all 3 new instances (`nousresearch`, `openaiCompatibleZen`, `openaiCompatibleGo`) have no `supportsStructuredOutputs: true` set (stay at the safe default `false`), each with a dated comment recording its specific live-probe failure (Not Found / Insufficient balance / 400 provider error). The *mechanism* — probe runs live, flag only flips on a passing probe, per-instance not all-or-nothing — is genuinely built and correctly conservative. This criterion is about the gate working correctly, and it does: none of the 3 probes passed, so none of the 3 flags flipped. This is the one part of the "negative findings" cluster I'm marking fully VERIFIED rather than human_needed, because the roadmap wording only requires the probe to gate the decision, not to succeed. |

**Score:** 3/5 truths (VER-01, VER-04, VER-05) are fully, independently VERIFIED this pass with fresh command runs. 2/5 (VER-02, VER-03) are structurally well-built (isolation mechanics, error handling, and audit-trail code are all correct) but their defining success condition — a completed round trip — is currently false for both new providers, reproduced independently and consistently, and blocked on conditions outside this codebase (account credits, provider endpoint capability).

### On the WR-01 Race Condition (27-REVIEW.md) and Whether It Undermines This Verdict

`27-REVIEW.md`'s WR-01 finding is real: all 3 `*-only-chain.test.ts` files share one Postgres `user_model_settings` row for the same Clerk test account, and Vitest's default `fileParallelism` (confirmed: `vitest.config.ts` sets no `pool`/`sequence` override) can run them concurrently, creating a genuine, unsynchronized read-after-write race.

I independently checked whether this race is *responsible for* the specific negative findings VER-02/VER-03/RUN-06 currently report, by re-running the NousResearch and OpenCode probes as **standalone single-process Node scripts** — no Vitest, no other file running concurrently, race structurally impossible:

- NousResearch probe alone: exit 1, `"Not Found"` — matches the concurrent-run failure exactly.
- OpenCode probe alone: exit 1, `"No object generated: response did not match schema."` — a schema-mismatch class matching the concurrent run's diagnosis, though the exact failure shape (thrown vs. caught) varied between my isolated run and the `npm test` run — see the human_verification item above recommending a closer look at this variability once credits allow a clean signal.

**Conclusion: WR-01 does not appear to be the cause of the documented VER-02/VER-03 negative findings** — the same account/endpoint-class failures reproduce with the race structurally eliminated. WR-01 remains a real, separate test-infrastructure defect (worth fixing per the code review's suggestion — serialize the 3 files or use per-provider synthetic test users) that should be fixed before these tests' results are treated as fully deterministic at scale, but it does not invalidate the specific negative findings already recorded.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/lib/models/catalog.test.ts` / `modelConfig.test.ts` | 4-provider matrices | ✓ VERIFIED | Re-run this pass: part of 74/74 green |
| `scripts/probe-nousresearch-only.ts` / `scripts/probe-opencode-only.ts` | VER-02/03 child probes | ✓ VERIFIED (structurally); round trip currently fails live | Read + independently executed standalone this pass |
| `src/lib/agents/nousresearch-only-chain.test.ts` / `opencode-only-chain.test.ts` | Child-env isolation, all 3 other keys stripped | ✓ VERIFIED (isolation mechanics); round trip currently fails live | Read this pass — correct `childEnv` cloning, correct `skipIf` guard |
| `src/lib/agents/structured-outputs-probe.test.ts` | RUN-06 live per-instance probe | ✓ VERIFIED | Re-run this pass as part of `npm test`; 3 genuine live failures, flag stays conservative |
| `src/lib/verification/security-grep.test.ts` | VER-04 gate widened to 3 tokens | ✓ VERIFIED | Re-run this pass: 5/5 green |
| `src/components/settings/model-settings-form.tsx` | CR-01/CR-02 fixes | ✓ VERIFIED | Read this pass — both fixes present exactly as described (lines ~395-398 gate, try/catch at ~110-133); `npx tsc --noEmit` clean |
| `e2e/ver-05-settings.spec.ts` | 13 tests, closes 4 `26-HUMAN-UAT.md` items | ✓ VERIFIED | Independently ran live: 13/13 passed, 30.5s |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `modelConfig.test.ts` / `catalog.test.ts` | `modelConfig.ts` / `catalog.ts` | direct import | ✓ WIRED | Re-run green this pass |
| `*-only-chain.test.ts` | `scripts/probe-*.ts` | `spawnSync` | ✓ WIRED | Confirmed via standalone re-execution this pass |
| `structured-outputs-probe.test.ts` | `modelFactory.ts`'s 3 instances | direct import + per-call override | ✓ WIRED | Live run reached all 3 real endpoints |
| `security-grep.test.ts` | `.env.example` / 3 `ALLOWED` files | `readFileSync` + `TOKENS` loop | ✓ WIRED | Re-run green this pass |
| `ver-05-settings.spec.ts` | `/settings` UI | `page.goto` + real Clerk auth | ✓ WIRED | 13/13 green, independently run this pass |

### Behavioral Spot-Checks (all executed by me this pass, not read from the prior record)

| Behavior | Command | Result | Status |
|---|---|---|---|
| VER-01 + VER-04 matrix/security re-run | `npx vitest run src/lib/models/catalog.test.ts src/lib/agents/modelConfig.test.ts src/lib/verification/security-grep.test.ts` | 74 tests / 3 files, exit 0 | ✓ PASS |
| Full unit suite, real `.env.local` present in this worktree | `npm test` | 448 passed / 6 skipped / 6 failed — same 6 live-account/endpoint failures the prior record documents | ✓ PASS (matches prior record) w/ 6 documented negative findings |
| Project-wide type-check | `npx tsc --noEmit` | exit 0, no output | ✓ PASS |
| NousResearch probe, standalone (race-proof) | `spawnSync` of `scripts/probe-nousresearch-only.ts` outside Vitest | exit 1, `"Not Found"` | Matches documented finding — confirms not a race artifact |
| OpenCode probe, standalone (race-proof) | `spawnSync` of `scripts/probe-opencode-only.ts` outside Vitest | exit 1, `"No object generated: response did not match schema."` | Matches documented finding class — confirms not a race artifact |
| VER-05 live browser run | `npx playwright test e2e/ver-05-settings.spec.ts` | **13/13 passed, 30.5s, exit 0** — run by me, this pass | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|---|---|---|---|---|
| VER-01 | 27-06 | 4-provider Vitest matrices | ✓ SATISFIED | 74/74 re-run green this pass |
| VER-02 | 27-01 | End-to-end UAT round trip | ✗ NOT CURRENTLY SATISFIED — blocked, human action needed | Standalone re-execution this pass: both providers fail (NousResearch "Not Found"; OpenCode schema mismatch) |
| VER-03 | 27-01 | Single-key chain isolation | ⚠️ PARTIALLY SATISFIED — isolation proven, round trip blocked | Same evidence as VER-02 |
| VER-04 | 27-03 | Security-matrix grep widened | ✓ SATISFIED | 5/5 re-run green this pass |
| VER-05 | 27-04, 27-05 | Live-browser UAT + RUN-06 gate | ✓ SATISFIED | 13/13 live run this pass; RUN-06 gate mechanism correctly conservative |

**Orphan check:** All 5 requirement IDs (VER-01..05) declared in this phase's PLAN frontmatter are accounted for and appear in `.planning/REQUIREMENTS.md` §Verification Gate (lines 47-51). No orphaned requirements found.

**Note on `.planning/REQUIREMENTS.md` checkbox state (informational, not a phase blocker):** All 5 VER-* rows remain `[ ]`/"Pending" in the traceability table. For VER-02/03 this is consistent with Phase 22's own established practice (leave genuinely-unresolved criteria Pending rather than fabricate closure). However, VER-01 and VER-04 are now fully, independently verified passing — Phase 22's precedent (`STATE.md` line 167: "VER-01/04/05 stay Complete") marked its equivalent fully-passing criteria `Complete` in the same pass. Plan 27-06's `files_modified` scope did not include `REQUIREMENTS.md`, so this wasn't a stated deliverable of this phase — flagging as an informational gap for whoever runs milestone closure/audit, not a phase-27 blocker.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `vitest.config.ts` | n/a | No `fileParallelism`/`sequence` override — confirmed via direct read, corroborating 27-REVIEW.md's WR-01 finding | ⚠️ Warning (carried from code review, independently confirmed) | Real shared-DB-row race exists across 3 test files; did not appear to cause the currently-documented failures (see WR-01 discussion above), but should be fixed before trusting future green runs of these specific tests unconditionally |
| (otherwise none in phase-27-modified files) | - | - | - | No TBD/FIXME/XXX/HACK/PLACEHOLDER debt markers found this pass |

### Human Verification Required

See frontmatter `human_verification:` for the structured list. Summary: an operator needs to (1) decide whether/when to top up NousResearch and OpenCode account credits (real money, same class of decision Phase 22 explicitly routed to a human with a timestamped consent record), and (2) once credited, confirm whether the OpenCode round trip's schema-mismatch failure resolves on its own (billing was masking the real signal) or needs further investigation. None of this requires further code changes to close — the code is already correctly built to detect and report these conditions honestly.

### Gaps Summary

No code gaps. Every artifact this phase claims to have built is genuinely present, substantive, and correctly wired — independently re-verified against the actual codebase, not the SUMMARY/prior-VERIFICATION narrative (I re-ran the unit matrices, the security gate, the standalone provider probes outside Vitest, the full `npm test` with live keys, and the entire live-browser Playwright suite myself). The one real disagreement with the prior record is a **status classification**, not an engineering gap: VER-02/VER-03's live round trip is currently false for both new providers (independently reproduced, and shown not to be an artifact of the WR-01 race), and per this project's own precedent for the identical situation (`22-VERIFICATION.md`), that combination of "structurally proven, blocked by an external funding/capability condition" should route to `status: human_needed` with explicit, accountable human_verification items — not be self-classified as `passed` with an empty human-verification section. Recommend either (a) an operator formally accepts an override for VER-02/VER-03 (with `accepted_by`/`accepted_at`, mirroring 22-HUMAN-UAT.md's "GRANTED" pattern) if the milestone is to proceed without a resolved round trip, or (b) top up the two accounts and re-run before closing this phase, then re-verify.

---

_Verified: 2026-08-04T22:09:37Z_
_Verifier: Claude (gsd-verifier, independent pass)_
