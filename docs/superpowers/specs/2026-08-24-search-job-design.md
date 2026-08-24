# Arc Agent Net Search Job for Company Key Personas

**Status:** Approved design specification  
**Date:** 2026-08-24  
**Scope:** Search jobs that discover current Key Personas for one selected Company, map candidates to Buyer Roles, and persist only operator-approved relationships.

## 1. Purpose and approved decisions

This feature adds a Search domain to the 360 application. A staff operator starts a Search job from a Company, Arc Agent Net researches current people who may be Key Personas, and the application presents normalized candidates in Reviews. The operator can correct a candidate, assign or remove Buyer Roles, and approve or reject the candidate. Approval creates or reuses a Persona and adds only the approved Company to Persona to Buyer Role relationships.

The Search domain is separate from Analyze. It uses the shared Arc Agent Net lifecycle infrastructure for server-side submission, polling, idempotency, durable job mapping, safe status projection, and result validation. Search has its own input, result packet, normalization rules, review states, and approval transaction. Analyze contracts and result persistence must not be reused as an implicit Search schema.

The approved decisions are:

1. Launch Search from the existing Company Agent menu, beside `Enrich` and `Analyze`.
2. Keep Search as a separate domain with shared Analyze lifecycle infrastructure. Search does not become a Company Analysis subtype.
3. Templates define Buyer Role rules. A rule may select an explicit Buyer Role ID, match a role name, match a department or function, match seniority, match geography, or combine those conditions. Future Buyer Roles are supported by resolving rules against the current Buyer Roles at job start.
4. One candidate may propose multiple Buyer Roles.
5. Search candidates use the full existing Persona schema. Fields unavailable from research are stored as `null` or remain absent in the normalized candidate, according to the existing schema contract. The system never invents values to fill gaps.
6. Candidate matching is deterministic: exact normalized email first, then normalized LinkedIn URL, then normalized name plus Company domain. Fuzzy auto-linking is not allowed.
7. Existing Persona data is preserved. Approval may add missing Company to Persona to Buyer Role links, but it does not overwrite existing Persona fields as a side effect.
8. Reviews supports one-person review and bulk approve or reject. Bulk operations include only eligible selected candidates and process each candidate independently.
9. An operator may edit Persona fields and Buyer Role assignments before approval. Every edit is audited.
10. Each candidate approval uses one atomic database transaction.
11. Evidence minimum is defined by the selected template. The default minimum is one public source.
12. A candidate that does not meet the evidence minimum is visible with state `inconclusive` and is blocked from approval.
13. Polling remains authoritative. Search adds no callback requirement.
14. `result.output` is a structured Search packet validated by the server. Optional Markdown is a transcript or debug artifact only and is never the input to Reviews or persistence.

## 2. Terminology and boundaries

| Term | Meaning |
| --- | --- |
| Company | The selected existing Company record that anchors the job. |
| Persona | An existing or newly created person record using the full Persona schema. |
| Buyer Role | A managed role under Offerings. A candidate can propose more than one role. |
| Company Persona Role | The relationship connecting a Company and Persona, including role metadata such as title and current status. |
| Persona role assignment | The Buyer Role relationship attached to the approved Company Persona Role. |
| Search template | A versioned Search definition containing instructions, Buyer Role rules, evidence minimum, and output contract metadata. |
| Candidate | A normalized person finding from the structured Search packet. Candidates are review objects until approved. |
| Source | A public evidence item supporting one or more candidate claims. |
| Review | The operator-facing queue item for one candidate. |
| Search packet | The validated `result.output` object returned by Arc Agent Net. |

The Search domain owns job configuration, candidate normalization, evidence evaluation, review eligibility, edits, and approval orchestration. Shared Arc Agent Net infrastructure owns transport and job lifecycle only. Existing query modules remain the source of truth for Buyer Roles and Company Persona Role persistence. This design does not claim that any new database columns or tables already exist.

## 3. Launch and user interface

### 3.1 Company Agent menu

The existing Company Agent menu gains a `Search` action next to `Enrich` and `Analyze`:

