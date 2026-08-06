# Domain Pitfalls

**Domain:** ArcLumen 360 v1.7 reusable, on-demand Company and Persona web-research analyses, whose complete findings require one partner confirmation or dismissal before later Hypotheses may consume them.
**Researched:** 2026-08-06
**Confidence:** HIGH for codebase-specific gaps and provider mechanics; MEDIUM-HIGH for governance controls based on OWASP and NIST guidance.

## Critical Pitfalls

### Pitfall 1: A failed or gated run disappears, making the system non-auditable
**What goes wrong:** The current flow creates `agent_run` only after `runAgent()` succeeds and the output gate passes. A timeout, model/provider error, tool error, malformed output, or persistence failure therefore has no durable row. It cannot meet v1.7's explicit retention requirement for inputs, resolved query/schema, provider response, and errors; operators also cannot distinguish “not run” from “run and failed.”

**Why it happens:** `createRun()` only accepts successful artifacts, and `analyzeCompany()` returns before persistence on configuration, model, and gate failures. The existing model was designed for successful signal proposals, not an execution ledger.

**Consequences:** No reproducible incident investigation; impossible cost/error reconciliation; a partner cannot review why a run did not produce findings; silent retries can become indistinguishable duplicate research.

**Prevention:** Create an immutable run row in `queued`/`running` state *before* provider work. Persist lifecycle transitions and a normalized error envelope in `finally`; retain canonical input snapshot, template/version, resolved query, output-schema version, model/provider configuration snapshot, tool request/results metadata, sanitized normalized provider output, usage/cost, and external request/trace IDs. Do **not** retain hidden chain-of-thought; retain only application-visible structured output and tool evidence. A DB failure after provider completion must be a recorded `persistence_failed` run where possible, plus an alert/dead-letter path.

**Detection:** A request reaches Langfuse or Firecrawl but no local run exists; history has gaps between starts and terminal runs; error-rate dashboard is lower than provider-error logs.

**Prevention owner:** **Phase A — Run ledger and agent-contract foundation.**

### Pitfall 2: “Citation resolves” is mistaken for “citation supports this finding”
**What goes wrong:** The current gate verifies only that a proposal URL occurs in a server-derived evidence appendix. A model can attach a genuine but irrelevant URL, use a stale page for a current appointment, or claim a detail absent from the cited snippet. URL validity is provenance, not entailment.

**Why it happens:** `ProposalSignal` stores one `evidenceUrl`, snippet, and reasoning; the gate does not capture page content/version, claim-to-source spans, publication date, or source-quality policy.

**Consequences:** Partners receive polished but ungrounded buying signals, and later Hypotheses may aggregate false “confirmed” evidence. Citation links can rot or change, making later audit impossible.

**Prevention:** Model findings as claim(s) with one-or-more immutable evidence records: canonical/final URL, title, publisher/host, retrieved-at time, publication date when available, quoted/supporting excerpt or bounded source snapshot, content hash, and source quality/type. Require each material claim to reference its evidence IDs; deterministic validation rejects missing, duplicate-only, off-domain/unsafe, or unquoted support. Present source date and uncertainty prominently, require a partner to inspect citations, and treat confidence as model-supplied metadata—not a truth score. Capture only lawful/minimal excerpts and retention-tag them.

**Detection:** Finding’s claim text cannot be located in its stored excerpt; citation redirects to a different page; high-confidence findings rely on a single low-quality/undated source.

**Prevention owner:** **Phase A — Run ledger and normalized finding/evidence contract; Phase D — groundedness evaluation suite.**

### Pitfall 3: Per-finding review semantics leak unconfirmed research into downstream decisions
**What goes wrong:** Existing `signal_proposal` accepts or rejects each proposal independently and turns an accepted proposal into a live Signal. v1.7 requires exactly one confirm/dismiss decision for the *whole completed run*. Reusing the table without a distinct run-level state allows mixed decisions, partially visible results, or a query that accidentally consumes `pending`/individual `accepted` rows.

