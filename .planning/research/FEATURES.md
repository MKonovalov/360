# Feature Research

**Domain:** Custom structured-research agent constructors
**Researched:** 2026-08-09
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Create a custom agent from `/agents` | The milestone's core user goal | HIGH | Creation must produce a valid definition, not a mutable draft that can run accidentally. |
| Editable configuration | Staff need to adapt behavior to a new research task | MEDIUM | Baseline: name/description, target type, Practice Area, instruction, supported/default effort, lifecycle. |
| Immutable version history | A run must remain reproducible after edits | HIGH | Save appends a version; prior versions are read-only and run snapshots remain unchanged. |
| Lifecycle controls | Staff need to retire unsafe or obsolete agents without deleting history | MEDIUM | Activate, retire, and reactivate are explicit server-authorized transitions. |
| Validation and preview | Staff need to know whether an agent can run before launch | HIGH | Validate target, Practice Area, instruction, effort, active-signal/checklist compatibility, limits, and execution capabilities. |
| Existing run/review compatibility | Custom agents must deliver the same safe product loop | HIGH | Preserve durable status, evidence, one whole-run decision, and confirmed-only candidate boundaries. |
| Authenticated verification | The constructor affects high-trust research output | HIGH | Automated contract/security/DB tests plus authenticated `/agents`, Company, and Persona E2E. |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Source-grounded structured findings | Lets staff compare new agents without weakening trust | HIGH | Grounding/citations remain execution output, not arbitrary user-authored schema fields. |
| Signal-aware configuration | Custom agents remain useful to the ICP workflow rather than becoming generic chat prompts | HIGH | Resolve active signals by target kind and Practice Area at run creation, then snapshot them. |
| Safe constructor constraints | Gives flexibility without exposing provider/tool internals | HIGH | Server-owned capabilities, bounded schema, no direct live writes, and explicit compatibility errors. |
| Reusable version/run provenance | Makes experimentation auditable and reviewable | MEDIUM | Display current version, historical versions, run version, evidence, and review identity together. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|------------|
| Arbitrary provider/tool selection | Feels powerful to advanced users | Bypasses the v1.7 provider-agnostic and security boundaries | Expose only server-owned compatible capabilities. |
| Free-form output schema builder with no limits | Mirrors the flexibility of general agent playgrounds | Unbounded cost, malformed packets, and review complexity | Offer validated, bounded configuration; separate instructions from output shape. |
| Editing a version in place | Seems simpler than append-only history | Makes prior runs impossible to reproduce | Append a new immutable version and make history read-only. |
| Bulk or scheduled custom-agent runs | Increases throughput | Reopens cost, freshness, notification, and review-volume scope | Keep on-demand single-run execution until explicitly promoted. |

## Feature Dependencies

```
Agent identity/configuration
    └──requires──> immutable version + lifecycle
                       └──requires──> server validation/compatibility
                                            └──requires──> v1.7 run snapshot
                                                               └──requires──> existing evidence/review/candidate boundaries

Preview and execution compatibility ──enhances──> constructor UX
Security/no-live-write verification ──guards──> every mutation and run path
```

### Dependency Notes

- **Versioning requires validation:** An invalid configuration must never become the current runnable version.
- **Run compatibility requires a snapshot:** The run must capture the selected agent version and resolved inputs before mutable management changes can occur.
- **Review/candidate compatibility is not optional:** Custom agents are another configuration source for the existing v1.7 workflow, not a second trust model.

## MVP Definition

### Launch With (v1)

- [ ] Create one custom agent from `/agents` with the approved baseline fields — validates the constructor concept.
- [ ] Edit configuration by immutable version append, with read-only history — preserves reproducibility.
- [ ] Activate/retire/reactivate with safe future-run behavior — provides lifecycle control without destructive deletion.
- [ ] Validate target/Practice Area/instruction/effort/schema/capability compatibility — prevents unsafe or unrunnable definitions.
- [ ] Execute through the existing Company/Persona flow with source, review, and confirmed-only compatibility — protects v1.7 trust boundaries.
- [ ] Verify security, lifecycle, review, and both target E2E paths — makes the constructor shippable rather than demo-only.

### Add After Validation (v1.x)

- [ ] A richer bounded output-schema editor — add only after the first constructor proves the validation and review model.
- [ ] Additional server-owned data-source presets — add only with explicit provider/policy approval.
- [ ] Clone/fork from an existing custom version — add after identity and ownership semantics are validated.

### Future Consideration (v2+)

- [ ] Bulk, scheduled, or automatic re-analysis — explicitly deferred by v1.7.
- [ ] Per-finding curation or auto-confirmation — conflicts with the one-decision-per-run trust model.
- [ ] Outreach, CRM, Hypotheses, Persona Discovery, or new research providers — separate milestones.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Create/edit custom agent | HIGH | HIGH | P1 |
| Immutable version/lifecycle | HIGH | HIGH | P1 |
| Validation/execution compatibility | HIGH | HIGH | P1 |
| Review/candidate compatibility | HIGH | HIGH | P1 |
| Security and E2E verification | HIGH | HIGH | P1 |
| Richer schema editor | MEDIUM | HIGH | P2 |
| Clone/fork | MEDIUM | MEDIUM | P2 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | Exa Agent Playground/API | Our Approach |
|---------|--------------------------|--------------|
| Reusable configuration | Playground URL evidence shows encoded query/run configuration; API exposes query, prompt, data sources, effort, and schema | Persist a named, versioned agent definition at `/agents`, constrained to ArcLumen's target and trust model. |
| Structured output | JSON Schema with required fields and bounded arrays; structured output and grounding are returned separately | Keep behavior instructions separate from bounded output configuration; map results into the existing evidence packet. |
| Data-source selection | `dataSources` enables providers and Exa selects matching tools from descriptions/schema | Keep capabilities server-owned and do not add Exa or arbitrary provider selection in v1.8. |
| Run lifecycle | Async queued/running/completed/failed/cancelled with resumable IDs | Reuse v1.7 durable ledger, snapshots, review, and confirmed-only projection. |

## Sources

- [Exa Agent API guide](https://exa.ai/docs/reference/agent-api-guide)
- [Exa Create a Run](https://exa.ai/docs/reference/agent-api/create-a-run)
- [Exa Agent overview](https://exa.ai/docs/reference/agent-api/overview)
- [Exa Connect overview](https://exa.ai/docs/reference/agent-api/connect/overview)
- Exa Agent Playground URL supplied by the user; redirected to login, so controls were not independently observable.

---
*Feature research for: custom structured-research agent constructors*
*Researched: 2026-08-09*