```text
Company Agent
  Enrich
  Search
  Analyze
```

Search is enabled only for an authenticated staff operator with access to the selected Company and an active compatible Search template. The menu must not expose partner credentials, partner job IDs, callback settings, raw instructions, or transport configuration.

Choosing Search opens the Search launch surface with:

1. Selected Company summary, including name and domain when available.
2. Search template selector.
3. Read-only preview of the resolved Buyer Role rules and evidence minimum.
4. Start Search action.
5. Existing active Search state for the Company and template, when one exists.

The browser submits opaque Company, template version, and idempotency identities. The server re-resolves the Company, template, Buyer Roles, rules, evidence policy, and output contract at launch time. The browser does not submit arbitrary role names as authorization or persistence instructions.

### 3.2 Search status and polling

After launch, the UI displays a local 360 Search run identifier and safe status: `queued`, `running`, `succeeded`, `failed`, or `cancelled`. It polls the local Search status route using the same bounded cadence and abort behavior used by Analyze. The browser never polls by supplying an Arc Agent Net job ID.

When the job reaches a terminal state, the UI links to Reviews only if the server has produced at least one normalized candidate. A successful workflow with zero normalized candidates may show a completed Search run and an empty result summary, but it must not create a Reviews entry.

### 3.3 Reviews presentation

Reviews shows Search candidates as normalized findings, not as a Markdown transcript. Each candidate card includes:

* candidate name and available Persona fields;
* current Company association, if one was matched;
* proposed Buyer Roles, including the rule or evidence that caused each proposal;
* evidence count and source links;
* candidate status, such as `pending`, `inconclusive`, `approved`, or `rejected`;
* edit history summary and the latest editor;
* per-persona Approve and Reject actions;
* selection control for eligible bulk actions.

The operator can edit the full set of Persona fields supported by the existing Persona form and can add, remove, or change proposed Buyer Role assignments. An edit changes the review candidate projection and records an audit event. It does not persist a Persona or relationship until approval.

## 4. Template contract

Search templates are versioned. A job stores a snapshot of the selected template version and the resolved Buyer Roles used for that job, so later Buyer Role edits cannot change the meaning of an existing result.

### 4.1 Buyer Role rules

Each rule can use one or more selectors. At least one selector is required. Selectors are evaluated against the candidate's normalized fields and extracted evidence. Explicit IDs are resolved first and must refer to an existing Buyer Role at launch time. Name, department or function, seniority, and geography selectors are normalized for matching. A rule may produce no match without failing the whole job.

```json
{
  "ruleId": "finance-transformation-leader",
  "label": "Finance transformation leader",
  "buyerRoleIds": [12],
  "roleNames": ["Finance Transformation Leader", "Transformation CFO"],
  "departments": ["Finance", "Transformation"],
  "functions": ["Finance Transformation", "Shared Services"],
  "seniority": ["c_suite", "vp", "head"],
  "geographies": ["US", "Canada"],
  "match": "any_selector",
  "required": false
}
```

The canonical persisted rule supports these selector fields:

* `buyerRoleIds`, an array of explicit positive IDs;
* `roleNames`, normalized role-name alternatives;
* `departments`, normalized department alternatives;
* `functions`, normalized function alternatives;
* `seniority`, controlled seniority values;
* `geographies`, normalized country, region, or market values;
* `match`, either `any_selector` or `all_selectors`;
* `required`, which marks an unmet rule for visibility and diagnostics, not for automatic approval.

Future Buyer Roles are supported. A new Buyer Role can be selected by ID or matched by a rule after template publication, provided the server resolves and snapshots it at job start. A missing explicit ID is a template resolution error, not permission to create a role or silently select another role.

### 4.2 Evidence policy

The template declares the evidence minimum and source policy:

```json
{
  "evidencePolicy": {
    "minimumPublicSources": 1,
    "allowedSourceKinds": ["company_site", "person_profile", "press", "professional_network"],
    "requireHttps": true,
    "allowPrivateSources": false
  }
}
```

