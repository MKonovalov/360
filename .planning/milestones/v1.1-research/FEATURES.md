# Feature Research — v1.1: Start Page + Import + Analytic Agent

**Domain:** Internal sales-intelligence/CRM-adjacent tooling — overview dashboards, CSV/enrichment import flows, AI-agent human-review queues, for a small-team (~10-20 record) B2B ICP explorer
**Researched:** 2026-07-29
**Confidence:** MEDIUM-HIGH (CSV import and HITL-approval patterns corroborated across multiple independent sources incl. HubSpot/Salesforce official docs and AWS's agentic-AI guidance; dashboard patterns for *specifically small internal tools* are thinner in public literature and lean more on established CRM convention + reasoning from this codebase's existing schema)

Products/patterns reviewed: HubSpot & Salesforce contact/CSV import wizards, CSVbox (import-UX vendor, cross-SaaS pattern library), Clay/Claygent (AI web-research agent for buying signals — closest existing analog to the "Analyze" feature), enrichment-sync literature (Apollo/Explorium/Coffee.ai on merge-vs-overwrite), Salesforce "Recently Viewed" widget convention, and current HITL/agent-approval-UX guidance (AWS Agentic AI Lens, AI UX Playground's Approval Workflows pattern, HatchWorks' agent UX pitfalls).

This milestone builds four distinct features on top of the existing v1.0 Company/Persona/Signal explorer. Each is treated as its own mini feature-landscape below per the downstream consumer's request, followed by shared dependency/complexity rollups.

---

