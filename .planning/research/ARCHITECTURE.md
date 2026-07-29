# Architecture Research: v1.1 Feature Integration

**Domain:** Integration architecture for 4 new features onto an existing Next.js 16 App Router + Neon/Drizzle + Clerk app
**Researched:** 2026-07-29
**Confidence:** HIGH for integration points/file locations (read directly from source), MEDIUM for AI SDK exact API surface (skill explicitly warns training data is stale — flagged below), MEDIUM for Vercel platform limits (function duration, plan tiers)

**Supersedes:** the previous version of this file (2026-07-22), which covered the v1.0 Astro→Next.js/Sanity→Neon migration architecture. That migration shipped; this file now covers v1.1's four new features against the *actual, implemented* v1.0 architecture (read directly from source, not from the earlier pre-migration plan).

## Existing Architecture (ground truth, read from source)

```
┌─────────────────────────────────────────────────────────────────┐
│ src/app/**/page.tsx, layout.tsx  — Server Components              │
│   requireStaffAccess() called FIRST in every layout AND page      │
│   (belt-and-suspenders, not layout-only)                          │
│   Direct Drizzle queries, no API/service layer                    │
├─────────────────────────────────────────────────────────────────┤
│ src/components/{companies,personas}/*.tsx                         │
│   *-list.tsx, *-detail.tsx: async Server Components                │
│   *-search-input.tsx, *-filters.tsx: 'use client' + nuqs           │
│   (search/filter state only — NOT selection state)                │
├─────────────────────────────────────────────────────────────────┤
│ src/lib/db/queries/{companies,personas,signals,companyPersonaRoles}.ts │
│   Named exports, parameterized Drizzle conditions, never raw SQL   │
│   Return undefined/[] on not-found, do NOT themselves try/catch    │
├─────────────────────────────────────────────────────────────────┤
│ src/lib/arcpedia.ts — never-throws external-service module        │
│ src/lib/env.ts — zod-validated env, fail-fast for required vars   │
│ src/lib/db/schema.ts — pgEnum + pgTable, Drizzle                  │
└─────────────────────────────────────────────────────────────────┘
```

**Critical correction to the milestone brief's framing:** selection state (which company/persona is "open") is **not** nuqs/client state — it is the Next.js dynamic route segment (`/companies/[id]`). nuqs (`useQueryState`, `shallow: false`) drives only `search`/`industry`/`signal`/`revenueBand`/`ownershipType`/`seniority`/`currentCompany`/`hasSignals`. Each of `/companies` and `/companies/[id]` is a **separate page file** that both render `<CompanyList>` + either a placeholder or `<CompanyDetail>`, side by side via `grid-cols-[minmax(320px,1fr)_2fr]`. `CompanyList`/`PersonaList` hide themselves on mobile (`hidden md:block`) once a row is selected, via a `selectedId` prop compared against each row's id — no client state anywhere in the selection path. This matters directly for question (b) below.

There are currently **zero Route Handlers** (`app/api/**/route.ts`) and **zero shadcn dropdown/menu components** installed (`src/components/ui/` has badge, button, input, scroll-area, select, separator, sheet, sidebar, skeleton, table, tooltip — no `dropdown-menu`). Both are new patterns this milestone introduces.

---

## (a) Start Page aggregate/stats queries

**New file:** `src/lib/db/queries/stats.ts`, sibling to `companies.ts`/`personas.ts`/`signals.ts`, same conventions (named exports, Drizzle `count()`/`sql`, no try/catch inside the query function itself — callers catch, per every existing query file).

```ts
// src/lib/db/queries/stats.ts (shape, not final code)
import { count, desc, eq } from 'drizzle-orm';
import { db } from '../index';
import { company, persona, signal } from '../schema';

export async function getDashboardCounts() {
  const [[{ companies }], [{ personas }], [{ signals }]] = await Promise.all([
    db.select({ companies: count() }).from(company),
    db.select({ personas: count() }).from(persona),
    db.select({ signals: count() }).from(signal),
  ]);
  return { companies, personas, signals };
}

export async function listRecentSignals(limit = 10) {
  return db
    .select({ signal, companyName: company.name })
    .from(signal)
    .innerJoin(company, eq(signal.companyId, company.id))
    .orderBy(desc(signal.detectedAt))
    .limit(limit);
}
```

