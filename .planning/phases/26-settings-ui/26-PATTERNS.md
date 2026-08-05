# Phase 26: Settings UI - Pattern Map

**Mapped:** 2026-08-04
**Files analyzed:** 4 (all extensions of existing files — no new files this phase)
**Analogs found:** 4 / 4 (self-analog: each file's own current code + its own Phase 21 precedent lines are the pattern source)

## Note on analog methodology

Per orchestrator scope note, this phase is a **targeted extension** of 4 existing files, not new-file creation. There is no "different file to copy from" — the closest analog for each extension point is **the same file's existing sibling pattern one field/branch over** (e.g. the fallback-picker badge already does what the primary-picker badge needs to do). RESEARCH.md already did the deep source reads; this document re-verifies exact current line numbers (files may have drifted slightly from RESEARCH.md's line citations) and packages them as copy-ready excerpts.

## File Classification

| File to Modify | Role | Data Flow | Pattern Source (self-analog) | Match Quality |
|---|---|---|---|---|
| `src/app/(dashboard)/settings/page.tsx` | server component (data-trim boundary) | request-response (server render, props-out) | itself — `trimRow` (lines 56-66) | exact (extend existing function) |
| `src/components/settings/model-picker-logic.ts` | utility (pure decision logic) | transform (pure fn, no I/O) | itself — `suffixLabel`/`searchValue`/`PROVIDER_NAMES` (lines 46-57, 31-36) | exact (extend existing module, add sibling functions) |
| `src/components/settings/model-picker.tsx` | component (client picker) | request-response (props-in, render) | itself — suffix-label caption slot (lines 172-174) + grouped badge (lines 166-170) | exact (extend existing caption/badge rendering) |
| `src/components/settings/model-settings-form.tsx` | component (client form/state) | CRUD (draft state → save action) | itself — fallback trigger badge (line 308) is the analog for fixing the primary trigger badge (line 258); saved-chain recap (lines 373-383) is the analog for adding the endpoint caption | exact (one badge site is already correct — copy its shape to fix the other) |
| `src/components/settings/model-picker-logic.test.ts` | test | transform (pure fn assertions) | itself — existing `describe` blocks per function | exact (add new `describe` blocks in the same style) |

No files have zero analog — every extension point has an existing sibling doing the same shape of work elsewhere in the same file or an adjacent file in the same directory.

## Pattern Assignments

### `src/components/settings/model-picker-logic.ts` (utility, transform) — SET-03/04/05

**Analog:** itself (extend in place)

