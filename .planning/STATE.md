---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Exa-Style Left Panel
status: verifying
last_updated: "2026-08-01T19:38:58.051Z"
last_activity: 2026-08-01
progress:
  total_phases: 5
  completed_phases: 4
  total_plans: 8
  completed_plans: 8
  percent: 80
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-01)

**Core value:** Fast, shared ICP lookup — anyone on the team can pull up a company or persona and see a complete, trustworthy 360 view with buying signals in seconds.
**Current focus:** Phase 13 — collapse & resize coexistence

## Current Position

Phase: 13
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
| 10 | 2 | - | - |

**Recent Trend:**

- Last 5 plans (v1.1): Phase 09 P1 (80m), P02 (11min), P03 (10h16m)
- Trend: N/A (new milestone)

*Updated after each plan completion*
| Phase 10-sidebar-token-foundation P10-01 | 5 | 2 tasks | 1 files |
| Phase 10 P02 | 2 | - tasks | - files |
| Phase 11-nav-items-restyle P02 | 2min | 2 tasks | 1 files |
| Phase 12-branding-user-zones P01 | 5 min | 3 tasks | 3 files |
| Phase 12-branding-user-zones P02 | 2min | 2 tasks | 0 files |
| Phase 13-collapse-resize-coexistence P01 | 5 min | 3 tasks | 4 files |
| Phase 13-collapse-resize-coexistence P02 | 2min | 2 tasks | 0 files |

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
- [Phase 11-nav-items-restyle]: Resize-handle hover uses the GLOBAL foreground token at 10% opacity, not --sidebar-accent — the handle is a flex sibling of <Sidebar> outside the [data-sidebar="sidebar"] subtree, so scoped sidebar tokens resolve to their :root oklch fallbacks (near-white, invisible hover); only global tokens resolve there (QLTY-04). — SC #5 border-r half verified, not re-implemented — globals.css:100-103 companion rule confirmed in place (grep=1); sidebar.tsx:236 border-r carries no color class (grep=0); fence-clean gate asserts byte-identical (QLTY-04).
- [Phase 12-branding-user-zones]: Followed the plan's structural UserDisplayFields interface in src/lib/user.ts — @clerk/types is not directly resolvable (verified) so the param is a local structural slice, matching companyFilters.ts precedent
- [Phase 12-branding-user-zones]: Used SignOutButton redirectUrl="/sign-in" (primary sanctioned form) — the redirectUrl[=:].*sign-in gate = 1; no useClerk fallback needed
- [Phase 12-branding-user-zones]: Kept standard multi-line JSX formatting for SidebarFooter (open/close tags on separate lines), making its grep count 3 (import + open + close) not the plan's expected 2 — plan arithmetic discrepancy, no acceptance criterion asserts it
- [Phase 12-branding-user-zones]: Substituted --bail=1 for the plan's -x flag in vitest commands — Vitest 4 removed the -x alias (unknown option error); --bail=1 is the functional equivalent (stop on first failure)
- [Phase 12-branding-user-zones]: PHASE_BASE_SHA resolved to d8795a11 (the commit immediately before 12-01 Task 1's first source commit 07d455d6), not the plan text's stale a79cd5ac reference — verified via git log; d8795a11 is the parent of the first Phase-12 source commit — Verified via git log: first Phase-12 source commit is 07d455d6 (feat 12-01), parent d8795a11; base-vs-HEAD range proves phase scope
- [Phase 12-branding-user-zones]: Substituted --bail=1 for the plan's -x flag in vitest commands (Vitest 4 removed the -x alias — same substitution 12-01 documented); --bail=1 is the functional equivalent (stop on first failure) — Vitest 4.1.10 removed the -x alias; --bail=1 is the functional equivalent (stop on first failure)
- [Phase 13]: Collapse button drives the ONE shared useSidebar().toggleSidebar state - same toggle as cmd-B and the topbar trigger; the sidebar_state cookie write stays inside the vendored setOpen, byte-identical (D-06) — One state machine shared by all three collapse entry points (button, cmd-B, topbar); zero new cookie/state code per COLR-02.
- [Phase 13]: D-08 tooltip copy extracted to tested pure helpers (sidebar-collapse.ts) rather than inlined - drive-by wording edits can never silently break the 10-UI-SPEC Copywriting Contract — nav.ts/user.ts pure-function + Vitest lock precedent; the phase-family convention (RESEARCH Q2 extraction path).
- [Phase 13]: Resize handle early return placed AFTER all hooks (3 refs + 3 callbacks) so hook count never varies between expanded/collapsed renders - no Rendered fewer hooks on toggle — D-04/D-05: the imperative width write can never run mid-collapse, keeping the cookie-threaded var at its last persisted value for automatic restore.
- [Phase 13-collapse-resize-coexistence]: Phase 13 verified end-to-end: sweep + fence + diff-scope + full regression battery all green on 13-01's committed state — the verification-only Wave-2 plan required zero production changes (COLR-01..03 regression proof)
- [Phase 13-collapse-resize-coexistence]: PHASE_BASE_SHA = 8b9d6e42 (docs(13) plan-approval commit, parent of first feat(13-01) 933c7f58) reused for all base-vs-HEAD ranges in 13-02

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

Last session: 2026-08-01T19:38:58.045Z
Stopped at: Completed 13-02-PLAN.md
Resume file: None

## Operator Next Steps

- Phase 13 (Collapse & Resize Coexistence) planned and verified 2026-08-01 (commits 8e58b5bb..79a2fa57): CONTEXT (D-01..D-12) + RESEARCH + VALIDATION + PATTERNS + 2 PLANs approved (13-01 Wave 1: activate `collapsible="icon"`, collapse button + letter-mark + rail tooltips + resize-handle hide; 13-02 Wave 2: sweep/fence/regression). Plan-checker passed after one revision loop (1 blocker — Task 3 grep-gate arithmetic — + 5 warnings fixed; advisory doc drifts aligned). Run `/gsd-execute-phase 13` — the phase activates the Phase 11-12 pre-wired dormant collapsed-rail classes via the vendored `collapsible="icon"` switch, adds the always-visible collapse button (D-01/02/03), the D1 letter-mark, ~200ms rail tooltips (TooltipProvider mount), and hides the drag handle when collapsed — all without breaking the frozen 200-400px clamp / `sidebar_width` / ⌘B / `sidebar_state` contract.
