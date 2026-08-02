# Project Research Summary

**Project:** ArcLumen 360 — v1.1 (Start Page + Layout Rework + CSV/Enrichment Import + Analytic Agent)
**Domain:** Internal sales-intelligence/CRM-adjacent tooling — dashboard, data import/enrichment, and human-reviewed AI agent proposals for a small-team (~10-20 record) B2B ICP explorer
**Researched:** 2026-07-29
**Confidence:** MEDIUM-HIGH overall (codebase-grounded findings are HIGH confidence throughout; external vendor/ecosystem claims are MEDIUM; exact AI SDK API surface and Vercel platform limits are explicitly flagged as needing implementation-time verification)

## Executive Summary

ArcLumen 360 v1.1 adds four features on top of the already-shipped v1.0 explorer (Next.js 16/Neon/Drizzle/Clerk): a Start Page dashboard, a stacked-layout rework of the Company/Persona master-detail views, a CSV + commercial-enrichment-API Import flow, and an "Analytic Agent" that proposes buying signals from web research into a human-reviewed queue. All four features are well-precedented individually — dashboards, CSV import wizards, and human-in-the-loop AI approval queues are each converged-on industry patterns (HubSpot/Salesforce import UX, Clay's Claygent as the closest agent analog, AWS's agentic-AI HITL guidance) — but this milestone is the first time the codebase takes on a paid external API, a first Route Handler, a first AI/tool-calling dependency, and its first *write-heavy*, repeatable, staff-triggered data path. Every existing convention in this codebase (Arcpedia's silent-fail pattern, `seed.ts`'s wipe-and-reload idempotency, side-by-side layout duplicated across 6 files) was built for a read-only, single-operator, seed-data world and is actively the wrong template to copy for at least three of these four features.

The recommended approach is disciplined reuse with explicit, called-out deviations: reuse `csv-parse` and the existing Zod row schemas for Import rather than adding a second parser; reuse the `ai`/`@ai-sdk/openai` (or Anthropic) SDK's built-in web-search tool rather than adding a third-party search vendor up front; reuse the existing named-export/query-file/`requireStaffAccess()`-per-action conventions for all new code. But explicitly *diverge* from Arcpedia's "never throws, never logs" pattern for both Import and the Analytic Agent (these are paid and/or write-adjacent, and silent failure hides cost and PII risk); explicitly avoid `seed.ts`'s destructive wipe-and-reload approach for live import (needs real upsert/dedup semantics); and structurally separate agent-proposed signals from live `signal` rows via a dedicated `signalProposal` table rather than a status flag, so an approval-boundary regression is structurally impossible rather than merely policy-enforced.

The two biggest risks are cost/trust risk in Import (a paid enrichment vendor called in a loop, or a silent overwrite of staff-curated data) and integrity risk in the Analytic Agent (prompt injection from untrusted web content reaching a DB-write-adjacent tool-call, in a codebase with zero automated tests to catch a regression in the propose→approve boundary). Both are addressed by the same structural pattern: give the untrusted/costly path its own narrow, auditable table and write function, never let it touch the live table directly, and make failure states visible rather than silently degraded. A secondary, lower-risk-but-certain issue is Pitfall 1: the layout rework must consolidate the already-duplicated 6-file side-by-side markup into a shared component as part of the rework, not after — this is the same duplication-drift bug class the codebase's own Key Decisions log already documents once (Phase 3's `hasSignals` bug).

## Key Findings

### Recommended Stack

The stack additions are narrow and mostly reuse-existing-pattern: `csv-parse` (already installed as a dev dependency, needs promotion to a runtime dependency) for CSV parsing against the same Zod schemas the seed script already uses; a plain `fetch()`-based Apollo.io client (recommended enrichment vendor — cheapest/simplest fit vs. Clearbit/HubSpot Breeze [sunset as standalone], ZoomInfo [sales-gated, $15K+/yr], and Clay [workflow product, not a lookup API]) following the existing `arcpedia.ts` client convention; the Vercel `ai` SDK (`^7.0.41`) + `@ai-sdk/openai` (`^4.0.23`, or `@ai-sdk/anthropic` as a single-vendor alternative) for the Analytic Agent's tool-calling loop, using the provider's *built-in* web-search tool rather than a dedicated search vendor (Exa/Tavily/Perplexity) as a first cut; and the shadcn `dropdown-menu` component (imports from the already-installed consolidated `radix-ui` package) for the shared "Menu" affordance both Import and Analyze hang off of. `next.config.ts` needs `experimental.serverActions.bodySizeLimit` raised from the 1MB default to handle realistic CSV volumes.

