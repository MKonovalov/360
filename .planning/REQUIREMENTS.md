# Requirements: ArcLumen 360

**Defined:** 2026-08-09
**Milestone:** v1.8 Agent Constructor
**Core Value:** Fast, shared ICP lookup — anyone on the team can pull up a company or persona and see a complete, trustworthy 360 view with buying signals in seconds.

## Previous Milestone Record

v1.7's fixed Company/Persona template requirements are preserved without being redefined or silently re-marked here. The historical snapshot is `.planning/milestones/v1.7-REQUIREMENTS.md`; Phase 36's implementation/UAT and partial database/Workflow verification remain recorded in `.planning/phases/36-agent-management-end-to-end-verification/`.

## v1.8 Requirements

Requirements for creating and safely managing custom agents from the canonical `/agents` surface.

### Agent Creation and Configuration

- [ ] **AGT-01**: Staff can create a custom agent from `/agents` with a stable identity, name, and description.
- [x] **AGT-02**: Staff can configure a custom agent for exactly one supported target type — Company or Persona — and one Practice Area.
- [x] **AGT-03**: Staff can configure the agent's behavior instruction, supported effort values, and default effort from the server-approved policy.
- [ ] **AGT-04**: The `/agents` surface distinguishes custom agents from the two fixed v1.7 Company and Persona templates without changing the fixed templates' keys, behavior, or launch compatibility.

### Immutable Versioning and Lifecycle

- [ ] **VER-01**: Saving a valid custom-agent configuration appends a new immutable version and makes that version current for future launches.
- [ ] **VER-02**: Historical custom-agent versions are read-only and remain inspectable with their configuration, actor, and timestamp; no save edits or deletes a prior version.
- [ ] **VER-03**: A run snapshots the selected custom-agent version and resolved configuration before execution, and later edits never change that run, result, evidence, or review packet.
- [ ] **LIFE-01**: Staff can activate, retire, and reactivate a custom agent; retirement blocks future launches while preserving versions, runs, results, and review history, and reactivation uses the latest immutable version.

### Validation and Execution Compatibility

- [x] **VAL-01**: Server-side validation rejects missing, malformed, oversized, or unsupported custom-agent fields before a version can become current or runnable.
- [ ] **VAL-02**: The system rejects a run when a custom agent's target type is incompatible with the selected Company or Persona record, before creating an active run.
- [ ] **VAL-03**: A runnable custom agent resolves only active Signals for its configured target type and Practice Area, and the resolved checklist/schema is snapshotted with the run.
- [ ] **VAL-04**: Effort, execution limits, model-chain resolution, research capabilities, and tool/provider access remain server-owned and compatible with the existing v1.7 executor; staff-authored configuration cannot select arbitrary providers or tools.
- [ ] **VAL-05**: If a custom agent exposes structured output configuration, the system keeps behavior instructions separate from output shape and accepts only a shallow, bounded, essential-field schema; grounding/evidence remains a server-owned output channel.
- [ ] **RUN-01**: An active, valid custom agent can execute through the existing durable v1.7 run path for its compatible target without adding Exa or another research provider.
- [ ] **RUN-02**: Duplicate active-run prevention, bounded retries/tool calls/time/spend, safe failure audit, and lifecycle recovery apply equally to custom agents and the two fixed templates.

### Security, Review, and Candidate Boundaries

- [ ] **SAFE-01**: Custom-agent instructions, structured configuration, research output, citations, and tools are validated against the existing fail-closed prompt-injection, unsafe-citation, unsupported-source, duplicate-evidence, and forbidden-write policies.
- [ ] **SAFE-02**: Every successfully completed custom-agent run enters the existing one whole-run review contract; Confirm/Dismiss is attributable, idempotent, and cannot write live Signals or signal-offering links.
- [ ] **SAFE-03**: Company and Persona candidate-offering views include custom-agent findings only after Confirmed review and retain run/version/finding/source provenance; pending, failed, cancelled, and dismissed runs are excluded.

### Staff Experience and End-to-End Verification

