# Phase 17: Settings UI + List Source - Context

**Gathered:** 2026-08-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Staff open a Settings page from the shared navigation, see their current AI model configuration (primary + ordered fallback chain), and set/reorder it — choosing only from models the app can actually run (allowlist ∩ committed snapshot) — with immediate, validated persistence. The `NavKey` union grows `'settings'`; a Settings item lands in both the sidebar Manage group (next to Reviews) and the shared `ExplorerMenu`.

Delivers: SET-01..07. Nothing about the failover loop (Phase 16) or the verification gate (Phase 18) lands here. This phase is decoupled from Phase 16 via the DB (`user_model_settings` row) — Phase 16's runAgent already consumes whatever this page saves.

</domain>

<decisions>
## Implementation Decisions

### Model Roster Breadth (user-discussed)
- **D-01:** **Phase 17 re-verifies `claude-haiku-4-5` against live `GET /v1/models`** (standing maintenance per Phase 15 D-02). If the undated form is now present on the roster, it joins `ANTHROPIC_ALLOWLIST` → the picker offers 2 models (sonnet + haiku) and the fallback feature is genuinely usable. This is a roster-maintenance action inside the phase, not a scope expansion.
- **D-02:** **If the haiku re-verify fails again** (undated form still absent — the 2026-08-02 check found only dated `-20251001`), the phase **ships the sonnet-only picker gracefully**: the fallback section is hidden with a "no additional models available" note (D-08). Never add a dated ID (Phase 15 D-02 no-invented/dated-IDs rule — requires explicit user override to break).
- **D-03:** **Picker rows show model name + cost** (input/output per MTok from the committed snapshot). No context-window column.
- **D-04:** **Settings page shows a small "Catalog synced {date}" footer** from the snapshot's `generatedAt` (the Phase 15-flagged nicety).

### Reorder Interaction (user-discussed)
- **D-05:** **Fallback reordering uses up/down arrow buttons** per fallback row — no drag-and-drop dependency. Matches existing button/select primitives; logic is a trivial array move.
- **D-06:** **"Add fallback" button appends a new select row**; each row has a remove (X) control plus the up/down arrows. Empty fallback list is allowed (SET-04 primary-only runs).
- **D-07:** **Reordering and edits stage in local draft state** — a single explicit Save persists the whole configuration (see Save UX). Arrows do NOT auto-persist.

### Duplicate Handling (user-discussed)
- **D-08:** **The primary model is excluded from fallback picker options** — the same model can never appear as both primary and fallback.
- **D-09:** **A model chosen for a fallback slot is removed from the remaining slots' options** — no duplicate fallbacks can be saved. (Runtime dedupe in Phase 16 D-08 remains as a backstop, but the UI prevents the state.)
- **D-10:** **A saved-but-now-stale model (dropped from the roster/allowlist) renders as a disabled option with an inline warning** ("no longer runnable — pick replacement before saving"); the form blocks save until the stale value is replaced.
- **D-11:** **A stale PRIMARY specifically blocks save** until replaced — the chain needs a valid head; fallbacks alone are not sufficient.

### Save UX (user-discussed)
- **D-12:** **Explicit Save button** — draft staged locally (useState + `useTransition` like the reviews UI), button disabled while pending. No auto-save, no debounce.
- **D-13:** **Save failures surface as inline error text and the draft is preserved** (never reset on error) — matches the reviews.ts Server Action result pattern (`{ ok } | { ok: false, reason }`).
- **D-14:** **Save success shows an inline "Saved" confirmation and calls `revalidatePath`** so the reloaded page reflects the persisted state (SET-06).
- **D-15:** **No unsaved-changes navigation guard** — leaving the page silently discards the draft (simplest; matches current app patterns).