**Why it happens:** The current review model is proposal-centric: `proposal_status` is `pending|accepted|rejected`, `run_id` is nullable, and `acceptProposal()` effects a live write per proposal.

**Consequences:** “Confirmed-only candidate offerings” becomes untrustworthy; downstream Hypotheses can aggregate dismissed or only partially reviewed findings; concurrent reviewers can record conflicting outcomes.

**Prevention:** Introduce a run-level finite-state machine, e.g. `queued → running → completed → confirmed|dismissed` plus terminal `failed|cancelled`; findings inherit eligibility solely from `run.status = confirmed`. Make confirmation/dismissal a single conditional, transactional update (`WHERE status='completed'`) that records reviewer ID, timestamp, and optional dismissal reason; it must be idempotent and return `already_decided` rather than overwrite. Keep findings immutable after completion. Build candidate-offering and future Hypothesis queries from an explicit confirmed-run predicate, never from UI filtering or a finding-local status.

**Detection:** One run contains different finding decision states; a dismissed/pending run appears in a candidate-offering view; two reviewers both receive success.

**Prevention owner:** **Phase B — Review lifecycle and confirmed-only consumption boundary.**

### Pitfall 4: The web becomes an instruction channel, not merely an evidence source
**What goes wrong:** Search/scraped page text can contain indirect prompt injection (including hidden markup or encoded text) that tells the model to ignore rules, fabricate findings, expose context, or make more costly searches. The current prompt says web content is not spliced into instructions, but tool results still enter the model’s context and the agent has a search tool.

**Why it happens:** External pages are untrusted data while the model processes natural-language instructions and data in the same context. Prompt wording alone cannot provide a security boundary.

**Consequences:** Ungrounded or malicious findings, excess search calls, prompt/tool details in output, and persistence of poisoned content that a future consumer could treat as trusted evidence.

**Prevention:** Keep the agent read-only with an allowlisted, parameter-validated search tool; cap calls, query length, domains/results/content bytes, and total context. Delimit and label all fetched content as untrusted data; strip active content and suspicious/invisible markup before model use; never give the model DB writes, arbitrary URLs, credentials, or arbitrary tool invocation. Apply deterministic output/evidence validation and partner confirmation as separate controls. Add indirect-injection fixtures (HTML comments, zero-width text, encoded instructions, hostile snippets) to the evaluation suite and log a redacted injection-suspected signal.

**Detection:** Tool-call/query count spikes; output mentions instructions, credentials, or unrelated tasks; evaluation payload causes a new tool call or a policy-breaking finding.

**Prevention owner:** **Phase C — Safe execution, tool policy, and spend controls; Phase D — adversarial evaluation.**

### Pitfall 5: Duplicate clicks, retries, and provider retries create costly duplicate runs
**What goes wrong:** The client-side generation counter prevents stale UI rendering but does not make the POST idempotent. Multiple tabs, refresh/retry, or network uncertainty can execute multiple searches. AI SDK `generateText` retries retryable failures by default; Firecrawl reports `creditsUsed`, but if neither attempt-level cost nor request key is persisted, spend cannot be attributed or bounded.

**Why it happens:** There is no server-held idempotency key, active-run uniqueness rule, reservation, per-user budget, or durable tool/provider usage accounting in the existing one-minute synchronous route.

**Consequences:** Surprise bills, multiple inconsistent research snapshots for the same entity, Vercel timeout pressure, and partner review overload.

**Prevention:** Require a server-generated idempotency key bound to template version, subject, requester, and input hash; enforce one non-terminal run per `(template, subject)` (or an explicit, audited supersede rule). Reserve a maximum per-run and per-user/day budget before execution; configure bounded tool steps/results/retries/timeouts; persist provider/model usage and Firecrawl `creditsUsed` per attempt. On timeout/cancellation, mark a terminal/unknown-cost outcome rather than automatically re-run. Provide an operator kill switch and rate limit start endpoints.

**Detection:** Same input hash starts twice within the active window; a run has more calls/credits than configured; monthly cost cannot be summed from local data.

**Prevention owner:** **Phase C — Safe execution, tool policy, and spend controls.**

