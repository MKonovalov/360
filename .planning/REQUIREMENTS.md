# Requirements: ArcLumen 360 — v1.4 Multi-Provider AI Model Configuration

**Defined:** 2026-08-02
**Core Value:** Fast, shared ICP lookup — anyone on the team can pull up a company or persona and see a complete, trustworthy 360 view with buying signals in seconds.

## v1 Requirements

Requirements for milestone v1.4. Each maps to a roadmap phase.

### Provider Registry + Servable Model Source

- [x] **REG-01**: User can select the AI Provider for their model configuration — Anthropic (existing) or OpenRouter (new) — in the Settings AI Model Configuration card
- [ ] **REG-02**: `@openrouter/ai-sdk-provider@^3.0.0` is installed; `OPENROUTER_API_KEY` declared in `env.ts` (optional, non-`PUBLIC_`, mirroring the D-15 `ANTHROPIC_API_KEY` degrade-gracefully pattern), `.env.example`, and Vercel env
- [x] **REG-03**: OpenRouter servable set = all active `providerID === 'openrouter'` rows in the committed catalog snapshot (~336 models), with `~latest` aliases and `:free` variants included but labeled per SET-07
- [x] **REG-04**: Anthropic servable set unchanged — `ANTHROPIC_ALLOWLIST` sonnet-only gate still applies
- [x] **REG-05**: Provider identity derived from the catalog by model id (servable-scoped lookup + collision canary) — NO `user_model_settings` schema change, no provider column
- [ ] **REG-06**: Provider-aware model instantiation — `modelFactory` routes each chain id to `anthropic(id)` or `openrouter(id)` by catalog `providerID`; raw ids passed verbatim (never `~`-stripped, never prefix-collapsed)
- [x] **REG-07**: `saveSettingsAction` validates each submitted id against its own provider's servable set (union-wide) before the atomic upsert

### Cross-Provider Run Path

- [ ] **FAL-01**: Cross-provider fallback chains run end-to-end — a fallback may come from a different provider than the primary
- [ ] **FAL-02**: `classifyModelError` gains a `billing` class for 402 (never failover-eligible, distinct structured reason "provider credits exhausted"); 502/503 documented as OpenRouter model-availability signals (server_error, advance)
- [ ] **FAL-03**: Hop-aware 429 policy — `rate_limited` advances the chain ONLY when the next model is on a different provider/key; same-provider 429 keeps v1.3's never-advance behavior; locked by a 4-cell Vitest matrix
- [ ] **FAL-04**: Chain-aware env gate at run entry — a resolved chain spanning providers requires both providers' keys; an unset key for a provider present in the chain returns `not_configured` (per FAL-01 snapshot-at-entry)
- [ ] **FAL-05**: `agent_run.model_used`/`model_chain` audit records the actual provider id served (OpenRouter slugs recorded as-saved, `~latest` aliases included verbatim)

### Settings UI

- [ ] **SET-01**: AI Provider selector renders above the Primary model picker — always-valued, Anthropic + OpenRouter options
- [ ] **SET-02**: Selecting a provider refreshes the Primary model picker from that provider's servable source
- [ ] **SET-03**: Provider switch follows keep-if-valid → reset-to-provider-default (OpenRouter default = pinned concrete slug chosen in planning); draft-only (D-07), fallbacks preserved, non-blocking hint shown
- [ ] **SET-04**: Fallback pickers show the union of all providers' servable models, grouped by provider + family
- [ ] **SET-05**: Provider badges on picker rows and saved chain entries (disambiguates same-name models like `claude-sonnet-5` vs `anthropic/claude-sonnet-5`)
- [ ] **SET-06**: Command-pattern type-to-filter search + provider/family grouping in the OpenRouter picker (336 rows usable)
- [ ] **SET-07**: `~latest` aliases labeled "always the latest" (drift caveat); `:free` variants labeled rate-limited free tier (shared 50 req/day quota, fail-loud on cap)
- [ ] **SET-08**: Staleness gate covers the union-wide servable set; catalog freshness caption retained; cost captions incl. high-cost model warnings (e.g. $150/M)