### Claude's Discretion
- Exact `NavKey` union change, sidebar item shape/icon, and `ExplorerMenu` item wiring for Settings (SET-01).
- `/settings` route placement (dashboard group vs root) and page component structure — follow the Reviews page pattern (`requireStaffAccess` + per-widget error card).
- The zod schema for the save action (validate primary + fallbacks against `ANTHROPIC_ALLOWLIST` + snapshot servable set at the server, per SET-06/SET-07).
- Reorder/remove edge behaviors not covered above (e.g. reordering while a stale row is present) — keep within the D-05..D-11 semantics.
- Whether the "last synced" footer derives directly from `catalog.json` `generatedAt` or a small helper.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` — Phase 17 goal, success criteria (5 items), requirements SET-01..07, depends-on Phase 15 (decoupled from 16 via the DB), UI hint: yes
- `.planning/REQUIREMENTS.md` — SET-01 through SET-07 definitions (§ Settings UI + List Source); VER-01..04 reference (§ Verification gate, Phase 18)

### Prior phase decisions to carry forward
- `.planning/phases/15-model-registry-foundation-persistence/15-CONTEXT.md` — D-02 (roster re-verify standing practice), D-03 (allowlist is the gate, snapshot is the menu), D-04 (`fallback_models` text[]), D-08 (module naming discretion), all locked
- `.planning/phases/16-failover-orchestration/16-CONTEXT.md` — D-08 (chain dedupe backstop), D-10 (primary + 1 fallback cap), snapshot-at-entry chain resolution the Settings page feeds
- `.planning/PROJECT.md` — Key Decisions: D-14 (DB is durable truth), D-15 (degrade gracefully), D-16 (Vitest pure functions only, zero live calls); v1.3 milestone goal

### Codebase patterns to follow
- `src/lib/nav.ts` — `NavKey` union (`'start'|'companies'|'personas'|'reviews'`) — grows `'settings'`; `getActiveNavKey` pure function
- `src/lib/sidebar-collapse.ts` — `getNavTooltipLabel` maps NavKey → tooltip label (grows with `'settings'`); tested in `sidebar-collapse.test.ts`
- `src/components/layout/app-sidebar.tsx` — Manage group sidebar item (Reviews precedent for the new Settings item)
- `src/components/explorer/explorer-menu.tsx` — `items: { label, disabled?, href? }[]` prop; used on companies/personas pages with Import item
- `src/app/(dashboard)/reviews/page.tsx` — the page pattern: `requireStaffAccess()` + per-widget error card + AppShellLayout
- `src/app/actions/reviews.ts` — the Server Action controller pattern: `requireStaffAccess()` FIRST, zod-validated `unknown` input, `{ ok } | { ok: false, reason }`, `revalidatePath`
- `src/lib/db/queries/userModelSettings.ts` — `getModelSettingsForUser(userId)` + `upsertModelSettings` (atomic full-value upsert) already exist; the save action calls `upsertModelSettings`
- `src/lib/models/catalog.ts` — `ANTHROPIC_ALLOWLIST`, `getAllowlistedServableIds` (allowlist ∩ snapshot → servable ids), `getModelDisplayName`, `FAST_MODEL_ID`; `catalog.json` `generatedAt` for the D-04 footer
- `src/components/ui/` — `select.tsx`, `button.tsx`, `input.tsx` primitives for the form

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `upsertModelSettings` / `getModelSettingsForUser` — the complete persistence layer already exists (Phase 15); the page only adds the form + action wiring
- `getAllowlistedServableIds(catalog)` — returns exactly the runnable set for the pickers (SET-07); `getModelDisplayName` for row labels
- `ExplorerMenu` items prop — adding a Settings item is a one-prop change on companies/personas pages
- `sidebar-collapse.ts` + `nav.ts` — pure, tested NavKey helpers; `'settings'` joins both
- Reviews Server Action pattern — the template for the settings save action (gate → zod → result → revalidate)
- `select.tsx` + `button.tsx` — form primitives for primary/fallback pickers and up/down/X controls

### Established Patterns
- Per-user rows: `userId: text` no-FK (Clerk), atomic full-value upsert — never read-modify-write (Pitfall 9)
- Server Actions: `requireStaffAccess()` first, zod-validate `unknown` input, structured `{ok, reason}` result, `revalidatePath` — never throw to the client
- Query modules: named exports, never try/catch; callers own error handling
- Vitest: co-located `*.test.ts`, pure functions only, zero live calls (D-16) — `getActiveNavKey('settings')`, stale-config filtering, and dedupe helpers are natural test targets
- Pages gate themselves even under the (dashboard) layout's auth (belt-and-suspenders, reviews precedent)

### Integration Points
- `src/lib/nav.ts` + `src/lib/sidebar-collapse.ts` — `NavKey` union + tooltip map grow `'settings'` (both pure, tested)
- `src/components/layout/app-sidebar.tsx` — new Manage-group item → `/settings`
- `src/components/explorer/explorer-menu.tsx` — Settings item added to companies/personas page menus (or a shared variant)
- New `src/app/(dashboard)/settings/page.tsx` (or `/settings`) — page; new `src/app/actions/settings.ts` — save action
- `src/lib/db/queries/userModelSettings.ts` — consumed as-is; no schema change expected
- `src/lib/models/catalog.ts` + `catalog.json` — picker source + footer date; allowlist may grow by haiku-4-5 (D-01, roster re-verify)

</code_context>

<specifics>
## Specific Ideas

- **"The allowlist is sonnet-only today — the picker would have ONE model"** — the driving concern behind D-01/D-02: without a roster expansion the fallback/reorder feature is dead on arrival. The re-verify is cheap and inside standing-maintenance practice.
- **No drag-and-drop** — the codebase has no DnD dependency; up/down arrows are consistent with the existing primitive set (D-05).
- The Settings page must never show raw opencode catalog rows — only `getAllowlistedServableIds` output (SET-07, Phase 15 D-03).

</specifics>

<deferred>
## Deferred Ideas

- **Per-model advanced settings / per-agent model assignment (MRG-01/03) / team defaults (MRG-04)** — carried in `.planning/REQUIREMENTS.md` Future Requirements; not this phase.
- **Drag-and-drop fallback reordering** — rejected for v1.3 (no DnD dependency); a later polish phase could add it behind the D-05 arrow interaction.
- **Unsaved-changes navigation guard** — deliberately not added (D-15); revisit if multi-tab edit-conflict handling ever becomes a real scenario.

</deferred>

---

*Phase: 17-Settings UI + List Source*
*Context gathered: 2026-08-02*