### Pitfall 6: Persona research retains or displays personal/sensitive data without a boundary
**What goes wrong:** Persona inputs and web results can contain contact data, career history, unverified allegations, or special-category/sensitive inferences. Retaining raw provider responses and web evidence indefinitely magnifies the footprint; displaying model-generated assertions as facts can unfairly harm a person.

**Why it happens:** v1.7 deliberately retains inputs and responses, while current evidence tags only distinguish `public_biz` and `personal_data`; they do not enforce minimization, redaction, access, retention period, or forbidden-claim policy.

**Consequences:** Privacy/reputational harm, unnecessary sensitive-data retention, and an audit record that itself becomes unsafe to expose broadly.

**Prevention:** Define an approved research schema and explicit disallowed categories before implementation. Send the minimum entity context needed; redact contact fields from model/tool payloads unless essential; classify evidence and outputs server-side; reject or quarantine sensitive/unverifiable claims; use role-aware display even though v1.7 retains existing staff auth. Set a documented retention/deletion policy by artifact class, redact before telemetry, and make deletion/subject-correction requests traceable without silently altering the original audit event (tombstone/redaction record).

**Detection:** Raw email/phone/sensitive terms in provider logs or Langfuse; a citation/result violates the data-class policy; an old run remains after its retention deadline.

**Prevention owner:** **Phase A — Data contract and retention classification; Phase B — safe review/display policy.**

### Pitfall 7: Template or schema edits silently change the meaning of historical results
**What goes wrong:** A reusable template is edited after runs exist. If history re-renders using the current template, query, signal definitions, or output schema, a partner cannot know what was actually asked or whether findings remain comparable. A later Hypothesis can aggregate similarly named findings from incompatible versions.

**Why it happens:** Reusable template management invites mutable records, while current agent runs only retain output-oriented JSON, not an immutable definition/input snapshot.

**Consequences:** Broken auditability, non-reproducible reviews, false trend/comparison signals, and “confirmed” results that no longer have a stable semantic contract.

**Prevention:** Version templates immutably. Every run stores the exact template version/content hash, resolved query/prompt variables, input snapshot/hash, output-schema version, signal taxonomy version, tool-policy version, and model/provider chain. Editing creates a new version; it never rewrites prior runs. Make comparability explicit in future aggregation (same template/taxonomy version, or a documented migration).

**Detection:** A historical run’s displayed query changes after a template edit; two findings with the same label have incompatible schemas; rerun cannot reconstruct its configuration.

**Prevention owner:** **Phase A — Run ledger and agent-template versioning.**

### Pitfall 8: “Human confirmed” is treated as a guarantee or loses the reviewer decision trail
**What goes wrong:** A confirm button can be interpreted as factual certification, while a dismiss action without a reason yields no learning loop. If reviewer identity, exact reviewed snapshot, decision time, and decision reason are not durable, neither accountability nor correction is possible.

**Why it happens:** Existing review actions optimize individual proposal accept/reject and correction reasons; v1.7 changes the unit and business meaning of review.

**Consequences:** Overconfident downstream use, no way to reconcile a later correction, and weak evidence for how a partner exercised oversight.

**Prevention:** Label results as AI-assisted research and “partner-confirmed for internal hypothesis use,” not verified fact. Confirmation binds to an immutable result checksum/version and records actor, timestamp, disposition, and optional structured dismissal/correction. Do not allow an existing confirmed run to be silently modified; correction requires an explicit superseding run or a recorded revocation. Measure confirmation/dismissal reasons and sampled citation-groundedness, but never advertise accuracy/confidence claims without validation evidence.

**Detection:** Confirmed rows lack reviewer/time/checksum; a historical result changes in place; public/internal copy says “verified” or implies measured accuracy without an evaluation record.

**Prevention owner:** **Phase B — Review lifecycle and decision audit; Phase D — evaluation and language verification.**

## Moderate Pitfalls

### Pitfall 9: A source URL is unsafe to render or trust as an identity
**What goes wrong:** Redirects, URL variants, tracking parameters, and hostile schemes make evidence links misleading or unsafe; the same source is double-counted as independent corroboration.

