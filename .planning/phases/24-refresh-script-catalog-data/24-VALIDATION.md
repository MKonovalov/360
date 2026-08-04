---
phase: 24
slug: refresh-script-catalog-data
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-04
audited: 2026-08-04
---

# Phase 24 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 |
| **Config file** | `vitest.config.mjs` (alias `@` → `./src`, include `src/**/*.test.ts`, env `node`) |
| **Quick run command** | `npx vitest run src/lib/models/catalog.test.ts src/lib/agents/modelFactory.test.ts` |
| **Full suite command** | `npm test` |
| **Script sanity command** | `npm run models:fetch` (tsx; must produce a snapshot or abort cleanly without writing) |
| **Type check** | `npx tsc --noEmit` (Next 16 type-checks server components on `npm run build`) |
| **Estimated runtime** | ~60 seconds (vitest) + ~30s tsc |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/lib/models/catalog.test.ts` (the migrated canary suite) + `npx tsc --noEmit`
- **After every plan wave:** Run `npm test` (full Vitest suite — runAgent/modelFactory/settings canaries all consume the snapshot via registry fns)
- **Before `/gsd-verify-work`:** Full suite must be green AND `npm run models:fetch` run (or documented blocked-by-CLI-drift abort)
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 24-01-01 | 01 | 1 | CAT-01..04 | — | N/A (dev-time script, no auth boundary) | unit | `npx vitest run src/lib/models/catalog.test.ts` | ✅ | ✅ green |
| 24-01-02 | 01 | 1 | D-24-03/04 | — | N/A | unit | `npx vitest run src/lib/models/catalog.test.ts src/lib/agents/modelFactory.test.ts` + `npx tsc --noEmit` | ✅ | ✅ green |
| 24-02-01 | 02 | 2 | CAT-01/02/03 | — | N/A | manual | `npm run models:fetch` (observable snapshot or clean abort) | ✅ verified | ✅ green |
| 24-02-02 | 02 | 2 | CAT-04, D-24-06/07 | — | N/A | manual | `npm run models:fetch` (drift → abort expected pre-CLI-upgrade) | ✅ verified | ✅ green |
| 24-03-01 | 03 | 3 | CAT-03, D-24-11 | — | N/A | unit | `npm run models:fetch` + `npx vitest run src/lib/models/catalog.test.ts` | ✅ | ✅ green |
| 24-04-01 | 04 | 4 | D-24-12 | — | N/A | unit | `npx vitest run src/lib/models/catalog.test.ts -t "NOUSRESEARCH"` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

## Validation Audit 2026-08-04

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

All 6 tasks COVERED post-execution. Manual verifications executed live during the phase:
drift-abort smoke (exit 1, 7 live-only Go ids, no write) pre-amendment; post-amendment `npm run models:fetch` exit 0 (1427 rows). No automated gaps — the script's live-fetch paths are manual-only by design (documented below).

---

## Wave 0 Requirements

- [x] `src/lib/models/catalog.ts` — `getAllModels()` helper + `ModelCatalog` grouped `{ generatedAt, providers }` type (compile-blocker for every consumer)
- [x] `src/lib/models/catalog.test.ts` — fixture migrated to grouped `providers` shape (compile-blocker)
- [x] `src/lib/models/catalog.test.ts` — hermes fixture rows re-valued to live data (0.05/0.2, 0.09/0.37 per-MTok, context 131072, `structuredOutputs: false`)
- [x] `src/lib/models/catalog.test.ts` — COUNT-STABILITY + NO-FLIP canaries re-locked (D-24-11) to post-refresh numbers (computed from the regenerated snapshot, NOT auto-derived) — re-locked to actual 40/{23,17} + pool 66/dual 12/go-ex 6
- [x] `src/lib/models/catalog.test.ts` — new D-24-12 Nous canary group (292 rows, hermes pins, ×1e6 pricing, family, ~latest self-exclusion) — 7/7 green
- [x] `scripts/refresh-model-catalog.ts` — `fetchNousRoster`, `deriveNousFamily`, `verifyZenGoRosters` (script is NOT under vitest — manual `npm run models:fetch` verification; smoke assertion in plan) — verified live pre-amendment (drift abort) + post-amendment (exit 0)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions | Status |
|----------|-------------|------------|-------------------|--------|
| Zen/Go strict drift check | CAT-04, D-24-06/07 | Requires live anonymous HTTP calls to opencode.ai endpoints + current CLI state; not a pure unit | Run `npm run models:fetch` with current CLI — expect abort with per-id drift list (Go: 7 live-only ids). After `opencode upgrade`, re-run — expect clean pass | ✅ executed — pre-amendment drift abort (exit 1, 7 live-only ids, no write); post-amendment exit 0 (1427 rows written, restored for Plan 03) |
| Snapshot regeneration + commit | CAT-03 | Writes `src/lib/models/catalog.json` and requires review of the diff (292 nous rows, Go 17→18) | Run `npm run models:fetch`, inspect `git diff src/lib/models/catalog.json` for grouped shape, nousresearch rows, refreshed Go rows | ✅ executed — regenerated grouped snapshot (292 nous / 18 go / 60 zen) committed in 56d9fdaa with re-locked canaries (D-24-11) |
| CLI-upgrade pre-flight | CAT-04 | External tool upgrade with human checkpoint | `opencode upgrade` → `opencode models --refresh` → verify `opencode-go` block = 25 rows before the refresh task | ✅ executed — upgraded to 1.18.12 (npm latest); Go block still 18 (models.dev lags live by 7); user-approved D-24-07 amendment pins the known-drift exception (444bb9ed); re-verify later when models.dev catches up |

Note: the Go-roster target of 25 rows was NOT reached (models.dev lags live by 7 ids — registry-side, verified). The deliberate D-24-07 amendment (user-approved, pinned GO_KNOWN_LIVE_ONLY_IDS) accepts exactly the 7 known ids — any NEW drift still aborts. This is the documented drift state, not a validation gap.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** Nyquist-compliant — all requirements have automated or manually-executed verification (2026-08-04)

---

## Threat Model Notes

Security enforcement: ASVS L1, block on HIGH severity. Phase 24 is a dev-time
data pipeline (`scripts/`), no user-facing auth boundary. Relevant security
considerations pass to the planner:
- Anonymous public GETs only (no secrets in the script; no API keys added).
- `child_process` + `fetch` stay in `scripts/` — never in `src/` (Phase 18 verification gate greps zero `exec|spawn|child_process` in src/).
- No env var additions in this phase (keys are Phase 23/25 concerns).
- Abort-without-write on any live-fetch failure — committed snapshot stays usable (throws-not-degrades, Pitfall 3).