`minimumPublicSources` defaults to `1`. A public source must have an HTTPS URL and enough metadata for the operator to inspect it. Private source references, agent-only citations, unsupported URL schemes, and source entries without a URL do not count toward the minimum. The policy is evaluated server-side after packet validation.

### 4.3 Template snapshot

The launch snapshot includes template identity and version, resolved instructions, Buyer Role rules, resolved Buyer Role identities and names, evidence policy, schema version, and the selected Company identity. The snapshot is immutable for the job. It is used to explain proposals during review and to support replay diagnostics.

## 5. Arc Agent Net input and lifecycle

Search uses the shared server-only Arc Agent Net client and lifecycle behavior already used by Analyze:

1. Authenticate and authorize the staff operator.
2. Validate the strict launch request.
3. Resolve and snapshot the Company, Search template version, Buyer Role rules, and evidence policy.
4. Create a local Search run in a dispatchable state.
5. Submit the bounded Search input with an idempotency key.
6. Persist the partner job mapping before reporting a successful launch.
7. Poll through the local Search status route until a terminal partner status is observed.
8. Validate the structured `result.output` packet.
9. Normalize candidates and sources, evaluate evidence, and create Review records only for normalized candidates.
10. Let operators edit, approve, or reject Reviews. Approval is the only path to Persona and relationship persistence.

Search does not add callbacks. If a future partner contract offers callbacks, they remain optional transport improvements and cannot replace polling as the authoritative status mechanism for v1.

### 5.1 Server launch request

The browser-facing request is intentionally narrow:

```json
{
  "subject": { "type": "company", "id": 123 },
  "templateVersionId": 27,
  "idempotencyKey": "search-user-opaque-retry-key"
}
```

The server rejects unknown fields, non-Company subjects, invalid IDs, empty keys, inactive templates, and templates that cannot resolve their Buyer Role rules. The client key is a retry identity, never an authorization credential. It is scoped to the authenticated user and request payload. A same-key same-payload retry returns the existing local run. A same-key different-payload request returns an idempotency conflict.

### 5.2 Search packet versus optional transcript

The partner result must place the machine-readable packet in `result.output`. The server validates and persists only that structured value. A partner response may also include optional Markdown, plain text, logs, or debug fields. Those artifacts are not a source of truth for candidates, evidence, review eligibility, or approval. They may be stored under a separately bounded debug or transcript field subject to existing retention and redaction policy.

The packet must not contain chain-of-thought, hidden prompts, raw private reasoning, provider credentials, or unredacted internal tool traces. Evidence is represented as concise claims and public links suitable for operator review.

## 6. Structured `result.output` contract

The following example is the end-to-end shape. The exact schema version is part of the contract and must be validated strictly. Unknown top-level fields are rejected unless explicitly allowed by the versioned schema.

```json
{
  "schemaVersion": 1,
  "job": {
    "kind": "persona_search",
    "companyId": 123,
    "templateVersionId": 27,
    "completedAt": "2026-08-24T12:15:00.000Z"
  },
  "company": {
    "id": 123,
    "name": "Example Holdings",
    "domain": "example.com"
  },
  "candidates": [
    {
      "candidateId": "candidate-001",
      "persona": {
        "firstName": "Rina",
        "lastName": "Patel",
        "fullName": "Rina Patel",
        "title": "Chief Financial Officer",
        "email": "rina.patel@example.com",
        "linkedinUrl": "https://www.linkedin.com/in/rina-patel",
        "phone": null,
        "location": "Chicago, IL, US",
        "department": "Finance",
        "function": "Finance Transformation",
        "seniority": "c_suite",
        "companyName": "Example Holdings",
        "companyDomain": "example.com",
        "bio": null,
        "photoUrl": null
      },
      "buyerRoles": [
        {
          "buyerRoleId": 12,
          "buyerRoleName": "Finance Transformation Leader",
          "matchedRuleIds": ["finance-transformation-leader"],
          "confidence": "supported"
        },
        {
          "buyerRoleId": 18,
          "buyerRoleName": "Executive Sponsor",
          "matchedRuleIds": ["executive-sponsor"],
          "confidence": "supported"
        }
      ],
      "sources": [
        {
          "sourceId": "source-001",
          "kind": "company_site",
          "url": "https://example.com/leadership",
          "title": "Leadership Team",
          "publishedAt": null,
          "accessedAt": "2026-08-24T12:10:00.000Z",
          "supports": ["persona.name", "persona.title", "persona.company"]
        }
      ],
      "claims": [
        {
          "path": "persona.title",
          "value": "Chief Financial Officer",
          "sourceIds": ["source-001"]
        }
      ],
      "agentStatus": "supported"
    }
  ],
  "summary": {
    "candidateCount": 1,
    "sourceCount": 1,
    "inconclusiveCount": 0
  }
}
```

