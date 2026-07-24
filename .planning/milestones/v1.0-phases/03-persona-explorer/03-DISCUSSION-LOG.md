# Phase 3: Persona Explorer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-23
**Phase:** 3-Persona Explorer
**Areas discussed:** Persona schema — seniority & contact, Career history display, Persona list — search & filters, Seed data expansion

---

## Persona schema — seniority & contact

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed enum | pgEnum like signal_type/revenue_band, filterable | ✓ |
| Free text | Plain text column, more flexible but not cleanly filterable | |

**User's choice:** Fixed enum (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Optional, nullable | Matches rest of schema's nullable pattern | ✓ |
| Required | Every persona must have at least email or LinkedIn | |

**User's choice:** Optional, nullable (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Full profile URL | Store as-is, render as external link | ✓ |
| Handle/slug only | Requires constructing full URL at render time | |

**User's choice:** Full profile URL (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| IC / Manager / Director / VP / C-Level | Standard 5-tier ladder, matches GBS/SSC buyer-persona language | ✓ |
| Junior / Mid / Senior / Executive | Simpler 4-tier, less precise for VP vs C-Level distinction | |
| You decide | Claude proposes values during planning/research | |

**User's choice:** IC / Manager / Director / VP / C-Level (recommended)

---

## Career history display

| Option | Description | Selected |
|--------|-------------|----------|
| Current highlighted + history list | Mirrors Company detail's section-per-concern layout | ✓ |
| Single chronological list | Simpler, no explicit current/past split | |
| Timeline visual | More polished, needs new component | |

**User's choice:** Current highlighted + history list (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Leave Company detail as-is | Already shows persona name + current role title, sufficient | ✓ |
| Enhance with date ranges | Small scope addition for symmetry | |

**User's choice:** Leave Company detail as-is

---

## Persona list — search & filters

| Option | Description | Selected |
|--------|-------------|----------|
| Name + title + current company name | Matches EXPL-01's exact wording, needs EXISTS join | ✓ |
| Persona name + title only | Simpler query, doesn't satisfy EXPL-01's "or company" clause | |

**User's choice:** Name + title + current company name (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Seniority | Direct enum Select, same pattern as Company filters | ✓ |
| Current company | Select of distinct current-company names | ✓ |
| Has signals (via current company) | Filters personas whose company has a buying signal | ✓ |

**User's choice:** All three (multiSelect) — Seniority, Current company, Has signals via current company

---

## Seed data expansion

| Option | Description | Selected |
|--------|-------------|----------|
| Most personas 1 current role; a few with 1-2 past roles | Mirrors Phase 2's D-12 variety-without-overbuilding approach | ✓ |
| Every persona gets 2-3 historical roles | More thorough but significantly more seed rows | |

**User's choice:** Most personas 1 current role; a few with 1-2 past roles too (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Keep ~10, add new fields to existing rows | Backfill seniority/email/LinkedIn onto existing personas | ✓ |
| Grow to ~15-20 personas | More volume but exceeds Phase 2's established baseline | |

**User's choice:** Keep ~10, add new fields to existing rows (recommended)

---

## Claude's Discretion

- Exact route naming (`/personas`) and converting `AppSidebar` to a pathname-aware Client Component now that two nav sections have real routes
- Exact seniority-to-title mapping and history-row distribution across the 10 existing seed personas
- Email format validation depth — default to a light zod check consistent with the existing seed validation pipeline

## Deferred Ideas

None — discussion stayed within phase scope.
