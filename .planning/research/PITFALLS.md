# Pitfalls Research

**Domain:** B2B ICP / account-intelligence explorer (Companies + Personas + buying/intent signals), built as a list/master-detail dashboard on seed data, reusing an existing Clerk-authenticated Astro/Sanity app
**Researched:** 2026-07-22
**Confidence:** MEDIUM — data-modeling and UI patterns are well-documented across CDP/CRM literature (MEDIUM-HIGH); the seed-to-integration and Clerk-reuse pitfalls are grounded directly in this repo's own `CONCERNS.md` findings (HIGH, first-party evidence) plus general architecture experience (MEDIUM)

## Critical Pitfalls

### Pitfall 1: Signals modeled as unstructured blobs instead of typed, sourced, dated facts

**What goes wrong:**
Buying signals (financial cost pressure, no mature GBS/SSC org, new CFO/GBS head, transformation program announcement) get stored as a single freeform "notes" or "signals" text field on the Company document, or as an array of untyped strings. This is the fastest way to seed data by hand, so it's tempting for a milestone-1 "just get it working" build. It works fine for a demo with 10 companies, then becomes unqueryable: you can't filter "companies with a new CFO signal in the last 90 days," you can't badge signal strength, you can't tell which signal came from which source, and every consumer (list badges, detail view, future scoring model) has to re-parse text.

**Why it happens:**
Freeform text is the path of least resistance when a human is hand-entering seed data and there's no enrichment API yet forcing a shape. Teams defer "real" modeling until the scoring/prioritization milestone, not realizing the explorer's badges and filters (an explicit milestone-1 requirement) already depend on structured signal data.

