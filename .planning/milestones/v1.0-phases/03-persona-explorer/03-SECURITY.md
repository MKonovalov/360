---
phase: 03
slug: persona-explorer
status: audited
threats_open: 0
asvs_level: 1
created: 2026-07-23
---

# Phase 03 — Persona Explorer — Security Audit

**Audit type:** From-scratch (State B — no prior SECURITY.md for this phase)
**Plans covered:** 03-01, 03-02, 03-03, 03-04 (all `register_authored_at_plan_time: true`)
**ASVS Level:** 1
**Block on:** high
**Scope:** Verification of declared threat mitigations only — no new-threat scan performed, per phase config.

## Threat Verification

| Threat ID | Category | Component | Disposition | Status | Evidence |
|-----------|----------|-----------|-------------|--------|----------|
| T-3-01 | Tampering | `listPersonas(filters)` WHERE composition incl. two-hop `hasSignals` EXISTS | mitigate | **CLOSED** | `src/lib/db/queries/personas.ts:1,23-91` — imports only `and, eq, ilike, exists, not, or, sql` from `drizzle-orm`; every filter leg (search, seniority, currentCompany, hasSignals) built with `eq()`/`ilike()`/`exists()`/`innerJoin()`. `sql` is imported but used only as `sql\`1\`` (a literal, not interpolated user input) inside `.select({ one: sql\`1\` })`. No `sql.raw()` anywhere in the file. |
| T-3-02 | Tampering | New CSV columns (`seniority`, `email`, `linkedin_url`) | mitigate | **CLOSED** | `src/lib/validation/seed.ts:72-88,102-108` — `optionalSeniority` pipes into `seniorityEnum.enumValues`; `optionalEmailString` applies the `startsWithDangerousPrefix` formula-injection refine (same guard as `optionalSafeCsvString`) then pipes into Zod v4 `z.email()`; `linkedin_url: optionalSafeCsvString` reuses the existing guard. `personaRowSchema` wires all three. |
| T-3-03 | Information Disclosure | `linkedinUrl` rendered as raw `<a href>` (data-origin control, scoped to Plan 01) | mitigate | **CLOSED** | Confirmed the only write path in this phase is the CSV seed pipeline: `src/scripts/seed.ts:119` (`linkedinUrl: row.linkedin_url`) sources from `src/lib/validation/seed.ts`'s `optionalSafeCsvString`-validated `linkedin_url` field — no other insert/update path for `persona.linkedinUrl` exists in the codebase. |
| T-3-SC | Tampering | npm/pip/cargo installs (declared identically in all 4 plans) | accept | **CLOSED** | `git log --oneline -- package.json` shows the file was last touched by Phase 2 commit `a08a811d`; zero commits touch `package.json`/`package-lock.json` across the full Phase 3 range (`03-01` through `03-04`). No new dependencies installed. |
| T-3-04 | Elevation of Privilege | `/personas` route (`layout.tsx` + `page.tsx`) | mitigate | **CLOSED** | `src/app/personas/layout.tsx:16` and `src/app/personas/page.tsx:16` both call `await requireStaffAccess()` as their first statement. |
| T-3-05 | Tampering | `searchParams` → `PersonaFilters` → `listPersonas`, incl. two-hop `hasSignals` EXISTS | mitigate | **CLOSED** | Client-side: `src/components/personas/persona-filters.tsx` uses `parseAsStringEnum` (nuqs) constrained to schema `enumValues`/known company names/`['true','false']`. Server-side: `listPersonas` (T-3-01) never interpolates raw filter strings into SQL — parameterized operators only. |
| T-3-06 | Tampering / Information Disclosure | `AppSidebar` Server→Client conversion changing `/companies` active-state | mitigate | **CLOSED** | `src/components/layout/app-sidebar.tsx:30,39` — both `isActive={pathname.startsWith('/companies')}` and `isActive={pathname.startsWith('/personas')}` use `.startsWith()`, not exact equality. |
| T-3-07 | Elevation of Privilege | `/personas/[id]` route | mitigate | **CLOSED** | `src/app/personas/[id]/page.tsx:21` — `await requireStaffAccess()` is the first statement in `PersonaDetailPage`, in addition to the layout-level gate. |
| T-3-08 | Tampering | `id` route param → `getPersonaById` | mitigate | **CLOSED** | `src/app/personas/[id]/page.tsx:27-30` — `Number(id)` followed by `notFound()` on `Number.isNaN(personaId)` before any DB call; `getPersonaById` (`src/lib/db/queries/personas.ts:104-107`) uses parameterized `eq(persona.id, id)`. See Note below re: WR-03 non-blocking gap. |
| T-3-09 | Tampering / Information Disclosure | `linkedinUrl` rendered as raw `<a href>` — `javascript:` URI risk | accept | **CLOSED** | Accepted-risk rationale (no user-facing write path this phase, only the CSV pipeline validated under T-3-02/T-3-03) is recorded in `03-03-PLAN.md`'s threat model and reproduced in this log. Re-evaluate when a write UI ships. |
| T-3-10 | Information Disclosure | Sequential integer persona IDs exposed via `/personas/{id}` | accept | **CLOSED** | Same accepted-risk determination as Phase 2's `/companies/[id]` (FOUND-04: any authenticated Clerk user has full access, no per-record ACL model in Milestone 1). Recorded in `03-03-PLAN.md`'s threat model and reproduced in this log. |
| T-03-10 | Tampering | `parsePersonaFilters` (`src/lib/params/personaFilters.ts`) | mitigate | **CLOSED** | `src/lib/params/personaFilters.ts:19,25` — `hasSignalsRaw` compared with strict `===` against literal `'true'`/`'false'` only; any other value (tampered or malformed) falls through to `undefined`, never reaches `listPersonas` as anything but one of three known-safe states. |
| T-03-11 | Information Disclosure | `listPersonas` `hasSignals` NOT EXISTS branch (new in Plan 04) | accept | **CLOSED** | Accepted-risk rationale (the new `false` branch can only narrow, never widen, the result set relative to no-filter — no new privilege boundary since an authenticated staff user already has full-list access) recorded in `03-04-PLAN.md`'s threat model and reproduced in this log. |

