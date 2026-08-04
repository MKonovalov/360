# Requirements: ArcLumen 360 — v1.5 Additional AI Providers (NousResearch + OpenCode)

**Defined:** 2026-08-03
**Core Value:** Fast, shared ICP lookup — anyone on the team can pull up a company or persona and see a complete, trustworthy 360 view with buying signals in seconds.

## v1 Requirements

Requirements for milestone v1.5. Each maps to a roadmap phase.

### Provider Registry + Servable Model Sources

- [x] **REG-01**: User can select the AI Provider for their model configuration — Anthropic, OpenRouter (existing), **NousResearch** and **OpenCode** (new) — in the Settings AI Model Configuration card; `SERVABLE_PROVIDERS` grows to 4 and `providerName()` becomes a registry-driven map (no new hardcoded branch)
- [x] **REG-02**: `@ai-sdk/openai-compatible@^3.0.20` is installed; `NOUSRESEARCH_API_KEY` + `OPENCODE_API_KEY` declared in `env.ts` (optional, non-`PUBLIC_`, degrade-gracefully mirroring `OPENROUTER_API_KEY`), `.env.example`, and Vercel env
- [x] **REG-03**: OpenCode is ONE logical provider spanning two snapshot providerIDs (`opencode` = Zen, `opencode-go` = Go); servable set = the gated rows (chat-completions 30 + Claude 19 = 49 of 77), with dual-listed ids deduped by a deterministic Zen-wins rule (5 Go-exclusive ids keep their Go rows) locked by a no-flip canary
- [x] **REG-04**: NousResearch servable set = curated `PROVIDER_GATES.nousresearch` allowlist of native `nousresearch/*` ids (Hermes-4 pair today, ~2 rows) — NOT the full 292-row portal roster (OpenRouter mirror, mass collision)
- [x] **REG-05**: `getProviderForModelId` widens to the 4 logical providers with an EXPLICIT precedence order (nousresearch row wins over openrouter for the 2 shared hermes ids; opencode scope includes both `opencode` + `opencode-go` row ids); the anthropic default `claude-sonnet-4-6` keeps resolving to anthropic (priority-order regression lock); collision canary extended + passing
- [x] **REG-06**: `PROVIDER_DEFAULT_MODELS` gains `nousresearch` (Hermes-4 pair member) + `opencode` (pinned concrete id chosen in planning) reset-to-provider-default targets
- [x] **REG-07**: Union-wide save validation + staleness gate cover all 4 providers automatically (membership-based `saveSettingsAction` unchanged structurally); cross-provider chains spanning the new providers save and validate

### Refresh Script + Catalog Data

- [x] **CAT-01**: `scripts/refresh-model-catalog.ts` gains an anonymous `GET https://inference-api.nousresearch.com/v1/models` source (verified HTTP 200, 292 rows) mapping rows to `providerID: 'nousresearch'`, `api.url = https://inference-api.nousresearch.com/v1`, `api.npm = @ai-sdk/openai-compatible`
- [x] **CAT-02**: Nous `pricing.prompt/completion` converted per-token → per-MTok (×1e6) to match the snapshot's cost convention; `supported_parameters` live-joined to the `structuredOutputs` flag (mirroring the OpenRouter join, throws-not-degrades on failure)
- [x] **CAT-03**: Nous `family` derived from the id prefix (`nousresearch/hermes-4-*` → `hermes`); snapshot regenerated and committed with the new `nousresearch` rows + refreshed Go roster (17 → 25 live rows)
- [x] **CAT-04**: OpenCode Zen/Go roster-verify per the D-02 doctrine; the Zen-wins dual-listed-id dedup is expressed once (refresh script or `getServableIdsForProvider`) and survives regeneration

### Run Path / modelFactory Seam

