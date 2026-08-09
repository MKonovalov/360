---
phase: 37-custom-agent-definition-versioning-lifecycle
plan: 05
status: partial
updated: 2026-08-09T15:44:00Z
focused_matrix: pass
scope_audit: pass
database_integration: blocked
typecheck: blocked_baseline
build: pass
diff_check: pass
---

# Phase 37 Verification Ledger

This ledger records the final Phase 37 regression and scope evidence. It does
not claim Phase 38 runtime compatibility or Phase 39 adversarial, review,
confirmed-only candidate, or authenticated E2E proof.

## Environment and prerequisites

| Item | Observed state | Evidence consequence |
|---|---|---|
| `TEST_DATABASE_URL` | unavailable | Canonical Neon integration remains **BLOCKED**; skipped DB tests are not pass evidence. |
| TypeScript LSP | not installed; installation previously declined | `lsp_diagnostics` is **UNAVAILABLE**; compiler/build commands remain the available static evidence. |
| Existing baseline type errors | three unchanged errors in `analysisProposalDerivation.test.ts` | Repository typecheck is **BLOCKED**, never passed. |
| Provider/runtime policy | not required and not invoked | No live provider or Phase 38 execution claim is made. |

## Final gate commands

| Command | Result | Sanitized evidence / limitation |
|---|---|---|
| Focused Phase 37 matrix | **PASS** | Original Plan 37-05 evidence: 10 files, 127 tests passed. Final review remediation: the same 10 files, 134 tests passed, adding fixed-kind resolver/management fences, enum round-trip and type transitions, strict edit payloads, complete history inspection, action-issue state, and contract-shaped inline-field regressions. |
| `npm test -- src/lib/db/queries/analysisTemplates.integration.test.ts` | **BLOCKED** | 1 migration-contract test passed; 5 database tests skipped because `TEST_DATABASE_URL unavailable`. |
| Full matrix including guarded integration | **PASS / BLOCKED MIXED** | Original evidence: 128 passed, 5 skipped. Final review evidence: 135 passed, 5 skipped. No DB pass is inferred from either process exit code. |
| `npm exec tsx scripts/phase37-scope-audit.ts` | **PASS** | 14 selected tracked implementation files scanned; `findingCount: 0`; positive canaries and explicit Phase 38/39 handoff emitted. |
| `npx tsc --noEmit` | **BLOCKED** | Unchanged baseline errors: `demonstrated`, `signalId`, and `signalRecordType` in `src/lib/db/queries/analysisProposalDerivation.test.ts`. |
| `npm run build` | **PASS** | Next.js production compilation, TypeScript build phase, and route generation completed. |
| `git diff --check` | **PASS** | No whitespace errors. |
| `lsp_diagnostics` | **UNAVAILABLE** | TypeScript language server is missing. |

## Regression matrix

| Boundary | Automated proof | Status |
|---|---|---|
| Fixed template contract | Exact Company and Persona keys remain the fixed allowlist; custom opaque identities fail fixed management input. | **PASS** |
| Fixed options | Company/Persona target requests remain routed through the fixed allowlist; authored custom fields are not serialized into launcher options. | **PASS** |
| Fixed preview | Preview accepts only target/practice input and rejects custom identity/key or snapshot override fields. | **PASS** |
| Fixed run input | Run creation rejects custom identity/key and client-owned launch metadata; existing no-op policy assertions remain intact. | **PASS** |
| Fixed subject resolution | Fixed resolver and management read/write shapes remain legacy-only and target-scoped; template identity and version queries require `kind = fixed`, so custom versions cannot enter fixed consumers or fixed management paths. | **PASS** |
| Custom definition/versioning | Custom contract/query/action/UI suites cover stable opaque identity, immutable and inspectable history, actor/timestamp, schema/capability policy, strict save payloads, enum-preserving/type-safe edits, contract-shaped inline validation, conflict/reload, and retired edits. | **PASS — deterministic** |
| Lifecycle | Existing custom query/action/UI suites cover retired-first create, active/retired transitions, reactivation without version bump, and no hard-delete control. | **PASS — deterministic** |
| Practice Area boundary | Create-time selection is server-approved and singular; edit-time Practice Area is read-only; launch/preview override fields are rejected. | **PASS — deterministic** |
| Scope boundary | Selected tracked implementation scan rejects runtime/provider/workflow/review/candidate/clone/delete/RBAC/credential leakage. | **PASS** |
| Neon retention and fixed-row coexistence | Canonical guarded integration suite has the assertions but cannot reach the database. | **BLOCKED** |

## Scope and handoff

The scope audit scans only the selected tracked Phase 37 implementation files,
strips comments before forbidden-token matching, requires positive canaries for
the custom contract/query/action/UI seams, and excludes the audit script,
tests, and planning history from the application scan.

### Phase 38 handoff

Phase 38 receives the normalized immutable custom version read model:

- opaque stable identity;
- immutable Company or Persona target;
- fixed `practiceAreaId`;
- latest immutable version and history metadata;
- authored query, behavior, optional bounded schema, approved effort, and opaque capability IDs;
- server actor, timestamp, and lifecycle.

It must add runtime resolution, run compatibility, server-owned checklist/policy
augmentation, and execution behavior. Phase 37 did not alter those consumers.

### Phase 39 handoff

Phase 39 owns prompt-injection and unsafe-citation adversarial proof,
whole-run review, confirmed-only candidate projection, no-live-write database
evidence, and authenticated `/agents` plus Company/Persona E2E. None is claimed
by this ledger.

## Final disposition

Phase 37 deterministic contract, action, UI, fixed-consumer regression, build,
diff, and scope evidence passes. Database-authoritative persistence/retention
evidence and repository-wide typecheck remain blocked by explicitly recorded
prerequisites/baseline debt.