Consumed by a new `src/app/(start)/page.tsx` or repurposed `src/app/page.tsx` (see Build Order — root `/` currently has bespoke unauthenticated-vs-staff copy; decide whether Start Page **replaces** `src/app/page.tsx`'s signed-in branch or becomes a new authenticated-only route the sidebar links to first). Follow `CompanyList`'s try/catch-in-the-component pattern (not in the query file) for the DB-fetch error card.

**"Recently viewed" has no backing data today.** There is no user-scoped activity table, and `requireStaffAccess()`/schema nowhere store a Clerk `userId` against Company/Persona records. Two options:
1. **Client-side, localStorage-backed** (recommended for v1.1): `CompanyDetail`/`PersonaDetail` pages write `{id, name, type, viewedAt}` to `localStorage` on mount via a small Client Component; the Start Page reads it back client-side. Zero schema changes, matches the "any authenticated staff user sees everything" / no-per-user-model constraint (PROJECT.md Out of Scope: "Multi-user roles/permissions"), and avoids adding a write on every detail-page view (which the current architecture treats as a pure read path).
2. **DB-backed shared "recently viewed" log** (`recentlyViewedLog` table, no user scoping — just "last N entities opened by anyone on staff") — only worth it if the product wants a *team-shared* recent list rather than a personal one. This is a product decision, not an architecture blocker; flag it for roadmap/requirements clarification rather than deciding here. Recommend defaulting to option 1 unless the roadmap phase confirms team-shared is required.

## (b) Layout rework: side-by-side → stacked

**This is a layout/composition change, not a new client-state requirement.** Because selection already flows through the route (`/companies/[id]`), stacking list-above-detail requires:

- **Modified:** `src/app/companies/page.tsx`, `src/app/companies/[id]/page.tsx`, `src/app/personas/page.tsx`, `src/app/personas/[id]/page.tsx` — change the outer `grid-cols-[minmax(320px,1fr)_2fr]` wrapper to a single-column stacked layout (`flex flex-col gap-8` or `grid grid-rows-[auto_auto]`). The two page variants (`/companies` vs `/companies/[id]`) still exist and still each render `<CompanyList>` plus (placeholder | `<CompanyDetail>`) — no new component split needed to satisfy "list on top, detail expands below it."
- **Modified:** `src/components/companies/company-list.tsx`, `src/components/personas/persona-list.tsx` — remove the `selectedId ? 'hidden md:block' : 'block'` conditional. That conditional exists because side-by-side desktop showed both panes while mobile could only fit one; in a stacked layout the list should **always** stay visible above the detail, on every viewport. This is a straightforward class simplification, not new logic.
- **Modified:** `company-detail.tsx`/`persona-detail.tsx` — no internal changes required beyond adding the new Menu-button header row (see feature 4 below); their content/data-fetching is orthogonal to layout.
- **Removed:** the desktop-only "Select a company to view details" placeholder pane on the index (`/companies`, `/personas`) pages — in a stacked layout there's no second column for it to occupy; simplest is to drop it and let the list alone fill the page until a row is clicked.

**Ambiguity to flag for the roadmap phase:** PROJECT.md says "clicking a row expands the detail panel full-width below it," which reads two ways — (1) detail renders below the *entire* list (what the current component split naturally supports, recommended), or (2) an accordion-style expand *directly under the clicked row* (would require new client state — e.g., `useState`/URL-synced expanded-row-id in a Client Component wrapping the table rows — and would complicate/break the existing plain `<Link href="/companies/{id}">`-based navigation that makes `/companies/{id}` directly shareable/bookmarkable). **Recommendation: implement (1).** It requires zero new state, preserves shareable URLs, and matches the recall.ai-explorer precedent this app is already modeled on. If the product genuinely wants per-row inline accordion, that's a materially bigger change (new Client Component wrapping `<Table>`, loses server-only rendering for the list, needs its own decision on whether the URL still updates) — call this out explicitly as an open question rather than silently picking the harder interpretation.

## (c) CSV upload via Server Action

Yes — special handling needed, all solvable within Server Actions (no Route Handler required for this one):

1. **Body size limit.** Next.js Server Actions default to a **1MB** request body cap. `next.config.ts` has no `experimental.serverActions.bodySizeLimit` override today — must add one (e.g. `'5mb'`) sized to realistic CSV volumes (hundreds–low-thousands of rows of Company/Persona/Signal data). [Source: Next.js docs `serverActions` config reference; MEDIUM confidence on exact Next 16 config path — verify the option hasn't moved out of `experimental` before implementing, Next 16 has graduated some previously-experimental Server Actions options.]
2. **Receiving the file.** A `<form action={importAction}>` (or a Client Component calling the action with a manually-built `FormData`) delivers the `File` as a standard web `File`/`Blob` inside the Server Action — read via `await file.text()`. No special multipart parsing needed (Next.js handles this), no streaming needed at this data scale — reading the whole file into memory mirrors `seed.ts`'s `readFileSync(...).toString()` approach exactly.
3. **Reuse, don't duplicate, validation.** `src/lib/validation/seed.ts` already has CSV-injection-hardened, Drizzle-enum-piped zod schemas (`companyRowSchema`, `personaRowSchema`, `signalRowSchema`, `companyPersonaRoleRowSchema`) and `src/scripts/seed.ts` already has the `parse()` (csv-parse) + row-by-row `validateRows()` pattern. The Import feature's Server Action should call `parse()` (from `csv-parse/sync`, already a devDependency — **move to a runtime `dependency`**, it currently sits in `devDependencies` because only the seed script used it) and the *same* row schemas, not a parallel validator.
4. **Do not reuse seed.ts's destructive delete-then-insert.** `seed.ts` wipes `companyPersonaRole` → `signal` → `persona` → `company` before every run — correct for a full reseed, **wrong** for a staff-triggered incremental import (it would silently delete all existing data on every CSV upload). Import needs new **additive upsert** query functions (e.g. `upsertCompanyByName`, `upsertPersonaByName` in `companies.ts`/`personas.ts`) keyed on `name` (the only natural key today), distinct from `seed.ts`'s destructive path.
5. **Fail-loud, not fail-silent, for this write path.** Every other external-facing pattern in this codebase (Arcpedia fetch, DB-fetch error cards) intentionally degrades silently to a safe UI state because those are *read* paths where the user didn't initiate the specific call. Import is a staff-initiated *write* — it should surface **per-row validation errors** back to the UI (mirror `seed.ts`'s `errors: string[]` collection, returned from the Server Action as structured state, e.g. via `useActionState`), not swallow them. This is a deliberate, correct deviation from the "arcpedia never throws" convention — document it as such so a future reviewer doesn't "fix" it to match the read-path convention.
6. **Enrichment API integration** (vendor TBD, per PROJECT.md) — new module `src/lib/enrichment.ts` (or `src/lib/enrichment/<vendor>.ts` if a specific vendor SDK is chosen later). It should **not** blindly copy `arcpedia.ts`'s "any failure → `[]`" shape: for Import, a staff member needs to know *enrichment failed and should be retried* vs. *enrichment ran and genuinely found nothing* — those are different states for a write flow, unlike Arcpedia's "related articles" read flow where they're equivalent. Recommend a discriminated return per row, e.g. `{ ok: true, data: {...} } | { ok: false, reason: string }`, surfaced in the import summary UI. This is a new pattern (not a copy of the never-throws convention) — flag it explicitly rather than assume it inherits Arcpedia's shape.

## (d) "Proposed signal" data model

**Recommendation: new table `signalProposal`, not a status column on `signal`.**

Reasons, grounded in the actual current query surface:
- `signal` is read **unconditionally** in multiple places today — `listSignalsForCompany()` (no filter), `listCompanies()`'s `signalType` `EXISTS` subquery, and `listPersonas()`'s two-hop `hasSignals` `EXISTS`/`NOT EXISTS` subquery. Adding a status column to `signal` means retrofitting a `status = 'approved'` predicate into every one of these call sites. This codebase's own Key Decisions log already documents exactly this class of bug once (the `hasSignals` tri-state collapsing bug in Phase 3) — a forgotten status filter on any of the three existing query sites would leak an unreviewed/rejected proposal straight into a live Company/Persona 360 view. A separate table makes that class of bug structurally impossible (there's no shared query surface to forget to filter).
- The review workflow needs fields the live `signal` table has no natural home for and shouldn't be polluted with: an evidence URL/snippet from the web search (so staff can verify before approving — `signal.source`/`signal.note` are short free-text fields, not built for "here's the article that triggered this"), `proposedAt`, `reviewedBy` (Clerk `userId`), `reviewedAt`. Bolting these onto `signal` means every live signal row carries nullable review-workflow columns forever.
- Approval flow stays simple: a Server Action inserts a new row via the **existing, unchanged** `insertSignal()` and then marks (or deletes) the `signalProposal` row — `signal` itself never needs a migration and stays exactly as immutable/append-only as it is today.

