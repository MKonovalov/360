# Phase 21: Settings UI - Pattern Map

**Mapped:** 2026-08-03
**Files analyzed:** 9 (2 modified, 3 new written, 4 new vendored via shadcn CLI)
**Analogs found:** 9 / 9

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/components/ui/command.tsx` (NEW, vendored) | component (UI primitive) | request-response | `src/components/ui/select.tsx` | exact (same shadcn v4 radix-nova vendored style) |
| `src/components/ui/popover.tsx` (NEW, vendored) | component (UI primitive) | request-response | `src/components/ui/select.tsx` / `dialog.tsx` | exact |
| `src/components/ui/input-group.tsx` (NEW, vendored auto-dep) | component (UI primitive) | request-response | `src/components/ui/input.tsx` | exact |
| `src/components/ui/textarea.tsx` (NEW, vendored transitive) | component (UI primitive) | request-response | `src/components/ui/input.tsx` | exact |
| `src/components/settings/model-picker.tsx` (NEW, written) | component (Combobox wrapper) | request-response | `src/components/ui/select.tsx` (structure) + Select usage in `model-settings-form.tsx:141-160,217-258` (contract) | role-match (new pattern — no in-repo Combobox exists) |
| `src/components/settings/model-picker-logic.ts` (NEW, written) | utility (pure client-safe helpers) | transform | `src/components/explorer/explorer-format.tsx` | exact |
| `src/components/settings/model-picker-logic.test.ts` (NEW, written) | test | — | `src/lib/models/catalog.test.ts` (inline fixture) + `explorer-format.test.ts` (Given/When/Then) | exact |
| `src/app/(dashboard)/settings/page.tsx` (MODIFIED) | page (server component) | request-response | itself — `page.tsx:14-77` (widen in place) | exact (self-analog) |
| `src/components/settings/model-settings-form.tsx` (MODIFIED) | component (client form) | request-response | itself — `model-settings-form.tsx:1-322` (extend in place) | exact (self-analog) |

**Unchanged but must-read analogs** (shared-pattern sources, not classified as modified): `src/lib/models/catalog.ts`, `src/lib/agents/modelFactory.ts`, `src/lib/db/queries/userModelSettings.ts`, `src/app/actions/settings.ts`, `src/components/ui/badge.tsx`, `src/lib/utils.ts`, `src/components/explorer/explorer-format.tsx`.

---

## Pattern Assignments

### `src/components/ui/command.tsx` (component, request-response — NEW, VENDORED)

**Analog:** `src/components/ui/select.tsx` (the vendored-primitive house style) + `src/components/ui/badge.tsx` (cva variant pattern).

**Vendoring contract — NOT hand-written.** Run `npx shadcn@latest add command popover` (installs `cmdk@^1.1.1` + `command.tsx` + `popover.tsx` + auto-deps `input-group.tsx`/`textarea.tsx`). Post-add verification is MANDATORY (UI-SPEC §Vendoring / RESEARCH Pitfall 2): grep `command.tsx` for `@/app/(create)` and `@/registry` — must be **zero**; the CLI resolves the registry's `IconPlaceholder` to lucide `Search`/`Check` imports. Do NOT install `@shadcn/combobox` (Base UI-based — contradicts D-21-05).

**Vendored-file structure to verify against** (`select.tsx:1-13` — every vendored primitive follows this shape):
```tsx
"use client"

