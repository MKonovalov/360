# Phase 15: Model Registry Foundation + Persistence - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-02
**Phase:** 15-model-registry-foundation-persistence
**Areas discussed:** Migration apply flow, Allowlist roster scope, Schema shape details, Catalog snapshot design

---

## Migration Apply Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Keep push | schema.ts stays the source of truth, applied with drizzle-kit push. Zero process change — matches how every existing table was created. Fits single-dev, internal tool, seed-data DB: nothing to roll back that a re-seed doesn't fix. | ✓ |
| Adopt generate+commit | First migration snapshots the existing schema, then user_model_settings + agent_run columns land as real migration files applied at deploy. Standard practice, enables future CI/multi-dev. Cost: new workflow + a deploy-time apply step. | |
| Hybrid push+commit | push for local dev, committed migrations only for production deploys. Middle ground — likely overkill for a one-developer internal tool, but keeps a prod trail. | |

**User's choice:** Keep push
**Notes:** `drizzle/meta/_journal.json` empty is a statement of how the repo works, not debt. `db:push` npm script left to Claude's discretion.

---

## Allowlist Roster Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Single model now | Ship only claude-sonnet-4-6 (roster-verified). The catalog mechanism + filter functions land tested; the roster grows later. Zero verification work, zero maintenance risk. | |
| Curated small roster | Phase 15 re-verifies a small set against GET /v1/models and ships them verified. Phase 17's picker has real choices immediately; each addition is a standing maintenance commitment. | ✓ |
| Decide in Phase 17 | Ship the mechanism with a placeholder roster of 1, decide the actual model set during Phase 17 planning. | |

**User's choice:** Curated small roster
**Notes:** Follow-up multi-select: user picked **Sonnet (current)** + **Haiku 4.5**. Opus 4.5 and Sonnet 4.5 (prior gen) explicitly declined. Roster = `claude-sonnet-4-6` + `claude-haiku-4-5`, both roster-verified in Phase 15.

---

## Schema Shape Details

| Option | Description | Selected |
|--------|-------------|----------|
| text[] | Drizzle text('fallback_models').array() — honest Postgres shape for a homogeneous string list, direct string[] typing, no JSON casting. Research's recommendation. First text[] column in the repo, but the correct tool for an ordered list of model IDs. | ✓ |
| jsonb | jsonb column like usageTokens/evidenceAppendix — matches existing repo precedent for list-shaped data, but requires $type<> casting or manual validation to get string[] out. | |
| Claude decides | No opinion — let the planner/researcher pick per the research recommendation. | |

**User's choice:** text[]
**Notes:** Resolves research conflict #5. Intentional first array column.

**Follow-up question — model_chain content:**

| Option | Description | Selected |
|--------|-------------|----------|
| Resolved ID list | model_chain jsonb stores the resolved ID list snapshot at run start alongside model_used text for which one served. Matches REG-04's 'resolved chain' wording; attempts detail lives in Langfuse spans. | ✓ |
| Attempts detail | model_chain jsonb stores richer [{model, status, reason}] per attempt. Self-contained audit — DB alone tells the full failover story without Langfuse. | |
| Claude decides | No opinion — let the planner decide. | |

**User's choice:** Resolved ID list
**Notes:** `model_used` + `model_chain` answer "which model ran" from the DB alone (D-14); attempts detail stays in Langfuse.

**Follow-up question — timestamps/versioning:**

| Option | Description | Selected |
|--------|-------------|----------|
| updatedAt only | updatedAt timestamp (defaultNow, overwritten on each upsert). Enables 'last saved' display and the mid-run-edit story. Skip version — atomic full-value upsert already makes lost updates impossible. | ✓ |
| updatedAt + version | Adds an optimistic-concurrency hook for future multi-tab/multi-device edit-conflict UI. Cheap now, but no consumer exists yet in v1.3. | |
| Claude decides | No opinion — let the planner decide. | |

**User's choice:** updatedAt only
**Notes:** Version guard deferred — no consumer in v1.3.

---

## Catalog Snapshot Design

| Option | Description | Selected |
|--------|-------------|----------|
| Code constant | A hand-curated, reviewed constant in src/lib/models/ — explicit array of verified raw provider IDs. Independent of whatever opencode reports. Adding a model = code change + deploy + roster re-verify. Matches 'allowlist is truth'. | ✓ |
| Generated into snapshot | The fetch script emits the allowlist into the snapshot file, regenerated with each models:fetch. One file to ship, but curating becomes editing generated output. | |
| Claude decides | No opinion — let the planner decide. | |

**User's choice:** Code constant
**Notes:** Snapshot is a menu; allowlist is the gate (Pitfall 1/7).

**Follow-up question — snapshot provider scope:**

| Option | Description | Selected |
|--------|-------------|----------|
| All providers, trimmed | Trim full opencode output (~1,130 entries) to UI-needed fields for ALL providers. Keeps multi-provider growth path; CAT-03's filter stays meaningful. ~100-200KB committed file, server-side only. | ✓ |
| Anthropic-only | Fetch only anthropic/* entries (~69). Tiny committed file, simplest filter, but adding a second provider later requires changing the fetch script. | |
| Claude decides | No opinion — let the planner decide. | |

**User's choice:** All providers, trimmed
**Notes:** Growth path (MRG-02) preserved without a snapshot-format change.

---

## Claude's Discretion

- Snapshot file path + module naming (research conflict #7): `src/data/opencode-models.json` vs `src/lib/models/catalog.json`, `registry.ts` vs `modelConfig.ts`
- Filter-function names/signatures (`opencodeSlugToModelId`, allowlist filter, degradation helper)
- `db:push` npm script nicety; `generatedAt` snapshot field; exact trimmed field set
- Everything marked "Claude decides" above (none selected by user, but discretion noted where offered)

## Deferred Ideas

- Opus 4.5 roster entry (declined for v1.3)
- Sonnet 4.5 prior-gen (declined)
- Version guard column on user_model_settings
- Per-attempt detail in agent_run.model_chain (Langfuse spans cover it)
- MRG-01..04 future requirements (already in REQUIREMENTS.md)
