# Phase 27: Verification Gate - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-04
**Phase:** 27-Verification Gate
**Areas discussed:** Live E2E scope, structuredOutputs flip, Browser UAT scope, Matrix widening scope

---

## Live E2E scope (VER-02/03)

### Q1: Failing openrouter-only-chain.test.ts handling

| Option | Description | Selected |
|--------|-------------|----------|
| Investigate as Phase 27 task | Root-causing IS verification-gate work; fold into VER-03's task list | ✓ |
| Fix now, before discussing further | Stop and debug in this session | |
| Flag but defer | Note as known issue, investigate later | |

**User's choice:** Investigate as Phase 27 task
**Notes:** Confirmed the failure predates and is unrelated to Phase 26's diff (`git diff --stat` zero overlap), all 4 provider keys present locally.

### Q2: Live-E2E provider scope

| Option | Description | Selected |
|--------|-------------|----------|
| All 4 providers, full re-proof | Live E2E + child-env for all 4 — strongest, most credits | |
| Only the 2 new providers | NousResearch + OpenCode get full live proof; Anthropic/OpenRouter already proven Phase 22 | ✓ |
| Child-env isolation only, no live Analyze | Cheap key-isolation proof only, skip full Analyze round trip | |

**User's choice:** Only the 2 new providers

### Q3: VER-02 test target

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse/extend the same seeded test company | Consistent with D-22-02, no new fixture | ✓ |
| New seeded company per provider | Separate deterministic companies, full isolation | |

**User's choice:** Reuse/extend the same seeded test company

### Q4: VER-03 isolation test pattern

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, same child-env pattern | Mirror openrouter-only-chain.test.ts exactly | ✓ |
| Something else | Different approach | |

**User's choice:** Yes, same child-env pattern

---

## structuredOutputs flip (VER-05/RUN-06)

### Q1: Flip decision

| Option | Description | Selected |
|--------|-------------|----------|
| Flip if probe succeeds | Complete RUN-06's intent this phase | ✓ |
| Probe + document only, no flip | Defer flip to a future change | |

**User's choice:** Flip if probe succeeds

### Q2: Per-instance vs all-or-nothing

| Option | Description | Selected |
|--------|-------------|----------|
| Per-instance | Each of the 3 instances flips independently on its own probe result | ✓ |
| All-or-nothing | Only flip if all 3 pass | |

**User's choice:** Per-instance

### Q3: Probe form

| Option | Description | Selected |
|--------|-------------|----------|
| Vitest live-key test | skipIf(!hasLiveKeys), consistent with existing precedent | ✓ |
| Standalone script | One-off tsx probe, manual run | |

**User's choice:** Vitest live-key test

### Q4: Probe validation strictness

| Option | Description | Selected |
|--------|-------------|----------|
| Production schema round-trip | Use the actual Zod schema from runAgent.ts's Output.object | ✓ |
| Simple JSON-shape check | Minimal test schema | |

**User's choice:** Production schema round-trip

---

## Browser UAT scope (VER-05)

### Q1: Playwright extension vs manual UAT

| Option | Description | Selected |
|--------|-------------|----------|
| Extend Playwright spec | Add 4-provider assertions to existing spec — permanent automated gate | ✓ |
| Manual UAT only | Keep as human-verified items like Phase 26's pattern | |
| Both | Playwright for mechanical checks, manual for subjective "looks right" items | |

**User's choice:** Extend Playwright spec

### Q2: Overlap with Phase 26's pending HUMAN-UAT items

| Option | Description | Selected |
|--------|-------------|----------|
| Explicitly close Phase 26's items | Design the 4 new assertions to map 1:1 onto Phase 26's 4 pending items | ✓ |
| Keep them separate | Phase 27 does its own coverage; Phase 26's items verified independently | |

**User's choice:** Explicitly close Phase 26's items

### Q3: Phase 26 code-review Critical findings (CR-01/CR-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Fix in Phase 27 | Directly affects the Save action Phase 27's tests exercise | ✓ |
| Leave as separate debt | Out of scope for "Verification Gate", track separately | |

**User's choice:** Fix in Phase 27
**Notes:** Folded in as "fixing already-shipped work the verification touches," not new capability.

---

## Matrix widening scope (VER-01)

### Q1: VER-01's job

| Option | Description | Selected |
|--------|-------------|----------|
| Audit + consolidate only | Verify existing coverage, consolidate if scattered, add only genuinely-missing cases | ✓ |
| Add specific new cases | User has particular gaps in mind | |

**User's choice:** Audit + consolidate only
**Notes:** Mirrors Phase 22's D-22-06 precedent exactly.

### Q2: Opencode dual-listed no-flip canary re-verification

| Option | Description | Selected |
|--------|-------------|----------|
| Implicitly covered | Existing canary, audit step runs full suite and confirms | ✓ |
| Explicit named check | Call out specifically in the plan given it's a regression-lock | |

**User's choice:** Implicitly covered

---

## Claude's Discretion

- Exact file/test placement for the two new child-env isolation tests (sibling files vs shared harness)
- structuredOutputs probe's exact file location and whether one file covers all 3 instances or 3 separate probes
- Root-cause investigation depth for the failing openrouter-only-chain.test.ts — if the underlying live API genuinely regressed and isn't fixable from this repo, document in VERIFICATION.md rather than force a fix
- Exact CR-01/CR-02 fix implementation mechanism, must not change the Server Action's validated order
- How Phase 26's 26-HUMAN-UAT.md gets marked resolved once Phase 27's Playwright spec proves the 4 items

## Deferred Ideas

None — discussion stayed within phase scope.