**Core technologies:**
- `csv-parse` (existing, promote to `dependencies`) — CSV row parsing, reuses seed script's validated pipeline
- Apollo.io REST API (no SDK, plain `fetch()`) — commercial enrichment vendor, best cost/shape fit at this team's scale
- `ai` (^7.0.41) + `@ai-sdk/openai` (^4.0.23) — agent loop, tool calling, built-in web search for the Analytic Agent
- shadcn `dropdown-menu` (radix-nova style) — shared "Menu" button UI for both Import and Analyze triggers
- `zod` (existing) — reused for CSV row validation, Apollo response validation, and the agent's structured-output schema

### Expected Features

**Must have (table stakes):**
- Start Page: summary stat cards, recent-signals list, recently-viewed list, replacing the current landing view
- Stacked list/detail layout (single-expand accordion, URL-syncable, scroll-to-expand) for both Companies and Personas
- Shared Menu-button dropdown on list pages (→ Import) and detail panels (→ Analyze)
- CSV Import: upload → column/enum-value mapping → row-level validate/preview with partial-import support → commit → summary
- A resolved dedup key at the schema level (`company.domain` recommended) before Import ships — `name` alone is too fragile
- Commercial enrichment integration: staff-triggered, vendor-agnostic adapter, auto-fill-empty-fields-only merge (never silent overwrite), basic field-level provenance marker
- Analytic Agent: on-demand web-search signal detection per Company, proposals in a new `signalProposal` table, dedicated review queue with inline evidence/citation and Accept/Reject, pending-count badge — no auto-write to `signal` under any circumstance

**Should have (competitive differentiators):**
- "Needs attention" dashboard section (high-strength signals without recent review)
- Downloadable CSV template pre-filled with valid enum values
- Duplicate-aware proposing in the Analyze agent (skip re-proposing already-recorded signals)
- Field-level merge-review UI for enrichment conflicts (shares UI shape with the signal review queue)

