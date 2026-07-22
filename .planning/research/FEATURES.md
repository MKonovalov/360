# Feature Research

**Domain:** B2B ICP / account-intelligence explorer (demand-gen tooling — Companies + Key Personas, buying/intent signals, GBS/SSC transformation advisory niche)
**Researched:** 2026-07-22
**Confidence:** MEDIUM-HIGH (feature landscape corroborated across multiple category leaders; GBS-specific signal framing is project-supplied domain knowledge, not independently verified against a live competitor in that niche)

## Feature Landscape

Category products reviewed: Apollo.io, ZoomInfo, 6sense, Clay, Common Room, ChartHop (org-chart/people-data angle). These fall into two overlapping categories that matter for this project:

1. **Sales intelligence databases** (Apollo, ZoomInfo) — company + contact records, technographics, intent signals, at-scale prospecting.
2. **ABM/intent platforms** (6sense, Common Room) — signal capture, scoring, buying-stage classification, CRM/outreach orchestration.
3. **Enrichment orchestration** (Clay) — waterfall enrichment across providers, signal detection (job changes, leadership changes, funding).
4. **People/org data** (ChartHop) — career history timelines, org charts, employee profile depth.

ArcLumen 360 milestone 1 sits at the *browsing/viewing* layer these products all have — the record UI, the list/filter/search, the master-detail pattern — while deliberately deferring the *data pipeline* layer (enrichment APIs, scoring/prediction, CRM sync) that differentiates these tools commercially. This is a common phased approach: nearly every one of these products started as "a good place to look at company/contact records" before layering in signals, scoring, and automation.

## Table Stakes (Users Expect These)

Features users assume exist in *any* account-intelligence browsing tool. Missing these makes the explorer feel broken or unusable, independent of how good the underlying data is.

### Company records

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Firmographics (industry, size/employee count, HQ location, revenue band, ownership type) | Baseline identity data every company-intelligence tool leads with (Apollo, ZoomInfo) | LOW | Seed-data fields; no API needed for v1 |
| Tech stack / tools used | Standard "technographics" section in Apollo/ZoomInfo/Clay; for this domain, doubles as a GBS-maturity signal (e.g., presence/absence of ERP, RPA, ticketing tools) | LOW–MEDIUM | v1 = manually curated list per company, not live technographic scraping |
| Buying/intent signal display | Core differentiator of 6sense/Common Room/ZoomInfo Intent — but in v1 this is *display only* (badges/flags), not live-computed intent scoring | LOW | The 4 named signals (cost pressure, no mature GBS/SSC org, new CFO/GBS head, transformation program announcement) are seed/manual fields, not derived |
| Linked contacts/personas on the company record | Every tool shows "people at this company" from the company page (Apollo, ZoomInfo org-chart panel) | LOW–MEDIUM | Requires a company↔persona relationship in the data model |
| Last-updated / data freshness indicator | Table stakes once data is manually curated — team needs to trust whether a record is stale | LOW | Simple timestamp field, no automation required |
| Source/notes field per signal | Users need to know *why* a signal was flagged (which inbox/conversation/announcement) since v1 has no enrichment API to justify it automatically | LOW | Free-text or short structured note per signal |

### Persona records

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Role/title + seniority | Baseline of every contact record (Apollo, ZoomInfo); seniority also drives "is this person a decision-maker" judgment call ZoomInfo's org-chart explicitly supports | LOW | |
| Career history / previous companies | ChartHop and LinkedIn-style profile patterns make this a default expectation once you show "role," not an add-on | LOW–MEDIUM | Simple list of prior roles/companies with dates; no live LinkedIn sync in v1 |
| Linked company | Reciprocal of the company→personas link; personas without a clear company anchor feel orphaned | LOW | Same relationship as above, inverse direction |
| Contact info display (even if not "live"/verified) | Every contact-intelligence tool shows some reachable info; omitting entirely makes the record feel incomplete even in a browsing-only tool | LOW | Manual entry acceptable for v1 (email/LinkedIn URL); no verification pipeline needed |

