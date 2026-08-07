# Feature Landscape

**Domain:** Human-reviewed, source-grounded Company and Persona buying-signal analysis
**Researched:** 2026-08-06
**Confidence:** HIGH for product boundaries and existing-system constraints (project record); MEDIUM for general human-review UX patterns (official AI-governance guidance).

## Product Boundary

v1.7 is a **run-and-review decision-support workflow**, not autonomous enrichment. A staff member selects the relevant reusable Company or Persona Buying Signal Analysis template, previews exactly what will be run, chooses an effort level, starts one on-demand analysis, and later reviews its completed, evidence-backed result as one decision. Only a confirmed run may make its candidate offerings visible on the relevant Company or Persona record.

The unit of trust is the immutable completed run: its target, resolved instructions, active-signal checklist, selected effort, source evidence, normalized findings, result, initiating user, timestamps, and later human decision remain connected. This gives the reviewer enough basis to decide without treating model prose as evidence. NIST calls for documented knowledge limits, human-oversight processes, and traceable outputs; its Generative AI profile specifically recommends recording provenance, human oversight roles, and underlying model/access details. [HIGH]

The milestone deliberately uses a single whole-run confirmation/dismissal, not per-finding acceptance. That produces a small, clear control point consistent with the locked direction in `PROJECT.md`; it is not a shortcut toward auto-application. It also means a run is either still pending, confirmed, or dismissed—never partly live.

## Table Stakes

Features staff must experience for the flow to be useful and trustworthy.

| Feature | Why Expected | Complexity | Concrete user-observable requirement |
|---|---|---:|---|
| Reusable agent templates | The Company and Persona analyses need a repeatable, named way to run the same organizational method | Medium | In `Manage > Reviews > Agents`, staff can view the two GBS Buying Signal Analysis templates and their target kind; they do not have to recreate prompts per record. |
| Contextual entry point | Analysis must begin from the Company or Persona being assessed | Low | From an eligible Company or Persona record, staff can open that target's applicable analysis template; unavailable target/template combinations are not offered. |
| Resolved pre-run preview | A reviewer/invoker must know the actual task, not only a template title | Medium | Before Run is enabled, the screen shows the resolved instruction for this target and the active buying-signal checklist that will constrain the analysis. It identifies the target and warns that results are proposals pending human review. |
| Explicit effort selection | Users must control the cost/time-depth tradeoff before work starts | Low | The preview requires one supported effort choice and makes its label/meaning visible before launch. The completed run records the chosen effort so history can be interpreted honestly. |
| On-demand asynchronous run | Web research may take longer than a page interaction and must not block it | Medium | Starting a valid preview creates exactly one durable run, immediately shows a queued/running state, and lets staff navigate away. Refreshing or returning to the record reveals current status rather than launching another run. |
| Clear run lifecycle and failure state | Staff need to distinguish not-yet-run, running, completed, and unusable work | Medium | The target's analysis surface exposes pending/running, completed-awaiting-review, confirmed, dismissed, and failed states. A failure includes a safe human-readable outcome and never creates candidate offerings. |
| Completed-result review packet | A whole-run decision is only credible when it exposes its basis | High | A completed run shows a concise normalized result plus findings mapped to the signal checklist, source citations/links or source excerpts, the resolved instruction, selected effort, run timing, and model/run provenance already available through the agent stack. Absence of evidence is shown as absence—not manufactured certainty. |
| One decision per completed run | This is the locked human-review policy and prevents selective silent writes | Medium | A partner can **Confirm** or **Dismiss** the entire completed run. Either action is durable, attributable to the deciding staff user, timestamped, and idempotent; a second click/retry cannot duplicate application or reverse a settled decision. |
| Decision-safe confirmation | Confirmation is a state-changing action with commercial implications | Medium | Confirm presents a decision-specific summary of what candidate offerings will become visible, then applies only that run's normalized candidates. It must not imply that the AI itself made an approved business decision. |
| Dismiss without side effects | A rejected recommendation must leave the live record unchanged | Low | Dismiss closes the review as dismissed and preserves the result/history for audit, but adds no candidate offering and does not alter existing Signals or Offerings. Optional structured dismissal reason/note is valuable if the existing reviews model supports it. |
| Confirmed-only candidate offerings | Live record surfaces are shared decision-support data and must not leak unreviewed AI output | High | Company/Persona detail views show candidate offerings derived from **confirmed** runs only. Pending, running, failed, and dismissed run candidates are visible only inside their own history/review context; they are never rendered as record-level candidates. |
| Run history | Re-runs are expected as sources and active signals change; latest output alone is not enough | Medium | Each Company/Persona analysis surface lists prior runs with template, effort, initiator, started/completed time, status, decision, and a way to reopen its immutable result. History differentiates current pending work from past resolved work. |
| Results remain inspectable after decision | Confirmation/dismissal should not destroy the evidence used for the decision | Low | A settled run retains its result and citations in history, annotated with its Confirmed/Dismissed outcome and reviewer attribution. |
| Access controls match existing staff model | Review and execution are internal actions | Low | Existing Clerk staff protection applies equally to template management, preview, run start, history/result access, and confirm/dismiss operations. No new multi-role system is required in this milestone. |