### 6.1 Candidate requirements

Each candidate requires a stable packet-local `candidateId`, a Persona object using the full existing schema shape, a Buyer Role proposal array, a source array, and an agent status. Persona fields that are unavailable are explicitly `null` where the existing schema permits null. A missing optional field is not treated as evidence of a value.

Each Buyer Role proposal must refer to a resolved Buyer Role in the job snapshot. The server does not trust a partner-supplied role name or ID without checking it against the snapshot. A candidate may contain zero, one, or many proposals. Approval with no Buyer Role assignment is allowed only if the existing relationship contract permits a Company Persona Role without a Buyer Role; otherwise the UI must require the operator to assign at least one valid role before approval. It must never invent a role.

Each source must have a valid public HTTPS URL, source kind, and title or provider label. Claims refer to source IDs in the same candidate. Unsupported claims remain visible as unverified data and do not count as evidence.

## 7. Normalization, matching, and review eligibility

### 7.1 Normalization

The server trims surrounding whitespace, normalizes Unicode consistently, lowercases email and domain comparisons, canonicalizes LinkedIn URLs by removing harmless tracking parameters and a trailing slash, and normalizes names for exact comparison. Normalization must be deterministic and recorded with the candidate projection. It must not use fuzzy similarity for auto-linking.

### 7.2 Existing Persona matching

For each candidate, matching checks existing Personas in this order:

1. Exact normalized email, when the candidate has an email.
2. Exact normalized LinkedIn URL, when the candidate has a LinkedIn URL.
3. Exact normalized name plus the selected Company's normalized domain, when both are available.

The first unambiguous match becomes the candidate's existing Persona reference. If a criterion matches multiple Personas, the candidate is ambiguous and cannot be auto-linked or approved until an operator resolves it. If no criterion matches, the candidate is new and approval may create a Persona from the operator-approved fields.

A weaker match never override a stronger match. A name-only match, name plus a different domain, partial email, fuzzy LinkedIn match, or title similarity is not an automatic match. Existing Persona fields are preserved when a match is found. Candidate values are shown as proposed edits and can be explicitly edited before approval.

### 7.3 Evidence and eligibility states

The server derives review eligibility from validated candidate data, not from a partner status string alone:

| State | Meaning | Approval allowed |
| --- | --- | --- |
| `pending` | Candidate is normalized, evidence minimum is met, and no blocking ambiguity exists. | Yes, after any required edits. |
| `inconclusive` | Candidate is visible but has fewer public sources than the template minimum, invalid evidence, unresolved required rules, or another explicit evidence deficiency. | No. |
| `ambiguous_match` | Deterministic matching produced more than one possible existing Persona. | No until resolved by the operator. |
| `invalid` | Candidate failed packet or field validation. | No. It is retained only in diagnostics, not Reviews. |
| `approved` | Operator approval transaction committed successfully. | No further approval. |
| `rejected` | Operator rejected the candidate. | No. |

`inconclusive` candidates are shown in Reviews so the operator can understand why a result was not actionable, but the Approve control is disabled. The operator may reject an inconclusive candidate. In v1, the operator may not manufacture evidence or override the minimum. A future evidence-request workflow is explicitly out of scope.