### List/browse UX

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Search across list (name, company, title) | Baseline expectation in every list-heavy B2B tool (Apollo search bar, ZoomInfo search) and explicitly named in PROJECT.md | LOW | Client-side or simple query filter is fine at seed-data scale |
| Filter by key attributes (industry, signal type, seniority, etc.) | Apollo/ZoomInfo/6sense all lead with filter-first UX since raw browsing doesn't scale past ~50 records | LOW–MEDIUM | Even at seed-data volume, filters validate the data model's field choices early |
| Master-detail pane (list stays visible, detail fills main area) | Explicitly the recall.ai dashboard pattern referenced in PROJECT.md; also how ZoomInfo/Apollo/ChartHop present record drill-down without full page navigation | MEDIUM | Central to milestone-1 UX; needs careful state management (selected item, scroll position) |
| Status/signal badges in list rows | Every intent/ABM tool (6sense buying-stage badges, ZoomInfo intent flags) surfaces signal strength as a scannable badge, not just inside the detail view — otherwise users must open every record to triage | LOW | Directly named in PROJECT.md requirements |
| Collapsible/resizable left nav with clear sections | Named UX reference (recall.ai explorer); standard in data-dense dashboards (ChartHop, ZoomInfo) so power users can maximize list/detail space | LOW–MEDIUM | Two sections only for v1 (Companies, Personas) |
| Empty/loading/error states for lists and detail panes | Not domain-specific, but any list-and-detail UI without these feels broken the first time a filter returns zero results | LOW | Often skipped in v1 builds and causes visible bugs |

## Differentiators (Competitive Advantage)

Not required for v1, but where this tool can eventually set itself apart from generic sales-intelligence products — should inform data-model choices now even if not built yet.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| GBS/SSC-specific signal taxonomy (cost pressure, GBS maturity, CFO/GBS-head change, transformation announcement) | Generic tools (Apollo/ZoomInfo/6sense) offer generic firmographic/intent filters; a taxonomy purpose-built for GBS/SSC transformation advisory is the actual "360 view" differentiator named in PROJECT.md's Core Value | LOW (v1: manual fields) → HIGH (v2+: automated detection) | v1 should model these as first-class structured fields, not a generic "notes" blob, so v2 scoring can consume them later |
| Shared team visibility of tribal knowledge | Explicit problem statement: "signal knowledge lives scattered across individual heads and inboxes" — the tool's value is centralizing this, not novel data | LOW (it's the whole point of v1) | This is arguably the actual differentiator of milestone 1 — not a feature to add later |
| Unified Company + Persona 360 view (vs. siloed contact DB / separate org tool) | ChartHop does org/people well but has no company-external-signal angle; Apollo/ZoomInfo do company+contact but no career-history depth or transformation-specific signals; combining both in one pane is a genuine differentiator | MEDIUM | v1 delivers the browsing shell; the "unification" differentiator matures as linked data deepens |
| Saved/custom views per user or team | 6sense/Apollo let users save segment definitions; would let leadership/execs bookmark "companies with 2+ active signals" without re-filtering each visit | MEDIUM | Good v1.x candidate — not core-loop critical but low-medium cost once filters exist |

## Anti-Features (Deliberately Not Building — Matches Project's Explicit v1 Exclusions)

Features that are core to the commercial competitors above, but that PROJECT.md explicitly places out of scope for milestone 1. Documented here to prevent scope creep during roadmap/requirements definition — these are the exact features that make Apollo/ZoomInfo/6sense/Clay commercial products, and skipping them is what makes milestone 1 achievable as a UI-shell validation step.