**Shape (new `src/lib/db/schema.ts` additions):**
```ts
export const signalProposalStatusEnum = pgEnum('signal_proposal_status', [
  'pending', 'approved', 'rejected',
]);

export const signalProposal = pgTable('signal_proposal', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id').notNull().references(() => company.id),
  signalType: signalTypeEnum('signal_type').notNull(),      // reuse existing enum
  strength: signalStrengthEnum('strength').notNull(),        // reuse existing enum
  source: text('source'),                                    // e.g. "analytic_agent"
  detectedAt: date('detected_at').notNull(),
  note: text('note'),
  evidenceUrl: text('evidence_url'),        // NEW — the web search source
  evidenceSnippet: text('evidence_snippet'), // NEW — quoted supporting text
  status: signalProposalStatusEnum('status').notNull().default('pending'),
  proposedAt: timestamp('proposed_at').defaultNow().notNull(),
  reviewedBy: text('reviewed_by'),   // Clerk userId, nullable until reviewed
  reviewedAt: timestamp('reviewed_at'),
});
```
New query file: `src/lib/db/queries/signalProposals.ts` (mirrors `signals.ts`'s shape: `insertSignalProposal`, `listPendingSignalProposals(companyId?)`, `approveSignalProposal(id)` → inserts into `signal` + updates status, `rejectSignalProposal(id)` → updates status only).

## (e) Analytic Agent shape (Vercel AI SDK)

**Recommendation: Route Handler, not a Server Action, and not a background job.**

- **New file:** `src/app/api/companies/[id]/analyze/route.ts` (POST) — this is the **first Route Handler in the codebase**; call this out explicitly as a new architectural pattern, not folded silently into the existing "no API layer" description. It still follows the existing rules that apply everywhere else: `requireStaffAccess()` is the first call inside the handler (same single gating check used by every page/layout/Server Action today — nothing about "Route Handler" exempts it), and DB access is direct Drizzle (no separate service layer), matching the rest of the app.
- **Why not a Server Action:** Server Actions in this codebase are used for fast mutations tied to a form/click that the caller awaits synchronously (`refreshCompanyCount`, future `importAction`). A web-search-driven multi-step agent loop can run well past that shape — the UI needs a pending/loading state on the "Analyze" button while a Client Component `fetch()`s the Route Handler, which keeps the rest of the detail page interactive rather than blocking on a Server Action's page-revalidation-oriented lifecycle. Route Handlers also make the execution-duration knob explicit and idiomatic (`export const maxDuration = <n>`) rather than inheriting it implicitly from whatever page invoked the action.
- **Why not a background job/queue:** no queue or worker infrastructure exists anywhere in this repo today (per CLAUDE.md's own Architectural Constraints: "Single-request-per-invocation serverless model... No background workers, queues, or long-running processes"). Introducing one (Inngest, trigger.dev, Vercel Queues) is a real infra decision that isn't justified for "one staff member clicks Analyze on one company at a time" — that fits inside a single Route Handler invocation's duration budget. Flag as a Future Candidate only if usage patterns later demand bulk/"Analyze all companies" behavior.
- **maxDuration:** set explicitly on the route (`export const maxDuration = 60` or higher) — confirm against the actual Vercel plan tier before picking a number; Hobby/Pro/Fluid-compute have different ceilings and this wasn't something I could verify from the repo (no `vercel.json`/plan info present). **MEDIUM confidence, flag for verification before implementation.**
- **Independent failure domains, same pattern as `company-detail.tsx`:** the web-search/AI call and the DB insert of proposal rows must be in **separate try/catch scopes**, so an LLM/tool-call failure is never reported to the UI as "database error" or vice versa — this directly mirrors the existing DB-fetch vs. Arcpedia-fetch separation already established in `CompanyDetail`.
- **Do not silently swallow errors the way `arcpedia.ts` does.** This is a staff-initiated action expecting a visible result ("Agent proposed 3 signals" / "Search failed, try again") — return a real error status/body on failure so the Client Component can render it, consistent with the fail-loud stance recommended for Import above (both are write/action paths, not passive reads).

**Agent construction — verify exact API at implementation time, do not trust this document's syntax as final.** The `ai` package is not yet a dependency in `package.json`; per the project's own `vercel:ai-sdk` skill instructions ("Everything you know about the AI SDK is outdated or wrong... always verify against `node_modules/ai/docs` or current docs before writing code"), the following is the *shape* to implement, confirmed against the skill's bundled v6 reference docs, but tool names for web search specifically (native provider search tool vs. a custom `tool()` wrapping a third-party search API like Exa/Tavily) were **not** confirmed in this research pass and must be resolved by grepping `node_modules/ai/docs/` (or the chosen provider's `@ai-sdk/<provider>/docs/`) once `ai` is installed:

```ts
// src/lib/agents/signal-detection-agent.ts (shape — verify at implementation time)
import { ToolLoopAgent } from 'ai'; // v6: always ToolLoopAgent, not Experimental_Agent
import { z } from 'zod';
import { signalTypeEnum, signalStrengthEnum } from '@/lib/db/schema';

const proposedSignalSchema = z.object({
  signalType: z.enum(signalTypeEnum.enumValues),   // same enum-piping convention as validation/seed.ts
  strength: z.enum(signalStrengthEnum.enumValues),
  detectedAt: z.string(),
  note: z.string().optional(),
  evidenceUrl: z.string().url(),
  evidenceSnippet: z.string(),
});

export const signalDetectionAgent = new ToolLoopAgent({
  model: 'anthropic/claude-sonnet-4.5', // verify against `curl ai-gateway.vercel.sh/v1/models` at build time, not from memory
  instructions: '...GBS/SSC buying-signal detection prompt...',
  tools: { webSearch: /* native provider search tool OR custom tool() — verify */ },
});
```
Structured extraction of the final proposal list should use `generateText({ output: Output.object({ schema: z.object({ proposals: z.array(proposedSignalSchema) }) }) })` — **not** `generateObject` (removed in AI SDK v6) and **not** `maxSteps` (renamed to `stopWhen: stepCountIs(n)`). Route model calls through the Vercel AI Gateway (`model: 'provider/model-id'` string, or explicit `gateway(...)`) rather than a direct provider SDK/API key, per the skill's default guidance — confirm with existing `env.ts`'s zod-fail-fast convention if an `AI_GATEWAY_API_KEY` needs to be added there.

**Client side:** a new `AnalyzeMenu` Client Component (same `'use client'` + `useState`/`useTransition` shape as the existing `RefreshCompanyCount.tsx`), calling `fetch('/api/companies/[id]/analyze', { method: 'POST' })`, showing a pending state, then either revalidating/refetching the pending-proposals list or navigating to a review-queue view.

---

## New vs. Modified — explicit inventory

**New files:**
| File | Purpose |
|---|---|
| `src/lib/db/queries/stats.ts` | Start Page aggregate counts + recent signals |
| `src/lib/db/queries/signalProposals.ts` | CRUD for the review queue |
| `src/lib/enrichment.ts` (or `src/lib/enrichment/<vendor>.ts`) | Enrichment API client, discriminated-result pattern |
| `src/lib/agents/signal-detection-agent.ts` | `ToolLoopAgent` definition + web-search tool |
| `src/app/(start)/page.tsx` or repurposed `src/app/page.tsx` | Start Page route |
| `src/app/api/companies/[id]/analyze/route.ts` | Analytic Agent trigger (first Route Handler in repo) |
| `src/app/api/personas/[id]/analyze/route.ts` | Same, Persona side (if Analyze applies to both — confirm in requirements) |
| `src/app/companies/import/...` (Server Action, likely colocated in `src/app/actions.ts` or a new `src/app/companies/actions.ts`) | CSV import Server Action |
| `src/components/{companies,personas}/import-menu.tsx` | Client Component, Menu → Import |
| `src/components/{companies,personas}/analyze-menu.tsx` | Client Component, Menu → Analyze |
| `src/components/signal-proposals/*` | Review-queue list/approve/reject UI |
| `src/components/ui/dropdown-menu.tsx` | `npx shadcn add dropdown-menu` (nova preset, matches existing shadcn convention) |
| Drizzle migration | `signalProposal` table + `signalProposalStatusEnum` |

**Modified files:**
| File | Change |
|---|---|
| `src/app/companies/page.tsx`, `src/app/companies/[id]/page.tsx`, `src/app/personas/page.tsx`, `src/app/personas/[id]/page.tsx` | Grid → stacked layout; add Menu button header row |
| `src/components/companies/company-list.tsx`, `src/components/personas/persona-list.tsx` | Remove `hidden md:block` selection-hiding conditional |
| `src/components/companies/company-detail.tsx`, `src/components/personas/persona-detail.tsx` | Add header row with Analyze Menu |
| `src/lib/db/queries/companies.ts`, `src/lib/db/queries/personas.ts` | Add `upsertCompanyByName`/`upsertPersonaByName` (additive, distinct from seed.ts's destructive path) |
| `src/lib/db/schema.ts` | Add `signalProposal` table + `signalProposalStatusEnum` |
| `next.config.ts` | Add `experimental.serverActions.bodySizeLimit` |
| `package.json` | Move `csv-parse` from `devDependencies` to `dependencies`; add `ai` (+ provider package(s)) |
| `src/lib/env.ts` | Add enrichment API key(s), possibly `AI_GATEWAY_API_KEY`, following existing fail-fast-vs-optional-degrade split already established for Arcpedia's keys |

**Unmodified but load-bearing (verify no regression):** `src/lib/db/queries/signals.ts`'s `insertSignal()` is reused as-is by the proposal-approval flow; `src/lib/validation/seed.ts`'s row schemas are reused as-is by Import.

---

## Build order recommendation

1. **Layout rework first.** Both Import's "Menu, top-right of list" and Analyze's "Menu, top-right of detail panel" anchor to page regions this task restructures. Doing either feature before the stacked-layout lands means placing/re-placing header buttons twice.
2. **Shared `dropdown-menu` shadcn component**, added once, used by both Import and Analyze — no reason to hand-roll two separate menu implementations.
3. **Start Page** — fully additive (new query file, new route, zero schema changes, no dependency on the other three features). Can run in parallel with #1/#2, or first, if the team wants a low-risk win to validate the aggregate-query pattern before the heavier lifts.
4. **Import** and **Analytic Agent** have no dependency on each other and can proceed in parallel once #1/#2 land. Import is lower-risk (no new external AI dependency, reuses existing validation code) — sequencing it before Analyze de-risks the "new Menu action + new write path" pattern before adding AI-specific complexity (agent construction, Route Handler duration limits, structured-output schema) on top of it.
5. **Analytic Agent last** — depends on the `signalProposal` table (new migration) and is the only feature introducing a wholly new pattern (Route Handler, `ai` package, provider/model selection, web-search tool). Highest research/verification surface at implementation time (exact `ai` v6 API, web-search tool name, Vercel plan's `maxDuration` ceiling) — budget explicit phase-level research here per the roadmap's "flag deeper research" guidance.

## Sources

- Direct repository inspection: `src/**/*.ts(x)`, `package.json`, `next.config.ts`, `drizzle.config.ts`, `.planning/PROJECT.md` (all read 2026-07-29, HIGH confidence — these are ground truth, not inference).
- `~/.claude/plugins/cache/claude-plugins-official/vercel/0.44.0/skills/ai-sdk/SKILL.md` and bundled `references/common-errors.md`, `references/ai-gateway.md`, `references/type-safe-agents.md` — AI SDK v6 API shape (`ToolLoopAgent`, `generateText` + `Output.object`, `stepCountIs`, AI Gateway model-string convention). HIGH confidence on what's documented there; the skill itself flags that web-search-tool-specific naming needs runtime verification once `ai` is installed — carried into this doc as a flagged gap, not asserted as fact.
- [next.config.js: serverActions | Next.js](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions) — `bodySizeLimit` config, default 1MB. MEDIUM confidence on whether this option has graduated out of `experimental` in Next 16 specifically — verify before implementing.
- [AI SDK 6 - Vercel](https://vercel.com/blog/ai-sdk-6) — confirms `generateObject`/`streamObject` deprecated in favor of `generateText`/`streamText` + `Output.object()` in v6. MEDIUM confidence (announcement-level source, cross-checked against the bundled skill docs above which agree).

---
*Architecture research for: ArcLumen 360 v1.1 (Start Page + Import + Analytic Agent + Layout rework)*
*Researched: 2026-07-29*
