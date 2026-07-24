# Phase 1: Foundation — Platform Migration & Data Model - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-22
**Phase:** 1-Foundation — Platform Migration & Data Model
**Areas discussed:** Seed data, Signal taxonomy detail, Staff-access check strictness, Old short-link tool fate

---

## Seed data

| Option | Description | Selected |
|--------|-------------|----------|
| You provide it | You hand over a list of real target companies+personas | ✓ |
| Claude fabricates realistic placeholders | Generic but realistic-looking GBS/SSC companies/personas | |
| Minimal (2-3 records) | Just enough to prove list+detail rendering works | |

**User's choice:** You provide it
**Notes:** Volume target: small (5-15 companies). Timing: during Phase 1 execution, after schema/migration scripts exist. Format: spreadsheet/CSV.

| Option | Description | Selected |
|--------|-------------|----------|
| Small (5-15 companies) | Enough to exercise search/filter meaningfully | ✓ |
| Minimal (2-5 companies) | Just enough to prove the shell renders | |
| You decide | Claude picks a reasonable number | |

| Option | Description | Selected |
|--------|-------------|----------|
| Before Phase 1 execution starts | Ready by the time planning runs | |
| During Phase 1 execution | Schema first, real data dropped in once migration scripts exist | ✓ |
| Not sure yet | Placeholder seed for now | |

| Option | Description | Selected |
|--------|-------------|----------|
| Spreadsheet/CSV | Easiest to fill in manually, maps to Company/Persona/Signal columns | ✓ |
| Plain text/notes | Free-form list, structured afterward | |
| You decide | Claude proposes a format later | |

---

## Signal taxonomy detail

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — simple 3-tier | Low/Medium/High strength dimension | ✓ |
| No — presence is enough | No strength dimension in v1 | |
| You decide | Claude picks | |

**User's choice:** Yes — simple 3-tier strength/confidence level

| Option | Description | Selected |
|--------|-------------|----------|
| Yes | Free-text note field alongside structured type | ✓ |
| No | Fully structured, source field alone is enough | |

**User's choice:** Yes — free-text note field

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed enum, but extensible | Postgres enum/lookup table seeded with the 4 known types | ✓ |
| Free-form type string | No enum constraint | |

**User's choice:** Fixed enum, but extensible

---

## Staff-access check strictness

| Option | Description | Selected |
|--------|-------------|----------|
| Any signed-in Clerk user | Matches current model and PROJECT.md's no-roles v1 scope | ✓ |
| Add email-domain check | Require @arclumenpartners.com as defense-in-depth | |

**User's choice:** Any signed-in Clerk user
**Notes:** The value in Phase 1 is centralizing the check into one function, not tightening who passes it.

---

## Old short-link tool fate

| Option | Description | Selected |
|--------|-------------|----------|
| Delete it | Remove Astro pages/routes and Sanity client entirely | ✓ |
| Leave dormant, remove later | Old routes stay untouched until a separate cleanup pass | |

**User's choice:** Delete it

| Option | Description | Selected |
|--------|-------------|----------|
| Not my concern right now | Out of scope for this phase | |
| It should stop working gracefully | Should fail safely, not 500 | |
| *(free text)* | go.arclumenpartners.com redirector is not pointing at 360 anymore | ✓ |

**User's choice:** Free text — the `go.` redirector has already been repointed away from this app, so no compatibility behavior is needed.

---

## Claude's Discretion

- Exact CSV column layout for the seed data handoff.
- Package manager cleanup (standardize on npm, drop the stale `packageManager: yarn` field).

## Deferred Ideas

None — discussion stayed within phase scope.
