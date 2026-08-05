# Phase 26: Settings UI - Research

**Researched:** 2026-08-04
**Domain:** Next.js App Router client/server component extension — shadcn Combobox + Select forms, pure decision-logic module, server-computed trim/props boundary
**Confidence:** HIGH (all claims below verified by direct source read + live `tsx` execution against the committed catalog snapshot, not by training-data recall)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**OpenCode Endpoint Captions (SET-03)**
- **D-26-01:** Caption ordering when a row has BOTH an endpoint caption and a suffix label — **endpoint first, suffix second**: `· Zen · free tier — 50 req/day`. The endpoint is the primary identity cue (which endpoint serves this row); the suffix is secondary context.
- **D-26-02:** The `· Zen`/`· Go` endpoint caption appears on **picker rows AND the saved-chain recap** — the saved chain must disambiguate Zen vs Go after save, not just inside the pickers.
- **D-26-03:** `'zen'`/`'go'` join the Command **search index** (`searchValue`) — typing "go" filters to Go-endpoint rows. Composed into the existing id+name+family lowercase search string.

**NousResearch Honest Captions (SET-04)**
- **D-26-04:** Both Hermes rows caption the **same uniform family descriptor** — `· chat/reasoning-tuned` — honest about what the model is, identical across hermes-4-70b and hermes-4-405b (no per-model tuning split). Mirrors the `:free` fail-loud honesty pattern (a visible, factual label in the caption slot).
- **D-26-05:** OpenRouter **mirror** rows (`nousresearch/hermes-4-70b`/`405b` via openrouter, which carry NO cost data) show **no cost caption** — absence is honest, no fabricated number. NousResearch rows show per-MTok cost captions converted from the API's per-token pricing (`cost: { input: 0.05, output: 0.2 }` → per-MTok via the existing ×1e6 conversion).

**Badge Disambiguation (SET-05)**
- **D-26-06:** Badges are **provider-only** — `NousResearch` / `OpenCode` etc. Endpoint info lives exclusively in the caption slots (pickers) and recap captions (D-26-02). No `OpenCode · Zen` badge composite; one source per slot.
- **D-26-07:** **Uniform secondary badge variant** for all 4 providers (current Phase 21 style) — text differs, color doesn't. No new badge tokens, no per-provider tints. Same-name rows (hermes-4-70b, claude-sonnet-4-6) disambiguate by badge text + caption, not color.

**Selector + Chain UX (SET-02/06)**
- **D-26-08:** The AI Provider selector entry is **plain `OpenCode`** — no Zen/Go hint in the entry label. Provider-level identity at the top; endpoint detail lives in the picker captions where it matters.
- **D-26-09:** **Endpoint-aware reset hint**: when keep-if-valid preserves `claude-sonnet-4-6` across an anthropic→opencode switch, the existing non-blocking reset hint gains an endpoint note ("now serves via OpenCode Zen") — a visible signal that the route changed, beyond the silent badge flip.
- **D-26-10:** **Silent for sparse providers** — no "only 2 servable models" note when picking NousResearch (Hermes pair) or anthropic (1). The small picker speaks for itself.

### Claude's Discretion
- The `endpoint` field name/type on `ServableModel` (e.g. `endpoint: 'zen' | 'go' | null` vs a label string) and the `endpointLabel()` helper values/format (`· Zen`/`· Go`) — must satisfy D-26-01..03 and stay client-bundle-safe (T-17-09: type-only catalog import; the endpoint derives from the already-trimmed server-validated ServableModel prop).
- Where the trim-time `endpoint` derivation lives (settings.ts `trimToServable`/servable-model mapping) and how dual-listed ids resolve (Zen-wins dedup already guarantees endpoint = Zen for the 12 dual-listed ids — planner verifies, no re-litigation).
- Reset-hint copy mechanics for D-26-09 (extend the existing D-21-01 hint state vs a new variant) — planner's call, must keep the hint non-blocking and draft-only.

**IMPORTANT correction to the above discretion note:** research verified the derivation does NOT live in `settings.ts` — see Pitfall 1 and Integration Points below. `settings.ts` has no trim/servable-mapping code at all; the trim function (`trimRow`) lives in `src/app/(dashboard)/settings/page.tsx`. Treat "settings.ts" in the CONTEXT.md canonical_refs as a documentation error, not a locked location.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope (per CONTEXT.md `<deferred>`).

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SET-01 | AI Provider selector renders 4 always-valued entries in `SERVABLE_PROVIDERS` order | **Already functionally satisfied** — see Summary "What's Already Done" and Pitfall 6. No code change expected; verify only. |
| SET-02 | Selecting a provider refreshes the Primary model picker from that provider's servable source | **Already functionally satisfied** by the existing generic `servableByProvider`/`primaryAfterProviderSwitch` machinery — see Pitfall 6. Verify against live counts (Pitfall 5), not the stale 49/336 figures in ROADMAP.md. |
| SET-03 | OpenCode rows render `· Zen`/`· Go` endpoint captions in both primary and union pickers | Genuinely new — see Architecture Patterns "Pattern 1" and Code Examples. |
| SET-04 | NousResearch Hermes rows render honest capability + per-MTok cost captions | Genuinely new caption function; cost conversion is ALREADY done at snapshot-generation time (CAT-02) — no new math needed, only caption/suppression logic. See Pitfall 2 for the D-26-05 cost-data contradiction. |
| SET-05 | Provider badges disambiguate same-name models across 4 providers | The real work is here — see Pitfall 3 (primary trigger badge currently shows the wrong provider for 2 real, verified collisions: `claude-sonnet-4-6` and the two hermes ids). |
| SET-06 | Union pickers group by 4 providers; save/staleness verified end-to-end | Grouping is structurally already 4-way (D-21-08 `groupByProvider` is generic). Save/staleness gate is already union-wide (REG-07, marked Complete). This requirement is primarily an END-TO-END VERIFICATION task, not new logic — see Validation Architecture. |

