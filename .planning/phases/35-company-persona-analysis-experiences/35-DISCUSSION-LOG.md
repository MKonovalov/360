# Phase 35: Company & Persona Analysis Experiences - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-08
**Phase:** 35-company-persona-analysis-experiences
**Areas discussed:** Preview-before-launch flow, Run history display, Result/review card reuse, Confirmed candidates placement

---

## Scope Check (interjected before Preview-before-launch could be locked)

The first answer for "How should staff see the preview" described an EXA-style
dynamic agent constructor/playground (`/agents` section, configurable output
schemas) — significantly beyond locked v1.7 scope (CON-01: exactly 2 fixed
templates). This was flagged and a scope-check question was asked before
proceeding.

| Option | Description | Selected |
|--------|-------------|----------|
| Stay in locked scope for Phase 35 | Preview shows instruction/checklist/effort for the 2 existing templates; EXA-style builder noted as deferred idea | ✓ |
| This changes what v1.7 should be — stop and re-scope | Bigger conversation affecting Phase 36 and the whole v1.7 roadmap | |

**User's choice:** Stay in locked scope for Phase 35
**Notes:** EXA-style agent constructor captured as a Deferred Idea for a future milestone discussion.

---

## Preview-before-launch flow

### Entry point

| Option | Description | Selected |
|--------|-------------|----------|
| Menu > Analyze opens a modal dialog | Reuses existing Menu + Dialog pattern (like EnrichMenu) | ✓ |
| Menu > Analyze opens a dedicated page/route | Full-page experience, leaves record context | |
| Inline expand within detail page | No modal/page, expands within the page itself | |

**User's choice:** Menu > Analyze opens a modal dialog

### Preview content

| Option | Description | Selected |
|--------|-------------|----------|
| Full detail | Resolved instruction, Practice Area, full checklist, effort — matches UX-01 literally | ✓ |
| Condensed summary | Counts/labels only with expand toggle | |

**User's choice:** Full detail

### Start gating

| Option | Description | Selected |
|--------|-------------|----------|
| Enabled as soon as preview renders | Low-friction, matches existing AnalysisRunLauncher pattern | ✓ |
| Require explicit scroll/expand first | More friction, guarantees staff saw the checklist | |

**User's choice:** Enabled as soon as preview renders

---

## Run history display

### Section style

| Option | Description | Selected |
|--------|-------------|----------|
| New 'Analysis' section, most-recent-first list | Matches existing stacked-section pattern | ✓ |
| Collapsed by default, count badge only | Keeps page short for records with no runs | |
| Separate tab/sub-page | Bigger structural change (no tabs exist today) | |

**User's choice:** New 'Analysis' section, most-recent-first list

### History limit

| Option | Description | Selected |
|--------|-------------|----------|
| Show all, no pagination | Run volume stays low given duplicate-run prevention + review cost | ✓ |
| Cap at N most recent with 'show more' | Defensive pagination for high-volume records | |

**User's choice:** Show all, no pagination

### Live status

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-poll while non-terminal | Reuses AnalysisRunStatus polling pattern | ✓ |
| Manual reload only | Simpler, no polling infra needed | |

**User's choice:** Auto-poll while non-terminal

---

## Result/review card reuse

### Card component

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse RunReviewCard with read-only mode prop | Single source of truth, no visual drift from /reviews | ✓ |
| Build a separate lighter result-summary component | Duplicates rendering logic, could be simpler | |

**User's choice:** Reuse RunReviewCard with a read-only mode prop

### Cross-link to /reviews

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, link to /reviews for pending_review runs | Decision stays exclusively in /reviews per Phase 34 design | ✓ |
| No cross-link needed | Record page purely informational | |

**User's choice:** Yes, link to /reviews for pending_review runs

---

## Confirmed candidates placement

### Section placement

| Option | Description | Selected |
|--------|-------------|----------|
| Right after Buying Signals | Groups related/validated evidence concepts together | ✓ |
| New top-level section near Analysis history | Groups all v1.7-analysis content together instead | |

**User's choice:** Right after Buying Signals

### Row detail

| Option | Description | Selected |
|--------|-------------|----------|
| Offering name + evidence summary + source links | Matches D-34-04 provenance requirement | ✓ |
| Offering name only, click to expand | More compact by default | |

**User's choice:** Offering name + evidence summary + source links

---

## Claude's Discretion

- Exact query-layer implementation for subject-scoped run listing and
  subject-scoped confirmed candidates (both currently global/unscoped queries)
- Exact modal component structure/naming for the new preview-enabled Analyze dialog
- Loading/empty states for Analysis section and Confirmed Candidates section

## Deferred Ideas

- **EXA-style dynamic agent constructor / `/agents` playground** — user's
  original vision for a configurable multi-agent builder UX, referenced from
  dashboard.exa.ai/playground/agent. Significantly beyond locked v1.7 scope
  (2 fixed templates only). Needs its own dedicated roadmap discussion if
  pursued — not decided as part of Phase 35.
