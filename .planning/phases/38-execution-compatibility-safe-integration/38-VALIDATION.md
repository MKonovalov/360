<!-- generated-by: gsd-doc-writer -->
---
phase: 38
slug: execution-compatibility-safe-integration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-11
---

# Phase 38 — Validation Strategy

> Per-phase validation contract for compatibility-safe custom-agent execution.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10; Workflow Vitest configuration; Playwright 1.62.1 remains the authenticated browser harness for the Phase 39 handoff |
| **Config file** | `vitest.config.ts`; `vitest.workflow.config.ts` |
| **Quick run command** | `npm test -- --run src/lib/analysis/customAgentContracts.test.ts src/lib/analysis/capabilityPresets.test.ts src/lib/analysis/snapshots.test.ts` |
| **Full suite command** | `npm test` |
| **DB/Workflow command** | `npm run test:workflow` only when `TEST_DATABASE_URL` is available; otherwise blocked/not-run |
| **Migration checks** | `npm run db:check && npm run db:validate` when schema or migration files change |
| **Build command** | `npm run build` |
| **Typecheck command** | No dedicated `typecheck` script exists in `package.json`; do not invent one. Use the repository's existing build command for the project build gate. |
| **Estimated runtime** | Targeted unit checks should remain within the existing Vitest feedback loop; measure the full-suite and Workflow durations from execution evidence. |

## Sampling Rate

- **After every task commit:** Run the targeted Vitest command for the changed contract, resolver, snapshot, route, or executor seam.
- **After every plan wave:** Run `npm test`; if schema or migration files changed, also run `npm run db:check && npm run db:validate`.
- **Before phase verification handoff:** Run `npm test`, `npm run build`, the migration checks when applicable, and `npm run test:workflow` only when `TEST_DATABASE_URL` is supplied.
- **Max feedback latency:** Preserve the existing targeted-test feedback loop; record measured command durations in the evidence ledger rather than asserting an unmeasured limit.
- **Prerequisite rule:** Missing `TEST_DATABASE_URL`, live Firecrawl/provider credentials, or Clerk shell credentials produces `blocked` or `not-run` evidence, never a pass.

## Validation Layers

### Deterministic unit and contract layer

This is the always-runnable gate. It uses injected model/executor dependencies and fixture data, not live providers or a live database. It must cover:

- fixed-vs-custom discriminated selection, Practice Area-first option projection, explicit choice among multiple compatible custom agents, and fixed-template omission compatibility;
- target and Practice Area/version/lifecycle compatibility rejection before `createAnalysisRun` is called;
- active target-scoped checklist derivation and launch-time re-resolution;
- server-owned effort, limits, model chain, capability, tool, provider, and policy resolution;
- bounded shallow structured-output acceptance, reserved-field/collision rejection, and preservation of the grounded envelope;
- immutable snapshot mutation/replay cases for custom version, resolved configuration, target, checklist, model chain, and policy;
- duplicate-start and safe-failure decision matrices at the pure contract/query seams.

Existing deterministic anchors include `src/lib/analysis/customAgentContracts.test.ts`, `src/lib/analysis/capabilityPresets.test.ts`, `src/lib/analysis/snapshots.test.ts`, `src/lib/analysis/checklist.test.ts`, `src/lib/analysis/execution.test.ts`, and `src/lib/db/queries/analysisRuns.test.ts`. New Phase 38 compatibility and adapter cases are Wave 0 gaps until added.

### Route and snapshot contract layer

Route/resolver tests must prove that every malformed, stale, retired, target-incompatible, Practice Area-incompatible, effort-invalid, capability-invalid, provider/tool-invalid, or output-policy-invalid custom selection returns a non-active-run response and does not call `createAnalysisRun`. A valid fixed and valid custom selection must each resolve once, build one complete snapshot, and converge on the same run creation input boundary.

Snapshot tests must mutate the source custom version, model settings, active signal rows, and execution policy after snapshot construction and assert that the run snapshot remains unchanged. They must not lock an exact field expansion or structured-output nesting that remains a planning discretion; they must lock immutability, server ownership, boundedness, and fixed/custom convergence.

### Database and Workflow integration layer

