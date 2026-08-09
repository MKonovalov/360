# Phase 36: Agent Management & End-to-End Verification - Research

**Researched:** 2026-08-08
**Domain:** Next.js App Router template lifecycle management, immutable Drizzle/Neon versioning, durable analysis verification, and authenticated Playwright evidence
**Confidence:** HIGH for repository seams, locked decisions, schema boundaries, and verification constraints; MEDIUM for exact management action/component names and fixture orchestration because those are intentionally discretionary.

<user_constraints>
## User Constraints (from 36-CONTEXT.md)

### Locked Decisions

- **D-36-01:** The system continues to manage exactly two fixed templates: Company Buying Signal Analysis and Persona Buying Signal Analysis. Template name, target type, supported effort set, and execution budget are not editable in this phase.
- **D-36-02:** Saving an instruction or default-effort edit always creates the next immutable template version. The new version becomes the current version for future runs immediately.
- **D-36-03:** Existing runs retain their immutable template-version snapshot; editing, activating, or retiring a template never changes an existing run, result packet, finding, source, or review item.
- **D-36-04:** Version history is visible read-only. Historical versions cannot be edited or deleted; the management UI must make the current version and prior versions distinguishable.
- **D-36-05:** Activate/retire is a template-level lifecycle action. Retiring a template blocks it from future launches but leaves its history and all existing runs inspectable. Retiring the only active template for a target type is allowed; that target then has no runnable template until reactivation.
- **D-36-06:** Reactivation makes the template available again using its current latest immutable version. Lifecycle changes do not create a new content version unless instruction or default effort is also changed.
- **D-36-07:** Agents is a dedicated screen at `/agents`, linked as `Agents` directly beneath `Manage` (not under Reviews).
- **D-36-08:** The screen shows the two template rows/cards, with edit and activate/retire actions and read-only version history. It is a management surface, not a template-construction playground.
- **D-36-09:** The existing run flow remains target-scoped and does not regain a template picker. Company records resolve to the Company template and Persona records resolve to the Persona template, as locked in Phase 35.
- **D-36-10:** Verification uses a hybrid strategy. Automated DB/workflow/security tests use deterministic fixtures; authenticated Playwright tests run against the real application and database with a deterministic test executor and fixture packet.
- **D-36-11:** The live browser proof covers both target flows: preview of the resolved instruction/checklist/effort, launch, durable status after navigation or reload, settled result and source inspection, the existing whole-run review surface, one attributable terminal decision, and confirmed-only candidate visibility.
- **D-36-12:** Real model-provider or Firecrawl smoke is optional and non-gating. It may be recorded when approved policy and credentials are available, but Phase 36 cannot require external account credit or policy approval to pass.
- **D-36-13:** Automated verification must prove lifecycle claim/recovery and safe terminal failure, duplicate active-run prevention, source-grounded finding persistence, one-winner review idempotency, and confirmed-only aggregation for both Company and Persona contracts. It must also prove that Confirm/Dismiss never writes live Signals or signal-offering links.
- **D-36-14:** Adversarial coverage is automated fixture coverage only, not a separate browser demonstration. Fixtures include malicious prompt-injection content, unsafe citations, unsupported URLs, duplicate evidence, and forbidden write/tool attempts.
- **D-36-15:** Each adversarial case must fail closed, preserve safe audit/error state, and prove that live Signal and signal-offering rows remain unchanged. A URL alone, an untrusted citation, or a tool attempt outside the allowlisted research boundary is never accepted as proof.

### Claude's Discretion

- Exact query/action/component names and how the `/reviews/agents` route is composed from existing Reviews and Settings-style patterns.
- Whether the two template rows use a table, cards, or the established page list primitive, provided the required edit/lifecycle/history operations and target labels are clear.
- Deterministic fixture identifiers, test executor seam, packet contents, browser seed/reset mechanics, and exact Playwright test partitioning.
- Exact lifecycle-history assertions and polling/reload timing, provided the verification strategy above is covered without requiring a live provider.

### Deferred Ideas (OUT OF SCOPE)