### 7.4 Why completed zero-candidate workflows are absent from Reviews

Reviews consumes normalized findings, sources, and links. A terminal Search workflow with no candidate that passes packet normalization has no Review object to display. A Markdown transcript, a partner job status, or a summary count cannot stand in for a normalized candidate. Therefore a completed workflow can correctly appear in Search history while not appearing in Reviews. This avoids creating approval records from unstructured or unverifiable output.

## 8. Review and approval semantics

### 8.1 Per-persona review

The operator opens one candidate, checks its proposed Persona fields, inspects public sources, resolves any match ambiguity, and edits Buyer Role assignments. The UI shows the exact values that will be persisted and the existing Persona identity, if any. Approval sends the candidate revision and an optimistic revision token to the server.

The server re-loads the candidate, confirms it remains eligible, verifies that the revision token is current, revalidates edited fields and Buyer Role IDs, and executes one atomic transaction. The transaction:

1. Locks the Review candidate and relevant existing Persona or matching keys.
2. Rechecks that the candidate is not already approved or rejected.
3. Rechecks deterministic matching and current Company identity.
4. Creates a new Persona only when no existing match remains and the approved fields satisfy the existing Persona requirements.
5. Preserves existing Persona data. Explicit operator edits update only fields the operator approved, following existing Persona update semantics.
6. Creates the Company Persona Role if it does not already exist, or reuses the existing relationship without duplication.
7. Adds each approved Company Persona to Buyer Role relationship that is missing.
8. Records the approval, applied edits, role assignments, source references, actor, and timestamps in audit data.
9. Marks the Review candidate approved.

If any step fails, the transaction rolls back. The candidate remains reviewable with a safe error, and no partial Persona, Company Persona Role, or Buyer Role relationship is presented as committed.

### 8.2 Bulk approve and reject

Bulk actions operate only on selected candidates that are currently eligible for that action. The server ignores stale, ineligible, already terminal, ambiguous, and inconclusive selections and returns per-candidate outcomes. It never turns a mixed selection into one all-or-nothing transaction.

Each eligible candidate is processed independently using the same per-candidate atomic approval or rejection operation. One failure does not roll back successful candidates. The response identifies `approved`, `rejected`, `skipped`, and `failed` candidates without leaking sensitive database details.

The server rechecks eligibility and revision state for every candidate. The browser's selected list is not authority. A bulk request cannot approve an `inconclusive` candidate by including it in the selection.

### 8.3 Operator edits and audit metadata

Persona field edits and Buyer Role assignment edits are staged on the Review candidate until approval. The audit event captures before and after values, field path, actor, reason when supplied, and the candidate revision. Sensitive fields should be redacted or hashed according to existing audit policy. A representative audit object is:

```json
{
  "eventType": "search_candidate_edited",
  "candidateId": "candidate-001",
  "reviewId": 4401,
  "actorUserId": "user_abc123",
  "occurredAt": "2026-08-24T12:30:00.000Z",
  "revision": 3,
  "changes": [
    {
      "path": "persona.title",
      "before": "Chief Financial Officer",
      "after": "Group Chief Financial Officer"
    },
    {
      "path": "buyerRoles",
      "before": [12, 18],
      "after": [12]
    }
  ],
  "source": "reviews_ui"
}
```

Approval also records a durable audit event with the final approved projection and IDs of created or reused records. Rejection records the actor, reason when provided, candidate revision, and timestamp. Audit records are append-only from the application perspective.

## 9. End-to-end packet and persistence example

The following compact example shows how a successful Search packet becomes a Review and then approved relationships. It is illustrative data, not a claim about existing columns.

