---
phase: 21
slug: settings-ui
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-03
---

# Phase 21 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (node environment — NO component test infra; `.test.ts` only, no jsdom) |
| **Config file** | `vitest.config.ts` — `environment: 'node'`, `include: ['src/**/*.test.ts']`, `@` → `src` alias |
| **Quick run command** | `npx vitest run src/components/settings/model-picker-logic.test.ts` |
| **Full suite command** | `npm test` (+ `npm run build` for the RSC/props compile check) |
| **Estimated runtime** | ~15 seconds |

**Constraint:** No `@testing-library/react`, no jsdom. Components are NOT unit-tested; pure logic is extracted and tested (the `explorer-format.tsx` + `explorer-format.test.ts` pattern, and `catalog.test.ts`/`settings.test.ts` for server logic). Browser/interaction behavior is verified via UAT (Phase 22's live-browser UAT per ROADMAP).

---

## Sampling Rate

- **After every task commit:** `npx vitest run src/components/settings/model-picker-logic.test.ts` (targeted file)
- **After every plan wave:** `npm test`
- **Before `/gsd-verify-work`:** `npm test` + `npm run build` must be green (build catches the vendored-file dangling-import pitfall + RSC boundary issues)
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 21-01-XX | 01 | 1 | SET-01 | — | Provider options = SERVABLE_PROVIDERS names (no auth/leak surface) | unit (optional pure fn) | `npx vitest run src/components/settings/model-picker-logic.test.ts` | ❌ W0 | ⬜ pending |
| 21-01-XX | 01 | 1 | SET-02 | — | `servableByProvider` per-provider lists (anthropic 1, openrouter 336) | unit | `npx vitest run src/lib/models/catalog.test.ts` | ✅ | ⬜ pending |
| 21-02-XX | 02 | 2 | SET-03 | — | keep-if-valid → reset-to-default + hint + fallback preservation (pure reducer) | unit | `npx vitest run src/components/settings/model-picker-logic.test.ts` | ❌ W0 | ⬜ pending |
| 21-02-XX | 02 | 2 | SET-04 | — | union grouping by provider (353 = 336+17), no family subgroups | unit | `npx vitest run src/components/settings/model-picker-logic.test.ts` | ❌ W0 | ⬜ pending |
| 21-02-XX | 02 | 2 | SET-05 | — | `savedChain` provider resolution (dup-name disambiguation input) | unit | `npx vitest run src/lib/models/catalog.test.ts` | ✅ | ⬜ pending |
| 21-03-XX | 03 | 2 | SET-06 | — | composite search value = id + name + family (round-trip onSelect → id) | unit | `npx vitest run src/components/settings/model-picker-logic.test.ts` | ❌ W0 | ⬜ pending |
| 21-03-XX | 03 | 2 | SET-07 | — | suffix labels: `~` → "always the latest", `:free` → "free tier — 50 req/day shared", no overlap | unit | `npx vitest run src/components/settings/model-picker-logic.test.ts` | ❌ W0 | ⬜ pending |
| 21-03-XX | 03 | 2 | SET-08 | — | union staleIds (dropped id blocked; `''` not stale); high-cost ≥ $50 (o1-pro $150 trips, cheap rows don't) | unit | `npx vitest run src/components/settings/model-picker-logic.test.ts` | ❌ W0 | ⬜ pending |
| 21-04-XX | 04 | 3 | (existing) | — | saveSettingsAction union validation, dedupe backstop, security order (unchanged) | unit | `npm test` — `src/app/actions/settings.test.ts` | ✅ | ⬜ pending |
| 21-04-XX | 04 | 3 | (existing) | — | catalog union/identity functions (unchanged) | unit | `npm test` — `src/lib/models/catalog.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/settings/model-picker-logic.ts` — the client-safe pure module (search composite, suffix label, high-cost, reset reducer, union staleIds, grouping, dedupe) that makes SET-03/04/06/07/08 unit-testable
- [ ] `src/components/settings/model-picker-logic.test.ts` — the Vitest suite for the above (fixtures inline, decoupled from `catalog.json` per the `catalog.test.ts` convention)
- [ ] No framework install needed — pure functions run under the existing node-env Vitest
- [ ] Manual/UAT coverage note: provider-selector placement, badges, trigger labels, search UX, saved-chain recap are visual/interaction — Phase 22's live-browser UAT owns them (ROADMAP §Phase 22)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Provider selector placement above Primary label | SET-01 | Visual/interaction — no component test infra | Open Settings → AI Model Configuration card → selector renders directly above "Primary model" |
| Command-search UX in the 336-row OpenRouter picker | SET-06 | Visual/interaction — cmdk needs a browser | Open fallback picker → type "sonnet" → filtered rows with provider/family grouping |
| Provider badges on picker rows + saved-chain recap | SET-05 | Visual/interaction | Add cross-provider fallback chain → Save → recap shows badges per model |
| Provider-switch reset hint | SET-03 | Visual/interaction | Switch provider → inline hint under selector; draft preserved; Save persists |
| High-cost warning styling | SET-08 | Visual/interaction | Open OpenRouter picker → `openai/o1-pro` row shows amber cost warning |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