## UX Safeguards

These are requirements, not polish. They prevent a fluent result from becoming an unexplained or accidental record change.

| Safeguard | Requirement |
|---|---|
| Preview is the contract | Show the *resolved* instruction and exact active-signal checklist, not merely an editable template body or a generic “Analyze” label. If required target context or active signals cannot resolve, block launch with a clear reason. |
| Evidence is navigable | Findings link to their supporting sources; citations should be close to the claim they support. A raw trace alone is not a review interface. |
| No false certainty | Treat citations as evidence and any confidence/coverage indicator only as a review aid. Do not let an AI confidence label auto-confirm, suppress review, or stand in for source support. |
| Explicit decision consequences | Confirmation copy states what will appear as candidate offerings; dismissal copy states that no candidates will be applied. Neither action is hidden in a generic “Save” control. |
| Stable decision packet | The reviewer sees the target, resolved inputs, output, evidence, and candidates associated with the exact completed run being decided—not the current template after a later edit. |
| Duplicate-action protection | Disable/serialize terminal actions while submitting and make server-side resolution idempotent. The UI must converge to the saved decision after reload or a network retry. |
| No result laundering | Pending, failed, and dismissed outputs must be visibly labelled in history and excluded from the record-level candidate-offering presentation. |
| Provenance over chain-of-thought | Show inspectable sources, run metadata, and normalized findings; do not require or expose private chain-of-thought as the explanation. |

## Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---|---|---:|---|
| Active-signal-derived checklist in preview | Makes the analysis specific to ArcLumen's maintained GBS signal taxonomy rather than an opaque generic web search | Medium | The checklist is a resolved snapshot for the run, so later signal edits do not rewrite history. |
| Shared constructor, two target-specific templates | One reusable operating model can support Company and Persona analysis without forcing partners into an ad-hoc prompt workflow | High | Reuse template/run/result/review primitives; target-specific context and output normalization stay behind the constructor contract. |
| Confirmed-only offering lens | Turns research into a conservative commercial cue without making the record look AI-authored or prematurely decisive | Medium | Clearly label candidates as candidates; do not represent them as established offerings, scored recommendations, or outreach tasks. |
| Decision-linked history | Makes why a candidate offering is visible reconstructable: which run, sources, effort, and human confirmed it | Medium | More valuable than a “latest AI answer” card because the historical basis survives re-runs. |

## Anti-Features

Features explicitly not to build in v1.7.

| Anti-Feature | Why Avoid | What to Do Instead |
|---|---|---|
| Persona Discovery | The milestone analyzes known Company/Persona records; discovery changes data acquisition, matching, consent, and review scope | Analyze the selected existing Persona only. |
| Bulk, scheduled, or automatic re-analysis | Adds queues, budgets, stale-result policy, notification design, and review-volume management before the single-run workflow is proven | Partner-triggered, one-target on-demand runs only. |
| Auto-confirmation or auto-writing candidates | Contradicts the locked human-review boundary and creates untraceable commercial suggestions | Keep all outputs pending until one partner confirms the whole completed run. |
| Per-finding accept/reject/edit workflow | Changes the review model from one decision per run into a granular curation product; increases partial-state complexity and is explicitly outside the direction | Confirm or dismiss the complete run; capture an optional reason/note if supported. |
| Candidate offerings from pending/dismissed/failed runs | Makes unreviewed AI output appear authoritative and violates confirmed-only behavior | Keep those candidates inside the run result/history only. |
| Hypotheses | A hypothesis model adds separate evidence, scoring, and lifecycle semantics beyond candidate offerings | Defer to the dedicated future Hypotheses milestone. |
| Outreach, CRM synchronization, or automated task creation | Converts advisory research into external action with new permissions and approval risks | Limit v1.7 to internal candidate-offering visibility. |
| Ad-hoc prompt editing at run time | Undermines reuse, comparability, and auditable resolved instructions | Manage reusable templates in the Agents surface; preview the resolved template for the selected target. |
| Provider/model controls within the run flow | The app already has per-user AI model settings; duplicating them obscures the analysis decision | Use existing model configuration and retain run provenance. |
| Full trace/chain-of-thought as the review UI | Reviewers need decision-relevant evidence, not private internal reasoning or raw logs | Provide normalized findings, citations, resolved inputs, status, and provenance; retain tracing for operational debugging. |

