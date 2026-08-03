# Phase 24: Refresh Script + Catalog Data - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-03
**Phase:** 24-refresh-script-catalog-data
**Areas discussed:** Nous snapshot scope, Snapshot structure, Go roster verify method, ~latest alias handling, Canary re-lock, Refresh atomicity

---

## Nous Snapshot Scope

| Option | Description | Selected |
|--------|-------------|----------|
| All 292 roster rows | All 292 rows from the anonymous GET land in catalog.json with providerID 'nousresearch'. The Hermes allowlist gate (D-23-05) controls servability; the full roster is the menu (D-02 openrouter precedent). | ✓ |
| Hermes pair only (2 rows) | Only the 2 Hermes-4 allowlist rows ship in the snapshot. Lean catalog, but any future allowlist expansion requires re-running refresh. | |
| Curated subset | A mid-point — e.g. all rows whose family is hermes or whose supported_parameters include structured_outputs. More curation logic + maintenance burden. | |

**User's choice:** All 292 roster rows
**Notes:** Recommended choice accepted — snapshot is the menu, Hermes allowlist is the gate. Mirrors the D-02 openrouter precedent (336 rows ship).

---

## Snapshot Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Flat array, no change | Snapshot stays one flat 'models' array with all providers mixed; nousresearch rows are just another providerID. Zero schema change. | |
| Group by provider | Restructure catalog.json to group rows by provider. More readable for humans browsing the JSON. | ✓ (initial) |
| Flat + derived index | Keep the flat models array as single source of truth + add a derived providers index alongside as readability aid. | (offered as reconciliation) |
| Full restructure + migrate all | Truly restructure to { providers: {...} } and migrate ALL consumers in the same change. | ✓ (final) |

**User's choice:** Group by provider, then confirmed **Full restructure + migrate all** when the conflict with the "no schema change" doctrine was surfaced.
**Notes:** User was presented the migration ripple (catalog.ts, tests, canaries, Phase 25-27 consumers, 19-01 green-build doctrine) and confirmed the full restructure anyway. Recorded as D-24-03/04/05 — an intentional deviation from the v1.5 roadmap footnote, scoped to the snapshot FILE shape only (DB schema doctrine stays intact).

---

## Go Roster Verify Method

| Option | Description | Selected |
|--------|-------------|----------|
| Live-fetch + fail on drift | Script fetches the live Zen (60) + Go (25) /v1/models endpoints and compares id-sets against the CLI-parsed roster. Any drift fails loudly BEFORE writing. | ✓ |
| Trust CLI as-is | Keep current behavior — opencode CLI output is the sole source; no live cross-check. | |
| Live-union-merge into snapshot | Fetch live Zen/Go ids AND merge any live ids missing from CLI output into the snapshot. | |

**User's choice:** Live-fetch + fail on drift
**Notes:** Recommended choice accepted — roster-verify per D-02, catches CLI staleness.

---

## Drift Semantics (Go verify follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| Any drift aborts (strict) | Any difference between live Zen/Go id-set and CLI-parsed id-set aborts the run. | ✓ |
| Count-based check | Compare counts (60/25) rather than exact id-sets — abort if COUNT differs, not per-id. | |
| Fail on missing, warn on extra | Fail on missing live ids in CLI output; EXTRA CLI ids absent from live pass with a warning. | |

**User's choice:** Any drift aborts (strict)
**Notes:** Strictest reading — matches throws-not-degrades doctrine exactly.

---

## ~latest Alias Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Ship verbatim + label | All 11 ~latest alias rows ship verbatim (never stripped — D-04), providerID 'nousresearch'. Self-exclude from servable. Matches openrouter precedent. | ✓ |
| Exclude from snapshot | ~latest alias rows dropped at refresh time — only concrete-id rows ship. | |

**User's choice:** Ship verbatim + label
**Notes:** D-04 honored; aliases self-exclude from servable (allowlist pins concrete ids).

---

## ~latest Label Representation

| Option | Description | Selected |
|--------|-------------|----------|
| Derivable from id, no field | The ~latest-ness is visible in the id itself; no extra snapshot field. Label logic lives where display labels live (Phase 26). | ✓ |
| Explicit alias field in snapshot | Add an explicit boolean/flag field (e.g. alias: true) at refresh time. | |

**User's choice:** Derivable from id, no field
**Notes:** Zero schema impact on the restructured snapshot.

---

## Post-Refresh Canary Re-lock

| Option | Description | Selected |
|--------|-------------|----------|
| Re-lock to new explicit numbers | Update canaries to the new explicit numbers in the SAME commit as the regenerated snapshot — a deliberate, reviewed re-lock. | ✓ |
| Derive counts from snapshot | Refactor canaries to derive expected counts from the committed snapshot automatically. | |

**User's choice:** Re-lock to new explicit numbers
**Notes:** Deliberate re-lock per D-02 doctrine; auto-derived counts would defeat the canary's purpose.

---

## Nous Canary Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Full Nous canary group | Rows present, Hermes allowlist servable, pricing ×1e6 correct, family derived from id prefix, ~latest aliases present + self-excluded. | ✓ |
| Minimal gate-only canary | Only Hermes allowlist servable + count sanity bound. | |

**User's choice:** Full Nous canary group
**Notes:** Pricing conversion (highest-risk bug, Pitfall 2) + family derivation locked by tests.

---

## Refresh Atomicity

| Option | Description | Selected |
|--------|-------------|----------|
| One command, all sources | A single `npm run models:fetch` does everything; fails at the first drift without writing. | ✓ |
| Per-source subcommands | Separate scripts/commands per source for independent refresh. | |

**User's choice:** One command, all sources
**Notes:** Preserves abort-without-write atomicity; per-source subcommands rejected.

---

## Claude's Discretion

- Exact grouped-snapshot structure (providers object keying; generatedAt placement) — must satisfy D-24-03/04/05.
- Whether Zen/Go drift errors report per-id diffs (recommended: yes).
- Naming for fetchNousRoster() / fetchZenGoRosters() — consistent with fetchOpenRouterStructuredOutputs().
- Migration sequencing within plan tasks — build must stay green at every commit.
- Nous family derivation edge cases beyond hermes-4-*.

## Deferred Ideas

- ~latest label rendering — Phase 26 UI.
- Per-source refresh subcommands — rejected (atomicity).
- Auto-derived canary counts — rejected (canary purpose).
