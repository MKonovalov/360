# Phase 37 Nyquist Validation Contract

**Phase:** Custom Agent Definition, Versioning & Lifecycle
**Validation mode:** deterministic unit/component/action tests plus guarded Neon integration; no application-source changes are made by this artifact.
**Database disposition:** `TEST_DATABASE_URL` is unavailable in the planning environment. Integration suites must skip/report `blocked: TEST_DATABASE_URL unavailable`; skipped DB tests are never recorded as passing evidence.
**Deferred evidence:** authenticated browser/E2E execution, adversarial execution proof, review/candidate proof, and runtime compatibility belong to Phases 38–39.

## Nyquist Rules

1. Every implementation task has a focused automated command below.
2. Every wave has a sampling command and a static/scope check where applicable.
3. The canonical integration path is **only** `src/lib/db/queries/analysisTemplates.integration.test.ts`.
4. Final gates run independently: focused matrix, guarded canonical integration, `npm exec tsx scripts/phase37-scope-audit.ts`, `npx tsc --noEmit`, `npm run build`, and `git diff --check`.
5. Existing baseline TypeScript errors in `src/lib/db/queries/analysisProposalDerivation.test.ts` are recorded as blocked if unchanged; they are not silently treated as a Phase 37 pass.

## Plan and Task Mapping

| Wave | Plan/task | Scope | Automated command | Expected evidence |
|---:|---|---|---|---|
| 1 | 37-01 Task 1 | Custom input, PA ID, effort, bounded schema, additive output | `npm test -- src/lib/analysis/customAgentContracts.test.ts` | Valid/invalid contract cases, exact bounds, field paths, no client policy fields |
| 1 | 37-01 Task 2 | Capability registry and safe projection | `npm test -- src/lib/analysis/capabilityPresets.test.ts src/lib/analysis/customAgentContracts.test.ts` | `none`/`web-research` only, opaque IDs, compatibility rejection, no credential/provider leakage |
| 2 | 37-02 Task 1 | Additive schema/migration and fixed-row preservation | `npm test -- src/lib/db/queries/analysisTemplates.integration.test.ts` | Guarded migration proof; fixed rows remain unchanged; blocked if DB unavailable |
| 2 | 37-02 Task 2 | Custom latest/history/append/lifecycle queries | `npm test -- src/lib/db/queries/analysisTemplates.test.ts src/lib/db/queries/analysisTemplates.integration.test.ts` | Atomic retired v1, immutable append, conflict/reload, lifecycle-only status, retention |
| 3 | 37-03 Task 1 | Gate-first custom action contract | `npm test -- src/app/actions/analysisTemplates.test.ts` | Auth ordering, exactly one verified `practiceAreaId`, closed input, actor derivation, safe errors |
| 3 | 37-03 Task 2 | Custom create/save/status actions | `npm test -- src/app/actions/analysisTemplates.test.ts src/lib/analysis/customAgentContracts.test.ts` | Retired-first create, retired edit, explicit activation, no fixed-action widening |
| 4 | 37-04 Task 1 | Fixed/custom composition and editor contract | `npm test -- src/components/agents/agent-management.test.tsx src/components/agents/custom-agent-editor.test.tsx src/components/agents/agent-template-card.test.tsx` | Fixed-first ordering, exactly one create PA selection, read-only edit PA, ordered sections, inline errors, no clone/delete/launch override |
| 4 | 37-04 Task 2 | `/agents` UI implementation | `npm test -- src/components/agents/agent-management.test.tsx src/components/agents/custom-agent-editor.test.tsx src/components/agents/agent-template-card.test.tsx && npm run build` | UI/component regression and production compilation; authenticated E2E remains Phase 39 |
| 5 | 37-05 Task 1 | Cross-layer matrix and fixed consumers | `npm test -- src/lib/analysis/templateContracts.test.ts src/lib/analysis/customAgentContracts.test.ts src/lib/db/queries/analysisTemplates.test.ts src/lib/db/queries/analysisTemplates.integration.test.ts src/app/actions/analysisTemplates.test.ts src/app/api/analysis-options/route.test.ts src/app/api/analysis-preview/route.test.ts src/app/api/analysis-runs/route.test.ts src/lib/analysis/subjects.test.ts src/components/agents/agent-management.test.tsx src/components/agents/custom-agent-editor.test.tsx` | Fixed Company/Persona options, preview, run, and subject resolution remain compatible; custom rows excluded from fixed paths |
| 5 | 37-05 Task 2 | Scope audit and final gates | See command block below | Non-vacuous scope scan, all final commands run, blocked DB/baseline results recorded honestly |

## Wave Sampling

### Wave 1

```text
npm test -- src/lib/analysis/customAgentContracts.test.ts src/lib/analysis/capabilityPresets.test.ts
```

### Wave 2

```text
npm test -- src/lib/db/queries/analysisTemplates.test.ts
npm test -- src/lib/db/queries/analysisTemplates.integration.test.ts
```

The second command is guarded by the test suite. With no `TEST_DATABASE_URL`, report `blocked/skipped`, not pass.

### Wave 3

