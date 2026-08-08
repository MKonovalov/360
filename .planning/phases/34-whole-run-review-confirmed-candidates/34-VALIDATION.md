# Phase 34 Validation Contract

## Required automated evidence

| Gate | Evidence required |
|---|---|
| Contracts/schema | Review decision enum, positive run ID, closed action/result shapes, unique review identity, packet-hash capture, and no packet mutation path pass pure tests and schema metadata checks. |
| Review lifecycle | Completed packet reconciles once; missing packet is rejected/excluded; duplicate review items do not occur; `pending_review → confirmed|dismissed` is guarded and append-only. |
| Decision concurrency | Two Confirms, two Dismisses, and Confirm-vs-Dismiss races produce one winner, one decision row, one terminal event, and the same winner returned to losers. Replay preserves original actor/time/packet hash. |
| Packet immutability | Before/after packet hash, result, finding, source, and finding-source rows are identical for Confirm, Dismiss, replay, and race cases. |
| No-live-write scope | Action/query imports and SQL cannot reach `agent_run`, `signal_proposal`, `signal`, `company_signal`, `persona_signal`, `signal_offering_link` writes, or offerings writes; before/after catalog snapshots remain unchanged. |
| Candidate projection | Confirmed Company and Persona fixtures return active offerings and run/result/finding/source/link provenance; joins distinguish equal Company/Persona signal IDs; duplicates retain deterministic provenance. |
| Exclusion matrix | `queued`, `running`, `completed`, `pending_review`, `failed`, `cancelled`, and `dismissed` return no candidate rows. `no_evidence`, `inconclusive`, missing source links, expired Persona packets, and missing packet rows also return no rows. |
| Catalog semantics | Active offerings display by default; retired/draft rows do not masquerade as active, while historical link/identity IDs remain available in the approved provenance shape. |
| Auth/scope | Direct page and Server Action calls require Clerk staff access; actor is server-derived; invalid IDs/decisions fail before DB work. |
| Build | Focused Vitest suites, guarded Neon integration/concurrency suites, `npx tsc --noEmit`, and `npm run build` pass. |

## Required focused test fixtures

- One Company and one Persona confirmed packet with duplicate review-list
  attempts, multiple findings, multiple persisted sources, and repeated
  offering provenance.
- Equal Company and Persona signal IDs linked to different offerings.
- One fixture for every excluded run lifecycle status listed above.
- Strong/weak/no-evidence/inconclusive findings, including source-less and
  source-linked variants.
- Active, retired, and draft offerings plus historical link identity.
- Persona packet retained, expired, and tombstoned states.
- Confirm replay, Dismiss replay, Confirm-vs-Dismiss race, and packet snapshot
  immutability assertions.

## Authenticated UAT (fixture-only)

1. Sign in as staff and open `/reviews`; verify the legacy proposal queue still
   renders with its existing Accept/Reject behavior and a completed packet
   appears exactly once in the separate run-level section.
2. Expand the packet; verify target type/ID-safe summary, normalized finding
   strength, navigable persisted source URL/title, packet hash/provenance, and
   current lifecycle state. Verify expired Persona artifacts are not shown.
3. Confirm from two browser tabs or replay the action; verify one terminal
   decision, original actor/time, unchanged packet, and no live Signal/link
   count change. Repeat with a Dismiss fixture.
4. Query the confirmed-candidate read surface with Company and Persona
   fixtures; verify only confirmed strong/weak source-backed rows appear,
   active offerings are displayed, discriminator and provenance IDs remain,
   and every excluded status is absent.

No UAT step launches Analyze, invokes a model, calls Firecrawl, or treats Phase
33's deferred live smoke as passed.

## Environment and evidence policy

`TEST_DATABASE_URL` is required for database-backed concurrency, immutability,
retention, and aggregation evidence; if absent, the gate must fail closed and
the validation ledger must say which evidence is unavailable. Never print the
URL or raw provider/database errors. Authenticated Playwright uses existing
Clerk test setup and packet fixtures only.

## Observed gate evidence — Task 1 automated (2026-08-08)

| Gate | Observed result |
|---|---|
| Scope audit (`npm exec tsx -- scripts/phase34-scope-audit.ts`) | **PASS** — 270 tracked files scanned; categories source/scripts/manifests/schema-query; 0 findings |
| Scope-audit focused test | **PASS** — 1 file / 1 test via isolated Vitest config override (repo include is `src/**/*.test.ts`; shared config unchanged) |
| Focused contract/action/component/query suites | **PASS** — 6 files / 82 tests |
| Guarded Neon integration/concurrency suites (`TEST_DATABASE_URL` configured, value not printed) | **PASS** — 2 files / 18 tests |
| `npx tsc --noEmit` | **PASS** (exit 0) |
| `npm run build` | **PASS** (exit 0) |
| Live provider / Firecrawl execution | **NOT RUN** — `policy_or_credentials_unavailable`; Phase 33 deferred smoke is not approval; fixtures only |
| Authenticated fixture UAT | **PENDING** — Task 2 human checkpoint |

Adversarial matrix coverage (duplicate items, Confirm/Dismiss races, replay,
packet immutability, signal/persona ID collision, every excluded lifecycle
status, active/retired/draft semantics, Persona retention, auth/scope,
no-live-provider) all recorded **PASS** with sanitized counts in
`34-VERIFICATION.md`.