</phase_requirements>

## Summary

Phase 26 is a narrower delta than its Success Criteria text suggests. Phases 23–25 already widened the shared registry (`SERVABLE_PROVIDERS`, `PROVIDER_NAMES`, `PROVIDER_DEFAULT_MODELS`) to 4 entries and wired the run path. Because `src/app/(dashboard)/settings/page.tsx` and `model-settings-form.tsx` already consume these registry-driven maps generically (no 2-provider-specific branching), **the 4-entry provider selector (SET-01) and the provider-scoped primary refresh (SET-02) already work today with zero new code** — confirmed by reading `git log` on `model-picker-logic.ts` (Phase 23 commit `81deccb3` widened `PROVIDER_NAMES` to 4 entries) and by tracing every consumer of `SERVABLE_PROVIDERS`/`servableByProvider`. Save/staleness (SET-06's second half) is also already union-wide and provider-agnostic (`saveSettingsAction`, `getUnionServableIds` — REG-07 marked Complete, and `settings.test.ts` already has a passing 4-provider save test).

**The genuinely new work is three things:**
1. **SET-03 (OpenCode endpoint captions):** a new `endpoint: 'zen' | 'go' | null` field on `ServableModel`, a new `endpointLabel()` helper, a caption-slot composition change in `model-picker.tsx`, a `searchValue()` extension, and a saved-chain-recap caption addition in `model-settings-form.tsx`. None of this exists yet (verified by grep — zero hits for `endpointLabel` or `endpoint:` anywhere in `src/`).
2. **SET-04 (Hermes honest captions):** a new caption function analogous to `suffixLabel()`, keyed on the row's resolved `providerID === 'nousresearch'` (not `family === 'hermes'` — see Pitfall 4), plus a decision on the D-26-05 cost-suppression rule, whose stated premise ("mirror rows carry no cost data") is **contradicted by the live snapshot** — see Pitfall 2.
3. **SET-05 (badge accuracy):** fixing a **real, verified bug** in the existing primary-picker trigger badge, which currently displays `badge={provider}` — the raw UI dropdown selection — instead of the row's true runtime-resolved provider. For the two collision cases the phase explicitly calls out (`claude-sonnet-4-6` and the hermes pair), the naive dropdown-provider badge and the true resolved provider **can and do diverge today**, verified live against the committed catalog and against `modelFactory.ts`'s actual dispatch logic. This is the load-bearing fix for the phase's stated goal ("unambiguous badges").

**Primary recommendation:** scope Phase 26's plan around the 3 genuinely-new deltas above (endpoint captions, Hermes captions, badge-accuracy fix), treat SET-01/02/06's "already working" plumbing as a verification task (add/extend tests proving it, don't rebuild it), and get an explicit human/planner decision on two verified contradictions between CONTEXT.md's locked decisions and the live data before implementation (Pitfall 2's cost-data claim, Pitfall 7's D-26-09 factual-accuracy problem).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Provider/model servable-set computation, endpoint derivation, badge-truth resolution | API/Backend (Next.js Server Component) | — | `src/app/(dashboard)/settings/page.tsx` is a server component; it owns all catalog reads (`catalog.json` never reaches the client, T-17-09) and must own the new `endpoint` field derivation for the same reason |
| Picker rendering, search/filter, caption composition, badge display | Browser/Client | — | `model-picker.tsx`/`model-settings-form.tsx` are `'use client'`; they consume only pre-trimmed `ServableModel[]` props + the pure logic module, never the raw catalog |
| Pure decision logic (search index, suffix/endpoint labels, staleness, grouping, provider-switch reset) | Browser/Client (but framework-agnostic pure functions) | — | `model-picker-logic.ts` is deliberately import-light (type-only catalog import) so it stays client-bundle-safe while being unit-testable under Node/Vitest |
| Save validation, union-membership gate, staleness backstop | API/Backend (Server Action) | — | `settings.ts` — already 4-provider-generic via `getUnionServableIds`; no change needed for SET-06's save path |
| Model instantiation / actual provider dispatch at run time | API/Backend (`modelFactory.ts`) | — | Out of scope for this phase (Phase 25, done) — but its `getProviderForModelId` precedence logic is the ground truth the UI's badges must match (see Pitfall 3) |

## Standard Stack

No new external packages. This phase extends four existing in-repo modules (`model-picker-logic.ts`, `model-picker.tsx`, `model-settings-form.tsx`, `page.tsx`) using the same shadcn/Radix primitives (`Command`, `Popover`, `Badge`, `Select`) already vendored in `src/components/ui/`. No `npm install` step; no `Package Legitimacy Audit` applies.

**Verified versions in use (unchanged by this phase):**
- Next.js App Router (server components + `'use client'` boundary) — `src/app/(dashboard)/settings/page.tsx`
- `class-variance-authority` — powers `src/components/ui/badge.tsx`'s `secondary` variant (the ONLY variant this phase uses, per D-26-07)
- Vitest 4 (`vitest run`, `environment: 'node'`, `include: ['src/**/*.test.ts']` — `.tsx` files are NEVER included, confirming the project's "components are never unit-tested" convention)

## Architecture Patterns

### System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────┐
│ catalog.json (committed snapshot, 9 providerID groups, server-only) │
└───────────────────────────────┬────────────────────────────────────┘
                                 │ dedupeProviderRows() / getServableIdsForProvider()
                                 ▼
┌────────────────────────────────────────────────────────────────────┐
│ page.tsx (Server Component) — trimRow(id, provider)                 │
│  • per-provider servable lists (servableByProvider)                 │
│  • union list (unionServableModels) — providerID ALREADY resolved   │
│    via getProviderForModelId (precedence-correct)                   │
│  • ← SET-03 NEW: derive `endpoint: 'zen'|'go'|null` here from the   │
│    matched row's providerID ('opencode'→zen, 'opencode-go'→go)      │
└───────────────────────────────┬────────────────────────────────────┘
                                 │ props (ServableModel[] — plain data, no SDK/catalog import)
                                 ▼
┌────────────────────────────────────────────────────────────────────┐
│ model-settings-form.tsx ('use client')                              │
│  • provider Select (4 entries, ALREADY generic)                     │
│  • primary ModelPicker: badge={provider} ← BUG, see Pitfall 3       │
│  • fallback ModelPickers: badge={row.providerID} ← already correct  │
│  • saved-chain recap ← SET-03 NEW: needs endpoint caption too       │
└───────────────────────────────┬────────────────────────────────────┘
                                 │ ServableModel[] + pure functions
                                 ▼
┌────────────────────────────────────────────────────────────────────┐
│ model-picker-logic.ts (pure, client-bundle-safe, unit-tested)       │
│  suffixLabel() ── SET-03 NEW: endpointLabel()                       │
│  searchValue() ── SET-03 NEW: append 'zen'/'go'                     │
│                    SET-04 NEW: hermesLabel()-style function          │
└────────────────────────────────────────────────────────────────────┘
```

### Pattern 1: Endpoint field derivation (SET-03)

`page.tsx`'s `trimRow` already calls `dedupeProviderRows(catalogJson, provider).find((mm) => mm.id === id)` and has the matched row (`m`) in scope. The endpoint is a one-line derivation from that row's `providerID`, valid ONLY for the `opencode` logical provider:

```typescript
// Source: derived from src/app/(dashboard)/settings/page.tsx:56-66 (existing trimRow)
const trimRow = (id: string, provider: ModelProviderId): ServableModel => {
  const m = dedupeProviderRows(catalogJson, provider).find((mm) => mm.id === id);
  return {
    id,
    name: m?.name ?? getModelDisplayName(id),
    family: m?.family ?? '',
    providerID: provider,
    costInput: m?.cost?.input ?? 0,
    costOutput: m?.cost?.output ?? 0,
    // NEW (SET-03): only opencode rows carry a meaningful endpoint. The
    // Zen-wins dedup guarantees dual-listed ids resolve m.providerID ===
    // 'opencode' (never 'opencode-go') — verified live: 34 servable rows
    // resolve zen, 6 resolve go, out of 40 total opencode-servable ids.
    endpoint: provider === 'opencode' ? (m?.providerID === 'opencode-go' ? 'go' : 'zen') : null,
  };
};
```

This must ALSO be applied inside the `unionServableModels` map (same file, `getUnionServableIds(catalogJson).map((id) => trimRow(id, getProviderForModelId(catalogJson, id) ?? 'anthropic'))`) — since `trimRow` is already shared between both call sites, the endpoint field flows into the union (fallback picker + recap) automatically once `trimRow` is updated. This satisfies "BOTH the provider-scoped primary and union fallback pickers" (SET-03 success criterion) with a single change point.

### Pattern 2: Caption-slot composition (D-26-01)

The existing suffix-label rendering in `model-picker.tsx` (lines 172–174) has NO leading bullet — the bullet character only appears on the cost caption today. D-26-01's example (`· Zen · free tier — 50 req/day`) implies a single leading bullet with internal `· ` separators between parts. Recommended shape (exact naming/location is Claude's discretion per CONTEXT.md):

```typescript
// New in model-picker-logic.ts — composes endpoint + suffix per D-26-01
// ordering (endpoint first). No live opencode row currently has BOTH an
// endpoint AND a suffix (grep-verified: 0 opencode ids start with '~' or
// end with ':free') — this compound case needs a synthetic test fixture,
// not committed-snapshot data (matches the existing
// model-picker-logic.test.ts convention of a decoupled inline fixture).
export function endpointLabel(endpoint: 'zen' | 'go' | null): string | null {
  if (endpoint === 'zen') return 'Zen';
  if (endpoint === 'go') return 'Go';
  return null;
}

export function rowCaption(m: { id: string; endpoint: 'zen' | 'go' | null }): string | null {
  const parts = [endpointLabel(m.endpoint), suffixLabel(m.id)].filter(
    (p): p is string => p !== null,
  );
  return parts.length ? parts.join(' · ') : null;
}
```

`searchValue()` (D-26-03) composes similarly — append the raw `endpoint` string (not the capitalized label) so "go" and "zen" are searchable lowercase tokens:

```typescript
export function searchValue(m: { id: string; name: string; family: string; endpoint?: 'zen' | 'go' | null }): string {
  return [m.id, m.name, m.family, m.endpoint ?? ''].filter(Boolean).join(' ').toLowerCase();
}
```

### Pattern 3: Resolved-provider badge (SET-05 — the real fix)

Every OTHER badge site in the codebase already derives from a `providerID` that was assigned via `getProviderForModelId` (precedence-resolved) — `unionServableModels`, the saved-chain recap, and fallback picker trigger badges. The ONE exception is the primary picker's trigger badge:

```typescript
// src/components/settings/model-settings-form.tsx:258 — CURRENT (bug):
badge={provider}   // the raw dropdown selection, NOT the row's true provider

// Correct (mirrors the fallback-picker pattern one block below, line 308):
badge={unionServableModels.find((m) => m.id === primary)?.providerID ?? provider}
```

The fallback comparator `?? provider` preserves current behavior for the empty/in-progress and single-provider cases (anthropic's 1 row, where naive and resolved providers are always identical).

### Recommended Project Structure

No new files. All changes land in the 4 existing files:
```
src/
├── app/(dashboard)/settings/page.tsx        # trimRow endpoint derivation (server)
├── components/settings/
│   ├── model-picker-logic.ts                # endpointLabel(), rowCaption(), hermes caption fn, searchValue()
│   ├── model-picker-logic.test.ts            # extend with new fixtures (endpoint, hermes)
│   ├── model-picker.tsx                     # caption slot render, badge display
│   └── model-settings-form.tsx              # primary trigger badge fix, recap caption
```

### Anti-Patterns to Avoid
- **Family-keyed Hermes caption:** `family === 'hermes'` alone also matches the OpenRouter mirror rows in the openrouter-scoped picker (verified: `hermes-4-70b`/`405b` under `providerID: 'openrouter'` both carry `family: 'hermes'` too). Key the caption on the row's (already-resolved) `providerID === 'nousresearch'`, not family alone — see Pitfall 4.
- **Re-deriving endpoint client-side from the id string:** the id itself carries no Zen/Go signal (e.g. `deepseek-v4-flash` exists as both a Zen dual-listed id and would need the row's `providerID`/`api.url`, not the id, to disambiguate). Endpoint MUST be derived server-side from the matched catalog row, never guessed client-side from the id (this would also violate T-17-09 if it required a catalog import).
- **Trusting the phase description's row counts:** ROADMAP.md's Success Criterion 2 says "opencode (49 rows incl. Claude)" and "openrouter (336)" — the LIVE, currently-committed snapshot (`generatedAt: 2026-08-04T09:44:37.964Z`) returns **40** (23 chat + 17 Claude) and **337** respectively, confirmed by both a live `tsx` run and the already-passing `catalog.test.ts` canary (`toHaveLength(40)`). These counts are known-driftable by design (Phase 24's D-24-07 accepted-drift precedent) — do not hardcode the stale 49/336 numbers in any new UI text or test assertion.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Provider display names | A new opencode/nousresearch ternary | `PROVIDER_NAMES` (already 4-entry, `model-picker-logic.ts:31-36`) | Already registry-driven since Phase 23; a new branch would violate REG-01's "no new hardcoded branch" contract |
| Per-provider default reset targets | New per-provider default constants | `PROVIDER_DEFAULT_MODELS` (`modelFactory.ts:84-89`, already 4-entry) | Already exported and TS-enforced at 4 entries |
| Union-wide save validation | A new 4-provider-aware validator | `getUnionServableIds` + existing `saveSettingsAction` | Already provider-count-agnostic (Set-based union); REG-07 already verified with a passing 4-provider test in `settings.test.ts` |
| Cost per-MTok conversion for Hermes | New ×1e6 math in the UI layer | The already-converted `cost.input`/`cost.output` fields in `catalog.json` | CAT-02 (Phase 24) already did this conversion at snapshot-generation time — verified live (`0.05`/`0.2` for hermes-4-70b is already per-MTok, not per-token) |

**Key insight:** almost every generic piece of Phase 21/23's picker machinery (grouping, search, staleness, union computation) was deliberately written provider-count-agnostic. The temptation in this phase is to "build the 4-provider UI" from scratch; the actual work is much smaller — find the 2-3 places where a provider count of exactly 2 was silently assumed (the primary trigger badge is the only one confirmed) and fix those, rather than rewriting the generic layer.

## Common Pitfalls

### Pitfall 1: CONTEXT.md's canonical_refs misidentifies where the `endpoint` field must be derived
**What goes wrong:** CONTEXT.md's `<code_context>`/`<canonical_refs>` repeatedly says the derivation lands in `settings.ts` ("the trim-to-servable mapping where the derived `endpoint` field lands").
**Why it happens:** `settings.ts` is the Server Action file (save-path validation only — `saveSettingsAction`); it has NO trim/servable-mapping code. The actual trim function (`trimRow`) lives in `src/app/(dashboard)/settings/page.tsx` (the read-path server component), confirmed by direct read of both files.
**How to avoid:** Implement the `endpoint` derivation in `page.tsx`'s `trimRow`, not `settings.ts`. `settings.ts` needs ZERO changes for this phase (its union-membership gate is already provider-count-agnostic).
**Warning signs:** If a plan task says "edit settings.ts to add the endpoint field," that task will fail to find the right code — verify against the file list above first.

### Pitfall 2: D-26-05's premise ("OpenRouter mirror rows carry NO cost data") is contradicted by the live snapshot
**What goes wrong:** D-26-05 states the openrouter-hosted mirror rows for `nousresearch/hermes-4-70b`/`405b` "carry NO cost data" and should show no cost caption for that reason.
**Verified fact:** Live catalog data shows both mirror rows DO carry real, non-zero cost: `nousresearch/hermes-4-70b` via openrouter = `{ input: 0.13, output: 0.4 }`; `nousresearch/hermes-4-405b` via openrouter = `{ input: 1, output: 3 }`. Neither is zero or absent.
**Why it happens:** Likely a context-gathering assumption not checked against the live snapshot at discussion time (or checked against a stale/different snapshot before Phase 24's refresh landed the final Nous rows on 2026-08-04).
**How to avoid:** This needs an explicit decision before planning, not a silent "fix": (a) implement D-26-05 literally as a special-case suppression rule keyed on the specific 2 known colliding ids + openrouter identity (ignoring whether cost data exists — enforcing "we don't want to advertise pricing for a mirror row" as a policy, not an honesty-about-absence claim), or (b) drop the suppression and show cost normally since it demonstrably exists (simpler, and arguably MORE honest — the mirror row's cost is real OpenRouter pricing a user could actually be billed). Flag to the user/planner rather than silently picking one.
**Warning signs:** A test asserting `costInput === 0` for these ids will fail against the live snapshot — don't write that assertion.

### Pitfall 3: The primary picker's trigger badge shows the raw dropdown provider, not the row's true resolved provider — a real, verified bug this phase must fix
**What goes wrong:** `model-settings-form.tsx:258` passes `badge={provider}` (the `useState` dropdown value) to the primary `ModelPicker`. Every OTHER badge site (fallback triggers, the saved-chain recap, union list rows) derives from `unionServableModels`, whose `providerID` was assigned via `getProviderForModelId` — the PRECEDENCE-RESOLVED true provider.
**Verified concretely (live `tsx` execution against the committed catalog):**
- `claude-sonnet-4-6` is servable under BOTH `anthropic` (1 row) and `opencode` (40-row list, since its `api.npm` passes the OpenCode npm gate) — but `getProviderForModelId` ALWAYS resolves it to `'anthropic'` (precedence: anthropic is index 0, intentionally, per `catalog.ts`'s own comment: "the claude-sonnet-4-6 regression lock"). If a staff member switches the provider dropdown to OpenCode and selects Claude Sonnet 4.6 as primary, the CLOSED TRIGGER currently shows badge "OpenCode" — but `modelFactory.instantiateModel` will actually route this id through native Anthropic (not OpenCode Zen) at run time.
- `nousresearch/hermes-4-70b` and `nousresearch/hermes-4-405b` are servable under BOTH `nousresearch` (2-row curated list) and `openrouter` (part of the full 337-row active set, since openrouter has no allowlist). `getProviderForModelId` always resolves both to `'nousresearch'` (precedence order `['anthropic','nousresearch','openrouter','opencode']`, verified live). Selecting either id while the dropdown is on OpenRouter would show badge "OpenRouter" on the trigger, while the row will actually run through NousResearch.
**Why it happens:** In Phase 21's 2-provider world, `primary`'s dropdown-selected provider and its true resolved provider were provably always identical (the UI-SPEC's own comment: "the anthropic and openrouter id spaces are disjoint — zero overlap"). That invariant is gone in the 4-provider world — Phase 23 deliberately introduced these 2 overlaps.
**How to avoid:** `badge={unionServableModels.find((m) => m.id === primary)?.providerID ?? provider}` — resolve from the union list (already correctly resolved) exactly like the fallback pickers already do at line 308.
**Warning signs:** Any manual/live test where you pick a colliding id under the "wrong" provider dropdown and the trigger badge disagrees with what the saved-chain recap shows after Save.

### Pitfall 4: A naive `family === 'hermes'` check for the D-26-04 caption would also caption the OpenRouter-badged mirror rows
**What goes wrong:** Both the nousresearch-native hermes rows AND their openrouter mirror rows carry `family: 'hermes'` in the snapshot (verified). If the new capability-caption function keys off `family` alone, it will incorrectly render `· chat/reasoning-tuned` on the OpenRouter-scoped row too — a row D-26-05 already treats specially (no cost caption) precisely because it's a mirror, not the honest NousResearch original.
**How to avoid:** Key the capability caption on the trimmed row's `providerID === 'nousresearch'` (post-trim, so it naturally reflects which scope the row is being rendered under — provider-scoped picker or the precedence-resolved union), optionally AND `family === 'hermes'` for forward-compatible narrowing if the allowlist grows beyond hermes later.

### Pitfall 5: ROADMAP.md's Success Criterion 2 row counts (49/336) are already stale
**What goes wrong:** Success Criterion 2 for Phase 26 states opencode = 49 rows, openrouter = 336. Both numbers were accurate at an earlier snapshot generation but the CURRENTLY COMMITTED snapshot (regenerated 2026-08-04, same day as CONTEXT.md gathering) returns opencode = 40 (23 chat + 17 Claude, per the already-passing `catalog.test.ts` canary `toHaveLength(40)`) and openrouter = 337.
**Why it happens:** Catalog refresh (Phase 24, D-24-07 "accepted drift") legitimately changed the Go roster size (17→18 servable rows) after the original 49/25-target numbers were set in earlier planning documents; openrouter's active-row count drifts naturally on any refresh (the existing test asserts `toBeGreaterThanOrEqual(300)`, never an exact number, BY DESIGN).
**How to avoid:** Any UI copy, test assertion, or verification step that needs a row count should read it live from `getServableIdsForProvider`/`getUnionServableIds`, never hardcode 49/336. If a human-facing UAT script needs example numbers, regenerate them at execution time.

### Pitfall 6: SET-01/SET-02/SET-06's "already working" plumbing is a verification risk if assumed untested
**What goes wrong:** Because these three requirements are ALREADY functionally satisfied by generic Phase 21/23 code, a plan could either (a) correctly treat them as "verify only" (cheap), or (b) incorrectly assume no verification is needed at all because "nothing changed" — but nothing in the existing test suite currently exercises a live 4-provider Select→Picker→Save round trip in one flow (the closest is `settings.test.ts`'s REG-07 test, which only exercises the Server Action layer with a mocked union, not the picker-rendering/provider-switch client logic end-to-end).
**How to avoid:** Add an explicit `model-picker-logic.test.ts` case exercising `primaryAfterProviderSwitch` and `groupByProvider` with a 4-provider fixture (not just the existing 2-provider fixture) to close this gap — cheap, and it's the correct place per the "components are never unit-tested" convention (the pure logic module is the testable surface).
**Warning signs:** If Phase 27's VER-01/VER-05 is the FIRST place a 4-provider Settings round trip gets exercised, a Phase-26-introduced regression (e.g. in the badge fix) won't surface until much later in the pipeline.

### Pitfall 7: D-26-09's proposed hint copy ("now serves via OpenCode Zen") is factually false for its own stated trigger case
**What goes wrong:** D-26-09 describes the scenario "keep-if-valid preserves `claude-sonnet-4-6` across an anthropic→opencode switch" and proposes the hint text "now serves via OpenCode Zen." But per Pitfall 3's verified precedence resolution, `claude-sonnet-4-6` ALWAYS resolves to native Anthropic (never OpenCode Zen), regardless of which provider is selected in the dropdown — this is an intentional, locked regression-lock from Phase 23 ("the claude-sonnet-4-6 regression lock" per `catalog.ts`'s own comment on `PROVIDER_PRECEDENCE`).
**Why it happens:** The proposed copy assumes the badge-flip reflects a real routing change; it doesn't, for this specific id — it's a UI dropdown label change with no runtime effect at all.
**How to avoid:** This needs explicit resolution before implementation (same treatment as Pitfall 2): either (a) correct the copy to state the true fact ("Claude Sonnet 4.6 stays routed through Anthropic — OpenCode's copy of this model is never used while a higher-priority provider serves the same id" or similar, considerably more honest but more verbose), or (b) special-case this exact id to show NO endpoint note (since nothing actually changed), or (c) generalize the hint to only fire for ids whose resolved provider ACTUALLY differs from a naive per-provider-scope assumption — which for the ONLY overlapping id in the current catalog (`claude-sonnet-4-6`) means it should say "no change" rather than "now serves via OpenCode Zen." CONTEXT.md's own discretion grant ("Reset-hint copy mechanics for D-26-09... planner's call") covers HOW to implement the hint state, not whether the specific proposed copy is accurate — that's a factual correction, not a style choice, and should get explicit sign-off given the phase's stated goal is "honest captions."
**Warning signs:** A live UAT where a tester compares "now serves via OpenCode Zen" against `agent_run.model_used` after an actual Analyze run and finds it says `anthropic`, not `opencode-zen` — this is exactly what Phase 27's VER-02 would catch, but catching it here is cheaper.

### Pitfall 8: Do not introduce the literal env var key names into client-reachable code
**What goes wrong:** Phase 27's VER-04 will widen the existing `security-grep.test.ts` (currently only checks the `OPENROUTER` substring) to also check for `NOUSRESEARCH`/`OPENCODE` key-name leakage into client components. Phase 26 doesn't need to touch that test file, but any new client-side code (in `model-picker-logic.ts`, `model-picker.tsx`, `model-settings-form.tsx`) must never reference `NOUSRESEARCH_API_KEY`/`OPENCODE_API_KEY` literally — only the lowercase provider ids (`'nousresearch'`, `'opencode'`) and display names (`'NousResearch'`, `'OpenCode'`) are safe, and those already exist in the client-bundle-safe `PROVIDER_NAMES` map.
**How to avoid:** Nothing in this phase's scope needs the actual key names — the client layer works entirely off provider ids/display names/servable data, never secrets. This is a "don't do X" pitfall, not something requiring new code.

## Code Examples

### Endpoint-aware saved-chain recap caption (D-26-02)

The recap currently renders only badge + name (`model-settings-form.tsx:376-381`). Extending it needs the same `unionServableModels` lookup already used for the badge, plus the new `endpointLabel()`:

```typescript
// Source: extends the existing pattern at model-settings-form.tsx:373-383
{[primary, ...fallbacks.filter((f) => f !== '')].map((id, idx) => {
  const resolved = unionServableModels.find((m) => m.id === id);
  return (
    <span key={id}>
      {idx > 0 ? ' → ' : null}
      <Badge variant="secondary">{providerName(resolved?.providerID ?? 'anthropic')}</Badge>{' '}
      {savedChain?.find((sc) => sc.id === id)?.name ?? id}
      {resolved?.endpoint ? (
        <span className="text-[12px] font-normal leading-[1.4] text-slate-500">
          {' '}· {endpointLabel(resolved.endpoint)}
        </span>
      ) : null}
    </span>
  );
})}
```

### ServableModel type extension

```typescript
// Source: src/components/settings/model-picker-logic.ts:15-22 — add one field
export type ServableModel = {
  id: string;
  name: string;
  family: string;
  providerID: ModelProviderId;
  costInput: number;
  costOutput: number;
  endpoint: 'zen' | 'go' | null; // NEW (SET-03) — null for all non-opencode rows
};
```

## State of the Art

| Old Approach (Phase 21, 2-provider) | Current Approach (Phase 26, 4-provider) | When Changed | Impact |
|--------------------------------------|------------------------------------------|---------------|--------|
| Trigger badge = dropdown-selected provider (safe because anthropic/openrouter id spaces are disjoint) | Trigger badge must = resolved provider (dropdown and resolution can now diverge) | Phase 23 (registry precedence introduced real overlaps) | Pitfall 3 — requires a code fix this phase, not just new data flowing through old code |
| Cost caption is unconditional on every row | Cost caption may need row-specific suppression (D-26-05) | This phase (SET-04) | First provider-identity-conditional caption rule in the picker |
| `suffixLabel()` is the only caption-slot contributor besides cost | `endpointLabel()` + a Hermes capability label join the same slot | This phase (SET-03/04) | Caption composition becomes multi-part; existing suffix-only rendering (no bullet prefix) needs revisiting for consistency with the new bulleted joins |

**Deprecated/outdated:** None — no library APIs changed; this is a pure in-repo extension.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The exact discretion-left field name `endpoint` and helper name `endpointLabel()` shown in Code Examples are recommendations, not mandates — CONTEXT.md explicitly leaves naming to the planner | Architecture Patterns, Code Examples | Low — naming only, no behavioral risk |
| A2 | `providerID === 'nousresearch'` (rather than `family === 'hermes'`) is the correct trigger key for the D-26-04 capability caption | Pitfall 4 | Medium — if wrong, the caption could appear on the openrouter mirror row too, contradicting D-26-05's differentiated treatment |

**Everything else in this document was verified directly** — either by reading the actual source files, by executing `tsx` against the live committed catalog snapshot, by reading `git log`/`git blame` to confirm which phase touched which file, or by reading the already-passing test suite (`catalog.test.ts`, `settings.test.ts`, `model-picker-logic.test.ts`). No claim above is based on training-data recall of this specific codebase.

## Open Questions

1. **(RESOLVED) D-26-05's cost-suppression premise (Pitfall 2)**
   - What we know: the OpenRouter mirror rows for the 2 Hermes ids demonstrably carry real, non-zero cost data in the live snapshot.
   - What's unclear: whether the "no cost caption" rule should still apply as a POLICY (never show pricing for a row you're steering users away from) independent of whether the data exists, or whether the rule was written under a false premise and should be dropped.
   - Recommendation: surface this to the user/planner explicitly before writing the plan task for SET-04's cost-caption logic; do not silently choose an interpretation.
   - **Resolution:** CONTEXT.md's D-26-05 was corrected post-research — mirror rows now show their real cost caption, same as native NousResearch rows (no suppression). See `26-CONTEXT.md` decisions, `D-26-05 [CORRECTED post-research]`.

2. **(RESOLVED) D-26-09's factual accuracy (Pitfall 7)**
   - What we know: the ONLY id where keep-if-valid crosses an anthropic→opencode switch in the current catalog is `claude-sonnet-4-6`, and it is PROVABLY always served by native Anthropic regardless of the dropdown, by a Phase-23-locked precedence rule.
   - What's unclear: whether the hint copy should be corrected to state "no change" (honest, but contradicts the D-26-09 decision's literal proposed copy), special-cased to omit the hint for this id, or whether there's a broader intent (e.g. a future id where the hint WOULD be accurate) that wasn't captured in the verified data.
   - Recommendation: same as above — flag for explicit confirmation; do not implement the literal "now serves via OpenCode Zen" copy as-is without addressing this contradiction, since it directly undermines the phase's own "honest captions" goal.
   - **Resolution:** CONTEXT.md's D-26-09 was corrected post-research — the hint now states the true routing fact ("Claude Sonnet 4.6 stays routed through Anthropic — OpenCode's copy isn't used while a higher-priority provider serves the same id"), generalized in Plan 26-02 Task 2 beyond the single hardcoded id. See `26-CONTEXT.md` decisions, `D-26-09 [CORRECTED post-research]`.

3. **(RESOLVED) SET-01/02/06 verification depth**
   - What we know: these requirements are structurally already satisfied by generic Phase 21/23 code.
   - What's unclear: whether the planner should write NEW plan tasks purely to add verification coverage (a 4-provider fixture in `model-picker-logic.test.ts`, an end-to-end save test), or fold that verification into the existing SET-03/04/05 tasks' test additions.
   - Recommendation: fold into SET-05's task (badge-accuracy fix naturally needs a 4-provider round-trip test to prove) rather than creating a dedicated near-empty task.
   - **Resolution:** Folded into Plan 26-01 Task 1's `behavior` block, per the recommendation — the 4-provider fixture extension for `primaryAfterProviderSwitch`/`groupByProvider` lives in the same TDD task as the SET-03/04/05 logic additions, not a separate task.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4 (`vitest run`) |
| Config file | `vitest.config.ts` — `environment: 'node'`, `include: ['src/**/*.test.ts']` (note: `.tsx` files are NEVER collected — components are not unit-tested, per established project convention) |
| Quick run command | `npx vitest run src/components/settings/model-picker-logic.test.ts` |
| Full suite command | `npm test` (`vitest run`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SET-01 | 4-entry selector order matches `SERVABLE_PROVIDERS` | unit (pure fn) | `npx vitest run src/components/settings/model-picker-logic.test.ts -t "PROVIDER_NAMES"` | ✅ (extend existing fixture-based tests) |
| SET-02 | Provider switch refreshes primary picker's option set from that provider's servable source | unit (pure fn) | `npx vitest run src/components/settings/model-picker-logic.test.ts -t "primaryAfterProviderSwitch"` | ✅ existing test exists (2-provider fixture) — extend to a 4-provider fixture (Pitfall 6) |
| SET-03 | `endpointLabel()`/`rowCaption()` render `· Zen`/`· Go`, compose with suffix per D-26-01, and join `searchValue` | unit (pure fn) | `npx vitest run src/components/settings/model-picker-logic.test.ts -t "endpoint"` | ❌ Wave 0 — new fn, new tests |
| SET-04 | Hermes capability caption + cost-caption suppression rule | unit (pure fn) | `npx vitest run src/components/settings/model-picker-logic.test.ts -t "hermes"` | ❌ Wave 0 — new fn, new tests; blocked on Open Question 1's resolution |
| SET-05 | Primary trigger badge resolves to the TRUE provider (not the naive dropdown value) for the 2 verified collision ids | unit (pure fn, if the resolution logic is extracted into `model-picker-logic.ts`) OR manual (if left inline in the `.tsx` per no-component-test convention) | `npx vitest run src/components/settings/model-picker-logic.test.ts -t "badge"` (if extracted) | ❌ Wave 0 — recommend extracting a small pure `resolveBadgeProvider(primary, unionServableModels, provider)` helper into `model-picker-logic.ts` specifically so this critical fix gets unit coverage instead of living untested inside the `.tsx` (consistent with the project's "pure logic module is the testable surface" convention) |
| SET-06 | Union grouping covers 4 providers; save/staleness end-to-end against a 4-provider chain | unit (`groupByProvider`) + existing action test (`settings.test.ts` REG-07 case, already passing) | `npx vitest run src/components/settings/model-picker-logic.test.ts -t "groupByProvider"` + `npx vitest run src/app/actions/settings.test.ts` | ✅ save-path already covered; grouping needs a 4-provider fixture case |

### Sampling Rate
- **Per task commit:** `npx vitest run src/components/settings/model-picker-logic.test.ts`
- **Per wave merge:** `npm test` (full suite — also re-runs `catalog.test.ts`'s row-count canaries, which will catch any accidental hardcoding of stale 49/336 numbers per Pitfall 5)
- **Phase gate:** Full suite green + `npx tsc --noEmit` clean + `next build` exit 0 before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `model-picker-logic.test.ts` — new `describe` block for `endpointLabel()`/`rowCaption()`/`searchValue()` endpoint composition (SET-03), using a synthetic fixture (no live opencode row currently has a compound endpoint+suffix caption — see Anti-Patterns)
- [ ] `model-picker-logic.test.ts` — new `describe` block for the Hermes capability caption + cost-suppression rule (SET-04), blocked on Open Question 1
- [ ] `model-picker-logic.test.ts` — 4-provider fixture for `primaryAfterProviderSwitch`/`groupByProvider` (currently only a 2-provider fixture exists) — covers SET-02/06's verification gap (Pitfall 6)
- [ ] Recommend extracting the badge-resolution logic (Pitfall 3's fix) into a small named pure function in `model-picker-logic.ts` rather than an inline JSX expression, purely so it gets unit coverage — this is the single highest-value test to add given it fixes a real, currently-shipping bug

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Unchanged — `requireStaffAccess()` gate already in place, not touched by this phase |
| V3 Session Management | no | Unchanged |
| V4 Access Control | no | Unchanged — Settings page/action already staff-gated |
| V5 Input Validation | yes (unchanged) | `settingsInputSchema` (zod) + union-membership gate in `settings.ts` — NOT modified by this phase; this phase only adds display-layer fields, never new save-path input shapes |
| V6 Cryptography | no | No secrets/crypto touched — this phase never reads `NOUSRESEARCH_API_KEY`/`OPENCODE_API_KEY` |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Client-bundle leakage of the committed catalog snapshot (1000+ rows incl. cost data) or of secret env vars | Information Disclosure | T-17-09 discipline: `model-picker-logic.ts` stays a type-only catalog import; all catalog value-reads stay server-side in `page.tsx`. This phase's new `endpoint` field must be threaded the SAME way (derived server-side, passed as plain prop data) — do not import `catalog.ts` as a value anywhere in a `'use client'` file. |
| Misleading UI badge causing a staff member to believe a model runs on a provider whose API key isn't configured (or vice versa) | Spoofing (of routing intent, not of identity) | This is exactly Pitfall 3/7's finding — while not a traditional security vulnerability, an inaccurate badge/hint could cause an operator to believe a request will use `NOUSRESEARCH_API_KEY`/`OPENCODE_API_KEY` when it will actually use `ANTHROPIC_API_KEY` (or vice versa), which has real cost/billing and data-residency implications given this app talks to 4 different external inference providers. Fixing the badge accuracy (SET-05) is the mitigation. |
| Future security-grep widening (Phase 27, VER-04) failing due to literal key-name strings introduced in client code this phase | Information Disclosure (pre-emptive) | Pitfall 8 — never write `NOUSRESEARCH_API_KEY`/`OPENCODE_API_KEY` literals in any file this phase touches; only lowercase provider ids and display names are safe |

## Sources

### Primary (HIGH confidence — direct source reads + live code execution)
- `/Users/mkonovalov/Projects/360-arclumen/src/components/settings/model-picker-logic.ts` — pure logic module, full read
- `/Users/mkonovalov/Projects/360-arclumen/src/components/settings/model-picker.tsx` — picker rendering, full read
- `/Users/mkonovalov/Projects/360-arclumen/src/components/settings/model-settings-form.tsx` — form/state, full read
- `/Users/mkonovalov/Projects/360-arclumen/src/app/(dashboard)/settings/page.tsx` — server trim/props boundary, full read
- `/Users/mkonovalov/Projects/360-arclumen/src/app/actions/settings.ts` and `settings.test.ts` — save-path action + tests, full read
- `/Users/mkonovalov/Projects/360-arclumen/src/lib/models/catalog.ts` and `catalog.test.ts` — registry, precedence, dedup logic + existing test canaries, full read
- `/Users/mkonovalov/Projects/360-arclumen/src/lib/agents/modelFactory.ts` — run-path dispatch (ground truth for badge accuracy), full read
- `/Users/mkonovalov/Projects/360-arclumen/src/components/ui/badge.tsx` — badge primitive/variants
- `npx tsx` live execution against `catalog.json`/`catalog.ts` — verified row counts (40 opencode, 337 openrouter, 2 nousresearch, 1 anthropic), verified `getProviderForModelId` resolution for the 3 collision ids, verified cost data on the openrouter Hermes mirror rows
- `git log -- src/components/settings/model-picker-logic.ts` — confirmed Phase 23 commit `81deccb3` already widened `PROVIDER_NAMES` to 4 entries
- `.planning/milestones/v1.4-phases/21-settings-ui/21-UI-SPEC.md` — Phase 21's copywriting/row-anatomy/color contract (the form being extended)
- `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md` — SET-01..06 exact wording, Phase 26 success criteria
- `.planning/phases/26-settings-ui/26-CONTEXT.md` — locked decisions (reproduced verbatim above)
- `.planning/config.json` — confirmed `nyquist_validation: true`, `security_enforcement: true`

### Secondary (MEDIUM confidence)
- `.planning/PROJECT.md` — Phase 19/23/24/25 changelog entries, cross-referenced against direct source reads for consistency

### Tertiary (LOW confidence)
- None — every substantive claim in this document was independently verified against the live codebase/catalog rather than relying on the CONTEXT.md/ROADMAP.md narrative alone.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, all existing code read directly
- Architecture: HIGH — every data-flow claim traced through actual source, cross-checked with live `tsx` execution
- Pitfalls: HIGH — all 8 pitfalls are either verified bugs (Pitfall 3), verified data contradictions (Pitfalls 2, 5), or verified documentation errors (Pitfall 1), not speculative

**Research date:** 2026-08-04
**Valid until:** Next catalog refresh (`scripts/refresh-model-catalog.ts` run) — row counts and the specific colliding ids (Pitfall 3) could shift; the STRUCTURAL findings (badge-resolution bug, `settings.ts`/`page.tsx` location correction, testing gaps) remain valid regardless of snapshot content.