- Real provider/Firecrawl smoke as a required gate remains deferred until named policy approval and usable external credentials/account credit exist. Optional evidence may still be recorded without changing the Phase 36 pass criteria.
- Dynamic agent construction, configurable schemas, bulk/scheduled execution, per-finding curation, auto-confirmation, outreach, CRM, and Hypotheses remain outside v1.7 and are not reopened by this phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|---|---|---|
| UX-03 | `Manage > Reviews > Agents` lets staff view and edit template instructions/default effort, changes versions on save, and activate or retire templates. | The current schema already separates mutable template lifecycle from immutable `analysis_template_version` rows; the implementation should expose the locked dedicated `/agents` route, add staff-gated query/actions, and preserve fixed target/budget fields. [VERIFIED: `.planning/REQUIREMENTS.md:44-47`; `src/lib/db/schema.ts:547-588`; `36-CONTEXT.md:32-60]` |
| VER-01 | Automated and live verification cover lifecycle recovery, source-grounded findings, prompt-injection/tool-policy resistance, duplicate-run protection, one-review idempotency, confirmed-only aggregation, and Company/Persona end-to-end flows. | Existing workflow/query integration tests, Phase 34 review/candidate contracts, Phase 35 authenticated fixture harness, and the locked hybrid strategy provide the seams; Phase 36 must add deterministic lifecycle/adversarial gates plus real-app fixture browser coverage. [VERIFIED: `.planning/REQUIREMENTS.md:47`; `src/lib/db/queries/analysisRuns.test.ts`; `src/lib/db/queries/analysisReviews.integration.test.ts`; `e2e/35-analysis-experiences.spec.ts`; `36-CONTEXT.md:64-94]` |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Preserve the Next.js App Router, Neon Postgres + Drizzle, Clerk, Vitest, and Playwright stack; no new package is indicated by this phase. [VERIFIED: `CLAUDE.md`; `package.json:8-67`]
- Start work through the GSD workflow and do not modify application source outside the phase workflow. This research artifact is the only requested file change. [VERIFIED: `CLAUDE.md` GSD Workflow Enforcement; user request]
- Reuse existing Clerk authentication and gate pages, Route Handlers, and Server Actions independently with server-derived `requireStaffAccess()`. [VERIFIED: `src/app/(dashboard)/reviews/page.tsx:1,86-87`; `src/app/(dashboard)/settings/page.tsx:1,20-21`; `src/app/actions/settings.ts:34-36`; `src/app/actions/reviews.ts:102-109`]
- Keep server-only data and secrets out of client code; do not expose raw prompts, unrestricted provider output, private reasoning, credentials, or unrestricted Persona data. [VERIFIED: `CLAUDE.md`; `.planning/phases/33-grounded-analysis-execution-evidence/33-CONTEXT.md:40-47`; `src/lib/verification/security-grep.test.ts:34-86`]
- Match strict TypeScript, named exports, existing Tailwind/shadcn primitives, and fail-safe page/action error handling. [VERIFIED: `CLAUDE.md`; `package.json:61-67`; `src/app/(dashboard)/settings/page.tsx:23-41`; `src/app/actions/settings.ts:34-66`]

## Summary

Phase 36 is an additive management and verification phase over the existing v1.7 ledger. The database already has exactly two seeded templates, immutable version rows, lifecycle status, and run rows that retain template/version and JSON snapshots. The implementation should add management reads and mutations around those tables rather than redesigning the schema or introducing a dynamic agent model. [VERIFIED: `src/scripts/seedAnalysisTemplates.ts:11-45,130-165`; `src/lib/db/schema.ts:547-638`; `36-CONTEXT.md:32-60`]

The safest management write is a single server-gated operation per user intent: validate the fixed template identity and editable fields, read the current template/version, insert the next version only when content changes, update the template lifecycle/audit columns as needed, and return a safe result. Neon HTTP has already required data-modifying CTE patterns for atomic v1.7 decisions; do not rely on interactive `db.transaction()` callbacks. [VERIFIED: `src/lib/db/queries/analysisReviews.ts:305-330`; `src/lib/db/queries/analysisRuns.ts:112-279`; `34-CONTEXT.md:44-50`; [ASSUMED] exact CTE shape for template mutation]

Verification must be split by authority. Vitest and guarded Neon/workflow integration tests prove invariants and adversarial fail-closed behavior deterministically. Authenticated Playwright tests prove that the real `/agents`, Company, Persona, and `/reviews` surfaces are wired together, while a deterministic executor/fixture packet prevents provider credit or Firecrawl policy from becoming a gate. Optional provider smoke is recorded separately and never changes the pass/fail result. [VERIFIED: `36-CONTEXT.md:64-94`; `playwright.config.ts:19-50`; `e2e/35-analysis-experiences.spec.ts:53-169`; [ASSUMED] exact executor injection mechanism]

**Primary recommendation:** Implement fixed-template management as a small `/agents` server page plus staff-gated query/action layer, then add a deterministic Phase 36 verification gate that exercises both target contracts end to end without external provider calls.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Template current-version/history reads | Database / Storage | Frontend Server | `analysis_template` owns lifecycle; `analysis_template_version` owns immutable content and is the source for future runs. [VERIFIED: `src/lib/db/schema.ts:547-588`; `src/lib/db/queries/analysisTemplates.ts:7-54]` |
| Template edit/version/lifecycle mutation | API / Backend | Database / Storage | Server Actions must derive actor identity, validate closed inputs, and perform atomic DB changes; the browser must not choose audit actor or immutable fields. [VERIFIED: `src/app/actions/settings.ts:34-66`; `src/app/actions/reviews.ts:74-109`; [ASSUMED] new action shape |
| `/agents` management presentation | Frontend Server | Browser / Client | Page-level staff gate and server fetch match `/settings`; a small client form/dialog may stage editable instruction/effort and invoke actions. [VERIFIED: `src/app/(dashboard)/settings/page.tsx:20-139`; [ASSUMED] client split |
| Navigation and active-route state | Browser / Client | Frontend Server | `AppSidebar` owns links/tooltips and `getActiveNavKey` owns pure route matching; `/agents` must be exact or boundary-safe and active under Manage. [VERIFIED: `src/components/layout/app-sidebar.tsx:48-240`; `src/lib/nav.ts:6-23]` |
| Durable lifecycle/recovery verification | Database / Storage | Workflow | Database state/events are product truth; workflow claim/recovery must be tested independently of the initiating request. [VERIFIED: `src/workflows/analysisRun.ts:22-67`; `src/lib/db/queries/analysisRuns.ts:27-39`; `31/32-CONTEXT.md`] |
| Grounding/adversarial verification | API / Backend | Database / Storage | Packet normalization and persistence reject unsafe/unlinked evidence before completion; tests must assert safe failure and unchanged live Signal/link rows. [VERIFIED: `src/workflows/analysisRun.ts:112-166`; `src/lib/db/queries/analysisResults.ts`; `33-CONTEXT.md:34-47`; `36-CONTEXT.md:85-94]` |
| Review and candidate verification | Database / Storage | Frontend Server | Whole-run decision and confirmed-only SQL are authoritative; browser verifies the resulting shared Reviews and target-record projections. [VERIFIED: `src/app/actions/reviews.ts:74-109`; `src/lib/db/queries/analysisReviews.ts:332-378`; `src/lib/db/queries/confirmedCandidates.ts` |

## Existing Code and Exact Integration Points

### Template schema and seed invariants

- `src/lib/db/schema.ts:547-588` defines `analysisTemplate` with unique `key`, fixed `name`/`targetType`, mutable `status`, and `createdBy`/`updatedBy` audit fields. `analysisTemplateVersion` has a unique `(templateId, version)` index, immutable-looking content fields (`instruction`, `supportedEfforts`, `defaultEffort`, `futureBudget`), `createdBy`, and `createdAt`. [VERIFIED: `src/lib/db/schema.ts:547-588`]
- `src/scripts/seedAnalysisTemplates.ts:30-45` is the canonical source for the two fixed keys/names/target types and initial instruction text. The seed checks status, instruction, supported efforts, default effort, and budget invariants before inserting version 1. Management must preserve these fixed fields and should not turn the seed into an edit path. [VERIFIED: `src/scripts/seedAnalysisTemplates.ts:30-45,72-162`]
- `src/lib/db/queries/analysisTemplates.ts:7-54` currently exposes active-template listing and version-by-ID lookup. `listActiveAnalysisTemplates()` joins all versions, so a management read must not treat its current output as a current-version-only contract without adding explicit latest/history semantics. [VERIFIED: `src/lib/db/queries/analysisTemplates.ts:7-54`]
- `src/lib/analysis/subjects.ts:73-83` rejects inactive template versions for launches. Retiring a template therefore naturally blocks future runs if management updates the template status; existing `analysis_run` snapshots remain readable because they copy the version data and retain the version ID. [VERIFIED: `src/lib/analysis/subjects.ts:73-83`; `src/lib/db/schema.ts:590-638`; `36-CONTEXT.md:39-51`]

### Run snapshot/versioning implications

- `analysis_run` stores relational `templateId` and `templateVersionId` plus `templateSnapshot`, `subjectSnapshot`, `checklistSnapshot`, `executionSnapshot`, and `policySnapshot`. Existing runs must never be rewritten when a template is edited or retired. [VERIFIED: `src/lib/db/schema.ts:590-638`; `32-CONTEXT.md:54-68`; `36-CONTEXT.md:39-51`]
- The active-run unique index covers `{subjectType, subjectId, templateId}` while status is `queued`, `running`, or `pending_review`; this is the database race-safe duplicate guard. Tests must exercise both Company and Persona contracts and must not weaken the index to a client pre-check. [VERIFIED: `src/lib/db/schema.ts:628-637`; `32-CONTEXT.md:70-83`]
- `analysisRunEvent` is append-only by design, with unique `eventKey`, status transition fields, actor kind/id, safe reason, attempt, and timestamp. Lifecycle tests should assert claim/recovery/failure events rather than only final status. [VERIFIED: `src/lib/db/schema.ts:641-656`; `src/lib/db/queries/analysisRuns.ts:35-39`; `36-CONTEXT.md:79-83`]
- The workflow reloads database state, claims queued rows, executes/normalizes/persists the packet, and only then completes the run. A deterministic executor should be introduced at the existing execution seam, not as a browser mock that bypasses claim/persist/complete behavior. [VERIFIED: `src/workflows/analysisRun.ts:22-67,88-166,199-235`; [ASSUMED] exact dependency injection seam]

### Review/candidate boundaries

- `/reviews` is additive: `src/app/(dashboard)/reviews/page.tsx:18-23,86-123` renders legacy proposals plus a v1.7 run-level section. Do not reuse legacy Accept/Reject or `agent_run`/`signal_proposal` semantics. [VERIFIED: `src/app/(dashboard)/reviews/page.tsx:18-23`; `34-CONTEXT.md:32-36`]
- `RunReviewCard` already has `interactive` and `readonly` modes and renders only server-projected strong/weak findings and persisted source URLs; Phase 36 should verify this existing read-only boundary rather than add a second review renderer. [VERIFIED: `src/components/reviews/run-review-card.tsx:5-9,26-57,86-152`]
- `confirmRunAction`/`dismissRunAction` call `requireStaffAccess()` and `decideAnalysisRun`; their input is only positive `runId` plus closed `confirmed|dismissed` decision. Verification must assert exactly one winner under replay/race and unchanged `signal`, `offering`, and `signal_offering_link` rows. [VERIFIED: `src/app/actions/reviews.ts:74-109`; `src/lib/analysis/reviewContracts.ts:64-101`; `34-CONTEXT.md:17-30`]
- `listRunReviewItems()` performs completed→pending_review reconciliation as a DB side effect and returns only review states. Do not use it as a generic lifecycle test fixture loader; use the existing all-status run query and explicit review query seams. [VERIFIED: `src/lib/db/queries/analysisReviews.ts:297-378`; `src/lib/db/queries/analysisRuns.ts`]

## Route and Navigation Conventions

- Dashboard pages live under `src/app/(dashboard)/`; the route group does not change the public URL. Existing pages are `/reviews`, `/settings`, `/signals`, and `/offerings`. A dedicated `src/app/(dashboard)/agents/page.tsx` therefore produces the required public `/agents` route. [VERIFIED: `src/app/(dashboard)/reviews/page.tsx`; `src/app/(dashboard)/settings/page.tsx`; `src/app/(dashboard)/signals/page.tsx`; `src/app/(dashboard)/offerings/page.tsx`; D-36-07]
- Every staff page self-gates with `await requireStaffAccess()` even though the dashboard layout also gates. Follow this belt-and-suspenders pattern for `/agents`. [VERIFIED: `src/app/(dashboard)/reviews/page.tsx:86-87`; `src/app/(dashboard)/settings/page.tsx:20-21`]
- `src/lib/nav.ts:6-23` currently has `NavKey` values through `settings` and exact/boundary route matching. Add an `agents` key and `/agents` matcher; use exact matching unless a future `/agents/...` detail route is intentionally introduced. Add regression cases for `/agents`, `/agents/anything` if supported, `/agents-archive`, `/settings`, and unknown paths. [VERIFIED: `src/lib/nav.ts:6-23`; [ASSUMED] exact test cases]
- `src/components/layout/app-sidebar.tsx:169-240` renders the Manage group in order Reviews, Signals, Offerings, Settings. D-36-07 requires `Agents` directly beneath the Manage label, not under Reviews; therefore the planner should place the new link before Reviews (or otherwise directly in the Manage section) and use a monochrome Lucide icon plus the existing tooltip/active-key contract. [VERIFIED: `src/components/layout/app-sidebar.tsx:169-240`; `36-CONTEXT.md:53-60`]
- The 36 context contains an older discretionary reference to composing `/reviews/agents`, but D-36-07 is the explicit locked decision and user instruction: the canonical route is `/agents`, directly under Manage. Do not implement `/reviews/agents` unless a later user decision changes the lock. [VERIFIED: `36-CONTEXT.md:53-60,96-105`; user request]

## Recommended Management Architecture

```text
Authenticated staff
  └─ AppSidebar Manage → Agents → /agents (server page)
       ├─ list fixed templates with latest version + lifecycle status
       ├─ edit current instruction/default effort
       │    └─ staff-gated action → validate fixed key + editable fields
       │         ├─ insert next immutable version
       │         └─ update template updatedBy/updatedAt/current lifecycle view
       ├─ activate/retire current template
       │    └─ staff-gated action → update template status only
       └─ read-only version history

Company / Persona record
  └─ Phase 35 target-scoped launch resolves only its compatible fixed template
       └─ POST run → durable workflow → deterministic executor in verification
            ├─ immutable packet/finding/source persistence
            └─ one /reviews whole-run decision
                 └─ confirmed-only candidate projection on the target record
```

This architecture keeps management content changes separate from lifecycle changes: editing creates a version, while activate/retire does not. Existing run snapshots and packets are never backfilled. [VERIFIED: `36-CONTEXT.md:32-51`; `src/lib/db/schema.ts:590-638`; [ASSUMED] action decomposition]

### Recommended project structure

```text
src/app/(dashboard)/agents/page.tsx        # staff-gated management page
src/app/actions/analysisTemplates.ts      # staff-gated edit/lifecycle actions
src/components/agents/                     # management table/cards + edit form/history
src/lib/db/queries/analysisTemplates.ts   # current/latest/history + atomic mutations
src/lib/analysis/templateContracts.ts     # strict input/output/result schemas if needed
src/lib/nav.ts                             # NavKey + /agents matcher
src/components/layout/app-sidebar.tsx     # Manage → Agents link
scripts/phase36-scope-audit.ts             # optional phase-specific no-leak gate
e2e/36-agent-management.spec.ts            # authenticated /agents + both target flows
```

The names above are recommendations, not locked symbols; the existing repository keeps query modules under `src/lib/db/queries`, Server Actions under `src/app/actions`, dashboard pages under `src/app/(dashboard)`, and client UI under `src/components`. [VERIFIED: `src/lib/db/queries/analysisTemplates.ts`; `src/app/actions/settings.ts`; `src/app/(dashboard)/settings/page.tsx`; [ASSUMED] new files]

## Standard Stack

### Core

| Library/seam | Version | Purpose | Why standard |
|---|---:|---|---|
| Next.js App Router | 16.2.11 | `/agents` page and existing dashboard routing | Existing application framework and route-group convention. [VERIFIED: `package.json:41`; `src/app/(dashboard)/settings/page.tsx:20`]
| React | 19.2.4 | Management form/history interaction | Existing client component model. [VERIFIED: `package.json:44`; `src/components/settings/model-settings-form.tsx`]
| Drizzle ORM + Neon serverless | 0.45.2 / 1.1.0 | Template reads, immutable version insert, lifecycle update, guarded integration tests | Existing DB layer and Neon HTTP-safe mutation pattern. [VERIFIED: `package.json:28,38`; `src/lib/db/queries/analysisRuns.ts`; `src/lib/db/queries/analysisReviews.ts:305-330`]
| Clerk Next.js | 7.5.22 | Staff page/action authorization | Existing `requireStaffAccess()` gate. [VERIFIED: `package.json:26`; `src/lib/auth/requireStaffAccess.ts`; `src/app/actions/settings.ts:34-36`]
| Zod | 4.4.3 | Unknown Server Action input and response/fixture validation | Existing strict runtime contract approach. [VERIFIED: `package.json:50`; `src/app/actions/settings.ts:27-38`; `src/lib/analysis/reviewContracts.ts:64-101`]

### Supporting

| Library/seam | Version | Use |
|---|---:|---|
| Vitest | 4.1.10 | Unit, query, action, security, and deterministic adversarial tests. [VERIFIED: `package.json:15,66`; `vitest.config.ts:10-13`]
| `@workflow/vitest` / Workflow | 4.0.16 / 4.8.0 | Workflow integration and claim/recovery proof. [VERIFIED: `package.json:17,49,67`; `vitest.workflow.config.ts:1-16`]
| Playwright | 1.62.1 | Authenticated real-app/browser proof with fixture executor/packet. [VERIFIED: `package.json:18,54`; `playwright.config.ts:19-50`]
| Existing Radix/shadcn primitives | `radix-ui` 1.6.5 / `shadcn` 4.14.0 | Table/card/dialog/select/button UI without a new dependency. [VERIFIED: `package.json:43,46`; existing `src/components/ui/*`]

**Installation:** None recommended. Existing dependencies are sufficient. [VERIFIED: `package.json:22-67`; `36-CONTEXT.md:19-23`]

## Package Legitimacy Audit

No external packages are recommended or installed for this phase. The package legitimacy gate is therefore not applicable. [VERIFIED: `package.json:22-67`; `36-CONTEXT.md:19-23`]

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---|---|---|---|---|---|---|
| None | — | — | — | — | Not applicable | No package change |

**Packages removed due to slopcheck [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.

## Architecture Patterns

### Pattern 1: Server-gated page, server-derived management data

**What:** `/agents` calls `requireStaffAccess()` first, fetches the two fixed templates and current/history versions on the server, and passes only safe management fields to the client form/history components. [VERIFIED: `src/app/(dashboard)/settings/page.tsx:20-41,112-139`]

**When to use:** All template management reads. Do not let the client select actor IDs, template target/name/budget fields, or a version row to mutate. [VERIFIED: `src/app/actions/settings.ts:34-60`; `36-CONTEXT.md:32-51`]

### Pattern 2: Immutable content version plus mutable lifecycle row

**What:** On instruction/default-effort save, validate against the fixed template and supported effort enum, compute `max(version)+1` under a race-safe write, insert a new version, and keep old versions readable. On activate/retire, update only the template status/audit fields. [VERIFIED: `src/lib/db/schema.ts:547-588`; `36-CONTEXT.md:32-51`; [ASSUMED] exact SQL/CTE implementation]

**When to use:** Every management save. A no-op content save should not create a version; a lifecycle-only change must not create one. [VERIFIED: `36-CONTEXT.md:45-51`; [ASSUMED] no-op behavior follows “unless instruction/default effort is also changed”]

### Pattern 3: Database-authoritative verification fixtures

**What:** Seed deterministic Company/Persona, template, signal/checklist, run, packet, source, review, and candidate rows in a disposable test DB. Invoke real query/workflow/action boundaries with a deterministic executor; assert DB state and immutable snapshots after each operation. [VERIFIED: `32-CONTEXT.md:54-83`; `33-CONTEXT.md:27-39`; `34-CONTEXT.md:44-57`; `36-CONTEXT.md:64-94`; [ASSUMED] exact fixture factory]

**When to use:** Lifecycle recovery, duplicate starts, packet validation, review races, and confirmed-only aggregation. Unit mocks alone cannot prove SQL constraints or unchanged live Signal/link rows. [VERIFIED: `36-CONTEXT.md:79-94`; [ASSUMED] test strength rationale]

### Pattern 4: Real authenticated browser, deterministic execution

**What:** Reuse `e2e/auth.setup.ts` and `e2e/.clerk/user.json`; run against the real application/database, but make the executor produce a known safe packet and intercept or configure only the execution seam—not the UI/API/database boundaries being proven. [VERIFIED: `e2e/auth.setup.ts:12-43`; `playwright.config.ts:37-50`; `36-CONTEXT.md:66-73`; [ASSUMED] exact seam]

**When to use:** `/agents` lifecycle UI, Company and Persona preview/launch/reload/result/review/candidate flows, and navigation/route wiring. External provider smoke is a separate optional test. [VERIFIED: `36-CONTEXT.md:70-78`]

### Anti-Patterns to Avoid

- **Build a dynamic agent builder/playground:** Phase 36 manages exactly two target-scoped templates; no configurable schema, provider controls, or EXA-style constructor is allowed. [VERIFIED: `36-CONTEXT.md:19-23,53-63`; `.planning/REQUIREMENTS.md:64-75`]
- **Put the route under `/reviews/agents`:** The locked public route is `/agents`, directly under Manage. [VERIFIED: `36-CONTEXT.md:53-60`; user request]
- **Mutate the current version in place:** Existing runs reference immutable version snapshots; update by inserting the next version. [VERIFIED: `src/lib/db/schema.ts:563-588`; `36-CONTEXT.md:36-44`]
- **Create a version for lifecycle-only changes:** Activate/retire changes template availability, not content. [VERIFIED: `36-CONTEXT.md:45-51`]
- **Use UI visibility as authorization:** Every page/action must gate independently and derive the actor on the server. [VERIFIED: `src/app/actions/reviews.ts:74-109`; `src/app/(dashboard)/settings/page.tsx:20-21`]
- **Use live providers as the phase gate:** The user explicitly requires hybrid deterministic verification with non-gating live smoke. [VERIFIED: `36-CONTEXT.md:64-83`; user request]
- **Use global candidate reads then filter in React:** Confirmed-only and subject discriminator/ID predicates belong in SQL. [VERIFIED: `34-CONTEXT.md:24-30`; `src/lib/db/queries/confirmedCandidates.ts`; [ASSUMED] security consequence]

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---|---|---|---|
| Staff authorization | Client checks or layout-only protection | `requireStaffAccess()` at page/action boundaries | Existing server-derived Clerk identity pattern. [VERIFIED: `src/lib/auth/requireStaffAccess.ts`; `src/app/actions/settings.ts:34-36`]
| Immutable version identity | Mutable `version=1` row or client-generated version | DB unique `(templateId, version)` plus server-computed next version | Schema already supplies uniqueness and history semantics. [VERIFIED: `src/lib/db/schema.ts:563-588`]
| Durable lifecycle proof | Browser timers or fake final statuses | Existing Workflow + `analysisRuns` claim/transition/event seams | Database ledger is authoritative and workflow is detached from the initiating request. [VERIFIED: `src/workflows/analysisRun.ts:22-67`; `src/lib/db/queries/analysisRuns.ts`]
| Evidence validation | Test-only accepted URLs or URL-only citations | `normalizeAnalysisPacket` / existing evidence contracts and persistence | Phase 33 rejects unsupported, unsafe, duplicate, and unlinked evidence. [VERIFIED: `src/workflows/analysisRun.ts:112-166`; `33-CONTEXT.md:34-39`]
| Whole-run review | New decision endpoint or legacy proposal actions | `decideAnalysisRun` through existing `/reviews` actions | Preserves one-winner packet-bound review semantics. [VERIFIED: `src/app/actions/reviews.ts:74-109`; `34-CONTEXT.md:17-23`]
| Candidate eligibility | Client-side status filtering or offering-only aggregation | Existing confirmed-candidate SQL projection with subject discriminator and source linkage | Keeps confirmed-only and provenance boundaries database-authoritative. [VERIFIED: `34-CONTEXT.md:24-30`; `src/lib/db/queries/confirmedCandidates.ts`]

**Key insight:** The phase is primarily about preserving already-established immutable and authority boundaries while adding one small management surface. The most dangerous implementation is a convenient UI shortcut that mutates template versions, trusts client actor/fields, or makes fixture browser tests pass while bypassing the actual workflow/database boundary. [VERIFIED: `36-CONTEXT.md:32-94`; [ASSUMED] risk framing]

## Common Pitfalls

### Pitfall 1: “Current version” query returns every version

**What goes wrong:** Existing `listActiveAnalysisTemplates()` joins template versions and orders by version, so a management card may display duplicate rows or accidentally treat an older version as current. [VERIFIED: `src/lib/db/queries/analysisTemplates.ts:7-33`]

**How to avoid:** Add an explicit latest-version projection for cards and a separate ordered history query; assert one current version per fixed template and all prior versions remain read-only. [ASSUMED: query decomposition]

### Pitfall 2: Concurrent edits both choose the same next version

**What goes wrong:** A read-then-insert `max(version)+1` race collides or creates inconsistent current content. The unique index prevents duplicates but does not by itself provide a friendly application outcome. [VERIFIED: `src/lib/db/schema.ts:582-586`; [ASSUMED] race behavior]

**How to avoid:** Use an atomic Neon-safe mutation strategy and test concurrent saves; on conflict, return a safe retry/reload result without mutating an existing version. [VERIFIED: `34-CONTEXT.md:44-50`; [ASSUMED] implementation strategy]

### Pitfall 3: Editing version content changes historical runs

**What goes wrong:** A join to the current version at render/execute time can reinterpret an old run. [VERIFIED: `src/lib/db/schema.ts:605-620`; `33-CONTEXT.md:27-32`]

**How to avoid:** Keep run snapshot fields as the display/execute source and assert before/after management edits that template/version IDs and JSON snapshots on existing runs are byte-equivalent. [VERIFIED: `36-CONTEXT.md:39-44`; [ASSUMED] byte-equivalence assertion]

### Pitfall 4: Retire action accidentally creates a content version or deletes history

**What goes wrong:** Lifecycle state is confused with content versioning, or retirement is implemented as deletion. [VERIFIED: `36-CONTEXT.md:45-51`]

**How to avoid:** Update only `analysis_template.status`, `updatedBy`, and `updatedAt`; leave all version and run rows intact. Test retiring the only active template for a target, blocked future launch, reactivation using the latest version, and historical read visibility. [VERIFIED: `36-CONTEXT.md:45-51`; [ASSUMED] exact columns]

### Pitfall 5: Navigation points to the wrong public route

**What goes wrong:** A nested `/reviews/agents` page can satisfy an internal naming assumption while violating the explicit `/agents` route and active-nav contract. [VERIFIED: `36-CONTEXT.md:53-60`; `src/lib/nav.ts:6-23`]

**How to avoid:** Add `Agents` directly in the Manage group, link to `/agents`, add exact/boundary route tests, and test expanded/collapsed sidebar tooltip behavior. [VERIFIED: `src/components/layout/app-sidebar.tsx:169-240`; [ASSUMED] tooltip test details]

### Pitfall 6: Browser tests prove mocked API responses rather than real wiring

**What goes wrong:** Phase 35's fixture helper intercepts analysis APIs and is useful for UI isolation, but D-36-10 explicitly requires the real application/database boundary with a deterministic executor/packet. Overusing route mocks would not prove durable persistence, review idempotency, or candidate SQL. [VERIFIED: `e2e/35-analysis-experiences.spec.ts:73-169`; `36-CONTEXT.md:66-83`]

**How to avoid:** Seed/reset a disposable DB, use real browser requests and authenticated storage state, inject determinism below the provider boundary, and query the DB for post-browser assertions. Keep route interception only for explicitly isolated UI tests. [VERIFIED: `e2e/auth.setup.ts:12-43`; [ASSUMED] injection mechanism]

### Pitfall 7: Adversarial fixtures only assert an error, not the no-write boundary

**What goes wrong:** Unsafe evidence may fail visibly while a Signal, Offering link, packet, or audit row was partially written. [VERIFIED: `36-CONTEXT.md:85-94`; `33-CONTEXT.md:27-39`]

**How to avoid:** Capture before/after counts and hashes for live Signal and `signal_offering_link` rows, assert safe terminal reason/audit state, and assert no accepted finding/source link for every malicious/unsupported/duplicate case. [VERIFIED: `36-CONTEXT.md:87-94`; [ASSUMED] exact fixture assertions]

### Pitfall 8: Provider smoke silently becomes required

**What goes wrong:** Account credits, policy approval, or Firecrawl availability make an otherwise deterministic phase fail for environmental reasons. [VERIFIED: `36-CONTEXT.md:75-78`; `.planning/STATE.md:80-81,107-108`]

**How to avoid:** Make the deterministic executor/packet suite the required gate; record optional smoke with an explicit `not_run`/`policy_or_credentials_unavailable` reason and never use its result to fail the phase. [VERIFIED: `36-CONTEXT.md:75-78`; `.planning/phases/35-company-persona-analysis-experiences/35-04-SUMMARY.md:7-10,40-42`]

## Recommended Verification Matrix

### Automated deterministic DB/workflow tests

1. **Template management contract:** exactly two fixed templates; latest/current projection; immutable ordered history; valid instruction/default-effort save increments version; no-op save does not; lifecycle-only change does not; retire/reactivate preserves latest version; fixed name/target/supported efforts/budget reject tampering. [VERIFIED: `36-CONTEXT.md:32-51`; [ASSUMED] no-op test]
2. **Concurrent lifecycle/version writes:** two saves cannot create duplicate `(templateId, version)`; one safe winner is preserved and the loser returns a reloadable failure. [VERIFIED: `src/lib/db/schema.ts:582-586`; [ASSUMED] action result]
3. **Run immutability:** create a Company and Persona run, edit/retire/reactivate templates, then compare `templateVersionId`, `templateSnapshot`, `subjectSnapshot`, `checklistSnapshot`, `executionSnapshot`, `policySnapshot`, packet hash, and review identity before/after. [VERIFIED: `src/lib/db/schema.ts:590-638`; `36-CONTEXT.md:39-44`]
4. **Lifecycle/recovery:** claim queued run, simulate interrupted/expired claim, recover or safely fail, assert event actor/timestamps/reasons and no permanently running row. [VERIFIED: `src/workflows/analysisRun.ts:22-67`; `src/lib/db/queries/analysisRuns.ts`; `31-CONTEXT.md`]
5. **Duplicate active starts:** concurrent Company and Persona starts for the same subject/template produce one active run and one safe `active_run_exists` outcome; different target types or subjects remain independent. [VERIFIED: `src/lib/db/schema.ts:628-637`; `src/lib/analysis/analysisLauncherClient.ts:15-27`]
6. **Grounding/adversarial:** malicious prompt injection, unsupported/unsafe citation, URL-only citation, duplicate evidence, and forbidden write/tool attempt all fail closed, preserve safe failure audit, and leave live Signal/link rows unchanged. [VERIFIED: `33-CONTEXT.md:34-47`; `36-CONTEXT.md:85-94`]
7. **Review idempotency:** Confirm vs Dismiss race has exactly one winner; replay returns original decision/actor/time/packet; neither decision writes live Signal or offering-link rows. [VERIFIED: `34-CONTEXT.md:17-30`; `src/app/actions/reviews.ts:88-109`]
8. **Confirmed-only candidate aggregation:** Company and Persona candidates require confirmed review, strong/weak finding, persisted source linkage, correct target discriminator/subject ID, and retention visibility; pending/failed/cancelled/dismissed/no-evidence/inconclusive rows are excluded. [VERIFIED: `34-CONTEXT.md:24-40`; `src/lib/db/queries/confirmedCandidates.ts`]

### Authenticated Playwright proof

Use `e2e/auth.setup.ts` storage state and `playwright.config.ts` serial worker configuration. Prefer a new `e2e/36-agent-management.spec.ts` with deterministic fixture reset/IDs supplied by environment or a controlled seed script. [VERIFIED: `e2e/auth.setup.ts:12-43`; `playwright.config.ts:19-50`; [ASSUMED] exact file]

Required browser scenarios:

- `/agents` loads for staff, shows exactly Company and Persona cards/rows, current version vs history, editable instruction/default effort, and lifecycle control. [VERIFIED: `36-CONTEXT.md:53-60`]
- Save creates and displays the next version; old version remains visible/read-only; refresh preserves the result. [VERIFIED: `36-CONTEXT.md:36-44`]
- Retire blocks a future target launch, preserves history, and reactivation restores launch using the latest version without incrementing version. [VERIFIED: `36-CONTEXT.md:45-51`]
- Company and Persona each preview resolved instruction, Practice Area, checklist, and effort; launch; navigate/reload; observe durable status; inspect settled result/sources; open `/reviews`; make one terminal decision; return to target and observe confirmed-only candidates. [VERIFIED: `36-CONTEXT.md:70-83`]
- Assert no target-record Confirm/Dismiss controls and no request to legacy `/api/companies/:id/analyze`, new provider, or Firecrawl endpoint in deterministic mode. [VERIFIED: `35-CONTEXT.md:59-68`; `e2e/35-analysis-experiences.spec.ts:21,73-87`; [ASSUMED] Phase 36 request guard extension]

### Optional live provider smoke

If approved policy and credentials exist, record one real Company and/or Persona smoke with bounded limits and explicit provider/Firecrawl provenance. It is informational only; if unavailable, record `policy_or_credentials_unavailable` and keep VER-01 green based on deterministic evidence. [VERIFIED: `36-CONTEXT.md:75-78`; `.planning/STATE.md:80-81`]

## Don't Change / Schema Versioning Checklist

- No new template type, target type, effort, budget, provider, or dynamic schema is authorized. [VERIFIED: `36-CONTEXT.md:19-23,32-37`]
- No update/delete to `analysis_template_version`; only append a new version for changed instruction/default effort. [VERIFIED: `36-CONTEXT.md:36-44`; `src/lib/db/schema.ts:563-588`]
- No mutation of `analysis_run` snapshots, packet/result/finding/source rows, review identity, Signal rows, Offering rows, or `signal_offering_link` rows as a side effect of management. [VERIFIED: `36-CONTEXT.md:39-44,79-83`; `34-CONTEXT.md:24-30`]
- A schema migration is likely unnecessary if existing columns support current-version selection via query. Only add a migration if implementation evidence proves a required DB-authoritative field or constraint is absent; document the reason and test it against existing seeded rows. [VERIFIED: `src/lib/db/schema.ts:547-638`; [ASSUMED] likely no migration]
- If a “current version” pointer is proposed, do not add it casually: it duplicates the version ordering invariant and introduces another mutable field to reconcile. Prefer latest-version query semantics unless concurrency evidence demonstrates a need. [ASSUMED]

## Recommended Task Decomposition

1. **Wave 0 — Contracts and invariants:** Define safe management input/result contracts, fixed-template allowlist, latest/history read shape, lifecycle outcomes, no-op/version rules, and deterministic fixture shape. Add pure tests before UI. [VERIFIED: existing Zod/action contract patterns; [ASSUMED] exact contracts]
2. **Wave 1 — Query and mutation layer:** Extend `analysisTemplates.ts` with current/history reads and Neon-safe version/lifecycle mutations; add `src/app/actions/analysisTemplates.ts` with gate-first validation, server actor, fixed-field rejection, conflict handling, and `revalidatePath('/agents')` plus target/review paths only when required. Add unit and guarded integration tests. [VERIFIED: existing query/action patterns; [ASSUMED] exact paths/revalidation]
3. **Wave 2 — `/agents` page and management UI:** Add `src/app/(dashboard)/agents/page.tsx` and components using Settings-style server composition and existing Dialog/Sheet/Button/Select primitives. Show two fixed rows/cards, current version, read-only history, edit instruction/default effort, and activate/retire/reactivate. [VERIFIED: `src/app/(dashboard)/settings/page.tsx`; `36-CONTEXT.md:53-60`; [ASSUMED] exact UI primitive]
4. **Wave 3 — Navigation wiring:** Add `agents` to `NavKey`, route matcher tests, Manage link directly beneath Manage, active/collapsed tooltip behavior, and `/agents` route browser assertion. [VERIFIED: `src/lib/nav.ts`; `src/components/layout/app-sidebar.tsx:169-240`; [ASSUMED] “beneath” insertion position]
5. **Wave 4 — Deterministic verification gate:** Add lifecycle/recovery, duplicate-run, grounding/adversarial, review-race, candidate SQL, no-live-write, Company/Persona contract tests. Use `TEST_DATABASE_URL` for DB evidence and fail closed when absent. [VERIFIED: `package.json:15-18`; `36-CONTEXT.md:79-94`; `.planning/STATE.md:80-82`]
6. **Wave 5 — Authenticated real-app E2E:** Seed/reset deterministic data, run real Clerk-authenticated browser tests against `/agents`, Company, Persona, and `/reviews`, inject deterministic execution below the provider boundary, assert reload/navigation durability and confirmed-only visibility. [VERIFIED: `e2e/auth.setup.ts`; `playwright.config.ts`; `36-CONTEXT.md:66-73`; [ASSUMED] fixture implementation]
7. **Wave 6 — Final gates and optional smoke:** Run focused/full Vitest, workflow suite, `npx tsc --noEmit`, `npm run build`, scope/security audit, Playwright discovery and authenticated tests; separately record optional provider smoke and its reason. Do not claim DB/E2E success when prerequisites are missing. [VERIFIED: `package.json:8-20`; `src/lib/verification/security-grep.test.ts`; `35-04-SUMMARY.md:29-42`]

## Runtime State Inventory

This is an additive management and verification phase, not a rename/migration phase. [VERIFIED: `36-CONTEXT.md:6-23`]

| Category | Items Found | Action Required |
|---|---|---|
| Stored data | Existing `analysis_template`, `analysis_template_version`, `analysis_run`, packet/result/finding/source/link, review, Signal, Offering, and signal-offering rows. [VERIFIED: `src/lib/db/schema.ts:547-729`; `34-CONTEXT.md:24-30`] | Append template versions only for content edits; never mutate historical runs/packets/reviews or live Signal/link rows. [VERIFIED: `36-CONTEXT.md:36-44,79-83`] |
| Live service config | Clerk auth, Neon, Workflow, modelFactory, Firecrawl, and Langfuse are existing dependencies; provider/Firecrawl execution is optional/non-gating. [VERIFIED: `.planning/STATE.md:68-81`; `36-CONTEXT.md:75-78`] | Reuse existing configuration; deterministic executor is the required verification path. [VERIFIED: `36-CONTEXT.md:64-83`] |
| OS-registered state | None identified for this route/query/UI phase. [ASSUMED: repository inventory was source/config focused] | None. |
| Secrets/env vars | Existing Clerk, database, provider, and E2E variables; no new secret is required by the locked scope. [VERIFIED: `package.json:53-67`; `.env.example`; `36-CONTEXT.md:19-23`] | Keep provider/DB keys server-only; use `TEST_DATABASE_URL` and fixture IDs only for guarded verification. [VERIFIED: `src/lib/verification/security-grep.test.ts`; `35-UAT.md:52-73`] |
| Build artifacts/installed packages | Existing Node 22/npm/Vitest/Playwright installation; no dependency change. [VERIFIED: command output; `package.json:22-67`] | No install or artifact migration. |

## Environment Availability

The local probe found Node.js 22.23.1, npm 10.9.8, and npx 10.9.8. No `TEST_DATABASE_URL` evidence was available in the probe, and the repository's prior Phase 35 UAT records the required DB/fixture variables as missing; DB-backed and authenticated browser evidence must therefore be treated as conditional until supplied. [VERIFIED: command output; `.planning/phases/35-company-persona-analysis-experiences/35-UAT.md:52-73`]

| Dependency | Required By | Available | Version | Fallback |
|---|---|---:|---|---|
| Node.js | Next/Vitest/tsx/build | ✓ | 22.23.1 | — [VERIFIED: command output; `package.json:5-6`]
| npm/npx | existing scripts and Playwright | ✓ | 10.9.8 | — [VERIFIED: command output]
| `TEST_DATABASE_URL` | Neon integration, real app DB proof, fixture seed/reset | ✗/not evidenced | — | Unit tests only; do not claim DB proof. [VERIFIED: `package.json:17`; `35-UAT.md:52-70`]
| Clerk test account/storage state | authenticated Playwright | storage state present in repo; account env conditional | — | Stop/fail closed if `E2E_CLERK_USER_EMAIL` or storage state is missing. [VERIFIED: `e2e/auth.setup.ts:17-42`; `35-UAT.md:72-73`]
| Provider/Firecrawl credentials/policy | optional smoke only | intentionally non-gating | — | Deterministic executor and fixture packet. [VERIFIED: `36-CONTEXT.md:75-78`]

**Missing dependencies with no fallback:** None for implementation and deterministic unit tests. [VERIFIED: locked scope]

**Missing dependencies with fallback:** `TEST_DATABASE_URL` and fixture IDs block DB-backed/browser claims, but not contract/unit tests; provider/Firecrawl credentials block only optional smoke. [VERIFIED: `35-UAT.md:52-70`; `36-CONTEXT.md:75-78`]

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Framework | Vitest 4.1.10; Workflow integration via `@workflow/vitest` 4.0.16; Playwright 1.62.1. [VERIFIED: `package.json:15-18,54,66-67`]
| Config | `vitest.config.ts`, `vitest.workflow.config.ts`, `playwright.config.ts`. [VERIFIED: those files]
| Quick run command | `npm test -- <focused test paths>`; use `npm run test:workflow` for guarded workflow integration. [VERIFIED: `package.json:15-18`]
| Full suite command | `npm test && npm run test:workflow && npx tsc --noEmit && npm run build`; workflow command requires `TEST_DATABASE_URL`. [VERIFIED: `package.json:15-20`]

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| UX-03 | `/agents` shows two fixed templates, current version/history, edit instruction/default effort, and lifecycle controls. | Server/page/component + authenticated browser | `npm test -- src/components/agents/* src/lib/db/queries/analysisTemplates* src/app/actions/analysisTemplates*`; `npm exec playwright test e2e/36-agent-management.spec.ts` | ❌ Wave 0/implementation gap. [ASSUMED: final paths]
| UX-03 | Content save appends exactly one next version; old versions/runs remain unchanged; lifecycle-only changes do not version. | Unit + Neon integration | `npm test -- src/lib/db/queries/analysisTemplates.test.ts src/app/actions/analysisTemplates.test.ts`; guarded integration with `TEST_DATABASE_URL` | Partial: `analysisTemplates.test.ts` exists; management tests are gaps. [VERIFIED: file inventory]
| VER-01 | Claim/recovery/safe terminal failure and duplicate active-run prevention for Company and Persona. | Workflow + DB integration | `npm run test:workflow`; `npm test -- src/lib/db/queries/analysisRuns.test.ts src/lib/db/queries/analysisRuns.integration.test.ts` | Existing seams/tests; Phase 36 matrix additions are gaps. [VERIFIED: file inventory]
| VER-01 | Source-grounded packet and adversarial fail-closed cases leave live Signal/link rows unchanged. | Deterministic integration | `npm test -- src/lib/db/queries/analysisResults.integration.test.ts <phase36-adversarial-test>` | Existing packet tests; phase-specific adversarial/no-write matrix is a gap. [VERIFIED: file inventory; [ASSUMED] new test path]
| VER-01 | One-winner Confirm/Dismiss idempotency and confirmed-only Company/Persona candidates. | Query/action integration | `npm test -- src/lib/db/queries/analysisReviews.integration.test.ts src/lib/db/queries/confirmedCandidates.integration.test.ts src/app/actions/reviews.test.ts` | Existing tests; cross-contract Phase 36 fixture matrix is a gap. [VERIFIED: file inventory]
| VER-01 | Real authenticated Company and Persona preview→launch→reload→result→review→candidate flows. | Playwright against real app/DB with deterministic executor | `PHASE36_FIXTURE_ONLY=1 TEST_DATABASE_URL=... npm exec playwright test e2e/36-agent-management.spec.ts` | ❌ New Phase 36 spec gap; existing `e2e/35-analysis-experiences.spec.ts` is the nearest harness. [VERIFIED: existing file; [ASSUMED] new spec]
| VER-01 | Optional real provider/Firecrawl smoke. | Non-gating manual/live smoke | Separate explicitly labeled command and evidence record | ❌ Optional only; never a phase gate. [VERIFIED: `36-CONTEXT.md:75-78`]

### Sampling Rate

- **Per task commit:** focused Vitest tests for changed contract/query/action/component files. [ASSUMED: workflow recommendation]
- **Per wave merge:** focused tests plus `npx tsc --noEmit`; DB/workflow waves also run guarded integration. [VERIFIED: `package.json:15-20`; `35-UAT.md:20-50`]
- **Phase gate:** full automated suite, workflow suite with DB evidence, security/scope audit, and authenticated real-app Company/Persona/browser proof using deterministic execution. Optional provider smoke is informational. [VERIFIED: `36-CONTEXT.md:64-94`]

### Wave 0 Gaps

- [ ] Current/latest/history template query contracts and fixed-template management action tests.
- [ ] Atomic append-version and lifecycle transition integration tests, including concurrent save conflict.
- [ ] `/agents` page/form/history component tests and route/navigation regression tests.
- [ ] Deterministic executor injection/fixture seed-reset mechanism for the real browser path.
- [ ] Phase 36 adversarial matrix with no-write assertions for Signal and signal-offering link rows.
- [ ] Cross-target Company/Persona review/candidate integration matrix.
- [ ] New authenticated Playwright spec for `/agents` plus both complete target flows.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | yes | `requireStaffAccess()` on `/agents`, management actions, existing analysis/review APIs. [VERIFIED: `src/app/(dashboard)/settings/page.tsx:20-21`; `src/app/actions/reviews.ts:102-109`]
| V3 Session Management | yes | Server-derived Clerk actor; no actor/user ID accepted from the browser. [VERIFIED: `src/app/actions/settings.ts:34-60`; `src/app/actions/reviews.ts:102-109`]
| V4 Access Control | yes | Management mutation fixed-key/field allowlist; SQL subject discriminator + ID; confirmed-only and retention-aware reads. [VERIFIED: `34-CONTEXT.md:24-40`; `36-CONTEXT.md:32-51`]
| V5 Input Validation | yes | Strict Zod validation for unknown action input; closed status/effort/target enums; positive IDs; bounded instruction length. [VERIFIED: `src/app/actions/settings.ts:27-45`; [ASSUMED] instruction bound must be selected]
| V6 Cryptography | yes, reuse only | Preserve packet hash/source identity; do not add client-side signing or trust client hashes. [VERIFIED: `src/components/reviews/run-review-card.tsx:79-84`; `34-CONTEXT.md:17-30`]

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| Unauthorized template edit/lifecycle change | Elevation/Tampering | Gate action first; derive Clerk actor; validate fixed template key and editable fields server-side. [VERIFIED: `src/app/actions/settings.ts:34-60`; [ASSUMED] new action]
| Historical run reinterpretation | Tampering/Repudiation | Append immutable version; assert run snapshot and packet/review identity unchanged. [VERIFIED: `36-CONTEXT.md:36-44`]
| Cross-target candidate leakage | Information disclosure | SQL filter by target discriminator and subject ID; test equal numeric IDs across Company/Persona. [VERIFIED: `34-CONTEXT.md:24-30`; [ASSUMED] fixture]
| Prompt injection or forbidden tool/write attempt | Tampering | Allowlisted research boundary; strict packet normalization; fail closed before completion; unchanged live Signal/link rows. [VERIFIED: `33-CONTEXT.md:21-39`; `36-CONTEXT.md:85-94`]
| Client bundle secret leakage | Information disclosure | Keep DB/provider keys server-only; extend existing security-grep gate if new files mention sensitive tokens. [VERIFIED: `src/lib/verification/security-grep.test.ts:34-86`]
| Duplicate review decision | Tampering/Race | Atomic one-winner `decideAnalysisRun`; replay original actor/time/packet. [VERIFIED: `34-CONTEXT.md:17-23`; `src/app/actions/reviews.ts:88-109`]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | Management can use the existing two-table schema without adding a current-version pointer or migration. | Schema/versioning | A hidden concurrency/read requirement could require a schema change. |
| A2 | A Neon-safe CTE or equivalent atomic statement can combine version insertion and lifecycle/audit update. | Management architecture | Interactive transaction limitations could require a different SQL function/locking approach. |
| A3 | The deterministic executor can be injected below the Workflow/packet persistence boundary without changing production provider policy. | Verification architecture | Browser proof could accidentally become route-mocked or require a production seam change. |
| A4 | A no-op content save should not create a new immutable version. | Pattern 2 | If product wants every click versioned, version counts/history semantics change. |
| A5 | Instruction input needs an explicit bounded length and safe error copy. | Security | Missing bounds could permit oversized DB/UI/telemetry content. |
| A6 | A single new Phase 36 Playwright spec can cover management plus both target flows without test-state races. | Validation | The suite may need separate serial specs or fixture-reset projects. |
| A7 | Existing Phase 35 working-tree artifacts are the implementation baseline, while their authenticated UAT remains blocked until DB/fixture prerequisites are provided. | Environment | Planning against an uncommitted/incomplete baseline could misstate available runtime behavior. |

## Open Questions

1. **What exact atomic SQL shape should append a version and update current lifecycle metadata?**
   - What we know: version uniqueness is DB-enforced; Neon interactive callbacks are not the proven pattern. [VERIFIED: `src/lib/db/schema.ts:582-586`; `34-CONTEXT.md:44-50`]
   - What's unclear: whether update-plus-insert needs a CTE, advisory lock, serializable retry, or only unique-conflict handling. [ASSUMED]
   - Recommendation: decide in Wave 0 from existing Neon query patterns, then add a concurrent integration test before UI work. [ASSUMED]
2. **Where exactly is the deterministic executor seam?**
   - What we know: `analysisRun` calls `GroundedExecutionAdapter().execute()` inside a workflow step and persists through `normalizeAnalysisPacket`/`persistAnalysisPacket`. [VERIFIED: `src/workflows/analysisRun.ts:88-166`]
   - What's unclear: whether the cleanest test seam is constructor injection, module mock, environment-selected fixture adapter, or a workflow test-only entry point. [ASSUMED]
   - Recommendation: choose the narrowest seam below claim and above packet persistence; keep production default provider behavior unchanged and add a scope test forbidding fixture mode in production. [ASSUMED]
3. **How should browser fixtures be seeded/reset without leaking between serial tests?**
   - What we know: Playwright runs one worker, auth setup is a dependent project, and Phase 35 requires explicit fixture IDs plus `TEST_DATABASE_URL`. [VERIFIED: `playwright.config.ts:19-50`; `e2e/auth.setup.ts:12-43`; `35-UAT.md:52-73`]
   - What's unclear: whether Phase 36 should seed through a script, a test-only route, or an integration fixture transaction. [ASSUMED]
   - Recommendation: prefer a disposable DB seed/reset script or serial fixture helper that records IDs; never make browser tests depend on pre-existing production rows. [ASSUMED]
4. **Should template management revalidate target pages after a save?**
   - What we know: current target launch resolves active templates server-side and `/agents` is the management surface. [VERIFIED: `src/lib/analysis/subjects.ts:73-83`; `36-CONTEXT.md:53-63`]
   - What's unclear: whether Next.js cache invalidation is needed beyond `/agents` for already-rendered target pages. [ASSUMED]
   - Recommendation: revalidate `/agents` after every successful mutation; revalidate `/companies` and `/personas` only if the implementation proves they cache template availability. [ASSUMED]

## State of the Art

| Old approach | Current approach | When changed | Impact |
|---|---|---|---|
| Legacy Company-only `agent_run`/proposal Analyze path | v1.7 typed `analysis_run` with immutable snapshots, grounded packet, whole-run review, confirmed-only candidates | Phases 32-34 | Phase 36 verification must not call legacy proposal writes. [VERIFIED: `34-CONTEXT.md:8-13,32-36`; `src/app/(dashboard)/reviews/page.tsx:18-23`]
| Mutable or implicit agent configuration | Exactly two fixed templates with immutable version rows and target-scoped launch | Phase 32; locked again Phase 36 | Management edits affect future runs only. [VERIFIED: `32-CONTEXT.md:29-38`; `36-CONTEXT.md:32-44`]
| Provider-dependent live verification | Deterministic DB/workflow fixtures plus authenticated real-app browser proof; live provider smoke optional | Phase 36 decision | External account credit/policy cannot block the phase. [VERIFIED: `36-CONTEXT.md:64-83`]

**Deprecated/outdated:**

- `/reviews/agents` as the canonical management route is superseded by the explicit `/agents` lock. [VERIFIED: `36-CONTEXT.md:53-60`; user request]
- Dynamic/EXA-style agent construction is deferred and must not be reintroduced by this phase. [VERIFIED: `36-CONTEXT.md:19-23,203-211`]

## Sources

### Primary (HIGH confidence)

- `.planning/phases/36-agent-management-end-to-end-verification/36-CONTEXT.md` — locked route, fixed-template lifecycle, immutable versioning, hybrid verification, adversarial boundary, and deferred scope. [VERIFIED: repository artifact]
- `.planning/REQUIREMENTS.md:44-47,64-75` — UX-03, VER-01, and out-of-scope constraints. [VERIFIED: repository artifact]
- `.planning/ROADMAP.md:495-504` — Phase 36 goal and success criteria. [VERIFIED: repository artifact]
- `src/lib/db/schema.ts:547-729` — template/version/run/packet schema and indexes. [VERIFIED: repository source]
- `src/lib/db/queries/analysisTemplates.ts`, `analysisRuns.ts`, `analysisReviews.ts`, `confirmedCandidates.ts` — existing query seams. [VERIFIED: repository source]
- `src/workflows/analysisRun.ts` — claim, execute, normalize, persist, complete lifecycle. [VERIFIED: repository source]
- `src/app/(dashboard)/settings/page.tsx`, `src/app/(dashboard)/reviews/page.tsx`, `src/app/actions/settings.ts`, `src/app/actions/reviews.ts` — staff page/action patterns. [VERIFIED: repository source]
- `src/lib/nav.ts`, `src/components/layout/app-sidebar.tsx` — route matching and Manage navigation. [VERIFIED: repository source]
- `e2e/auth.setup.ts`, `playwright.config.ts`, `e2e/35-analysis-experiences.spec.ts` — authenticated fixture/browser patterns. [VERIFIED: repository source]

### Secondary (MEDIUM confidence)

- `.planning/phases/35-company-persona-analysis-experiences/35-RESEARCH.md` — prior phase's verified seams, route/read-only boundaries, and fixture limitations; used as repository-local precedent. [VERIFIED: repository artifact]
- `.planning/phases/35-company-persona-analysis-experiences/35-UAT.md` and `35-04-SUMMARY.md` — current prerequisite gaps and non-gating provider disposition. [VERIFIED: repository artifacts]

### Tertiary (LOW confidence)

- None. No external web/library research was required; all recommendations are grounded in repository artifacts or explicitly marked `[ASSUMED]`.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — package manifest and existing code establish the stack; no new packages are recommended. [VERIFIED: `package.json`]
- Architecture: HIGH for existing schema/routes/workflow/review boundaries; MEDIUM for exact new mutation/executor seams. [VERIFIED: cited repository files; [ASSUMED] new seam details]
- Pitfalls: HIGH where inherited from locked decisions and existing code; MEDIUM for concurrency/fixture implementation details. [VERIFIED: cited contexts/source; [ASSUMED] implementation details]

**Research date:** 2026-08-08
**Valid until:** 2026-09-07 for stable repository patterns; recheck before planning if Phase 35 working-tree changes are committed or if database schema changes after this research.