- [x] **RUN-01**: `modelFactory` gains three module-scope `createOpenAICompatible` instances — `nousresearch` (baseURL `https://inference-api.nousresearch.com/v1`, key `NOUSRESEARCH_API_KEY`), `opencode-zen` (`https://opencode.ai/zen/v1`, key `OPENCODE_API_KEY`), `opencode-go` (`https://opencode.ai/zen/go/v1`, same key) — with `apiKey` passed EXPLICITLY (no SDK env auto-load); constraint 11 (modelFactory = only SDK-importing module) holds
- [x] **RUN-02**: `instantiateModel` dispatches OpenCode rows to the zen-vs-go instance by the matched row's `api.url` (Anti-Pattern 1 scoped-row find); the 19 Claude rows instantiate via the already-installed `@ai-sdk/anthropic` with a `createAnthropic({ baseURL: 'https://opencode.ai/zen/v1', apiKey })` override — zero new packages beyond openai-compatible
- [ ] **RUN-03**: Chain-aware env gate names the new keys — a resolved chain containing a nousresearch model requires `NOUSRESEARCH_API_KEY`; an opencode model requires `OPENCODE_API_KEY` (all-or-nothing, `missingProviderKey` names the exact key)
- [ ] **RUN-04**: `shouldAdvance` failover semantics extend to 4 providers — cross-provider 429 advances, same-provider never-advance preserved; OpenCode Zen↔Go is SAME-provider (one key, never advances on 429); 402 billing stays never-eligible
- [ ] **RUN-05**: `model_used`/`model_chain` audit records the served provider accurately for all 4 providers (OpenCode rows recorded by their bare id; provider derivation via the priority-ordered registry)
- [x] **RUN-06**: `supportsStructuredOutputs` starts FALSE on the new instances (safe `json_object` fallback + client-side validation) until a live key-backed probe proves `json_schema` acceptance at Zen/Go/Nous; per-provider flip only after verification

### Settings UI

