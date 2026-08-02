---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: AI Model Settings
status: Awaiting next milestone
last_updated: "2026-08-02T17:36:05.805Z"
last_activity: 2026-08-02 — Milestone v1.3 completed and archived
progress:
  total_phases: 4
  completed_phases: 4
  total_plans: 12
  completed_plans: 12
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-02)

**Core value:** Fast, shared ICP lookup — anyone on the team can pull up a company or persona and see a complete, trustworthy 360 view with buying signals in seconds.
**Current focus:** Milestone complete

## Current Position

Phase: Milestone v1.3 complete
Plan: —
Status: Awaiting next milestone
Last activity: 2026-08-02 — Milestone v1.3 completed and archived

## Performance Metrics

**Velocity:**

- Total plans completed: 63 (v1.0: 14 + v1.1: 27 + v1.2: 10)
- Average duration: - min
- Total execution time: - hours (v1.3 not started)

**By Phase (v1.3):**

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 15-model-registry-foundation-persistence | 01 | 14min | 3 | 5 |
| 15-model-registry-foundation-persistence | 02 | 10min | 3 | 5 |

**Recent Trend:**

- Last 5 plans (v1.2): Phase 14 P01 (42min, 4 tasks, 6 files); Phase 13/12/11 plans 2-5min
- Trend: N/A (new milestone)

*Updated after each plan completion*
| Phase 17-settings-ui-list-source P01 | 2min | 2 tasks | 7 files |
| Phase 17-settings-ui-list-source P02 | 6min | 3 tasks | 4 files |
| Phase 17-settings-ui-list-source P03 | 7min | 2 tasks | 2 files |
| Phase 18-verification-gate P01 | 3min | 3 tasks | 4 files |
| Phase 18 P02 | 21min | 3 tasks | 3 files |
| Phase 18 P03 | 45min | 3 tasks | 1 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- **Roadmap (v1.3): Phase structure follows research SUMMARY "Implications for Roadmap"** — Phase 15 (A) Model Registry Foundation + Persistence (REG-01..05 + CAT-01..04) → Phase 16 (B) Failover Orchestration (FAL-01..05) → Phase 17 (C) Settings UI + List Source (SET-01..07) → Phase 18 (D) Verification Gate (VER-01..04). Sequential numbering continues from v1.2's Phase 14.
- **Roadmap (v1.3): Locked design decisions (research resolved — do NOT re-litigate)** — raw provider model IDs stored (`claude-sonnet-4-6`, never `anthropic/...`); failover triggers on ANY retryable provider/model error (non-failover = validation/output/schema/auth-401-403); catalog = committed JSON snapshot from `opencode models` dev-time script (no DB table, no runtime opencode); chain = primary + 1 fallback (60s budget, ~35s/~20s per-attempt timeouts); `fallback_models` typed `text[]`; output/schema errors fail loud, no fallback.
- **Roadmap (v1.3): Requirement count is 25, not 24** — SET-01..07 (7) + REG-01..05 (5) + CAT-01..04 (4) + FAL-01..05 (5) + VER-01..04 (4) = 25. All 25 mapped, no orphans, no phase with zero requirements.
- **Roadmap (v1.3): Phase 15 carries the migration-apply-flow confirmation** — `drizzle/meta/_journal.json` has zero entries (MEDIUM research flag): confirm `drizzle-kit push` vs generate+commit before adding `user_model_settings`.
- **Roadmap (v1.3): Pitfall-11 pre-flight note goes into the Phase 16 plan** — verify `generateText` model option, exported error classes, and `anthropic('id')` behavior against installed `ai@7.0.45`/`@ai-sdk/anthropic@4.0.26` dist types BEFORE writing the failover loop (v1.1-proven mitigation).
- **Roadmap (v1.3): Allowlist curation is standing maintenance** — only `claude-sonnet-4-6` is roster-verified (2026-08-01); Phase 15 re-verifies any curated additions via `GET /v1/models`.
- [Phase 15]: D-06 intent reading: NO version column on user_model_settings (atomic upsert prevents lost updates); createdAt ships per repo convention (every table has it)
- [Phase 15]: fallbackModels comment cites company.techStack (schema.ts:61) as the text[] precedent — 'first text[] column' claim is factually wrong per research
- [Phase 15]: Allowlist ships ['claude-sonnet-4-6'] only — live GET /v1/models 2026-08-02 verified sonnet-4-6, undated haiku-4-5 ABSENT (only dated -20251001 exists); D-02 gate defers haiku-4-5, no invented/dated IDs — Roster re-verify executed as Task 1 of plan 15-02; research finding confirmed at execution time
- [Phase 15]: Catalog snapshot at src/lib/models/catalog.json (D-08 discretion) co-located with typed accessor; repo-root scripts/ holds the child_process script (Pitfall 4 — keeps src/ exec-free for the Phase 18 grep gate) — CAT-02 gate re-verified 0 hits after all files landed
- [Phase 17]: getActiveNavKey matches /settings with an exact-match-only branch (no startsWith('/settings/')) — /settings is a leaf page with no detail routes; pins the sibling-prefix guard and threat T-17-02, locked by a /settings-archive boundary Vitest case
- [Phase 17]: Settings sidebar item is badge-free — SidebarMenuBadge + dot block is Reviews-only; getNavTooltipLabel reviews special-case branch untouched
- [Phase 17]: D-01 verdict 2026-08-02: undated claude-haiku-4-5 still absent on live GET /v1/models -> ANTHROPIC_ALLOWLIST stays sonnet-only (D-02), no dated/invented IDs; verdict recorded in 17-02-SUMMARY
- [Phase 17]: saveSettingsAction never returns stale_primary/stale_fallback - a dropped-from-roster id fails the server-computed servable-set check (allowlist intersect snapshot) and surfaces as invalid_model (T-17-06); client-side staleness gate (plan 17-03 Task 2) is the primary D-10/D-11 mechanism
- [Phase 17]: Empty fallback rows are dropped before sending to the action — an in-progress row is not a model selection; sending it verbatim would trip invalid_model (SET-04 'empty fallback list is saveable' honored)
- [Phase 17]: Stale option labels fall back to the raw id in the client — no snapshot access by design (client-bundle rule), matching getModelDisplayName's D-06 fallback rule
- [Phase 17]: Sonnet-only branch keeps stale saved fallbacks removable (Rule 2 fix) — otherwise a stale fallback blocks Save forever with no row to clear it (D-10/D-11 must-have truth)
- [Phase ?]: Phase 18 P01: Real-snapshot catalog test (import catalogJson) is the ONE deliberate exception to the fixture-decoupling convention — drift-guarded by its assertion, not the model count
- [Phase ?]: Phase 18 P01: SC-3 forced-fail clause recorded as satisfied-by-extension via runAgent.test.ts RetryError-404 + exhaustion tests (D-18-02) — zero prod code changes, Vitest mocks are the reproducible forced-fail proof
- [Phase ?]: Phase 18 P01: Checklist count corrected to 13 items (not 12); catalog.test.ts corrected to 9 tests (not 11) — carried verbatim into 18-VER-01-MATRIX.md
- [Phase 18]: Postgres assertion targets model_used/model_chain columns only (Pitfall 5) — usedFallback is response-only (route.ts:111), never queried as a DB column
- [Phase 18]: SC-3 forced-fail clause recorded as satisfied-by-extension via runAgent.test.ts RetryError-404 + exhaustion tests (D-18-02) — no production fail hook added, zero src/ changes
- [Phase ?]: A1 confirmed: the Vercel GitHub integration auto-built the PR #1 preview; the post-fix deployment used a fresh full CLI deploy (NOT --prebuilt, per D-18-03)
- [Phase ?]: Vercel DATABASE_URL migrated off the v1.0-era Neon integration secret to an explicit project env var pointing at the known-good DB (ep-proud-bread-agmksetk) — rule-3 Vercel-config fix, zero src/ changes
- [Phase ?]: Verified preview URL (sole VER-04 evidence URL): https://360-arclumen-g3pye9c3d-mkonovalovs-projects.vercel.app — human-approved across all 5 how-to-verify steps