**Prevention:** Accept only `https` evidence URLs from tool output, normalize/canonicalize and record final URL/host, reject private/local addresses and unsafe schemes, deduplicate by canonical URL/content hash, and render links with normal browser protections. **Owner: Phase A.**

### Pitfall 10: “No findings” is wrongly aggregated as “no signal exists”
**What goes wrong:** Search coverage, provider failure, recency, and source availability are conflated with a negative business fact.

**Prevention:** Make terminal outcome explicit (`completed_no_supported_findings`, `failed`, `cancelled`, `partial`); show search scope/limits and uncertainties; exclude all non-confirmed outcomes—and especially absence—from future signal aggregation. **Owner: Phase B.**

### Pitfall 11: Telemetry becomes a second ungoverned evidence store
**What goes wrong:** Langfuse traces may contain prompts, tool outputs, names, URLs, and provider errors beyond the application retention policy.

**Prevention:** Send redacted/minimized trace attributes, keep trace IDs not raw payloads where possible, align Langfuse retention/access with application policy, and test that secrets and direct contact fields do not reach telemetry. **Owner: Phase C.**

## Phase-Specific Warnings

| Prevention owner | Likely pitfall | Required verification |
|---|---|---|
| Phase A — Run ledger and agent-contract foundation | Success-only persistence; mutable templates; citation URL without durable support; unsafe evidence identity | DB lifecycle tests covering success, gate failure, provider failure, timeout, and persistence failure; immutable version/snapshot assertions; citation/hash validation tests |
| Phase B — Review lifecycle and confirmed-only consumption | Per-proposal reuse produces partial approval or pending leakage | Concurrency test: only one whole-run decision wins; query-level test that candidates/Hypotheses exclude every non-confirmed status; reviewer/audit checksum UAT |
| Phase C — Safe execution, tool policy, and spend controls | Injection drives tools; duplicated work/retries spend money; telemetry leaks data | Tool policy and idempotency/rate-limit tests; injected-page fixture cannot change tool policy; cost/credits reconciliation; trace redaction grep/assertions |
| Phase D — Groundedness, security, and human-oversight evaluation | Valid JSON/citation is accepted as factual support; claims overstate confidence | Golden set with supported, irrelevant-citation, stale, ambiguous, and no-evidence cases; indirect prompt-injection suite; partner review workflow UAT and sampled evidence audit |

## Sources

- Codebase, HIGH: `src/lib/agents/analyzeCompany.ts`, `runAgent.ts`, `prompt.ts`, `types.ts`, `src/lib/db/schema.ts`, `src/lib/db/queries/runs.ts`, `src/lib/db/queries/proposals.ts`, and `src/app/actions/reviews.ts`, inspected 2026-08-06. These establish the successful-run-only persistence, URL-membership citation gate, proposal-level review, default retry/tool loop, and existing audit fields.
- Vercel AI SDK documentation, HIGH: structured-output errors and tool-validation errors; `generateText` retries retryable errors by default and applies total/step timeouts. https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data and https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling
- Firecrawl Search API documentation, HIGH: search results expose URLs/content and response `creditsUsed`; query/result limits and timeouts are configurable. https://docs.firecrawl.dev/features/search
- OWASP GenAI, HIGH: indirect prompt injection arises from external web content; recommended controls include untrusted-content separation, deterministic output validation, least privilege, and human oversight. https://genai.owasp.org/llmrisk/llm01-prompt-injection/ and https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html
- NIST AI 600-1 Generative AI Profile, HIGH: calls for documented generated-data provenance, defined human oversight, retention of TEVV/content-transparency history, and ongoing testing/monitoring. https://doi.org/10.6028/NIST.AI.600-1
- FTC AI claims guidance, MEDIUM (relevance is product-language governance, not a determination of ArcLumen's legal obligations): do not make unsupported efficacy claims; account for foreseeable risks and testing. https://www.ftc.gov/business-guidance/blog/2023/02/keep-your-ai-claims-check
