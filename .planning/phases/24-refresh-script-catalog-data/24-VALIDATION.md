---
phase: 24
slug: refresh-script-catalog-data
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-04
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
| 24-01-01 | 01 | 1 | CAT-01..04 | — | N/A (dev-time script, no auth boundary) | unit | `npx vitest run src/lib/models/catalog.test.ts` | ✅ | ⬜ pending |
| 24-01-02 | 01 | 1 | D-24-03/04 | — | N/A | unit | `npx vitest run src/lib/models/catalog.test.ts src/lib/agents/modelFactory.test.ts` + `npx tsc --noEmit` | ✅ | ⬜ pending |
| 24-02-01 | 02 | 2 | CAT-01/02/03 | — | N/A | manual | `npm run models:fetch` (observable snapshot or clean abort) | ⬜ W0 | ⬜ pending |
| 24-02-02 | 02 | 2 | CAT-04, D-24-06/07 | — | N/A | manual | `npm run models:fetch` (drift → abort expected pre-CLI-upgrade) | ⬜ W0 | ⬜ pending |
| 24-03-01 | 03 | 3 | CAT-03, D-24-11 | — | N/A | unit | `npm run models:fetch` + `npx vitest run src/lib/models/catalog.test.ts` | ⬜ W0 | ⬜ pending |
| 24-04-01 | 04 | 4 | D-24-12 | — | N/A | unit | `npx vitest run src/lib/models/catalog.test.ts -t "NOUSRESEARCH"` | ⬜ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/models/catalog.ts` — `getAllModels()` helper + `ModelCatalog` grouped `{ generatedAt, providers }` type (compile-blocker for every consumer)
- [ ] `src/lib/models/catalog.test.ts` — fixture migrated to grouped `providers` shape (compile-blocker)
- [ ] `src/lib/models/catalog.test.ts` — hermes fixture rows re-valued to live data (0.05/0.2, 0.09/0.37 per-MTok, context 131072, `structuredOutputs: false`)
- [ ] `src/lib/models/catalog.test.ts` — COUNT-STABILITY + NO-FLIP canaries re-locked (D-24-11) to post-refresh numbers (computed from the regenerated snapshot, NOT auto-derived)
- [ ] `src/lib/models/catalog.test.ts` — new D-24-12 Nous canary group (292 rows, hermes pins, ×1e6 pricing, family, ~latest self-exclusion)
- [ ] `scripts/refresh-model-catalog.ts` — `fetchNousRoster`, `deriveNousFamily`, `verifyZenGoRosters` (script is NOT under vitest — manual `npm run models:fetch` verification; smoke assertion in plan)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Zen/Go strict drift check | CAT-04, D-24-06/07 | Requires live anonymous HTTP calls to opencode.ai endpoints + current CLI state; not a pure unit | Run `npm run models:fetch` with current CLI — expect abort with per-id drift list (Go: 7 live-only ids). After `opencode upgrade`, re-run — expect clean pass |
| Snapshot regeneration + commit | CAT-03 | Writes `src/lib/models/catalog.json` and requires review of the diff (292 nous rows, Go 17→25) | Run `npm run models:fetch`, inspect `git diff src/lib/models/catalog.json` for grouped shape, nousresearch rows, refreshed Go rows |
| CLI-upgrade pre-flight | CAT-04 | External tool upgrade with human checkpoint | `opencode upgrade` → `opencode models --refresh` → verify `opencode-go` block = 25 rows before the refresh task |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

---

## Threat Model Notes

Security enforcement: ASVS L1, block on HIGH severity. Phase 24 is a dev-time
data pipeline (`scripts/`), no user-facing auth boundary. Relevant security
considerations pass to the planner:
- Anonymous public GETs only (no secrets in the script; no API keys added).
- `child_process` + `fetch` stay in `scripts/` — never in `src/` (Phase 18 verification gate greps zero `exec|spawn|child_process` in src/).
- No env var additions in this phase (keys are Phase 23/25 concerns).
- Abort-without-write on any live-fetch failure — committed snapshot stays usable (throws-not-degrades, Pitfall 3).