```text
npm test -- src/app/actions/analysisTemplates.test.ts src/lib/analysis/customAgentContracts.test.ts
npx tsc --noEmit
```

If the known unrelated baseline errors remain, typecheck is blocked and must be reported as such.

### Wave 4

```text
npm test -- src/components/agents/agent-management.test.tsx src/components/agents/custom-agent-editor.test.tsx src/components/agents/agent-template-card.test.tsx
npm run build
```

Component tests are the Phase 37 UX evidence. Authenticated browser interaction and visual/E2E evidence is intentionally Phase 39 scope.

### Wave 5 / final gate

Run each command independently so one blocked prerequisite does not hide the remaining evidence:

```text
npm test -- src/lib/analysis/templateContracts.test.ts src/lib/analysis/customAgentContracts.test.ts src/lib/db/queries/analysisTemplates.test.ts src/app/actions/analysisTemplates.test.ts src/app/api/analysis-options/route.test.ts src/app/api/analysis-preview/route.test.ts src/app/api/analysis-runs/route.test.ts src/lib/analysis/subjects.test.ts src/components/agents/agent-management.test.tsx src/components/agents/custom-agent-editor.test.tsx
npm test -- src/lib/db/queries/analysisTemplates.integration.test.ts
npm exec tsx scripts/phase37-scope-audit.ts
npx tsc --noEmit
npm run build
git diff --check
```

Expected dispositions:

- Focused matrix: pass required.
- Canonical integration suite: pass only with `TEST_DATABASE_URL`; otherwise blocked/skipped.
- Scope audit: pass required.
- `npx tsc --noEmit`: pass required for changed files; record the known unrelated baseline errors if still present.
- `npm run build`: pass required.
- `git diff --check`: pass required.

## Database Guards

The only DB integration artifact is `src/lib/db/queries/analysisTemplates.integration.test.ts`. It must:

- skip safely when `TEST_DATABASE_URL` is absent;
- use the disposable database setup already established by Phase 36;
- seed/assert the two fixed templates and a custom identity/version;
- prove fixed-row compatibility after the additive migration;
- prove atomic custom identity + retired v1 creation;
- prove `(template_id, version)` uniqueness and conflict/reload behavior;
- prove rename/schema/capability edits append complete versions;
- prove retired edits remain retired and reactivation creates no content version;
- prove no historical version/delete/run snapshot mutation.

No separate `analysisSchema.integration.test.ts` path is planned.

## UX Evidence Contract

Phase 37 must provide automated component evidence for:

- fixed Company and Persona templates rendered first and unchanged;
- separated Custom Agents section and Create action;
- create editor section order;
- server-loaded Practice Area options with exactly one selected `practiceAreaId`;
- edit-mode read-only Practice Area and no launch/preview override;
- query/objective distinct from behavior/system instruction;
- bounded structured-output controls, additive-channel explanation, and inline field errors;
- capability cards showing only safe metadata;
- review summary showing Version 1 — Retired;
- current/history distinction with actor and timestamp;
- lifecycle controls without clone/delete actions.

Authenticated `/agents` browser flow, actual create/edit persistence, runtime launch compatibility, adversarial proof, whole-run review, candidate aggregation, and Company/Persona E2E are explicitly handed to Phases 38–39.

## Scope and Handoff

The Phase 38 handoff is the normalized immutable custom version read model: opaque identity, immutable target, fixed `practiceAreaId`, latest version, authored query, behavior, optional bounded schema, approved effort, opaque capability IDs, actor, timestamp, and lifecycle. It does not include a client-selected checklist, resolved provider/tool, credentials, execution policy, run ID, review state, candidate state, or launch-time Practice Area override.

## Plan 37-05 Execution Evidence

Executed 2026-08-09 with the required commands run independently:

| Gate | Result | Evidence / limitation |
|---|---|---|
| Focused cross-layer matrix | **PASS** | Plan 37-05 baseline: 10 files, 127 tests passed. Post-review remediation: the same 10 files, 131 tests passed, preserving the original evidence while adding fixed-kind resolver and editor validation regressions. |
| Canonical guarded integration | **BLOCKED** | `npm test -- src/lib/db/queries/analysisTemplates.integration.test.ts` reported 1 contract test passed and 5 database tests skipped because `TEST_DATABASE_URL unavailable`. |
| Scope audit | **PASS** | `npm exec tsx scripts/phase37-scope-audit.ts`; 14 selected tracked implementation files, zero findings. |
| Typecheck | **BLOCKED** | `npx tsc --noEmit` found three unchanged `analysisProposalDerivation.test.ts` baseline errors. |
| Build | **PASS** | `npm run build` completed successfully. |
| Diff check | **PASS** | `git diff --check` completed with no output. |
| LSP | **UNAVAILABLE** | TypeScript server is not installed; installation was previously declined. |

The evidence intentionally distinguishes deterministic Phase 37 proof from
blocked Neon persistence and baseline typecheck results. Phase 38 runtime and
Phase 39 adversarial/review/candidate/authenticated-E2E responsibilities remain
explicit handoffs, not implicit passes.