- [ ] **UX-01**: Authenticated staff can create, edit, inspect current/history versions, activate/retire/reactivate, and understand validation failures from `/agents` without a `/reviews/agents` route.
- [ ] **UX-02**: Automated verification covers custom-agent contracts, immutable versioning, lifecycle recovery, target/Practice Area compatibility, bounded schema policy, duplicate-run protection, and backward compatibility of both fixed v1.7 templates.
- [ ] **UX-03**: Authenticated Company and Persona E2E flows prove custom-agent preview/launch, durable status after navigation or reload, settled result/source inspection, one whole-run decision, and confirmed-only candidate visibility.
- [ ] **E2E-01**: The final verification gate proves server-derived actor authorization, adversarial fail-closed behavior, no-live-write invariants, review idempotency, confirmed-only aggregation, and the canonical `/agents` route plus both target flows.

## Future Requirements

Deferred beyond v1.8; these are acknowledged but not in the current roadmap.

### Constructor Expansion

- **FUT-01**: Staff can clone/fork custom agents or versions with explicit ownership and provenance semantics.
- **FUT-02**: Staff can author richer nested output schemas after the bounded v1.8 contract is proven.
- **FUT-03**: Staff can select additional server-approved data-source presets after policy and capability governance exists.

### Analysis Operations and Downstream Actions

- **FUT-04**: Staff can run custom agents in bulk.
- **FUT-05**: Staff can schedule or automatically rerun custom agents.
- **FUT-06**: Staff can curate individual findings or auto-confirm trusted runs.
- **FUT-07**: Confirmed research can initiate reviewed outreach or CRM workflows.
- **FUT-08**: Hypotheses can consume confirmed custom-agent findings.
- **FUT-09**: Persona Discovery can create new Persona records through custom agents.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Bulk execution | Cost, concurrency, review-volume, and partial-failure controls are not part of the first custom-agent constructor. |
| Scheduled or automatic execution | Freshness, notification, cost, and cancellation semantics require a separate milestone. |
| Per-finding curation | v1.7's one whole-run human decision remains the trust boundary. |
| Auto-confirmation or direct agent writes | Custom agents must never bypass review or write live Signals/links directly. |
| New providers, including Exa | v1.7 locks execution to the in-house modelFactory and Firecrawl contract; Exa research informed shape only. |
| Arbitrary provider/tool/data-source selection | Capabilities remain server-owned for security, cost, and policy control. |
| Outreach or CRM sync | Downstream action follows scoring and reviewed activation, not constructor creation. |
| Hypotheses | Explicitly deferred consumer of confirmed findings. |
| Persona Discovery | Requires separate matching, consent, and record-creation semantics. |
| Editing or deleting historical versions/runs/evidence | Reproducibility and auditability require immutable history. |
| `/reviews/agents` | `/agents` is the canonical management surface. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AGT-01 | Phase 37 | Pending |
| AGT-02 | Phase 37 | Complete |
| AGT-03 | Phase 37 | Complete |
| AGT-04 | Phase 37 | Pending |
| VER-01 | Phase 37 | Pending |
| VER-02 | Phase 37 | Pending |
| VER-03 | Phase 38 | Pending |
| LIFE-01 | Phase 37 | Pending |
| VAL-01 | Phase 37 | Complete |
| VAL-02 | Phase 38 | Pending |
| VAL-03 | Phase 38 | Pending |
| VAL-04 | Phase 38 | Pending |
| VAL-05 | Phase 38 | Pending |
| RUN-01 | Phase 38 | Pending |
| RUN-02 | Phase 38 | Pending |
| SAFE-01 | Phase 39 | Pending |
| SAFE-02 | Phase 39 | Pending |
| SAFE-03 | Phase 39 | Pending |
| UX-01 | Phase 37 | Pending |
| UX-02 | Phase 39 | Pending |
| UX-03 | Phase 39 | Pending |
| E2E-01 | Phase 39 | Pending |

**Coverage:**
- v1.8 requirements: 22 total
- Mapped to phases: 22
- Unmapped: 0 ✓

---
*Requirements defined: 2026-08-09*
*Last updated: 2026-08-09 after v1.8 research-first milestone definition*
