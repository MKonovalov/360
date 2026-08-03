---
phase: 22-verification-gate
verified: 2026-08-03T16:40:00Z
status: human_needed
score: 5/5 success criteria mapped to executed evidence (VER-01/04/05 fully green; VER-02/03 structurally proven — live billing-success assertions pending-credit, flagged not falsely green)
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: 5/5 success criteria verified
  gaps_closed: []
  gaps_remaining: []
  regressions: []
  status_change_note: "Prior record's `status: passed` was internally inconsistent — its own frontmatter carried a non-empty `human_verification:` list and the phase's 22-HUMAN-UAT.md carries 4 genuinely-human items. Per the verifier decision tree ('passed is ONLY valid when the human verification section is empty') and the 19-VERIFICATION precedent (human_needed + 5/5 when human items exist), the accurate status is `human_needed`. No truth failed; no gap introduced."
gaps: []
deferred:
  - "IN-03 billing ERROR_COPY row (no 'billing' entry in analyze-run-status.tsx ERROR_COPY — Phase 20 carry; recorded in 22-HUMAN-UAT.md Item 2, NOT this phase's scope per CONTEXT Open Question 4)"
  - "v1.3 human_needed VERIFICATION carries (01/02/03/04-VERIFICATION.md) — unchanged, out of scope (22-HUMAN-UAT.md Item 4)"
  - "VER-02/VER-03 live billing-success assertions PENDING until OPENROUTER_API_KEY is credited (verified uncredited: limit null, is_free_tier true, usage 0.000110016) — structural proofs delivered, final 201/modelUsed evidence awaits top-up (22-HUMAN-UAT.md Item 3)"
human_verification:
  - "IN-02 stale-primary badge guess observation (21-REVIEW carry) — recorded observation in 22-HUMAN-UAT.md Item 1; optional human browser confirmation (inject stale primary via DB, observe recap badge)"
  - "IN-03 billing ERROR_COPY observation from the VER-02 402 run — recorded observation in 22-HUMAN-UAT.md Item 2; gap-closure candidate, not this phase's scope"
  - "Live-key re-run consent + top-up for VER-02/VER-03 — 22-HUMAN-UAT.md Item 3 [pending]; after crediting, re-run `npx playwright test e2e/ver-02-analyze.spec.ts` and `npx vitest run src/lib/agents/openrouter-only-chain.test.ts` to capture the 201 + modelUsed shapes"
  - "v1.3 human_needed VERIFICATION carries — 22-HUMAN-UAT.md Item 4 [pending], out of scope"
---

# Phase 22: Verification Gate — Verification Report

