# Project Research Summary

**Project:** ArcLumen 360
**Domain:** Custom structured-research agent constructors integrated with a durable, reviewed ICP analysis pipeline
**Researched:** 2026-08-09
**Confidence:** HIGH

## Executive Summary

The Exa Agent Playground/API model supports a useful constructor shape: a reusable natural-language query/behavior configuration, optional data-source capabilities, a bounded structured-output schema, an effort preference, and an asynchronous run lifecycle with grounding/citations returned separately. The supplied Playground URL redirected to Exa login, so its visual controls could not be inspected; its encoded configuration nevertheless exposed a query, `_exampleRunId`, `dataSources` (`similarweb`, `financial_datasets`), and nested `outputSchema` with required fields and a bounded `recentHeadlines` array (`maxItems: 5`).

For ArcLumen v1.8, these findings should inform the constructor contract without importing Exa or changing v1.7's execution model. Custom agents should be named, target-scoped, Practice Area-scoped, instruction-driven, effort-bounded, versioned, and lifecycle-managed at `/agents`; the server should resolve capabilities and snapshot configuration into the existing durable run/evidence/review/candidate pipeline.

The primary risk is confusing constructor flexibility with permission to author execution policy. Immutable versions, server-side compatibility/schema validation, bounded outputs, server-owned research capabilities, fail-closed evidence handling, and unchanged confirmed-only review boundaries are the required mitigations.

## Key Findings

### Recommended Stack

Keep the existing Next.js App Router, Clerk gate, Neon/Drizzle schema, v1.7 durable executor, modelFactory, Firecrawl, Vitest, and Playwright seams. No new package or provider is needed for the planning scope. Exa is a conceptual reference and official documentation source only; v1.7's no-new-provider decision remains locked.

**Core technologies:**
- Existing Next.js/Clerk surface: canonical `/agents` management and server-derived actor identity.
- Existing Neon/Drizzle model: stable agent identity, immutable versions, lifecycle, and run snapshots.
- Existing v1.7 executor/evidence/review pipeline: durable execution, source grounding, one whole-run decision, and confirmed-only candidates.

### Expected Features

**Must have (table stakes):**
- Create and edit custom agents with the approved baseline fields.
- Immutable version-on-save history and lifecycle controls.
- Server-side validation for target, Practice Area, effort, schema, limits, and execution compatibility.
- Existing v1.7 run, evidence, review, candidate, security, and E2E compatibility.

**Should have (competitive):**
- Signal-aware configuration that resolves active target/Practice Area signals into each run snapshot.
- Bounded structured outputs with behavior instructions separated from output shape.
- Clear provenance linking agent identity/version to findings and review decisions.

**Defer (v2+):**
- Bulk/scheduled execution, per-finding curation, auto-confirmation, new providers, outreach/CRM, Hypotheses, and Persona Discovery.
- Rich unrestricted schema/tool/provider builders.

### Architecture Approach

Use `/agents` as the management boundary over a stable agent identity plus append-only versions. A Server Action validates and normalizes fields before activation; launching resolves the compatible current version and snapshots it with target input, active signals, effort, model chain, and policy. The existing v1.7 executor then produces the same immutable evidence packet, whole-run review item, and confirmed-only candidate projection.

**Major components:**
1. `/agents` editor/history/lifecycle UI — manage custom definitions without adding `/reviews/agents`.
2. Definition/version/compatibility boundary — validate and freeze configuration before execution.
3. Existing run/evidence/review/candidate core — preserve v1.7 trust semantics and backward compatibility.

### Critical Pitfalls

1. **Mutable versions** — append versions and snapshot exact configuration at run creation.
2. **Unbounded schemas/arrays** — require shallow, bounded, essential output configuration.
3. **Provider/tool escape hatches** — keep capabilities server-owned; do not add Exa or arbitrary provider selection.
4. **Review/no-write bypass** — route custom runs through v1.7 whole-run review and confirmed-only SQL projections.
5. **Prompt/schema injection** — validate user-authored text and prove fail-closed adversarial behavior with unchanged live rows.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 37: Custom Agent Definition, Versioning & Lifecycle
**Rationale:** Identity, editable configuration, immutable history, and lifecycle are prerequisites for every runnable custom agent.
**Delivers:** Custom agent creation/editing at `/agents`, current/history reads, append-only versions, activate/retire/reactivate semantics, and management validation.
**Addresses:** Creation, editable configuration, immutable versioning, lifecycle, and management UX.
**Avoids:** Mutable history, accidental fixed-template corruption, and ambiguous lifecycle state.