### Pending Todos

None yet.

### Blockers/Concerns

- **Migration apply flow (Phase 15 gate):** confirm `drizzle-kit push` vs generate+commit before touching schema.ts — `_journal.json` is empty (MEDIUM research flag).
- **Allowlist curation:** only `claude-sonnet-4-6` currently roster-verified — Phase 15 must re-verify any curated additions before they appear in the pickers.
- **60s ceiling is a hard wall:** chain budget (attempts × per-attempt timeout + SDK retry backoff ≤ 60s) must land in Phase 16 and be proven in Phase 18 — `maxDuration` stays at Hobby's 60, never raised.
- **Settings-never-consumed risk (Pitfall 10):** the milestone's core acceptance test is change settings → Analyze → `agent_run.model_used` matches — must land as a Phase 18 UAT line, not assumed.
- Carried from v1.1/v1.2: persona-side Arcpedia content gap (seed data); 3 VERIFICATION.md files still `human_needed`; "any authenticated Clerk user = staff" model has no role system (acceptable per PROJECT.md scope).

## Deferred Items

Items acknowledged and carried forward from v1.1/v1.2 milestone close, still open:

| Category | Item | Status |
|----------|------|--------|
| uat_gap | Persona-side "Related Knowledge" (Arcpedia) end-to-end with real matches | pending — code path proven identical to Company, seed data lacks a matching name |
| uat_gap | 01-HUMAN-UAT.md | partial — 2 pending scenarios |
| uat_gap | 02-HUMAN-UAT.md | partial — 4 pending scenarios |
| uat_gap | 04-HUMAN-UAT.md | partial — 1 pending scenario (Persona-side Arcpedia content gap) |
| verification_gap | 01/02/03/04-VERIFICATION.md | human_needed |

## Session Continuity

Last session: 2026-08-02T17:03:17.998Z
Stopped at: Phase 18 context gathered
Resume file: None

## Operator Next Steps

- Start the next milestone with /gsd-new-milestone
