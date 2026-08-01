# Phase 8: Enrichment API - Research

**Researched:** 2026-07-31
**Confidence:** HIGH for codebase-specific findings; MEDIUM for Apollo API response-shape details (from docs.apollo.io + secondary sources, not a live authenticated call)

---

## Apollo.io API Surface (verified against docs.apollo.io, Jul 2026)

### Endpoints used this phase

| Purpose | Method | URL | Auth |
|---------|--------|-----|------|
| Organization Enrichment (single) | `GET` | `https://api.apollo.io/api/v1/organizations/enrich?domain=<domain>` | header `X-Api-Key: <key>` |
| People Enrichment (single) | `POST` | `https://api.apollo.io/api/v1/people/match?email=<email>` | header `X-Api-Key: <key>` |

- Base URL: `https://api.apollo.io/api/v1`.
- Auth header is **`X-Api-Key`** (not a bearer token, not a body `api_key` field — the modern convention; the legacy body `api_key` still works but header is preferred). Headers also expect `Content-Type: application/json` and `Cache-Control: no-cache`.
- **Domain input rule:** pass a bare domain (`apollo.io`, `microsoft.com`) — no `www.`, no `@`, no protocol. This is exactly what `normalizeDomain` (Phase 7) already produces — reuse it.
- **People match input:** `email` query param is the strongest single signal; we always have it (ENRC/D-03 blocks enrichment when email is blank). We do NOT pass `reveal_personal_emails` or `reveal_phone_number` (both default false) — we don't want PII beyond what staff already have; we want `title`, `linkedin_url`, seniority, and location.
- **Credits:** both endpoints consume Apollo credits per enriched record when data is returned. Per-record-only scope (D-04) keeps this to one credit per explicit staff action.

### CRITICAL gotcha — 200 ≠ match

> "You might receive a 200 response, but the response will indicate that no records have been enriched."

A 200 HTTP status does **not** guarantee a match. The discriminated result (D-02) must inspect the **payload**:
- Org endpoint returns `{ organization: {...} }` on match; the `organization` key is absent/null on no-match.
- People endpoint returns `{ person: {...} }` (or `{ people: [...] }` for bulk) on match; `person` absent/null on no-match.

`{ ok: false, reason: 'no_match' }` when the object is absent, `{ ok: false, reason: 'http_<status>' }` on non-2xx, `{ ok: false, reason: 'network' }` on fetch throw/timeout, `{ ok: true, fields: [...] }` only when the object is present AND at least one mappable field is non-empty.

### Response → schema field mapping

**Organization Enrichment `organization` object → `company` columns:**

| `company` column | Apollo field(s) | Transform |
|------------------|-----------------|-----------|
| `industry` | `industry` | passthrough (string) |
| `employeeCountBand` | `estimated_num_employees` | number → band string (e.g. `"51-200"`) via a small bucketer, since our column is a banded text, not an int |
| `hqLocation` | `city`, `state`, `country` | join non-empty parts with `", "` |
| `revenueBand` | `annual_revenue` (number) or `organization_revenue_printed` | number → `revenueBandEnum` bucket (`under_50m`…`5b_plus`); if only the printed string is present, best-effort parse |
| `ownershipType` | (no direct Apollo equivalent) | leave unmapped — Apollo doesn't reliably return ownership type; stays `manual` |
| `techStack` | `technology_names` (string[]) or `current_technologies[].name` | passthrough array (dedupe) |
| `domain` | `primary_domain` / `website_url` | NOT overwritten — it's our match key; left as-is |

**People Enrichment `person` object → `persona` columns:**

| `persona` column | Apollo field(s) | Transform |
|------------------|-----------------|-----------|
| `title` | `title` | passthrough |
| `seniority` | `seniority` | map Apollo's seniority (`senior`,`manager`,`director`,`vp`,`c_suite`,`owner`,`partner`,`entry`,`intern`) → our `seniorityEnum` (`ic`,`manager`,`director`,`vp`,`c_level`); `c_suite`→`c_level`, `entry`/`intern`→`ic`, unknown→omit |
| `linkedinUrl` | `linkedin_url` | passthrough |
| `email` | `email` | NOT overwritten — it's our match key |
| `name` | `name` / `first_name`+`last_name` | NOT overwritten — staff-entered identity, and it's required/non-null; enrichment never touches `name` |

The mapping layer (`apolloMapCompany` / `apolloMapPersona`) is a **pure function** analogous to Phase 7's `rowMapper.ts` — independently unit-testable, no network.

### Match-confidence (ENRC-05)

