# Phase 36: Agent Management & End-to-End Verification - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-08
**Phase:** 36-agent-management-end-to-end-verification
**Areas discussed:** template versioning and lifecycle, management UI placement, verification boundary, adversarial verification

---

## Template Versioning and Lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| Recommended policy | Save creates the next immutable version; it becomes current immediately; history is read-only; lifecycle is template-level; retiring the only active target template is allowed. | ✓ |
| Guard the last active template | Prevent retiring the only active template for a target type. | |

**User's choice:** Recommended policy.
**Notes:** Existing runs retain their snapshots. Retire blocks future launches; reactivation restores availability.

---

## Management UI Placement

> **Superseded during planning:** the final canonical decision in `36-CONTEXT.md`
> and `36-PLAN-CHECK.md` is `/agents` directly under Manage. The table below is
> retained only as the earlier discussion snapshot.

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated Agents screen | Add `/reviews/agents` beneath Manage → Reviews with two template rows/cards, edit/lifecycle actions, and read-only history. | ✓ |
| Agents section inside Reviews | Add an Agents tab/section to the existing `/reviews` page. | |
| Other | A different route/navigation shape. | |

**User's choice:** Dedicated Agents screen at `/reviews/agents`.
**Notes:** This is template management, not an agent-construction playground.

---

## Verification Boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Hybrid | Deterministic automated fixtures plus authenticated Playwright against the real app/database and deterministic executor/packet; external provider smoke is non-gating. | ✓ |
| Real external execution | Require approved model and Firecrawl credentials for both browser flows. | |
| Fixture-only | Use automated integration tests without a live browser flow. | |

**User's choice:** Hybrid.
**Notes:** Both Company and Persona flows must prove preview, durable execution, result inspection, one decision, and confirmed-only candidate visibility.

---

## Adversarial Verification

| Option | Description | Selected |
|--------|-------------|----------|
| Automated adversarial fixtures | Cover malicious content, unsafe citations, unsupported URLs, duplicate evidence, and forbidden writes/tools; assert fail-closed behavior and unchanged live Signal/Offering rows. | ✓ |
| Fixtures plus browser demonstration | Add a visible authenticated UAT case for unsafe content. | |
| Other | A different adversarial proof requirement. | |

**User's choice:** Automated adversarial fixtures only.
**Notes:** No separate browser demonstration is required for adversarial cases.

---

## Claude's Discretion

Exact query/action/component names, fixture identifiers, deterministic test seam, browser seed/reset mechanics, UI primitive choice, and test partitioning remain implementation/planning choices.

## Deferred Ideas

Required live provider/Firecrawl smoke remains optional and non-gating until policy and credentials are available. Dynamic agent construction and other v1.7 out-of-scope features remain deferred.