**Phase Goal:** The milestone's correctness claims are proven — Vitest matrices lock the collision resolution, the 429 hop table, and the error taxonomy; end-to-end UAT proves an OpenRouter primary serves through Analyze into the audit columns; OpenRouter-only chains run with only the OpenRouter key; the security-matrix grep proves no key leakage; live-browser UAT proves provider-switch draft preservation, picker search/grouping, and badge disambiguation.
**Verified:** 2026-08-03T16:40:00Z
**Status:** human_needed — every truth below was independently re-verified against the actual codebase (tests re-run, specs read, key status re-checked); VER-01/04/05 are fully green; VER-02/03 are structurally proven with the live billing-success assertions honestly flagged pending-credit (operator-approved known condition, NOT gaps). 4 genuinely-human items await action (22-HUMAN-UAT.md) — hence `human_needed`, not `passed`.
**Re-verification:** Yes — this pass consolidates the prior record: evidence re-validated line-by-line against the code; the only correction is the status field (`passed` → `human_needed`, per the decision tree's 'passed requires an empty human-verification section' rule).

## Goal Achievement

### Observable Truths

| #   | Truth (Phase 22 success criterion) | Status | Evidence (re-verified this pass) |
| --- | ---------------------------------- | ------ | -------------------------------- |
| 1   | **VER-01 — Vitest matrices lock collision resolution, the 4-cell 429 hop table, and the error taxonomy** | ✓ VERIFIED | **Re-ran `npx vitest run src/lib/models/catalog.test.ts src/lib/agents/modelConfig.test.ts src/lib/agents/runAgent.test.ts` → 73 passed / 3 files, exit 0 (this pass).** Collision canaries confirmed at `catalog.test.ts:165-192` (`claude-sonnet-4-6`→anthropic :165-166; `anthropic/claude-sonnet-4.6`→openrouter :170,182-184; `claude-sonnet-5`→anthropic :186-188; `anthropic/claude-sonnet-5`→openrouter :190-192) and `git diff --stat catalog.test.ts` is empty (byte-identical, D-22-06). 4-cell 429 hop at `modelConfig.test.ts:151-177` — same-provider `rate_limited` false, cross-provider true (FAL-03), non-429 eligible classes advance, billing/input/output/config/auth never reach shouldAdvance (:166-170), null-identity fail-closed (:172-175). Error classes `modelConfig.test.ts:56-77` — 402→'billing' never failover-eligible (:56-60 + RetryError-wrapped :69-77), 502/503→'server_error' eligible (:62-67). Both RESEARCH-documented gaps closed: `isOpenRouterPlatformRateLimit` direct tests at `runAgent.test.ts:353-427` (6 cases; import :45; helper source `runAgent.ts:126` reads X-RateLimit-* headers / metadata.provider_code) and the statusCode-200→'input' WR-01 pin at `modelConfig.test.ts:102-116` (:111 statusCode:200, :114-115 toBe('input') + not eligible). WR-01 comment sites verified already 'input' (no stale doc). |
| 2   | **VER-02 — End-to-end UAT: save an OpenRouter primary → Analyze on a company → `agent_run.model_used` matches the saved OpenRouter slug** | ✓ STRUCTURALLY PROVEN / ⏳ PENDING-credit (live billing-success assertions) | `e2e/ver-02-analyze.spec.ts` (111 lines, commits `6ca92e6e` + `37a9f32a`) read this pass: real Clerk login via auth-setup storageState, Settings-UI save path with deterministic pinned-row handling, by-name company lookup (`getCompanyByName('Acme Test Co')`, never hard-coded id), authenticated analyze POST with 120s timeouts, and intact assertions `expect(res.status()).toBe(201)` (:100), `body.modelUsed === 'anthropic/claude-sonnet-4.6'` (:105), `getRunById(body.id).modelUsed === 'anthropic/claude-sonnet-4.6'` (:110). SkipIf guard CI-safe (:38-41). Live run once: full stack through the provider contract, terminal 402 (billing). **Key status re-checked this pass via OpenRouter auth/key API: `limit: None`, `is_free_tier: True`, `usage 0.000110016` — uncredited, confirming the 402 is billing, not missing-key.** REQUIREMENTS.md honestly keeps VER-02 Pending. Re-runnable after top-up: `npx playwright test e2e/ver-02-analyze.spec.ts`. |
| 3   | **VER-03 — An OpenRouter-only chain runs successfully with only `OPENROUTER_API_KEY` set (no Anthropic key)** | ✓ STRUCTURALLY PROVEN / ⏳ PENDING-credit (live billing-success assertion) | `src/lib/agents/openrouter-only-chain.test.ts` (33 lines, commit `ab9d176c`) read this pass: `describe.skipIf(!hasLiveKeys)` (:16), child env `{ ...process.env, ANTHROPIC_API_KEY: '' }` (:21 — strip in child ONLY, no parent mutation), spawnSync tsx probe with 110s timeout, assertions `out.ok === true` (:29) and `out.modelUsed === 'anthropic/claude-sonnet-4.6'` (:30) intact. `scripts/probe-openrouter-only.ts` read this pass: dotenv `.env.local` (`quiet: true`), company BY NAME, `acmetest.arclumen.test` domain stamp, OR-only settings upsert, JSON-shape output only. **Executed this pass: the probe runs with ANTHROPIC stripped and returns `{ok:false,modelUsed:null,modelChain:null}` — the chain reached the OpenRouter contract; `analyzeCompany.ts:111-115` maps the 402 to `reason:'billing'` (NOT missing-key / not_configured), and the uncredited key status (above) confirms billing. Full `npm test` this pass: 377 passed | 6 skipped | 1 failed — the single failure is this test's billing assertion, the documented pending-credit failure mode.** Skip-guarded CI-safe; green after top-up. |
| 4   | **VER-04 — Security-matrix grep is clean — `OPENROUTER` absent from client components / Server Action returns / no `NEXT_PUBLIC_*` leakage** | ✓ VERIFIED (permanent automated gate) | `src/lib/verification/security-grep.test.ts` (67 lines, commit `d412723e`) read this pass — 4 it() blocks exactly as claimed: (1) no OPENROUTER in `'use client'`/`components/` files (:24-36); (2) no OPENROUTER in `app/actions/` (:38-42); (3) no NEXT_PUBLIC_OPENROUTER in src/ (self-file skip :51) or `.env.example`, and `.env.example` still declares server-only `OPENROUTER_API_KEY` (:44-57); (4) non-vacuous canary on the ALLOWED set `lib/env.ts`, `lib/agents/modelFactory.ts`, `lib/agents/analyzeCompany.ts` (:59-66). **Re-ran `npx vitest run src/lib/verification/security-grep.test.ts` → 4 passed, exit 0 (this pass).** Canary inputs confirmed: `.env.example:33` has `OPENROUTER_API_KEY=sk-or-xxxxxxxx` (placeholder, server-only, no NEXT_PUBLIC_); all 3 ALLOWED files contain `OPENROUTER_API_KEY` (1/1/2 occurrences). Included in full `npm test` (auto-discovered). |
| 5   | **VER-05 — Live-browser UAT proves provider-switch draft preservation, picker search/grouping, badge disambiguation, and no `~`/`:free` id ever savable-or-served outside its labels** | ✓ VERIFIED | `e2e/ver-05-settings.spec.ts` (241 lines, commit `cde53675`) read this pass — 5 test() blocks exactly as claimed: SET-03 provider-switch draft preservation (:54), SET-06 picker search/grouping/336-row count (:98, asserts `toHaveCount(336)` :113, cmdk-group-headings `['Anthropic','OpenRouter']` :118, type-to-filter collapse, "No models found." :131), SET-05 badge disambiguation of the live same-name pair (:136), SET-07 `:free`/`~latest` label discipline (:190), IN-02 stale-primary observation (:234). Harness verified: `playwright.config.ts` (webServer auto-start, workers:1, auth-setup→chromium dependency, storageState) + `e2e/auth.setup.ts` (real clerkSetup + clerk.signIn, no cookie stubs). Recorded run (22-06-SUMMARY): **7/7 passed, 19.6s, exit 0** with full per-test output. Browser re-run not repeated this pass (requires dev server + Clerk) — evidence stands on the recorded green run + spec substance. |

**Score:** 5/5 success criteria mapped to executed evidence — VER-01/04/05 fully green (empirically re-verified this pass); VER-02/03 structurally proven with live billing-success assertions pending-credit (operator-approved known condition — flagged, never falsely green).

### Deferred Items

| Item | Status | Notes |
| ---- | ------ | ----- |
| IN-03 — `analyze-run-status.tsx` ERROR_COPY has no `'billing'` row, so a 402 renders the generic "The analysis failed" | ⏳ deferred (HUMAN-UAT observation) | Phase 20 carry, confirmed by the VER-02 live run's 402. Gap-closure candidate, **NOT this phase's scope** (CONTEXT Open Question 4). Recorded in `22-HUMAN-UAT.md` Item 2. |
| v1.3 `human_needed` VERIFICATION carries (01/02/03/04-VERIFICATION.md) | ⏳ deferred (unchanged) | From STATE.md Deferred Items — out of scope, carried forward. Recorded in `22-HUMAN-UAT.md` Item 4. |
| VER-02/VER-03 live billing-success evidence | ⏳ pending-credit | `OPENROUTER_API_KEY` re-verified uncredited this pass (`limit: null`, `is_free_tier: true`, usage 0.000110016). After top-up, re-run `npx playwright test e2e/ver-02-analyze.spec.ts` and `npx vitest run src/lib/agents/openrouter-only-chain.test.ts` to capture the 201 + `modelUsed === 'anthropic/claude-sonnet-4.6'` shapes. Consent item: `22-HUMAN-UAT.md` Item 3. |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/lib/agents/runAgent.test.ts` | isOpenRouterPlatformRateLimit direct tests (6 cases) | ✓ VERIFIED | Top-level describe :353-427, import :45 — read this pass; targeted regression green |
| `src/lib/agents/modelConfig.test.ts` | 4-cell hop + error classes + statusCode-200→'input' pin | ✓ VERIFIED | :56-77, :151-177, :102-116 — read this pass; green |
| `src/lib/models/catalog.test.ts` | Collision canaries (4 pairs) | ✓ VERIFIED | :165-192; `git diff --stat` empty (untouched, D-22-06) |
| `src/lib/verification/security-grep.test.ts` | VER-04 permanent gate (4 it blocks + canary) | ✓ VERIFIED | Read + re-ran: 4 passed, exit 0 |
| `scripts/probe-openrouter-only.ts` | VER-03 child probe (dotenv, by-name, OR-only, JSON out) | ✓ VERIFIED | Read this pass; executed — billing rejection shape |
| `src/lib/agents/openrouter-only-chain.test.ts` | Child-env integration (spawnSync + ANTHROPIC strip + skip guard) | ✓ VERIFIED | Read this pass; fails ONLY on billing assertion (documented) |
| `e2e/ver-02-analyze.spec.ts` | VER-02 live-key spec (201 + verbatim modelUsed ×2) | ✓ VERIFIED (structural) | Read this pass — assertions intact; live run terminal 402 pending-credit |
| `e2e/ver-05-settings.spec.ts` | VER-05 browser UAT (5 tests) | ✓ VERIFIED | Read this pass; recorded run 7/7 green (22-06-SUMMARY) |
| `playwright.config.ts` / `e2e/auth.setup.ts` | E2E harness (webServer, real Clerk login, storageState) | ✓ VERIFIED | Read this pass — matches pattern 1 contract |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `runAgent.test.ts:45` | `runAgent.ts:126` | `import { isOpenRouterPlatformRateLimit }` | ✓ WIRED | Helper source read — tests exercise the real export |
| `modelConfig.test.ts` | `modelConfig.ts` | `classifyModelError` / `shouldAdvance` imports | ✓ WIRED | Real classifier/hop-table functions under test |
| `security-grep.test.ts` | `.env.example` / 3 ALLOWED files | `readFileSync` + canary | ✓ WIRED | Canary inputs confirmed present |
| `openrouter-only-chain.test.ts` | `scripts/probe-openrouter-only.ts` | `spawnSync(process.execPath, [tsx/cli, 'scripts/probe-openrouter-only.ts'])` | ✓ WIRED | Child spawn executes the probe (observed output) |
| `probe-openrouter-only.ts` | `analyzeCompany` / `getCompanyByName` / `upsertModelSettings` | dynamic import after dotenv load | ✓ WIRED | Probe executed — real query layer reached |
| `ver-02-analyze.spec.ts` | `/api/companies/[id]/analyze` | authenticated `page.request.post` | ✓ WIRED | Live run reached the route + provider contract (402) |
| `ver-02-analyze.spec.ts` | `getRunById` / `getCompanyByName` | relative imports (`../src/lib/db/queries/*`) | ✓ WIRED | Real DB read-back path in spec |
| `ver-05-settings.spec.ts` | `/settings` UI | `page.goto('/settings')` + real auth | ✓ WIRED | 7/7 green recorded run |

### Behavioral Spot-Checks (executed this pass unless noted)

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| VER-01 matrix regression (3 files) | `npx vitest run src/lib/models/catalog.test.ts src/lib/agents/modelConfig.test.ts src/lib/agents/runAgent.test.ts` | exit 0 — 73 tests / 3 files | ✓ PASS |
| VER-04 security gate | `npx vitest run src/lib/verification/security-grep.test.ts` | exit 0 — 4 passed | ✓ PASS |
| VER-04 gate in full suite | `npm test` | auto-discovered; 377 passed | ✓ PASS |
| Full unit suite | `npm test` | 377 passed | 6 skipped | 1 failed (this pass) | ✓ PASS w/ documented pending-credit failure |
| VER-03 child-env probe (live) | `npx tsx scripts/probe-openrouter-only.ts` | `{ok:false,modelUsed:null,modelChain:null}` — billing rejection (uncredited key) | ✓ STRUCTURAL / ⏳ credit |
| VER-03 child-env test | `npx vitest run src/lib/agents/openrouter-only-chain.test.ts` | fails ONLY on billing assertion (`out.ok` false) — documented pending-credit mode | ✓ STRUCTURAL / ⏳ credit |
| OpenRouter key credit status | `curl https://openrouter.ai/api/v1/auth/key` | `limit: None`, `is_free_tier: True`, usage 0.000110016 — UNCREDITED | ✓ (confirms 402 = billing) |
| VER-02 live-key e2e | `npx playwright test e2e/ver-02-analyze.spec.ts` | full stack run once — terminal 402 (pending-credit); assertions intact | ✓ STRUCTURAL / ⏳ credit |
| VER-05 browser UAT | `npx playwright test e2e/ver-05-settings.spec.ts` | recorded 7/7 passed, 19.6s, exit 0 (22-06-SUMMARY) | ✓ PASS (recorded) |
| Key-leakage scan | `grep -rn "sk-or-" .planning/phases/22-verification-gate/ e2e/` | 0 real-key matches — only the `.env.example` placeholder `sk-or-xxxxxxxx` referenced in doc text | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| VER-01 | 22-01 | Vitest collision matrix (same-name ids map to correct provider), 4-cell 429 hop table, error matrix (402 never advances w/ billing reason; 502/503 advance; platform vs upstream 429) | ✓ SATISFIED | Audit map + gap-fill at `catalog.test.ts:165-192`, `modelConfig.test.ts:56-77,151-177`, `runAgent.test.ts:353-427`; 3-file regression 73 green (re-run this pass); matrices byte-identical (D-22-06) |
| VER-02 | 22-05 | End-to-end UAT — save an OpenRouter primary → Analyze on a company → `agent_run.model_used` matches the saved OpenRouter slug | ⏳ PENDING-credit (structural proof delivered) | `e2e/ver-02-analyze.spec.ts` authored + run once — full stack through the provider contract proven; terminal 402 pending key top-up; assertions intact (`201`, `modelUsed === 'anthropic/claude-sonnet-4.6'`, `getRunById` read-back). REQUIREMENTS.md honestly Pending |
| VER-03 | 22-04 | OpenRouter-only chain runs successfully with only `OPENROUTER_API_KEY` set (no Anthropic key) | ⏳ PENDING-credit (structural proof delivered) | `openrouter-only-chain.test.ts` child-env spawn with ANTHROPIC stripped; chain reached OpenRouter, rejected on BILLING not missing-key (probe re-executed this pass); key isolation proven; green slug assertion awaits credit. REQUIREMENTS.md honestly Pending |
| VER-04 | 22-02 | Security-matrix grep — `OPENROUTER` absent from client components / Server Action returns / no `NEXT_PUBLIC_*` leakage | ✓ SATISFIED | Permanent Vitest gate `security-grep.test.ts` (4 it blocks, allowlist of 3 server files + non-vacuous canary); re-run 4/4 green this pass; included in `npm test` |
| VER-05 | 22-06 | Live-browser UAT — provider-switch draft preservation, picker search/grouping, badge disambiguation, no `~`/`:free` id ever savable-or-served outside their labels | ✓ SATISFIED | `e2e/ver-05-settings.spec.ts` 5 test blocks read this pass; recorded run 7/7 green (SET-03/05/06/07 + IN-02 observation) |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (none in phase-modified files) | - | - | - | No TBD/FIXME/XXX debt markers, no placeholder returns, no empty handlers, no `delete process.env` mutation, no hardcoded empty data in any phase-modified file (scanned this pass) |

### Human Verification Required

1. **Live-key re-run for VER-02** — after the operator tops up `OPENROUTER_API_KEY`, re-run `npx playwright test e2e/ver-02-analyze.spec.ts`. Expected: 3 passed (auth-setup ×2 + VER-02), capturing 201 + `modelUsed === 'anthropic/claude-sonnet-4.6'` + `getRunById` read-back. Why human: requires operator action (credits + consent), cannot be green-verified while the key is uncredited.
2. **Live-key re-run for VER-03** — after top-up, re-run `npx vitest run src/lib/agents/openrouter-only-chain.test.ts`. Expected: exit 0 with `out.ok === true` and `out.modelUsed === 'anthropic/claude-sonnet-4.6'`. Why human: same pending-credit operator action.
3. **IN-02 stale-primary badge guess (optional browser confirmation)** — sign into `/settings`, inject a stale primary row via DB (outside the UI), observe whether the recap's trigger badge guesses the provider correctly or falls back to the raw id. Expected (recorded observation): the recap resolves a catalog-absent primary to `providerName: 'anthropic'` and renders the "Anthropic" badge (guess). Why human: requires manual DB injection + visual browser observation; unreachable through the UI.
4. **IN-03 billing ERROR_COPY row** — decide whether to add a `'billing'` row to `analyze-run-status.tsx` ERROR_COPY so a 402 renders a billing-specific message instead of the generic "The analysis failed". Why human: scope decision (gap-closure candidate, NOT phase 22 scope per CONTEXT Open Question 4).
5. **v1.3 human_needed VERIFICATION carries** — confirm the 01/02/03/04-VERIFICATION.md human items remain tracked. Why human: out-of-scope carry, unchanged by this phase.

### Gaps Summary

No gaps. All five success criteria are mapped to executed, code-verified evidence. VER-01/04/05 are fully green (empirically re-verified this pass: 73-test regression, 4-test security gate, recorded 7/7 browser UAT). VER-02/03 delivered structural proofs — the full stack traverses through the OpenRouter provider contract and is rejected on billing because `OPENROUTER_API_KEY` is uncredited (operator-approved known condition, re-verified this pass: `limit: null`, `is_free_tier: true`). The live billing-success assertions remain intact and will turn green after a credit top-up; they are honestly flagged pending-credit in this record, in REQUIREMENTS.md (VER-02/03 stay Pending), and in 22-HUMAN-UAT.md Item 3 — never falsely claimed as passed.

---

_Verified: 2026-08-03T16:40:00Z_
_Verifier: Claude (gsd-verifier, independent pass)_
