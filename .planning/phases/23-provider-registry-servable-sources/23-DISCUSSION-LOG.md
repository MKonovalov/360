# Phase 23: Provider Registry + Servable Sources - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-03
**Phase:** 23-Provider Registry + Servable Sources
**Areas discussed:** OpenCode gate mechanism, OpenCode default primary, Nous allowlist + default, Zen-wins dedup home

---

## OpenCode Gate Mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Data-driven by api.npm | PROVIDER_GATES.opencode = allowlist of npm values ['@ai-sdk/openai-compatible','@ai-sdk/anthropic']. New chat/Claude models auto-servable on refresh; GPT/Gemini self-exclude. Matches 'snapshot is the menu, gate is the lock' precedent. | ✓ |
| Hardcoded 49-id allowlist | Explicit curated list mirroring ANTHROPIC_ALLOWLIST — every roster change needs code + deploy. | |
| Family-based exclusion | Exclude by family (gemini/gpt) — fragile, family naming drifts. | |

**User's choice:** Data-driven by api.npm
**Notes:** Follow-up question confirmed a count-stability canary locking the current snapshot's opencode servable shape (49 rows: 30 chat + 19 Claude, 0 GPT/Gemini) so Phase 24 refresh drift fails loudly.

---

## OpenCode Default Primary

| Option | Description | Selected |
|--------|-------------|----------|
| claude-sonnet-4-6 via opencode | Same id as anthropic default, served via the Phase-25 createAnthropic baseURL extension. Perfect D-07 mirror, team-familiar, id-collides with anthropic default (badges disambiguate). | ✓ |
| Opencode-native chat flagship | Distinct provider identity, simple run path — but cost/quality unproven, needs roster look-up in planning. | |
| Different Claude row | e.g. haiku-class — avoids exact id collision but still the extension path. | |

**User's choice:** claude-sonnet-4-6 via opencode
**Notes:** Confirmed keep-if-valid accepted — switching providers keeps the same id (re-badged to opencode); the badge carries provider identity in Phase 26.

---

## Nous Allowlist + Default

| Option | Description | Selected |
|--------|-------------|----------|
| Hermes-4 pair, concrete pins | nousresearch/hermes-4-70b + nousresearch/hermes-4-405b, no ~latest — roster-verified in Phase 24, stable across refresh cycles. | ✓ |
| Pair + ~latest alias | Auto-servable point releases — matches openrouter '~latest INCLUDED' precedent but adds label/staleness surface. | |
| Single Hermes row | Smallest surface but violates REG-04 'Hermes-4 pair'. | |

**User's choice:** Hermes-4 pair, concrete pins

| Option | Description | Selected |
|--------|-------------|----------|
| 70b default | hermes-4-70b as PROVIDER_DEFAULT_MODELS.nousresearch — sonnet-class cost philosophy. | ✓ |
| 405b default | Flagship reasoning model — heavier default for everyday Analyze runs. | |

**User's choice:** 70b default

| Option | Description | Selected |
|--------|-------------|----------|
| Fixture canary now, live later | Phase 23 fixture mirrors future roster shape; Phase 24 adds live-snapshot canary. Non-vacuous at every point. | ✓ |
| Canary only in Phase 24 | Priority-order logic ships untested for the hermes case for one phase. | |
| Declared-only canary | Asserts registration but no collision exercised until Phase 24. | |

**User's choice:** Fixture canary now, live later
**Notes:** The allowlist is code declared in Phase 23; the rows land in the snapshot in Phase 24 and are roster-verified there.

---

## Zen-Wins Dedup Home

| Option | Description | Selected |
|--------|-------------|----------|
| Registry layer | One helper spanning both opencode + opencode-go snapshot providerIDs under the 'opencode' logical provider; Zen row wins. Testable in Phase 23 against the current snapshot; refresh stays format-only. | ✓ |
| Refresh script | Snapshot ships pre-deduped — but Phase 23's union can't be correct until Phase 24 regen. | |
| Registry + regen assertion | Belt-and-suspenders — rule once in code, verified once in data. | |

**User's choice:** Registry layer

| Option | Description | Selected |
|--------|-------------|----------|
| Determinism + snapshot lock | Canary asserts rule-determinism AND the current snapshot's concrete shape (12 dual-listed → Zen, 5 Go-exclusive → Go, no endpoint flip). Drift fails loudly. | ✓ |
| Determinism only | Stable function, no count lock — accidental endpoint flip goes unnoticed until the 49-count canary trips. | |

**User's choice:** Determinism + snapshot lock

| Option | Description | Selected |
|--------|-------------|----------|
| Dedup first, then gate | Dedup the opencode + opencode-go rows by id first (Zen row's api.npm wins), then apply the npm gate. Deduped 65-row pool is provider-level truth. | ✓ |
| Gate first, then dedup | npm gate per snapshot row, then dedup — slightly different semantics if Zen/Go rows ever differ in api.npm. | |

**User's choice:** Dedup first, then gate

---

## Claude's Discretion

- PROVIDER_GATES shape extension for the npm-value gate + registry helper naming (per CONVENTIONS.md).
- Registry-driven `providerName()` map shape/location (REG-01) — client-bundle-safe (T-17-09), labels "NousResearch"/"OpenCode".
- Priority-ordered `getProviderForModelId` internal shape (scoped find vs explicit precedence iteration).
- Save-validation reason codes for union-wide checks (REG-07).

## Deferred Ideas

- `endpoint` derived field + `· Zen` / `· Go` captions — SET-03, Phase 26.
- `supportsStructuredOutputs` flip gating — RUN-06, Phase 25.
- Npm-gate auto-servable growth review — tripped by the count-stability canary at Phase 24's refresh.