### Verification Gate

- [ ] **VER-01**: Vitest collision matrix (same-name ids map to correct provider: `claude-sonnet-5` → anthropic, `anthropic/claude-sonnet-5` → openrouter), 4-cell 429 hop table, and error matrix (402 never advances w/ billing reason; 502/503 advance; platform vs upstream 429)
- [ ] **VER-02**: End-to-end UAT — save an OpenRouter primary → Analyze on a company → `agent_run.model_used` matches the saved OpenRouter slug
- [ ] **VER-03**: OpenRouter-only chain runs successfully with only `OPENROUTER_API_KEY` set (no Anthropic key)
- [ ] **VER-04**: Security-matrix grep — `OPENROUTER` absent from client components / Server Action returns / no `NEXT_PUBLIC_*` leakage
- [ ] **VER-05**: Live-browser UAT — provider-switch draft preservation, picker search/grouping, badge disambiguation, no `~`/`:free` id ever savable-or-served outside their labels

## v2 Requirements

Deferred to future releases. Tracked but not in the current roadmap.

- **SCOP-01**: Saved/custom filter views and bulk seed-data editing UX (VIEW-01/02 from PROJECT.md Future Candidates)
- **PIPE-01/02**: Full scoring/prioritization algorithm over Company signals + prioritized target list output
- **PIPE-03/04**: CRM sync / outreach triggers (the pipeline's action stage)
- **ACCS-01**: Multi-user roles/permissions beyond "any authenticated Clerk user = staff"
- **ARCP-03**: AI-drafted, persona-tailored outreach content informed by Arcpedia

## Out of Scope

| Feature | Reason |
|---------|--------|
| More than two AI providers (beyond Anthropic + OpenRouter) | The provider registry is data-driven and extensible, but onboarding a third provider is future work |
| Auto-writing Analytic Agent proposals to the live Signal table | v1.1 contract — proposals stay in the review queue, staff-approved only |
| Runtime opencode dependency for the model list | v1.3 D-18-03 — committed catalog snapshot is the only runtime source |
| Edge/runtime migration of the agent to OpenRouter-hosted Anthropic models as a substitute for the direct Anthropic path | Direct Anthropic + OpenRouter are distinct servable sources with distinct keys/costs; no silent provider substitution |
| Persisting a provider column on `user_model_settings` | 3-of-4 research consensus: derive from catalog (disjoint id spaces); a column adds a third staleness axis + migration for no runtime benefit (PITFALLS 8 dissent noted) |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| REG-01 | Phase 19 | Complete |
| REG-02 | Phase 19 | Pending |
| REG-03 | Phase 19 | Complete |
| REG-04 | Phase 19 | Complete |
| REG-05 | Phase 19 | Complete |
| REG-06 | Phase 19 | Pending |
| REG-07 | Phase 19 | Complete |
| FAL-01 | Phase 20 | Pending |
| FAL-02 | Phase 20 | Pending |
| FAL-03 | Phase 20 | Pending |
| FAL-04 | Phase 20 | Pending |
| FAL-05 | Phase 20 | Pending |
| SET-01 | Phase 21 | Pending |
| SET-02 | Phase 21 | Pending |
| SET-03 | Phase 21 | Pending |
| SET-04 | Phase 21 | Pending |
| SET-05 | Phase 21 | Pending |
| SET-06 | Phase 21 | Pending |
| SET-07 | Phase 21 | Pending |
| SET-08 | Phase 21 | Pending |
| VER-01 | Phase 22 | Pending |
| VER-02 | Phase 22 | Pending |
| VER-03 | Phase 22 | Pending |
| VER-04 | Phase 22 | Pending |
| VER-05 | Phase 22 | Pending |

**Coverage:**
- v1 requirements: 25 total
- Mapped to phases: 25
- Unmapped: 0 ✓

---
*Requirements defined: 2026-08-02*
*Last updated: 2026-08-02 after roadmap creation (all 25 v1.4 requirements mapped to Phases 19-22)*
