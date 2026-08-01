# Phase 8: Enrichment API - Context

**Gathered:** 2026-07-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Staff can trigger commercial-API enrichment (Apollo.io) for a **single** Company or Persona from that record's detail-panel Menu → Enrich action, pulling real firmographic/contact data to auto-fill empty fields. Incoming vendor data never silently overwrites a field staff has already populated: empty target fields are pre-accepted, populated-but-differing fields surface as per-field conflicts for explicit accept/reject before anything commits. Each field carries a provenance marker (`manual` vs `apollo`) stored per-field, and the vendor's match-confidence score is shown per field when Apollo exposes one. Nothing is written to the database until staff confirms the review screen.

Requirements: ENRC-01 through ENRC-05 (`.planning/REQUIREMENTS.md` §Enrichment API). No new capabilities beyond what's listed — bulk/"enrich all", vendor auto-creation of new records, and staleness/re-sync scheduling are explicitly out of scope (see Deferred). Analytic Agent (Phase 9) is a separate phase.

This phase builds directly on Phase 7's foundation: the `company.domain` / `persona.email` dedup keys (Apollo matches on these), the `buildUpdatePatch` blank-cell merge primitive (`src/lib/import/dedupKeys.ts`), and the established Server Action + query-layer + wizard-review patterns.

</domain>

<decisions>
## Implementation Decisions

