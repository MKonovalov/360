# Phase 21: Settings UI - Research

**Researched:** 2026-08-03
**Domain:** shadcn/cmdk Command-based model pickers, provider-switch state logic, server→client props plumbing
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-21-01:** Provider switch auto-resets the primary with a **non-blocking inline hint** under the provider selector (e.g. "Primary model reset to [default] for [provider]"). Draft stays staged (D-07 draft-only); the user clicks Save to persist. No confirm dialog.
- **D-21-02:** Fallbacks are **kept exactly as staged** in the draft on a provider switch — the union pickers still render them (the chain may become cross-provider, which is the milestone's whole point). Only staleness is re-validated against the union servable set. Fallback rows are never cleared or silently dropped on switch.
- **D-21-03:** The always-valued AI Provider selector sits **directly above the Primary model label** in the AI Model Configuration card (SET-01 wording: "above the Primary model").
- **D-21-04:** The Save button stays gated by the existing client-side staleness check — a stale/unsaved primary keeps Save blocked (existing D-10/D-11 pattern), with the hint explaining why. Server-side invalid_model remains the backstop.
- **D-21-05:** Vendor the **shadcn Command component (cmdk-based)** into `src/components/ui/command.tsx` and build a Combobox wrapper — the standard shadcn searchable-select pattern. This is a NEW dependency (cmdk) — the "Command pattern already vendored" research claim is inaccurate (the explorers' nuqs debounced-search `Input` is not a Command primitive; verified in scout).
- **D-21-06:** The Command-based Combobox **replaces the existing shadcn Select for the primary AND all fallback slots** — one consistent picker everywhere (no dual picker patterns). The existing `src/components/ui/select.tsx` may stay for other uses but the model pickers all become Comboboxes.
- **D-21-07:** Type-to-filter searches **id + display name + family** — 'sonnet', 'anthropic/claude...', and 'anthropic' all surface the right rows.
- **D-21-08:** Union fallback pickers group by **provider sections** (SelectGroup-style headers inside the Command list) — the single-selector + union-picker model already locked in research (Conflict 6 resolved). No nested provider→family subgroup headers.
- **D-21-09:** Provider badges are **neutral slate/gray** with the provider name ('Anthropic' / 'OpenRouter') — matches the existing slate theme, AA-safe, disambiguates same-name models without color meaning. No color-coding.
- **D-21-10:** Provider badges appear **on picker rows AND on saved chain entries** (the saved-chain recap) — SET-05 requires both; the chain-entry badge is what actually disambiguates a saved cross-provider chain at a glance.
- **D-21-11:** Family renders as a **muted subtitle line** under the model name inside the OpenRouter picker (not subgroup headers, not hidden) — informative without adding another grouping level. Family is also in the search index (D-21-07).
- **D-21-12:** `~latest` and `:free` labels render as **row-level suffix labels** next to the model name inside the picker: `~latest` → "always the latest" (drift caveat); `:free` → "free tier — 50 req/day shared" (fail-loud on cap). The caveat rides the row being chosen.
- **D-21-13:** High-cost models (e.g. `openai/o1-pro` at $150/M input) get an **inline row warning** — cost caption styled distinctly (warning color) on the offending row inside the picker. No card-level banner.
- **D-21-14:** The union-wide staleness gate **widens the existing client-side draft gate** (staleIds) from the anthropic-only servable list to the union servable set — same behavior, wider list. No new gate machinery.

### Claude's Discretion
- Exact hint copy wording for the provider-switch reset (D-21-01 anchor: "Primary model reset to [default] for [provider]").
- The cost threshold that flips a row into "high-cost warning" styling (D-21-13 anchor: `openai/o1-pro` at $150/M must trip it; a sensible default like ≥$50/M input, applied from the snapshot's `cost.input`).
- How the Command/Combobox vendoring is structured (single `command.tsx` + a `combobox`/picker wrapper component) and whether the existing `select.tsx` usage elsewhere is touched.
- The exact saved-chain recap shape (where chain-entry badges live after Save).
- Whether provider section headers inside the fallback Combobox use the provider name or a small badge+name combo (section header = provider identity, so row badges may be redundant inside the dropdown — but chain entries keep badges per D-21-10).

### Deferred Ideas (OUT OF SCOPE)
- **Per-slot provider selectors** (Conflict 6's PITFALLS-10 alternative): a provider control on every fallback slot instead of one global selector. Rejected for Phase 21 — the union picker's provider grouping + badges deliver the same visibility with fewer controls. Revisit only if UAT shows the union picker is confusing (research Conflict 6).
- **Family subgroup headers** inside the OpenRouter picker: deferred — muted family subtitle (D-21-11) carries the info without the extra navigation level.
- **Card-level high-cost banner**: deferred — inline row warnings (D-21-13) carry the caveat at the point of choice.
- **Color-coded provider badges**: deferred — neutral slate (D-21-09) is AA-safe and theme-consistent; color semantics can come later if the team wants faster scan.
- **Vendor curation / trusted-labs filter** (Conflict 7 alternative): deferred by the locked full-catalog decision — badges + egress context + cost captions ship instead (Phase 19/21 posture).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SET-01 | AI Provider selector renders above the Primary model picker — always-valued, Anthropic + OpenRouter options | Provider options computed server-side from `SERVABLE_PROVIDERS` (catalog.ts) — page passes `providers` prop; Select retained for the 2-choice selector (UI-SPEC §Interaction Contract); placement locked by D-21-03 |
| SET-02 | Selecting a provider refreshes the Primary model picker from that provider's servable source | `getServableIdsForProvider(catalog, provider)` per provider → `servableByProvider` prop (anthropic 1 row, openrouter 336 rows); primary picker options = `servableByProvider[providerState]` |
| SET-03 | Provider switch follows keep-if-valid → reset-to-provider-default (OpenRouter default = `anthropic/claude-sonnet-4.6`); draft-only (D-07), fallbacks preserved, non-blocking hint | `PROVIDER_DEFAULT_MODELS` (modelFactory.ts) + `getModelDisplayName` → `defaults` prop; pure client reducer: keep draft primary if in new provider's servable list, else reset + hint; fallbacks untouched (D-21-02); Save gating recomputed (D-21-14) |
| SET-04 | Fallback pickers show the union of all providers' servable models, grouped by provider + family | `getUnionServableIds` → 353 rows (336 openrouter + 17 anthropic); client groups by `providerID` into `CommandGroup` headings (D-21-08); family as muted subtitle line, not subgroup (D-21-11) |
| SET-05 | Provider badges on picker rows and saved chain entries (disambiguates same-name models like `claude-sonnet-5` vs `anthropic/claude-sonnet-5`) | 12 duplicate display names verified across anthropic+openrouter — badge necessity confirmed; `getProviderForModelId` → `savedChain` prop provider identity; `Badge variant="secondary"` (neutral slate) per UI-SPEC §Color; union picker rows only (primary is provider-scoped, badges are noise — UI-SPEC §Row Anatomy) |
| SET-06 | Command-pattern type-to-filter search + provider/family grouping in the OpenRouter picker (336 rows usable) | **NEW dependency cmdk 1.1.1** (slopcheck [OK]); vendor `command.tsx` + `popover.tsx` + `input-group.tsx` via `npx shadcn@latest add command popover`; composite search value `[id, name, family]` (D-21-07); vendored `CommandList` scrolls `max-h-72`; cmdk built-in filter suffices at 353 rows (no virtualization) |
| SET-07 | `~latest` aliases labeled "always the latest" (drift caveat); `:free` variants labeled rate-limited free tier (shared 50 req/day quota, fail-loud on cap) | 11 `~latest` + 14 `:free` rows verified in snapshot, zero overlap (label logic unambiguous); labels derived client-side from id (`startsWith('~')` / `endsWith(':free')`) per UI-SPEC §Row Anatomy; D-21-12 overrides research PITFALLS 2/4 exclusion stance — rows are INCLUDED + labeled |
| SET-08 | Staleness gate covers the union-wide servable set; catalog freshness caption retained; cost captions incl. high-cost model warnings (e.g. $150/M) | `staleIds` widened from `servableModels` (anthropic-only) to union ids (D-21-14); `catalogGeneratedAt` caption unchanged; exactly 1 row trips `costInput >= 50` (`openai/o1-pro` $150) — threshold verified against snapshot, warning never floods the 336-row list (UI-SPEC §Color) |
</phase_requirements>

## Summary

Phase 21 makes the Settings AI Model Configuration card provider-aware. The backend halves shipped in Phases 19-20: the provider registry (`catalog.ts` — `getServableIdsForProvider`, `getUnionServableIds`, `getProviderForModelId`), the reset defaults (`PROVIDER_DEFAULT_MODELS` in `modelFactory.ts`), and the union-validating `saveSettingsAction`. **This phase is pure frontend: one new vendored component set (shadcn Command, cmdk-based), one new wrapper component (`model-picker.tsx`), widened server props in `settings/page.tsx`, and state logic in the existing form.**

The critical discovery: the current shadcn v4 `combobox` registry item is **Base UI-based, not cmdk-based** — the locked D-21-05 path (`command.tsx` + custom wrapper) is the correct one, and `@shadcn/combobox` must NOT be installed. The vendored v4 `command.tsx` renders its Check icon gated on `data-[checked=true]`, but **cmdk does not set that attribute** — the Combobox wrapper MUST pass `data-checked={selected === item.id}` per row (verified against cmdk 1.1.1 source and four real-world shadcn combobox implementations). This is the single most likely silent-failure point in the phase.

Data plumbing follows the existing props-only contract (T-17-09): `settings/page.tsx` computes per-provider lists, the union, defaults, and saved-chain provider identity server-side, trimmed to `{id, name, family, providerID, costInput, costOutput}`; `catalog.json` (1131 rows) never enters a client bundle. All row lookups must remain provider-scoped (`m.id === id && m.providerID === <provider>`) because the snapshot dual-lists ids (Anti-Pattern 1).

**Primary recommendation:** Follow the UI-SPEC exactly — vendor `command`/`popover` via the shadcn CLI, write `model-picker.tsx` as the classic Popover+Command Combobox with `data-checked`, extract all pure decision logic (provider-switch reset, composite search value, suffix labels, high-cost predicate, union staleIds, union dedupe) into a client-safe testable module, and keep `select.tsx` for the provider selector + the 4 untouched consumers.

## Project Constraints (from CLAUDE.md)

| Directive | Authority | Phase 21 Implication |
|-----------|-----------|----------------------|
| GSD workflow enforcement: enter work via `/gsd-quick`, `/gsd-debug`, or `/gsd-execute-phase`; no direct repo edits outside a GSD workflow | CLAUDE.md §Workflow | Plans must be executed via `/gsd-execute-phase`; research does not modify source |
| Lockfile consistency: `package.json` declares yarn `packageManager` but `package-lock.json` is present; README uses `npm install` | CLAUDE.md §Technology Stack | When `npx shadcn add command` installs cmdk, verify the lockfile updates via npm (the de-facto package manager); do not introduce a `yarn.lock` |
| Strict TypeScript, `@/*` → `src/*` alias configured but relative imports are the observed house style | CLAUDE.md §Conventions | New components follow relative-import style of `model-settings-form.tsx` (or adopt `@/` consistently if the planner chooses — alias is configured and shadcn vendored files use `@/`) |
| Named exports only, no default exports; `interface` for object shapes; camelCase; single quotes; semicolons; 2-space indent | CLAUDE.md §Conventions | All new modules (`model-picker.tsx`, logic module) follow this |
| Why-comments: concise inline comments for non-obvious decisions; no JSDoc | CLAUDE.md §Conventions | The provider-scoped lookup, data-checked, and fallback-preservation comments are required why-comments |
| Fail-safe error handling: external calls degrade to known-good UI, never 500 | CLAUDE.md §Error Handling | The form's existing error paths (ERROR_COPY, draft preservation D-13) are unchanged; no new failure modes introduced |
| Env-var discipline: never expose non-`PUBLIC_` (Astro-era) / non-`NEXT_PUBLIC_` vars to client code | CLAUDE.md §Conventions | No new env vars this phase; `OPENROUTER_API_KEY` stays server-only (Phase 19/20 shipped declaration); props-only contract keeps catalog server-side |
| No new AI providers, no servable-set changes, no run-path changes | CONTEXT.md §Phase Boundary | Strictly UI + props plumbing |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| AI Provider selector options (SET-01) | API/Backend | Browser/Client | Page computes `providers` from `SERVABLE_PROVIDERS`; Select renders it (2 choices, no search) |
| Provider-scoped primary options (SET-02) | API/Backend | Browser/Client | `servableByProvider` computed server-side via `getServableIdsForProvider`; client just renders the selected provider's list |
| Keep-if-valid → reset-to-provider-default (SET-03) | Browser/Client | API/Backend | Draft is client state (D-07); server supplies the `defaults` + servable sets that make the decision deterministic |
| Union fallback pickers + grouping (SET-04) | API/Backend | Browser/Client | Union list computed server-side (`getUnionServableIds`, 353 rows); client groups by `providerID` for display |
| Provider badges + dup-name disambiguation (SET-05) | API/Backend | Browser/Client | Provider identity resolved server-side (`getProviderForModelId` → `savedChain`); badges are pure rendering |
| Type-to-filter search (SET-06) | Browser/Client | — | cmdk runs entirely client-side; search index (id+name+family) is a client-computed composite |
| `~latest`/`:free` labels (SET-07) | Browser/Client | — | Derived client-side from the id (id is source of truth, REG-03 includes these rows) |
| Union staleness gate (SET-08) | Browser/Client | API/Backend | Client `staleIds` over the server-computed union; `invalid_model` server backstop (already shipped) |
| Save persistence | API/Backend | Database | `saveSettingsAction` unchanged — union-validating since Phase 19; atomic upsert keyed by session userId |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `cmdk` | 1.1.1 | Command-pattern searchable combobox primitive | The cmdk library is what shadcn's official `command` component is built on (Context7: "The Command component is built using the cmdk library"); peer react ^18 \|\| ^19 — compatible with installed React 19.2.4 [VERIFIED: npm registry + Context7 /dip/cmdk + shadcn registry item] |
| shadcn `command` (vendored) | v4 registry (radix-nova style) | `Command`, `CommandInput`, `CommandList`, `CommandGroup`, `CommandItem`, `CommandEmpty` | Official shadcn component, added via CLI, vendored as source into `src/components/ui/command.tsx` — matches `components.json` (radix-nova, neutral, lucide) [VERIFIED: ui.shadcn.com registry JSON fetched] |
| shadcn `popover` (vendored) | v4 registry (radix-nova style) | Combobox trigger/overlay | Official shadcn component on the already-present `radix-ui` unified package; no new deps [VERIFIED: registry JSON fetched] |
| shadcn `input-group` (vendored, auto-dep) | v4 registry (radix-nova style) | `CommandInput` search-box internals (auto-registry-dependency of `command`) | Registry item lists `input-group` in `registryDependencies`; pulls `textarea` transitively (button/input already vendored) [VERIFIED: registry JSON fetched] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-react` | installed | Search/Check/Chevron icons in the picker | The CLI resolves the registry's `IconPlaceholder` to lucide `Search`/`Check` during `add` (iconLibrary: "lucide") — executor verifies no dangling `@/app/(create)/...` paths |
| `radix-ui` (unified) | installed | Select (provider selector), Popover primitives | Already the vendored primitive base (`select.tsx` imports from `"radix-ui"`); popover uses it directly |
| `Badge` (existing) | vendored | Provider badges | `variant="secondary"` = neutral slate pill (bg-secondary text-secondary-foreground ~15:1) — matches UI-SPEC §Color exactly |
| `dateFormatter` (explorer-format) | existing | "Catalog synced {date}" caption | Already used by the form; unchanged |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `command.tsx` + custom wrapper (D-21-05) | `@shadcn/combobox` (shadcn v4 registry) | **REJECTED (verified):** the v4 `combobox` registry item is built on `@base-ui/react`, contradicting the locked cmdk decision and adding a second primitive runtime — architecture mismatch, not a security flag (UI-SPEC §Registry Safety; Context7 docs confirm the base-ui Combobox API) |
| `command.tsx` + custom wrapper | `nuqs` debounced-search `Input` (explorers' pattern) | Re-implements filtering + keyboard nav that cmdk provides for free; the CONTEXT.md scout explicitly corrected the "already vendored" claim |
| cmdk built-in filter | `shouldFilter={false}` + manual filtering (MonkeyCode pattern) | At 353 rows the built-in filter (command-score, O(n) per keystroke) is fast enough — UI-SPEC line 164 confirms no virtualization needed; manual filtering only if perf becomes an issue |
| Composite `value` = id+name+family (D-21-07) | cmdk `keywords` array on CommandItem | Both work; UI-SPEC locks the composite — with keywords the value stays the raw id and `data-checked` needs no reverse lookup, but the composite is the approved contract — implement per UI-SPEC |
| `Select` for primary+fallbacks (current) | — | Retained only for the provider selector + 4 other consumers; all model slots become Comboboxes (D-21-06) |

**Installation:**
```bash
# Inside the project (shadcn CLI 4.16.1 is already installed as a dependency):
npx shadcn@latest add command popover
# Installs: cmdk (npm dep) + src/components/ui/{command,popover,input-group,textarea}.tsx
# (button/input/dialog already vendored — skipped; input-group pulls textarea transitively)
```

**Version verification (already run 2026-08-03):** `cmdk@1.1.1` latest on npm, published from the official `pacocoursey/cmdk` GitHub repo, MIT, no postinstall script, slopcheck `[OK]`.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `cmdk` 1.1.1 | npm | ~6 yrs (created 2020-10-08) | Very high (de-facto standard command-menu primitive; used by shadcn, Vercel, Supabase) | `github.com/pacocoursey/cmdk` | [OK] | Approved — only new npm dependency this phase |
| `@shadcn/combobox` | npm (shadcn registry) | current | — | shadcn v4 registry | not run (rejected pre-install) | **REMOVED** — architecture mismatch: Base UI-based, contradicts locked cmdk decision (D-21-05); wrapper is custom over Command + Popover |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none
**Note:** `cmdk` was verified via Context7 (`/dip/cmdk`, benchmark 86.64, official README fetched) + the shadcn official registry item (`"dependencies": ["cmdk"]`) + npm registry + slopcheck — it carries `[VERIFIED: npm registry]` provenance. All vendored shadcn components come from the official shadcn registry (`registries: {}` in components.json — no third-party registries).

## Architecture Patterns

### System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│  Server Component: src/app/(dashboard)/settings/page.tsx             │
│  requireStaffAccess() → getModelSettingsForUser(userId)              │
│  catalog.ts (SERVER-ONLY, imports catalog.json — 1131 rows)          │
│    getServableIdsForProvider × SERVABLE_PROVIDERS  → servableByProvider│
│    getUnionServableIds                              → unionServableModels│
│    PROVIDER_DEFAULT_MODELS + getModelDisplayName   → defaults          │
│    getProviderForModelId × saved chain             → savedChain        │
│  Props: saved, providers, servableByProvider, unionServableModels,    │
│         defaults, savedChain, catalogGeneratedAt                     │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ props only (T-17-09 — catalog.json never
                               ▼ enters a client bundle)
┌──────────────────────────────────────────────────────────────────────┐
│  Client Component: ModelSettingsForm ('use client')                   │
│  ┌─ AI Provider Select (shadcn Select, 2 items) ── provider state ─┐  │
│  │   on switch: keep-if-valid → reset primary to defaults[p].id    │  │
│  │               + non-blocking hint (D-21-01); fallbacks verbatim  │  │
│  ├─ Primary ModelPicker (Combobox) ── options = servableByProvider[│  │
│  │                                   provider]  (1 or 336 rows)    │  │
│  ├─ Fallback ModelPicker ×2 (Combobox) ── options = union (353),   │  │
│  │   grouped by provider CommandGroup, badges on rows, cap 2        │  │
│  ├─ staleIds = draft ids ∩̸ unionIds  → Save disabled while stale   │  │
│  └─ Save changes ── {primaryModel, fallbacks} via useTransition     │  │
└──────────────────────────────┬───────────────────────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Server Action: saveSettingsAction (UNCHANGED — Phase 19 widened it) │
│  requireStaffAccess FIRST → zod → union servable check → dedupe      │
│  backstop → atomic upsert keyed by session userId (userModelSettings)│
└──────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
src/
├── components/
│   ├── settings/
│   │   ├── model-picker.tsx          # NEW — Combobox wrapper (Popover + Button trigger + Command)
│   │   ├── model-picker-logic.ts     # NEW — pure helpers (search composite, suffix label,
│   │   │                             #         high-cost predicate, groupByProvider, reset reducer,
│   │   │                             #         union staleIds + dedupe) — Vitest-covered, no catalog.json import
│   │   └── model-settings-form.tsx   # EXTENDED — provider state, picker wiring, gate, saved-chain recap
│   └── ui/
│       ├── command.tsx               # NEW — vendored shadcn (cmdk wrapper)
│       ├── popover.tsx               # NEW — vendored shadcn
│       ├── input-group.tsx           # NEW — vendored (auto-registry-dep of command)
│       └── textarea.tsx              # NEW — vendored (transitive dep of input-group)
├── app/(dashboard)/settings/page.tsx # EXTENDED — widened props computation
└── lib/models/catalog.ts             # UNCHANGED — consumed server-side only
```

### Pattern 1: The Classic cmdk Combobox (Popover + Button + Command)

**What:** The standard shadcn searchable-select: a `Popover` whose `Trigger` is a `Button` showing the selected value; the `PopoverContent` holds a `Command` with `CommandInput` (search), `CommandList`, `CommandGroup`s, and `CommandItem`s. Verified identical across Supabase's combobox-demo, shadcnblocks/kibo grouped-combobox patterns, and MonkeyCode's provider-model-combobox.

**When to use:** Every model slot in this phase (primary + fallbacks). The wrapper (`model-picker.tsx`) is the single reusable component.

**Example (Supabase combobox-demo — the canonical pattern):**
```tsx
'use client'

import { Check, ChevronsUpDown } from 'lucide-react'
import * as React from 'react'
import {
  Button, Command, CommandEmpty, CommandGroup, CommandInput,
  CommandItem, CommandList, Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui'   // ← in this project: separate imports from ui/*

export function ComboboxDemo() {
  const [open, setOpen] = React.useState(false)
  const [value, setValue] = React.useState('')

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open}
          className="w-full justify-between">
          {value ? frameworks.find((f) => f.value === value)?.label : 'Select…'}
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0">
        <Command>
          <CommandInput placeholder="Search models…" autoFocus />
          <CommandList>
            <CommandEmpty>No models found.</CommandEmpty>
            <CommandGroup heading="Anthropic">
              <CommandItem
                key={m.id}
                value={searchValue(m)}            // D-21-07 composite
                data-checked={value === m.id}     // ⚠ CRITICAL — cmdk does NOT set this
                onSelect={(v) => {
                  setValue(reverseLookup(v).id)   // map composite → id
                  setOpen(false)
                }}
              >
                {m.name}
                <Check className="ml-auto size-4" />
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
```
Source: [Supabase combobox-demo](https://github.com/supabase/supabase/blob/master/apps/design-system/registry/default/example/combobox-demo.tsx) (Apache-2.0) — [VERIFIED]

### Pattern 2: Provider-Switch State Reducer (D-21-01/02/03/14)

**What:** A pure function (or set of pure functions) in `model-picker-logic.ts` that the form's `handleProviderChange` calls. The draft stays in `useState`; nothing persists until Save (D-07).

**When to use:** The provider selector's `onValueChange` and any test that pins the keep-if-valid → reset semantics.

**Example (logic, client-safe, Vitest-covered):**
```ts
// model-picker-logic.ts — NO catalog.json import (client-safe; props only)
import type { ModelProviderId } from '@/lib/models/catalog'; // type-only, erased at compile

export type ServableModel = { id: string; name: string; family: string;
  providerID: ModelProviderId; costInput: number; costOutput: number };

// D-21-07: search index = id + display name + family, lowercased
export function searchValue(m: { id: string; name: string; family: string }): string {
  return [m.id, m.name, m.family].filter(Boolean).join(' ').toLowerCase();
}

// D-21-12: suffix labels derived from the id — id is the source of truth
export function suffixLabel(id: string): string | null {
  if (id.startsWith('~')) return 'always the latest';              // drift caveat (FAL-05)
  if (id.endsWith(':free')) return 'free tier — 50 req/day shared'; // fail-loud quota
  return null;
}

// D-21-13: high-cost threshold — verified: exactly 1 row (openai/o1-pro $150) trips ≥50
export function isHighCost(costInput: number, threshold = 50): boolean {
  return costInput >= threshold;
}

// D-21-01/03: keep-if-valid → reset-to-provider-default
export function primaryAfterProviderSwitch(
  currentPrimary: string,
  nextProvider: ModelProviderId,
  servableByProvider: Record<ModelProviderId, ServableModel[]>,
  defaults: Record<ModelProviderId, { id: string; name: string }>,
): { primary: string; resetToDefault: boolean } {
  const valid = servableByProvider[nextProvider].some((m) => m.id === currentPrimary);
  return valid
    ? { primary: currentPrimary, resetToDefault: false }
    : { primary: defaults[nextProvider].id, resetToDefault: true };
}

// D-21-14: union-wide staleness; '' = in-progress fallback row, not stale
export function staleIds(ids: (string | undefined)[], unionIds: ReadonlySet<string>): string[] {
  return ids.filter((id): id is string => !!id && !unionIds.has(id));
}

// D-21-08 + D-08/D-09 widened: group union options by provider; dedupe across slots
export function groupByProvider(models: ServableModel[]): Record<ModelProviderId, ServableModel[]> {
  const groups: Record<string, ServableModel[]> = {};
  for (const m of models) (groups[m.providerID] ??= []).push(m);
  return groups as Record<ModelProviderId, ServableModel[]>;
}
export function optionsForSlot(
  primary: string, fallbacks: string[], slotIndex: number, union: ServableModel[],
): ServableModel[] {
  return union.filter((m) =>
    m.id !== primary && !fallbacks.some((f, j) => j !== slotIndex && f === m.id));
}
```
Source: derived from locked decisions D-21-01/07/08/12/13/14 + existing D-08/D-09 client dedupe in `model-settings-form.tsx:234-237` — [VERIFIED against CONTEXT.md + code]

### Pattern 3: Server Props Computation (T-17-09 props-only)

**What:** `settings/page.tsx` widens its computed props from the current anthropic-only `servableModels` to per-provider + union + defaults + savedChain. Every row lookup MUST be provider-scoped (Anti-Pattern 1 — the snapshot dual-lists ids: `claude-sonnet-5` exists as opencode AND anthropic; a bare `find(m => m.id === id)` returns the opencode row that sorts first).

**When to use:** The page's data-fetch block. The `ServableModel` shape gains `family` and `providerID`; `~`/`:free` flags stay client-derived from id (never shipped as booleans — id is the source of truth).

**Example (server component):**
```tsx
// settings/page.tsx — widening the existing block
const trimRow = (id: string, provider: ModelProviderId) => {
  // Anti-Pattern 1: scope to the servable provider row — bare find() reads the
  // opencode/vercel dual row (sorts first) and returns the wrong cost/family.
  const m = catalogJson.models.find((mm) => mm.id === id && mm.providerID === provider);
  return {
    id,
    name: m?.name ?? getModelDisplayName(id),
    family: m?.family ?? '',
    providerID: provider,
    costInput: m?.cost?.input ?? 0,
    costOutput: m?.cost?.output ?? 0,
  };
};
const servableByProvider = Object.fromEntries(
  SERVABLE_PROVIDERS.map((p) => [p, getServableIdsForProvider(catalogJson, p).map((id) => trimRow(id, p))]),
) as Record<ModelProviderId, ServableModel[]>;
const unionServableModels = getUnionServableIds(catalogJson).map((id) =>
  trimRow(id, getProviderForModelId(catalogJson, id) ?? 'anthropic')); // union ids are always servable-scoped
const defaults = Object.fromEntries(SERVABLE_PROVIDERS.map((p) =>
  [p, { id: PROVIDER_DEFAULT_MODELS[p], name: getModelDisplayName(PROVIDER_DEFAULT_MODELS[p]) }])) as Record<ModelProviderId, { id: string; name: string }>;
const providers = SERVABLE_PROVIDERS.map((id) =>
  ({ id, name: id === 'anthropic' ? 'Anthropic' : 'OpenRouter' }));
const savedChain = settings
  ? [settings.primaryModel, ...settings.fallbackModels].map((id) => ({
      id, name: getModelDisplayName(id), providerID: getProviderForModelId(catalogJson, id),
    }))
  : null;
```
Source: derived from `settings/page.tsx:46-64` + `catalog.ts` + UI-SPEC §Props & Data Contract — [VERIFIED]

### Anti-Patterns to Avoid

- **Installing `@shadcn/combobox`:** The v4 registry item is Base UI-based — installing it violates D-21-05 and adds a second primitive runtime. Verified via `npx shadcn view` (UI-SPEC §Registry Safety) and Context7 docs (base-ui Combobox API). The wrapper is custom over `Command` + `Popover`.
- **Bare `find(m => m.id === id)` in page.tsx props:** Returns the opencode/vercel dual row for shared ids (sorts first) — wrong cost/family/provider. Anti-Pattern 1; ALWAYS scope with `&& m.providerID === <provider>`.
- **Importing `catalog.ts` into any client component:** It imports `catalog.json` (1131 rows) — a client import bloats the bundle and breaks T-17-09. The form receives props only; type-only imports of `ModelProviderId` are fine (erased at compile).
- **Relying on cmdk to render the check state:** cmdk sets `data-selected`/`aria-selected` (highlight) but NOT `data-checked` (the vendored v4 Check icon gate). Wrapper must pass `data-checked={value === m.id}` per row — the #1 silent-failure point.
- **Nested provider→family subgroups:** Deferred by locked decision (D-21-08); family is a muted subtitle line only (D-21-11).
- **Clearing fallbacks on provider switch:** Explicitly forbidden (D-21-02); the union pickers render cross-provider chains by design — the UI must make them legible (badges), not discourage them.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Type-to-filter search + keyboard nav + listbox a11y | A debounced Input + filtered div list | `cmdk` via shadcn `command.tsx` | cmdk provides arrow/enter/escape nav, listbox roles, command-score ranking, IME-safe key handling, SSR-safe layout effects — re-implementing this correctly is weeks of work and usually buggy (the explorers' nuqs pattern was explicitly rejected in scout) |
| Combobox overlay/trigger | Hand-rolled positioning | shadcn `popover.tsx` | Radix popover handles portal, focus trap, side/align, scroll-lock, z-index, escape — already the vendored pattern base |
| Search-box anatomy | Raw Input in the Command | shadcn `input-group.tsx` (auto-added) | The vendored v4 `command.tsx` imports `InputGroup`/`InputGroupAddon` — hand-wiring a different input breaks the registry contract and the CLI's IconPlaceholder resolution |

**Key insight:** This phase's "hard" problems (search over 336 rows, disambiguation, draft preservation) are all solved by composition: cmdk for search, the existing draft-staging form for state, catalog.ts for identity. The only genuinely new code is glue — the wrapper and the pure logic module. Don't invent new machinery where the locked stack already provides it.

## Runtime State Inventory

> Not a rename/refactor/migration phase — this section is omitted per the output contract (greenfield extension of an existing form). No stored data, live-service config, OS state, secrets, or build artifacts change: `userModelSettings` schema is untouched (REG-05), no env vars change, no DB migration. [VERIFIED: userModelSettings.ts unchanged; settings.ts action unchanged]

## Common Pitfalls

### Pitfall 1: The Check icon never appears (data-checked not set)
**What goes wrong:** The vendored v4 `command.tsx` renders `CheckIcon` gated on `group-data-[checked=true]/command-item:opacity-100`, but cmdk 1.1.1 only sets `data-selected`/`aria-selected`/`data-disabled` on items — never `data-checked`. The selected row shows no check mark and users can't tell which value is chosen.
**Why it happens:** The v4 registry moved from the classic "render `<Check>` with manual opacity classes" to an auto-rendered indicator keyed on a data-attribute cmdk doesn't emit.
**How to avoid:** Pass `data-checked={value === m.id}` on every `CommandItem` in the wrapper (verified pattern across MonkeyCode, nakama, foliofox, coollabsio).
**Warning signs:** Selected trigger label updates but no row in the dropdown shows a check.

### Pitfall 2: Dangling `@/app/(create)/...` import in the vendored command.tsx
**What goes wrong:** The v4 registry file imports `IconPlaceholder` from `@/app/(create)/components/icon-placeholder` and `cn` from `@/registry/radix-nova/lib/utils`. If the CLI fails to rewrite these to this project's paths, the build breaks with a module-not-found.
**Why it happens:** Registry files are written against the shadcn monorepo's internal paths; the CLI is supposed to resolve them at add-time.
**How to avoid:** Post-add verification task (already required by UI-SPEC §Vendoring): grep `command.tsx` for `@/app/(create)` and `@/registry` — must be zero; the search/check icons must be lucide `Search`/`Check` imports.
**Warning signs:** `next build` fails resolving `@/app/(create)/components/icon-placeholder`.

### Pitfall 3: Composite search value ↔ reverse-lookup mismatch
**What goes wrong:** `onSelect` receives the composite string (`"anthropic/claude-sonnet-4.6 Claude Sonnet 4.6 claude-sonnet"`), not the id. A naive `setValue(currentValue)` stores the composite in the draft → save fails `invalid_model`.
**Why it happens:** D-21-07 locks `value = [id, name, family].join(' ')` on CommandItem; the form state must hold the id.
**How to avoid:** `onSelect={(v) => onChange(options.find((o) => searchValue(o) === v)?.id ?? '')}` — or set `value={m.id}` + `keywords={[m.name, m.family]}` if the plan prefers id-valued items (UI-SPEC locks composite; pick one and unit-test the round-trip).
**Warning signs:** Saving a model that was selected via search produces `invalid_model`.

### Pitfall 4: Provider-unscoped row lookup in page props (Anti-Pattern 1)
**What goes wrong:** `catalogJson.models.find((mm) => mm.id === id)` returns the opencode/vercel dual row (sorts first) for shared ids like `claude-sonnet-5` → wrong cost caption, wrong family, wrong providerID.
**Why it happens:** The snapshot dual-lists ids across 8 providerIDs (1131 total rows).
**How to avoid:** Every lookup in the page's trim function scopes to the servable provider: `m.id === id && m.providerID === provider`.
**Warning signs:** A primary picker row shows $0 cost for a model that costs $3 (opencode gateway row has cost 0).

### Pitfall 5: Popover width mismatch on 336-row pickers
**What goes wrong:** The dropdown renders narrower/wider than the trigger, or long model names truncate awkwardly.
**Why it happens:** Default `PopoverContent` widths from older shadcn demos were fixed (`w-[200px]`).
**How to avoid:** `className="w-(--radix-popover-trigger-width) p-0"` (v4 syntax — MonkeyCode's pattern) so the list matches the trigger width; `p-0` so the vendored Command fills flush.
**Warning signs:** Trigger and dropdown widths visibly differ.

### Pitfall 6: Primary resets onto an existing fallback (duplicate chain after switch)
**What goes wrong:** Provider switch resets primary to `defaults[next].id`; if a preserved fallback already holds that exact id (possible: user staged the openrouter default as a fallback while on anthropic), the draft becomes `primary === fallback` → Save fails with `duplicate_model`.
**Why it happens:** D-21-01 resets the primary unconditionally when keep-if-valid fails; D-21-02 preserves fallbacks verbatim; the two can collide.
**How to avoid:** Detect the collision after reset (client) and surface the existing `ERROR_COPY.duplicate_model` semantics, or accept the server backstop error. Flag for planner — see Open Questions.
**Warning signs:** Provider switch → Save shows "Each model can only be used once."

## Code Examples

Verified patterns from official sources:

### Vendoring + wrapper structure (the exact shadcn v4 registry contract)
```bash
npx shadcn@latest add command popover
# → src/components/ui/command.tsx (imports InputGroup + IconPlaceholder→lucide Search/Check)
# → src/components/ui/popover.tsx, input-group.tsx, textarea.tsx
# → package.json: cmdk@^1.1.1
```
Source: [ui.shadcn.com registry JSON — command item](https://ui.shadcn.com/r/styles/radix-nova/command.json) — [VERIFIED]
Key vendored-file facts: `Command` root = `flex size-full flex-col overflow-hidden rounded-xl! bg-popover p-1`; `CommandList` = `no-scrollbar max-h-72 ... overflow-y-auto` (UI-SPEC's max-h-72 ✓); `CommandGroup` heading = `text-xs font-medium text-muted-foreground` (the section-header style); `CommandItem` = `data-selected:bg-muted ... data-[disabled=true]:opacity-50` + auto Check gated on `data-[checked=true]`.

### cmdk controlled-value + custom filter (official README)
```tsx
// Source: https://github.com/dip/cmdk (README)
<Command value={value} onValueChange={setValue}>
  <CommandInput placeholder="Search…" />
  <CommandList>
    <CommandItem value="apple">Apple</CommandItem>
    <CommandItem value="banana">Banana</CommandItem>
  </CommandList>
</Command>
```
`Command filter={(value, search, keywords) => number}` — rank 0..1; `keywords` is the third arg (official API, verified from source). The built-in `commandScore` handles the composite-value matching for D-21-07 — no custom filter needed at 353 rows.

### Real-world provider+model combobox (closest analog to this phase)
```tsx
// Source: https://github.com/chaitin/MonkeyCode — frontend/src/components/console/settings/provider-model-combobox.tsx
<Popover modal open={open} onOpenChange={handleOpenChange}>
  <PopoverTrigger asChild>
    <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
      <span className="truncate text-left">{selectedLabel}</span>
      <IconSelector className="ml-2 size-4 shrink-0 opacity-50" />
    </Button>
  </PopoverTrigger>
  <PopoverContent align="start" side="bottom" className="w-(--radix-popover-trigger-width) p-0">
    <Command shouldFilter={false}>
      <CommandInput value={query} onValueChange={setQuery} placeholder="Search models…" autoFocus />
      <CommandList>
        <CommandEmpty>No models found.</CommandEmpty>
        {groups.map((group) => (
          <CommandGroup key={group.key} heading={group.key}>
            {group.models.map((item) => (
              <CommandItem
                key={item.id}
                value={searchValue(item)}          // composite: id + name + family
                data-checked={value === item.id}   // ← the v4 check-state pattern
                onSelect={() => { onChange(item.id); setOpen(false); }}
              >
                <span className="truncate">{item.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </Command>
  </PopoverContent>
</Popover>
```
Source: MonkeyCode (AGPL-3.0) — [VERIFIED via grep_app_searchGitHub] — note: they use `shouldFilter={false}` + manual filtering for very large lists; this phase can keep the cmdk built-in filter at 353 rows (UI-SPEC §Interaction Contract), but the `data-checked` + composite-value + `w-(--radix-popover-trigger-width)` patterns are directly applicable.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| shadcn `combobox` registry item was cmdk-based (classic pattern) | v4 `combobox` is **Base UI-based**; the cmdk path is now `command` + custom wrapper | shadcn v4 (2025) | D-21-05's "vendor command + write wrapper" is the ONLY correct path — `npx shadcn add combobox` would install the wrong primitive |
| Classic combobox rendered `<Check>` with manual opacity classes | v4 `CommandItem` auto-renders Check gated on `data-[checked=true]` — consumer sets the attribute | shadcn v4 | Wrapper MUST pass `data-checked` (Pitfall 1) |
| `command-score` default filter | cmdk v1.1.1 still uses `commandScore(value, search, keywords)` with the `keywords` third arg | stable since cmdk 1.0 | Composite `value` (UI-SPEC) works with zero config; `keywords` is the escape hatch if a pure-id value is preferred |

**Deprecated/outdated:**
- `@shadcn/combobox` as the cmdk combobox: it is Base UI-based in v4 — do not install (UI-SPEC §Registry Safety, verified 2026-08-03).
- The CONTEXT.md-corrected research claim that "the Command pattern is already vendored": the explorers' nuqs debounced `Input` is not a Command primitive — cmdk + command.tsx are genuinely new (verified in scout + `ls src/components/ui`).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The shadcn CLI (`npx shadcn@latest add command popover`) resolves `IconPlaceholder` → lucide `Search`/`Check` and rewrites `@/registry/...` paths for this project | Standard Stack / Pitfall 2 | Build breaks with dangling `@/app/(create)` import — mitigated by the mandated post-add grep verification (UI-SPEC §Vendoring) |
| A2 | cmdk's built-in filter performance is acceptable at 353 rows (no virtualization, no `shouldFilter={false}`) | Standard Stack / SET-06 | If typing lag appears, fall back to MonkeyCode's `shouldFilter={false}` + `useDeferredValue` pattern — small change, contained in the wrapper |
| A3 | `getProviderForModelId(catalogJson, id)` returns non-null for every union id (union ids are always servable-scoped) | Architecture Pattern 3 | If null, the page's trim falls back to `'anthropic'` and shows a wrong provider — defensive fallback included; canary test in Phase 22 covers it |
| A4 | The provider-selector initial state = `savedChain[0].providerID ?? 'anthropic'` is correct for the stale-saved-primary edge (providerID null) | Architecture Pattern 2 | If a stale saved primary's provider is unknown, the selector defaults to Anthropic while the stale row renders with a raw-id label — acceptable per UI-SPEC §Row Anatomy |
| A5 | `select.tsx` stays untouched for the provider selector and 4 other consumers; only model slots convert to Comboboxes | D-21-06 | If the plan converts the provider selector too, it violates the UI-SPEC's explicit control choice (2 items, no search needed) |
| A6 | `PROVIDER_DEFAULT_MODELS` import from `modelFactory.ts` into `settings/page.tsx` is acceptable (server component; module-scope `createOpenRouter` runs harmlessly at request time) | Architecture Pattern 3 | If this becomes a concern, re-export the defaults from `catalog.ts` (server-side re-home) — small refactor |

## Open Questions (RESOLVED)

> All three questions were resolved at Phase 21 planning; the plan files implement the recommendations below (RESOLVED markers).

1. **Primary-reset collision with a preserved fallback (Pitfall 6)**
   - What we know: D-21-01 resets the primary to `defaults[next].id` on switch; D-21-02 preserves fallbacks verbatim; a fallback could already hold that id → Save fails `duplicate_model`.
   - What's unclear: whether the client should detect and handle this at switch time (e.g., flag the colliding fallback as needing replacement) or accept the server backstop error copy.
   - Recommendation: accept the existing `ERROR_COPY.duplicate_model` server path (rare edge, existing copy already explains it); optionally add a client-side duplicate hint if UAT shows confusion. Do NOT clear the fallback (violates D-21-02).
   - **— RESOLVED (plans 21-02 + 21-05):** the client prevents the common case — `optionsForSlot(primary, fallbacks, -1, …)` excludes fallback-chosen ids from the primary picker (unit-tested both directions in `model-picker-logic.test.ts`); the residual collision is accepted via the existing `ERROR_COPY.duplicate_model` server backstop. Fallbacks are never cleared (D-21-02) — the form's `handleProviderChange` contains no `setFallbacks` call (gated).

2. **Reset-hint lifecycle**
   - What we know: D-21-01 requires a non-blocking inline hint under the provider selector on reset; no dismissal mechanism is specified.
   - What's unclear: when the hint clears (on next provider switch? on primary edit? on Save? persists?).
   - Recommendation: show the hint after a reset; clear it when the user changes the primary (the reset is then moot) and on Save. Matches "non-blocking, informational" intent (UI-SPEC §Copywriting: `text-slate-600`, never red).
   - **— RESOLVED (plan 21-05 Task 1 D):** the hint renders under the selector when a reset occurred and clears on primary edit and on Save — `text-slate-600`, never red.

3. **Primary picker dedupe against fallbacks**
   - What we know: UI-SPEC §Row Anatomy says dedupe applies "over the 353-id union list — a model chosen for one slot disappears from the other slots' options; the primary is never a fallback option."
   - What's unclear: whether the PRIMARY picker (provider-scoped) must also exclude fallback-chosen models to prevent creating `primary === fallback` on save.
   - Recommendation: yes — exclude fallback-chosen ids from the primary picker options too (prevents the server `duplicate_model` error); include a unit test in `optionsForSlot`-style logic for both directions.
   - **— RESOLVED (plan 21-02 Task 1):** `optionsForSlot` with `slotIndex = -1` (the primary direction) excludes the primary id AND all fallback-chosen ids; the dedupe is unit-tested for both directions in `model-picker-logic.test.ts`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | next build / vitest | ✓ | 22.23.1 | — |
| npm | shadcn CLI installs / lockfile | ✓ | 10.9.8 | — |
| shadcn CLI | `npx shadcn@latest add command popover` | ✓ | 4.16.1 (installed as project dep `shadcn@4.14.0`) | npx resolves latest |
| cmdk | command.tsx primitive | ✗ (NOT installed — verified) | — | installed by `add command` (new this phase) |
| Vitest | `npm test` | ✓ | via devDependencies | — |
| radix-ui (unified) | popover/select/dialog primitives | ✓ | installed | — |
| lucide-react | icons | ✓ | installed | — |

**Missing dependencies with no fallback:**
- `cmdk` — new npm dependency, installed by the shadcn CLI during this phase's first task. Not present today (`node_modules/cmdk` absent, `package.json` has no cmdk).

**Missing dependencies with fallback:** none.

## Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json` — section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (via devDependencies; `test: "vitest run"`) |
| Config file | `vitest.config.ts` — `environment: 'node'`, `include: ['src/**/*.test.ts']`, `@` → `src` alias |
| Quick run command | `npx vitest run src/components/settings/model-picker-logic.test.ts` |
| Full suite command | `npm test` (plus `npm run build` for the RSC/props compile check) |

**Constraint:** There is NO component test infrastructure — no `@testing-library/react`, no jsdom, node environment only, `.test.ts` (not `.tsx`) includes. Components are NOT unit-tested in this repo; pure logic is extracted and tested (the `explorer-format.tsx` + `explorer-format.test.ts` pattern, and `catalog.test.ts`/`settings.test.ts` for server logic). Browser/interaction behavior is verified via UAT (Phase 22's live-browser UAT per ROADMAP).

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SET-01 | Provider options = SERVABLE_PROVIDERS names | unit (page-prop derivation, if extracted) / manual | — | ❌ Wave 0 (optional pure fn) |
| SET-02 | `servableByProvider` per-provider lists (anthropic 1, openrouter 336) | unit | extend `catalog.test.ts` (already covers `getServableIdsForProvider`) | ✅ |
| SET-03 | keep-if-valid → reset-to-default + hint + fallback preservation | unit (pure reducer) | `npx vitest run src/components/settings/model-picker-logic.test.ts` | ❌ Wave 0 |
| SET-04 | union grouping by provider (353 = 336+17), no family subgroups | unit | `model-picker-logic.test.ts` | ❌ Wave 0 |
| SET-05 | `savedChain` provider resolution (dup-name disambiguation input) | unit | extend `catalog.test.ts` (`getProviderForModelId` already covered) | ✅ |
| SET-06 | composite search value = id + name + family (round-trip onSelect → id) | unit | `model-picker-logic.test.ts` | ❌ Wave 0 |
| SET-07 | suffix labels: `~` → "always the latest", `:free` → "free tier — 50 req/day shared", no overlap | unit | `model-picker-logic.test.ts` | ❌ Wave 0 |
| SET-08 | union staleIds (dropped id blocked; `''` not stale); high-cost ≥ $50 (o1-pro $150 trips, cheap rows don't) | unit | `model-picker-logic.test.ts` | ❌ Wave 0 |
| (existing) | saveSettingsAction union validation, dedupe backstop, security order | unit | `npm test` — `src/app/actions/settings.test.ts` | ✅ (unchanged) |
| (existing) | catalog union/identity functions | unit | `npm test` — `src/lib/models/catalog.test.ts` | ✅ (unchanged) |

### Sampling Rate
- **Per task commit:** targeted file run, e.g. `npx vitest run src/components/settings/model-picker-logic.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** `npm test` + `npm run build` green (build catches the vendored-file dangling-import pitfall + RSC boundary issues) before `/gsd-verify-work`; interactive picker behavior (search, badges, switch hint, saved-chain recap) verified via conversational UAT.

### Wave 0 Gaps
- [ ] `src/components/settings/model-picker-logic.ts` — the client-safe pure module (search composite, suffix label, high-cost, reset reducer, union staleIds, grouping, dedupe) that makes SET-03/04/06/07/08 unit-testable
- [ ] `src/components/settings/model-picker-logic.test.ts` — the Vitest suite for the above (fixtures inline, decoupled from `catalog.json` per the `catalog.test.ts` convention)
- [ ] No framework install needed — pure functions run under the existing node-env Vitest
- [ ] Manual/UAT coverage note: provider-selector placement, badges, trigger labels, search UX, saved-chain recap are visual/interaction — Phase 22's live-browser UAT owns them (ROADMAP §Phase 22)

## Security Domain

> `security_enforcement` is enabled (absent = enabled) in `.planning/config.json`.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (unchanged) | Clerk sessions — no auth code touched this phase |
| V3 Session Management | no (unchanged) | Clerk `__session` — no session code touched |
| V4 Access Control | yes | `requireStaffAccess()` FIRST in `saveSettingsAction` (immutable order, already shipped) + page-level gate in `settings/page.tsx` — this phase adds no new entry points |
| V5 Input Validation | yes | zod `settingsInputSchema` in the action (unchanged); client gates are UX, never security |
| V6 Cryptography | no | No keys/crypto touched — `OPENROUTER_API_KEY` remains server-only (Phase 19/20 declaration) |

### Known Threat Patterns for {Next.js App Router + shadcn/cmdk}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Server data leak into client bundles (catalog.json 1131 rows incl. costs) | Information Disclosure | Props-only contract (T-17-09): `settings/page.tsx` trims to `{id, name, family, providerID, costInput, costOutput}`; `catalog.ts` is never imported by a client component (type-only imports erased at compile); Phase 22 security-matrix grep asserts `OPENROUTER` absent from client components |
| Malicious registry/package supply chain | Tampering | `registries: {}` in components.json (official shadcn only); registry `view` passed pre-approval (UI-SPEC §Registry Safety 2026-08-03); cmdk slopcheck `[OK]`, MIT, official repo, no postinstall |
| Injection via model-id values in pickers | Tampering | Ids render as text children (React escapes); ids are validated server-side against the union set before persist; no HTML/URL construction from ids |
| Submit bypass of client staleness gate | Tampering | Server `invalid_model` backstop + dedupe backstop + requireStaffAccess in the action — the client gate is UX, not security (existing architecture, unchanged) |

**New attack surface this phase:** minimal — no new server routes, no new Server Actions, no new env vars, no new data writes. The cmdk vendored file was verified clean (no fetch/process.env/eval/dynamic imports — UI-SPEC §Registry Safety view 2026-08-03).

## Sources

### Primary (HIGH confidence)
- [Context7 /dip/cmdk] — controlled `value`/`onValueChange`, `filter(value, search, keywords)`, `shouldFilter`, CommandItem `value`/`keywords`; README examples
- [Context7 /websites/ui_shadcn] — Command component structure, installation, Base-UI Combobox docs (confirms the `@shadcn/combobox` rejection)
- [ui.shadcn.com registry JSON — radix-nova command.json] — full vendored command.tsx source (IconPlaceholder, InputGroup, data-checked Check icon, max-h-72, group-heading style)
- [github.com/pacocoursey/cmdk — cmdk/src/index.tsx] — Item sets only data-selected/aria-selected/data-disabled (never data-checked); SSR-safe useLayoutEffect guard; keyboard handling
- [ui.shadcn.com registry JSON — radix-nova popover.json, input-group.json] — deps + transitive textarea
- [npm registry — cmdk] — 1.1.1 latest, peer react ^18\|\|^19, MIT, no postinstall, repo github.com/pacocoursey/cmdk
- [grep.app] — real-world combobox implementations (Supabase combobox-demo, shadcnblocks/kibo grouped patterns, MonkeyCode provider-model-combobox, nakama, foliofox, coollabsio) — all confirm `data-checked={value === id}` consumer pattern
- Codebase: `model-settings-form.tsx`, `settings/page.tsx`, `settings.ts` + `settings.test.ts`, `catalog.ts` + `catalog.test.ts`, `modelFactory.ts`, `userModelSettings.ts`, `select.tsx`, `components.json`, `vitest.config.ts`

### Secondary (MEDIUM confidence)
- [Context7 /shadcn-ui/ui] — shadcn CLI component-install workflow (cross-checked with installed CLI 4.16.1)

### Tertiary (LOW confidence)
- None — all claims verified against source, registry, or official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — cmdk verified via Context7 + shadcn registry + npm + slopcheck; vendored-file structure read from the actual registry JSON
- Architecture: HIGH — props contract fully specified in the approved UI-SPEC + existing code read in full; the wrapper pattern is the verified canonical combobox
- Pitfalls: HIGH for data-checked (verified in cmdk source + 6 real-world impls) and provider-scoped lookup (verified in catalog.ts comments + test fixture); MEDIUM for the vendoring/IconPlaceholder and popover-width items (single-source, standard CLI behavior)

**Research date:** 2026-08-03
**Valid until:** 2026-08-10 (7 days — shadcn v4 registry and cmdk are fast-moving; the vendored-file structure and CLI behavior were verified today)