**How to avoid:**
Model each signal as its own typed record from day one, even in the seed/manual phase:
- `signal_type` (enum: `cost_pressure`, `immature_gbs_org`, `new_cfo_or_gbs_head`, `transformation_announcement`, extensible for future types)
- `company_id` (FK)
- `detected_at` / `observed_date` (when the signal was true, not when it was entered)
- `source` (manual-entry, LinkedIn, press release URL, enrichment-API-name — even if today it's always "manual")
- `strength`/`confidence` (enum or 1-5, not a color name) — this is what list badges render
- `raw_note` (free text is fine as a *supplementary* field alongside the typed fields, never instead of them)
A signal is a fact-with-provenance, not a description. Keep signals as their own collection/table related to Company (1:many), not an embedded field on Company — this is what makes "last-updated" badges and "signal strength" filtering trivial instead of requiring text parsing later.

**Warning signs:**
- Seed data has a `signals: string` or `notes: text` field instead of a `signals` relation/array-of-objects with typed fields
- The list-view "signal strength" badge is computed by string-matching (`.includes("cost pressure")`) rather than reading a field
- No `detected_at`/`source` per signal — can't answer "is this signal stale?"

**Phase to address:**
Data model phase (before or alongside the explorer UI build) — this is a schema decision, not a UI decision, and is expensive to retrofit once seed data and UI both assume a shape.

---

### Pitfall 2: Company-Persona relationship modeled as a hard 1:1 or single FK, not the actual many-to-many reality

**What goes wrong:**
It's tempting to give each Persona a single `company_id` field ("the company they work at") since that matches milestone 1's stated requirement ("Persona 360 view shows ... linked company"). But B2B reality — and this domain's own requirements — immediately break that: personas have "previous companies" (explicitly in scope), people move roles, and the same person can be a signal-relevant contact for more than one target account over time (e.g., a GBS consultant who sits on two advisory boards, or a CFO who is being tracked at their old company and their new one simultaneously during a transition). A rigid 1:1 forces awkward workarounds later — duplicating persona records per company, or silently losing history when someone changes jobs.

**Why it happens:**
The milestone-1 requirements read like 1:1 ("linked company," "linked personas") because that's the common case and the simplest to seed by hand. Teams model the common case and only discover the edge case (career history, multi-company relevance) when real enrichment data starts arriving with employment-history payloads.

**How to avoid:**
Model `Company` and `Persona` as a many-to-many join with role metadata, even though milestone 1's UI only ever needs to show "current" state:
- A `PersonaCompanyRole` (or `Employment`) join record: `persona_id`, `company_id`, `title`, `is_current` (bool), `start_date`/`end_date` (nullable)
- The Company 360 view's "linked personas" = filter join records where `company_id = X AND is_current = true`
- The Persona 360 view's "previous companies" = filter join records where `persona_id = Y AND is_current = false`, ordered by date
This costs almost nothing extra in milestone 1 (one join table instead of one FK column) and completely avoids a migration/rewrite when enrichment APIs (which return full employment history, e.g., LinkedIn-style data from Apollo/Clearbit) get wired in later.

**Warning signs:**
- `Persona.company_id` is a single foreign key with no join/history table
- "Previous companies" is stored as a text field or JSON blob on Persona rather than related records
- No `is_current` or date range concept anywhere in the persona-company relationship

**Phase to address:**
Data model phase — same phase as Pitfall 1, since both are schema-shape decisions that the seed-data and UI-build phases will inherit.

---

### Pitfall 3: Seed data hand-authored to match the UI's convenience, not the future enrichment API's actual shape

**What goes wrong:**
When "seed data now, real integration later" is explicit (as it is for milestone 1 here), the natural failure mode is designing the schema around what's easy to type by hand into a CMS/seed script — flat fields, no nulls, no arrays of ambiguous cardinality, no distinction between "we don't know this yet" and "this is empty." Real enrichment APIs (Clearbit/Apollo/ZoomInfo-style) return: nested/nullable fields, multiple values per attribute (multiple tech-stack tools, multiple previous titles), confidence scores per field, partial records (some companies have firmographics but no tech stack), and periodic re-fetch/refresh semantics. If milestone 1's schema doesn't anticipate this shape, the milestone-2 integration work becomes a schema migration plus a UI rewrite (every place that assumed "tech stack is a single string" or "signal is always present" breaks), not just "swap the data source."

**Why it happens:**
Milestone 1 explicitly defers enrichment APIs, so nobody is looking at a real Clearbit/Apollo response payload while designing the seed schema — teams design against their own mental model of "what a company record looks like" rather than against a real third-party schema, even in outline form.

**How to avoid:**
Before writing the seed-data schema, look at the actual response shape of at least one realistic enrichment API in this domain (Clearbit Company API, Apollo Organization Enrichment, or similar) even though milestone 1 won't call it. Concretely:
- Make every enrichment-sourced field nullable/optional in the schema (tech stack, firmographics) — never assume "always present," since real APIs return partial data
- Model one-to-many fields (tech stack tools, signals, previous companies) as arrays/relations from the start, not scalars, even if the seed data currently only has one value
- Add a `data_source` / `last_enriched_at` field per record (or per field-group) now, even if it's always `"manual"` and `null` in milestone 1 — this is the field that becomes load-bearing the day enrichment is wired in, and it's painful to retrofit onto records that already exist
- Keep the seed data itself in a structured, scriptable format (JSON/GROQ-importable documents, not hand-typed CMS UI entries) so a milestone-2 "replace seed rows with enrichment-API rows" is a data-loading change, not a re-typing exercise
- Do NOT let the UI directly assume single-value shapes ("the tech stack" singular) — this is the #1 place rework happens, because list/detail components get built against the seed shape and then need rewriting when arrays show up

**Warning signs:**
- Seed schema has no `source` or `enriched_at` concept anywhere
- Fields that will obviously be multi-valued in reality (tech stack, signals, previous companies) are modeled as a single string or single relation
- Nothing in the schema is nullable — seed data was authored to always be "complete," which real API responses never are
- No one has looked at an actual enrichment API's JSON response before finalizing the seed schema

**Phase to address:**
Data model phase, informed by a quick spike/read of one real enrichment API's schema (even without calling it) — cheap to do now, expensive to skip.

---

### Pitfall 4: Reusing "any authenticated Clerk user = full access" from the short-link tool without re-validating it for the new product's audience

**What goes wrong:**
This repo's own `CONCERNS.md` already flags that the current app treats "has a Clerk session" as equivalent to "is staff" with no role/claim check (`src/pages/l/[code].astro`, `src/pages/bridge.astro`). Milestone 1 explicitly keeps this model ("any authenticated staff user sees everything for now"), which is a reasonable MVP call — but ArcLumen 360 is a materially different product: it's presenting a broader, mixed audience (leadership + staff, not just the short-link tool's narrow internal use), and it now surfaces sensitive competitive-intelligence data (target company buying signals, exec change tracking) rather than just redirect metadata. The risk isn't "does it work in milestone 1" (it will) — it's that the auth model gets carried forward unexamined into milestone 2+ when scoring, CRM sync, and possibly external/partner access get added, at which point "every Clerk user sees everything" silently becomes a real data-exposure risk instead of a documented, deliberate MVP shortcut.

**Why it happens:**
Reusing an existing, working auth integration feels like solved-problem territory ("auth already works, don't touch it"), so nobody re-asks "does this auth model still fit" when the product's data sensitivity and audience change materially. The existing code has zero comments documenting the "every user = staff" assumption, so it's easy for a future contributor to not even realize it's a deliberate simplification rather than an oversight.

**How to avoid:**
- Explicitly document in code (not just in planning docs) that "authenticated Clerk user = has explorer access" is a deliberate milestone-1 decision, with a comment at the auth-check call site referencing where roles would be added later
- Structure the auth-check as an isolated, single function/middleware (e.g., `requireStaffAccess()`) rather than inline `if (userId)` checks scattered across pages — so that adding a role/claim check later is a one-file change, not a grep-and-replace across every route
- If Clerk Organizations or custom session claims are available in the existing Clerk instance, confirm now (even if unused in milestone 1) that the data model doesn't preclude adding a role check later — i.e., don't hardcode assumptions ("if authenticated, render everything") deep inside data-fetching logic where a future role filter would be hard to inject
- Revisit this explicitly at the milestone-1 → milestone-2 transition, especially before CRM sync/outreach or any external-partner access is added, since those are exactly the points where "every Clerk user sees everything" stops being safe

**Warning signs:**
- Auth checks are duplicated inline (`Astro.locals.auth().userId` checked ad hoc) across multiple pages rather than centralized
- No code comment anywhere stating the "any authenticated user = staff" assumption is intentional
- New Company/Persona data-fetching code has no seam where a role/permission filter could be inserted without a rewrite

**Phase to address:**
Auth/access-control review should happen once, explicitly, during the milestone-1 UI-shell phase (to centralize the check, even without adding roles yet), and be re-verified at the milestone 1 → milestone 2 transition per this repo's own `.planning/PROJECT.md` evolution process.

---

### Pitfall 5: List/master-detail explorer built without virtualization or server-side filtering, assuming seed-data scale forever

**What goes wrong:**
With a small seed dataset (tens of companies/personas), a naive list — render all rows, filter/search entirely client-side over the full in-memory array, no virtualization — feels fast and "done." The recall.ai-style explorer UI this project is modeled on implies growth: more companies, more personas, more signals per company. If list rendering, search, and filter logic are written assuming "the whole dataset fits comfortably in the DOM and in a client array," the moment real enrichment data starts populating hundreds/thousands of companies, the UI degrades (slow re-renders on every keystroke in search, janky scroll) and the fix requires re-architecting list rendering (virtualization) and moving filter/search logic server-side — not a small patch.

**Why it happens:**
Seed data is small by definition (milestone 1 is manual/seed-only), so performance problems literally cannot appear yet — there's no scale to catch the problem during development, only after real data starts flowing in a later milestone.

**How to avoid:**
- Use a virtualized list component (e.g., `react-window`/`@tanstack/react-virtual` or framework equivalent) for the Companies/Personas lists from the start, even though seed data won't exercise it — retrofitting virtualization after non-virtualized markup/CSS assumptions are baked in (fixed-height rows, absolute positioning assumptions) is more work than building it in from the start
- Write search/filter as a function with a clear seam for "runs client-side today, could run as a server query tomorrow" (e.g., a single `filterCompanies(params)` entry point) rather than scattering `.filter()` calls inline in components — this is what lets you swap to server-side/paginated filtering later without a UI rewrite
- Use stable, real IDs (not array index) as list item keys from day one — this is cheap to get right early and expensive to fix once list re-ordering (e.g., "sort by last signal date") is added and items visibly reflow/lose state on re-render

**Warning signs:**
- List rendering maps directly over the full dataset array with no windowing library
- Search/filter state lives as component-local `useState` with `.filter()` calls inline in the render, no extracted query function
- List item keys are array indices

**Phase to address:**
Explorer UI build phase (milestone 1) — the fix is cheap now (pick a virtualized-list pattern up front) and expensive later (rewrite once real data volume exists).

---

### Pitfall 6: List/detail selection and filter state kept only in component state, not the URL — breaking deep-linking, back button, and shareability

**What goes wrong:**
The whole point of this tool is "anyone on the team can pull up a company or persona ... in seconds" — which implies people will share links ("check out Acme Corp's signals") and use the browser back button to return to a previous list/filter view. If which item is selected, which filters are active, and which nav section (Companies vs Personas) is open live only in React/component state (not reflected in the URL), none of that works: refreshing loses your place, the back button doesn't un-select, and a Slack-shared link just opens the default view instead of the specific company someone meant to share.

**Why it happens:**
Master-detail UIs are easy to build with local `selectedId` state first, and URL-syncing is often treated as a "nice to have" polish step that gets deferred — but for a shared-lookup tool, it's core to the value proposition ("fast, shared ICP lookup"), not a nice-to-have.

**How to avoid:**
- Make the URL the source of truth for: active nav section (Companies/Personas), selected item ID, and active search/filter params — component state should be derived from the URL (via router params/query string), not the other way around
- Use the framework's routing primitives for this (Astro's file-based routes + query params, or a client router if the explorer becomes an SPA island) rather than inventing custom state management first and bolting URL sync on after
- Test the "share a link to a specific company detail view" flow explicitly as part of milestone-1 acceptance — if pasting a URL into a new tab doesn't reproduce the exact view, the deep-linking requirement isn't actually met yet

**Warning signs:**
- Clicking a list item changes a `useState` variable but the URL bar doesn't change
- Refreshing the page while viewing a company detail resets to the list-only view
- No route exists per company/persona (e.g., `/companies/[id]`) — everything lives under one route with client-only state

**Phase to address:**
Explorer UI build phase (milestone 1) — this is core to the "fast, shared lookup" value proposition stated in `PROJECT.md`, so it belongs in milestone 1's definition of done, not deferred as polish.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|--------------------|-----------------|------------------|
| Signals as freeform text/notes instead of typed records | Fastest to hand-author seed data | Can't filter/badge by signal type or recency; every consumer re-parses text | Never for milestone 1 — badges/filtering are explicit requirements |
| Single `company_id` FK on Persona (no join/history table) | Simpler seed schema, matches "linked company" requirement literally | Breaks the moment "previous companies" or multi-company relevance needs real modeling — both already in scope | Never — the join table costs almost nothing extra now |
| Hand-typed seed data with no `source`/`enriched_at` fields | One less field to fill in by hand | Enrichment integration (milestone 2+) requires a schema migration + backfill instead of a data-source swap | Acceptable only if the field exists but is always `null`/`"manual"` in milestone 1 — not acceptable to omit the field entirely |
| Inline `if (userId)` auth checks scattered per-page (current pattern in this repo) | Reuses existing pattern with zero new code | Adding role-based access later requires touching every route instead of one central function | Acceptable short-term if centralized into one function even without adding real roles yet |
| Client-only filter/selection state, no URL sync | Faster to prototype the explorer UI | Breaks deep-linking/sharing, the product's core value prop | Never — URL-as-source-of-truth is cheap to build in from the start |
| No virtualization on lists (render full array) | Simpler list component code | Degrades badly once real data volume arrives (hundreds+ rows) | Acceptable only if seed data is guaranteed to stay under ~50 rows through all of milestone 1 — otherwise build it in now |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|------------------|--------------------|
| Future enrichment API (Clearbit/Apollo/ZoomInfo-style) | Designing seed schema around hand-entry convenience without ever looking at a real API response shape | Spike-read one real enrichment API's schema now (even unused) to shape nullable/array fields correctly |
| Clerk (existing integration, reused) | Assuming "auth already works" means the *access model* also still fits a materially different, more sensitive product | Re-validate the "any authenticated user = full access" assumption explicitly for this product's data sensitivity; centralize the check |
| Sanity (existing integration, possibly reused for this data model) | Reusing the short-link tool's flat, single-document-type Sanity schema pattern for what's now a relational Company↔Persona↔Signal model | Design proper Sanity reference fields (`reference` type) for Company↔Persona↔Signal relationships instead of embedding/duplicating data across documents |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Non-virtualized list rendering | Scroll jank, slow initial render | Use `react-window`/`@tanstack/react-virtual` (or equivalent) from the start | Noticeable above roughly a few hundred rows; the real target list may exceed this after enrichment |
| Client-side-only search/filter over full dataset | Typing in search lags, filters take longer as data grows | Extract filter logic to a single function with a seam for server-side query later | Breaks down once companies/personas number in the low thousands |
| Sanity `useCdn: false` for a read-heavy dashboard (this repo's existing pattern) | Every list/detail view hits Sanity's live API instead of CDN | Flip to `useCdn: true` for read-heavy dashboard queries where slight staleness is fine | Matters once the explorer has meaningful internal traffic (this repo's `CONCERNS.md` already flags this from the short-link tool) |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Carrying forward "any authenticated Clerk user = staff" unexamined (already flagged in this repo's `CONCERNS.md`) | Broader/mixed audience + more sensitive competitive-intelligence data than the original short-link tool → data exposure risk grows silently as the product evolves | Document the assumption explicitly in code; centralize the check; re-verify at milestone transitions |
| Swallowing errors from data-layer calls (`catch {}` pattern already present in this repo) reused for the new Company/Persona data layer | A misconfigured data source (Sanity or future enrichment API) silently renders empty/wrong data instead of a visible error, undermining the tool's "trustworthy 360 view" value prop | Log caught errors; surface an explicit "data unavailable" state in the UI rather than silently falling back to empty |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| Signal badges rendered but never dated/sourced | Users can't tell if "new CFO" signal is from last week or six months ago — undermines trust ("is this still accurate?") | Always show a relative last-updated/detected date next to signal badges |
| No empty/partial-data states for companies missing tech stack or some signal types | Blank sections look like bugs, not "we don't have this data yet" | Explicit "not yet enriched" / "no data" states per section, especially important going into milestone 2 when real data will be genuinely partial |
| List/filter state lost on navigation or refresh | Breaks the "pull up a company in seconds and share it" value proposition | URL-as-source-of-truth for selection and filters (see Pitfall 6) |

## "Looks Done But Isn't" Checklist

- [ ] **Signal display:** Often missing per-signal date/source — verify each signal badge can answer "when was this observed and from where"
- [ ] **Company↔Persona linking:** Often missing the "previous companies" / multi-company case — verify the join isn't a rigid single FK
- [ ] **Deep-linking:** Often missing URL sync for selected item/filters — verify pasting a detail-view URL into a fresh tab reproduces the exact state
- [ ] **List performance:** Often missing virtualization "because seed data is small" — verify the list component doesn't assume dataset size stays constant
- [ ] **Auth model:** Often missing an explicit code comment on the "any authenticated user = staff" assumption — verify it's documented, not just implicit
- [ ] **Seed data shape:** Often missing nullable/array modeling for fields that will obviously be multi-valued or partial once real enrichment data lands — verify against a real enrichment API's schema, even if unused today

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|-----------------|------------------|
| Signals stored as freeform text | MEDIUM | Write a one-time migration script to parse existing seed notes into typed signal records; re-author remaining seed data directly in the new typed shape going forward |
| Rigid 1:1 Company-Persona FK | MEDIUM | Introduce the join table, backfill from existing FKs (each becomes one `is_current=true` row), then deprecate the old FK column |
| Seed schema with no nullable/array fields, no source tracking | HIGH | Requires a schema migration plus auditing every UI component that assumed single-value/always-present fields — budget real time for this before starting milestone-2 enrichment work |
| Client-only list/filter state (no URL sync) | LOW-MEDIUM | Refactor to route params/query string once; existing component logic mostly just moves from `useState` to reading/writing the URL |
| No virtualization on lists | LOW-MEDIUM | Swap the row-rendering approach for a virtualized list library; mostly isolated to the list component if it was built with a clean data/render separation |
| "Any authenticated user = staff" carried forward unexamined | MEDIUM-HIGH (if discovered late, after external/partner access is added) | Centralize existing scattered auth checks into one function, then layer role/claim checks behind it — much cheaper if the centralization happened early per Pitfall 4's prevention advice |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|--------------------|----------------|
| Signals as unstructured blobs | Data model phase | Seed data schema has typed `signal_type`/`detected_at`/`source`/`strength` fields, confirmed before any explorer UI work starts |
| Rigid Company-Persona FK | Data model phase | Schema includes a join/history table with `is_current`, not a single scalar FK, confirmed before seed data is authored |
| Seed data not shaped for future enrichment | Data model phase (with a quick real-API-schema spike) | Enrichment-sourced fields are nullable and array-typed where multi-valued in reality; a `source`/`enriched_at` field exists (even if always `"manual"`/`null`) |
| "Any authenticated user = staff" carried forward | Explorer UI build phase (milestone 1), re-verified at milestone 1→2 transition | Auth check is centralized in one function/middleware with an explicit code comment on the assumption |
| No list virtualization | Explorer UI build phase | List components use a virtualization library regardless of current seed-data size |
| No URL sync for selection/filters | Explorer UI build phase | Pasting a company/persona detail URL into a new tab reproduces the exact view; back button un-selects correctly |

## Sources

- [Custom CRM Data Modeling: Get the Architecture Right](https://www.lowcode.agency/blog/custom-crm-objects-data-modeling) — relationship modeling (contacts-to-multiple-companies) as a core CRM data-model challenge — MEDIUM confidence
- [CRM Data Model Explained: Contacts, Companies, Deals, and Beyond](https://mriacrm.com/crm-data-model-explained-contacts-companies-deals-and-beyond/) — MEDIUM confidence
- [What is the Best Way to Normalize Data Models Across Different CRMs?](https://truto.one/blog/what-is-the-best-way-to-normalize-data-models-across-different-crms) — MEDIUM confidence
- [CDP Event Schema Versioning: How to Evolve Tracking Without Breaking Activation](https://www.pathtoproject.com/blog/20260413-cdp-event-schema-versioning-without-breaking-activation) — schema versioning discipline for downstream consumers — MEDIUM confidence
- [Customer Data Processing for Intent Signals in Outbound Marketing](https://www.datawhistl.com/blog/customer-data-processing-for-capturing-intent-signals-in-outbound-marketing-why-packaged-cdps-struggle-and-warehouse-native-architectures-win/) — typed, scored, dated signal-store pattern keyed to account/contact identifiers — MEDIUM confidence
- [Rendering large lists without virtualization causing slow UI](https://rishandigital.com/reactjs/rendering-large-lists-without-virtualization-causing-slow-ui/) — MEDIUM confidence
- [10 Proven Ways to Optimize Large List Rendering in React](https://www.fegno.com/10-proven-ways-to-optimize-large-list-rendering-in-react/) — MEDIUM confidence
- [Sync React application state with the URL](https://carlogino.com/blog/react-sync-state-with-url) — MEDIUM confidence
- [State Management | React Router](https://reactrouter.com/explanation/state-management) — MEDIUM confidence (official docs pattern for URL-as-state)
- [DEV Community: How to stop living with your seed data sucking](https://dev.to/joeauty/how-to-stop-living-with-your-seed-data-sucking-4lej) — LOW confidence, single source, directionally consistent with general experience
- [Multi-tenant authentication: What you need to know (and how Clerk helps)](https://clerk.com/blog/multi-tenant-authentication-what-you-need-to-know) — MEDIUM confidence, official Clerk source
- [Role based access control with Clerk Organizations](https://clerk.com/blog/role-based-access-control-with-clerk-orgs) — HIGH confidence, official Clerk docs
- [B2B/B2C Roles and Permissions with Clerk Organizations](https://clerk.com/docs/guides/organizations/control-access/roles-and-permissions) — HIGH confidence, official Clerk docs
- `.planning/codebase/CONCERNS.md` (this repo, 2026-07-22 audit) — HIGH confidence, first-party — source for the "any authenticated Clerk user = staff," swallowed-error, and Sanity `useCdn` findings reused here
- Clearbit/Apollo enrichment API field-mapping patterns (Explorium.ai, ZoomInfo pipeline comparisons, Clearbit Help Center Salesforce field-mapping docs) — MEDIUM confidence, general shape of what real enrichment payloads look like (nested/nullable/multi-valued fields, field-mapping groups)

---
*Pitfalls research for: B2B ICP/account-intelligence explorer (ArcLumen 360, milestone 1)*
*Researched: 2026-07-22*
