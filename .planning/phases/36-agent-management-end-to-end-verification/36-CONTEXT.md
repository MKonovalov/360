# Phase 36: Agent Management & End-to-End Verification - Context

**Gathered:** 2026-08-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the small `Manage > Reviews > Agents` experience for the two fixed GBS
analysis templates, and prove the complete v1.7 workflow against its durability,
grounding, security, review, and confirmed-candidate boundaries.

This phase owns UX-03: viewing/editing template instruction and default effort,
creating immutable versions on save, and activating or retiring templates. It
also owns VER-01: automated lifecycle/recovery, grounding, adversarial,
duplicate-run, review-idempotency, and aggregation verification plus
authenticated Company and Persona end-to-end browser flows.

The phase does not add templates, dynamic agent construction, an EXA-style
builder, per-finding curation, bulk/scheduled analysis, auto-confirmation,
provider/model controls in the run flow, direct Signal or Offering writes, or a
new research provider. The two fixed target-scoped templates and the existing
one-decision-per-run review boundary remain unchanged.

</domain>

<decisions>
## Implementation Decisions

### Template Versioning and Lifecycle

- **D-36-01:** The system continues to manage exactly two fixed templates:
  Company Buying Signal Analysis and Persona Buying Signal Analysis. Template
  name, target type, supported effort set, and execution budget are not editable
  in this phase.
- **D-36-02:** Saving an instruction or default-effort edit always creates the
  next immutable template version. The new version becomes the current version
  for future runs immediately.
- **D-36-03:** Existing runs retain their immutable template-version snapshot;
  editing, activating, or retiring a template never changes an existing run,
  result packet, finding, source, or review item.
- **D-36-04:** Version history is visible read-only. Historical versions cannot
  be edited or deleted; the management UI must make the current version and
  prior versions distinguishable.
- **D-36-05:** Activate/retire is a template-level lifecycle action. Retiring a
  template blocks it from future launches but leaves its history and all
  existing runs inspectable. Retiring the only active template for a target
  type is allowed; that target then has no runnable template until reactivation.
- **D-36-06:** Reactivation makes the template available again using its current
  latest immutable version. Lifecycle changes do not create a new content
  version unless instruction or default effort is also changed.

### Management UI Placement

- **D-36-07:** Agents is a dedicated screen at `/agents`, linked as
  `Agents` directly beneath `Manage` (not under Reviews).
- **D-36-08:** The screen shows the two template rows/cards, with edit and
  activate/retire actions and read-only version history. It is a management
  surface, not a template-construction playground.
- **D-36-09:** The existing run flow remains target-scoped and does not regain a
  template picker. Company records resolve to the Company template and Persona
  records resolve to the Persona template, as locked in Phase 35.

### Verification Boundary and Evidence

- **D-36-10:** Verification uses a hybrid strategy. Automated DB/workflow/
  security tests use deterministic fixtures; authenticated Playwright tests run
  against the real application and database with a deterministic test executor
  and fixture packet.
- **D-36-11:** The live browser proof covers both target flows: preview of the
  resolved instruction/checklist/effort, launch, durable status after
  navigation or reload, settled result and source inspection, the existing
  whole-run review surface, one attributable terminal decision, and
  confirmed-only candidate visibility.
- **D-36-12:** Real model-provider or Firecrawl smoke is optional and
  non-gating. It may be recorded when approved policy and credentials are
  available, but Phase 36 cannot require external account credit or policy
  approval to pass.
- **D-36-13:** Automated verification must prove lifecycle claim/recovery and
  safe terminal failure, duplicate active-run prevention, source-grounded
  finding persistence, one-winner review idempotency, and confirmed-only
  aggregation for both Company and Persona contracts. It must also prove that
  Confirm/Dismiss never writes live Signals or signal-offering links.

### Adversarial Verification

- **D-36-14:** Adversarial coverage is automated fixture coverage only, not a
  separate browser demonstration. Fixtures include malicious prompt-injection
  content, unsafe citations, unsupported URLs, duplicate evidence, and
  forbidden write/tool attempts.
- **D-36-15:** Each adversarial case must fail closed, preserve safe audit/error
  state, and prove that live Signal and signal-offering rows remain unchanged.
  A URL alone, an untrusted citation, or a tool attempt outside the allowlisted
  research boundary is never accepted as proof.

### Claude's Discretion

- Exact query/action/component names and how the `/reviews/agents` route is
  composed from existing Reviews and Settings-style patterns.
- Whether the two template rows use a table, cards, or the established page
  list primitive, provided the required edit/lifecycle/history operations and
  target labels are clear.
