# Testing and verification

This document describes the verification lanes for ArcLumen 360. A lane is
reported only when its prerequisites were available and its command actually
ran. A skipped or blocked prerequisite lane is **not executed**, and must not
be reported as passed.

## Quick local checks

The default unit and component suite is:

```sh
npm test
```

Use focused Vitest paths for a smaller change, then run the full suite before
handoff. TypeScript and the production build are separate gates:

```sh
npx tsc --noEmit
npm run build
```

The Phase 33 to 35 focused gates also include the relevant scope audit, its
isolated audit test when the shared Vitest include does not discover it, and
the focused contracts, query, action, and component tests. A scope audit is a
boundary check, not a substitute for runtime or database evidence.

## Verification lanes

### Unit and contract lane

`npm test` covers pure contracts, query behavior tested without a database,
server actions, and component behavior. These tests must not call live model,
Firecrawl, Apollo, Prospeo, or other provider services. They use deterministic
fixtures and narrow fakes or mocks at external boundaries.

### Database integration lane

Database-backed proof requires a disposable or explicitly approved test
database supplied through `TEST_DATABASE_URL`. The database integration lane
covers Neon/Drizzle schema metadata, analysis-run transitions, packet
persistence and replay, retention/tombstoning, review races, and confirmed-only
candidate queries. Without `TEST_DATABASE_URL`, record the lane as unavailable.
Do not replace it with unit tests or claim atomicity, retention, concurrency, or
SQL-authoritative filtering from a skipped run.

For migration artifacts, the static checks are:

```sh
npm run db:validate
npm run db:check
```

`npm run db:migrate` is an operator-controlled migration action, not a routine
test prerequisite. Follow [database-migrations.md](./database-migrations.md),
including the 0007 baseline boundary and the prohibition on `db:push` for
Preview or Production. `npm run db:push` is development-only and must never be
used as evidence for Production migration safety.

### Workflow and review integration lane

Workflow integration is run with:

```sh
npm run test:workflow:config
npm run test:workflow
npm run test:integration:analysis-reviews
```

`test:workflow` fails closed when `TEST_DATABASE_URL` is missing. These checks
cover generated Workflow loading, database-authoritative lifecycle behavior,
packet-before-completion ordering, and whole-run Confirm/Dismiss review
boundaries. Review integration must preserve immutable packets and sources,
server-owned actor and timestamp fields, winner-preserving races, and
confirmed-only candidate projection.

### Live provider lane

Live model, Firecrawl, enrichment, and other provider smoke tests are a
separate lane. They require an approved execution policy and the specific
provider credentials, with any spend and data-handling approval in place. A
deferred policy, missing approval, or missing credential is recorded as
`policy_or_credentials_unavailable`; it is not approval and it is not a pass.

Phase 33 and the downstream Phase 34 and 35 verification records deliberately
did not claim live provider execution. Fixture-only review and target-record
checks must remain fixture-only when that lane is unavailable.

### Authenticated end-to-end lane

The browser lane uses Playwright:

```sh
npm run e2e
```

Phase 35's focused command is:

```sh
npm exec playwright test e2e/35-analysis-experiences.spec.ts
```

Authenticated fixture-only coverage needs Clerk storage state at
`e2e/.clerk/user.json`, `TEST_DATABASE_URL`,
`PHASE35_COMPANY_ID`, `PHASE35_PERSONA_ID`, `PHASE35_FIXTURE_RUN_ID`, and the
explicit `PHASE35_FIXTURE_ONLY=1` guard where required by the harness. If any
required prerequisite is absent, the affected e2e lane is blocked and is not
executed. Never substitute live provider calls for missing fixtures.

The e2e lane verifies Company and Persona preview, launch, history and polling,
settled findings and sources, review navigation, and confirmed candidate
boundaries. It should not add target-page Confirm/Dismiss controls or invoke
the legacy proposal Analyze path.

### Model catalog lane

Catalog maintenance is separate from application test lanes:

```sh
npm run models:fetch
```

This command checks the approved model roster and refreshes the checked-in
catalog snapshot. Run it only when catalog maintenance is intended. A catalog
refresh is not live provider execution, and a successful application test run
does not prove that the external roster is current. Strict drift checks must
abort without writing when live-only roster differences are not approved.

## Historical audit behavior

Phase 33, Phase 34, and Phase 35 audit and verification records are historical
evidence. Their wording distinguishes passed automated evidence, unavailable
prerequisites, deferred live smoke, and acceptance inherited from a later
superset run. In particular, Phase 35 acceptance via the guarded Phase 36
superset does not mean the dedicated Phase 35 command was rerun.

Historical phase summaries, verification ledgers, validation contracts, and
UAT records are immutable. Do not edit them to make a later run appear in the
original phase, change a blocked lane to passed, or rewrite an old audit's
scope. Add current procedure or corrections here, or create a new dated
verification record when a new run is performed.

## Credential and output safety

- Never print, log, commit, paste, or copy credential values, database URLs,
  Clerk secrets, provider keys, or URLs containing credentials.
- Never record raw provider or database errors, response bodies, prompts,
  private reasoning, source content, or PII in test output or audit ledgers.
- Load secrets only through the environment and keep them command-scoped when
  possible. Use `TEST_DATABASE_URL` for test evidence, never Production
  `DATABASE_URL`.
- Record sanitized statuses, counts, test names, and prerequisite names only.
- If a command would expose a secret or raw error, stop and fix the reporting
  path before rerunning it.

## Accepted tech debt and known boundaries

- The shared Vitest include currently targets `src/**/*.test.ts`; an audit test
  outside that pattern may need an isolated config override. This is a test
  discovery limitation, not evidence that the audit was skipped.
- Live provider smoke remains intentionally deferred while policy or approved
  credentials are unavailable. No downstream audit may silently reclassify it.
- The dedicated Phase 35 fixture command remains historical when acceptance is
  supplied by the Phase 36 authenticated superset. Record that distinction.
- Database integration is prerequisite-gated. Missing test credentials are an
  unavailable lane, not a reason to weaken assertions or substitute a unit
  test.
- Catalog refresh and external roster drift are maintained separately from the
  application test suite.

These limitations are accepted until the relevant policy, fixture, test
discovery, or catalog-maintenance work is explicitly changed and reverified.
