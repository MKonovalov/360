# Phase 35 Validation Contract

## Validation scope

This contract is the pre-execution Nyquist artifact for UX-01 and UX-02. It
covers the four planned waves, the fixture-only browser scaffold, guarded
Neon evidence, and the blocking authenticated UAT. It does not authorize live
model, provider, or Firecrawl execution.

## Requirement-to-evidence map

| Requirement | Plan/task | Automated evidence | Interactive evidence |
|---|---|---|---|
| UX-01 | 35-01 T1/T3; 35-02 T1/T2; 35-04 T1/T3 | Preview contract/Route Handler tests; both-target launcher/Menu tests; POST re-resolution and duplicate-active-run tests; scope audit | Company and Persona Menu → Dialog preview shows resolved instruction, Practice Area, full active checklist, effort, and immediately enabled Start |
| UX-02 history/status | 35-01 T1/T2; 35-02 T2; 35-03 T1/T2; 35-04 T1/T3 | All-status subject SQL query tests; ID-collision and duplicate-active-run fixtures; polling abort/terminal-stop tests; typecheck/build | Reloaded Company and Persona records show newest-first all-run history and queued/running polling with cleanup |
| UX-02 results/review | 35-03 T1/T2; 35-04 T1/T3 | Retention-aware packet projection tests; read-only `RunReviewCard` tests; pending-review link/static decision-scope audit | Settled findings, sources, provenance, review state, and `/reviews` navigation are visible; no target-page Confirm/Dismiss controls |
| UX-02 candidates | 35-01 T1/T2; 35-03 T1/T2; 35-04 T1/T3 | Confirmed-only subject-scoped SQL; offering-name/provenance tests; excluded-status, Company/Persona collision, and expired/tombstoned Persona fixtures | Candidate section follows Buying Signals on both records and shows offering, signal, strong/weak status, and source links |

## Per-task automated checks

| Task | Command/evidence | Guard |
|---|---|---|
| 35-01 T1 | `npm test -- src/lib/analysis/experienceContracts.test.ts` | Pure contract tests; no external services |
| 35-01 T2 | `npm test -- src/lib/db/queries/analysisRuns.test.ts src/lib/db/queries/confirmedCandidates.test.ts` | Unit query contracts; integration evidence is separately guarded |
| 35-01 T2 integration | `if [ -n "$TEST_DATABASE_URL" ]; then npm test -- src/lib/db/queries/confirmedCandidates.integration.test.ts src/lib/db/queries/analysisRuns.integration.test.ts; else record database evidence unavailable and fail the DB gate; fi` | Never claim discriminator, retention, or aggregation evidence without `TEST_DATABASE_URL` |
| 35-01 T3 | `npm test -- src/app/api/analysis-preview/route.test.ts src/app/api/analysis-runs/route.test.ts` | Mock staff gate and server resolvers; no provider calls |
| 35-02 T1 | `npm test -- src/components/analysis/analysis-run-launcher.test.tsx` | Mock preview/POST responses only |
| 35-02 T2 | `npm test -- src/components/analysis/analysis-run-status.test.tsx src/components/analysis/analysis-run-launcher.test.tsx` | Fake timers and abort assertions; no network execution |
| 35-03 T1 | `npm test -- src/components/reviews/run-review-card.test.tsx src/components/analysis/analysis-history.test.tsx src/components/analysis/confirmed-candidate-offerings.test.tsx` | Fixture props only; read-only controls must remain absent |
| 35-03 T2 | `npx tsc --noEmit` | Server/client composition and strict contract check |
| 35-04 T1 scaffold | `npm exec playwright test e2e/35-analysis-experiences.spec.ts --list` | Confirms the fixture/UAT spec is discoverable before the blocking checkpoint |
| 35-04 T2 gate | `npm exec tsx -- scripts/phase35-scope-audit.ts && npm exec vitest run --config vitest.config.ts --include scripts/phase35-scope-audit.test.ts && npx tsc --noEmit && npm run build` | Scope audit must reject providers, Firecrawl, legacy/live writes, packet mutation, packages, schema changes, and Phase 36 leakage |
| 35-04 T2 integration | `if [ -n "$TEST_DATABASE_URL" ]; then npm test -- src/lib/db/queries/confirmedCandidates.integration.test.ts src/lib/db/queries/analysisRuns.integration.test.ts; else record database evidence unavailable and fail the DB gate; fi` | Fail closed; sanitize all ledger output |

## Required fixture matrix

The Wave 3 scaffold must create or seed only disposable fixture data and must
be safe to run only with `TEST_DATABASE_URL` plus the explicit Phase 35 fixture
guard. It must clean up its rows and never invoke a provider or Firecrawl.

- One Company and one Persona using the same numeric subject ID where the
  database permits independent serial spaces.
- Company and Persona runs in queued, running, completed, failed, cancelled,
  pending_review, confirmed, and dismissed states.
- One active-run duplicate attempt per target type, proving the existing
  duplicate guard remains authoritative.
- Confirmed strong/weak findings with multiple persisted sources and offering
  names; no_evidence, inconclusive, source-less, dismissed, failed, cancelled,
  and other excluded candidate cases.
- Active, retired, and draft offering/link identities with preserved
  provenance.
- Persona retained, expired, and tombstoned packet visibility cases.
- Preview responses for Company and Persona, stale preview/POST re-resolution,
  invalid/incompatible inputs, and read-only pending-review rendering.

## Authenticated fixture-only UAT

The blocking checkpoint uses the existing Clerk storage state at
`e2e/.clerk/user.json` and the Phase 35 fixture scaffold. It verifies:

1. Company and Persona Menu → Analyze open the Dialog and display the complete
   server-resolved preview with exactly one compatible fixed template.
2. Start is immediately enabled and the request reaches only the v1.7 preview
   and durable-run boundaries, never the legacy proposal Analyze endpoint.
3. All fixture runs appear newest first after reload; queued/running rows poll,
   abort on navigation/unmount, and stop when leaving the active statuses.
4. Settled packets render normalized findings, canonical source links,
   provenance, pending-review `/reviews` navigation, and no target-page
   Confirm/Dismiss controls.
5. Confirmed Candidate Offerings follows Buying Signals on both records and
   preserves offering, signal, evidence-status, source, discriminator, and
   retention boundaries.

The browser command is concrete and executable after the scaffold task:

```text
npm exec playwright test e2e/35-analysis-experiences.spec.ts
```

If authenticated fixtures, Clerk storage state, or `TEST_DATABASE_URL` are
unavailable, record the affected evidence as blocked/unavailable in
`35-VERIFICATION.md`; do not silently pass it, substitute live execution, or
claim provider/Firecrawl evidence.

## Wave sampling and final gate

| Wave | Plans | Sampling |
|---|---|---|
| 1 | 35-01 | Contracts, Route Handler, subject SQL, candidate unit tests; guarded DB tests when configured |
| 2 | 35-02, 35-03 | Launcher/polling/card/history/candidate component tests plus `npx tsc --noEmit` |
| 3 | 35-04 | Fixture spec discovery, full focused suite, scope audit, guarded DB evidence, typecheck, build, then blocking authenticated UAT |

Phase 35 is complete when automated evidence and authenticated acceptance for
the same UX-01/UX-02 Company and Persona flows are recorded, all unavailable
prerequisites are explicitly reported, and the scope audit shows zero forbidden
provider/live-write/Phase 36 findings. The later guarded Phase 36 Playwright run
provided that authenticated superset evidence (5/5 originally in 31.2s and
again after ship-review remediation in 36.9s); the dedicated
Phase 35 command remains recorded as not rerun rather than retroactively passed.