- Deterministic fixture identifiers, test executor seam, packet contents,
  browser seed/reset mechanics, and exact Playwright test partitioning.
- Exact lifecycle-history assertions and polling/reload timing, provided the
  verification strategy above is covered without requiring a live provider.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and Phase Scope

- `.planning/REQUIREMENTS.md` — UX-03 and VER-01; fixed-template, review, and
  out-of-scope constraints
- `.planning/ROADMAP.md` — Phase 36 goal and success criteria
- `.planning/STATE.md` — accumulated v1.7 decisions and current verification
  constraints

### Prior Phase Decisions

- `.planning/phases/35-company-persona-analysis-experiences/35-CONTEXT.md` —
  fixed target-scoped templates, no run-flow picker, record UX, and result/
  candidate display patterns
- `.planning/phases/34-whole-run-review-confirmed-candidates/34-CONTEXT.md` —
  one whole-run Confirm/Dismiss decision, packet-bound review identity,
  confirmed-only candidate projection, and no live Signal/Offering writes
- `.planning/phases/33-grounded-analysis-execution-evidence/33-CONTEXT.md` —
  modelFactory/Firecrawl boundary, immutable evidence packet, strict evidence
  identity, fail-closed safety policy, and deferred live-provider execution
- `.planning/phases/32-template-snapshot-run-ledger/32-CONTEXT.md` — template,
  snapshot, run-ledger, lifecycle, and duplicate-active-run contracts

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `src/lib/db/queries/analysisTemplates.ts` — existing active-template and
  template-version reads; Phase 36 can extend this query boundary for current
  version/history and lifecycle management.
- `src/scripts/seedAnalysisTemplates.ts` — canonical two-template seed,
  immutable version-1 shape, supported efforts, default effort, and budget
  invariants to preserve.
- `src/components/reviews/run-review-section.tsx` and
  `src/components/reviews/run-review-card.tsx` — shared run-level review
  rendering and the existing whole-run decision surface.
- `src/components/analysis/analysis-history.tsx` and
  `src/components/analysis/confirmed-candidate-offerings.tsx` — target-record
  history, settled result, source/provenance, and confirmed-candidate views
  delivered by Phase 35.

### Established Patterns

- Staff-only pages and actions use the existing Clerk gate and server-derived
  actor identity; management mutations must follow the same gate-first pattern.
- Template and run data are immutable snapshots. Mutable management changes
  affect only future launches; all existing run/review/packet reads remain
  inspectable.
- Reviews is additive: the v1.7 run-level review section is separate from the
  legacy proposal queue. Agents management must not reuse legacy proposal
  Accept/Reject semantics.
- Neon persistence uses the proven HTTP-safe atomic query/CTE approach rather
  than interactive transaction callbacks.
- Verification has a Vitest fixture harness and an authenticated Playwright
  setup. Deterministic fixtures are the required proof path when external
  providers or policy approvals are unavailable.

### Integration Points

- Navigation and route wiring for `/reviews/agents` under the Manage → Reviews
  group, including collapsed-rail and active-route behavior.
- Analysis-template schema/query/action layer for current-version reads,
  immutable version insertion, and template lifecycle transitions.
- Phase 35 launch/preview data and target pages, which must continue to resolve
  only the compatible fixed template.
- Shared Reviews and target-record history/candidate components, which must
  continue to display the same packet, provenance, and decision identity.
- Existing workflow/run-ledger, evidence validation, review decision, and
  confirmed-candidate query/test seams for the VER-01 automated gate.

</code_context>

<specifics>
## Specific Ideas

- The management route is explicitly `/reviews/agents`, not an assumed Settings
  page or an EXA-style playground.
- The live browser proof is intentionally realistic at the app/database/auth
  boundary while using deterministic execution data; provider/Firecrawl live
  calls are not the pass/fail dependency.
- Adversarial verification should be reproducible and automated, with database
  invariants proving that unsafe research cannot mutate live Signals or
  signal-offering links.

</specifics>

<deferred>
## Deferred Ideas

- Real provider/Firecrawl smoke as a required gate remains deferred until named
  policy approval and usable external credentials/account credit exist. Optional
  evidence may still be recorded without changing the Phase 36 pass criteria.
- Dynamic agent construction, configurable schemas, bulk/scheduled analysis,
  per-finding curation, auto-confirmation, outreach, CRM, and Hypotheses remain
  outside v1.7 and are not reopened by this phase.

</deferred>

---

*Phase: 36-agent-management-end-to-end-verification*
*Context gathered: 2026-08-08*