## Feature 1: Start Page (Overview Dashboard)

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Summary stat cards (count of Companies, count of Personas, count of active Signals, breakdown by strength) | Baseline "at a glance" pattern for any admin/CRM landing page — every reviewed dashboard (Adobe Commerce admin, generic SaaS admin panels) leads with top-line counts before any list | LOW | Simple `COUNT`/`GROUP BY` queries against existing `company`/`persona`/`signal` tables — no schema change |
| Recent signals list (most recently added/detected signals, newest first, linked to their Company) | Matches the "Activity" card convention (recent events feed) that's standard on internal admin dashboards; directly serves the Core Value ("see buying signals in seconds") by surfacing what's new without opening every Company | LOW | `ORDER BY createdAt DESC LIMIT N` on existing `signal` table, joined to `company.name` — no schema change |
| Recently-viewed records (Companies/Personas the current user opened recently) | Direct analog to Salesforce's long-standing "Recently Viewed" widget — the single most copied CRM dashboard convention; especially valuable here since the Core Value is *fast* lookup, and this is the fastest possible re-entry point | LOW-MEDIUM | **No existing tracking mechanism in this codebase.** Needs either (a) a new `recently_viewed` table (clerkUserId, recordType, recordId, viewedAt) written to on each detail-page load, or (b) client-side `localStorage`, zero schema cost but per-browser not per-account. See Dependencies below — this is a real build decision, not just a display concern |
| Landing/entry point replacing whatever currently sits at `/` | PROJECT.md explicitly calls Start Page "the new landing view before Companies/Personas" — it becomes the default post-login destination | LOW | Routing change only; existing `requireStaffAccess()` gate applies unchanged |
| Quick-nav affordance into Companies/Personas from the dashboard | Every admin dashboard convention (and the existing left-nav pattern) treats the landing page as a jumping-off point, not a dead end | LOW | Reuses existing left-nav; dashboard cards/rows should link straight to the relevant Company/Persona detail |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| "Needs attention" section — Companies with high-strength signals and no recent staff review | Turns the dashboard from passive summary into an actual triage tool, closer to what 6sense-style "prioritized account" dashboards do, without needing full scoring | MEDIUM | Requires *some* notion of "reviewed" — doesn't exist today; could piggyback on the "recently viewed" table if built, or be deferred |
| Signal-type breakdown (counts per the 4 named signal types) | Cheap glanceable widget given the fixed 4-value `signalTypeEnum` already in schema; directly reflects the GBS/SSC-specific taxonomy that's this product's actual differentiator vs. generic CRM tools | LOW | `GROUP BY signalType` — no schema change |
| Team-wide activity feed ("who looked at what," not just the current user's own recent items) | Matches the stated Core Value of *shared* visibility ("signal knowledge... replacing knowledge scattered across individual heads") more directly than a per-user recently-viewed list | MEDIUM | Requires the recently-viewed table to store/display `userId` alongside each view and resolve it to a Clerk display name — more than "recently viewed" alone, and raises a light privacy question worth a one-line product decision (is "staff can see what colleagues are looking at" desired?) |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| BI-style charts (trend lines, cohort/funnel analysis) | "Real dashboards have charts" | At ~10-20 records there's no meaningful trend to chart; adds a charting dependency and empty/near-empty-state design burden for no payoff | Plain stat cards and short lists; revisit if/when record volume grows an order of magnitude |
| Customizable/draggable widget layout | Feels "enterprise" | Widget-layout persistence is real engineering (per-user layout storage, drag-drop library) for a page whose entire job, at this scale, is "show me 4-5 fixed things fast" | Fixed, opinionated layout; no configuration |
| Real-time auto-refreshing dashboard (polling/websockets) | Feels "live" | No multi-user concurrent-editing pressure exists yet (small internal team, low write volume); adds infra for a freshness need nobody has asked for | Standard server-rendered page, refreshed on navigation — matches existing app's request-per-page model (no client-side app state today per `.planning/codebase/ARCHITECTURE.md`) |

---

## Feature 2: Layout Rework (Stacked List/Detail — Companies & Personas)

This is a UI refactor of an already-built pattern, not a net-new domain to survey — but the target interaction (full-width list, click a row to expand a full-width detail panel below it) is a well-established pattern (accordion/expand-in-place lists, seen in Linear's issue list, GitHub Actions run list, Stripe dashboard tables) distinct from the side-by-side master-detail pattern v1.0 shipped with.

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Single-row-expand accordion behavior (opening a new row closes the previous one) | Standard for this pattern family — multiple simultaneously-open full-width panels would push everything else off-screen and break scanability | LOW | Selection state already exists (v1.0 master-detail); this changes *where* it renders, not whether it exists |
| URL-syncable expanded/selected state (deep-linkable, back-button-safe) | v1.0 already URL-syncs filters (`.planning/PROJECT.md` "all URL-synced"); the expanded row is the direct continuation of that same convention and is needed for bookmarking/sharing a specific Company | LOW | Extend existing URL-param pattern used for filters/selection |
| Scroll-to-expanded-row on open, explicit collapse/close control | Without this, expanding row #40 in a long list leaves the user staring at a panel far from their click, with no way back to the list view | LOW-MEDIUM | Standard accordion UX; needed regardless of list length given filters can surface far-down rows |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Keyboard navigation (arrow keys between rows, Enter to expand) | Matches power-user CRM/admin table conventions (Linear, Superhuman-style lists); low cost given list virtualization isn't needed at this record volume | LOW | Nice-to-have, not requested explicitly — safe P2 |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Maintaining both side-by-side AND stacked layouts (user-toggleable) | "Give power users a choice" | Doubles the surface area to build/test/maintain for a milestone whose explicit ask is to *replace* side-by-side, not add an option; no evidence yet that both are needed | Ship stacked only, as scoped; revisit if user feedback specifically asks for the old layout back |
| Multiple rows expanded simultaneously | "Let me compare two records" | Breaks the "full-width detail" premise (two full-width panels = double the vertical scroll, unclear which is "selected"); not requested | Single-expand accordion; if comparison becomes a real need later, treat as its own feature (e.g., a compare view), not a side effect of this layout change |

**Dependencies:** None on the data model — this is purely a component/state-management refactor of `company-list.tsx`/`company-detail.tsx` and their Persona equivalents. No new DB tables or fields required.

---

## Feature 3: Import (CSV + Commercial Enrichment API)

### 3a. Menu Button (shared UI shell for Import + Analyze)

PROJECT.md specifies a "Menu" button (not a bare "Import" button) on list pages, containing an Import action. This matches a dropdown/kebab-menu pattern common in data-dense admin UIs (Notion, Linear "..." menus) — it's a deliberate choice to keep the action *findable but not primary*, versus HubSpot's convention of a persistent top-level "Import" button (HubSpot treats import as a frequent, first-class action; PROJECT.md's explicit "Menu → Import" structure suggests it's expected to be used occasionally, not constantly, which fits a ~10-20 record internal tool).

**Dependency:** No dropdown-menu primitive exists yet in `src/components/ui/` (checked — only `button`, `select`, `sheet`, `table`, etc. are installed). Adding shadcn's `dropdown-menu` component is a prerequisite for both the list-page "Menu → Import" and detail-page "Menu → Analyze" affordances — one shared component, two usages.

### 3b. CSV Import

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Upload → map → validate/preview → confirm → commit wizard flow | This is the converged industry-standard shape across every CSV-import product/vendor reviewed (CSVbox, HubSpot, Salesforce) — deviating from it (e.g., a single-step blind upload) is a well-documented source of user error | MEDIUM | Multi-step client flow + server-side parse/validate; standard, not novel |
| Column-to-field mapping with auto-detect + manual override | HubSpot auto-matches headers and flags unmatched columns with a warning rather than failing silently; users expect to see and correct the mapping before anything is written | MEDIUM | Map to existing Drizzle columns; enum columns (`revenueBand`, `ownershipType`, `seniority`) need mapping *values* too (e.g., CSV's "50-250M" → `50m_250m`), not just column names — this is a step beyond simple column mapping |
| Row-level validation with partial import (commit valid rows, report invalid ones with row number + reason) | Documented best practice across every CSV-import source reviewed; all-or-nothing imports on a hand-maintained CSV are a known source of frustration ("one bad row blocks 200 good ones") | MEDIUM | Required for a usable import experience given hand-edited seed-style CSVs are the expected input source here |
| Dedup handling against existing Companies/Personas | Table stakes once import is repeatable (staff will re-run imports as data gets updated) — HubSpot dedupes on email by default, flags a "key" column | MEDIUM-HIGH | **Schema gap:** `company` has no natural unique key today (no `domain`/`website` field) — `name` alone is a fragile dedup key (case/spacing/legal-suffix variance). `persona.email` is nullable, so it can't be relied on as the sole key either. This is a real schema decision for the roadmap, not just an import-UI decision — see Dependencies below |
| Import summary confirmation (X created, Y updated, Z skipped/errors) | Universal pattern — every source reviewed treats this as the closing step of the wizard | LOW | Simple counts from the commit step |

**Differentiators:**

| Feature | Value Proposition | Complexity | Notes |
|---------|--------------------|------------|-------|
| Downloadable CSV template with correct headers + valid enum values pre-filled | Removes the single biggest source of mapping friction (staff guessing what values `revenueBand` accepts) — cheap to build, disproportionately reduces support burden for a small non-technical team | LOW | Generate from the Drizzle enum definitions directly so it never drifts from schema |
| Import history/audit (who imported what, when, rollback) | Useful once import becomes a recurring operational habit, not a one-off migration | MEDIUM-HIGH | Needs a new `import_batch`/`import_log` table — reasonable v1.x add, not needed for the first working import |

**Anti-Features:**

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Fuzzy/probabilistic dedup matching (Levenshtein/similarity scoring) | "Catch near-duplicate company names automatically" | At ~10-20 records, false positives from fuzzy matching cost more staff attention than they save; the enrichment-sync literature reviewed explicitly favors "consistent normalization + a stable key" over reactive fuzzy merging | Exact-match dedup on a normalized key (lowercased name, or better, a `domain` field — see below); flag unmatched-but-similar rows for manual review rather than auto-merging |
| Recurring/scheduled CSV imports (SFTP drop, watched folder) | "Automate it fully" | No stated recurring-import need exists yet; this is real integration infra for a workflow that's currently manual and infrequent | Staff-triggered "Import" click, as scoped |
| In-wizard transformation/formula engine (conditional mapping, computed fields) | "Handle any CSV shape" | Massive scope increase for a tool serving one small internal team's own exports — the CSV shape is controllable at the source | Simple 1:1 column mapping; if a recurring vendor export needs transformation, handle it upstream of the CSV, not inside this wizard |

### 3c. Commercial Enrichment API Integration

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Staff-triggered enrichment for an existing Company/Persona ("Enrich this record") and/or as part of bulk import | This is the core value prop named in PROJECT.md ("pull real firmographic/contact data instead of manual seed data") — the table-stakes version is on-demand, not automatic | MEDIUM-HIGH | Vendor-dependent (Clearbit/Apollo/ZoomInfo/Clay still TBD per PROJECT.md) — build the internal import/write path vendor-agnostic (adapter interface) so vendor choice is swappable without touching merge/dedup logic |
| Explicit merge-conflict handling when enrichment finds a record that appears to match an existing one | Every enrichment-sync source reviewed (Apollo CRM Enrichment docs, Explorium, Coffee.ai) converges on the same answer: **default to filling only empty fields ("auto-fill"/merge), not blind overwrite** — staff-entered/curated data is treated as higher-trust than a vendor guess unless the team explicitly says otherwise | MEDIUM-HIGH | This directly matches this codebase's existing philosophy (`signal.source` already models provenance as "manual" vs a named source) — extend that provenance concept to Company/Persona core fields too, see Dependencies |
| Field-level provenance (which fields came from manual/CSV entry vs. which came from the enrichment vendor) | Needed so staff can judge how much to trust any given field, especially once merge/auto-fill is in play — without this, staff can't tell why a field changed | LOW-MEDIUM | Needs a new `dataSource`/origin marker — see Dependencies; could be as simple as one `data_source text` column per table for v1.1, more granular per-field provenance is a later refinement |

**Differentiators:**

| Feature | Value Proposition | Complexity | Notes |
|---------|--------------------|------------|-------|
| Field-level merge review UI ("current value vs. incoming value," accept/reject per field) before committing enrichment writes | Gives staff the same trust/control the Analyze feature's review queue gives for signals — a lighter version of the same pattern, and there's a real opportunity to share UI components between "review an enrichment merge" and "review a signal proposal" | MEDIUM-HIGH | Natural v1.x follow-on once both Import and Analyze ship and the shared "propose → review → commit" shape becomes visible in the codebase |
| Vendor match-confidence display (e.g., Clay's waterfall-style confidence score) | Helps staff judge whether an "enriched" field is trustworthy | LOW-MEDIUM (mostly UI once the vendor API returns a score) | Vendor-dependent; not all candidates (Clearbit/Apollo/ZoomInfo/Clay) expose this uniformly |

**Anti-Features:**

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Silent full overwrite of existing Company/Persona fields from the enrichment vendor | "Always keep data freshest" | Directly conflicts with the product's stated Core Value ("complete, *trustworthy* 360 view") — a vendor API silently clobbering a staff-curated field (e.g., a manually-verified `hqLocation` or `techStack` entry) with a lower-quality guess erodes exactly the trust this tool exists to build. It would also be inconsistent with the Analyze feature's explicit no-silent-write constraint for Signals | Auto-fill empty fields only by default; any overwrite of a populated field should be visible and, ideally, opt-in per field (ties to the differentiator above) |
| Enrichment vendor auto-creating *new* Company/Persona records from "similar company" suggestions | "Discover more ICPs automatically" | Scope creep from "enrich what we track" into prospecting/list-building, which PROJECT.md explicitly defers (scoring/prioritized target list is a later milestone) | Enrichment only ever touches records staff already track or explicitly imported via CSV |

---

## Feature 4: Analytic Agent ("Analyze")

Closest real-world analog found: Clay's **Claygent**, an AI web-research agent purpose-built for exactly this class of task (monitors job changes, funding, leadership changes, press for buying triggers, from unstructured web sources). The general human-in-the-loop pattern this feature needs — "agent proposes an action, pushes it to a queue, waits for human approval before it takes effect" — is documented as the simplest and most common HITL architecture across the agent-UX sources reviewed (AWS Agentic AI Lens, AI UX Playground's "Approval Workflows" pattern).

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| On-demand, staff-triggered analysis for one specific Company (via the "Analyze" menu action) | Matches PROJECT.md's scope exactly — this is an on-demand tool, not a background scanner | HIGH | Requires an LLM + web-search-capable pipeline (vendor/tool TBD — separate STACK-level question); asynchronous by nature since web research takes real time |
| Async execution with a visible pending/running state | Web search + reasoning realistically takes seconds-to-tens-of-seconds — this cannot be a blocking request/response; per the HITL sources, "asynchronous escalation" (agent runs, user can navigate away, result appears later) is the standard shape for anything beyond instant actions | MEDIUM-HIGH | Vercel serverless function duration limits are a real constraint here (flagged for ARCHITECTURE.md/roadmap, not resolved in this doc) |
| Structured proposal record — reuses the *same* `signalType`/`signalStrength` enums as real signals, plus a source citation (URL/article), the agent's reasoning, and a status (pending/approved/rejected) | The agent's output must be classification-compatible with the existing 4-value signal taxonomy so approved proposals slot directly into the real `signal` table without a translation step; freeform/unstructured proposals would be a regression from the "typed, dated, sourced signal record — never free text" principle already encoded in this schema (`schema.ts` comment on `signal`) | HIGH | **New table required** — see Dependencies. Classifying unstructured news text into one of 4 fixed enum values is itself the hard part of this feature, not a side detail |
| Dedicated review queue view listing all pending proposals across Companies, each showing the proposed signal + evidence/citation + Accept/Reject actions inline | The HITL research is explicit that reviewers need "the exact action, evidence, and uncertainty" visible on the review surface itself ("show your work"), not behind a click-through — and a queue/inbox pattern is called out as the standard shape precisely because proposals will accumulate across multiple Companies/runs over time, not stay scoped to one Company's page | MEDIUM-HIGH | New page/route; likely reachable from the Start Page (a "pending review" count) and/or its own nav destination |
| Pending-count badge surfaced on the Company detail page and/or Start Page | Reviewers shouldn't have to remember to check a separate queue page — a lightweight pointer badge ("3 pending") is the low-cost complement to the queue, not a replacement for it | LOW | Simple count query against the new proposal table, scoped by company |
| No auto-write to the live `signal` table under any circumstance | Explicit, non-negotiable constraint from PROJECT.md ("staff approves before they become live records, no auto-write to DB") | — | Approval is a distinct staff action that copies/promotes a proposal row into `signal` (with `source` set to the agent/vendor name) — never implicit |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|--------------------|------------|-------|
| Evidence trail retained after approval (the live `signal.source`/note links back to the original article the agent cited) | Directly reinforces "complete, *trustworthy* 360 view" — a staff member six months from now can see *why* a signal exists, not just that it does | LOW-MEDIUM | `signal.source` already exists as a text field — populate it with the citation URL on promotion; minimal extra cost given the proposal table already stores it |
| Duplicate-aware proposing (agent/backend checks existing live signals before proposing, to avoid re-proposing something already recorded) | Reduces queue noise as the feature gets used repeatedly on the same Companies over time | MEDIUM | Query existing `signal` rows for the company + type before surfacing a new proposal; not needed for a correct v1.1, but cheap to add early to avoid queue fatigue |
| Batch accept/reject across multiple proposals | Efficiency gain once proposal volume grows past a handful | LOW-MEDIUM | Pure UI convenience over the same underlying approve/reject action |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Confidence-threshold auto-approval (agent decides "high confidence" proposals go live without review) | Common pattern elsewhere in HITL literature for low-risk/reversible actions | Directly contradicts PROJECT.md's explicit constraint, and a Signal that feeds future ICP prioritization is not a low-risk, easily-reversible action — the AWS Agentic AI Lens source explicitly scopes auto-approval to low-risk cases only, which this isn't | 100% human review, no threshold-based bypass, for the full v1.1 scope |
| Scheduled/background sweep across *all* Companies on a timer | "Why wait for someone to click Analyze" | Turns a bounded, staff-initiated feature into an always-on scanning service with its own cost/rate-limit/scale profile — not what PROJECT.md scoped ("web-search-based signal-detection agent" triggered via a menu action on one Company) | On-demand only, per PROJECT.md; a scheduled sweep is a reasonable *future* candidate once the manual flow is proven useful |
| Open-ended chat interface for interacting with the agent ("ask it anything about this company") | Feels flexible/powerful | The agent-UX sources reviewed specifically call out "chat-first UX fails" for this class of bounded, reviewable task — a structured proposal card (plain-language claim, evidence, accept/reject) is both faster to review and safer than a free-form conversation that could wander off-task | Structured "Analyze" trigger → structured proposal cards in a queue, no chat surface |
| Free-text-only proposed signals (skip the enum mapping, just store the agent's prose) | Faster to build, agent output doesn't need to be classified | Breaks consistency with every existing signal on every Company — badges, filters, and the Start Page's signal-type breakdown all depend on the typed enum; unstructured proposals couldn't become real `signal` rows without a manual re-typing step by staff anyway, defeating the point of the queue | Agent output must map to `signalTypeEnum`/`signalStrengthEnum`; if the agent is uncertain, the proposal can carry a lower `strength` or an explicit "uncertain" note, but the type field is still one of the 4 fixed values |

---

## Feature Dependencies

```
Start Page — summary stats
    └──requires──> existing company/persona/signal tables (no schema change)

Start Page — recent signals
    └──requires──> existing signal table (no schema change)

Start Page — recently viewed
    └──requires──> NEW: recently_viewed tracking (table OR localStorage — decision needed)

Layout rework (stacked list/detail)
    └──requires──> nothing new; refactors existing v1.0 master-detail components + URL-param pattern

Menu button (list pages + detail panel)
    └──requires──> NEW: shadcn dropdown-menu primitive (not yet installed)
    └──enables──> Import action (list pages), Analyze action (detail panel)

CSV Import
    └──requires──> Menu button
    └──requires──> dedup key decision on Company (name is fragile; domain/website field recommended)
                       └──possibly requires──> NEW: company.domain (or website) column
    └──requires──> enum-value mapping UX (revenueBand/ownershipType/seniority CSV values → Drizzle enum values)
    └──enhances──> Enrichment API import (shares dedup/merge logic)

Enrichment API Import
    └──requires──> Menu button (or per-record "Enrich" action)
    └──requires──> same dedup key as CSV Import
    └──requires──> merge-conflict policy (auto-fill empty fields, default; not blind overwrite)
    └──requires──> NEW: provenance/data_source marker on company/persona (or per-field, if the
                       differentiator "field-level merge review UI" is built)
    └──requires──> vendor selection (Clearbit/Apollo/ZoomInfo/Clay) — separate STACK-level decision

Analytic Agent ("Analyze")
    └──requires──> Menu button (detail panel)
    └──requires──> NEW: signal_proposal table (companyId FK, signalType, strength, detectedAt,
                       note, sourceUrl, agentReasoning, status enum, createdAt, reviewedBy, reviewedAt)
    └──requires──> NEW: review queue page/route
    └──requires──> reuses existing signalTypeEnum / signalStrengthEnum (no new enums needed)
    └──requires──> LLM + web-search tool-use pipeline — separate STACK-level decision
    └──requires──> async execution strategy compatible with Vercel serverless function limits
                       (flagged for ARCHITECTURE.md — not resolved here)
    └──conflicts with──> any auto-write path to the live signal table (explicit anti-feature)
```

### Dependency Notes

- **The single biggest shared schema gap across Import (both CSV and enrichment) is the lack of a stable dedup key.** `company` has no `domain`/`website` field today and `persona.email` is nullable — both CSV import and enrichment-API import need *some* reliable matching key to decide "is this a new record or an update to an existing one." This should be resolved once, at the schema level, and reused by both import paths rather than solved twice with different (and possibly inconsistent) matching logic.
- **Provenance tracking is a new concept for Company/Persona, but not for Signal.** `signal.source` already exists specifically to answer "where did this come from" (manual vs. future enrichment). Extending an equivalent lightweight `data_source` marker to `company`/`persona` is a small, consistent addition — and it's a prerequisite for the "auto-fill only, don't silently overwrite" merge policy that both the CSV and enrichment research converge on.
- **The Analyze feature's `signal_proposal` table is deliberately separate from `signal`, not a status flag added to `signal`.** Mixing draft/pending rows into the live table would pollute every existing badge, filter, and count that already reads from `signal` across the v1.0 explorer (list-row badges, Company detail signal display, and the new Start Page's signal-type breakdown) — a pending proposal must be invisible to all of those until approved.
- **Menu button is a one-time UI investment reused twice.** Both Import (list pages) and Analyze (detail panel) are specified as living inside a "Menu" affordance — building the dropdown-menu primitive once and reusing it for both keeps the two features visually/interactively consistent and avoids duplicated component work.
- **CSV Import and Enrichment API Import should share merge/dedup logic, not duplicate it.** Both face the identical "does this record already exist, and if so, what do we do" decision — building one shared merge-resolution path (used by both the CSV commit step and the enrichment write step) avoids two divergent implementations of the same policy.
- **The Analyze feature's async execution is the one open architectural question this research doesn't resolve.** Vercel serverless function duration limits are a real constraint for a "search the web, read several pages, reason about them" task; whether this needs a background-job pattern, a polling status column, or fits within a single function invocation is a question for phase-level/architecture research, not resolvable from feature-landscape research alone.

---

## MVP Definition

### Launch With (v1.1 — matches PROJECT.md Active requirements)

- [ ] Start Page: summary stat cards, recent signals list, recently-viewed list (server-tracked table recommended over localStorage, to match the product's "shared visibility" Core Value and work across the same user's devices) — replaces current landing view
- [ ] Layout rework: Companies and Personas both move to stacked full-width list/detail (single-expand accordion, URL-synced, scroll-to-expand)
- [ ] Menu button (shared dropdown component) on Company/Persona list pages → Import action
- [ ] CSV Import: upload → map (including enum-value mapping) → validate/preview → partial commit with row-level errors → summary — for both Companies and Personas
- [ ] Dedup key resolved at the schema level (recommend adding `company.domain`) before CSV/enrichment import ship, not after
- [ ] Commercial enrichment API integration: staff-triggered, vendor-agnostic adapter, auto-fill-empty-fields-only merge policy (no silent overwrite), basic field-level provenance marker
- [ ] Menu button on Company (and Persona, per PROJECT.md) detail panel → Analyze action
- [ ] Analytic Agent: on-demand web-search signal detection for one Company, proposals stored in a new `signal_proposal` table, dedicated review queue view with Accept/Reject + evidence/citation shown inline, pending-count badge on the Company detail page — no auto-write to `signal` under any circumstance

### Add After Validation (v1.x)

- [ ] Import history/audit log with rollback — once import becomes a repeated operational habit
- [ ] Field-level merge review UI for enrichment conflicts ("current vs. incoming, accept per field") — natural extension once both Import and Analyze's review-queue pattern exist in the codebase, sharable component
- [ ] Duplicate-aware proposing in the Analyze agent (skip re-proposing signals that already exist) — reduces queue noise once the feature sees repeated use
- [ ] Downloadable CSV template pre-filled with valid enum values — cheap, high-leverage polish
- [ ] "Needs attention" Start Page section (high-strength signals without recent staff review) — depends on a "reviewed" concept the recently-viewed table can seed

### Future Consideration (v2+)

- [ ] Scheduled/background Analyze sweeps across all Companies — defer until the on-demand flow is proven useful and its API/LLM cost profile is understood
- [ ] Vendor match-confidence display for enrichment — defer until a specific vendor is chosen and its API surface is known
- [ ] Team-wide activity feed (who viewed what) on the Start Page — defer pending a one-line product decision on whether cross-staff visibility of viewing activity is wanted
- [ ] Recurring/scheduled CSV import (SFTP, watched folder) — no stated need yet

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Start Page: stat cards + recent signals | HIGH | LOW | P1 |
| Start Page: recently viewed | MEDIUM-HIGH | LOW-MEDIUM | P1 |
| Layout rework (stacked list/detail) | HIGH | LOW-MEDIUM | P1 |
| Menu button (shared component) | MEDIUM (enabler) | LOW | P1 |
| CSV Import (map/validate/dedup/commit) | HIGH | MEDIUM | P1 |
| Dedup key schema addition (`company.domain`) | HIGH (blocks import correctness) | LOW | P1 |
| Enrichment API integration (auto-fill merge policy) | HIGH | MEDIUM-HIGH | P1 |
| Analytic Agent: proposal generation + review queue | HIGH | HIGH | P1 |
| Import history/audit + rollback | MEDIUM | MEDIUM-HIGH | P2 |
| Field-level merge review UI | MEDIUM | MEDIUM-HIGH | P2 |
| Duplicate-aware proposing (Analyze) | MEDIUM | MEDIUM | P2 |
| CSV template download | LOW-MEDIUM | LOW | P2 |
| "Needs attention" dashboard section | MEDIUM | MEDIUM | P2 |
| Scheduled Analyze sweeps | MEDIUM (long-term) | HIGH | P3 |
| Team-wide activity feed | LOW-MEDIUM | MEDIUM | P3 |
| Recurring CSV import | LOW | MEDIUM-HIGH | P3 |

**Priority key:**
- P1: Must have for v1.1 launch, matches PROJECT.md's Active requirements
- P2: Should have, add once the P1 core loop is validated
- P3: Nice to have, explicitly deferred, future milestone candidate

## Competitor/Analog Feature Analysis

| Feature | HubSpot/Salesforce (Import) | Clay/Claygent (Analyze analog) | Salesforce (Recently Viewed) | ArcLumen 360 v1.1 Approach |
|---------|------------------------------|----------------------------------|-------------------------------|------------------------------|
| Import flow | Multi-step wizard, auto-map + manual override, dedupe on email/Record ID (marked with a "key" icon) | N/A | N/A | Same wizard shape; dedupe key TBD-but-needed (`company.domain` recommended), enum-value mapping is an extra step beyond typical CRM imports |
| Merge policy | HubSpot updates existing contact with new file data on email match (effectively overwrite-on-match) | N/A | N/A | Deliberately more conservative: auto-fill empty fields only, no silent overwrite of populated fields — matches this product's "trustworthy" Core Value over HubSpot's default |
| AI signal detection | N/A | Web-research agent surfaces job changes, funding, leadership changes, press for buying triggers via natural-language prompts | N/A | Same category of task, scoped to GBS/SSC-specific signal taxonomy (4 fixed types) and gated behind mandatory human review before anything is live — Claygent's output typically flows more directly into outbound workflows, which this product explicitly avoids per PROJECT.md |
| Review/approval | N/A | N/A (Claygent enriches directly, no built-in approval queue) | N/A | Dedicated review queue + inline evidence, explicit no-auto-write constraint — closer to general agentic-AI HITL "approval queue" pattern than to Claygent's direct-write model |
| Recently viewed | N/A | N/A | Per-user list of recently opened records, links straight back to detail view | Same per-user pattern; open question (flagged as a differentiator, not table stakes) whether to extend to team-wide visibility |

## Sources

- [Show row-level error messages in imports | CSVBox Blog](https://blog.csvbox.io/row-level-errors-csv/) — MEDIUM confidence (vendor content, but pattern corroborated by HubSpot/Salesforce official docs below)
- [Support partial imports with valid rows only | CSVBox Blog](https://blog.csvbox.io/partial-import-valid-rows/)
- [Implement column mapping in your SaaS | CSVBox Blog](https://blog.csvbox.io/column-mapping-saas/)
- [Validate CSV data before saving to DB | CSVBox Blog](https://blog.csvbox.io/validate-csv-before-db/)
- [CSV Upload UI: File Import UX Patterns | CSVBox Blog](https://blog.csvbox.io/file-upload-patterns/)
- [How to Import Contacts in HubSpot | Topo](https://www.topo.io/blog/how-to-import-contacts-in-hubspot) — MEDIUM-HIGH confidence, corroborates HubSpot's auto-map + email-based dedup + "key" indicator behavior
- [HubSpot Import Contacts from CSV: Step-by-Step Guide | ImportCSV](https://www.importcsv.com/blog/hubspot-import-contacts-csv)
- [How to Import Contacts Into Salesforce (2026 Guide) | usecarly](https://www.usecarly.com/blog/how-to-import-contacts-into-salesforce/) — MEDIUM confidence, corroborates Salesforce's duplicate-rule-based import gating as a distinct model from HubSpot's default-overwrite-on-match
- [How to Implement Contact Enrichment for Sales Growth | MarketsandMarkets](https://www.marketsandmarkets.com/AI-sales/the-contact-enrichment-implementation-guide) — MEDIUM confidence
- [11 Best CRM Contact Enrichment Tools | Explorium](https://www.explorium.ai/blog/data-enrichment/crm-contact-enrichment/) — MEDIUM confidence, source for "auto-fill empty fields vs. overwrite" distinction
- [How to Automate CRM Contact Enrichment in 6 Steps | Coffee.ai](https://www.coffee.ai/articles/automate-crm-contact-enrichment/) — MEDIUM confidence, source for "dedupe on write, shared unique key" framing
- [Claygent — AI Agents for GTM | Clay.com](https://www.clay.com/claygent) — MEDIUM-HIGH confidence (primary vendor docs), closest real-world analog to the Analyze feature's web-research task
- [Clay - Achieving 10x growth with agentic sales prospecting | OpenAI](https://openai.com/index/clay/) — MEDIUM confidence
- [AGENTSEC04-BP02 Human-in-the-loop for critical decisions | AWS Agentic AI Lens](https://docs.aws.amazon.com/wellarchitected/latest/agentic-ai-lens/agentsec04-bp02.html) — HIGH confidence (official AWS architectural guidance), source for the "auto-approval only for low-risk/reversible actions" framing used in the anti-features section
- [Approval Workflows · Agents AI UX Pattern | AI UX Playground](https://aiuxplayground.com/pattern/approval-workflows/) — MEDIUM confidence, source for "approval queue is the simplest/most common HITL pattern" and the three architectural sub-patterns (synchronous gate, async escalation, parallel feedback)
- [AI Agent Approval UX: What Reviewers Must See | Edilec](https://edilec.com/blog/ai-11018/approval-screens-high-risk-agent-actions/) — MEDIUM confidence, source for "show your work" (action, evidence, uncertainty visible inline) review-surface guidance
- [Agent UX Patterns: Chat-First UX Fails | HatchWorks](https://hatchworks.com/blog/ai-agents/agent-ux-patterns/) — MEDIUM confidence, source for the chat-interface anti-feature reasoning
- `.planning/PROJECT.md` — primary source for v1.1 scope, explicit constraints (no auto-write, Menu-driven UI, vendor TBD)
- `src/lib/db/schema.ts` — primary source for current Company/Persona/Signal schema, used to identify the dedup-key gap, the `signal.source` provenance precedent, and the case for a separate `signal_proposal` table
- `src/components/ui/` (directory listing) — confirms no dropdown-menu primitive exists yet, informing the Menu-button dependency note

---
*Feature research for: v1.1 Start Page + Import + Analytic Agent (ArcLumen 360)*
*Researched: 2026-07-29*