```json
{
  "result": {
    "output": {
      "schemaVersion": 1,
      "job": { "kind": "persona_search", "companyId": 123, "templateVersionId": 27 },
      "candidates": [
        {
          "candidateId": "candidate-001",
          "persona": {
            "fullName": "Rina Patel",
            "email": "rina.patel@example.com",
            "linkedinUrl": "https://www.linkedin.com/in/rina-patel",
            "title": "Chief Financial Officer",
            "companyDomain": "example.com",
            "phone": null,
            "location": "Chicago, IL, US"
          },
          "buyerRoles": [
            { "buyerRoleId": 12, "buyerRoleName": "Finance Transformation Leader" },
            { "buyerRoleId": 18, "buyerRoleName": "Executive Sponsor" }
          ],
          "sources": [
            {
              "sourceId": "source-001",
              "url": "https://example.com/leadership",
              "kind": "company_site",
              "title": "Leadership Team"
            }
          ]
        }
      ]
    },
    "transcriptMarkdown": "Optional operator-readable transcript, never used for persistence"
  },
  "normalizedReview": {
    "reviewId": 4401,
    "candidateId": "candidate-001",
    "status": "pending",
    "match": { "kind": "existing_persona", "personaId": 77, "matchedBy": "email" },
    "approvedBuyerRoleIds": [12, 18]
  },
  "approvalResult": {
    "status": "approved",
    "personaId": 77,
    "companyPersonaRole": { "companyId": 123, "personaId": 77, "created": false },
    "buyerRoleLinks": [
      { "buyerRoleId": 12, "created": true },
      { "buyerRoleId": 18, "created": false }
    ]
  }
}
```

The existing query shape for Company Persona Role includes Company, Persona, title, current state, and dates. Buyer Role assignments must use the existing relationship model or its approved extension during implementation. This specification requires idempotent relationship creation, but it does not prescribe a column name that has not been verified in the current schema.

## 10. Routes and server contracts

The exact route names may follow the repository's established App Router naming, but the responsibilities and boundaries are fixed.

### 10.1 Submit

`POST /api/search-runs`

The route requires staff access, parses the strict launch request, resolves the selected Company and template, snapshots Buyer Roles, checks for compatible active runs, and submits through the shared Arc Agent Net client. It returns only the local Search run identity and safe status.

Success:

```json
{
  "searchRunId": 901,
  "status": "queued",
  "replayed": false
}
```

Same idempotent retry:

```json
{
  "searchRunId": 901,
  "status": "queued",
  "replayed": true
}
```

Required safe errors include `invalid_input`, `unauthorized`, `company_not_found`, `template_not_found`, `template_inactive`, `buyer_role_rule_invalid`, `active_run_exists`, `idempotency_conflict`, `dispatch_failed`, and `persistence_failed`. No error returns a partner secret or raw partner response.

### 10.2 Status

`GET /api/search-runs/:id`

The route accepts a local positive Search run ID, verifies staff visibility, and returns a safe projection with status, timestamps, Company summary, template summary, candidate counts, and a Reviews link when normalized candidates exist. It never accepts a partner job ID from the browser and never fabricates terminal state when partner status is unavailable.

### 10.3 Reviews

`GET /api/search-runs/:id/reviews` returns normalized candidates, sources, proposed roles, match state, eligibility, and audit summaries. It does not return raw partner credentials, hidden prompts, private reasoning, or unrestricted transport input.

`PATCH /api/search-reviews/:id` stages validated Persona field and Buyer Role assignment edits, checks the expected revision, and appends the edit audit event. It does not persist a new Persona or Company relationship.

`POST /api/search-reviews/:id/approve` performs the single-candidate atomic approval transaction.

`POST /api/search-reviews/:id/reject` records rejection without creating or changing Persona relationships.

`POST /api/search-reviews/bulk` accepts a bounded list of local Review IDs and an action of `approve` or `reject`. It returns independent per-candidate outcomes.

All state-changing routes require staff authorization, use no-store responses, validate ownership and revision, and return safe discriminated error envelopes.

## 11. Security and authorization

