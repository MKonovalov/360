---
phase: 24-refresh-script-catalog-data
plan: 02
subsystem: data
tags: [catalog, refresh-script, nousresearch, opencode, roster-drift, throws-not-degrades, blocked]

# Dependency graph
requires:
  - phase: 24-refresh-script-catalog-data (plan 01)
    provides: grouped snapshot shape { generatedAt, providers }, getAllModels() flattening helper, ModelCatalog grouped type
  - phase: 23-provider-registry-servable-sources
    provides: NOUSRESEARCH_ALLOWLIST hermes pins, SNAPSHOT_PROVIDER_IDS (Zen-wins dedup — lives in the registry, D-23-08)
provides:
  - fetchNousRoster / deriveNousFamily / perMTok / nousPreMap / verifyZenGoRosters + the grouped write path in scripts/refresh-model-catalog.ts (CAT-01..04 code, throws-not-degrades)
  - A documented, reproducible BLOCKER: the strict D-24-07 Go drift check cannot pass with the current opencode CLI (1.18.12 = npm latest, 18 go rows vs 25 live) — Plan 03 regeneration is blocked by design until resolved
affects: [24-03-regeneration, 24-04-canary-relock, 25-run-path-modelfactory-seam, 26-settings-ui, 27-verification-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Throws-not-degrades extended to three new live-fetch sources (Nous, Zen, Go) — any failure or drift aborts main() BEFORE writeFileSync"
    - "Strict Set-diff drift check (D-24-07): ANY Zen/Go id-set difference throws with per-id Live-only/CLI-only reporting; no count tolerance, never silently relaxed"
    - "Grouped snapshot write keyed by each row's own providerID string, sorted keys for diff stability (D-24-03/05)"

key-files:
  created: [.planning/phases/24-refresh-script-catalog-data/24-02-SUMMARY.md]
  modified: [scripts/refresh-model-catalog.ts]

key-decisions:
  - "Task 1 shipped as ONE atomic commit (b5f95890) — all four new functions + the grouped write path together; parseModels/trimRecord/fetchOpenRouterStructuredOutputs/familyFallbackStructuredOutputs byte-identical (D-24-10)"
  - "The approved Task 2 CLI upgrade ran (opencode upgrade 1.18.11 → 1.18.12, verified npm `latest` — no newer stable exists) + `opencode models --refresh`; the go roster is STILL 18 (not 25) — the gap is registry-side (models.dev itself lags live by hy3-preview; the CLI filters 6 more)"
  - "D-24-07 strictness NOT relaxed: with the go count ≠ 25, the refresh stays blocked by design (throws-not-degrades — exit 1, no write, committed snapshot usable) and the phase ESCALATES with options — exactly the plan's success-criteria OR branch"
  - "NO requirements marked complete: CAT-01..04 are delivered as script code but not closed as requirements (CAT-03 needs the regenerated+committed snapshot; CAT-04 needs a passing drift check) — traceability stays honest"

patterns-established:
  - "Pattern 1: mirror-fetch doctrine — every new live-fetch (fetchNousRoster, verifyZenGoRosters' compare) copies fetchOpenRouterStructuredOutputs' exact convention: try/catch → throw with '— snapshot NOT regenerated'; non-OK → throw with '(HTTP ${res.status})'; defensive shape casts with ?? [] + typeof guards"
  - "Pattern 2: strict drift — verifyZenGoRosters Set-diffs live id-sets vs CLI-parsed ids by providerID (opencode ↔ Zen, opencode-go ↔ Go) and throws with per-id diffs; the message names the resolution ('Update the opencode CLI (opencode upgrade) and re-run.')"

requirements-completed: []  # Plan is BLOCKED at escalation — no requirement closed (see body §Escalation)

# Metrics
duration: ~15min active (2 segments; checkpoint approval gap excluded)
completed: 2026-08-04
---

# Phase 24 Plan 2: Refresh-Script Extension + CLI Upgrade Pre-Flight Summary

**Extended `scripts/refresh-model-catalog.ts` with `fetchNousRoster`, `deriveNousFamily`, `perMTok`, the Nous pre-map and the strict `verifyZenGoRosters` drift check plus the grouped write path — smoke-proven to abort-without-write (exit 1, 7 live-only Go ids); executed the human-approved `opencode upgrade` (1.18.11 → 1.18.12, npm latest) — the Go roster is STILL 18 vs 25 live, so the strict D-24-07 check keeps the refresh blocked by design and the phase escalates with options (never a silent relax).**

## Performance

- **Duration:** ~15 min active execution across two segments (Task 1 + checkpoint return; then the approved upgrade + drift capture + docs). Wall clock spans the checkpoint approval gap (2026-08-04 ~03:04Z → 08:56Z).
- **Started:** 2026-08-04T03:03:00Z (segment 1)
- **Completed:** 2026-08-04T08:56:02Z (segment 2)
- **Tasks:** 2 (1 auto task committed; 1 checkpoint task executed to its escalation branch)
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
2. **Task 2: Pre-flight opencode CLI upgrade + go-roster re-verify** - no code commit (external tool state; executed to escalation branch — see Escalation)

**Plan metadata:** `pending` (docs commit follows this summary)

## Files Created/Modified

- `scripts/refresh-model-catalog.ts` - +159/−2: `NousRosterRow` type, `fetchNousRoster()`, `deriveNousFamily()`, `perMTok()`, `nousPreMap()`, `verifyZenGoRosters()`; `main()` rewired to fetch Nous → compose allModels → strict Zen/Go verify BEFORE write → grouped snapshot write.
- `.planning/phases/24-refresh-script-catalog-data/24-02-SUMMARY.md` - this record.

## Decisions Made

- **Task 1 as one atomic commit** — the four new functions + the write-path rewire ship together (intermediate states were never committed); D-24-10 keep-as-is honored (git diff = 2 hunks: the insertion block + the main() rewire, verified).
- **`fetchNousRoster` return uses a type-predicate filter** (`(r): r is NousRosterRow => typeof r.id === 'string'`) — the plan's literal untyped filter does not narrow `Record<string, unknown>[]` to the typed row array under strict TS; the predicate keeps the exact `typeof r.id === 'string'` defensive guard (T-24-04) while satisfying the plan's own `npx tsc --noEmit` acceptance gate. No behavioral difference (tsc exit 0, smoke identical to research prediction).
- **CLI upgrade executed as approved** (1.18.11 → 1.18.12 = npm `latest`; verified via `npm view opencode-ai dist-tags` that no newer stable exists) + `opencode models --refresh` — the plan's Landmine 1 mitigation was attempted in full.
- **Strictness preserved** — D-24-07 is NOT relaxed on the still-drifting roster; the phase escalates per the plan's own success criteria OR branch ("the drift is documented and the phase escalates").

## Deviations from Plan

None - plan executed exactly as written (both tasks; Task 2 landed on the plan's explicit escalation branch).

One Rule 1-adjacent implementation note (not a deviation): the type-predicate annotation on the `fetchNousRoster` filter (see Decisions Made) — the plan's literal expression would not compile under the plan's own tsc gate.

**Total deviations:** 0 auto-fixed
**Impact on plan:** N/A

## Issues Encountered

- **The Go roster gap survived the CLI upgrade** (research Landmine 1, Open Questions 1/3 — now empirically confirmed): opencode 1.18.12 (npm latest) + `models --refresh` still yields 18 opencode-go rows vs 25 live. Root cause is registry-side, exactly as researched: models.dev itself lists 24 go models (missing `hy3-preview`, which exists live) and the CLI filters that further (missing `glm-5`, `qwen3.5-plus`, `mimo-v2-omni`, `kimi-k2.5`, `mimo-v2-pro`, `minimax-m2.5`). Captured drift evidence (identical pre/post upgrade):
  `Go roster drift — snapshot NOT regenerated. Live-only ids (7): minimax-m2.5, kimi-k2.5, glm-5, qwen3.5-plus, mimo-v2-pro, mimo-v2-omni, hy3-preview. CLI-only ids (0): . Update the opencode CLI (opencode upgrade) and re-run.` — exit 1, no write.

## User Setup Required

None from the user's side — the CLI upgrade (the only machine-state change) was executed and approved. The remaining decision is the escalation below.

## Escalation (blocking — requires user decision)

The strict D-24-07 Go drift check **cannot pass** with any available opencode CLI today (1.18.12 is npm `latest`). `npm run models:fetch` therefore continues to abort at the Go check with the 7-id drift list above — **by design** (throws-not-degrades; the committed snapshot stays usable; the Nous/OpenRouter/Zen sides all fetch successfully). Plan 03's regeneration (Go 17 → 25) is blocked until one of:

1. **Wait for a newer release / registry update** — re-run the Task 2 checkpoint (`opencode upgrade` → `opencode models --refresh` → count `'opencode-go'` = 25) after a future opencode or models.dev release closes the gap. Recommended default — zero code change, strictness intact.
2. **Deliberate strictness revisit (explicit user decision only)** — e.g., a documented, pinned Go-id exception list or a count-based leniency in `verifyZenGoRosters`, decided at discuss-phase. **Never a silent relax** (research Landmine 1 option b).
3. **Accept a blocked refresh** — defer Plan 03 until the registry catches up; the phase goal's Go half stays unmet (documented).

Until a decision is made, Plan 03 must not run expecting a green `models:fetch` — it will abort at the Go drift check by design.

## Next Phase Readiness

- **Plan 03 (regeneration)** is BLOCKED pending the escalation decision — the script is ready (grouped write path verified), but `npm run models:fetch` aborts at the Go drift check until the CLI/registry closes the 7-id gap.
- **Plan 04 (canary re-lock + Nous canary group)** can proceed independently of the Go gap (canaries re-lock from whatever snapshot lands; D-24-12 Nous group asserts the 292 nous rows which are unaffected by the Go drift) — but Plan 03's snapshot must land first for the live-snapshot canaries to be re-locked from the actual file (research Open Question 2).
- **Blocker carried:** strict D-24-07 Go drift (18 CLI vs 25 live), escalated above — recorded in STATE.md Blockers.

---

*Phase: 24-refresh-script-catalog-data*
*Completed: 2026-08-04 (blocked at escalation — phase goal's Go half unmet)*

## Self-Check: PASSED

- Created/modified files verified present: `scripts/refresh-model-catalog.ts`, `24-02-SUMMARY.md`
- Commit `b5f95890` verified in git history
- Gates verified: `npx tsc --noEmit` 0 errors; `npm run models:fetch` exit 1 with `Go roster drift` (7 live-only ids) + `snapshot NOT regenerated` and `src/lib/models/catalog.json` untouched (both pre- and post-upgrade runs); targeted vitest 46/46 green
- CLI state verified: `opencode` 1.18.12 (npm `latest`, no newer stable), `opencode-go` count 18 (≠ 25 — drift blocker recorded), `opencode` count 60 (Zen unchanged)
- Keep-as-is honored (D-24-10): `parseModels`/`trimRecord`/`fetchOpenRouterStructuredOutputs`/`familyFallbackStructuredOutputs` byte-identical (git diff = 2 intended hunks)