### Vendor & client
- **D-01:** Vendor is **Apollo.io** (fixed by ENRC-01). Build the client behind a small vendor-agnostic adapter interface (`EnrichmentResult` discriminated union) so a future vendor swap doesn't touch merge/provenance/review logic — but only Apollo is implemented this phase.
- **D-02:** The enrichment client returns a **discriminated result** `{ ok: true; fields: EnrichedField[] } | { ok: false; reason: string }` — NOT Arcpedia's "any failure → `[]`" shape. A paid write-path call must distinguish "vendor genuinely found nothing" from "the call failed" (Pitfall 5). Failure `reason` is surfaced to the initiating staff member in the UI, never silently swallowed.
- **D-03:** Company enrichment matches Apollo on `company.domain`; Persona enrichment matches on `persona.email`. A record with a blank match key **cannot be enriched** — the Enrich action is disabled/blocked with a clear "add a domain/email first" message, rather than sending Apollo a nameless guess (consistent with Phase 7 D-03/D-04's no-fragile-fallback-key rule).

### Trigger scope
- **D-04:** Enrichment is **per-record only** this phase — one explicit staff-triggered Apollo call per Enrich action, launched from the Company/Persona **detail-panel** Menu (the "Analyze"-adjacent slot the Phase 6 Menu already reserves). No bulk "enrich all", no list-loop enrichment (directly avoids Pitfall 4's metered-API N+1 blast radius — no rate limiter / batch cost-guard infra needed this phase).
- **D-05 [informational]:** Because scope is per-record + explicit-action-only, no per-batch cost cap, no exponential-backoff retry queue, and no circuit breaker are built this phase. A single transient failure surfaces its `reason` to the user, who can retry manually. (Bulk enrich, if ever added, is where Pitfall 4's cost-guard infra becomes mandatory — deferred.)

### Merge policy & provenance
- **D-06:** Merge policy is **auto-fill-empty-only** (ENRC-02). Incoming Apollo values for currently-empty target fields are pre-accepted; incoming values that differ from an existing **non-empty** staff value are **conflicts** requiring explicit per-field accept. Reuses the "blank means no-data" semantics already encoded in Phase 7's `buildUpdatePatch`.
- **D-07:** Provenance is stored **per-field** (ENRC-03) via a new `fieldSources` jsonb column on `company` and `persona`: `Record<string, 'manual' | 'apollo'>`. Every field a commit fills/overwrites from Apollo gets marked `'apollo'`; existing/manually-kept fields stay/become `'manual'`. Default `{}` — existing rows are treated as all-`manual` (absence of a marker = manual). No backfill required.
- **D-08:** Add `lastEnrichedAt: timestamp` (nullable) to `company` and `persona` — set on every successful enrichment commit. Answers "was this record ever enriched, and when" (Pitfall 6). No `updatedAt` general column added this phase (out of scope; only the enrichment write path is in play).
- **D-09:** A field the user **rejects** in the review screen is left untouched AND its provenance is left unchanged (a rejected Apollo value never marks the field `apollo`). Only committed accepts change field values and provenance.

### Review flow
- **D-10:** Enrichment uses a **unified review screen** before any write (ENRC-04). One screen lists every field Apollo returned: empty-target rows pre-checked ("fill"), populated-but-differing rows shown as unchecked conflicts ("current vs incoming"), identical rows shown as no-op/hidden. Staff toggles per field and clicks Commit once. **Nothing writes until Commit** — matches the app's no-silent-write trust model and the Analyze review-queue shape (Phase 9 will share this pattern).
- **D-11:** Match-confidence (ENRC-05) is displayed **per field when Apollo's response exposes one**, rendered inline in the review row (e.g. a small confidence badge). When Apollo returns no score for a field, the column is simply blank for that row — never a fabricated/defaulted score.
- **D-12 [informational]:** The review screen is a transient in-session step (like Phase 7's validate/confirm), not a persisted queue table. A record is enriched → reviewed → committed in one flow; abandoning the flow writes nothing. (A persisted enrichment-proposal queue is a Phase 9-adjacent idea, deferred.)

### Logging & security
- **D-13:** Log enrichment call **metadata only** — timestamp, entityType, recordId, success/failure, HTTP status, and vendor credits-remaining if exposed — NEVER the response body or raw PII fields (Pitfall 5). This is a deliberate departure from Arcpedia's "never log anything" convention, made consciously because a paid call silently failing is a real operational blind spot. Reuse the `console`-based server logging already present; no new logging framework.
- **D-14:** The Apollo API key is server-only, added to `src/lib/env.ts` as `APOLLO_API_KEY` (non-`PUBLIC_` prefix), **optional with graceful degrade** — same treatment as the Arcpedia keys: if unset, the Enrich action is disabled with a "not configured" message rather than crashing the app at import time. Never logged, never exposed to client.
- **D-15 (review remediation):** A review is authorized by a short-lived HMAC-signed, self-contained proposal bound to the Clerk user, entity, record, row version, displayed current snapshots, and server-mapped Apollo values. The client returns only the token and selected field names. Commit never re-fetches Apollo and no durable proposal queue is introduced.
- **D-16 (review remediation):** Company and Persona rows carry a monotonic `version`. Enrichment commits use one `UPDATE ... WHERE id AND version`, merge JSONB provenance in that statement, and increment the version. CSV updates also increment it and mark supplied enrichable fields `manual`, making stale/replayed proposals fail without a second read.
- **D-17 (review remediation):** Phase 7 rollback skips records enriched after their import-log timestamp, both during preview and through a conditional delete at execution time.

### Claude's Discretion
- Whether enrichment call metadata is logged to `console` only or also persisted to a small `enrichment_log` table (mirroring `import_log`) — decide in research/planning based on whether ENRC needs an auditable history surface or console suffices for v1.1.
- Exact `EnrichedField` shape (`{ field, incomingValue, confidence? }`) and how Apollo's response JSON maps onto the `company`/`persona` schema fields — a field-mapping layer analogous to Phase 7's `rowMapper.ts`.
- Exact Apollo endpoint(s) used (People Enrichment vs Organization Enrichment) and their request/response Zod schemas — a research task (read Apollo's current API docs).
- Review-screen component composition (new component vs. extending the Phase 7 wizard-review components) — planning decision; prefer sharing the "current vs incoming, accept per field" table shape.
- Whether `fieldSources` provenance drives any list/detail badge UI this phase, or is stored-but-not-yet-surfaced (schema-first, UI badges optional) — planning call within ENRC-03's "carries a marker" wording.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — ENRC-01 through ENRC-05 exact requirement text (§Enrichment API), plus the Out-of-Scope rows (no silent full overwrite; no vendor auto-creation of new records)
- `.planning/ROADMAP.md` — Phase 8 section (Goal, Depends on Phase 7, Requirements list)
- `.planning/PROJECT.md` — Core Value ("trustworthy 360 view"), Key Decisions, Out of Scope

### Research (grounds decisions above — read before planning)
- `.planning/research/PITFALLS.md` — **Read Pitfalls 4, 5, 6 in full before planning.** Pitfall 4 (metered-API N+1 / cost-guard — informs D-04/D-05's per-record-only scope), Pitfall 5 (don't copy Arcpedia's never-throws/never-logs onto a paid PII call — informs D-02/D-13), Pitfall 6 (no provenance/staleness in schema — informs D-06/D-07/D-08)
- `.planning/research/FEATURES.md` §"3c. Commercial Enrichment API Integration" — auto-fill-empty merge convergence across Apollo/Explorium/Coffee.ai, field-level provenance framing, merge-review-UI framing, vendor-agnostic-adapter recommendation
- `.planning/research/ARCHITECTURE.md` — the `src/lib/enrichment.ts` discriminated-result recommendation (do NOT copy `arcpedia.ts`'s `[]`-on-failure shape); env-key handling guidance

### Existing code (enrichment must reuse/extend these, not diverge)
- `src/lib/db/schema.ts` — `company`/`persona` shapes; D-07/D-08 add `fieldSources` jsonb + `lastEnrichedAt` on top of Phase 7's `domain`/`email` unique keys
- `src/lib/arcpedia.ts` — the ONLY existing external-integration precedent; study its env-guard + Zod-parse + timeout shape, but consciously DIVERGE from its `catch → []` / never-log policy per D-02/D-13
- `src/lib/env.ts` — add `APOLLO_API_KEY` following the optional-degrade pattern already used for `ARCPEDIA_ACCESS_CLIENT_*` (D-14)
- `src/lib/import/dedupKeys.ts` — `buildUpdatePatch` blank-cell merge primitive (reuse for D-06 auto-fill-empty), `normalizeDomain`/`normalizeEmail` (reuse for D-03 match-key normalization)
- `src/lib/db/queries/companies.ts` / `personas.ts` — Phase 7's `upsertCompanyByDomain` / `upsertPersonaByEmail` query patterns; enrichment's committed write is a targeted UPDATE (only accepted fields + provenance), a lighter cousin
- `src/components/import/` — Phase 7 wizard-review components; prefer sharing the "current vs incoming, accept per field" table shape for D-10
- `src/components/explorer/explorer-menu.tsx` — the detail-panel Menu (D-04 Enrich action lives here, next to the reserved Analyze slot)

</canonical_refs>

<requirements_traceability>
## Requirements Traceability

| Requirement | Covered by decisions |
|-------------|----------------------|
| ENRC-01 (staff-trigger Apollo enrichment) | D-01, D-03, D-04 |
| ENRC-02 (auto-fill empty only, no silent overwrite) | D-06, D-10 |
| ENRC-03 (per-field provenance marker) | D-07, D-09 |
| ENRC-04 (field-level merge conflict review, accept/reject) | D-06, D-09, D-10 |
| ENRC-05 (show vendor match-confidence per field) | D-11 |

</requirements_traceability>

<deferred>
## Deferred / Out of Scope (this phase)

- **Bulk "enrich all" / list-loop enrichment** — deferred; would require Pitfall 4's batch cost-guard, per-batch cap, backoff/retry, circuit-breaker infra. Per-record-only this phase (D-04).
- **Vendor auto-creation of new Company/Persona records** from Apollo "similar company" suggestions — explicitly out of scope per REQUIREMENTS.md (prospecting/list-building is a later milestone). Enrichment only touches records staff already track.
- **Silent full overwrite of populated fields** — explicitly rejected (conflicts with Core Value); overwrites are always opt-in per field (D-06/D-10).
- **Staleness / scheduled re-sync** — `lastEnrichedAt` is stored (D-08) but no automatic re-enrichment or staleness alerting is built.
- **Persisted enrichment-proposal queue table** — the review step is transient this phase (D-12); a durable queue is Phase 9-adjacent.
- **`updatedAt` general provenance timestamp** — only `lastEnrichedAt` (enrichment-specific) added; a general row-mutation timestamp is out of scope.

</deferred>