* All launch, status, Review, edit, approve, reject, and bulk routes require the existing staff access guard.
* Company visibility is checked server-side. A caller cannot launch Search for an inaccessible Company by changing an ID.
* Template versions and Buyer Role IDs are re-resolved server-side. Caller-supplied names cannot create or authorize a role.
* Arc Agent Net credentials, partner job IDs, request IDs, callback secrets, and raw transport headers stay in server-only modules and durable mappings. They are not sent to the browser unless an existing safe projection explicitly permits a non-sensitive identifier.
* Search input is bounded by the resolved template and Company snapshot. The caller cannot supply arbitrary instructions, destination URLs, callback URLs, model settings, or source requirements.
* Public source URLs are validated and displayed safely. The UI must prevent script execution, unsafe URL schemes, and unescaped source titles.
* Approval rechecks authorization, candidate ownership, eligibility, revision, matching, and Buyer Role existence inside the transaction boundary.
* Audit events identify the actor and preserve the before and after values needed to explain changes. Private reasoning and secrets are never placed in audit data.
* Review data and Search status use `Cache-Control: no-store` or the repository equivalent. Sensitive result packets are not exposed through public cache layers.
* Bulk requests have bounded candidate counts and server-side rate limits consistent with existing staff actions.

## 12. Idempotency, replay, and concurrency

### 12.1 Launch idempotency

The durable local run stores the idempotency key, authenticated actor scope, request fingerprint, template snapshot identity, Company identity, partner job identity, and lifecycle status. A retry with the same key and equivalent payload returns the existing local run. A key reused for different Company, template, or payload returns `idempotency_conflict`.

The server must persist local dispatch state and partner mapping before returning successful submission. If the partner accepts a job but local persistence fails, the route returns a persistence failure and marks the dispatch for safe reconciliation. It does not claim success or create an untracked Review path.

### 12.2 Result replay

Processing the same terminal partner result again is safe. The result packet hash and schema version identify the processed output. Replaying an identical packet does not duplicate candidates or Reviews. A different packet for the same terminal run is a conflict and is retained as a diagnostic failure, not silently substituted.

### 12.3 Approval concurrency

Candidate edits use optimistic revisions. Approval requires the current revision and locks the candidate in the transaction. Two operators cannot both approve the same candidate successfully. A stale approval returns a conflict and leaves the latest operator-edited candidate visible.

Relationship creation is idempotent under a unique relationship key. A retry after a network timeout returns the existing approved result where possible. It never duplicates a Company Persona Role or Buyer Role assignment.

## 13. Failure behavior and operator-visible states

| Failure | Stored state | Operator behavior |
| --- | --- | --- |
| Invalid launch input | No run | Show validation error. |
| Missing Company or template | No run | Show safe not-found error. |
| Buyer Role rule cannot resolve | No run | Show template configuration error. |
| Arc Agent Net unavailable or not configured | `failed` | Show dispatch failure and retry action, without internal fallback. |
| Partner job expires during polling | `failed` | Show status unavailable or expired, with no invented result. |
| Malformed result or wrong schema | `failed` | Show result validation failure; no Reviews are created. |
| Valid result with zero normalized candidates | `succeeded` | Show completed Search with zero candidates and no Reviews entry. |
| Candidate below evidence minimum | Review `inconclusive` | Show sources and deficiency; block approval. |
| Ambiguous deterministic match | Review `ambiguous_match` | Require operator resolution before approval. |
| Approval conflict | Review remains current | Ask operator to reload or review the newer revision. |
| Approval transaction failure | Review remains eligible when safe | Show a retryable safe error; no partial persistence. |
| Bulk candidate failure | Per-candidate `failed` | Keep successful outcomes and report failures independently. |

Search never silently falls back to Analyze or internal execution. A failed Search is a failed Search.

## 14. Testing requirements

The implementation plan must cover these tests without weakening the contract:

### Contract and normalization tests

* Reject unknown launch and packet fields.
* Accept nullable unavailable Persona fields.
* Reject invalid source schemes, private sources, malformed URLs, and unsupported schema versions.
* Resolve explicit Buyer Role IDs and rule matches against the launch snapshot.
* Preserve multiple Buyer Role proposals on one candidate.
* Normalize email and LinkedIn URL deterministically.
* Match in email, then LinkedIn URL, then name plus Company domain order.
* Refuse fuzzy, name-only, and ambiguous auto-linking.