## Feature Dependencies

```text
Agent template management
  → target-kind-compatible Company/Persona templates
  → resolved instruction + active-signal checklist snapshot
  → effort selection + valid Preview/Run control

Preview-and-run
  → durable asynchronous agent run
  → normalized, source-backed completed result
  → run status and immutable history entry

Completed result
  → one whole-run review proposal
  → Confirm OR Dismiss (terminal, idempotent, attributed)
  → Confirm only: candidate-offering projection on Company/Persona detail

Signal taxonomy changes
  → affect future preview resolution only
  └── do not mutate checklist/result of completed historical runs

Existing reviews/proposals primitives
  → shared pending/resolved semantics where schema fits
  └── require adaptation if they only support per-proposal, rather than one-run, resolution
```

### Dependency Notes

- **Template snapshot before execution:** The system must persist the resolved instruction, checklist, effort, target identity, and template identity/version at run creation. Otherwise a manager editing a template or a Signal changing mid-run can make history and review unreconstructable.
- **Run completion before review:** Only a successfully completed normalized result creates a reviewable decision. Running/failed runs cannot be confirmed and cannot project candidate offerings.
- **Terminal review before record projection:** Candidate-offering visibility is a read model of confirmed decisions, not a direct read of agent output. This is the central confirmed-only invariant.
- **Existing reviews model is a seam, not a constraint:** Reuse it for shared proposal semantics only if it can represent a single run-level decision, actor/time attribution, and idempotent resolution. Do not distort the UX into per-item approval merely because an older proposal model is granular.

## MVP Recommendation

Prioritize:

1. **Constructor and two target-specific templates:** establish the reusable Company/Persona template contract and the Manage > Reviews > Agents visibility.
2. **Preview → effort → asynchronous on-demand run:** make resolved instruction and active-signal checklist reviewable before any cost is incurred.
3. **Completed result and history:** persist source-backed normalized results and make status/history clear after navigation or refresh.
4. **Whole-run confirmation/dismissal:** enforce a terminal, attributable, idempotent decision.
5. **Confirmed-only candidate-offering views:** project only confirmed run candidates onto Company/Persona details and prove all other statuses are excluded.

Defer:

- **Persona Discovery, bulk/scheduled execution, outreach/CRM, and Hypotheses:** explicitly outside milestone scope.
- **Per-finding curation, edit-and-confirm, assignments/SLAs/escalations, batch review, and reviewer analytics:** useful only after real use demonstrates the one-run review model is insufficient.
- **Automatic re-run on Signal/template changes:** requires freshness and stale-result policy; keep run initiation intentional in v1.7.

## Sources

- **Project record (HIGH):** `.planning/PROJECT.md`, especially Current Milestone, Milestone Context, active requirement at line 91, and Current State. It locks reusable Company/Persona templates, preview/run/history/findings, one decision per completed run, confirmed-only candidates, and exclusions.
- **NIST AI RMF 1.0 (HIGH):** https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-ai-rmf-10 — calls for documented knowledge limits, human oversight processes, and traceability.
- **NIST AI RMF: Generative AI Profile (HIGH):** https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf — recommends provenance, system inventories, underlying-model/access details, and defined human-oversight responsibilities.
- **OpenAI Agents guardrails and approvals guide (MEDIUM; implementation-neutral pattern):** https://developers.openai.com/api/docs/guides/agents/guardrails-approvals — distinguishes automatic validation from human approval and describes durable paused/resumed review state; ArcLumen’s review is post-completion rather than tool-call approval.
- **AWS Well-Architected Agentic AI Lens, human approval guidance (MEDIUM):** https://docs.aws.amazon.com/wellarchitected/latest/agentic-ai-lens/agentsec04-bp02.html — supports durable decision context, authenticated review UI, safe timeout behavior, and attribution/audit fields. The SLA/escalation portions are deliberately deferred.