| Feature | Why It's Tempting | Why Deferred | What v1 Does Instead |
|---------|--------------------|---------------|------------------------|
| Live enrichment API integration (Clearbit, Apollo API, ZoomInfo API, Clay waterfall) | Every competitor's core value prop is fresh, auto-updated data; feels incomplete without it | Adds vendor selection, API cost/rate limits, data-mapping complexity, and ongoing sync/maintenance burden before the explorer UX and data model are even validated | Manual/seed dataset; "last updated" field signals staleness honestly instead of faking freshness |
| Scoring / prioritization algorithm (6sense buying-stage classification, ZoomInfo intent scoring) | Turns raw signals into an actionable ranked list — the natural "next step" once signals exist | Scoring logic requires validated signal definitions and weighting decisions that shouldn't be locked in before the team has used the browsing tool and confirmed what signals actually predict good ICP fit | Signal badges are shown as flags/facts (present/absent, with source note), not computed scores or rankings |
| CRM sync / automated outreach triggers (Common Room's Salesforce/HubSpot push, sequence automation) | Natural endpoint of any ICP tool — get the list into the hands of sales | Presupposes the prioritized-list stage (which itself depends on scoring) and a settled CRM target; building this before the explorer is validated risks syncing bad/unvalidated data downstream | Milestone 1 stops at browsing; export/sync is explicitly a later milestone per PROJECT.md pipeline vision |
| Automated technographic/firmographic scraping | Removes manual data-entry burden | Same dependency-chain problem as enrichment APIs — adds infra and vendor decisions before UI/data-model validated | Tech stack and firmographics are manually curated seed fields |
| Multi-user roles/permissions (admin/rep/exec tiers) | Feels "enterprise-ready" and matches how ZoomInfo/6sense license by seat/role | Existing app's auth model has no roles today; building an authorization layer is orthogonal to validating the explorer UX, and premature role design risks guessing wrong before real usage patterns emerge | Any authenticated staff user sees everything (matches existing Clerk setup) |
| Career-history/organization auto-sync (LinkedIn-style live profile pull, akin to ChartHop's HRIS integrations) | Would keep persona career history fresh automatically | No such live people-data source is in scope for v1; adds a data-sourcing/compliance question (LinkedIn scraping policies) that's unrelated to shell validation | Career history entered/maintained manually as seed data |

## Feature Dependencies

```
Company record (firmographics + tech stack + signals)
    └──requires──> Data model: Company entity with structured signal fields
                       └──requires──> GBS/SSC signal taxonomy decided (differentiator, but must be decided in v1 schema)

Persona record (role/history)
    └──requires──> Data model: Persona entity
                       └──requires──> Company↔Persona relationship (linked contacts / linked company)

Master-detail pane
    └──requires──> List/browse UX (search + filter)
                       └──requires──> Seed dataset loaded (companies + personas)

Status/signal badges in list rows
    └──requires──> Signal fields modeled on Company entity (see above)

Saved/custom views (v1.x differentiator)
    └──requires──> Filter UX (table stakes, v1)
                       └──requires──> Some persisted-view mechanism (not needed for v1 browsing)

Scoring/prioritization (v2, anti-feature for v1)
    └──requires──> Signal taxonomy validated in production use (v1 output)
    └──requires──> Historical signal data across enough records to weight meaningfully

CRM sync / outreach automation (v2, anti-feature for v1)
    └──requires──> Scoring/prioritization (v2)
    └──requires──> Explorer UX validated with real team usage (v1 goal)
```

### Dependency Notes

- **Company/Persona records require the linking relationship to be modeled from day one:** even though scoring and enrichment are deferred, the Company↔Persona relationship (linked contacts, linked company) is core to the "360 view" value prop and must exist in the v1 data model — it's not something that can be bolted on later without a schema migration.
- **Signal taxonomy is a v1 schema decision even though signal computation is v2:** the four named buying signals should be first-class structured fields (not a free-text blob) so that v2 scoring can consume them directly — retrofitting structure onto unstructured notes later is expensive.
- **Scoring depends on signal data existing in production, not just in the schema:** this is why scoring is correctly deferred — you need real team usage of the manual-signal browsing tool before you can meaningfully validate any weighting/prioritization logic.
- **CRM sync depends on scoring existing:** pushing an unranked, unvalidated list into a CRM has limited value; the natural v2→v3 order is scoring before sync, matching PROJECT.md's stated pipeline vision (prioritized list → outreach → CRM sync).
- **Saved views enhance filters but aren't required by them:** filters work standalone; saved views are a pure UX convenience layer that can be added post-v1 without schema changes, assuming filters are built on structured fields rather than ad hoc query strings.

## MVP Definition

### Launch With (v1 — matches PROJECT.md Active requirements)

- [ ] Company list: search + filter, master-detail pane — core browsing loop, explicitly required
- [ ] Company detail: firmographics, tech stack, 4 named buying signals (with source/note + last-updated), linked personas — the "360 view" Core Value
- [ ] Persona list: search + filter, master-detail pane — mirrors company loop for consistency
- [ ] Persona detail: role/title/seniority, career history, linked company — completes the reciprocal 360 view
- [ ] Status/signal badges visible in list rows (not just detail) — required for scan-and-triage use case named in requirements
- [ ] Collapsible left nav (Companies / Key Personas) — explicit recall.ai-style UX requirement
- [ ] Seed/manual dataset loaded and browsable end-to-end behind existing Clerk auth — the milestone-1 definition of done

### Add After Validation (v1.x)

- [ ] Saved/custom filter views — once real usage shows which filter combinations the team repeats
- [ ] Richer signal source linking (e.g., link to the inbox thread/announcement that triggered a signal flag) — valuable once the team is actively using signals to triage, not before
- [ ] Bulk data-entry/editing UX for maintaining seed data at scale — becomes a real need once the dataset outgrows a handful of manually-added records

### Future Consideration (v2+)

- [ ] Live enrichment API integration — defer until the Company/Persona schema and signal taxonomy are validated by real usage; premature integration risks locking in the wrong data model
- [ ] Scoring/prioritization algorithm — defer until enough real signal data exists to weight meaningfully; scoring built on a handful of seed records would be guesswork
- [ ] CRM sync / outreach automation — defer until a prioritized list exists (depends on scoring) and a target CRM is confirmed
- [ ] Multi-user roles/permissions — defer until team composition/usage patterns reveal an actual need to restrict visibility (not evident today per PROJECT.md's "everyone sees everything" note)

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Company list search/filter/master-detail | HIGH | MEDIUM | P1 |
| Company detail (firmographics/tech/signals/linked personas) | HIGH | MEDIUM | P1 |
| Persona list search/filter/master-detail | HIGH | MEDIUM | P1 |
| Persona detail (role/history/linked company) | HIGH | LOW–MEDIUM | P1 |
| Signal badges in list rows | HIGH | LOW | P1 |
| Collapsible left nav | MEDIUM | LOW | P1 |
| Signal source/note field | MEDIUM | LOW | P1 |
| Saved/custom views | MEDIUM | MEDIUM | P2 |
| Bulk seed-data editing UX | LOW–MEDIUM | MEDIUM | P2 |
| Live enrichment API integration | HIGH (long-term) | HIGH | P3 |
| Scoring/prioritization | HIGH (long-term) | HIGH | P3 |
| CRM sync/outreach automation | HIGH (long-term) | HIGH | P3 |
| Multi-user roles/permissions | LOW (today) | MEDIUM | P3 |

**Priority key:**
- P1: Must have for milestone-1 launch
- P2: Should have, add once core loop is validated
- P3: Nice to have, explicitly out of scope per PROJECT.md, future milestone

## Competitor Feature Analysis

| Feature | Apollo/ZoomInfo | 6sense/Common Room | Clay | ChartHop | ArcLumen 360 v1 Approach |
|---------|------------------|---------------------|------|----------|----------------------------|
| Company record | Firmographic + technographic filters at scale (millions of records) | Signal-driven account classification (buying stage) | Enrichment table, waterfall across providers | N/A (people-focused) | Seed-data record with structured GBS-specific signal fields; no live enrichment |
| Contact/persona record | Verified contact + org-chart decision-maker flags | Person-level intent (who's researching) | Contact enrichment via waterfall | Deep career history, animated org timeline | Manual role/seniority/career-history fields; company link, no live sync |
| Signals/intent | Bombora-based buying intent, topic tracking | Proprietary Signalverse, 1T+ signals/day, AI buying-stage classification | Job-change/leadership-change/funding signal detection | N/A | 4 named domain-specific signals as manual structured flags with source note — no automated detection |
| List/browse UX | Filter-first search across huge DB | Prioritized account lists ranked by score | Spreadsheet-style enrichment tables | Filterable directory + interactive/animated org chart | Master-detail list/browse (recall.ai pattern), search + filter, status badges — no ranking |
| Scoring | Basic lead scoring add-ons | Core product (predictive buying-stage model) | N/A | N/A | Explicitly deferred to v2 |
| CRM/outreach | Native sequences, CRM enrichment | CRM sync + orchestrated campaigns | Syncs into outbound tools | HRIS sync (Workday/BambooHR) | Explicitly deferred to v2/v3 |

## Sources

- [What Is Firmographic Data and Why Does It Matter? | Apollo](https://www.apollo.io/insights/what-is-firmographic-data-and-why-does-it-matter-for-outbound-prospecting) — MEDIUM confidence (vendor content, cross-checked against multiple reviews)
- [How Do I Build an Ideal Customer Profile With Sales Intelligence? | Apollo](https://www.apollo.io/insights/how-do-i-build-an-ideal-customer-profile-using-data-from-a-sales-intelligence-platform)
- [ZoomInfo Data Overview](https://www.zoominfo.com/data) — MEDIUM confidence
- [ZoomInfo Intent Data](https://www.zoominfo.com/features/intent-data)
- [Buyer Intent Signals: The Complete 2026 Guide | ZoomInfo](https://pipeline.zoominfo.com/sales/intent-data-signals-that-matter)
- [What Is 6sense? | bookyourdata](https://www.bookyourdata.com/blog/what-is-6sense) — MEDIUM confidence (aggregator content)
- [B2B Buying Signals & Intent Data | 6sense Signalverse](https://6sense.com/signalverse/)
- [How 6sense Turns Buying Signals into Account Priorities](https://6sense.com/guides/account-prioritization/)
- [Clay Waterfall: maximize your coverage of contact info](https://www.clay.com/waterfall-enrichment) — MEDIUM confidence
- [Enriching Company Data | Clay University](https://university.clay.com/lessons/enriching-company-data)
- [Common Room — Signals product page](https://www.commonroom.io/product/signals/) — MEDIUM confidence
- [Capture every signal, everywhere | Common Room blog](https://www.commonroom.io/blog/capture-every-signal-everywhere/)
- [What is Org Chart Software? | ChartHop](https://www.charthop.com/resource/what-is-org-chart-software) — MEDIUM confidence
- [5 Features to Consider When Buying Org Chart Software | ChartHop](https://www.charthop.com/resources/considerations-when-buying-org-chart-software)
- [Org Chart | ChartHop documentation](https://docs.charthop.com/org-chart)
- [Transforming finance with Global Business Services | EY](https://www.ey.com/en_us/services/consulting/finance-consulting-services/transforming-finance-with-global-business-services) — MEDIUM confidence, supports GBS/CFO signal framing
- [10 Shared Services Trends Shaping the GBS Industry in 2025 | Auxis](https://www.auxis.com/10-shared-services-trends-shaping-the-gbs-industry-in-2025/)
- `.planning/PROJECT.md` — primary source for project-specific scope, requirements, and explicit v1 exclusions

---
*Feature research for: B2B ICP/account-intelligence explorer (ArcLumen 360, milestone 1)*
*Researched: 2026-07-22*
