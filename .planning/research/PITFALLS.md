# Pitfalls Research

**Domain:** Custom structured-research agent constructors
**Researched:** 2026-08-09
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Version history is cosmetic rather than immutable

**What goes wrong:** Editing an agent changes the configuration used by an older run or makes historical versions editable.
**Why it happens:** A single mutable JSON row is easier to build than a version/current-pointer model.
**How to avoid:** Append a new version on every content/config save; snapshot the selected version at run creation; make history read-only.
**Warning signs:** Existing run detail renders current instruction, or a history row has an update/delete action.
**Phase to address:** Phase 37 — Definition, Versioning & Lifecycle.

---

### Pitfall 2: The constructor accepts configurations the executor cannot safely run

**What goes wrong:** A staff-created agent saves successfully but fails only after launch because target, Practice Area, effort, schema, or capability is incompatible.
**Why it happens:** Validation is implemented only in the form or only at runtime.
**How to avoid:** Use shared server-side normalization/validation before activation and again before run creation; report actionable compatibility errors.
**Warning signs:** Client-only checks, arbitrary provider/tool fields, or inactive/retired agents reaching the run executor.
**Phase to address:** Phase 37 — Definition, Versioning & Lifecycle; Phase 38 — Execution Compatibility.

---

### Pitfall 3: Output-shape flexibility turns into unbounded cost and brittle review packets

**What goes wrong:** Deep schemas, huge required field sets, or unbounded arrays create expensive, slow, malformed, or unreviewable outputs.
**Why it happens:** General agent playgrounds make schema authoring look unconstrained; users naturally request every possible field.
**How to avoid:** Keep behavior instructions separate from output shape, require only essential fields, bound arrays, cap depth/size, and normalize into the existing packet contract.
**Warning signs:** `maxItems` absent on list fields, schema depth grows without policy, or user schema directly becomes evidence.
**Phase to address:** Phase 38 — Execution Compatibility; Phase 39 — Security & Verification.

---

### Pitfall 4: Custom runs bypass the v1.7 review and no-live-write boundaries

**What goes wrong:** A new agent writes live Signals/links, creates multiple decisions, or exposes unconfirmed findings as candidate offerings.
**Why it happens:** Constructor work is treated as a new product path instead of another input to the existing pipeline.
**How to avoid:** Reuse the v1.7 durable run, evidence packet, whole-run review, and confirmed-only SQL projection; add mutation/no-write regression tests.
**Warning signs:** Separate accept/reject actions, client-side confirmed filtering, or custom-agent code importing direct live-write queries.
**Phase to address:** Phase 38 — Execution Compatibility; Phase 39 — Security & Verification.

---

### Pitfall 5: Prompt/schema/tool fields create an injection or policy escape hatch

