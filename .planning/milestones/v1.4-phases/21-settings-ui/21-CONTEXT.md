# Phase 21: Settings UI - Context

**Gathered:** 2026-08-02
**Status:** Ready for planning

<domain>
## Phase Boundary

The Settings AI Model Configuration card gains an AI Provider dimension. Staff select an AI Provider (Anthropic + OpenRouter) above the Primary model; the Primary picker refreshes from the selected provider's servable source; fallback pickers span the union of all providers' servable models grouped by provider with provider badges (disambiguating same-name models); the OpenRouter picker (336 rows) is usable via Command-pattern type-to-filter search; `~latest` aliases and `:free` variants carry their labels; the staleness gate covers the union-wide servable set; and cost captions include high-cost warnings. Backend halves (registry, run path, gate, env declaration) shipped in Phases 19-20 — this phase is the visible UI + the props/data plumbing that feeds it.

**What this phase is NOT:** no new providers beyond Anthropic + OpenRouter, no servable-set changes (Phase 19 owns those), no run-path/classifier changes (Phase 20 owns those), no verification gate (Phase 22). The OpenRouter default primary slug (`anthropic/claude-sonnet-4.6`, D-07) is already pinned in modelFactory.ts — consume it, don't re-decide it.

</domain>

<decisions>
## Implementation Decisions