Apollo's **enrichment** endpoints (`/organizations/enrich`, `/people/match`) do **not** return a documented per-field confidence score (confidence/waterfall scoring surfaces in Apollo's search/waterfall-log UI, not the enrich response body). Therefore ENRC-05 ("when the vendor's API exposes one") resolves to: **the confidence column in the review UI is rendered blank/`—` for Apollo**, and the `EnrichedField.confidence?` field stays `undefined`. The plumbing (`confidence?` on the field type, a column in the review table) is built so a future vendor that DOES expose scores needs no structural change — but no score is fabricated. This is a deliberate, documented resolution, not an oversight.

---

## Codebase integration findings

### Reuse (do not re-implement)
- **`normalizeDomain` / `normalizeEmail`** (`src/lib/import/dedupKeys.ts`) — produce the exact bare-domain / lowercased-email match keys Apollo wants.
- **`buildUpdatePatch`** (same file) — the "blank incoming value never overwrites" primitive. The enrichment merge's "fill empty only" default is the same idea applied field-by-field, gated by the review screen's per-field accept toggles.
- **`upsertCompanyByDomain` / `upsertPersonaByEmail`** (`src/lib/db/queries/*.ts`) — enrichment's committed write is a *lighter cousin*: a targeted `UPDATE company SET <acceptedFields>, field_sources=..., last_enriched_at=now() WHERE id=?`. New query fn `applyCompanyEnrichment` / `applyPersonaEnrichment`, NOT a reuse of the upsert (no insert path — the record always already exists).
- **`requireStaffAccess()`-first** (`src/app/actions.ts`) — every enrichment Server Action calls it before any DB/vendor access, `userId` derived server-side (never a param).
- **`arcpedia.ts`** — study its env-guard + `AbortSignal.timeout` + Zod `safeParse` shape. **Consciously diverge** on failure policy: Arcpedia `catch → []` and never-logs; enrichment returns a discriminated `{ ok: false, reason }` and logs *metadata* (Pitfall 5).
- **`ExplorerMenu`** (`src/components/explorer/explorer-menu.tsx`) — the `variant="icon"` detail-panel menu currently carries `{ label: 'Analyze', disabled: true }`. Phase 8 adds an `{ label: 'Enrich', ... }` item that opens the review dialog (Analyze stays disabled — that's Phase 9).

### New patterns (no analog)
- **First paid, write-adjacent external API** — the discriminated-result + metadata-logging shape is new (Pitfall 5). Documented in CONTEXT D-02/D-13.
- **First client-side modal dialog driven by a Server Action round-trip** — `enrichment-review-dialog.tsx`. Closest analog is Phase 7's `import-wizard.tsx` client state machine + the shadcn `dialog.tsx` already installed in Phase 7 (07-09). Reuse that `dialog` primitive.
- **`fieldSources` jsonb provenance** — new column shape; closest analog is Phase 7's jsonb columns on `import_batch` (`mapping`, `valueMapping`). Same `.$type<...>()` typing convention.

### Env handling (D-14)
Add to `src/lib/env.ts`, following the ARCPEDIA optional-degrade pattern:
```ts
APOLLO_API_KEY: z.string().optional(),
```
Optional (not fail-fast) so an unconfigured key disables Enrich (menu item disabled + "not configured" message) rather than crashing the app at import time. Add `APOLLO_API_KEY=` to `.env.example`. Never `PUBLIC_`-prefixed; never logged.

---

## Package Legitimacy Audit

| Package | Needed? | Status |
|---------|---------|--------|
| (none new) | — | Apollo is called via the built-in `fetch` — no vendor SDK added. Zod (already a dependency) validates responses. **No new npm packages this phase.** |

No new dependencies → no package-legitimacy human gate needed this phase (contrast Phase 7's vitest gate).

---

## Open risks / watch-items

1. **Apollo response shape drift** — the exact JSON field names (`estimated_num_employees`, `technology_names`, `organization_revenue_printed`) are from docs + secondary sources, not a live authenticated call. Mitigation: the Zod response schema uses `.passthrough()` + `.optional()` on every mapped field so an unexpected/missing field degrades to "not enriched for that column" rather than a parse crash. First real call against a live key should be smoke-tested manually (see VALIDATION manual checks).
2. **Employee-count / revenue bucketing** — mapping a raw Apollo integer to our banded enum is lossy but deterministic. Bucket boundaries must match the existing `revenueBandEnum` comments in `schema.ts`. Unit-tested.
3. **No test DB** — same constraint as Phase 7. The pure mapping + merge functions are unit-tested (vitest); the DB write path and the live Apollo call are manual UAT.
