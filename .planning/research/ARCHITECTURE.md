# Architecture Research

**Domain:** Custom structured-research agent constructors integrated with an existing durable run/review system
**Researched:** 2026-08-09
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Staff Management UI                     │
├─────────────────────────────────────────────────────────────┤
│  /agents constructor  │ Company/Persona preview + launch    │
│  config editor/history│ existing run/review experiences    │
└──────────────┬────────┴──────────────────┬──────────────────┘
               │ authenticated actions     │ target-scoped run
┌──────────────┴──────────────────────────┴──────────────────┐
│              Definition and Compatibility Boundary           │
├─────────────────────────────────────────────────────────────┤
│ normalize/validate │ lifecycle │ capability/schema policy   │
│ version append     │ snapshot  │ target + Practice Area     │
└──────────────┬──────────────────────────┬──────────────────┘
               │ immutable version/run     │ resolved snapshot
┌──────────────┴──────────────────────────┴──────────────────┐
│                  Existing v1.7 Execution Core                │
├─────────────────────────────────────────────────────────────┤
│ durable executor → modelFactory/Firecrawl → evidence packet │
│                         ↓                                    │
│ whole-run review → confirmed-only candidate projection       │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `/agents` management surface | Create, edit, inspect history, and change lifecycle | Staff-gated Server Components and Server Actions following v1.7 patterns. |
| Agent definition boundary | Normalize fields, validate compatibility, and reject unsafe configuration | Server-owned schemas and allowlists; client validation is advisory only. |
| Immutable version store | Preserve current and historical configuration | Append-only version rows with stable agent identity and current-version pointer. |
| Run snapshot boundary | Freeze agent version and resolved inputs before execution | Reuse v1.7 run snapshot semantics for target, signals, effort, model chain, and policy. |
| Existing executor/evidence core | Execute, persist grounded findings, and retain safe audit state | No new provider; reuse modelFactory, Firecrawl, packet validation, and durable workflow. |
| Existing review/candidate projections | Apply one decision and expose only confirmed evidence | Preserve v1.7 review identity, no-live-write, and SQL-level confirmed-only predicates. |

## Recommended Project Structure

```
src/
├── app/
│   ├── (dashboard)/agents/       # canonical constructor/management route
│   └── ...                       # existing Company/Persona/run routes
├── components/
│   ├── agents/                   # editor, history, lifecycle, validation UI
│   └── analysis/                 # existing preview/history/result surfaces
├── lib/
│   ├── db/queries/               # agent definitions, versions, snapshots
│   ├── validation/               # config/schema/capability boundaries
│   └── ...                       # existing run/evidence/review seams
└── scripts/                      # deterministic fixture/scope verification
```

### Structure Rationale

- **`/agents`:** Keeps the user-facing management surface canonical and avoids the explicitly rejected `/reviews/agents` route.
- **Definition/validation boundaries:** Prevent constructor flexibility from leaking into execution or client-only assumptions.
- **Existing analysis/review modules:** Custom agents should feed the v1.7 pipeline rather than fork its packet, review, or candidate semantics.

## Architectural Patterns

### Pattern 1: Immutable definition + append-only version

**What:** Stable agent identity owns lifecycle/current-version metadata; each content/configuration save appends a new version.
**When to use:** Any configuration that can affect asynchronous work or audit evidence.
**Trade-offs:** More rows and explicit current-version reads, but reproducibility and safe history are stronger than in-place updates.

### Pattern 2: Behavior/schema separation

**What:** Store natural-language behavior instructions separately from structured output-shape configuration.
**When to use:** Any constructor that combines prompts with normalized structured results.
**Trade-offs:** More explicit fields and validation, but fewer accidental prompt/schema interactions and safer evolution.

Exa's Agent API models `systemPrompt`/query separately from `outputSchema`, while `output.grounding` is returned as a separate evidence channel. See [Create a Run](https://exa.ai/docs/reference/agent-api/create-a-run) and [Agent overview](https://exa.ai/docs/reference/agent-api/overview).

### Pattern 3: Server-owned capability resolution