**Totals: 13/13 threats closed (10 mitigate — all verified present in code; 3 accept — all have a recorded, reproduced rationale).**

## Accepted Risks Log

The following threats carry an `accept` disposition. Each is reproduced here as the durable accepted-risk record for this phase (previously only living in PLAN.md threat-model blocks):

1. **T-3-SC** (all 4 plans) — No new npm/pip/cargo packages installed this phase. Verified via `git log` showing zero `package.json` changes across Phase 3.
2. **T-3-09** — `linkedinUrl` is rendered as a raw `<a href>` with no sanitization/scheme allowlist at render time (`src/components/personas/persona-detail.tsx:132`). Accepted because the only write path this phase is the CSV seed pipeline, which validates every value through `optionalSafeCsvString`'s formula-injection guard before insert (blocks `=`, `+`, `-`, `@`, tab, CR — but notably does **not** block a `javascript:` prefix specifically). No user-facing write form exists yet. **Re-evaluate when a write UI ships** — at that point, either add an explicit `http(s):`/`mailto:` scheme allowlist to the persisted value or sanitize at render time, since the current guard is formula-injection-shaped, not URI-scheme-shaped.
3. **T-3-10** — Sequential integer persona IDs are enumerable via `/personas/{id}`. Accepted under the same Milestone 1 model as `/companies/[id]`: any authenticated Clerk user has full read access to all ICP data (FOUND-04), so ID enumeration discloses nothing beyond what the UI already grants. Re-evaluate if/when per-user or per-team scoping is introduced.
4. **T-03-11** — The new `hasSignals: false` NOT EXISTS branch only narrows results relative to no filter; accepted as introducing no new privilege boundary.

## Non-Blocking Observation (not a threat-model gap)

- **T-3-08 / WR-03 carry-forward:** `Number(id)` + `Number.isNaN` guard (`src/app/personas/[id]/page.tsx:27-30`, mirrors `/companies/[id]`) passes non-integer numeric strings through, e.g. `Number("1.5")` → `1.5`, `Number.isNaN(1.5) === false`; same for `Infinity`. This was already flagged as WR-03 (non-blocking, code-quality) in `03-REVIEW.md` — reproduced here because it touches the same threat surface as T-3-08. Reaches `getPersonaById`'s parameterized `eq()` either way, so **no injection risk** — worst case is a wasted round-trip returning `undefined` → `notFound()`. Not a security blocker; not re-classified here.

## Unregistered Flags

None. No `03-0X-SUMMARY.md`'s `## Threat Flags` section reports new attack surface without a threat-model mapping:
- 03-01-SUMMARY.md: no `## Threat Flags` section present (executor found none to flag)
- 03-02-SUMMARY.md: no `## Threat Flags` section present
- 03-03-SUMMARY.md: no `## Threat Flags` section present
- 03-04-SUMMARY.md: explicit `## Threat Flags` → "None — both changes stay within the trust boundary already documented in this plan's `<threat_model>` (T-03-10, T-03-11); no new endpoints, auth paths, or schema changes were introduced."

## Verification Method Notes

- All `mitigate` threats verified by direct grep/read of the cited implementation files against the exact pattern named in each PLAN.md's Mitigation Plan column — not inferred from SUMMARY.md prose.
- All `accept` threats verified by confirming a durable rationale exists (now consolidated into this SECURITY.md's Accepted Risks Log, previously scattered across 3 separate PLAN.md files).
- Implementation files were read-only for this audit; no source file was modified.

## Security Audit 2026-07-23

| Metric | Count |
|--------|-------|
| Threats found | 13 |
| Closed | 13 |
| Open | 0 |
