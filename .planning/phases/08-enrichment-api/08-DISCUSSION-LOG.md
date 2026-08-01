# Phase 8: Enrichment API - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-31
**Phase:** 8 — Enrichment API
**Areas discussed:** Provenance granularity, Trigger scope, Merge-review flow

---

## Provenance granularity (ENRC-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Per-field (`fieldSources` jsonb) | Map each field → `'manual'` \| `'apollo'`; enables per-field vendor badges | ✓ |
| Per-row (single `dataSource` text) | One marker per record (`manual`/`apollo`/`mixed`); simpler, loses field attribution | |

**User's choice:** Per-field. ENRC-03 says "*each field* carries a marker" — the jsonb map satisfies it literally and feeds ENRC-04's per-field review + eventual per-field UI badges. Existing rows default `{}` (treated as all-manual), no backfill.

---

## Trigger scope (ENRC-01 wording)

| Option | Description | Selected |
|--------|-------------|----------|
| Per-record only | One Enrich action per record from the detail Menu; no batch loop | ✓ |
| Also support bulk enrich | Add "enrich all"; requires cost-guard, cap, backoff, call-count logging (Pitfall 4) | |

**User's choice:** Per-record only. Matches ENRC-01's singular wording and Pitfall 4's "one call per explicit user action" guidance. Avoids building metered-API rate-limit/cost-guard infrastructure this phase; bulk is deferred to where that infra becomes mandatory.

---

## Merge-review flow (ENRC-02 + ENRC-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Unified review, empty-fills pre-checked | One screen; empty targets pre-accepted, conflicts unchecked; nothing writes until Commit | ✓ |
| Silent auto-fill + separate conflict queue | Empty fields fill immediately, only conflicts reviewed after | |

**User's choice:** Unified review with nothing-writes-until-confirm. Preserves the app's no-silent-write trust model, keeps provenance/rollback clean, and establishes the "current vs incoming, accept per field" shape Phase 9's signal-proposal review will reuse.

---

## Notes carried from research (not user-chosen, but recorded)

- Vendor fixed to **Apollo.io** by ENRC-01 (not an open question).
- Discriminated `EnrichmentResult` (not Arcpedia's `[]`-on-failure) — dictated by Pitfall 5 + ARCHITECTURE.md.
- Metadata-only logging (never response body / PII) — dictated by Pitfall 5.
- `APOLLO_API_KEY` server-only, optional-degrade — mirrors existing `ARCPEDIA_*` env handling.