**Current `ServableModel` type** (lines 15-22):
```typescript
export type ServableModel = {
  id: string;
  name: string;
  family: string;
  providerID: ModelProviderId;
  costInput: number;
  costOutput: number;
};
```
Add `endpoint: 'zen' | 'go' | null` per RESEARCH.md Pattern 1/Code Examples — the field is server-derived, threaded as plain prop data (T-17-09 discipline already documented in the file's header comment, lines 7-11).

**`suffixLabel` pattern to mirror for `endpointLabel`/Hermes caption fn** (lines 50-57):
```typescript
// D-21-12: suffix labels derived from the id — id is the source of truth. Check
// order is locked: startsWith('~') wins over endsWith(':free') — verified 11
// `~latest` + 14 `:free` rows with zero overlap, so the null case is the else.
export function suffixLabel(id: string): string | null {
  if (id.startsWith('~')) return 'always the latest'; // drift caveat (FAL-05)
  if (id.endsWith(':free')) return 'free tier — 50 req/day shared'; // fail-loud shared quota
  return null;
}
```
New `endpointLabel(endpoint)` and a Hermes-capability caption fn should follow this exact shape: pure function, single input, string-or-null return, comment citing the decision id (D-26-01/04) and the verified row-count fact backing the branch (matches this file's established comment density/tone per CLAUDE.md's Comments convention).

**`searchValue` pattern to extend for D-26-03** (lines 42-48):
```typescript
// D-21-07: search index = id + display name + family, lowercased. filter(Boolean)
// drops empty family (22/336 openrouter rows lack family) and empty name. The id
// is FIRST so composites are unique per row — the onSelect reverse-lookup
// (Pitfall 3) can never collide: ids are unique per servable row.
export function searchValue(m: { id: string; name: string; family: string }): string {
  return [m.id, m.name, m.family].filter(Boolean).join(' ').toLowerCase();
}
```
Extend the array/param shape to accept the optional `endpoint` field and append it (lowercase raw `'zen'`/`'go'`, not the capitalized label) — same `filter(Boolean).join(' ')` composition. **Caution:** `searchValue` is also called with synthetic `{ id, name: pin.name, family: '' }` objects at `model-picker.tsx:124` and `:202` — widening its param type must keep those call sites valid (optional field, not required).

**`PROVIDER_NAMES` — already 4-entry, reuse as-is** (lines 31-36):
```typescript
export const PROVIDER_NAMES: Record<ModelProviderId, string> = {
  anthropic: 'Anthropic',
  openrouter: 'OpenRouter',
  nousresearch: 'NousResearch',
  opencode: 'OpenCode',
};
```
No change needed — D-26-06/07 (provider-only badges, uniform variant) are already satisfied by this map + the `secondary` badge variant. Do not add an endpoint-aware variant of this map.

---

### `src/app/(dashboard)/settings/page.tsx` (server component, request-response) — SET-03 endpoint derivation

**Analog:** itself — `trimRow` (lines 56-66)

```typescript
const trimRow = (id: string, provider: ModelProviderId): ServableModel => {
  const m = dedupeProviderRows(catalogJson, provider).find((mm) => mm.id === id);
  return {
    id,
    name: m?.name ?? getModelDisplayName(id),
    family: m?.family ?? '',
    providerID: provider,
    costInput: m?.cost?.input ?? 0,
    costOutput: m?.cost?.output ?? 0,
  };
};
```
Per RESEARCH.md Pitfall 1 (CONTEXT.md's `settings.ts` reference is a documentation error — the real trim function is HERE), add the `endpoint` field to this return object, derived from `m?.providerID` (`'opencode-go'` → `'go'`, else for `provider === 'opencode'` → `'zen'`, else `null`). This single change point flows into BOTH call sites automatically — `servableByProvider` (line 69-74) and `unionServableModels` (line 83-85) — since both call the same shared `trimRow`. This satisfies "endpoint captions in both primary and union fallback pickers" (SET-03) with one edit, matching this file's existing "one shared trim function, two call sites" architecture (already true for every other field — no new pattern needed, just widen the existing return shape).

**Existing comment-density convention to match** (lines 43-55, 68, 76-82, 87-88, 96-101): every derived-props block carries a comment citing the requirement id (`SET-02`, `SET-04`, `D-07`) and a verified row-count fact. New endpoint-derivation code should follow the same convention — cite `SET-03` and the verified 34-zen/6-go-of-40 split (per RESEARCH.md Pattern 1).

---

### `src/components/settings/model-picker.tsx` (component, request-response) — SET-03/04 caption composition, D-26-06 badges

**Analog:** itself — suffix caption slot + grouped badge, adjacent in the same `CommandItem` render (lines 164-192)

```typescript
<div className="flex min-w-0 flex-1 flex-col">
  <span>
    {grouped ? (
      <Badge variant="secondary" className="mr-1.5">
        {providerName(m.providerID)}
      </Badge>
    ) : null}
    {m.name}
    {suffixLabel(m.id) ? (
      <span className="text-[12px] font-normal leading-[1.4] text-slate-500"> {suffixLabel(m.id)}</span>
    ) : null}
    <span
      className={cn(
        'text-[12px] font-normal leading-[1.4]',
        isHighCost(m.costInput) ? 'text-amber-700' : 'text-slate-500',
      )}
    >
      {' '}· ${m.costInput} / ${m.costOutput} per MTok
    </span>
  </span>
  {m.family ? (
    <span className="block text-[12px] font-normal leading-[1.4] text-slate-500">
      {m.family}
    </span>
  ) : null}
</div>
```
This is the exact insertion point for the endpoint caption (D-26-01: endpoint first, suffix second — so an `endpointLabel(m.endpoint)` span must render BEFORE the existing `suffixLabel(m.id)` span, inside the same `<span>`) and for the Hermes capability caption (keyed on `m.providerID === 'nousresearch'` per RESEARCH.md Pitfall 4, not `m.family`). Per RESEARCH.md Pattern 2, prefer composing these into one `rowCaption()`-style string from `model-picker-logic.ts` rather than three separate inline `{x ? <span>...} : null}` blocks, since D-26-01 requires ordered joining with `· ` separators (matches the existing cost-caption's own `· $` leading-bullet convention at line 181, but note the CURRENT suffix span at line 173 has NO leading bullet — this inconsistency is flagged in RESEARCH.md's Pattern 2/State-of-the-Art table as something the new composed caption should resolve, not replicate).

**Grouped-mode badge (D-26-06/07) — already correct, reuse verbatim, no changes needed** (lines 166-170): this is the pattern the primary-picker trigger badge fix (below) must be brought into alignment with.

**`isHighCost` cost-caption gate (for D-26-05 cost-suppression discussion)** (lines 175-182): if the plan resolves Pitfall 2's Open Question toward suppression, the suppression conditional wraps this whole cost `<span>`, keyed on the resolved `providerID`/id pair — same `cn()`/ternary shape already used for the color threshold.

---

### `src/components/settings/model-settings-form.tsx` (component, CRUD) — SET-05 badge fix, D-26-02 recap caption, D-26-09 reset hint

**Analog for the SET-05 badge bug fix:** the file's OWN fallback-picker badge (line 308) is the correct pattern; the primary-picker badge (line 258) is the bug to fix.

```typescript
// Line 258 — CURRENT (bug, D-26-11):
badge={provider}

// Line 308 — the CORRECT existing pattern one picker below, to copy from:
badge={unionServableModels.find((m) => m.id === fb)?.providerID ?? undefined}
```
Fix per RESEARCH.md Pattern 3 / CONTEXT.md D-26-11:
```typescript
badge={unionServableModels.find((m) => m.id === primary)?.providerID ?? provider}
```
Note the fallback comparator falls to `?? undefined` (badge omitted) while the primary fix should fall to `?? provider` (RESEARCH.md's recommended fallback, preserving current single-provider-case behavior) — a deliberate small divergence from the literal copy-paste, since the primary picker always has SOME value (never the empty-fallback-row sentinel the `?? undefined` fallback exists for).

**Analog for D-26-02 saved-chain recap endpoint caption** (lines 368-385, the recap block):
```typescript
{lastSaved &&
primary === lastSaved.primary &&
fallbacks.filter((f) => f !== '').join('|') === lastSaved.fallbacks.join('|') ? (
  <p className="text-[14px] font-normal leading-[1.5] text-slate-600">
    Saved chain:{' '}
    {[primary, ...fallbacks.filter((f) => f !== '')].map((id, idx) => (
      <span key={id}>
        {idx > 0 ? ' → ' : null}
        <Badge variant="secondary">
          {providerName(
            unionServableModels.find((m) => m.id === id)?.providerID ?? 'anthropic',
          )}
        </Badge>{' '}
        {savedChain?.find((sc) => sc.id === id)?.name ?? id}
      </span>
    ))}
  </p>
) : null}
```
Extend the `.map()` body to also look up `unionServableModels.find((m) => m.id === id)?.endpoint` and render an `endpointLabel()` caption span after the name — same `unionServableModels.find` lookup already performed for the badge, just read one more field off the same result (avoid a second `.find()` call — capture `resolved = unionServableModels.find(...)` once and reuse for both badge and endpoint, as RESEARCH.md's Code Examples section already shows).

**Analog for D-26-09 endpoint-aware reset hint** (lines 156-180, `handleProviderChange`):
```typescript
function handleProviderChange(next: ModelProviderId) {
  markDirty();
  const result = primaryAfterProviderSwitch(primary, next, servableByProvider, defaults);
  setPrimary(result.primary);
  if (result.resetToDefault) {
    setResetHint(
      `Primary model reset to ${defaults[next].name} for ${
        providers.find((p) => p.id === next)?.name ?? next
      }.`,
    );
  } else {
    setResetHint(null);
  }
  setProvider(next);
}
```
D-26-09's keep-if-valid branch (`resetToDefault === false`, i.e. the `else` at line 173-175 that currently just clears the hint) is the hook point for the new endpoint-aware hint — per RESEARCH.md Pitfall 7, this needs explicit resolution of the factual-accuracy problem before implementation (the literal proposed copy "now serves via OpenCode Zen" is false for the only live collision id, `claude-sonnet-4-6`, which always resolves to native Anthropic). Whatever copy is chosen, wire it through the SAME `setResetHint(...)` state + the SAME non-blocking slate-600 rendering already at lines 226-230 — no new UI state needed, this is a string-content decision only, not a new pattern.

**Reset hint render (reuse verbatim, no changes)** (lines 226-230):
```typescript
{resetHint !== null ? (
  <p className="text-[14px] font-normal leading-[1.5] text-slate-600">{resetHint}</p>
) : null}
```

---

### `src/components/settings/model-picker-logic.test.ts` (test) — Wave 0 coverage gaps

**Analog:** itself — existing `describe` block shape (e.g. `suffixLabel` block, lines 116-138)

```typescript
describe('suffixLabel (SET-07)', () => {
  it('labels a ~latest alias', () => {
    expect(suffixLabel('~openai/gpt-5')).toBe('always the latest');
  });
  // ... Given/When/Then comment convention, one assertion focus per `it`
});
```
New test blocks for `endpointLabel`/`rowCaption`/Hermes-caption/badge-resolution helper should follow this exact `describe`/`it`/Given-When-Then-comment shape, using synthetic inline fixtures (never live `catalog.json` — per the file's header note lines 18-23: "these tests pin the picker semantics, not a snapshot that drifts on refresh"). The existing `fixture` array (lines 24-65) and `servableByProvider`/`defaults` records (lines 69-81) are already 4-provider-shaped (`Record<ModelProviderId, ...>` forces all 4 keys per the TS compiler) — extend `fixture` with opencode/nousresearch rows rather than building a second fixture array, to keep the "id-first uniqueness" property (lines 107-113) that later tests rely on.

## Shared Patterns

### T-17-09 client-bundle safety (applies to every file this phase touches)
**Source:** `src/components/settings/model-picker-logic.ts` lines 1-13 (module header comment)
```typescript
// Client-safety (T-17-09): the ONLY import is the type-only ModelProviderId —
// erased at compile. A value import of catalog.ts would drag the committed model
// snapshot (1131 rows incl. costs) into the client bundle. Everything derives
// from already-trimmed, server-validated ServableModel props: no I/O, no
// rendering, no external calls.
import type { ModelProviderId } from '@/lib/models/catalog';
```
**Apply to:** every new field/function in `model-picker-logic.ts`, `model-picker.tsx`, `model-settings-form.tsx` — the new `endpoint` field must be derived server-side in `page.tsx` and threaded as a plain data prop; never import `catalog.ts` as a value in any `'use client'` file to compute it.

### Provider display names — single source
**Source:** `src/components/settings/model-picker-logic.ts` lines 31-36 (`PROVIDER_NAMES`), consumed via `providerName()` at line 38-40
**Apply to:** all badge/caption rendering in `model-picker.tsx` and `model-settings-form.tsx` — never hardcode a provider label string; always call `providerName(providerID)`.

### Decision-comment convention
**Source:** every exported function in `model-picker-logic.ts` (e.g. lines 42-45, 50-52, 59-60, 65-68, 81-83, 88-90) and every derived-props block in `page.tsx` (lines 43-55, 68, 76-82, 87-88, 96-101)
**Apply to:** all new code this phase — every new function/branch should carry a 1-4 line comment citing the decision id (D-26-01..11) and, where applicable, the verified row-count/fact backing the branch (per CLAUDE.md's Comments convention: "explain why, not what").

### Draft-only state, non-blocking hints (D-21-01/03, extended by D-26-09)
**Source:** `model-settings-form.tsx` `resetHint` state (lines 77, 168-175, 226-230) and `markDirty()` (lines 130-133)
**Apply to:** the D-26-09 endpoint-aware hint — must reuse the SAME `resetHint` state and render slot, never introduce a second hint state or a blocking/red-colored variant.

### Error-copy map pattern (for reference, not modified this phase)
**Source:** `model-settings-form.tsx` lines 36-40 (`ERROR_COPY`)
**Not extended this phase** — no new save-path error codes are introduced (RESEARCH.md confirms `settings.ts`'s save/staleness gate is already 4-provider-generic, SET-06 is verification-only).

## No Analog Found

None. Every file in scope is an extension of existing code with a same-file or same-directory sibling pattern already doing the analogous shape of work.

## Metadata

**Analog search scope:** `src/components/settings/`, `src/app/(dashboard)/settings/`, `src/components/ui/badge.tsx`, `src/lib/models/catalog.ts` (read via RESEARCH.md, not re-read here)
**Files read directly this pass:** `model-picker-logic.ts` (158 lines, full), `model-picker.tsx` (220 lines, full), `model-settings-form.tsx` (401 lines, full), `page.tsx` (133 lines, full), `model-picker-logic.test.ts` (351 lines, full), `badge.tsx` (51 lines, full)
**Pattern extraction date:** 2026-08-04
**Line-number note:** all line numbers above are re-verified against the CURRENT file state as of this read (2026-08-04) — RESEARCH.md's citations were independently confirmed to still match (e.g. `badge={provider}` bug is still at `model-settings-form.tsx:258`, fallback correct pattern still at `:308`).
