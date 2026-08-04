---
phase: 24-refresh-script-catalog-data
plan: 02
subsystem: data
tags: [catalog, refresh-script, nousresearch, opencode, roster-drift, throws-not-degrades, d-24-07-amendment]

# Dependency graph
requires:
  - phase: 24-refresh-script-catalog-data (plan 01)
    provides: grouped snapshot shape { generatedAt, providers }, getAllModels() flattening helper, ModelCatalog grouped type
  - phase: 23-provider-registry-servable-sources
    provides: NOUSRESEARCH_ALLOWLIST hermes pins, SNAPSHOT_PROVIDER_IDS (Zen-wins dedup — lives in the registry, D-23-08)
provides:
  - fetchNousRoster / deriveNousFamily / perMTok / nousPreMap / verifyZenGoRosters + the grouped write path in scripts/refresh-model-catalog.ts (CAT-01..04 code, throws-not-degrades)
  - The user-approved D-24-07 amendment: a pinned GO_KNOWN_LIVE_ONLY_IDS exception (7 known Go-only ids, acceptance-only — any NEW live-only id or ANY CLI-only id still aborts; Zen stays fully strict) that unblocks `npm run models:fetch` for Plan 03
affects: [24-03-regeneration, 24-04-canary-relock, 25-run-path-modelfactory-seam, 26-settings-ui, 27-verification-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Throws-not-degrades extended to three new live-fetch sources (Nous, Zen, Go) — any failure or drift aborts main() BEFORE writeFileSync"
    - "Strict Set-diff drift check (D-24-07): ANY Zen/Go id-set difference throws with per-id Live-only/CLI-only reporting; no count tolerance — narrowed (never disabled) only by the user-approved pinned GO_KNOWN_LIVE_ONLY_IDS exception for the Go compare"
    - "Grouped snapshot write keyed by each row's own providerID string, sorted keys for diff stability (D-24-03/05)"

key-files:
  created: [.planning/phases/24-refresh-script-catalog-data/24-02-SUMMARY.md]
  modified: [scripts/refresh-model-catalog.ts]

key-decisions:
  - "Task 1 shipped as ONE atomic commit (b5f95890) — all four new functions + the grouped write path together; parseModels/trimRecord/fetchOpenRouterStructuredOutputs/familyFallbackStructuredOutputs byte-identical (D-24-10)"
  - "The approved Task 2 CLI upgrade ran (opencode upgrade 1.18.11 → 1.18.12, verified npm `latest` — no newer stable exists) + `opencode models --refresh`; the go roster is STILL 18 (not 25) — the gap is registry-side (models.dev itself lags live by hy3-preview; the CLI filters 6 more)"
  - "D-24-07 AMENDED (user-approved deliberate strictness revisit, 2026-08-04): the escalation options were presented and the user chose the revisit; implemented as a pinned GO_KNOWN_LIVE_ONLY_IDS exception (commit 444bb9ed) — Go compare accepts ONLY the 7 known live-only ids, any NEW live-only id or ANY CLI-only id still aborts, Zen stays fully strict, and accepted drift is logged on every run (never silent)"
  - "NO requirements marked complete: CAT-01..04 are delivered as script code but not closed as requirements (CAT-03 needs the regenerated+committed snapshot in Plan 03; CAT-04's drift check passes only via the pinned exception) — traceability stays honest"

patterns-established:
  - "Pattern 1: mirror-fetch doctrine — every new live-fetch (fetchNousRoster, verifyZenGoRosters' compare) copies fetchOpenRouterStructuredOutputs' exact convention: try/catch → throw with '— snapshot NOT regenerated'; non-OK → throw with '(HTTP ${res.status})'; defensive shape casts with ?? [] + typeof guards"
  - "Pattern 2: strict drift with a pinned exception — verifyZenGoRosters Set-diffs live id-sets vs CLI-parsed ids by providerID (opencode ↔ Zen, opencode-go ↔ Go); the Go compare accepts only GO_KNOWN_LIVE_ONLY_IDS members (logged, never silent) and any other drift throws with per-id diffs"

requirements-completed: []  # No requirement closed — CAT-01..04 stay Pending until Plan 03 regenerates+commits the snapshot (see body §Resolution)

# Metrics
duration: ~15min active (2 segments; checkpoint approval gap excluded)
completed: 2026-08-04
---

# Phase 24 Plan 2: Refresh-Script Extension + CLI Upgrade Pre-Flight Summary

**Extended `scripts/refresh-model-catalog.ts` with `fetchNousRoster`, `deriveNousFamily`, `perMTok`, the Nous pre-map and the strict `verifyZenGoRosters` drift check plus the grouped write path — smoke-proven to abort-without-write (exit 1, 7 live-only Go ids) — then executed the human-approved `opencode upgrade` (1.18.11 → 1.18.12, npm latest); the Go roster stayed 18 vs 25 live, so per the user's explicit deliberate-strictness-revisit decision the Go compare now carries a pinned `GO_KNOWN_LIVE_ONLY_IDS` exception (D-24-07 amendment, never silent, Zen still strict) and `npm run models:fetch` passes — regenerated snapshot restored so Plan 03 owns the commit.**

## Performance

- **Duration:** ~25 min active execution across three segments (Task 1 + checkpoint return; approved upgrade + drift capture + docs; user-approved strictness revisit + smoke + docs). Wall clock spans the checkpoint gaps (2026-08-04 ~03:04Z → 09:45Z).
- **Started:** 2026-08-04T03:03:00Z (segment 1)
- **Completed:** 2026-08-04T09:45:00Z (segment 3)
- **Tasks:** 2 (1 auto task committed; 1 checkpoint task executed to its escalation branch + the user-approved amendment)
- **Files modified:** 1 (scripts/refresh-model-catalog.ts)

## Accomplishments

- **CAT-01/02/03 script code shipped** (commit `b5f95890`): `fetchNousRoster()` (anonymous GET, 292 rows, throws-not-degrades), `deriveNousFamily()` (prefix → family, CAT-03), `perMTok()` (×1e6 string-typed per-token pricing → per-MTok with 6-dp rounding, Pitfall 2), `nousPreMap()` (shapes raw rows through `trimRecord`'s field contract: `providerID 'nousresearch'`, `api {npm: '@ai-sdk/openai-compatible', url: 'https://inference-api.nousresearch.com/v1'}` per D-24-02, `status 'active'`, ids verbatim incl. `~latest` per D-24-08, `structuredOutputs` live-joined from `supported_parameters` per CAT-02/Pitfall 5).
- **CAT-04 strict drift check shipped**: `verifyZenGoRosters(parsed)` fetches the live Zen (60) and Go (25) lean rosters, Set-diffs against the CLI-parsed id-sets by providerID, and throws with per-id `Live-only ids (N)` / `CLI-only ids (N)` reporting (D-24-06/07) — wired BEFORE the write so any drift aborts without touching the committed snapshot (D-24-10).
- **Grouped write path shipped (D-24-03/05)**: `main()` now composes `allModels = [...models, ...nousRows]`, runs `await verifyZenGoRosters(parsed)` before `writeFileSync`, and writes `{ generatedAt, providers: { <providerID>: [...] } }` with alphabetically sorted keys (diff stability); the console.log reports `allModels.length`.
- **Pre-upgrade smoke proven throws-not-degrades end-to-end** against the current CLI (v1.18.11, 18 go rows): `npm run models:fetch` → exit 1, stderr `Go roster drift — snapshot NOT regenerated. Live-only ids (7): ...`, `git status src/lib/models/catalog.json` EMPTY — the committed snapshot stays usable. tsc 0 errors; targeted canary suite 46/46 green; the four keep-as-is functions byte-identical (D-24-10).
- **Task 2 executed per the approved checkpoint**: `opencode upgrade` 1.18.11 → 1.18.12 (curl method, exit 0), `opencode models --refresh` (exit 0), re-counted go roster = **18** (expected 25), Zen unchanged = **60**.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add fetchNousRoster, deriveNousFamily, perMTok, verifyZenGoRosters + grouped write path** - `b5f95890` (feat)
2. **Task 2: Pre-flight opencode CLI upgrade + go-roster re-verify** - no code commit (external tool state; executed to escalation branch)
3. **D-24-07 amendment: pin known Go roster drift exception (user-approved strictness revisit)** - `444bb9ed` (feat)

**Plan metadata:** `pending` (docs commit follows this summary)

## Files Created/Modified

- `scripts/refresh-model-catalog.ts` - +159/−2 (Task 1) then +33/−3 (Task 2 amendment): `NousRosterRow` type, `fetchNousRoster()`, `deriveNousFamily()`, `perMTok()`, `nousPreMap()`, `verifyZenGoRosters()` with the pinned `GO_KNOWN_LIVE_ONLY_IDS` Go-only exception; `main()` rewired to fetch Nous → compose allModels → strict Zen/Go verify BEFORE write → grouped snapshot write.
- `.planning/phases/24-refresh-script-catalog-data/24-02-SUMMARY.md` - this record.

## Decisions Made

- **Task 1 as one atomic commit** — the four new functions + the write-path rewire ship together (intermediate states were never committed); D-24-10 keep-as-is honored (git diff = 2 hunks: the insertion block + the main() rewire, verified).
- **`fetchNousRoster` return uses a type-predicate filter** (`(r): r is NousRosterRow => typeof r.id === 'string'`) — the plan's literal untyped filter does not narrow `Record<string, unknown>[]` to the typed row array under strict TS; the predicate keeps the exact `typeof r.id === 'string'` defensive guard (T-24-04) while satisfying the plan's own `npx tsc --noEmit` acceptance gate. No behavioral difference (tsc exit 0, smoke identical to research prediction).
- **CLI upgrade executed as approved** (1.18.11 → 1.18.12 = npm `latest`; verified via `npm view opencode-ai dist-tags` that no newer stable exists) + `opencode models --refresh` — the plan's Landmine 1 mitigation was attempted in full.
- **Strictness preserved via amendment** — the escalation options were presented (wait / deliberate revisit / accept blocked) and the user **chose the deliberate strictness revisit**; D-24-07 is narrowed (never disabled) by the pinned `GO_KNOWN_LIVE_ONLY_IDS` Go-only exception — any NEW live-only id or ANY CLI-only id still aborts, Zen stays fully strict, and accepted drift is logged every run (never silent).

## Deviations from Plan

None - plan executed exactly as written (both tasks; Task 2 landed on the plan's explicit escalation branch).

One Rule 1-adjacent implementation note (not a deviation): the type-predicate annotation on the `fetchNousRoster` filter (see Decisions Made) — the plan's literal expression would not compile under the plan's own tsc gate.

**Total deviations:** 0 auto-fixed
**Impact on plan:** N/A

## Issues Encountered

- **The Go roster gap survived the CLI upgrade** (research Landmine 1, Open Questions 1/3 — now empirically confirmed): opencode 1.18.12 (npm latest) + `models --refresh` still yields 18 opencode-go rows vs 25 live. Root cause is registry-side, exactly as researched: models.dev itself lists 24 go models (missing `hy3-preview`, which exists live) and the CLI filters that further (missing `glm-5`, `qwen3.5-plus`, `mimo-v2-omni`, `kimi-k2.5`, `mimo-v2-pro`, `minimax-m2.5`). Captured drift evidence (identical pre/post upgrade):
  `Go roster drift — snapshot NOT regenerated. Live-only ids (7): minimax-m2.5, kimi-k2.5, glm-5, qwen3.5-plus, mimo-v2-pro, mimo-v2-omni, hy3-preview. CLI-only ids (0): . Update the opencode CLI (opencode upgrade) and re-run.` — exit 1, no write.

## User Setup Required

None from the user's side — the CLI upgrade (the only machine-state change) was executed and approved, and the strictness-revisit decision was provided (see Resolution above).

## Escalation → Resolution (user-approved strictness revisit, D-24-07 amendment)

**The strict D-24-07 Go drift check cannot pass** with any available opencode CLI today (1.18.12 is npm `latest`); `npm run models:fetch` aborted at the Go check with the 7-id drift list above **by design** (throws-not-degrades; committed snapshot stays usable). The user was offered three options (wait / deliberate strictness revisit / accept blocked refresh) and **explicitly chose the deliberate strictness revisit** — the documented, non-silent sign-off the escalation branch requires.

**Implemented (commit `444bb9ed`):** a **pinned known-drift exception for the Go roster only**:
- Module-level `GO_KNOWN_LIVE_ONLY_IDS` Set of exactly the 7 models.dev-lagged live Go ids, with a why-comment recording the DELIBERATE user-approved amendment (2026-08-04, CLI 1.18.12).
- `verifyZenGoRosters`' `compare()` splits `missing` into `knownDrift` (pinned, accepted) vs `unexpectedMissing` — **any NEW live-only id NOT in the set, and ANY CLI-only id, still aborts the run** (the strict check is narrowed, never disabled).
- Scope: exception applies **only** to the Go compare (`label === 'Go'`); **Zen stays fully strict** — any Zen diff still throws.
- Accepted drift is logged to stderr on every run — **never silent**:
  `Known Go roster drift accepted (pinned exception, D-24-07 amendment): minimax-m2.5, kimi-k2.5, glm-5, qwen3.5-plus, mimo-v2-pro, mimo-v2-omni, hy3-preview`

**Smoke-verified resolution:** `npm run models:fetch` now **exits 0** and writes the grouped snapshot (1427 models = 1135 CLI rows + 292 nous rows; the `opencode-go` group holds the 18 CLI rows — the exception accepts the 7-id gap, it does not inject live ids). The regenerated `catalog.json` was **immediately restored** (`git checkout -- src/lib/models/catalog.json`, status empty) so **Plan 03 owns the regeneration commit**. `npx tsc --noEmit` 0 errors.

**Semantic note for Plan 03:** because the exception is acceptance-only, the regenerated snapshot's `opencode-go` group will have the 18 CLI rows (not 25 live). When a future opencode/models.dev release closes the gap, the pinned set becomes inert (no ids match) and the snapshot's Go group naturally reaches 25 — the pinned set can then be deleted at a future plan's discretion.

## Next Phase Readiness

- **Plan 03 (regeneration) is UNBLOCKED** — the Go drift blocker was resolved via the user-approved pinned exception (commit `444bb9ed`); `npm run models:fetch` now exits 0 and writes the grouped snapshot. Plan 03 owns the regeneration commit (`catalog.json` currently at the pre-regeneration state: 0 nousresearch rows, 17 opencode-go rows).
- **Plan 03 semantic note:** the regenerated `opencode-go` group will hold the 18 CLI rows (the exception is acceptance-only — the 7 live-only ids are documented, not injected); the nousresearch group ships all 292 rows.
- **Plan 04 (canary re-lock + Nous canary group)** proceeds after Plan 03's snapshot lands (research Open Question 2) — the D-24-12 Nous group asserts the 292 nous rows which are unaffected by the Go exception.
- **Blocker resolved:** strict D-24-07 Go drift (18 CLI vs 25 live) — resolved 2026-08-04 by the user-approved `GO_KNOWN_LIVE_ONLY_IDS` pinned exception (any NEW drift still aborts; Zen stays strict). Recorded in STATE.md.

---

*Phase: 24-refresh-script-catalog-data*
*Completed: 2026-08-04 (resolution: user-approved D-24-07 strictness amendment — Go drift pinned, Zen strict, Plan 03 unblocked)*

## Self-Check: PASSED

- Created/modified files verified present: `scripts/refresh-model-catalog.ts`, `24-02-SUMMARY.md`
- Commits `b5f95890` (Task 1) and `444bb9ed` (D-24-07 amendment) verified in git history; regenerated `catalog.json` restored (not committed — `git status` empty)
- Gates verified: `npx tsc --noEmit` 0 errors; `npm run models:fetch` pre-amendment exit 1 with `Go roster drift` (7 live-only ids) + `snapshot NOT regenerated` and `catalog.json` untouched; post-amendment exit 0 with `Known Go roster drift accepted (pinned exception, D-24-07 amendment): ...` logged and the snapshot written then restored; targeted vitest 46/46 green
- CLI state verified: `opencode` 1.18.12 (npm `latest`, no newer stable), `opencode-go` count 18 (pinned-accepted), `opencode` count 60 (Zen unchanged — Zen fully strict)
- Keep-as-is honored (D-24-10): `parseModels`/`trimRecord`/`fetchOpenRouterStructuredOutputs`/`familyFallbackStructuredOutputs` byte-identical; the only functional change is the scoped exception inside `verifyZenGoRosters`
