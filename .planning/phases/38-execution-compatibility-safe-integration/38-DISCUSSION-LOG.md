<!-- generated-by: gsd-doc-writer -->
# Phase 38: Execution Compatibility & Safe Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `38-CONTEXT.md` — this log preserves the launch-resolution decisions.

**Date:** 2026-08-11
**Phase:** 38-execution-compatibility-safe-integration
**Areas discussed:** launch ordering, agent selection, fixed-template default, compatibility filtering, multiple matching custom agents, fixed-path fallback, unresolved execution details

---

## Launch ordering

| Option | Description | Selected |
|--------|-------------|----------|
| Agent first | Choose an agent before selecting the Practice Area | |
| Practice Area first | Select Practice Area first, then resolve the available agent choices | ✓ |

**User's choice:** Practice Area is selected first.
**Notes:** The selected Practice Area is part of launch resolution and drives the custom-agent compatibility filter.

---

## Agent picker contents

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed template only | Preserve the v1.7 fixed-template picker with no custom-agent choices | |
| Fixed template plus matching active custom agents | Include the fixed v1.7 template and active custom agents compatible with the selected target type and Practice Area | ✓ |
| All active custom agents | Show every active custom agent regardless of target type or Practice Area | |

**User's choice:** The agent picker then includes the fixed v1.7 template plus matching active custom agents.
**Notes:** Filtering is server-owned compatibility behavior, not a client-only display filter.

---

## Default selection

| Option | Description | Selected |
|--------|-------------|----------|
| First custom agent | Default to an active custom agent when one exists | |
| Fixed v1.7 template | Keep the existing fixed template as the default selection | ✓ |
| No default | Require staff to choose an agent explicitly | |

**User's choice:** The fixed v1.7 template remains the default.
**Notes:** This preserves the existing launch path and makes custom execution an explicit opt-in.

---

## Custom-agent compatibility filter

| Option | Description | Selected |
|--------|-------------|----------|
| Target type only | Match Company or Persona, but ignore Practice Area | |
| Practice Area only | Match Practice Area, but ignore Company/Persona target type | |
| Target type and selected Practice Area | Include only custom agents matching both dimensions | ✓ |

**User's choice:** Custom agents are filtered by target type and selected Practice Area.
**Notes:** An incompatible choice must be rejected before an active run is created; it must not fail later inside execution.

---

## Multiple matching custom agents

| Option | Description | Selected |
|--------|-------------|----------|
| Enforce one active custom agent per target type + Practice Area | Prevent ambiguity by making the combination unique | |
| Allow multiple and require explicit staff choice | Preserve multiple active versions/agents and let staff choose one | ✓ |
| Automatically merge matching agents | Combine instructions/capabilities into one launch | |

**User's choice:** Multiple active custom agents for the same target type + Practice Area are allowed; staff explicitly chooses one.
**Notes:** The system must not silently merge, rank, or auto-select among matching custom agents. The fixed template remains the default even when several custom agents are available.

---

## No custom-agent selection

| Option | Description | Selected |
|--------|-------------|----------|
| Require a custom agent | Remove the fixed path once custom agents exist | |
| Preserve the existing fixed-template path | If no custom agent is selected, launch exactly as the current fixed-template flow does | ✓ |
| Auto-create a custom copy | Convert the fixed selection into a custom version before launch | |

**User's choice:** If no custom agent is selected, the existing fixed-template path remains unchanged.
**Notes:** Backward compatibility includes the existing fixed template keys, target-scoped semantics, snapshots, durable execution, evidence, review, and confirmed-only candidate behavior.

---

## Scope of this discussion

The discussion resolved launch resolution only. It did not decide the complete
snapshot schema, the detailed structured-output runtime integration, or the
final verification boundary beyond the requirements and inherited Phase 34-36
contracts. Those items remain for research/planning discretion or later
discussion unless already locked by the canonical requirements and prior phase
contexts.

## Claude's Discretion

- Exact API/query/component names and payload shape for Practice Area-first options and selection.
- Exact compatibility-check decomposition and pre-run error mapping.
- Exact snapshot extension, structured-output adapter, and deterministic verification seams, within the unresolved scope stated above.

## Deferred Ideas

- Bulk, scheduled, automatic, arbitrary-provider/tool, Exa, per-finding curation, auto-confirmation, direct live-write, outreach/CRM, Hypotheses, and Persona Discovery capabilities remain out of scope.
