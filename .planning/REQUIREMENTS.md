# Requirements: ArcLumen 360 — v1.3 AI Model Settings

**Defined:** 2026-08-02
**Core Value:** Fast, shared ICP lookup — anyone on the team can pull up a company or persona and see a complete, trustworthy 360 view with buying signals in seconds.

## v1 Requirements

Requirements for v1.3 "AI Model Settings" — per-user AI model management (primary + fallback chain) consumed by the Analytic Agent with error-driven failover. Each maps to roadmap phases.

### Settings surface

- [ ] **SET-01**: Staff can open a Settings page from a new "Settings" menu item in the shared ExplorerMenu and the sidebar nav
- [ ] **SET-02**: The Settings page shows the staff member's current AI model configuration — primary model + ordered fallback list
- [ ] **SET-03**: Staff can set their primary AI model from the list of runnable (Anthropic-allowlisted) models
- [ ] **SET-04**: Staff can add at least one fallback model (ordered) to their chain — a configurable list, primary + up to 2 fallbacks selectable, empty fallback list allowed (primary-only runs)
- [ ] **SET-05**: Staff can remove or reorder their fallback models (ordered chain semantics)
- [ ] **SET-06**: Saving the settings persists immediately (Server Action) and the form reflects the saved state after reload
- [ ] **SET-07**: The model pickers show only models the app can actually run (Anthropic allowlist ∩ snapshot) — the opencode catalog is a menu, not a guarantee

### Model registry + persistence

- [x] **REG-01**: A `userModelSettings` Drizzle table persists per-user model preferences, keyed by Clerk `userId` (unique per user)
- [x] **REG-02**: `userModelSettings` stores the raw provider model IDs (e.g. `claude-sonnet-4-6`, never `anthropic/...`), primary as text and fallbacks as `text[]` (ordered)
- [x] **REG-03**: A query module (`src/lib/db/queries/userModelSettings.ts`) exposes get + atomic upsert for a user's settings
- [x] **REG-04**: `agent_run` gains audit columns recording which model actually served (`model_used`) and the resolved chain (`model_chain`), so the "which model ran" truth is durable and traceable in Langfuse
- [x] **REG-05**: When a user has no saved settings, the app resolves a documented default (existing `claude-sonnet-4-6` behavior preserved)

### Model catalog from opencode

- [ ] **CAT-01**: A dev-time script fetches the model list from the local opencode CLI (`opencode models`) and writes a committed JSON snapshot (`src/data/opencode-models.json`)
- [ ] **CAT-02**: The snapshot is the production source of the available-models list — no runtime dependency on a local opencode installation (Vercel serverless has none)
- [ ] **CAT-03**: A pure function filters the snapshot to the servable (Anthropic) models and maps opencode model IDs to raw provider IDs for the pickers and the registry
- [ ] **CAT-04**: The catalog ships with the app build (committed file), and the Settings UI reads from it server-side

### Error-driven failover

- [ ] **FAL-01**: The Analytic Agent resolves the user's model chain from `userModelSettings` at run start (snapshot-at-entry — edits mid-run don't change the active run)
- [ ] **FAL-02**: A pure `classifyModelError` function classifies AI-SDK errors — unwraps `RetryError` first, then distinguishes provider/model errors (retryable connection errors, `NoSuchModelError`, 404 model-not-found, APICallError `isRetryable`) from non-failover errors (validation, output/schema, auth 401/403)
- [ ] **FAL-03**: On a failover-eligible error, the run retries the same request with the next model in the chain; the chain is exhausted or non-failover errors fail loud (no silent model switch)
- [ ] **FAL-04**: The failover loop respects the 60s Vercel ceiling — per-attempt timeouts (primary ~35s, fallback ~20s) bound the total run
- [ ] **FAL-05**: The model that actually served is recorded on the run (`model_used` + Langfuse) and surfaced so staff know when a fallback ran

### Verification gate

- [ ] **VER-01**: Vitest covers the failover matrix — 401/403 and output/schema errors do NOT advance the chain, retryable connection/model-not-found errors DO, and the chain exhausts to the last model
- [ ] **VER-02**: Vitest locks the catalog filter (allowlist ∩ snapshot → servable provider IDs) and the model-chain resolution (default, partial, full chains)
- [ ] **VER-03**: Live-browser UAT proves the end-to-end flow: Settings → pick primary + fallback → save → run Analyze → `model_used` reflects the chosen model (and a fallback when the primary is forced to fail)
- [ ] **VER-04**: The deployed (Vercel preview) app loads the model list without any local opencode — committed snapshot fallback works

## Future Requirements (deferred)

- **MRG-01**: Per-agent model assignment (different models for different agent types) — the registry is the seam, v1.3 ships a single registry consumed by the Analytic Agent
- **MRG-02**: Provider expansion beyond Anthropic (OpenAI, etc.) — the catalog snapshot already carries provider metadata; servable filtering extends
- **MRG-03**: Per-model advanced settings (temperature, max tokens)
- **MRG-04**: Team-wide default model configuration (org-level settings overriding individual defaults)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-provider model running | The app only has an Anthropic provider factory installed; catalog filtering is Anthropic-only this milestone |
| Model performance/benchmark data in the picker | No evaluation infrastructure exists; the catalog is a menu of available models |
| Auto-scoring/prioritization of Companies | Pipeline action stage (PIPE-01/02) — separate future milestone |
| CRM sync / outreach triggers | Pipeline action stage (PIPE-03/04) — separate future milestone |
| Roles/permissions beyond the binary staff model | ACCS-01 — separate future milestone |
| AI-drafted outreach content (Arcpedia-informed DMs) | ARCP-03 — separate future milestone |

## Traceability

Which phases cover which requirements. Updated 2026-08-02 during v1.3 roadmap creation — all 25 requirements mapped, 100% coverage.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SET-01 | Phase 17 | Pending |
| SET-02 | Phase 17 | Pending |
| SET-03 | Phase 17 | Pending |
| SET-04 | Phase 17 | Pending |
| SET-05 | Phase 17 | Pending |
| SET-06 | Phase 17 | Pending |
| SET-07 | Phase 17 | Pending |
| REG-01 | Phase 15 | Complete |
| REG-02 | Phase 15 | Complete |
| REG-03 | Phase 15 | Complete |
| REG-04 | Phase 15 | Complete |
| REG-05 | Phase 15 | Complete |
| CAT-01 | Phase 15 | Pending |
| CAT-02 | Phase 15 | Pending |
| CAT-03 | Phase 15 | Pending |
| CAT-04 | Phase 15 | Pending |
| FAL-01 | Phase 16 | Pending |
| FAL-02 | Phase 16 | Pending |
| FAL-03 | Phase 16 | Pending |
| FAL-04 | Phase 16 | Pending |
| FAL-05 | Phase 16 | Pending |
| VER-01 | Phase 18 | Pending |
| VER-02 | Phase 18 | Pending |
| VER-03 | Phase 18 | Pending |
| VER-04 | Phase 18 | Pending |
