---
phase: 22-verification-gate
reviewed: 2026-08-03T19:36:00Z
fix_applied: 2026-08-03T19:40:00Z
depth: standard
scope: critical_warning
findings_fixed:
  critical: 0
  warning: 3
  info: 0
  total: 3
status: fixed
---

# Phase 22: Code Review Fix Report

**Applied:** 2026-08-03T19:40:00Z
**Scope:** critical + warning (Info items IN-01/IN-02/SE-03/SE-04 intentionally left for a later pass)
**Status:** fixed

## Fixes Applied

### WR-01: seed.ts destructive re-seed is not atomic — FIXED

**Files:** `src/scripts/seed.ts`

The full delete+insert sequence (all 7 `db.delete(...)` calls plus the
company/persona/signal/role row-by-row insert loops and name→id maps) now runs
inside a single `await db.transaction(async (tx) => { ... })`. A mid-run failure
(constraint violation, transient connection loss, malformed CSV row) rolls the
entire sequence back instead of leaving all seven tables empty — including the
runtime audit tables `agent_run`, `signal_proposal`, `correction`.

To bring the signal and role inserts onto the transaction client, their query-layer
wrappers (`insertSignal`/`insertCompanyPersonaRole`, which bind the module-level
`db`) were inlined as `tx.insert(...)` calls inside the transaction, preserving the
exact value mappings and FK order. The shared query modules were not modified.

### WR-02: E2E_CLERK_USER_EMAIL undeclared + non-null assertion — FIXED

**Files:** `.env.example`, `e2e/auth.setup.ts`

- `.env.example`: added `E2E_CLERK_USER_EMAIL=` (empty placeholder) after the Clerk
  block with a note that the real test-account email belongs only in `.env.local`
  and must never be committed.
- `e2e/auth.setup.ts`: replaced `process.env.E2E_CLERK_USER_EMAIL!` with the
  validate-and-throw guard matching `scripts/probe-openrouter-only.ts:41-46` — a
  missing var now fails with a descriptive "provision the test staff account per
  plan 22-03 Task 3" message instead of an obscure Clerk SDK error.

Note: the E2E suite does not use an `E2E_CLERK_PASSWORD` var — `clerk.signIn`
(Testing Library) emails a one-time code; email-only is the correct contract.

### WR-03: VER-05 SET-06 pins live catalog row count to `336` — FIXED

**Files:** `e2e/ver-05-settings.spec.ts`

Replaced both `toHaveCount(336)` literals with a derived constant:

```ts
const EXPECTED_UNION_OPTION_COUNT = getUnionServableIds(catalogJson).length - 1;
```

Derivation verified: `getUnionServableIds(catalogJson).length` = 337 →
`EXPECTED_UNION_OPTION_COUNT` = 336, exactly matching the prior literal. The
assertion now tracks the committed catalog snapshot, so an `npm run models:fetch`
refresh or OpenRouter catalog drift cannot break the "permanent gate" without an
accompanying snapshot commit. Comments updated to describe the derived invariant
instead of quoting the magic numbers.

## Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npx vitest run src/lib/agents/modelConfig.test.ts` | 23 passed |
| `npx vitest run src/lib/verification/security-grep.test.ts` | 5 passed |
| `npx vitest run src/lib/models/catalog.test.ts` | 23 passed |
| Derived count (tsx) | union 337 → expected 336 (matches prior literal) |

## Not Fixed (deferred by scope)

- **IN-01** fallback-removal while-loops (ver-02/ver-05) — cosmetic, not a live failure
- **IN-02** stale "no tsconfig-path alias" comment in ver-02 — the DB layer itself
  relies on `@/` alias resolution, comment premise factually wrong
- **SE-03** security-grep gate scope excludes `scripts/` — high-value strengthening
- **SE-04** probe-openrouter-only.ts missing `CLERK_SECRET_KEY` pre-validation + no
  DB-environment guard

---

_Applied: 2026-08-03T19:40:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Fixer: Claude (gsd-code-fixer)_
_Scope: critical_warning_