When `TEST_DATABASE_URL` exists, run `npm run test:workflow` against deterministic fixtures for custom template/version rows, active checklist resolution, atomic run creation, duplicate active-run protection, guarded lifecycle transitions, claim/reload/replay, bounded failure, recovery, and packet-before-completion behavior. Run `npm run db:check && npm run db:validate` for any schema/migration change.

The integration layer is prerequisite-gated. If `TEST_DATABASE_URL` is absent, the unit and fixture layer may pass, but Neon persistence and Workflow evidence must be recorded as `blocked`/`not-run`, not passed. `npm run db:push` is not production proof and is not a substitute for this gate.

### Live provider and authenticated browser boundaries

Live Firecrawl/provider execution is non-gating unless the required live credentials and approved policy are present. Without them, use deterministic injected executor fixtures and record the live smoke as `not-run` with reason `policy_or_credentials_unavailable`.

Clerk shell credentials are not a Phase 38 local pass condition. Authenticated Company/Persona browser proof, adversarial input, no-live-write invariants, whole-run review idempotency, confirmed-only aggregation, and the canonical `/agents` flow belong to the Phase 39 handoff. Missing Clerk shell credentials therefore remain `blocked`/`not-run`, not passed.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 38-01 | TBD | 0 | VER-03 | stale edit / replay | Selected immutable version and all resolved launch inputs remain reproducible after source mutation | unit + snapshot | `npm test -- --run src/lib/analysis/snapshots.test.ts` plus new custom snapshot cases | ✅ existing anchor; ❌ custom cases W0 | ⬜ pending |
| 38-02 | TBD | 1 | VAL-02 | forged target selection | Company/Persona target mismatch is rejected before active-run creation | route/resolver unit | `npm test -- --run <Phase 38 compatibility test>` | ❌ W0 | ⬜ pending |
| 38-03 | TBD | 1 | VAL-03 | stale/retired signals | Only active signals for the selected target and Practice Area enter the launch checklist/schema snapshot; launch re-resolves current data | unit + route + DB integration | targeted Vitest checklist/compatibility tests; `npm run test:workflow` when `TEST_DATABASE_URL` exists | ✅ checklist anchor; ❌ custom launch cases W0 | ⬜ pending |
| 38-04 | TBD | 1 | VAL-04 | provider/tool injection | Server policy wins for effort, limits, model chain, capabilities, tools, and providers; authored arbitrary fields are rejected | contract + resolver unit | `npm test -- --run src/lib/analysis/customAgentContracts.test.ts src/lib/analysis/capabilityPresets.test.ts <Phase 38 compatibility test>` | ✅ contract anchors; ❌ launch matrix W0 | ⬜ pending |
| 38-05 | TBD | 2/3 | VAL-05 | output-channel collision | Shallow bounded custom fields are additive; reserved grounding, evidence, review, citation, finding, and candidate channels remain server-owned | contract + executor unit | `npm test -- --run src/lib/analysis/customAgentContracts.test.ts src/lib/analysis/execution.test.ts` | ✅ partial anchors; ❌ adapter cases W0 | ⬜ pending |
| 38-06 | TBD | 3 | RUN-01 | parallel executor path | Fixed and custom launches converge on the existing snapshot, Workflow, grounded executor, evidence packet, review, and candidate read path without Exa | fixture + Workflow integration | `npm run test:workflow` with `TEST_DATABASE_URL`; deterministic fixture path otherwise | ✅ v1.7 anchors; ❌ custom cases W0 | ⬜ pending |
| 38-07 | TBD | 3/4 | RUN-02 | duplicate/replay/failure race | Duplicate active starts, bounded attempts, safe failure, claim recovery, and replay behavior apply to fixed and custom template identities | unit + DB/Workflow integration | targeted `analysisRuns` tests; `npm run test:workflow` with `TEST_DATABASE_URL` | ✅ existing run anchors; ❌ custom identity matrix W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · 🔒 blocked prerequisite*

## Evidence Artifacts

Each validation run must retain enough evidence to distinguish deterministic proof from prerequisite-gated proof:

- command, date, environment classification, exit status, and duration for targeted tests, `npm test`, `npm run build`, and applicable migration checks;
- the deterministic compatibility matrix, including rejection-before-`createAnalysisRun` assertions and fixed/custom regression results;
- snapshot mutation/replay assertions showing the selected immutable version and server-resolved inputs do not change after source edits;
- when `TEST_DATABASE_URL` exists, sanitized fixture identifiers and Workflow/DB results for atomic creation, duplicate protection, claim/recovery, safe failure, and lifecycle behavior;
- when live credentials are supplied and policy permits, a separately labeled provider smoke result; otherwise a `not-run` record naming the missing credential/policy prerequisite;
- a Phase 39 handoff record identifying the remaining authenticated, adversarial, no-live-write, review-idempotency, confirmed-only aggregation, and Company/Persona browser checks.

Evidence must not contain secrets, database URLs, Clerk/session data, raw unrestricted model output, private reasoning, or unrestricted retrieved pages.

## Pass, Blocked, and Not-Run Rules

| Classification | Meaning |
|----------------|---------|
| **Pass** | The named deterministic or prerequisite-enabled command completed successfully and its assertions/evidence are present. |
| **Blocked** | The validation requires an unavailable prerequisite, especially `TEST_DATABASE_URL` for Neon/Workflow integration or Clerk shell credentials for authenticated browser setup. The behavior is unproven. |
| **Not-run** | The check is intentionally outside this phase or optional, including live Firecrawl/provider smoke without credentials or approved policy. Record the reason; do not convert it to pass. |
| **Fail** | The command ran and an assertion, safety boundary, migration check, build, or fixed-template regression failed. |

Specifically, absent `TEST_DATABASE_URL` blocks database/Workflow evidence; absent live Firecrawl/provider credentials makes live provider smoke not-run; and absent Clerk shell credentials blocks authenticated browser evidence. None of these conditions may satisfy RUN-01/RUN-02 or be reported as a successful live proof.

## Phase 39 Handoff Boundary

Phase 38 hands off deterministic contracts, compatibility fixtures, snapshot immutability evidence, fixed-template regression evidence, and (when available) DB/Workflow integration evidence. Phase 39 owns broad adversarial verification, server-derived actor authorization, prompt/evidence/tool fail-closed behavior, no live Signal/Offering/signal-offering-link writes, one whole-run review idempotency, confirmed-only aggregation with provenance, canonical `/agents` routing, and authenticated Company and Persona custom-agent E2E.

Do not move the Phase 39 review-boundary or authenticated custom-agent E2E into this phase merely to claim RUN-01 or RUN-02. Do not claim live provider, Neon, Workflow, or authenticated browser evidence without its prerequisites.

## Wave 0 Requirements

- [ ] Compatibility resolver/route tests for fixed-vs-custom selection and pre-run rejection.
- [ ] Snapshot tests for custom version identity and edit/lifecycle/checklist/model/policy replay immutability.
- [ ] Structured-output adapter tests for bounded additive fields and reserved server-owned channel collisions.
- [ ] DB integration fixtures for custom template rows and duplicate active custom runs, when `TEST_DATABASE_URL` is available.
- [ ] Workflow integration fixtures for custom claim/replay/failure using deterministic executor dependencies, when `TEST_DATABASE_URL` is available.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Authenticated Company/Persona custom-agent launch, reload, settled result/source inspection, review, and confirmed-only candidate visibility | RUN-01 / RUN-02 | Requires configured Clerk browser state and Phase 39's real-app E2E boundary | Phase 39 executes the configured authenticated Playwright flows; classify missing Clerk credentials/storage state as blocked/not-run. |
| Live Firecrawl/provider execution | RUN-01 | External credentials and approved live policy are not deterministic Phase 38 prerequisites | Run only with supplied live credentials and policy approval; otherwise retain deterministic injected-executor evidence and mark smoke not-run. |

## Validation Sign-Off

- [ ] All planned tasks have an automated verification or an explicitly documented Wave 0 dependency.
- [ ] Sampling continuity: no three consecutive tasks lack automated verification.
- [ ] Wave 0 covers all missing compatibility, snapshot, adapter, DB, and Workflow references.
- [ ] No watch-mode flags are used in recorded commands.
- [ ] Deterministic unit/contract/route/snapshot checks, build, and applicable migration checks are green; blocked/not-run prerequisites remain explicitly classified.
- [ ] Phase 39 handoff evidence is present and does not reclassify its browser/adversarial/review-boundary scope as Phase 38 proof.
- [ ] `nyquist_compliant: true` is set in frontmatter only after the sign-off conditions are met.

**Approval:** pending
