---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Exa-Style Left Panel
status: verifying
last_updated: "2026-08-01T14:09:38.214Z"
last_activity: 2026-08-01
progress:
  total_phases: 5
  completed_phases: 1
  total_plans: 2
  completed_plans: 2
  percent: 20
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-01)

**Core value:** Fast, shared ICP lookup — anyone on the team can pull up a company or persona and see a complete, trustworthy 360 view with buying signals in seconds.
**Current focus:** Phase 10 — sidebar-token-foundation

## Current Position

Phase: 10 (sidebar-token-foundation) — EXECUTING
Plan: 2 of 2
Status: Phase complete — ready for verification
Last activity: 2026-08-01

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**

- Total plans implemented: 27 (v1.1) + 14 (v1.0) = 41
- Average duration: - min
- Total execution time: 0 hours (v1.2 not started)

**By Phase (v1.1):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 05 | 3 | - | - |
| 06 | 4 | - | - |
| 07 | 11 | - | - |
| 08 | 6 | - | - |
| 09 | 3 | - | - |

**Recent Trend:**

- Last 5 plans (v1.1): Phase 09 P1 (80m), P02 (11min), P03 (10h16m)
- Trend: N/A (new milestone)

*Updated after each plan completion*
| Phase 10-sidebar-token-foundation P10-01 | 5 | 2 tasks | 1 files |
| Phase 10 P02 | 2 | - tasks | - files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- **Roadmap (v1.2): Light panel confirmed — match dashboard.exa.ai reference.** The dark near-black sidebar idea was dropped by user decision 2026-08-01; research verified the live reference sidebar is light `#fbfcfd` + 0.5px hairline. Token mechanism identical either way.
- **Roadmap (v1.2): Mechanism locked — one scoped `--sidebar-*` token block on `[data-sidebar="sidebar"]` in `src/app/globals.css`.** Zero new npm packages, zero edits to vendored `src/components/ui/sidebar.tsx`, `@theme inline` is load-bearing and must not be converted. File touchpoints: `globals.css` (token block), `app-sidebar.tsx` (delete 4× indigo data-active overrides, amber badge, SidebarGroups, logo/user zones, feedback pill, collapse button), `sidebar-resize-handle.tsx` (cosmetic hover). Everything else untouched.
- **Roadmap (v1.2): Phase split follows research Recommendation #4** — A) token foundation + `getActiveNavKey` extraction/tests → B) consumer restyle (nav items, then brand/user zones) → C) collapse & edge surfaces → D) contrast audit + live-browser UAT matrix. 5 phases (10-14), sequential numbering continues from v1.1's Phase 9.
- **Roadmap (v1.2): Phase 0-style decisions deferred to Phase 10's UI-SPEC step** — logo treatment (wordmark vs. letter-mark, collapsed form), feedback destination (mailto vs. Arcpedia link), collapse target width, portal policy (light-over-light now largely moot). Not resolved at roadmap time by design.
- **Roadmap (v1.2): Requirement count is 19, not 17** — PANE-01..04, NAV-01..04, BRND-01..04, COLR-01..03, QLTY-01..04. All 19 mapped 100%, no orphans.
- **Roadmap (v1.2): Hard constraints preserved** — routes unchanged (Start, Companies, Key Personas, Reviews), drag-resize 200-400px + `sidebar_width` cookie, ⌘B + `sidebar_state` cookie, server-driven `pendingCount` badge gating.
- [Phase 10]: Nav key is the ROUTE segment 'personas' (route /personas), never the label 'Key Personas' — enforced by grep gate (count 0) and the 11-case test assertions (QLTY-01, RESEARCH Pitfall 4).
- [Phase 10]: Function-first task order (not TDD RED): next build type-checks test files, so a RED nav.test.ts would spuriously fail the parallel 10-01 build gate — both Wave-1 plans never expose a red tree.

### Pending Todos

None yet.

### Blockers/Concerns

- **Open UI-SPEC decisions (Phase 10 gate):** logo treatment (no ArcLumen logo asset exists — wordmark/letter-mark + collapsed form), feedback-pill destination (team inbox mailto / Arcpedia link), collapse target width, portal policy for the sidebar user menu. All gated into Phase 10's UI-SPEC step; do not re-litigate at roadmap level.
- **Research risk is decision, not discovery** — the design language is fully specified from primary evidence (live dashboard.exa.ai CSS). `/gsd-ui-phase` should lock palette + portal decision before Phase 11 (consumer restyle).
- **Contrast trap (research Pitfall 3):** Exa's own ~1.05:1 active pill fails WCAG 1.4.11 — do NOT copy that tradeoff for a daily-use internal tool. Phase 10 sets AA-compliant tokens (≥3:1 pill/ring, ≥4.5:1 text), Phase 14 audits.
- **Regression blindness (research Pitfall 7):** zero component tests — `getActiveNavKey` extraction (QLTY-01) is the mandated regression lock for `/companies/[id]` highlighting; replicate the v1.1 Phase-5 live-browser UAT matrix in Phase 14.
- Carried from v1.1: "any authenticated Clerk user = full access" model has no role system; acceptable per PROJECT.md scope, re-examine before any external/CRM access milestone.

## Deferred Items

Items acknowledged and deferred at v1.1 milestone close on 2026-08-01, still open:

| Category | Item | Status |
|----------|------|--------|
| uat_gap | Persona-side "Related Knowledge" (Arcpedia) end-to-end with real matches | pending — code path proven identical to Company, seed data lacks a matching name |
| uat_gap | 01-HUMAN-UAT.md | partial — 2 pending scenarios |
| uat_gap | 02-HUMAN-UAT.md | partial — 4 pending scenarios |
| uat_gap | 04-HUMAN-UAT.md | partial — 1 pending scenario (Persona-side Arcpedia content gap) |
| verification_gap | 01-VERIFICATION.md | human_needed |
| verification_gap | 02-VERIFICATION.md | human_needed |
| verification_gap | 03-VERIFICATION.md | human_needed (03-HUMAN-UAT.md itself is status: complete — likely stale) |
| verification_gap | 04-VERIFICATION.md | human_needed |

## Session Continuity

Last session: 2026-08-01T14:09:38.209Z
Stopped at: Completed 10-02-PLAN.md
Resume file: None

## Operator Next Steps

- Roadmap approved 2026-08-01 (commit 048897ed). Run `/gsd-plan-phase 10` — Phase 10's plan-phase includes the UI-SPEC step (via `/gsd-ui-phase`) that locks logo treatment, feedback destination, collapse target width, and portal policy.
