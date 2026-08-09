# Requirements: ArcLumen 360

**Defined:** 2026-08-06
**Milestone:** v1.7 Agent Constructor & Buying Signal Analysis
**Core Value:** Fast, shared ICP lookup — anyone on the team can pull up a company or persona and see a complete, trustworthy 360 view with buying signals in seconds.

## v1.7 Requirements

### Constructor Foundation

- [ ] **CON-01**: Staff can use two active GBS templates: Company Buying Signal Analysis and Persona Buying Signal Analysis.
- [ ] **CON-02**: Each template has a target type, instruction text, supported effort default, lifecycle status, and immutable version history.
- [ ] **CON-03**: A run snapshots its template version, resolved instruction, subject input, active-signal checklist/schema, effort, and resolved model chain before execution.
- [ ] **CON-04**: The system derives each checklist only from active Company or Persona Signals for the selected Practice Area.
- [ ] **CON-05**: Staff can never run a template against an incompatible target type.

### Durable Analysis Execution

- [ ] **RUN-01**: Staff can create one on-demand analysis run that remains visible after navigation or reload.
- [ ] **RUN-02**: Runs persist queued, running, completed, failed, cancelled, Pending Review, Confirmed, and Dismissed states with actor/timestamp audit.
- [ ] **RUN-03**: A Vercel-compatible durable executor is selected and proven able to claim, complete, recover, or safely fail a run independent of the initiating page request.
- [x] **RUN-04**: The executor uses the existing in-house model factory and Firecrawl research tool behind a provider-agnostic contract, without adding Exa.
- [ ] **RUN-05**: The system prevents duplicate active runs and bounds retries, tool calls, execution time, and spend.
- [ ] **RUN-06**: Failed, timed-out, invalid, and successful runs all retain safe error/result audit records.

### Evidence and Findings

- [x] **EVD-01**: Each completed run stores immutable normalized narrative, findings, raw audit output, model/trace provenance, and run timing.
- [x] **EVD-02**: Each finding maps to the run's snapshotted signal identity and exposes strong, weak, no-evidence, or inconclusive status with confidence.
- [x] **EVD-03**: Every material finding references persisted, navigable source evidence with title, canonical URL, retrieved time, and supporting excerpt.
- [x] **EVD-04**: The system rejects unsupported, unsafe, duplicated, or unlinked evidence rather than treating a URL alone as proof.
- [x] **EVD-05**: Persona inputs, output, sources, and telemetry follow a minimum-data, redaction, classification, and retention policy.

### Review and Candidate Offerings

- [x] **REV-01**: Every successfully completed v1.7 analysis creates exactly one run-level review item in the shared Reviews experience.
- [x] **REV-02**: A staff reviewer can Confirm or Dismiss the entire run exactly once; the terminal decision is attributable, idempotent, and preserves the review packet.
- [x] **REV-03**: Confirming or dismissing a run never writes live Signals or signal-offering links.
- [x] **REV-04**: Company and Persona candidate-offering views derive only from Confirmed runs through existing signal-offering links and include run/finding/source provenance.
- [x] **REV-05**: Pending, failed, cancelled, and dismissed runs can never appear in candidate-offering aggregation.

### Staff Experiences and Verification

- [x] **UX-01**: From an eligible Company or Persona record, staff can preview the resolved instruction, selected Practice Area, active-signal checklist, and effort before launching a run.
- [x] **UX-02**: Company and Persona records show run history, current status, result details, sources, and review state; settled results remain inspectable.
- [x] **UX-03**: `Manage > Agents` lets staff view and edit template instructions/default effort, changes versions on save, and activate or retire templates.
- [x] **VER-01**: Automated and live verification cover lifecycle recovery, source-grounded findings, prompt-injection/tool-policy resistance, duplicate-run protection, one-review idempotency, confirmed-only aggregation, and the Company/Persona end-to-end flows.

## Future Requirements

### Analysis Operations

- **OPS-01**: Staff can run buying-signal analysis in bulk for selected Companies or Personas.
- **OPS-02**: Staff can schedule or automatically rerun buying-signal analysis under explicit cost and freshness controls.
- **OPS-03**: Staff can define ad-hoc questions and structured-output schemas for one-off analysis.

### Analysis Review and Activation

- **REV-06**: Staff can approve, dismiss, or correct individual findings within a run.
- **REV-07**: Firm-defined trusted templates can bypass review under explicit governance conditions.
- **HYP-01**: Hypotheses can consume only Confirmed agent findings across a Company and its Personas.
- **OUT-01**: Confirmed research can initiate reviewed outreach or CRM workflows.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Persona Discovery | This milestone analyzes existing Persona records; discovery has separate matching, consent, and review semantics. |
| Bulk, scheduled, or automatic re-analysis | Adds cost, notification, freshness, and review-volume controls before the on-demand workflow is proven. |
| Per-finding curation | v1.7 deliberately uses one human decision for a whole completed run. |
| Auto-confirmation or direct agent writes | Violates the human-review and confirmed-only trust boundary. |
| Hypotheses, scoring, outreach, or CRM sync | These consume v1.7's confirmed evidence later; they are not part of the research-and-review loop. |
| Exa or another external research provider | The locked direction is the existing in-house model factory and Firecrawl stack. |
| Provider/model controls in the run flow | Existing Settings already owns per-user model configuration. |
| Chain-of-thought display | Staff need sources and normalized findings, not private model reasoning. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CON-01 | Phase 32 | Pending |
| CON-02 | Phase 32 | Pending |
| CON-03 | Phase 32 | Pending |
| CON-04 | Phase 32 | Pending |
| CON-05 | Phase 32 | Pending |
| RUN-01 | Phase 32 | Pending |
| RUN-02 | Phase 32 | Pending |
| RUN-03 | Phase 31 | Pending |
| RUN-04 | Phase 33 | Complete |
| RUN-05 | Phase 32 | Pending |
| RUN-06 | Phase 32 | Pending |
| EVD-01 | Phase 33 | Complete |
| EVD-02 | Phase 33 | Complete |
| EVD-03 | Phase 33 | Complete |
| EVD-04 | Phase 33 | Complete |
| EVD-05 | Phase 33 | Complete |
| REV-01 | Phase 34 | Complete |
| REV-02 | Phase 34 | Complete |
| REV-03 | Phase 34 | Complete |
| REV-04 | Phase 34 | Complete |
| REV-05 | Phase 34 | Complete |
| UX-01 | Phase 35 | Complete |
| UX-02 | Phase 35 | Complete |
| UX-03 | Phase 36 | Complete |
| VER-01 | Phase 36 | Complete |

**Coverage:**
- v1.7 requirements: 25 total
- Mapped to phases: 25
- Unmapped: 0

---
*Requirements defined: 2026-08-06*
*Last updated: 2026-08-09 after Phase 36 authenticated acceptance*