- [ ] **SET-01**: AI Provider selector renders 4 always-valued entries (Anthropic, OpenRouter, NousResearch, OpenCode) in `SERVABLE_PROVIDERS` order
- [ ] **SET-02**: Selecting a provider refreshes the Primary model picker from that provider's servable source — opencode (49 rows incl. Claude rows), nousresearch (Hermes pair), anthropic (1), openrouter (336)
- [ ] **SET-03**: OpenCode rows render a `· Zen` / `· Go` endpoint caption (new derived `endpoint` field set at trim time from the matched row's providerID + `endpointLabel()` helper) in the same caption slot as suffix labels, in BOTH the provider-scoped primary and union fallback pickers
- [ ] **SET-04**: NousResearch Hermes rows render honest capability captions (chat/reasoning-tuned caveat, mirroring the `:free` fail-loud pattern) with per-MTok cost captions converted from the API's per-token pricing
- [ ] **SET-05**: Provider badges on picker rows + saved chain entries cover all 4 providers and disambiguate same-name models (hermes-4-70b via nousresearch vs openrouter; claude rows via opencode vs anthropic)
- [ ] **SET-06**: Union fallback pickers group by all 4 providers with correct badges; save/staleness verified end-to-end against 4-provider chains

### Verification Gate

- [ ] **VER-01**: Vitest collision matrix widened to 4 providers — same-name ids map to the correct provider (`claude-sonnet-4-6` → anthropic NOT opencode; `nousresearch/hermes-4-70b` → nousresearch NOT openrouter; opencode dual-listed ids resolve once, no endpoint flip), 4-provider 429 hop semantics
- [ ] **VER-02**: End-to-end UAT — save a NousResearch or OpenCode primary → Analyze on a company → `agent_run.model_used` matches the saved id
- [ ] **VER-03**: OpenCode-only chain runs with only `OPENCODE_API_KEY` set (no Anthropic/Nous key); NousResearch chain runs with only `NOUSRESEARCH_API_KEY`
- [ ] **VER-04**: Security-matrix grep extended — `NOUSRESEARCH`/`OPENCODE` absent from client components / Server Action returns / no `NEXT_PUBLIC_*` leakage; `SERVER_COMPONENT` exemption set covers `modelFactory.ts`'s explicit `process.env.*` reads; non-vacuous canary stays green
- [ ] **VER-05**: Live-browser UAT — 4-entry provider selector, Zen/Go endpoint captions, Hermes capability captions, badge disambiguation across 4 providers; live key-backed `json_schema` probe gates the `supportsStructuredOutputs` flip (RUN-06)

## v2 Requirements

Deferred to future releases. Tracked but not in the current roadmap.

- **OpenCode GPT-5 rows** (Responses API, 23 rows) + **Gemini rows** (5) — the non-chat-completions remainder of the opencode roster; deferred by the chat+Claude gate decision
- **Endpoint detail in the saved-chain recap** (`· Zen`/`· Go` on recap entries — caption-only once `endpoint` exists on `ServableModel`)
- **SCOP-01**: Saved/custom filter views and bulk seed-data editing UX (VIEW-01/02 from PROJECT.md Future Candidates)
- **PIPE-01/02**: Full scoring/prioritization algorithm over Company signals + prioritized target list output
- **PIPE-03/04**: CRM sync / outreach triggers (the pipeline's action stage)
- **ACCS-01**: Multi-user roles/permissions beyond "any authenticated Clerk user = staff"
- **ARCP-03**: AI-drafted, persona-tailored outreach content informed by Arcpedia

## Out of Scope

| Feature | Reason |
|---------|--------|
| OpenCode GPT-5 (Responses API) + Gemini rows in the servable set | Research-verified the 4-protocol split; chat+Claude gate (49 rows) is the milestone scope; Responses/Gemini need `@ai-sdk/openai`/`@ai-sdk/google` additions — deferred to v2 |
| Splitting OpenCode into two selector entries ("OpenCode Zen" / "OpenCode Go") | Milestone locks ONE OpenCode provider; both endpoints share `OPENCODE_API_KEY`; the `· Zen`/`· Go` caption gives staff the split without doubling the selector |
| Offering the full 292-row Nous portal roster | Portal is an OpenRouter mirror — nearly every id already exists as an openrouter row → mass union collisions + canary failure + silent provider swaps; curated `nousresearch/*` allowlist instead |
| Per-endpoint OpenCode keys (`OPENCODE_ZEN_API_KEY` + `OPENCODE_GO_API_KEY`) | PROJECT.md locked the 2-key decision; Zen + Go share one credential scope |
| Endpoint columns in `model_used`/`model_chain` audit | Audit contract stays provider-accurate; endpoint is recoverable from the catalog by id when needed |
| Excluding Hermes-4 from the Nous picker ("it's not agentic") | Milestone explicitly targets Hermes-family models; the chat-tuned caveat is informational, not prohibitive (fail-loud caption) |
| Live-fetching Nous/OpenCode rosters at runtime | Committed-snapshot discipline (v1.3 D-18-03); refresh is a dev-machine script act |
| BYOK per provider in Settings | Multi-tenant credential storage is a security program (v1.3/v1.4 anti-feature stays) |
| Auto-writing Analytic Agent proposals to the live Signal table | v1.1 contract — proposals stay in the review queue, staff-approved only |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| REG-01 | 23 | Complete |
| REG-02 | 23 | Complete |
| REG-03 | 23 | Complete |
| REG-04 | 23 | Complete |
| REG-05 | 23 | Complete |
| REG-06 | 23 | Complete |
| REG-07 | 23 | Complete |
| CAT-01 | 24 | Complete |
| CAT-02 | 24 | Complete |
| CAT-03 | 24 | Complete |
| CAT-04 | 24 | Complete |
| RUN-01 | 25 | Complete |
| RUN-02 | 25 | Complete |
| RUN-03 | 25 | Pending |
| RUN-04 | 25 | Pending |
| RUN-05 | 25 | Pending |
| RUN-06 | 25 | Complete |
| SET-01 | 26 | Pending |
| SET-02 | 26 | Pending |
| SET-03 | 26 | Pending |
| SET-04 | 26 | Pending |
| SET-05 | 26 | Pending |
| SET-06 | 26 | Pending |
| VER-01 | 27 | Pending |
| VER-02 | 27 | Pending |
| VER-03 | 27 | Pending |
| VER-04 | 27 | Pending |
| VER-05 | 27 | Pending |

---

# Queued: v1.6 Signals & Offerings Requirements

**Status:** Fully planned, execution not started — queued behind v1.5 (see PROJECT.md "Queued Milestone", ROADMAP.md Phases 28-30, STATE.md Blockers). Kept in this file (rather than a separate document) so requirement numbering and traceability are visible in one place, but these are NOT part of v1.5's active scope above and do not affect its requirement count (28) or coverage.

**Defined:** 2026-08-04 (in `workspace/signals`, reconciled into this branch 2026-08-04)
**Source:** Fully pre-authored external spec — `.planning/specs/v1.4-signals-offerings.md` (filename predates the v1.6 renumbering; content is version-agnostic and still authoritative) — requirements below are a direct decomposition of that spec's data model (Section 2), business rules (Section 3), UI (Section 4), permissions (Section 5), and seed data (Section 7). Research was skipped for this milestone: the domain, entities, and UI behavior were already fully specified before this cycle started.

Replacing the firm's Word-doc service catalogues with structured Practice Area → Domain → Offering data, and letting partners record reusable Company/Persona buying signals linked to offerings. Manual CRUD only; one practice area (GBS) seeded with real data. Each requirement maps to one Phase 28-30.

### Shared data model + seed (Phase 28, no UI)

- [ ] **DATA-01**: All Offerings-feature tables exist per spec Section 2.1 — `practice_area`, `domain`, `offering`, `buyer_role`, `offering_buyer_role` (ranked join), `trigger` — with audit columns (`created_at`/`updated_at`/`created_by`/`updated_by`) and the `status` enums specified (`active`/`draft`/`retired` where noted)
- [ ] **DATA-02**: All Signals-feature tables exist per spec Section 2.2 — `company_signal`, `persona_signal`, and the signal-to-offering link (polymorphic `signal_offering_link`, or two separate join tables if that matches this repo's existing ORM conventions better) — each practice-area-scoped, with free-text/autocomplete `category` (not a fixed enum)
- [ ] **DATA-03**: GBS practice area (`GBS — Design, Build & Run`) + its 3 domains (Design, Build, Run) are seeded per spec Section 7.1
- [ ] **DATA-04**: 5 buyer roles are seeded per spec Section 7.2 (CFO, COO, Head of GBS, Transformation Sponsor, CIO)
- [ ] **DATA-05**: 11 GBS offerings are seeded across the 3 domains per spec Section 7.3, each with `offer_type`, description, commercial-model text (mechanism, never a numeric figure — no pricing field exists), ranked buyer roles, and at least one trigger
- [ ] **DATA-06**: GBS company signals are seeded across all 8 categories per spec Section 7.4 (27 signals)
- [ ] **DATA-07**: GBS persona signals are seeded per spec Section 7.5, each tied to a real `buyer_role` (12 signals)
- [ ] **DATA-08**: The representative signal-to-offering links in spec Section 7.6 are seeded (10 rows)
- [ ] **DATA-09**: Signals/Offerings CRUD reuses the existing staff-auth gate (no new role/approval system); writes record `created_by`/`updated_by` for accountability
- [ ] **DATA-10**: Deleting a `practice_area`, `domain`, `offering`, or `buyer_role` with dependent records is blocked or requires explicit cascade confirmation at the query/service layer — never a silent cascade delete

### Signals UI (Phase 29)

- [ ] **SIG-01**: `Manage > Reviews` gains a "Signals" menu item, matching the existing visual/interaction pattern already used under `Reviews`
- [ ] **SIG-02**: The Signals screen has two tabs — Company Signals and Persona Signals
- [ ] **SIG-03**: Each tab's list is filterable by Practice Area, Category (populated from distinct existing values), Status, and free-text search over name/description
- [ ] **SIG-04**: Company Signals table shows Name, Category, Practice Area, Linked Offerings (count, expandable), Status, Last updated
- [ ] **SIG-05**: Persona Signals table shows the same columns plus Buyer Role
- [ ] **SIG-06**: Staff can create/edit a Company Signal (Name, Practice Area, Category autocomplete, Description, Linked Offerings multi-select filtered to the selected Practice Area's active offerings — empty allowed, Status)
- [ ] **SIG-07**: Staff can create/edit a Persona Signal (same fields as SIG-06 plus a required Buyer Role select, with an inline shortcut into the Buyer Role lookup panel from OFR-06 so a partner isn't blocked if the role doesn't exist yet)
- [ ] **SIG-08**: A signal's row-level "archive" action sets `status = retired` (soft, never a hard delete)
- [ ] **SIG-09**: The Linked Offerings / offering pickers only ever show active offerings scoped to the signal's selected Practice Area — draft offerings are excluded from pickers (still visible/editable in Offerings screens per DATA-01)

### Offerings UI (Phase 30)

- [ ] **OFR-01**: `Manage > Reviews` gains an "Offerings" menu item
- [ ] **OFR-02**: The Offerings screen has two tabs — Service Portfolio and Offering × Trigger × Buyer Matrix
- [ ] **OFR-03**: Service Portfolio tab is a hierarchical Practice Area → Domain → Offering manager with create/edit/reorder/archive at each level
- [ ] **OFR-04**: The Offering edit form includes Name, Practice Area, Domain (optional, filtered to the chosen Practice Area's domains), Offer Type, Description, Commercial Model Text, ranked Buyer Roles (multi-select), Status
- [ ] **OFR-05**: The Offering × Trigger × Buyer Matrix tab is a table filterable by Practice Area (defaults to GBS), rows grouped by Domain (Design/Build/Run section headers), with editable Trigger(s) (add/remove) and ranked Primary Buyer(s) columns
- [ ] **OFR-06**: A "Manage Buyer Roles" action opens a lookup CRUD panel (name + description; create/edit/archive) — the single place buyer roles are managed, shared by both Offerings and Signals
- [ ] **OFR-07**: An Offering's detail view shows a read-only reverse-lookup list of Company/Persona Signals currently linked to it (via the signal-offering link from DATA-02)
- [ ] **OFR-08**: Attempting to delete a Practice Area, Domain, Offering, or Buyer Role with dependents surfaces a block/confirmation in the UI (consumes the DATA-10 guard)

### v1.6 Future Requirements (deferred)

- **HYP-01**: Hypotheses feature — consumes Signals + Offerings, out of scope for v1.6 (spec Section 1)
- **SIG-CAT-01**: Promote signal `category` from free text to a proper lookup table, once a second practice area is seeded and categories are observed to converge (spec Section 8)
- **SIG-CO-01**: Dual-persona co-occurrence scoring on `persona_signal` (spec Section 8) — belongs to the Hypotheses milestone
- **OFR-PRICE-01**: Numeric pricing fields on `offering`, if/when the firm confirms figures are ready across catalogues beyond Technology's existing day-rate band (spec Section 8)
- **OFR-SEED-01**: Seed the remaining 5 practice areas — blocked on resolving the GBS/Technology offering-name boundary (spec Section 8) before Technology can be seeded without a collision

### v1.6 Out of Scope

| Feature | Reason |
|---------|--------|
| Hypotheses feature | Consumes Signals + Offerings but is a separate later milestone (spec Section 1) |
| Outreach/LTS integration | Not part of this spec (spec Section 1) |
| Automated signal detection (LinkedIn/news scraping) | v1.6 Signals is manual CRUD only — a partner records what they've observed (spec Section 1) |
| Numeric pricing on offerings | 5 of 6 catalogues explicitly defer pricing; `commercial_model_text` only (spec Section 8) |
| Review/approval workflow for Signals/Offerings edits | Internal 3-partner tool; audit columns only, no gating (spec Section 5) |
| Seeding practice areas beyond GBS | GBS/Technology naming-boundary conflict unresolved (spec Section 8) |

### v1.6 Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-01 | 28 | Pending (queued) |
| DATA-02 | 28 | Pending (queued) |
| DATA-03 | 28 | Pending (queued) |
| DATA-04 | 28 | Pending (queued) |
| DATA-05 | 28 | Pending (queued) |
| DATA-06 | 28 | Pending (queued) |
| DATA-07 | 28 | Pending (queued) |
| DATA-08 | 28 | Pending (queued) |
| DATA-09 | 28 | Pending (queued) |
| DATA-10 | 28 | Pending (queued) |
| SIG-01 | 29 | Pending (queued) |
| SIG-02 | 29 | Pending (queued) |
| SIG-03 | 29 | Pending (queued) |
| SIG-04 | 29 | Pending (queued) |
| SIG-05 | 29 | Pending (queued) |
| SIG-06 | 29 | Pending (queued) |
| SIG-07 | 29 | Pending (queued) |
| SIG-08 | 29 | Pending (queued) |
| SIG-09 | 29 | Pending (queued) |
| OFR-01 | 30 | Pending (queued) |
| OFR-02 | 30 | Pending (queued) |
| OFR-03 | 30 | Pending (queued) |
| OFR-04 | 30 | Pending (queued) |
| OFR-05 | 30 | Pending (queued) |
| OFR-06 | 30 | Pending (queued) |
| OFR-07 | 30 | Pending (queued) |
| OFR-08 | 30 | Pending (queued) |
