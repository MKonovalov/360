# Phase 23: Provider Registry + Servable Sources — Research

**Researched:** 2026-08-03
**Domain:** Catalog registry extension — 4-provider model identity, per-provider servable gates, priority-ordered resolution, Zen-wins dedup, collision canaries
**Confidence:** HIGH (every data claim verified by direct computation against the committed `catalog.json`; every code claim verified by direct read of the integration points)

## Summary

Phase 23 grows the v1.4 two-provider registry (`catalog.ts`) to four logical providers. The work is **pure registry code + canary tests — zero new runtime packages** (`@ai-sdk/openai-compatible` installation is explicitly a Phase 25 concern per CONTEXT.md line 11; REG-02's literal "is installed" text is superseded by the locked phase boundary — Phase 23 ships only the env-key declarations). The phase is LOW risk (research flag) but has **three precision traps** the planner must encode correctly:

1. **The priority-order prose is ambiguous and the naive reading fails the hermes canary.** The roadmap/CONTEXT phrase "anthropic → openrouter → nousresearch-over-openrouter → opencode" cannot be implemented as a literal first-servable-match over that array — openrouter's full-catalog gate makes `nousresearch/hermes-4-70b`/`405b` servable under openrouter, so openrouter-first would resolve the hermes pair to openrouter and FAIL the locked D-23-07 canary. The implementation MUST rank nousresearch above openrouter: precedence array `['anthropic', 'nousresearch', 'openrouter', 'opencode']` with **servable-membership** checks (never raw row existence).
2. **"49 rows" (D-23-02) is the pre-dedup count; the registry output is 39.** Verified: the opencode+opencode-go block is 77 rows (npm split 30 chat / 19 Claude / 23 GPT / 5 Gemini); the npm gate admits 49 raw rows (30+19); Zen-wins dedup collapses 10 dual pairs servable on both sides → the deduped 65-row pool (23/16/5/21) → **39 servable ids (23 + 16, zero GPT/Gemini)**. The count-stability canary must lock the post-dedup registry output (39), with the 49 reconciled in a comment — locking "49" would assert something the registry never returns and would not actually lock the servable set.
3. **The resolver's semantics change flips one existing canary deliberately.** Current `getProviderForModelId` uses raw-row existence; the phase goal ("every servable model id resolves to exactly one provider, no silent provider swaps") requires **servable-membership** resolution. This flips `claude-sonnet-5` from `'anthropic'` → `'opencode'` (it is NOT in the anthropic sonnet-only allowlist; its opencode Claude row IS npm-gated servable) and `big-pickle` from `null` → `'opencode'`. Both are deliberate reworks (repo convention: rework, never delete), documented below. The raw-existence alternative silently misroutes ~265 Phase-24 Nous ids (raw nousresearch rows, not allowlisted) to nousresearch instead of openrouter — a landmine for Phase 25.

**Primary recommendation:** Extend `catalog.ts` with (a) `ModelProviderId` → 4 + `SNAPSHOT_PROVIDER_IDS` mapping (opencode → `['opencode','opencode-go']` — the ordering IS the Zen-wins rule), (b) a `ProviderGate = { allowlist?, npm? }` shape with `PROVIDER_GATES.nousresearch` (allowlist pins) + `PROVIDER_GATES.opencode` (npm gate), (c) a single dedup helper returning **rows** (Phase 26's trimRow reuses it), (d) servable-membership precedence resolution `['anthropic','nousresearch','openrouter','opencode']`, (e) a registry-driven `providerName()` consumed by BOTH `model-picker-logic.ts` and the second hardcoded branch at `settings/page.tsx:93` (the v1.4 form already renders the selector — growing SERVABLE_PROVIDERS renders 4 entries immediately, and mislabels the two new ones "OpenRouter" unless fixed this phase). Then extend the canary suite per the Validation Architecture map.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Provider identity (id → provider) | Registry (`catalog.ts`) | — | D-01 derive-don't-persist; the resolver is the single source of truth consumed by factory, run path, page props |
| Per-provider servable sets (gates) | Registry (`catalog.ts`) | Settings page props | Gates are DATA in `PROVIDER_GATES`; the page trims them into props (T-17-09 client-bundle contract) |
| Zen/Go dual-listed-id dedup | Registry (`catalog.ts`) | Refresh script (must stay format-only, D-23-08) | D-23-08: ONE helper in the registry layer; expressed once, survives regeneration by construction |
| Display names (`providerName()`) | Client-safe meta module (`model-picker-logic.ts` or sibling) | Settings page (server) | REG-01/T-17-09: type-only import from catalog; a 4-string map is client-safe; page consumes the same map (removes the page.tsx:93 branch) |
| Default models per provider | `modelFactory.ts` (`PROVIDER_DEFAULT_MODELS`) | Phase 26 reset-to-provider-default | D-07 home; `Record<ModelProviderId, string>` TS-enforces completeness |
| Save validation (union membership) | Server Action (`settings.ts`) | Registry union | REG-07: structurally unchanged; membership-based over `getUnionServableIds` |
| Env key declarations | `env.ts` / `.env.example` / Vercel env | — | REG-02: declaration-only this phase (enforcement = Phase 25 chain-aware gate) |
| Run-path instantiation dispatch | `modelFactory.ts` `instantiateModel` | — | **Phase 25, NOT this phase** — Phase 23 leaves the 2-provider dispatch branches intact |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript (strict, `astro/tsconfigs/strict` base) | 5.9.3 installed | Registry types; `ModelProviderId` union + `Record<ModelProviderId, …>` maps | TS exhaustiveness is the tool that FORCES the 4-provider entries (PITFALLS Pitfall 9) — the existing strict config already covers catalog.ts |
| `catalog.json` committed snapshot | 1131 rows, generatedAt 2026-08-02T19:27:33 | The only runtime model source (menu); per-row `providerID`/`api.npm`/`api.url` | D-02/D-18-03 snapshot discipline; all Phase 23 canaries are pure reads of it |

### Supporting (no new packages this phase)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest | 4.1.10 installed (`npm test` = `vitest run`) | Canary suite (fixture + live-snapshot dual convention, D-16 zero-live-call) | All Phase 23 verification; no config file needed (defaults pick up `*.test.ts`) |
| `@ai-sdk/openai-compatible` | **3.0.20** (npm latest, verified 2026-08-03) | **Phase 25** install target for the three new instances | NOT this phase — CONTEXT.md line 11 locks the install to Phase 25; Phase 23 references it only as the npm-gate VALUE |
| zod | 4.4.3 installed | `env.ts` optional-key schema | `NOUSRESEARCH_API_KEY`/`OPENCODE_API_KEY` mirror `OPENROUTER_API_KEY` (`z.string().optional()`, line 41) |
| vercel CLI | 58.4.4 available | Vercel env add (REG-02 "Vercel env") | Ops step for key declarations; needs Vercel auth — see Open Questions |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Servable-membership resolution (`id ∈ getServableIdsForProvider(p)`) | Extend the existing raw-row scoped `find()` with the two new providerIDs | Raw-row existence makes every Phase-24 nousresearch snapshot row (292, incl. 265 openrouter collisions) resolve to nousresearch regardless of the allowlist → silent swap at instantiation in Phase 25. Servable-membership is the only semantic consistent with the phase goal. |
| Precedence `['anthropic','nousresearch','openrouter','opencode']` | Literal roadmap array `['anthropic','openrouter','nousresearch','opencode']` | The literal array fails the D-23-07 hermes canary (openrouter's full-catalog gate serves the hermes mirrors). The roadmap's "nousresearch-over-openrouter" phrasing must be implemented as nousresearch outranking openrouter. |
| Zen-wins via `SNAPSHOT_PROVIDER_IDS.opencode = ['opencode','opencode-go']` ordering (first-wins dedup) | A hardcoded `if (provider === 'opencode')` branch in the dedup helper | Data-driven ordering expresses the rule once and survives regeneration (CAT-04); a hardcoded branch duplicates the mapping |
| One shared `providerName()` map (model-picker-logic + page.tsx) | Fix only the `model-picker-logic.ts` branch, leave `settings/page.tsx:93` | The v1.4 form already renders the selector; growing SERVABLE_PROVIDERS renders 4 entries immediately — page.tsx:93 mislabels NousResearch/OpenCode "OpenRouter" (PITFALLS Pitfall 9 class). Both branches must die this phase. |

**Installation:** none — Phase 23 ships registry code only. `@ai-sdk/openai-compatible@^3.0.20` installs in Phase 25.

**Version verification (run 2026-08-03):** `@ai-sdk/openai-compatible` latest **3.0.20** (modified 2026-07-31), `ai` **7.0.49** (installed `^7.0.45`), `zod` **4.4.3**, `vitest` **4.1.10** — all `npm view`-verified.

## Package Legitimacy Audit

> Phase 23 installs **no** external packages (CONTEXT.md line 11: the `@ai-sdk/openai-compatible` installation is a Phase 25 concern). Slopcheck protocol therefore has no install list to gate; the one package referenced by Phase 23's npm-gate data (`@ai-sdk/openai-compatible`) is a Phase 25 install that v1.5 research already verified against the npm registry (latest 3.0.20, deps `@ai-sdk/provider@4.0.4` + `@ai-sdk/provider-utils@5.0.18`, peer `zod ^3.25.76 || ^4.1.8` — satisfied by the installed tree) and re-confirmed this session via `npm view`.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| *(none installed this phase)* | — | — | — | — | — | N/A — Phase 25 install |
| `@ai-sdk/openai-compatible` (Phase 25, referenced by gate data) | npm | ≥1 yr (3.x line) | high (AI SDK official) | vercel/ai | not run (not installed this phase) | Deferred to Phase 25 — re-run gate there |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none
**Phase 25 flag:** re-run the Package Legitimacy Gate when `@ai-sdk/openai-compatible@^3.0.20` is actually installed (add it to Phase 25's RESEARCH).

## Architecture Patterns

### System Architecture Diagram

```
                        committed catalog.json (1131 rows)
                        providerID: opencode | opencode-go | anthropic | openrouter | …
                        per-row: id, api.npm, api.url, cost, status
                                    │
                                    ▼
                     ┌────────────────────────────────────────┐
                     │            REGISTRY (catalog.ts)       │
                     │  SNAPSHOT_PROVIDER_IDS:                │
                     │    opencode → ['opencode','opencode-go']│  ← ordering = Zen-wins
                     │  PROVIDER_GATES (data):                │
                     │    anthropic {allowlist}               │
                     │    openrouter {}                       │
                     │    nousresearch {allowlist: hermes pair}│
                     │    opencode {npm: [openai-compatible,  │
                     │              anthropic]}                │
                     │                                        │
                     │  dedupeProviderRows(provider)          │  → deduped row pool
                     │  getServableIdsForProvider(provider)   │  → dedup → gate → ids
                     │  getUnionServableIds()                 │  → Set-deduped union
                     │  getProviderForModelId(id)             │  → precedence iterate
                     └──────┬───────────────┬────────────────┘
                            │               │
                servable ids / union    provider identity
                            │               │
              ┌─────────────┼───────────────┼──────────────────┐
              ▼             ▼               ▼                  ▼
   settings/page.tsx   settings.ts      modelFactory.ts     model-picker-logic.ts
   (servableByProvider, (save validation (PROVIDER_DEFAULT_  (providerName map,
   unionServableModels, REG-07)         MODELS + 4 entries)  client-safe)
   providers names)
```

Primary flow traced: `catalog.json` rows → registry gates/dedup → `getServableIdsForProvider('opencode')` returns 39 ids → settings page props → (Phase 26) picker. Resolution flow: a servable id → `getProviderForModelId` iterates `['anthropic','nousresearch','openrouter','opencode']`, first provider whose **servable set** contains the id wins.

### Recommended Project Structure (no new directories)

```
src/lib/models/
├── catalog.ts              # registry core — ModelProviderId(4), SNAPSHOT_PROVIDER_IDS,
│                           #   ProviderGate, PROVIDER_GATES(4), NOUSRESEARCH_ALLOWLIST,
│                           #   dedupeProviderRows, getServableIdsForProvider,
│                           #   getUnionServableIds, getProviderForModelId (precedence),
│                           #   PROVIDER_PRECEDENCE const
├── catalog.test.ts         # extended fixture + canaries (count-stability, no-flip, hermes,
│                           #   reworked claude-sonnet-5/big-pickle, SERVABLE_PROVIDERS=4)
└── catalog.json            # unchanged (Phase 24 regenerates)
src/lib/agents/
├── modelFactory.ts         # PROVIDER_DEFAULT_MODELS → 4 entries (nousresearch + opencode);
│                           #   instantiateModel dispatch UNCHANGED (Phase 25)
├── modelFactory.test.ts    # defaults map 4-entry + opencode-default servable assertions
├── modelConfig.ts          # UNCHANGED — resolveModelChain already derives from the union
src/components/settings/
├── model-picker-logic.ts   # providerName() → registry-driven 4-entry map (type-only import)
├── model-picker-logic.test.ts  # providerName 4-entry assertions
src/app/(dashboard)/settings/page.tsx  # providers names ← shared map (line 93 branch removed)
src/app/actions/settings.ts # UNCHANGED structurally — union validation covers 4 providers
src/lib/env.ts              # + NOUSRESEARCH_API_KEY, OPENCODE_API_KEY (z.string().optional())
.env.example                # + both keys, no value
```

### Pattern 1: Provider-gate data shape (extend, don't branch)

**What:** Keep gates as DATA (D-01/D-02 doctrine). The `Record<ModelProviderId, { allowlist? }>` shape grows an `npm?` variant for the opencode protocol gate; a present `npm` list filters the deduped pool's `api.npm`, a present `allowlist` filters ids, neither means full active set (openrouter).

```typescript
// src/lib/models/catalog.ts (shape — exact naming per CONVENTIONS.md, Claude's discretion)
export type ProviderGate = { allowlist?: readonly string[]; npm?: readonly string[] };

export const NOUSRESEARCH_ALLOWLIST: readonly string[] = [
  'nousresearch/hermes-4-70b',
  'nousresearch/hermes-4-405b', // D-23-05: concrete pins, never ~latest (D-07 doctrine)
];

export const OPENCODE_NPM_GATE: readonly string[] = [
  '@ai-sdk/openai-compatible', // 30 chat-completions rows
  '@ai-sdk/anthropic',         // 19 Claude rows (Zen /v1/messages via createAnthropic, Phase 25)
];

export const PROVIDER_GATES: Record<ModelProviderId, ProviderGate> = {
  anthropic: { allowlist: ANTHROPIC_ALLOWLIST },
  openrouter: {},                                  // full catalog (D-02)
  nousresearch: { allowlist: NOUSRESEARCH_ALLOWLIST }, // REG-04: curated, NOT the 292-row roster
  opencode: { npm: OPENCODE_NPM_GATE },            // D-23-01: data-driven by api.npm
};
```

### Pattern 2: Zen-wins dedup expressed once, data-driven

**What:** One helper spans the snapshot providerIDs for a logical provider and dedups by **first-providerID-wins** — `SNAPSHOT_PROVIDER_IDS.opencode = ['opencode','opencode-go']` makes the Zen row the winner by array order, so the rule is data, survives regeneration by construction (D-23-08/CAT-04), and the refresh script stays format-only.

```typescript
// The mapping — 'opencode' (Zen) FIRST is the deterministic Zen-wins rule.
export const SNAPSHOT_PROVIDER_IDS: Record<ModelProviderId, readonly string[]> = {
  anthropic: ['anthropic'],
  openrouter: ['openrouter'],
  nousresearch: ['nousresearch'],
  opencode: ['opencode', 'opencode-go'],
};

// Returns ROWS (not ids) — Phase 26's trimRow consumes the same deduped rows for
// the Zen/Go endpoint caption (SET-03) and the go-exclusive rows' api.url.
export function dedupeProviderRows(catalog: ModelCatalog, provider: ModelProviderId): CatalogModel[] {
  const ids = SNAPSHOT_PROVIDER_IDS[provider];
  const rows = catalog.models.filter((m) => ids.includes(m.providerID));
  const seen = new Set<string>();
  return rows.filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)));
}

// D-23-10 order: dedup FIRST, then the gate. getServableIdsForProvider('opencode')
// = npm-gate over the deduped 65-row pool → 39 ids (23 openai-compatible + 16
// anthropic, 0 GPT/Gemini). gpt-5.6-luna/grok-4.5 dedupe into the pool but the
// npm gate excludes them (their api.npm = @ai-sdk/openai, deferred to v2).
export function getServableIdsForProvider(catalog: ModelCatalog, provider: ModelProviderId): string[] {
  const pool = dedupeProviderRows(catalog, provider).filter((m) => m.status !== 'deprecated');
  const gate = PROVIDER_GATES[provider];
  if (gate.npm) return pool.filter((m) => gate.npm!.includes(m.api.npm)).map((m) => m.id);
  if (gate.allowlist) return pool.filter((m) => gate.allowlist!.includes(m.id)).map((m) => m.id);
  return pool.map((m) => m.id); // openrouter: full active set (D-02)
}
```

### Pattern 3: Priority-ordered servable-membership resolution

**What:** `getProviderForModelId` iterates an explicit precedence array and returns the FIRST provider whose **servable set** contains the id. Servable-membership (not raw row existence) is what makes the resolver order-independent of snapshot row order and honest for Phase-24's non-allowlisted nousresearch rows. **nousresearch must outrank openrouter** or the D-23-07 hermes canary fails.

```typescript
// PRECEDENCE — locked canaries force this exact ranking:
//   anthropic first (claude-sonnet-4-6 regression lock — also servable under
//     opencode's npm gate, so order is load-bearing),
//   nousresearch BEFORE openrouter (D-23-07: hermes pair beats their openrouter
//     mirrors — the roadmap's "nousresearch-over-openrouter" phrasing),
//   opencode LAST (only wins ids no earlier provider serves servably:
//     big-pickle, the dual-listed/deepseek-v4-flash class).
export const PROVIDER_PRECEDENCE: readonly ModelProviderId[] = [
  'anthropic', 'nousresearch', 'openrouter', 'opencode',
];

export function getProviderForModelId(catalog: ModelCatalog, id: string): ModelProviderId | null {
  for (const provider of PROVIDER_PRECEDENCE) {
    if (getServableIdsForProvider(catalog, provider).includes(id)) return provider;
  }
  return null;
}
```

### Pattern 4: Registry-driven `providerName()` (client-bundle-safe)

**What:** REG-01 kills both hardcoded 2-way branches. The map lives client-safe (type-only import from catalog — T-17-09; a 4-string map carries no snapshot weight) and is consumed by BOTH `model-picker-logic.ts` and the server page's provider-selector options.

```typescript
// src/components/settings/model-picker-logic.ts (or a small provider-meta sibling —
// Claude's discretion; must import ONLY the type, never a catalog value)
import type { ModelProviderId } from '@/lib/models/catalog';

export const PROVIDER_NAMES: Record<ModelProviderId, string> = {
  anthropic: 'Anthropic',
  openrouter: 'OpenRouter',
  nousresearch: 'NousResearch',
  opencode: 'OpenCode',
};

export function providerName(provider: ModelProviderId): string {
  return PROVIDER_NAMES[provider]; // Record completeness is TS-enforced at 4 entries
}
```

```tsx
// src/app/(dashboard)/settings/page.tsx — line 93 branch replaced by the same map
const providers = SERVABLE_PROVIDERS.map((id) => ({ id, name: providerName(id) }));
```

### Anti-Patterns to Avoid
- **Literal roadmap array `['anthropic','openrouter','nousresearch','opencode']`:** fails the hermes canary (openrouter full-catalog gate serves the mirrors). The "over" in "nousresearch-over-openrouter" is load-bearing — rank nousresearch second.
- **Raw-row-existence resolution:** flips Phase-24 nousresearch rows (not allowlisted) to nousresearch over servable openrouter ids — the exact silent-swap class the phase exists to prevent. Also keeps `claude-sonnet-5 → anthropic` (a lie — it's not servable under anthropic).
- **Hardcoding "49 rows" in the count canary:** the registry returns 39 post-dedup; a 49-assertion fails immediately and locks nothing. Reconcile in the comment.
- **A hardcoded `if (provider === 'opencode')` in the dedup:** duplicates the snapshot-providerID mapping in a second place; `SNAPSHOT_PROVIDER_IDS` ordering is the single source.
- **Touching `instantiateModel` dispatch or `refresh-model-catalog.ts`:** Phase 25 / Phase 24 work respectively (D-23-08: refresh script stays format-only).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-provider servable computation | A bespoke opencode-only id list | The npm-gate over the deduped pool (D-23-01) | New OpenCode chat/Claude models become servable on refresh — the gate is data, the canary is the review |
| Zen/Go dedup rule | Logic duplicated in the refresh script | ONE `dedupeProviderRows` helper in the registry (D-23-08) | Survives regeneration by construction; refresh stays format-only |
| Provider display names | Two inline ternaries | One `PROVIDER_NAMES` map (REG-01) | Every future provider is a one-line addition; TS forces completeness; the client-bundle stays clean |
| Default-model map growth | A partial map / manual exhaustiveness | `Record<ModelProviderId, string>` (TS-enforced) | Missing a provider's default = compile error, not a Phase-26 provider-switch crash (PITFALLS Pitfall 9.3) |

**Key insight:** this phase is entirely pure-function registry code over committed data. Everything the canary suite needs already exists (`catalog.json`, the fixture convention, the Vitest setup). There is nothing to hand-roll — the risk is in the *semantics* (servable-membership, precedence ranking, post-dedup counts), which the canaries lock.

## Runtime State Inventory

> Skip-trigger: Phase 23 is a registry-extension phase (not rename/refactor/migration), so the full inventory does not apply. One live-service item IS in scope (REG-02 names it explicitly):

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Live service config | **Vercel project env**: `NOUSRESEARCH_API_KEY` + `OPENCODE_API_KEY` (optional, server-only) to add per REG-02 "Vercel env" | `vercel env add` (CLI 58.4.4 available; needs Vercel auth) — see Open Questions for timing (keys have no values until provisioning) |
| Stored data | None — no DB/collection changes; provider identity stays derived (D-01), `user_model_settings` schema untouched | — |
| OS-registered state | None | — |
| Secrets/env vars | `env.ts` + `.env.example` declarations (code change); `.env.local` untouched (keys optional) | code edit |
| Build artifacts | None | — |

## Common Pitfalls

### Pitfall 1: The hermes canary fails if precedence is implemented literally from the roadmap prose
**What goes wrong:** The planner/executor reads "anthropic → openrouter → nousresearch-over-openrouter → opencode" as an array and writes `['anthropic','openrouter','nousresearch','opencode']`. `getProviderForModelId(fixture, 'nousresearch/hermes-4-70b')` → openrouter (full-catalog gate serves the mirror row) → the D-23-07 canary goes red and the locked decision is violated.
**Why it happens:** The phrase "nousresearch-over-openrouter" is a ranking modifier, not a list position — easily misread as position 3.
**How to avoid:** Encode the ranking as `['anthropic','nousresearch','openrouter','opencode']` with a comment citing D-23-07; the fixture canary (hermes ids + openrouter mirrors both present) is the enforcement.
**Warning signs:** The precedence array's index 1 is `'openrouter'`.

### Pitfall 2: Servable-membership flip of `claude-sonnet-5` treated as a bug instead of the intended semantic
**What goes wrong:** The existing snapshot canary `claude-sonnet-5 → 'anthropic'` (catalog.test.ts:186-188) fails. An executor "fixes" it back by reverting to raw-row resolution, silently re-arming the Phase-25 nousresearch landmine.
**Why it happens:** The v1.4 canary locked raw-row existence over a 2-provider scope — a semantic that was correct only because opencode wasn't servable. The v1.5 phase goal ("every servable model id resolves to exactly one provider") demands servable-membership.
**How to avoid:** Rework the canary deliberately (never delete): `claude-sonnet-5 → 'opencode'` with a comment explaining the semantic change (not in the anthropic allowlist; opencode Claude row is npm-gated). Same for `big-pickle`: `null → 'opencode'` (PITFALLS Pitfall 2 names this exact inversion).
**Warning signs:** An executor edits `getProviderForModelId` to make an old raw-existence canary pass instead of reworking the canary.

### Pitfall 3: The count-stability canary asserts the pre-dedup "49" and fails on the registry's 39
**What goes wrong:** D-23-02's text says "49 rows: 30 chat + 19 Claude". A canary asserting `getServableIdsForProvider(catalogJson,'opencode').length === 49` fails immediately (it's 39) or — worse — someone "fixes" it by asserting against the raw block (which doesn't lock the servable set the picker consumes).
**Why it happens:** The dedup (D-23-08) collapses 10 dual servable pairs before the npm gate (D-23-10); the CONTEXT text counted rows pre-dedup.
**How to avoid:** Lock the registry output: 39 unique ids, npm split `{openai-compatible: 23, anthropic: 16}`, zero `@ai-sdk/openai`/`@ai-sdk/google` ids — plus the deduped-pool shape (65 rows, 12 dual → Zen URL, 5 go-exclusive → Go URL). Comment reconciles "49 = 30+19 pre-dedup; 10 dual pairs collapse → 39".
**Warning signs:** A canary named `count-stability` comparing to 49, or to the raw `77`.

### Pitfall 4: The second hardcoded branch (`settings/page.tsx:93`) survives and ships mislabeled providers
**What goes wrong:** REG-01's map replaces only `model-picker-logic.ts:26-28`. Growing `SERVABLE_PROVIDERS` to 4 makes the ALREADY-RENDERED v1.4 selector show 4 entries — NousResearch and OpenCode labeled "OpenRouter" (the `id === 'anthropic' ? 'Anthropic' : 'OpenRouter'` branch).
**Why it happens:** The branch lives in a server component nobody greps for when fixing the client-side function.
**How to avoid:** Phase 23 replaces BOTH branches with the shared `PROVIDER_NAMES` map; add a canary-free assertion via the `SERVABLE_PROVIDERS` test (4 entries) and the shared-map tests. Visual verification is Phase 26 (success criterion 1 "can render 4 data-driven entries").
**Warning signs:** Any `=== 'anthropic' ?` ternary remaining in `src/` after the phase.

### Pitfall 5: Phase-23 tests assert nousresearch servability against the live snapshot (no rows yet)
**What goes wrong:** A "every default id is servable for its provider" test (v1.4 WR-01 class) asserts `getServableIdsForProvider(catalogJson,'nousresearch')` contains `nousresearch/hermes-4-70b` → fails: the snapshot has **0 nousresearch rows** (Phase 24 lands them).
**Why it happens:** The allowlist is code-declared in Phase 23 (D-23-05) but the data is Phase 24 (D-23-07: fixture-based canary now, live-snapshot canary in Phase 24).
**How to avoid:** Phase 23's nousresearch assertions are fixture-based only (fixture carries the rows). The live-snapshot servability assertion for the nousresearch default is a **Phase 24** task (D-23-07). Assert `PROVIDER_DEFAULT_MODELS` completeness (4 entries) and opencode/anthropic/openrouter defaults against the live snapshot now.
**Warning signs:** A Phase-23 test importing `catalogJson` asserting a `nousresearch` id is servable.

## Code Examples

Verified patterns from the current codebase (source: `src/lib/models/catalog.ts`, `src/lib/models/catalog.test.ts`, `src/lib/agents/modelFactory.ts` — read 2026-08-03):

### The existing gate iteration to extend (Pattern 1 base)
```typescript
// catalog.ts:49-52 — today's shape; grows to the ProviderGate union
export const PROVIDER_GATES: Record<ModelProviderId, { allowlist?: readonly string[] }> = {
  anthropic: { allowlist: ANTHROPIC_ALLOWLIST },
  openrouter: {},
};
```

### The fixture convention to extend (fixture + live-snapshot dual canary)
```typescript
// catalog.test.ts:22-103 — inline fixture, deliberately decoupled from catalog.json.
// Phase 23 additions to the fixture: hermes-4-70b + hermes-4-405b as BOTH
// nousresearch (allowlisted) AND openrouter (mirror) rows; deepseek-v4-flash as
// BOTH opencode (Zen) and opencode-go (Go) rows; hy3 as opencode-go-only.
// Fixture canaries: hermes pair → 'nousresearch' (D-23-07, mirror rows present so
// non-vacuous); deepseek-v4-flash → 'opencode' + Zen URL row; hy3 → 'opencode' + Go URL row.
```

### The default-map extension (D-23-03/D-23-06)
```typescript
// modelFactory.ts:28-31 — grows to 4; TS enforces completeness
export const PROVIDER_DEFAULT_MODELS: Record<ModelProviderId, string> = {
  anthropic: FAST_MODEL_ID,                       // claude-sonnet-4-6
  openrouter: OPENROUTER_DEFAULT_MODEL_ID,        // anthropic/claude-sonnet-4.6
  nousresearch: NOUSRESEARCH_DEFAULT_MODEL_ID,    // 'nousresearch/hermes-4-70b' (D-23-06)
  opencode: OPENCODE_DEFAULT_MODEL_ID,            // 'claude-sonnet-4-6' (D-23-03, roster-verified servable under the npm gate)
};
```

### The env declaration to mirror (REG-02, source `src/lib/env.ts:41`)
```typescript
OPENROUTER_API_KEY: z.string().optional(),        // existing precedent (line 41)
NOUSRESEARCH_API_KEY: z.string().optional(),      // new — server-only, non-PUBLIC_, degrade-gracefully (D-15)
OPENCODE_API_KEY: z.string().optional(),          // new — ONE key shared Zen+Go (verified)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 2-provider `ModelProviderId` union + raw-row scoped `find()` resolver | 4-provider union + servable-membership precedence iteration | Phase 23 (v1.5) | Order-independent resolution; Phase-24 nous rows can't shadow openrouter; `claude-sonnet-5`/`big-pickle` canaries reworked |
| Gates as `{ allowlist? }` only | `{ allowlist?, npm? }` — opencode gated by `api.npm` values (D-23-01) | Phase 23 | New OpenCode chat/Claude models self-enter the servable set on refresh; GPT/Gemini rows self-exclude forever |
| Dedup by id-Set at the union | Zen-wins row dedup in the registry (D-23-08) | Phase 23 | Endpoint identity preserved per row (Zen vs Go) for Phase 25 dispatch + Phase 26 captions |

**Deprecated/outdated:**
- **Raw-row-existence resolution** (`find(m => m.id === id && providerID-scope)`): superseded by servable-membership — its `claude-sonnet-5 → anthropic` canary is a v1.4 artifact that becomes false in v1.5.
- **The 2-way `providerName` ternary** (`provider === 'anthropic' ? 'Anthropic' : 'OpenRouter'`): superseded by the 4-entry map (REG-01); the page.tsx:93 twin is the same debt.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The roadmap phrase "anthropic → openrouter → nousresearch-over-openrouter → opencode" is implemented as precedence `['anthropic','nousresearch','openrouter','opencode']` (nousresearch outranks openrouter). If the user actually wants the literal array with hermes excluded from openrouter's servable set (PITFALLS Pitfall-1 option a), the union/dedupe surface changes (hermes appears once instead of twice) — Phase 26 SET-05 badge behavior differs. | Pattern 3 / Pitfall 1 | hermes canary fails under the literal reading; Phase 26 hermes badge either way needs a decision — see Open Questions Q2 |
| A2 | Servable-membership resolution (flipping `claude-sonnet-5 → opencode`) is the intended semantic. The alternative (keep raw-existence, rework nothing) preserves the old canary but misroutes Phase-24 nous rows. | Pitfall 2 | If the user prefers raw-existence, Phase 25 gains a silent-swap landmine; Phase 23 canaries change shape |
| A3 | The count-stability canary locks the post-dedup 39 (23+16) rather than D-23-02's literal "49". | Pitfall 3 | If "49" is insisted upon, it can only be asserted over the raw block (doesn't lock the servable set) — the canary loses its purpose |
| A4 | Phase 23 leaves `instantiateModel` dispatch 2-provider (opencode/nousresearch ids throw "unsupported provider" until Phase 25). | Summary / Anti-Patterns | If a consumer calls `instantiateModel` on a new-provider id mid-Phase-23, it throws — acceptable (not reachable via UI/save yet); do NOT add dispatch branches here |
| A5 | `settings/page.tsx:93` is in scope for Phase 23 (the v1.4 form already renders the selector; growing SERVABLE_PROVIDERS surfaces 4 entries immediately). | Pitfall 4 | If deferred to Phase 26, the app briefly ships NousResearch/OpenCode labeled "OpenRouter" |

## Open Questions (RESOLVED — decisions implemented in the Phase 23 plans; recorded 2026-08-04 at planning)

1. **Precedence-array vs exclusion for "nousresearch-over-openrouter" (A1).**
   - What we know: both make `getProviderForModelId(hermes) === 'nousresearch'`. Array keeps hermes servable under BOTH providers (union shows two entries — matches SET-05's "disambiguate via badges" letter); exclusion removes the openrouter mirror from the servable set (union shows one entry — matches PITFALLS Pitfall-1's "label the winner so the single entry is honest").
   - What's unclear: whether a Phase-26 user picking the OPENROUTER-badged hermes entry (which still resolves to nousresearch at runtime — bare-id storage) is acceptable UX.
   - Recommendation: Phase 23 uses the array (simpler, no cross-provider coupling). Flag the hermes badge-honesty nuance as an explicit Phase 26 (SET-05) decision.

2. **Vercel env timing for the two new keys.**
   - What we know: REG-02/roadmap list "Vercel env" as a Phase 23 deliverable; `vercel` CLI 58.4.4 is available but needs auth; the keys have no real values yet (optional, provisioned later).
   - What's unclear: adding empty placeholder env vars now vs at key-provisioning (Phase 25/27).
   - Recommendation: code declarations (`env.ts` + `.env.example`) land in Phase 23; the `vercel env add` step is a documented ops task (planner: gate behind `checkpoint:human-verify` or fold into Phase 25 when keys exist). Either is acceptable — confirm with user at planning.

3. **REG-02 vs CONTEXT tension on the package install.**
   - What we know: REG-02's literal text says "@ai-sdk/openai-compatible@^3.0.20 is installed"; CONTEXT.md line 11 (the later, locked phase boundary) says "The @ai-sdk/openai-compatible installation is a Phase 25 concern — Phase 23 ships registry code only".
   - What's unclear: nothing — CONTEXT wins (it is the discuss-phase output and the roadmap's phase shape).
   - Recommendation: Phase 23 = env declarations only; the npm install belongs to Phase 25's RUN-01. No action needed unless the planner re-scopes.

4. **The go-exclusive trimRow miss in `settings/page.tsx` (5 opencode-go rows).**
   - What we know: `trimRow(id, 'opencode')` finds `providerID === 'opencode'` only; the 5 go-exclusive ids (hy3, mimo-v2.5, mimo-v2.5-pro, qwen3.7-max, qwen3.7-plus) live under `opencode-go` → name/cost fall back to raw id/0 in Phase 23's page render.
   - What's unclear: whether Phase 23 should switch `trimRow` to consult `dedupeProviderRows` (returns rows; the go-exclusive row IS found) or leave the cosmetic fallback for Phase 26's SET-03 rework.
   - Recommendation: switch `trimRow` to the deduped-row helper in Phase 23 (one-line change, kills the fallback, and validates the helper's row return shape for Phase 26). Planner's call — either is phase-safe.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | test suite / registry code | ✓ | v22.23.1 | — |
| npm | `npm test` | ✓ | 10.9.8 | — |
| Vitest | canary suite | ✓ | 4.1.10 (`npm test` = `vitest run`, no config file) | — |
| tsx | dev scripts | ✓ | 4.23.1 | — (Phase 24) |
| vercel CLI | REG-02 Vercel env step | ✓ | 58.4.4 | manual dashboard; needs auth |
| `@ai-sdk/openai-compatible` | Phase 25 only | ✗ (not installed — correct) | — | Phase 25 install |

**Missing dependencies with no fallback:** none — Phase 23 is code + tests only.
**Missing dependencies with fallback:** Vercel env add requires interactive auth (`vercel login`); fallback = Vercel dashboard manual entry, or defer to Phase 25 (Open Questions Q2).
**Pre-existing test failure (not a Phase 23 regression):** `src/lib/agents/openrouter-only-chain.test.ts` (VER-03) fails in the current workspace — a live-key child-env e2e (needs a working `OPENROUTER_API_KEY` run). Baseline is otherwise 378 passed / 6 skipped. Do not chase it in Phase 23 (run-path is Phase 25+).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 (installed; `npm test` = `vitest run`) |
| Config file | none — defaults pick up `src/**/*.test.ts` (node env; mock-free for pure modules, D-16) |
| Quick run command | `npx vitest run src/lib/models/catalog.test.ts src/lib/agents/modelFactory.test.ts src/components/settings/model-picker-logic.test.ts src/app/actions/settings.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REG-01 | `SERVABLE_PROVIDERS` = 4; `providerName()` = 4-entry registry map, no ternaries; page.tsx:93 uses the map | unit | `catalog.test.ts` (SERVABLE_PROVIDERS equality) + `model-picker-logic.test.ts` (providerName 4 entries) | ✅ extend |
| REG-02 | `env.ts` + `.env.example` declare `NOUSRESEARCH_API_KEY`/`OPENCODE_API_KEY` optional server-only | unit (compile) | `npm test` (env schema parses with keys absent) | ✅ extend (assert via `npx vitest run` env import test) |
| REG-03 | opencode = ONE provider; Zen-wins dedup (12 dual → Zen, 5 go-exclusive → Go, 65-row pool); npm gate → 39 ids (23+16, 0 GPT/Gemini); no-flip canary | unit (fixture + snapshot) | `catalog.test.ts` — `dedupeProviderRows` assertions + count-stability (39) + no-flip (id lists + URLs) | ✅ extend |
| REG-04 | `PROVIDER_GATES.nousresearch.allowlist` = hermes pins; servable(nousresearch, fixture) = pair; servable(nousresearch, snapshot) = [] until Phase 24 | unit | `catalog.test.ts` fixture + snapshot assertions | ✅ extend |
| REG-05 | priority-ordered resolver: `claude-sonnet-4-6`→anthropic (regression lock), hermes pair→nousresearch (mirrors present), `big-pickle`→opencode, `anthropic/claude-sonnet-4.6`→openrouter, `deepseek-v4-flash`→opencode, `claude-sonnet-5`→opencode (rework) | unit | `catalog.test.ts` fixture + snapshot canaries | ✅ extend (2 reworks + 3 new) |
| REG-06 | `PROVIDER_DEFAULT_MODELS` = 4 entries; opencode default servable (snapshot), nousresearch default servable (FIXTURE — Phase 24 live) | unit | `modelFactory.test.ts` | ✅ extend |
| REG-07 | union-wide save validation covers 4 providers; cross-provider chain incl. opencode id saves | unit (mocked union) | `settings.test.ts` — new cross-provider case (mock `getUnionServableIds` with opencode + nousresearch ids) | ✅ extend |

### Sampling Rate
- **Per task commit:** `npx vitest run src/lib/models/catalog.test.ts` (the canary suite — <2s)
- **Per wave merge:** `npm test` (full suite; note the pre-existing live-key failure is unrelated)
- **Phase gate:** Full suite green before `/gsd-verify-work` (excluding the documented pre-existing `openrouter-only-chain` live-key case)

### Wave 0 Gaps
- None — all test files exist (catalog.test.ts, modelFactory.test.ts, model-picker-logic.test.ts, settings.test.ts); Vitest is installed; the work is in-place fixture extension + canary rework. No new framework config, no new fixtures file (extend the inline fixture per the existing convention).

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no change | `requireStaffAccess()` gate unchanged (Phase 23 adds no auth surface) |
| V3 Session Management | no change | Clerk session unchanged |
| V4 Access Control | no change | saveSettingsAction gate-first order immutable |
| V5 Input Validation | yes | `saveSettingsAction` zod + union-membership validation (structurally unchanged; grows via the union) |
| V6 Cryptography | no | keys are API credentials, not app-crypto; server-only env, never logged |

### Known Threat Patterns for {registry stack}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Silent provider swap (a saved id runs on a different provider than badged — Nous↔OpenRouter, Zen↔Go, claude rows↔Anthropic) | Spoofing | Deterministic servable-membership precedence + collision canaries (hermes pair, claude-sonnet-4-6 regression lock, no-flip dedup); PITFALLS Pitfalls 1-2 |
| Key leakage (`NOUSRESEARCH_API_KEY`/`OPENCODE_API_KEY` in a client bundle or `NEXT_PUBLIC_*`) | Information disclosure | Non-`PUBLIC_` names, server-only `env.ts`, declaration-only this phase; the Phase 27 (VER-04) security-matrix grep extends to the new keys |
| Id injection via the union (arbitrary ids reaching provider factories) | Tampering | Unchanged server-side membership validation — an id must resolve to a servable set before save; resolver returns null for unknown ids (fail-closed) |
| Cross-provider 429 same-provider invariant erosion | DoS (budget burn) | **Not Phase 23** — `shouldAdvance` is already provider-count-agnostic (`from !== to`, verified in modelConfig.test.ts:153-175); the 16-cell matrix is Phase 24/27 |

## Sources

### Primary (HIGH confidence)
- **Repo reads (2026-08-03):** `src/lib/models/catalog.ts` (registry core), `catalog.test.ts` (fixture + canary convention), `src/lib/agents/modelFactory.ts` (defaults map, constraint 11), `modelFactory.test.ts`, `src/lib/agents/modelConfig.ts` (+ `.test.ts` — shouldAdvance provider-agnostic), `src/lib/agents/runAgent.ts` (resolver consumers at :107-108), `src/components/settings/model-picker-logic.ts` (+ `.test.ts`), `src/components/settings/model-settings-form.tsx` (selector render at :219, providerName at :377), `src/app/(dashboard)/settings/page.tsx` (second hardcoded branch at :93, trimRow at :53), `src/app/actions/settings.ts` (+ `.test.ts`), `src/lib/env.ts`, `.env.example`, `scripts/refresh-model-catalog.ts`, `package.json`
- **Direct computation over committed `catalog.json` (2026-08-03):** 1131 rows, generatedAt 2026-08-02T19:27:33.099Z; opencode 60 + opencode-go 17 rows; npm split 30/19/23/5; 49 raw npm-gated rows (30+19); 12 dual-listed ids (gpt-5.6-luna + grok-4.5 excluded by the gate — @ai-sdk/openai); 5 go-exclusive ids (hy3, mimo-v2.5, mimo-v2.5-pro, qwen3.7-max, qwen3.7-plus); deduped 65-row pool (23/16/5/21); **39 servable ids (23+16, 0 GPT/Gemini)**; `claude-sonnet-4-6` opencode row at index 11 vs anthropic at 92; `claude-sonnet-5` dual opencode/anthropic (opencode row npm-gated servable, NOT in anthropic allowlist); openrouter hermes mirrors `nousresearch/hermes-4-70b`/`405b` active with `structuredOutputs: false`
- **npm registry (2026-08-03):** `@ai-sdk/openai-compatible` latest **3.0.20** (modified 2026-07-31), `ai` **7.0.49**, `zod` **4.4.3**, `vitest` **4.1.10**
- **Test baseline (2026-08-03):** `npm test` → 378 passed / 6 skipped / 1 failed (`openrouter-only-chain` — pre-existing live-key e2e, out of scope)

### Secondary (MEDIUM confidence)
- `.planning/research/SUMMARY.md` (v1.5 verified 2026-08-03 — priority-order trap, npm split, roster-verify doctrine) — cited, not re-verified against live endpoints this session (Phase 23 needs no live API)
- `.planning/research/STACK.md` — registry changes spec + precedence discussion (note: its `['anthropic','openrouter','opencode','nousresearch']` ordering at l.120 is SUPERSEDED by the locked roadmap/CONTEXT ranking — see Pitfall 1)
- `.planning/research/PITFALLS.md` — Pitfalls 1-2 (collision/precedence), 4 (Zen/Go), 9 (2-branch providerName), 5 (env key scope); `claude-sonnet-5`/`big-pickle` canary-rework guidance at Pitfall 2
- `.planning/milestones/v1.4-phases/19-provider-registry-servable-model-source/19-CONTEXT.md` — the v1.4 analog shape (D-01..D-11 precedent, gate-as-data, REG-07 membership)

### Tertiary (LOW confidence)
- None — all Phase 23 claims verified against repo data, tests, or the npm registry this session. `[ASSUMED]` items are listed in the Assumptions Log (A1-A5) and are product-semantic decisions, not facts needing external verification.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; existing Vitest/TS/zod verified installed and green
- Architecture: HIGH — every registry data claim computed directly from the committed snapshot this session (39/65/12/5/23/16); resolver semantics prescribed and canary-mapped
- Pitfalls: HIGH — all five pitfalls verified against concrete code lines and snapshot indices (claude-sonnet-5 flip, 49→39, page.tsx:93, precedence ranking, Phase-24 default servability)

**Research date:** 2026-08-03
**Valid until:** 2026-08-10 (30 days for the registry code; the snapshot-derived counts (39/65/12/5) are valid ONLY until Phase 24 regenerates `catalog.json` — the canaries are designed to trip loudly at that point, which is the intended D-02 behavior)