### Provider Switch UX (SET-03)
- **D-21-01:** Provider switch auto-resets the primary with a **non-blocking inline hint** under the provider selector (e.g. "Primary model reset to [default] for [provider]"). Draft stays staged (D-07 draft-only); the user clicks Save to persist. No confirm dialog.
- **D-21-02:** Fallbacks are **kept exactly as staged** in the draft on a provider switch — the union pickers still render them (the chain may become cross-provider, which is the milestone's whole point). Only staleness is re-validated against the union servable set. Fallback rows are never cleared or silently dropped on switch.
- **D-21-03:** The always-valued AI Provider selector sits **directly above the Primary model label** in the AI Model Configuration card (SET-01 wording: "above the Primary model").
- **D-21-04:** The Save button stays gated by the existing client-side staleness check — a stale/unsaved primary keeps Save blocked (existing D-10/D-11 pattern), with the hint explaining why. Server-side invalid_model remains the backstop.

### OpenRouter Picker Component (SET-06)
- **D-21-05:** Vendor the **shadcn Command component (cmdk-based)** into `src/components/ui/command.tsx` and build a Combobox wrapper — the standard shadcn searchable-select pattern. This is a NEW dependency (cmdk) — the "Command pattern already vendored" research claim is inaccurate (the explorers' nuqs debounced-search `Input` is not a Command primitive; verified in scout).
- **D-21-06:** The Command-based Combobox **replaces the existing shadcn Select for the primary AND all fallback slots** — one consistent picker everywhere (no dual picker patterns). The existing `src/components/ui/select.tsx` may stay for other uses but the model pickers all become Comboboxes.
- **D-21-07:** Type-to-filter searches **id + display name + family** — 'sonnet', 'anthropic/claude...', and 'anthropic' all surface the right rows.
- **D-21-08:** Union fallback pickers group by **provider sections** (SelectGroup-style headers inside the Command list) — the single-selector + union-picker model already locked in research (Conflict 6 resolved). No nested provider→family subgroup headers.

### Badge + Grouping Design (SET-04/05)
- **D-21-09:** Provider badges are **neutral slate/gray** with the provider name ('Anthropic' / 'OpenRouter') — matches the existing slate theme, AA-safe, disambiguates same-name models without color meaning. No color-coding.
- **D-21-10:** Provider badges appear **on picker rows AND on saved chain entries** (the saved-chain recap) — SET-05 requires both; the chain-entry badge is what actually disambiguates a saved cross-provider chain at a glance.
- **D-21-11:** Family renders as a **muted subtitle line** under the model name inside the OpenRouter picker (not subgroup headers, not hidden) — informative without adding another grouping level. Family is also in the search index (D-21-07).

### Labels + Cost Warnings (SET-07/08)
- **D-21-12:** `~latest` and `:free` labels render as **row-level suffix labels** next to the model name inside the picker: `~latest` → "always the latest" (drift caveat); `:free` → "free tier — 50 req/day shared" (fail-loud on cap). The caveat rides the row being chosen.
- **D-21-13:** High-cost models (e.g. `openai/o1-pro` at $150/M input) get an **inline row warning** — cost caption styled distinctly (warning color) on the offending row inside the picker. No card-level banner.
- **D-21-14:** The union-wide staleness gate **widens the existing client-side draft gate** (staleIds) from the anthropic-only servable list to the union servable set — same behavior, wider list. No new gate machinery.

### Claude's Discretion
- Exact hint copy wording for the provider-switch reset (D-21-01 anchor: "Primary model reset to [default] for [provider]").
- The cost threshold that flips a row into "high-cost warning" styling (D-21-13 anchor: `openai/o1-pro` at $150/M must trip it; a sensible default like ≥$50/M input, applied from the snapshot's `cost.input`).
- How the Command/Combobox vendoring is structured (single `command.tsx` + a `combobox`/picker wrapper component) and whether the existing `select.tsx` usage elsewhere is touched.
- The exact saved-chain recap shape (where chain-entry badges live after Save).
- Whether provider section headers inside the fallback Combobox use the provider name or a small badge+name combo (section header = provider identity, so row badges may be redundant inside the dropdown — but chain entries keep badges per D-21-10).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone research (v1.4 — primary source of locked decisions)
- `.planning/research/SUMMARY.md` — §Phase 21 deliverables (lines ~104-108: per-provider servable lists + union, provider selector above Primary, keep-if-valid → reset-to-provider-default draft-only, union fallbacks grouped by provider + family, badges, staleness union-wide, freshness caption, cost captions incl. $150/M warning, Command search P1); Conflicts 5/6/7/8 (search P1, single-selector model, vendor badges + egress copy, OpenRouter default primary); PITFALLS 10 (336-row picker usability, draft preservation, dup-name disambiguation).
- `.planning/research/FEATURES.md` — P1/P2 split; table-stakes UI + P2 differentiators (badges, family grouping, search).
- `.planning/research/PITFALLS.md` — Pitfall 10 (draft preservation on switch; 336-row picker; dup names), Pitfall 11 (vendor badges + egress copy + $150/M o1-pro), Pitfall 2/4 (alias/free-tier policy — overridden by locked decision: INCLUDED + labeled).

### Roadmap & requirements (locked scope)
- `.planning/ROADMAP.md` §Phase 21 — Goal, Depends on (Phase 19; parallel w/ Phase 20), Requirements (SET-01..08), Success Criteria, UI hint flag.
- `.planning/REQUIREMENTS.md` — v1.4 requirements SET-01..08 (full text).

### Project state & decision records
- `.planning/STATE.md` — v1.4 locked product decisions (D-07 OpenRouter default = `anthropic/claude-sonnet-4.6`; Conflict 6 single-selector + union pickers; Conflict 7 full catalog + badges; SET-06 grouping + Command both P1).
- `.planning/PROJECT.md` — Key Decisions table (D-07, D-14, D-15 doctrine referenced by this phase).

### Phase 17 UI contract (the existing Settings form this phase extends)
- `src/components/settings/model-settings-form.tsx` — the current form: D-07 draft staging, ERROR_COPY map, client staleness gate (staleIds), cost captions, Select-based pickers, fallback cap 2. References `17-UI-SPEC` line numbers inline (archived; the code comments carry the contract).
- `src/app/(dashboard)/settings/page.tsx` — server-computed picker props (currently anthropic-only via `getServableIdsForProvider(catalogJson, 'anthropic')`), props-only contract, per-widget error card, `getModelDisplayName` fallback.
- `src/app/actions/settings.ts` — `saveSettingsAction`: requireStaffAccess FIRST, zod validate, union-wide servable check (Phase 19 widened), dedupe backstop, atomic upsert keyed by session userId. Already accepts cross-provider chains (REG-07).

### Existing code (integration points)
- `src/lib/models/catalog.ts` — `getServableIdsForProvider`, `getUnionServableIds`, `getProviderForModelId`, `ANTHROPIC_ALLOWLIST`, `FAST_MODEL_ID`, `getModelDisplayName`, `ModelProviderId`. The provider-identity source for badges/grouping.
- `src/lib/agents/modelFactory.ts` — `OPENROUTER_DEFAULT_MODEL_ID` (`anthropic/claude-sonnet-4.6`) + `PROVIDER_DEFAULT_MODELS` map (D-07 reset-to-provider-default source, Phase 19).
- `src/lib/models/catalog.json` — the committed snapshot: 336 openrouter + 17 anthropic rows, `family` field, `cost` per row, `structuredOutputs` capability (Phase 19 D-08). Server-only.
- `src/lib/db/queries/userModelSettings.ts` — the atomic upsert + per-user read (unchanged — no schema change, REG-05).
- `src/components/ui/select.tsx` + vendored primitives (`button`, `input`, `badge`, `scroll-area`, etc.) — current picker base; Command/Combobox is NEW (no `command.tsx`, no cmdk).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ModelSettingsForm` (model-settings-form.tsx): draft-staging form shell, ERROR_COPY map, staleIds gate, add/remove/move fallback handlers, Save-with-useTransition flow — all extended, not rewritten.
- `getUnionServableIds` / `getServableIdsForProvider` / `getProviderForModelId` (catalog.ts): the data functions for per-provider lists, the union, and provider-identity (badges/grouping/hop decisions).
- `PROVIDER_DEFAULT_MODELS` (modelFactory.ts): D-07 per-provider defaults for the reset-to-provider-default behavior.
- `dateFormatter` (explorer-format): the catalog freshness caption ("Catalog synced {date}") already in use.
- Existing shadcn UI primitives (button, badge, input, scroll-area, select) — the slate design language.

### Established Patterns
- **Props-only contract**: server computes picker data, client receives props only — `catalog.json` never enters a client bundle (T-17-09). New per-provider + union props must follow this (trim to `{id, name, cost, family, providerID}`-shaped data; the raw catalog stays server-side).
- **D-07 draft staging**: all edits stage in local state; nothing persists until Save; failure preserves the draft verbatim (D-13).
- **Client staleness gate** (staleIds from draft): blocks Save on stale ids; widens to union in this phase (D-21-14).
- **Server Action order** (immutable): requireStaffAccess FIRST → zod → servable check → dedupe backstop → atomic upsert keyed by session userId.
- **Error copy map**: exact reason-code → copy mapping; new action reasons (none expected — saveSettingsAction already handles the union) stay in the existing map.
- **Why-comments**: non-obvious decisions get concise inline comments (house style).

### Integration Points
- `settings/page.tsx` → compute per-provider servable lists + union + provider defaults server-side, pass as props (widening the current anthropic-only `servableModels`).
- `ModelSettingsForm` → provider selector state (D-21-03), primary Combobox (provider-scoped), fallback Comboboxes (union, provider-grouped), badges, labels, warnings, widened staleness gate.
- `saveSettingsAction` → unchanged (already union-validating); the form's submit contract stays `{primaryModel, fallbacks}`.
- New `command.tsx` + Combobox component → replaces Select in the model pickers (D-21-06).
- `getProviderForModelId` / `PROVIDER_DEFAULT_MODELS` → provider identity + reset defaults.

</code_context>

<specifics>
## Specific Ideas

- The 4-cell provider-switch behavior mirrors the run path's hop logic: a cross-provider chain is a first-class, intended state — the UI must make it legible (badges), not discourage it.
- `~latest` aliases are OpenRouter's "always the latest" convention; the drift caveat means "the id resolves to a moving target — the audit records the alias as-saved (FAL-05 verbatim)". The `:free` tier is a shared 50 req/day account-wide quota — label it honestly so a team doesn't silently bottleneck.
- `openai/o1-pro` at $150/M input is the canonical high-cost example (SET-08); the warning threshold must trip it.
- The saved-chain recap (post-Save) should read the chain back with provider badges per model (D-21-10) — "which vendor's bill" visibility (research P2 differentiator pulled in).

</specifics>

<deferred>
## Deferred Ideas

- **Per-slot provider selectors** (Conflict 6's PITFALLS-10 alternative): a provider control on every fallback slot instead of one global selector. Rejected for Phase 21 — the union picker's provider grouping + badges deliver the same visibility with fewer controls. Revisit only if UAT shows the union picker is confusing (research Conflict 6).
- **Family subgroup headers** inside the OpenRouter picker: deferred — muted family subtitle (D-21-11) carries the info without the extra navigation level.
- **Card-level high-cost banner**: deferred — inline row warnings (D-21-13) carry the caveat at the point of choice.
- **Color-coded provider badges**: deferred — neutral slate (D-21-09) is AA-safe and theme-consistent; color semantics can come later if the team wants faster scan.
- **Vendor curation / trusted-labs filter** (Conflict 7 alternative): deferred by the locked full-catalog decision — badges + egress context + cost captions ship instead (Phase 19/21 posture).

</deferred>

---

*Phase: 21-Settings UI*
*Context gathered: 2026-08-02*