**What:** The agent definition requests a supported capability; the server resolves allowed sources/tools/executor behavior.
**When to use:** Multi-source research with security, cost, and provider boundaries.
**Trade-offs:** Less arbitrary flexibility, but deterministic policy enforcement and simpler audits.

Exa Connect documents provider selection by `dataSources`, with the agent choosing partner tools from provider-specific descriptions and output requirements; sources remain separate grounded output. See [Connect overview](https://exa.ai/docs/reference/agent-api/connect/overview).

## Data Flow

### Request Flow

```
[Staff saves custom agent]
    ↓
[/agents Server Action] → [auth + normalize + validate] → [append version/current pointer]
    ↓                                                        ↓
[preview/launch] ← [compatible active version] ← [read current version]
    ↓
[v1.7 run snapshot] → [durable executor] → [packet/evidence] → [review] → [confirmed candidates]
```

### State Management

```
[Agent identity/current lifecycle]
             ↓
[Read-only version history] ← [append version action]
             ↓
[Immutable run snapshot] → [immutable result/review packet]
```

### Key Data Flows

1. **Create/edit:** authenticated staff input is normalized and validated; valid saves append a version without changing historical versions.
2. **Launch:** target-scoped compatible active version resolves active signals and execution policy, then snapshots every mutable input before the executor runs.
3. **Review:** completed evidence enters the existing one-decision review path; only confirmed findings can reach candidate offerings.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k users | Keep the existing monolith, relational queries, append-only versions, and durable executor. |
| 1k-100k users | Index stable agent identity/current version, lifecycle, target type, Practice Area, and run snapshot lookups; keep execution async. |
| 100k+ users | Consider dedicated execution/queue capacity and archival policy only after actual run volume justifies it. |

### Scaling Priorities

1. **First bottleneck:** research execution and evidence persistence; preserve bounded attempts/cost and durable recovery.
2. **Second bottleneck:** version/history and run-list reads; add targeted indexes/pagination without changing immutable semantics.

## Anti-Patterns

### Anti-Pattern 1: Mutable current configuration inside a run

**What people do:** Read the agent's current row repeatedly during execution.
**Why it's wrong:** A mid-run edit changes behavior and invalidates audit/replay semantics.
**Do this instead:** Resolve and snapshot the exact version/configuration at run creation.

### Anti-Pattern 2: Treating output schema as an evidence contract

**What people do:** Let users author arbitrary source/citation fields and trust them as proof.
**Why it's wrong:** A URL or user-authored field does not establish supported, persisted evidence.
**Do this instead:** Keep evidence source identity and grounding in the server-owned packet/evidence model.

### Anti-Pattern 3: Forking custom-agent review semantics

**What people do:** Add custom per-finding approvals or direct writes for new agent outputs.
**Why it's wrong:** It silently changes the v1.7 trust boundary.
**Do this instead:** Route every completed run through the existing whole-run review and confirmed-only projection.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Existing model providers | Existing modelFactory contract | No provider/model selection exposed in the v1.8 constructor. |
| Firecrawl | Existing bounded research seam | Keep source validation and prompt/tool policy fail-closed. |
| Exa Agent/Connect docs | Research reference only | The milestone does not add Exa; findings inform constructor shape and guardrails. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|----------------|-------|
| `/agents` ↔ definition queries/actions | Server Actions | Gate first; actor identity is server-derived. |
| Definition/version ↔ run ledger | Snapshot at creation | No mutable reads after snapshot. |
| Run packet ↔ review/candidates | Existing queries/projections | Whole-run decision and confirmed-only SQL remain authoritative. |

## Sources

- [Exa Agent API guide](https://exa.ai/docs/reference/agent-api-guide)
- [Exa Create a Run](https://exa.ai/docs/reference/agent-api/create-a-run)
- [Exa Agent overview](https://exa.ai/docs/reference/agent-api/overview)
- [Exa Connect overview](https://exa.ai/docs/reference/agent-api/connect/overview)
- Exa Agent Playground URL supplied by the milestone brief; redirected to login and was not used as a source of observable controls.

---
*Architecture research for: custom structured-research agent constructors*
*Researched: 2026-08-09*