import * as React from "react"
import { Select as SelectPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { ChevronDownIcon, CheckIcon, ChevronUpIcon } from "lucide-react"

function Select({ ...props }: React.ComponentProps<typeof SelectPrimitive.Root>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />
}
```
Conventions to confirm survived vendoring (house rules per CLAUDE.md §Conventions): `data-slot` attributes, `cn()` for class merge, double quotes are fine for vendored files (they match `select.tsx`'s own style — do not re-quote), `@/lib/utils` alias import, named exports only.

**The #1 silent-failure point — `data-checked` (RESEARCH Pitfall 1):** the vendored v4 `CommandItem` auto-renders its Check icon gated on `group-data-[checked=true]/command-item:opacity-100`, but cmdk 1.1.1 only sets `data-selected`/`aria-selected`/`data-disabled` — **never `data-checked`**. The wrapper (`model-picker.tsx`) MUST pass `data-checked={value === m.id}` per row. This is not a pattern in the vendored file itself; it is a why-comment to add at the wrapper call site.

### `src/components/ui/popover.tsx`, `input-group.tsx`, `textarea.tsx` (component — NEW, VENDORED)

Same analog and vendoring contract as `command.tsx`. `popover.tsx` builds on the already-present `radix-ui` unified package (same import style as `select.tsx:4`); `input-group.tsx`/`textarea.tsx` are auto-registry-dependencies of `command` (do not `add` them manually). No hand-editing beyond the post-add verification grep.

### `src/components/settings/model-picker.tsx` (component — NEW, WRITTEN)

**Analog:** `src/components/ui/select.tsx` for the wrapper structure + the Select usage inside `model-settings-form.tsx` for the consumer contract (ids/aria-labels). The Combobox anatomy itself is the canonical shadcn pattern (RESEARCH Pattern 1 — verified identical across Supabase/Shadcnblocks/MonkeyCode).

**Imports pattern** (follow the form's house style — `model-settings-form.tsx:1-14`):
```tsx
'use client';

import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
```
(Single quotes + semicolons per house style for the written wrapper — only the vendored files keep double quotes.)

**Core Combobox pattern** (RESEARCH Pattern 1 — the wrapper's skeleton; `data-checked` line is the critical why-comment):
```tsx
export function ModelPicker({
  id, options, value, onChange, placeholder, badge, ariaLabel,
}: {
  id: string;
  options: ServableModel[];   // type-only import — no catalog.ts value import (T-17-09)
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
  badge?: ModelProviderId;    // trigger badge — primary + closed state (D-21-10)
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open}
          id={id} aria-label={ariaLabel}
          className="w-full justify-between font-normal">
          <span className="truncate text-left">
            {badge ? <Badge variant="secondary" className="mr-1.5">{badge === 'anthropic' ? 'Anthropic' : 'OpenRouter'}</Badge> : null}
            {value ? options.find((m) => m.id === value)?.name ?? value : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0">
        <Command>
          <CommandInput placeholder="Search models…" autoFocus />
          <CommandList>
            <CommandEmpty>No models found.</CommandEmpty>
            {/* provider CommandGroups here for union fallback pickers (D-21-08) */}
            <CommandItem
              key={m.id}
              value={searchValue(m)}            // D-21-07 composite — see model-picker-logic
              data-checked={value === m.id}     // ⚠ cmdk does NOT set data-checked — v4 Check icon gate
              onSelect={(v) => {
                onChange(options.find((o) => searchValue(o) === v)?.id ?? '');
                setOpen(false);
              }}
            >
              {/* row anatomy: [Badge]? name {suffixLabel}? · cost — family line 2 (UI-SPEC §Row Anatomy) */}
            </CommandItem>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

**Key contracts to replicate from the form:**
- Accessible names: `id="primary-model"` / `id="fallback-1"` / `id="fallback-2"` (`model-settings-form.tsx:142,184,227`) — the wrapper takes `id` + `ariaLabel` as props.
- **Popover width:** `w-(--radix-popover-trigger-width) p-0` (v4 syntax) so the 336-row dropdown matches the trigger (RESEARCH Pitfall 5).
- **Composite round-trip (RESEARCH Pitfall 3):** `onSelect` receives the composite `[id, name, family]` string, not the id — reverse-lookup to the id before `onChange`, or the draft stores the composite and Save fails `invalid_model`.

### `src/components/settings/model-picker-logic.ts` (utility, transform — NEW, WRITTEN)

**Analog:** `src/components/explorer/explorer-format.tsx` — the pure client-safe helpers module. It is the established pattern for "logic extracted out of components so it is unit-testable in the node-env Vitest" (RESEARCH §Validation Architecture: no component test infra exists; pure logic is tested).

**Module shape to replicate** (`explorer-format.tsx:11-23` — named exports, why-comment header, zero imports from catalog):
```tsx
// Shared formatting helpers for entity list/detail views (companies +
// personas). Previously duplicated verbatim across ... — the same drift risk
// the project already closed once for parseCompanyFilters/parsePersonaFilters ...
export function humanizeEnum(value: string | null): string {
  if (!value) return '—';
  return value.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export const dateFormatter = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
```

**`model-picker-logic.ts` specifics (RESEARCH Pattern 2 — all pure, all D-locked, no `catalog.json` import; type-only `import type { ModelProviderId } from '@/lib/models/catalog'` is fine — erased at compile):**

```ts
// D-21-07: search index = id + display name + family, lowercased
export function searchValue(m: { id: string; name: string; family: string }): string {
  return [m.id, m.name, m.family].filter(Boolean).join(' ').toLowerCase();
}

// D-21-12: suffix labels derived from the id — id is the source of truth
export function suffixLabel(id: string): string | null {
  if (id.startsWith('~')) return 'always the latest';               // drift caveat (FAL-05)
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
export function groupByProvider(models: ServableModel[]): Record<ModelProviderId, ServableModel[]> { /* ... */ }
export function optionsForSlot(
  primary: string, fallbacks: string[], slotIndex: number, union: ServableModel[],
): ServableModel[] {
  return union.filter((m) =>
    m.id !== primary && !fallbacks.some((f, j) => j !== slotIndex && f === m.id));
}
```

**Type shape to define here (the `ServableModel` prop type, extended from today's `{id, name, costInput, costOutput}`):** `{ id, name, family, providerID: ModelProviderId, costInput, costOutput }` (UI-SPEC §Props & Data Contract).

### `src/components/settings/model-picker-logic.test.ts` (test — NEW, WRITTEN)

**Analog:** `src/lib/models/catalog.test.ts` — the house pure-function test style (inline fixture decoupled from the committed snapshot + snapshot canary tests + Given/When/Then comments) and `src/components/explorer/explorer-format.test.ts` (Given/When/Then block comments).

**Fixture + test structure to replicate** (`catalog.test.ts:22-37,105-121`):
```ts
import { describe, expect, it } from 'vitest';
// ... import the pure functions under test

// The fixture is inline and deliberately decoupled from the committed
// catalog.json — these tests pin the semantics, not a snapshot that drifts
// on refresh (catalog.test.ts:16-18 convention).
const fixture: ServableModel[] = [
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', family: 'claude-sonnet',
    providerID: 'anthropic', costInput: 3, costOutput: 15 },
  { id: 'anthropic/claude-sonnet-4.6', name: 'Claude Sonnet 4.6', family: 'claude-sonnet',
    providerID: 'openrouter', costInput: 3, costOutput: 15 },
  { id: 'openai/o1-pro', name: 'OpenAI o1 Pro', family: 'o1', providerID: 'openrouter',
    costInput: 150, costOutput: 600 },
  { id: '~openai/gpt-5', name: 'GPT-5 (latest)', family: 'gpt-5', providerID: 'openrouter',
    costInput: 1.25, costOutput: 10 },
  { id: 'openai/gpt-oss-20b:free', name: 'GPT-OSS 20B (free)', family: 'gpt-oss',
    providerID: 'openrouter', costInput: 0, costOutput: 0 },
];

describe('primaryAfterProviderSwitch (SET-03)', () => {
  it('keeps a valid primary when it is in the new provider servable list (keep-if-valid)', () => {
    // Given / When
    const result = primaryAfterProviderSwitch('claude-sonnet-4-6', 'anthropic', servableByProvider, defaults);
    // Then
    expect(result).toEqual({ primary: 'claude-sonnet-4-6', resetToDefault: false });
  });
  // ... reset-to-default case, fallback-preservation is a form-state concern (not here)
});
```

**Tests required per RESEARCH §Phase Requirements → Test Map (Wave 0):** SET-03 keep-if-valid→reset; SET-04 `groupByProvider` (353 = 336+17, no family subgroups); SET-06 composite search round-trip; SET-07 suffix labels (`~`/`:free`, no overlap); SET-08 union `staleIds` (`''` not stale) + `isHighCost` (o1-pro $150 trips, cheap rows don't). Run: `npx vitest run src/components/settings/model-picker-logic.test.ts` (node env, `.test.ts` only — `vitest.config.ts:10-13`).

### `src/app/(dashboard)/settings/page.tsx` (page — MODIFIED)

**Analog:** itself — the widening follows the existing block's own established patterns (`page.tsx:14-77`).

**Patterns to preserve verbatim:**
- **Auth gate** (`page.tsx:15`): `const { userId } = await requireStaffAccess();` — belt-and-suspenders alongside the `(dashboard)` layout gate.
- **Fail-safe fetch** (`page.tsx:21-35`): `try { settings = await getModelSettingsForUser(userId); } catch { return <per-widget error card>; }` — never Next.js's default 500; absence is data (`undefined` = default chain, REG-05), not an error.
- **Props-only contract comment** (`page.tsx:37-45`): the client receives props only, so `catalog.json` (1131 rows) never enters a client bundle (T-17-09).
- **Provider-scoped lookup — Anti-Pattern 1** (`page.tsx:48`):
```tsx
const m = catalogJson.models.find((mm) => mm.id === id && mm.providerID === 'anthropic');
```
The widening MUST keep this scoped find in its `trimRow` (RESEARCH Pattern 3) — a bare `find(m => m.id === id)` returns the opencode/vercel dual row (sorts first) with wrong cost/family/provider (RESEARCH Pitfall 4).

**Widening contract (RESEARCH Pattern 3 — new props):**
```tsx
const trimRow = (id: string, provider: ModelProviderId) => {
  const m = catalogJson.models.find((mm) => mm.id === id && mm.providerID === provider);
  return { id, name: m?.name ?? getModelDisplayName(id), family: m?.family ?? '',
           providerID: provider, costInput: m?.cost?.input ?? 0, costOutput: m?.cost?.output ?? 0 };
};
const servableByProvider = Object.fromEntries(
  SERVABLE_PROVIDERS.map((p) => [p, getServableIdsForProvider(catalogJson, p).map((id) => trimRow(id, p))]),
) as Record<ModelProviderId, ServableModel[]>;
const unionServableModels = getUnionServableIds(catalogJson).map((id) =>
  trimRow(id, getProviderForModelId(catalogJson, id) ?? 'anthropic'));
const defaults = Object.fromEntries(SERVABLE_PROVIDERS.map((p) =>
  [p, { id: PROVIDER_DEFAULT_MODELS[p], name: getModelDisplayName(PROVIDER_DEFAULT_MODELS[p]) }]));
const providers = SERVABLE_PROVIDERS.map((id) =>
  ({ id, name: id === 'anthropic' ? 'Anthropic' : 'OpenRouter' }));
const savedChain = settings
  ? [settings.primaryModel, ...settings.fallbackModels].map((id) => ({
      id, name: getModelDisplayName(id), providerID: getProviderForModelId(catalogJson, id),
    }))
  : null;
```
New imports: add `getUnionServableIds`, `getProviderForModelId`, `SERVABLE_PROVIDERS`, `ModelProviderId` to the existing `catalog.ts` import (`page.tsx:3`) and `PROVIDER_DEFAULT_MODELS` from `@/lib/agents/modelFactory` (server component; module-scope `createOpenRouter` runs harmlessly at request time — RESEARCH Assumption A6). **Do NOT import `catalog.ts` into any client component** — type-only `ModelProviderId` imports are fine.

### `src/components/settings/model-settings-form.tsx` (component — MODIFIED)

**Analog:** itself — extended in place, never rewritten (CONTEXT.md: "all extended, not rewritten").

**Patterns to preserve verbatim:**
- **Draft staging** (`model-settings-form.tsx:42-49`): `useState` for `primary`/`fallbacks` mirroring `saved` at mount; empty-state prefill = `defaultPrimary.id`; nothing persists until Save (D-07).
- **Client staleness gate** (`model-settings-form.tsx:51-61`) — D-21-14 widens `servableIds` from the anthropic-only `servableModels` prop to the union set (new `unionServableModels` prop → `unionIds`):
```tsx
const staleIds = [primary, ...fallbacks].filter((id) => id && !unionIds.includes(id));
const saveDisabled = isPending || staleIds.length > 0;
```
Keep the why-comment: staleness derives from the CURRENT DRAFT, never the immutable `saved` props (a saved-stale id would block Save forever); `''` is an in-progress row, not stale (D-10/D-11).
- **ERROR_COPY map** (`model-settings-form.tsx:22-26`) — unchanged; the action emits no new reasons this phase. Exact three keys + apostrophe-forced double quotes:
```tsx
const ERROR_COPY: Record<string, string> = {
  action_failed: "Couldn't save your changes. Please try again.",
  invalid_model: 'This model is no longer available.',
  duplicate_model: 'Each model can only be used once.',
};
```
- **Save flow** (`model-settings-form.tsx:63-82`): `useTransition`, drop unfilled fallback rows (`fallbacks.filter((id) => id !== '')`) before submit, `ERROR_COPY[result.reason] ?? ERROR_COPY.action_failed`, and **D-13: draft preserved verbatim on failure — never reset the useState**.
- **D-08/D-09 client dedupe** (`model-settings-form.tsx:234-237`): `servableIds.filter((id) => id !== primary && !fallbacks.some((f, j) => f === id && j !== i))` — replace `servableIds` with the union + `optionsForSlot` from the logic module; the primary picker must ALSO exclude fallback-chosen ids (RESEARCH Open Question 3).
- **Stale-row rendering + red hint** (`model-settings-form.tsx:154-165, 252-256, 286-290`): stale id renders as a disabled item + `text-[14px] font-normal leading-[1.5] text-red-600` hint; remove is the only exit in the sonnet-only branch.
- **D-03 cost caption** (`model-settings-form.tsx:106-110`): `optionLabel` = `` `${m.name} · $${m.costInput} / $${m.costOutput} per MTok` `` with raw-id fallback for catalog-absent ids; row cost captions render in `text-[12px] font-normal leading-[1.4] text-slate-500` — high-cost rows switch to `text-amber-700` (D-21-13, UI-SPEC §Color).

**New additions this phase (pattern sources in parens):** provider state `useState<ModelProviderId>` + shadcn `Select` above the Primary label (D-21-03; selector stays `Select` per D-21-06); `handleProviderChange` calling `primaryAfterProviderSwitch` + non-blocking hint `text-[14px] font-normal leading-[1.5] text-slate-600` (D-21-01; hint clears on primary edit/Save — RESEARCH Open Question 2); `ModelPicker` replacing `Select` for all model slots (D-21-06); `Badge variant="secondary"` on picker rows (union fallback pickers only — primary is provider-scoped, badges are noise) and on saved-chain recap entries `Saved chain: {badge} {name} → …` (D-21-10, UI-SPEC §Copywriting); `suffixLabel`/`isHighCost`/`groupByProvider` from the logic module (D-21-07/12/13); `dateFormatter` caption unchanged (`model-settings-form.tsx:317-319`).

---

## Shared Patterns

### `cn()` + `data-slot` vendored-primitive style
**Source:** `src/components/ui/select.tsx:1-13`, `src/components/ui/badge.tsx:1-49`
**Apply to:** All vendored files (`command.tsx`, `popover.tsx`, `input-group.tsx`, `textarea.tsx`) — generated by the CLI; verify, don't rewrite. The written wrapper imports `cn` the same way: `import { cn } from '@/lib/utils'` (`src/lib/utils.ts:4-6` — `clsx` + `tailwind-merge`).

### `"use client"` + named exports + no default exports
**Source:** `model-settings-form.tsx:1`, `select.tsx:1`, `explorer-format.tsx` (all named exports), CLAUDE.md §Conventions
**Apply to:** `model-picker.tsx`, `model-picker-logic.ts`. Single quotes + semicolons + 2-space indent for all WRITTEN files (only vendored files keep double quotes).

### Props-only server→client data flow (T-17-09)
**Source:** `page.tsx:37-45` + `model-settings-form.tsx:31-41` (typed props destructure)
**Apply to:** `page.tsx` (widen) + `model-settings-form.tsx` (consume). `catalog.json` never enters a client bundle; only trimmed `{id, name, family, providerID, costInput, costOutput}` shapes cross the boundary; type-only imports of `ModelProviderId` are erased at compile.

### Provider-scoped row lookup (Anti-Pattern 1)
**Source:** `catalog.ts:78-89` (`getProviderForModelId`), `page.tsx:48`, `modelFactory.ts:42-49`
**Apply to:** Every `catalogJson.models.find` in `page.tsx`'s widened `trimRow` — always `m.id === id && m.providerID === <provider>`. The snapshot dual-lists ids (claude-sonnet-5 as opencode AND anthropic; anthropic/claude-sonnet-5 as openrouter AND vercel); a bare find reads the opencode/vercel gateway row (sorts first) → wrong cost/family/provider.

### cmdk `data-checked` check-state (NEW shared pattern)
**Source:** RESEARCH Pitfall 1 (verified against cmdk 1.1.1 source + 6 real-world impls) — no in-repo analog exists
**Apply to:** Every `CommandItem` in `model-picker.tsx`. cmdk sets only `data-selected`/`aria-selected`/`data-disabled`; the vendored v4 Check icon is gated on `data-[checked=true]`. Pass `data-checked={value === m.id}` per row. Add a why-comment.

### Draft-staging + failure preservation (D-07/D-13)
**Source:** `model-settings-form.tsx:42-49,63-82`
**Apply to:** The form's new provider state + reset logic. All edits stage in local state; the provider-switch reset is draft-only (D-21-01); failures never reset the useState.

### Server Action immutable order (UNCHANGED — read-only contract)
**Source:** `src/app/actions/settings.ts:34-68` — `requireStaffAccess()` FIRST → zod `settingsInputSchema.safeParse` → union servable check (`getUnionServableIds`) → D-08/D-09 dedupe backstop → `upsertModelSettings` atomic upsert keyed by session userId → `revalidatePath('/settings')`. Errors map to `{ ok: false, reason: 'invalid_model' | 'duplicate_model' | 'action_failed' }` — the three keys in the form's `ERROR_COPY`. **No changes this phase** (already union-validating since Phase 19); the form's submit contract stays `{ primaryModel, fallbacks }`.

### Fail-safe error handling
**Source:** `page.tsx:21-35` (per-widget error card), `model-settings-form.tsx:76-81` (ERROR_COPY + draft preserved)
**Apply to:** `page.tsx` widening + the form. External-call failures degrade to known-good UI, never a 500 or unhandled rejection (CLAUDE.md §Error Handling).

### Why-comments (house style)
**Source:** `catalog.ts:6-12,78-83`, `model-settings-form.tsx:42-44,53-59,174-178`, `modelFactory.ts:19-23`
**Apply to:** All written files. Required why-comments this phase: `data-checked` (cmdk doesn't emit it), provider-scoped lookup (Anti-Pattern 1), fallback preservation on switch (D-21-02), staleness-from-draft (never from `saved` props). No JSDoc.

### Vitest conventions
**Source:** `vitest.config.ts` (node env, `src/**/*.test.ts`), `catalog.test.ts` (inline fixture + snapshot canaries), `explorer-format.test.ts` (Given/When/Then)
**Apply to:** `model-picker-logic.test.ts`. Pure functions only (no component tests — no testing-library/jsdom in the repo); fixtures inline and decoupled from `catalog.json`; Given/When/Then comments; `describe`/`it`/`expect` from `vitest`.

### Provider badge styling (D-21-09)
**Source:** `src/components/ui/badge.tsx:15-16` (`variant: "secondary"` = `bg-secondary text-secondary-foreground`, neutral slate pill ~15:1) — already vendored, unchanged
**Apply to:** Picker rows (union fallback pickers only) + trigger badges + saved-chain recap entries. Text `Anthropic` / `OpenRouter`, never color-coded.

---

## No Analog Found

None — all 9 in-scope files have in-repo analogs or self-analogs. The only genuinely novel constructs are the cmdk `data-checked` check-state and the Combobox wrapper anatomy; both are fully specified in RESEARCH.md Pattern 1 + Pitfall 1 with external verified sources (Supabase combobox-demo, MonkeyCode provider-model-combobox), and the vendored files come from the official shadcn registry (UI-SPEC §Registry Safety).

## Metadata

**Analog search scope:** `src/components/settings/`, `src/components/explorer/`, `src/components/ui/`, `src/app/(dashboard)/settings/`, `src/app/actions/`, `src/lib/models/`, `src/lib/agents/`, `src/lib/db/queries/`, `src/lib/utils.ts`, `vitest.config.ts`, `components.json`
**Files scanned:** 14 (9 in-scope + 5 supporting analogs: `catalog.ts`, `modelFactory.ts`, `userModelSettings.ts`, `settings.ts`, `settings.test.ts`, `badge.tsx`, `utils.ts` — 7 supporting)
**Pattern extraction date:** 2026-08-03