### Lifecycle and idempotency tests

* Submit through the shared server-only Arc Agent Net client with polling and no callback requirement.
* Return the same local run on an equivalent idempotent retry.
* Reject idempotency key conflicts.
* Do not return success when partner submission cannot be durably mapped.
* Replay an identical terminal result without duplicate Review records.
* Reject a changed terminal result for the same run.
* Keep zero-candidate success out of Reviews.

### Review and approval tests

* Mark candidates below the template evidence minimum `inconclusive` and block approval.
* Stage Persona and Buyer Role edits without persisting domain records.
* Record before and after audit metadata for edits.
* Approve one candidate in one atomic transaction.
* Preserve existing Persona fields unless explicitly approved for update.
* Create a new Persona only for an unambiguous unmatched candidate.
* Reuse existing Company Persona Role and Buyer Role links without duplicates.
* Reject stale revisions and concurrent approvals safely.
* Process eligible bulk candidates independently and skip ineligible selections.
* Ensure rejection never creates Persona or relationship records.

### Authorization and UI tests

* Hide or disable Search for unauthorized users and reject direct route calls.
* Reject inaccessible Company IDs and stale template versions.
* Render Search beside Enrich and Analyze in the Company Agent menu.
* Show `inconclusive` candidates in Reviews with approval disabled.
* Show no Reviews link for a completed zero-candidate run.
* Keep partner secrets, private reasoning, and raw transport data out of browser responses.

## 15. Rollout and migration

Rollout is staged:

1. Ship packet schemas, normalization, evidence evaluation, and persistence code behind a Search feature flag. Existing Analyze behavior remains unchanged.
2. Enable template rule editing and launch for internal staff in a non-production or restricted Company allowlist. Seed or configure only reviewed Search templates and resolve their Buyer Role rules before launch.
3. Run shadow validation where feasible by validating packets and candidate counts without exposing approval actions. Do not persist inferred relationships during shadow operation.
4. Enable Reviews for a small operator group. Monitor dispatch failures, malformed packets, inconclusive rates, ambiguous matches, approval conflicts, duplicate relationship protections, and audit completeness.
5. Expand access after operators confirm that evidence, matching, and role proposals are trustworthy. Keep the feature flag available for stopping new Search launches without rewriting existing runs or approved data.

Existing Persona, Company Persona Role, and Buyer Role data is not rewritten by rollout. Existing relationships remain authoritative. Search only adds records and links through approved transactions. Any required schema changes must use repository migration conventions and preserve existing records. No migration may infer Buyer Roles or merge Personas.

Rollback disables new Search launches and approval actions while preserving run history, Reviews, audit records, existing Personas, and approved relationships. In-flight jobs retain their recorded lifecycle state and can be reconciled through the shared polling path. Rollback does not reroute Search jobs through Analyze.

## 16. Explicitly future, not v1

The following are intentionally not part of v1:

* fuzzy or probabilistic automatic Persona matching;
* automatic approval based on confidence scores;
* operator override of the template evidence minimum;
* private or authenticated source ingestion;
* callback delivery as a requirement or replacement for polling;
* automatic creation of new Buyer Roles from Search output;
* automatic merging of duplicate Personas;
* recurring or scheduled Search jobs;
* Search across multiple Companies in one launch;
* partner Markdown parsing as a fallback when `result.output` is absent;
* exposing chain-of-thought, hidden prompts, or raw provider traces;
* automated outreach or CRM activation after approval;
* bulk edits that span unrelated Companies;
* replacing Analyze with Search or combining their result schemas.

These items require a separate approved design. Their absence must not be interpreted as permission to add a silent fallback or an unreviewed shortcut.

## 17. Implementation handoff

The later implementation plan should preserve this specification as the source of truth for Search contracts and approval safety. It should identify the exact existing Persona schema and relationship storage before selecting migration details, and it should map Search persistence to the current query conventions without claiming unverified columns. The implementation is complete only when structured packet validation, normalized Review creation, operator audit, atomic approval, concurrency protection, and rollout controls all exist together.