**What goes wrong:** Malicious instructions or schema descriptions induce unsafe tools, unsupported citations, secret exposure, or forbidden writes.
**Why it happens:** User-authored text is treated as trusted execution policy.
**How to avoid:** Keep tools/data sources server-owned, validate instructions/schema, preserve the allowlisted research boundary, reject unsupported/duplicate evidence, and prove unchanged live rows in adversarial fixtures.
**Warning signs:** User-defined provider IDs, raw tool names in editable fields, or accepting URL-only citations.
**Phase to address:** Phase 39 — Security & End-to-End Verification.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store custom config as unvalidated JSON | Fast prototype | No stable compatibility, migration, or audit contract | Never for an activatable agent. |
| Validate only in the client | Smaller Server Action | Direct requests can bypass safety and produce unrunnable versions | Never. |
| Reuse current fixed template rows as custom rows without stable identity | Avoids a migration | Custom edits can corrupt v1.7 behavior and make ownership unclear | Never; preserve fixed identities and add custom identity explicitly. |
| Copy v1.7 UI without constructor-specific error states | Quick visual reuse | Staff cannot understand why a custom agent cannot run | Only for a static mock, not a release candidate. |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Durable run ledger | Read mutable agent config during a queued/running run | Snapshot exact version/configuration before enqueue/claim. |
| Evidence packet | Trust custom output fields as citations | Reconcile evidence through canonical server-owned source/link contracts. |
| Review/candidates | Add custom decision semantics | Use the existing one whole-run decision and confirmed-only projection. |
| Provider/model execution | Expose provider selection in custom config | Resolve only the existing saved model chain and server-owned capability policy. |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Unbounded output arrays | Long runs, high cost, oversized packets | Require bounded arrays and execution limits | Before large customer datasets; cost grows per run. |
| Full history loaded for every card | Slow `/agents` page and unnecessary DB payload | Paginate/read current version separately from history | As custom-agent count or versions grow. |
| Duplicate active-run checks only in UI | Two browser tabs enqueue duplicates | Enforce DB/query-layer guard atomically | Immediately under concurrent use. |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Trusting submitted actor ID | Cross-user mutation or audit spoofing | Derive actor from Clerk gate, never from form input. |
| Allowing arbitrary tool/provider fields | Data exfiltration, unsafe execution, policy bypass | Server-owned allowlists and capability resolution. |
| Treating URL-only or user-authored citation as evidence | False findings influence candidate offerings | Require persisted canonical source identity/content support and fail closed. |
| Retiring/deleting without lifecycle authorization | Historical runs disappear or future runs become inconsistent | Staff-gated lifecycle transitions; no destructive history deletion. |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Current version and history look identical | Staff cannot tell what future runs use | Label current version, version number, created time, and read-only history clearly. |
| Save appears successful while configuration is not runnable | Trust loss and failed launch later | Validate on save, show field-level errors, and distinguish draft-invalid from active. |
| Retirement hides prior runs | Staff lose audit context | Block future launches but keep versions, runs, results, and review packets inspectable. |

## "Looks Done But Isn't" Checklist

- [ ] **Creation:** Agent is persisted with stable identity and a valid current version — verify reload and direct action validation.
- [ ] **Versioning:** Existing runs retain old config after edit — verify snapshot comparison, not only UI history.
- [ ] **Compatibility:** Both Company and Persona fixed templates still run — verify backward-compatible target flows.
- [ ] **Security:** Malicious instruction/schema/citation cases fail closed — verify live Signal/Offering/link rows remain unchanged.
- [ ] **Review:** Exactly one whole-run decision remains authoritative — verify competing/concurrent decisions.
- [ ] **Lifecycle:** Retire blocks new launches but preserves history — verify reactivation uses the same latest version.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Mutable version corruption | HIGH | Freeze affected runs, restore from immutable audit rows, add snapshot regression, and prevent in-place updates. |
| Invalid activatable config | MEDIUM | Mark version non-runnable, preserve audit trail, fix through a new version, and revalidate server-side. |
| Review/no-write bypass | HIGH | Quarantine affected output, audit live-row diffs, disable the path, and restore the existing v1.7 projection boundary. |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Cosmetic/non-immutable history | Phase 37 | Version append and old-run snapshot tests. |
| Unrunnable configurations | Phase 37/38 | Server validation matrix and compatible/incompatible target tests. |
| Unbounded schema/cost | Phase 38 | Schema policy tests and bounded-array/depth cases. |
| Review/no-live-write bypass | Phase 38/39 | Confirm/Dismiss idempotency plus DB row-hash no-write tests. |
| Prompt/tool policy escape | Phase 39 | Adversarial fixture suite and authenticated E2E. |

## Sources

- [Exa Agent API guide](https://exa.ai/docs/reference/agent-api-guide) — bounded arrays, effort/cost, structured output, grounding, and lifecycle.
- [Exa Create a Run](https://exa.ai/docs/reference/agent-api/create-a-run) — input/schema fields, status/error contract, and data-source configuration.
- [Exa Agent overview](https://exa.ai/docs/reference/agent-api/overview) — async lifecycle, nullable unsupported fields, grounding, and limits.
- [Exa Connect overview](https://exa.ai/docs/reference/agent-api/connect/overview) — schema/query-guided tool selection and separate sources.
- Exa Agent Playground URL supplied by the milestone brief — login redirect limited direct UI observation.

---
*Pitfalls research for: custom structured-research agent constructors*
*Researched: 2026-08-09*
