---
gsd_state_version: 1.0
milestone: v1.4
milestone_name: Signals & Offerings
status: planning
last_updated: "2026-08-04T10:34:22.068Z"
last_activity: 2026-08-04
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-04)

**Core value:** Fast, shared ICP lookup — anyone on the team can pull up a company or persona and see a complete, trustworthy 360 view with buying signals in seconds.
**Current focus:** Phase 30 — Shared Data Model + Seed (v1.4 Signals & Offerings)

## Current Position

Phase: 30 — Shared Data Model + Seed (not started)
Plan: —
Status: Roadmap created, awaiting `/gsd-plan-phase 30`
Last activity: 2026-08-04 — v1.4 ROADMAP.md created (Phases 30-32, 27/27 requirements mapped)

## Performance Metrics

**Velocity:**

- Total plans completed: 60 (v1.0: 14 + v1.1: 27 + v1.2: 10); v1.3: 11 plans across Phases 15-17 (Phase 18 partial, 2/3)
- Average duration: - min
- Total execution time: - hours (v1.4 not started)

**By Phase (v1.4):**

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 30-shared-data-model-seed | — | — | — | — |
| 31-signals-ui | — | — | — | — |
| 32-offerings-ui | — | — | — | — |

**Recent Trend:**

- Last 5 plans (v1.3): Phase 18 P02 (21min, 3 tasks, 3 files); Phase 18 P01 (3min); Phase 17 P01-03 (2-7min)
- Trend: N/A (new milestone, phase numbering restarts at 30)

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- **Roadmap (v1.4): Phase count, numbers, and sequencing are explicit user decisions, not derived** — exactly 3 phases, numbered 30/31/32 (skipping 19-29 by explicit choice, not continuing from v1.3's Phase 18 and not resetting to 1). Phase 30 (shared data model + GBS seed, no UI) → Phase 31 (Signals UI) → Phase 32 (Offerings UI), per spec Section 6's recommended sequencing.
- **Roadmap (v1.4): 27/27 requirements mapped, zero orphans** — DATA-01..10 (10) → Phase 30, SIG-01..09 (9) → Phase 31, OFR-01..08 (8) → Phase 32.
- **Roadmap (v1.4): Phase 30 is intentionally a no-UI, backend-only phase** — this is expected and correct, not a coverage gap. Phase 31 and Phase 32 both depend only on Phase 30 (need seeded `buyer_role`/`offering` data); Phase 32 does not strictly depend on Phase 31 (different UI surfaces) but stays sequential in the roadmap per the "Signals first" priority.
- **Roadmap (v1.4): sourced from a fully pre-authored external spec** (`.planning/specs/v1.4-signals-offerings.md`) — data model, business rules, UI, seed data, and sequencing were already decided before this cycle; research was skipped for this milestone (see REQUIREMENTS.md header).
- [Phase ?]: v1.4 started before v1.3 closed; v1.3 Phase 18 (VER-04) left unexecuted, phase dirs 15-18 cleared from disk (not archived) to make room for v1.4 numbering — recoverable via git history since `commit_docs: true`.

### Pending Todos

None yet — Phase 30 not yet planned.

### Blockers/Concerns

- **v1.3 Phase 18/VER-04 remains open** (Vercel preview + `/settings` render + `exec|spawn|child_process` grep gate) — carried in PROJECT.md Active, not part of v1.4's roadmap, but not yet closed either.
- **No numeric pricing field on `offering`** — `commercial_model_text` (free text, mechanism only) per spec Section 8; do not invent/infer a price figure from seed data during Phase 30 seeding.
- **GBS/Technology offering-name boundary is unresolved** — "Automation & AI Portfolio Governance & Benefit Realisation" exists in both catalogues with overlapping meaning; v1.4 seeds it once under GBS only. Resolve the boundary before any future practice-area seeding (OFR-SEED-01, deferred).
- **Category taxonomy is free text, not an enum** — do not hardcode the 8 GBS company-signal categories or 5 persona-signal categories as a fixed enum in Phase 30's schema; other practice areas will need different categories (spec Section 8).
- Carried from v1.1/v1.2/v1.3: persona-side Arcpedia content gap (seed data); 3 VERIFICATION.md files still `human_needed`; "any authenticated Clerk user = staff" model has no role system (acceptable per PROJECT.md scope).

## Deferred Items

Items acknowledged and carried forward, still open:

| Category | Item | Status |
|----------|------|--------|
| uat_gap | Persona-side "Related Knowledge" (Arcpedia) end-to-end with real matches | pending — code path proven identical to Company, seed data lacks a matching name |
| uat_gap | 01-HUMAN-UAT.md | partial — 2 pending scenarios |
| uat_gap | 02-HUMAN-UAT.md | partial — 4 pending scenarios |
| uat_gap | 04-HUMAN-UAT.md | partial — 1 pending scenario (Persona-side Arcpedia content gap) |
| verification_gap | 01/02/03/04-VERIFICATION.md | human_needed |
| verification_gap | v1.3 Phase 18 VER-04 (Vercel preview + grep gate) | unexecuted, left open when v1.4 started |
| future_requirement | HYP-01 Hypotheses feature | deferred past v1.4 (spec Section 1) |
| future_requirement | SIG-CAT-01 promote signal category to lookup table | deferred until a 2nd practice area is seeded (spec Section 8) |
| future_requirement | SIG-CO-01 dual-persona co-occurrence scoring | deferred to Hypotheses milestone (spec Section 8) |
| future_requirement | OFR-PRICE-01 numeric pricing fields | deferred pending firm confirmation (spec Section 8) |
| future_requirement | OFR-SEED-01 seed remaining 5 practice areas | blocked on GBS/Technology naming-boundary resolution (spec Section 8) |

## Session Continuity

Last session: 2026-08-04T10:34:22.068Z
Stopped at: v1.4 ROADMAP.md + STATE.md created, REQUIREMENTS.md traceability confirmed
Resume file: None

## Operator Next Steps

- Plan Phase 30 with `/gsd-plan-phase 30` (Shared Data Model + Seed — no UI, first phase of v1.4)
