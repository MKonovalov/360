# Phase 18: Verification Gate - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-02
**Phase:** 18-verification-gate
**Areas discussed:** Failover matrix gaps, Forced-fail primary UAT, Vercel preview deploy, Looks-done-but-isn't checklist

---

## Failover Matrix Gaps (VER-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Fill gaps + matrix (Recommended) | Add missing loop-level cases (401, 403, output/schema, RetryError-404) to runAgent.test.ts + document the VER-01 matrix artifact | ✓ |
| Accept existing coverage | Existing classifyModelError + runAgent tests already prove the taxonomy; map existing tests to VER-01 with no new code | |
| New matrix file | One consolidated failover-matrix test file as the single VER-01 artifact | |

**User's choice:** Fill gaps + matrix
**Notes:** Existing coverage proven at `classifyModelError` level (400/401/403/422 → never eligible, output/schema never eligible) but 401/403 and output/schema not tested at the `runAgent` loop level; no explicit VER-01 matrix artifact exists.

---

## Forced-Fail Primary UAT (VER-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Env-gated fail hook (Recommended) | ANALYZE_FORCE_PRIMARY_FAIL-style env hook throwing a failover-eligible error on the primary attempt, set on a preview deploy only | |
| Temporary invalid-model trick | Temporarily add a stale/invalid id to catalog + allowlist, save as primary, observe fallback, revert | |
| Vitest-only proof | Rely on loop-level tests (RetryError-404, exhaustion) for forced-fail evidence; browser proves only happy-path model_used | ✓ |

**User's choice:** Vitest-only proof
**Notes:** No forced-fail mechanism is built. This narrows ROADMAP SC-3's "forced-fail primary shows the fallback serving" clause — planner/verifier must treat Vitest loop tests as the forced-fail evidence and record SC-3 as satisfied-by-extension.

---

## Vercel Preview Deploy (VER-04)

| Option | Description | Selected |
|--------|-------------|----------|
| PR → Vercel auto-preview (Recommended) | Push phase branch → PR → Vercel GitHub integration auto-builds preview; verify /settings model list on preview URL | ✓ |
| Local CLI --prebuilt deploy | Install vercel CLI, `vercel deploy --prebuilt` after next build, verify from terminal | |
| Production deploy check | Deploy to production and verify on the live domain | |

**User's choice:** PR → Vercel auto-preview
**Notes:** Project is already Vercel-linked (360-arclumen, Node 24.x). No local CLI needed; the `deploy-to-vercel` / `vercel-cli-with-tokens` skills stay as a fallback.

---

## Looks-Done-But-Isn't Checklist

| Option | Description | Selected |
|--------|-------------|----------|
| Map existing checklist (Recommended) | Map the 12 PITFALLS.md checklist items onto VER-01..04 as the verification backbone, marked covered-by-existing-test vs new-work | ✓ |
| Rewrite fresh checklist | Treat PITFALLS.md list as stale; write a new 12-item checklist from current codebase state | |
| Reference only, no mapping | Use the PITFALLS.md list as-is with no per-item traceability | |

**User's choice:** Map existing checklist
**Notes:** The `## Looks Done But Isn't Checklist` (12 items) already exists in `.planning/research/PITFALLS.md` (~line 340). Phase 18 maps each item onto VER-01..04; no new checklist content.

---

## Claude's Discretion

- VER-01 matrix artifact format (single MD file vs inline table in test file)
- VER-02 organization: whether existing catalog/modelConfig coverage needs additive cases or just a mapping artifact
- Which checklist items are covered by existing tests vs need new work
- VER-03 live UAT target (local dev vs preview URL) — 17-UAT precedent used local dev
- How Phase 17's deferred form `<human-check>` folds into VER-03

## Deferred Ideas

- **Live forced-fail UAT** (browser-level fallback proof) — future milestone, needs env-gated fail hook or test infra
- **`--prebuilt` / local-CLI deploy flow** — stays available via `vercel-cli-with-tokens` skill as fallback