### Phase 38: Execution Compatibility & Safe Integration
**Rationale:** A custom definition must be proven compatible before it can enter the existing run pipeline.
**Delivers:** Target/Practice Area/signal/checklist/effort/schema/capability validation, immutable run snapshots, backward-compatible fixed-template execution, and existing evidence/review/candidate integration.
**Uses:** Existing v1.7 run ledger, executor, modelFactory, Firecrawl, packet validation, and confirmed-only projection.
**Implements:** Definition-to-run snapshot boundary and server-owned capability resolution.

### Phase 39: Security, Review Boundaries & End-to-End Verification
**Rationale:** Constructor flexibility creates new adversarial and regression surfaces that need an explicit final gate.
**Delivers:** Prompt/schema/tool-policy resistance, duplicate-run/recovery checks, no-live-write row-diff evidence, review idempotency, confirmed-only aggregation, authenticated `/agents` UX, and Company/Persona E2E.
**Uses:** Existing deterministic fixture, Workflow, Vitest, and Clerk-authenticated Playwright harnesses; external provider smoke remains non-gating unless separately approved.

### Phase Ordering Rationale

- Definition/version identity must exist before run compatibility can snapshot it.
- Compatibility validation must precede execution integration so invalid custom agents cannot enter the durable executor.
- Security/review/E2E verification comes last because it spans management, runtime, evidence, review, and both target flows.
- The roadmap preserves v1.7's fixed-template behavior as a regression contract rather than reopening its locked decisions.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 37:** Existing schema/current-version shape and migration strategy for custom identity without changing fixed-template keys.
- **Phase 38:** Exact boundary between configurable output shape and the existing normalized evidence packet; schema policy details.
- **Phase 39:** Fixture and row-hash strategy for proving no live Signal/Offering/link writes under adversarial and review paths.

Phases with standard patterns (skip research-phase):
- None; each phase crosses a high-trust existing boundary and should validate against the v1.7 artifacts before implementation.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Existing repository stack and official Exa docs agree on the no-new-package conceptual approach. |
| Features | HIGH | User-approved scope plus official async/structured-output model; Playground visuals unavailable behind login. |
| Architecture | HIGH | Fits v1.7's existing immutable snapshot, durable executor, evidence, review, and candidate contracts. |
| Pitfalls | HIGH | Directly grounded in official schema/grounding/lifecycle behavior and v1.7's locked trust boundaries. |

**Overall confidence:** HIGH

### Gaps to Address

- **Exact configurable output-schema surface:** Decide during Phase 37/38 planning how much structured shape is exposed; keep it bounded and separate from evidence fields.
- **Custom agent identity/ownership semantics:** Define whether all staff share custom agents, and how fixed keys remain distinct, before schema planning.
- **Capability catalog:** Define the server-owned set of allowed research capabilities without exposing provider internals.
- **Playground UI details:** The supplied URL requires login; use the API documentation and approved product scope, not guessed visual controls.

## Sources

### Primary (HIGH confidence)
- [Exa Agent API guide](https://exa.ai/docs/reference/agent-api-guide) — structured outputs, grounding, data sources, effort, bounded arrays, async lifecycle.
- [Exa Create a Run](https://exa.ai/docs/reference/agent-api/create-a-run) — request schema, output schema, data sources, lifecycle events, statuses, errors, and limits.
- [Exa Agent overview](https://exa.ai/docs/reference/agent-api/overview) — asynchronous/resumable run model, output grounding, nullable unsupported fields, effort.
- [Exa Connect overview](https://exa.ai/docs/reference/agent-api/connect/overview) — provider-specific tool selection and separate grounded sources.

### Secondary (MEDIUM confidence)
- Exa Agent Playground URL supplied in the milestone brief — encoded reusable configuration observed, but visual controls redirected to login.
- v1.7 Phase 36 context and verification artifacts — existing route, lifecycle, immutable version, evidence, review, security, and E2E constraints.

### Tertiary (LOW confidence)
- None used.

---
*Research completed: 2026-08-09*
*Ready for roadmap: yes*