**Defer (v2+):**
- BI-style charts, customizable dashboard widgets, real-time auto-refresh (no volume/need justifies this at ~10-20 records)
- Scheduled/background Analyze sweeps across all Companies (stay on-demand until the manual flow is proven)
- Recurring/scheduled CSV import (SFTP, watched folder)
- Team-wide "who viewed what" activity feed (pending a one-line product decision on cross-staff visibility)
- Confidence-threshold auto-approval for agent proposals and any chat-style agent interface (both explicitly contradict PROJECT.md's review-gate constraint)

### Architecture Approach

v1.1 layers cleanly onto the existing Server-Component/direct-Drizzle-query/no-service-layer architecture, with three genuinely new patterns introduced for the first time: a Route Handler (`src/app/api/companies/[id]/analyze/route.ts` — the first in the repo, needed because the Analyze feature's multi-step agent loop doesn't fit the Server-Action-tied-to-a-form shape), a new `signalProposal` table structurally separate from `signal` (not a status flag — this makes the approval-bypass failure class structurally impossible rather than policy-dependent), and a new client-vs-server split where Import/Analyze deliberately *fail loud* (surface per-row/per-call errors to the UI) rather than following Arcpedia's silent-degrade convention, because both are paid and/or write-initiated actions where silent failure hides cost or data-integrity problems.

**Major components:**
1. `src/lib/db/queries/stats.ts` — new aggregate-query module for Start Page counts/recent-signals, same named-export/no-try-catch-in-query convention as existing query files
2. `src/lib/db/queries/signalProposals.ts` + `signalProposal` table — CRUD for the review queue, kept structurally isolated from the live `signal` table and its three existing unconditional read sites
3. `src/lib/enrichment.ts` — vendor-agnostic enrichment client using a discriminated `{ok:true,data} | {ok:false,reason}` result shape (deliberately not copying Arcpedia's `catch → []` pattern)
4. `src/lib/agents/signal-detection-agent.ts` + `src/app/api/companies/[id]/analyze/route.ts` — the agent construction and its Route Handler, `requireStaffAccess()` still called first per existing convention
5. Shared layout/menu components — a consolidated `<ExplorerLayout>`-style component (net-new, currently absent) to stop the 6-file duplication pattern, plus one shared `dropdown-menu` used by both Import and Analyze

### Critical Pitfalls

1. **Layout rework repeating Phase 3's exact duplication bug** — the side-by-side grid markup is already hand-duplicated across 6 files with no shared component; reworking to stacked layout by editing all 6 independently reproduces the same "drift independently" failure this codebase's own Key Decisions log already documents. Avoid by extracting a shared layout component (and a `companyFilters.ts` mirroring the existing `personaFilters.ts`) *before or as part of* the rework, not as follow-up cleanup.
2. **Import reusing `seed.ts`'s wipe-and-reload idempotency strategy** — safe for a full-dataset-replace dev script, unsafe for live incremental import (deletes real signals/roles added since last import, or creates silent duplicate rows since no unique constraint exists on `company.name`/`persona.name`). Avoid via an explicit dedup key + DB-level uniqueness constraint + real upsert semantics (`onConflictDoUpdate`), never delete-then-reinsert.
3. **All-or-nothing CSV validation UX** — `validateRows()` throws on any bad row, appropriate for a CLI script, wrong for an interactive staff upload of a hundreds-of-rows real-world export. Avoid by partitioning valid/invalid rows and supporting partial commit with row-level error reporting.
4. **Copying Arcpedia's silent-fail/never-log pattern onto a paid, PII-bearing enrichment API** — hides billed-call failures (staff can't tell "no vendor match" from "our integration broke") and risks logging real PII if debugging temptation strikes. Avoid by logging call metadata only (never response bodies/PII) and surfacing distinct failure vs. no-match states to the UI.
5. **Approval-bypass risk at the Analytic Agent's propose/approve boundary, in a zero-automated-test codebase** — the single most consequential trust boundary this milestone adds; a refactor that lets the agent's tool call reach `insertSignal` directly, or a single shared status-flag table instead of a structurally separate `signalProposal` table, would silently let unapproved/fabricated signals into the "trustworthy 360 view" with nothing to catch it. Avoid via structural table separation, independent `requireStaffAccess()` calls on both propose and approve actions, and treating the propose→approve→signal path as the highest-priority manual UAT scenario (worth considering as the one place to add a minimal automated test despite the no-test-suite status quo).

## Implications for Roadmap

Based on combined research (architecture's explicit Build Order recommendation, cross-checked against feature dependencies and pitfall sequencing), suggested phase structure:

### Phase 1: Layout Consolidation + Rework
**Rationale:** Both Import's and Analyze's Menu buttons anchor to page regions this phase restructures — doing it first avoids placing/re-placing header UI twice, and Pitfall 1 requires the duplication fix to happen *as part of* this work, not after.
**Delivers:** Shared layout component replacing the 6 duplicated side-by-side files; stacked full-width list/detail for Companies and Personas; consolidated `companyFilters.ts` mirroring the existing `personaFilters.ts`.
**Addresses:** FEATURES.md's "Layout Rework" table stakes (single-expand accordion, URL-synced, scroll-to-expand).
**Avoids:** Pitfall 1 (duplication drift across page files and loading skeletons).

### Phase 2: Shared Menu Component + Start Page
**Rationale:** The `dropdown-menu` primitive is a one-time investment reused by both later features; Start Page is fully additive (new query file, new route, zero schema dependency on anything else) and can run in parallel or first as a low-risk validation of the aggregate-query pattern.
**Delivers:** `dropdown-menu` component installed; Start Page with stat cards, recent-signals list, recently-viewed list (localStorage-backed recommended for v1.1 — no user-scoped activity table exists today).
**Uses:** shadcn `dropdown-menu` (radix-nova), new `src/lib/db/queries/stats.ts`.
**Implements:** Menu button architecture component reused by Phase 3 and Phase 4.

### Phase 3: CSV Import + Enrichment API
**Rationale:** Lower-risk than the Analytic Agent (no new AI dependency, reuses existing validated Zod schemas) — sequencing before Analyze de-risks the "new Menu action + new write path" pattern before adding AI-specific complexity on top.
**Delivers:** Upload → map → validate/preview → partial commit → summary wizard for Companies/Personas; `company.domain` schema addition for dedup; staff-triggered enrichment with auto-fill-only merge policy and basic provenance marker.
**Uses:** `csv-parse` (promoted to runtime dependency), Apollo.io `fetch()` client, new `upsertCompanyByName`/`upsertPersonaByName` query functions.
**Avoids:** Pitfalls 2, 3, 4, 5, 6 (wipe-and-reload, all-or-nothing validation, uncapped billed calls, silent-fail-on-paid-call, missing provenance/staleness tracking).

### Phase 4: Analytic Agent (Analyze)
**Rationale:** Depends on the new `signalProposal` table migration and is the only feature introducing wholly new architectural patterns (first Route Handler, `ai` package, provider/model selection, web-search tool-calling) — highest research/verification surface, sequenced last so Phases 1-3 establish the Menu/write-path conventions it builds on.
**Delivers:** `signalProposal` table + enum; `POST /api/companies/[id]/analyze` Route Handler with `requireStaffAccess()` gating; agent construction with a constrained `proposeSignal`-only tool surface; dedicated review queue view with inline evidence/citation, Accept/Reject, pending-count badge.
**Uses:** `ai` (^7.0.41) + `@ai-sdk/openai` (or Anthropic), reused `signalTypeEnum`/`signalStrengthEnum` Zod validation.
**Avoids:** Pitfalls 7, 8, 9, 10 (prompt injection, untrusted-text rendering, approval-bypass, latency/cost vs. Vercel function duration limits).

### Phase Ordering Rationale

- Layout must come first because it's the shared surface both Menu-driven features attach to — doing it last would mean re-touching every file Import/Analyze just modified.
- Import before Analyze because Import is lower-risk (proven validation code, no new AI dependency) and establishes the "new Menu action + fail-loud write path" pattern the Agent can then reuse rather than invent alongside its own AI-specific complexity.
- The Analytic Agent is last and isolated because it is the only phase requiring a genuinely new architectural primitive (Route Handler) and carries this milestone's highest-severity, hardest-to-detect risk class (approval-bypass in a zero-test codebase) — it benefits most from every other convention (Menu, fail-loud errors, provenance-marker precedent) already being settled before it's tackled.
- Dedup-key and provenance schema decisions are grouped into the Import phase because both CSV and enrichment import share the identical "does this record already exist" problem — solving it once here avoids Enrichment reinventing divergent matching logic later.

### Research Flags

Phases likely needing deeper research during planning (`--research-phase`):
- **Phase 4 (Analytic Agent):** ARCHITECTURE.md explicitly flags the `ai` SDK's exact API surface (tool names for web search, `ToolLoopAgent` vs. current equivalent, `stopWhen`/`Output.object` syntax) as needing verification against `node_modules/ai/docs` at implementation time — training-data-stale per the project's own AI SDK skill. Also needs explicit verification of the Vercel plan's function duration ceiling (`maxDuration`) before choosing sync-Server-Action vs. fire-and-poll architecture.
- **Phase 3 (Import/Enrichment):** Vendor selection (Apollo.io recommended, but pricing/credit-tier details are MEDIUM confidence and should be re-verified before contracting) and the exact `next.config.ts` `serverActions.bodySizeLimit` config path (may have graduated out of `experimental` in Next 16) need confirmation at implementation time.

Phases with standard, well-documented patterns (skip research-phase):
- **Phase 1 (Layout Consolidation):** Pure component/state refactor of an already-built pattern; no new external dependencies or unresolved API questions.
- **Phase 2 (Menu + Start Page):** shadcn component installation and aggregate `COUNT`/`GROUP BY` queries are both extremely well-trodden patterns already used elsewhere in this exact codebase.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Context7-verified library/version data (AI SDK, Next.js, shadcn, csv-parse) cross-checked against npm registry metadata; enrichment-vendor pricing is MEDIUM (multiple independent sources, but pricing pages change) |
| Features | MEDIUM-HIGH | CSV import and HITL-approval patterns corroborated across multiple official sources (HubSpot/Salesforce docs, AWS Agentic AI Lens); small-internal-tool dashboard conventions are thinner in public literature, reasoned more from established CRM convention + this codebase's schema |
| Architecture | HIGH for integration points/file locations (read directly from source); MEDIUM for exact AI SDK API surface and Vercel platform limits (explicitly flagged as unverified, training-data-stale for the AI SDK specifically) |
| Pitfalls | HIGH for codebase-specific findings (read directly from source, including one already-documented recurrence — Phase 3's duplication bug); MEDIUM/LOW for general AI-agent/enrichment-ecosystem claims (prompt injection, vendor rate-limiting norms) — industry-standard guidance, not independently re-verified against current-dated external sources this pass |

**Overall confidence:** MEDIUM-HIGH — the codebase-grounded portions of this research (existing conventions, file locations, schema gaps, duplication risks) are HIGH confidence and directly actionable. The genuinely novel portions (exact `ai` SDK API surface, Vercel function duration ceiling, exact enrichment vendor pricing) are explicitly flagged as needing verification at implementation time rather than treated as settled.

### Gaps to Address

- **Exact `ai` SDK API surface** (tool construction, web-search tool naming, structured-output syntax) — must be verified against `node_modules/ai/docs` or current provider docs once the package is installed, not trusted from this research pass's syntax examples. Address during Phase 4 planning/research-phase.
- **Vercel function duration limit for this project's specific plan tier** — no `vercel.json`/plan info was available to inspect; affects the sync-vs-fire-and-poll architecture decision for the Analytic Agent. Address during Phase 4 planning, before implementation begins.
- **Enrichment vendor final selection and exact pricing** — Apollo.io is the research recommendation, but PROJECT.md lists it as one of several TBD candidates (Clearbit/Apollo/ZoomInfo/Clay); dollar figures cited are MEDIUM confidence and should be re-verified against current vendor pricing pages before committing. Address during Phase 3 planning.
- **"Recently viewed" storage model (localStorage vs. DB-backed team-shared log)** — flagged in both FEATURES.md and ARCHITECTURE.md as a product decision, not purely a technical one; research recommends localStorage for v1.1 (matches "no per-user model" constraint) but a team-shared version is a real differentiator worth a one-line product decision before Phase 2 starts.
- **"Full-width detail below entire list" vs. "inline accordion under the clicked row"** — ARCHITECTURE.md flags this as a genuine ambiguity in PROJECT.md's phrasing; research recommends the simpler, zero-new-state interpretation (detail renders below the whole list), but this should be confirmed as a design decision before Phase 1 implementation, not assumed silently.

## Sources

### Primary (HIGH confidence)
- Direct repository inspection (`src/**/*.ts(x)`, `package.json`, `next.config.ts`, `drizzle.config.ts`, `.planning/PROJECT.md`, `src/lib/db/schema.ts`, `src/lib/validation/seed.ts`, `src/scripts/seed.ts`, `src/lib/arcpedia.ts`, `src/lib/auth/requireStaffAccess.ts`) — ground truth for existing conventions, schema gaps, and duplication patterns
- Context7 `/vercel/ai`, `/shadcn-ui/ui`, `/vercel/next.js`, `/mholt/papaparse` — library API/version verification
- npm registry (`npm view`) — exact version/peer-dependency alignment for `ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`, `csv-parse`
- WebFetch `docs.apollo.io` — Apollo.io auth model, request/response shape, credit cost
- `[AGENTSEC04-BP02] Human-in-the-loop for critical decisions | AWS Agentic AI Lens` — official AWS guidance on auto-approval scoping to low-risk/reversible actions only

### Secondary (MEDIUM confidence)
- WebSearch (Landbase, Cognism, Cleanlist, MarketBetter, UpLead, Lindy, Warmly) — enrichment vendor pricing/positioning cross-checked across multiple sources
- CSVBox blog series, HubSpot/Salesforce import guides (Topo, ImportCSV, usecarly) — CSV import UX convergence pattern
- Clay/Claygent vendor docs, OpenAI's Clay case study — closest real-world analog to the Analytic Agent
- `~/.claude/plugins/.../ai-sdk/SKILL.md` bundled reference docs — AI SDK v6/v7 API shape, self-flagged as needing runtime verification

### Tertiary (LOW confidence)
- General AI-agent prompt-injection and HITL-security guidance — reflects well-established industry practice as of training data, not independently re-verified against current-dated external sources this pass; validate against the specific agent framework/SDK chosen at implementation time
- Vercel serverless function duration limits for this project's specific plan tier — not independently verified in this research pass, flagged as an open item

---
*Research completed: 2026-07-29*
*Ready for roadmap: yes*
