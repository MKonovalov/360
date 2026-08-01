# Phase 10: Sidebar Token Foundation — Pattern Map

**Mapped:** 2026-08-01
**Files analyzed:** 3 (1 modified, 2 new)
**Analogs found:** 3 / 3

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/app/globals.css` (MODIFIED) | config (CSS design tokens) | n/a — static presentation | same file's `:root` sidebar-token block (globals.css:76-83) + `@layer base` (120-130) | exact (same file, same structure) |
| `src/lib/nav.ts` (NEW) | utility (pure function) | transform (string → union key \| null) | `src/lib/import/dedupKeys.ts` (pure fns, named exports, comments-explain-why); union-type precedent `src/lib/enrichment/apollo.ts:19-21` | role-match |
| `src/lib/nav.test.ts` (NEW) | test | unit | `src/lib/import/dedupKeys.test.ts` | exact |

**Scope fence (hard):** the phase touches ONLY these three files. `src/components/ui/sidebar.tsx` (702 lines, vendored) and `src/components/layout/app-sidebar.tsx` are **consumers only — UNTOUCHED** (PANE-02, Pitfall 5). Zero package changes; `package.json` diff must be empty (RESEARCH §Package Legitimacy Audit).

---

## Pattern Assignments

### `src/app/globals.css` (config — CSS design tokens; MODIFIED)

**Analog:** the file itself — the new block structurally mirrors the existing `:root` sidebar-token block; the `@theme inline` mapping is the load-bearing mechanism; the `@layer base` block is the cascade rival the companion rules must beat.

**Insertion point (verified):** after `:root`'s closing brace at line 84, before `.dark` at line 86. Do NOT touch lines 7-49 (`@theme inline`), 76-83 (`:root` sidebar tokens), or 86-118 (`.dark`, dead code).

**Structural template — `:root` sidebar-token block (globals.css:76-83):**
```css
  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.145 0 0);
  --sidebar-primary: oklch(0.205 0 0);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.97 0 0);
  --sidebar-accent-foreground: oklch(0.205 0 0);
  --sidebar-border: oklch(0.922 0 0);
  --sidebar-ring: oklch(0.708 0 0);
```

**Load-bearing mechanism — `@theme inline` mapping (globals.css:13-20, UNTOUCHED):**
```css
  --color-sidebar-ring: var(--sidebar-ring);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar: var(--sidebar);
```
This is why utilities like `bg-sidebar` emit `background-color: var(--sidebar)` inline — a scoped custom-property value on the attribute hook resolves per-element. Never convert to non-inline (Pitfall 1).

**Cascade rival — `@layer base` (globals.css:120-123) the companion rules must beat:**
```css
@layer base {
  * {
    @apply border-border outline-ring/50;
  }
```
The new `border-color`/`border-right-width`/`outline-color` companion rules must stay **unlayered** — unlayered author CSS beats Tailwind's layered base/utilities at equal specificity (Pitfall 2). Any `@layer` wrap re-loses.

**New block to write (verbatim from UI-SPEC §Token Contract; hex, NOT oklch — Pitfall 3):**
```css
/* Phase 10 — sidebar light theme (scoped; zero vendored edits; @theme inline untouched) */
[data-sidebar="sidebar"] {
  --sidebar: #fbfcfd;                   /* 1 panel — reference value (FEATURES.md) */
  --sidebar-foreground: #333333;        /* 2 base text 12.30:1; /70 labels 4.89:1 */
  --sidebar-primary: #333333;           /* 3 primary surface (letter-mark box, buttons) */
  --sidebar-primary-foreground: #ffffff;/* 4 on primary 12.63:1 */
  --sidebar-accent: #909090;            /* 5 hover/active pill — 3.11:1 vs panel (AA 1.4.11) */
  --sidebar-accent-foreground: #111111; /* 6 on pill 5.91:1; on panel 18.38:1 */
  --sidebar-border: #e5e7eb;            /* 7 hairline — gray-200 reference (decorative) */
  --sidebar-ring: #787878;              /* 8 focus ring — 4.30:1 vs panel */
}

/* Companion rules — same block/location in globals.css. Required for PANE-01/QLTY-02
   WITHOUT vendored edits (PITFALLS Pitfalls 3 & 5): */
[data-slot="sidebar-container"] {
  border-color: var(--sidebar-border);  /* hairline uses --sidebar-border, not global --border */
  border-right-width: 0.5px;            /* desktop-only element — reference 0.5px hairline */
}
[data-sidebar="sidebar"] * {
  outline-color: var(--sidebar-ring);   /* neutralizes global outline-ring/50 leak (≈1.7:1) */
}
```

**Consumer hook (verified in vendored `src/components/ui/sidebar.tsx` — proves the attribute-hook mechanism):**
- Mobile `SheetContent`: `data-sidebar="sidebar"` at `sidebar.tsx:186`, `bg-sidebar` at 189
- Desktop `sidebar-inner`: `data-sidebar="sidebar"` at 242, `bg-sidebar` at 244 — this single element covers expanded AND icon-collapsed (the `data-collapsible` attr at 211 only decorates it; Assumption A2)
- Desktop-only `data-slot="sidebar-container"` at `sidebar.tsx:229`; `border-r` (no color class) at 236 — the companion rule's target; absent on mobile sheet so the hairline can't leak
- Group labels render `text-sidebar-foreground/70` (404); menu buttons `data-active:bg-sidebar-accent` (469); badge `text-sidebar-foreground` (575); `--sidebar-width-icon: 3rem` (135, D3)

**Error handling:** n/a — static CSS, build-time constants, no user input reaches the block (ASVS V8).

---

### `src/lib/nav.ts` (utility — pure function; NEW)

**Analog:** `src/lib/import/dedupKeys.ts` — the repo's canonical "pure functions only" module (25 lines, three named pure exports, why-comments, no side effects). Union-type return precedent: `src/lib/enrichment/apollo.ts:19-21`. Total-function precedent: `src/lib/params/companyFilters.ts:27-33`.

**Imports pattern:** none — `nav.ts` is dependency-free (matches `dedupKeys.ts` which imports nothing). Plain named exports (repo convention; `dedupKeys.ts:5,14,21`, `columnMapping.ts:109,120,139`).

**Why-comment convention (copy from `dedupKeys.ts:1-3` and `app-sidebar.tsx:16-20`):**
```typescript
// Pure normalization functions for dedup key comparison (D-02, D-04).
// Stored in normalized form so the DB-level unique constraint is a plain
// column constraint — no expression index needed.
```
`nav.ts` gets the same 3-4 line why-block explaining: the `[id]`-detail highlight must never be silently broken by a drive-by `startsWith` "simplification" (QLTY-01; PITFALLS Pitfall 7); the key is the ROUTE segment (`'personas'`), not the label (`'Key Personas'`) (Pitfall 4).

**Union-type declaration pattern (`apollo.ts:19-21`, hand-written union — matches "`type` for unions" convention):**
```typescript
export type EnrichmentResult =
  | { ok: true; fields: EnrichedField[] }
  | { ok: false; reason: string };
```
`nav.ts` uses the simpler form: `export type NavKey = 'start' | 'companies' | 'personas' | 'reviews';`

**Total-function pattern (never throws, explicit allowlist — `companyFilters.ts:27-33`):**
```typescript
export function parseSelectedId(params: {
  [key: string]: string | string[] | undefined;
}): number | undefined {
  const raw = firstValue(params.selected);
  const id = raw ? Number(raw) : NaN;
  return Number.isNaN(id) ? undefined : id;
}
```
`getActiveNavKey` follows the same "any input → fixed union/null, never throws" discipline (ASVS V5 — explicit allowlist + boundary guard, no regex).

**Core function (per UI-SPEC §QLTY-01 contract; consumer expressions being extracted at `app-sidebar.tsx:39,48,57,66`):**
```typescript
export function getActiveNavKey(pathname: string): NavKey | null {
  if (pathname === '/') return 'start'; // exact — every route is a prefix match for '/'
  // Boundary guard: sibling prefixes like /companies-archive must not match.
  if (pathname === '/companies' || pathname.startsWith('/companies/')) return 'companies';
  if (pathname === '/personas' || pathname.startsWith('/personas/')) return 'personas';
  if (pathname === '/reviews' || pathname.startsWith('/reviews/')) return 'reviews';
  return null; // /sign-in, '', unknown
}
```

**Boundary-guard rationale (from the code this replaces, `app-sidebar.tsx:16-20`):**
```typescript
// Client Component: both Companies and Key Personas are now real routes, so
// "active" is computed from usePathname() rather than hardcoded (03-RESEARCH.md
// Pattern 5). .startsWith(), not exact equality, so /companies/[id] and
// /personas/[id] (added in Plan 03-03) both still highlight the correct
// single item (03-RESEARCH.md Pitfall 3).
```
The current inline expressions `pathname.startsWith('/companies')` (app-sidebar.tsx:48), `/personas` (57), `/reviews` (66) and exact `pathname === '/'` (39) are the four call sites `nav.ts` hardens — but wiring happens in **Phase 11**; Phase 10 ships the function + tests only (UI-SPEC line 178, Pitfall 5).

**Error handling:** n/a — total function, no throw paths, no try/catch (matches `dedupKeys.ts`/`companyFilters.ts`).

---

### `src/lib/nav.test.ts` (test — unit; NEW)

**Analog:** `src/lib/import/dedupKeys.test.ts` — the repo's idiomatic test file (74 lines, 4 describe blocks, 15 cases, node env, single quotes, semicolons). Also `vitest.config.ts` (auto-discovery) and `package.json:14` (`"test": "vitest run"`).

**Imports pattern (verbatim from `dedupKeys.test.ts:1-2`):**
```typescript
import { describe, it, expect } from 'vitest';
import { normalizeDomain, normalizeEmail, buildUpdatePatch } from './dedupKeys';
```
`nav.test.ts` mirrors: `import { describe, it, expect } from 'vitest';` + `import { getActiveNavKey } from './nav';`

**Test structure (one `describe` per function, `it` per behavior — `dedupKeys.test.ts:4-28`):**
```typescript
describe('normalizeDomain', () => {
  it('strips protocol, www, and trailing slash', () => {
    expect(normalizeDomain('HTTP://WWW.Foo.com/')).toBe('foo.com');
  });
  ...
});
```

**11-case test set (per UI-SPEC §QLTY-01; from RESEARCH §Code Examples — mirrors `dedupKeys.test.ts` conventions):**
```typescript
describe('getActiveNavKey', () => {
  it("returns 'start' for the exact root path", () => {
    expect(getActiveNavKey('/')).toBe('start');
  });

  it("returns 'companies' for the index and detail pages", () => {
    expect(getActiveNavKey('/companies')).toBe('companies');
    expect(getActiveNavKey('/companies/123')).toBe('companies');
    expect(getActiveNavKey('/companies/123/edit')).toBe('companies');
  });

  it("returns 'personas' for the index and detail pages", () => {
    expect(getActiveNavKey('/personas')).toBe('personas');
    expect(getActiveNavKey('/personas/456')).toBe('personas');
  });

  it("returns 'reviews' for the index and detail pages", () => {
    expect(getActiveNavKey('/reviews')).toBe('reviews');
    expect(getActiveNavKey('/reviews/9')).toBe('reviews');
  });

  it('returns null for sign-in, empty, and sibling-prefix paths', () => {
    expect(getActiveNavKey('/sign-in')).toBeNull();
    expect(getActiveNavKey('')).toBeNull();
    expect(getActiveNavKey('/companies-archive')).toBeNull();
  });
});
```

**Placement constraint (Pitfall 6):** must live at exactly `src/lib/nav.test.ts` — `vitest.config.ts:12` is `include: ['src/**/*.test.ts']`; any other location/extension silently never runs.

**Verification:** `npx vitest run src/lib/nav.test.ts` must report exactly 11 tests executing; full suite `npm test` green (22 existing test files).

---

## Shared Patterns

### Vitest unit-test conventions
**Source:** `src/lib/import/dedupKeys.test.ts` + `vitest.config.ts` + `package.json:14`
**Apply to:** `src/lib/nav.test.ts`
- `import { describe, it, expect } from 'vitest';` — named import from 'vitest', never globals
- One `describe` block per exported function; one `it` per behavior; `expect(...).toBe(...)` matchers
- Single quotes, semicolons, 2-space indent
- node environment (`vitest.config.ts:11`), auto-discovered via `src/**/*.test.ts` include (`vitest.config.ts:12`)
- Run: `npm test` (script = `vitest run`, `package.json:14`)

### Named-export module convention
**Source:** `src/lib/import/dedupKeys.ts:5,14,21`, `src/lib/import/columnMapping.ts:109,120,139`, `src/lib/params/companyFilters.ts:5,12,27`
**Apply to:** `src/lib/nav.ts`
- Every lib module uses named exports only — no default exports anywhere in `src/lib/`
- `export type` for unions (NavKey), `export function` for logic — never a default object
- `type` reserved for unions/aliases; `interface` for object shapes (CONVENTIONS.md)

### Comments explain *why*, not *what*
**Source:** `src/lib/import/dedupKeys.ts:1-3`, `src/components/layout/app-sidebar.tsx:16-20,36-38`
**Apply to:** `src/lib/nav.ts`, token block in `globals.css`
- 3-4 line block above the code stating the non-obvious decision: boundary guard rationale, `'personas'`-is-the-route-segment, unlayered-companion-rules cascade reason
- No JSDoc, no restatement of code

### Total-function discipline (never throws)
**Source:** `src/lib/params/companyFilters.ts:27-33`, `src/lib/import/columnMapping.ts:120-134` (null = unmapped, explicit)
**Apply to:** `src/lib/nav.ts`
- Any string input → fixed union `| null`, never throws, no regex, no unbounded handling
- `null` is an explicit return value meaning "not a nav route" (`/sign-in`, `''`, sibling prefixes) — same shape as `suggestColumnMapping`'s `null = unmapped` contract

### Scoped CSS-custom-property theming (data-attribute hook)
**Source:** mechanism verified in `src/app/globals.css:13-20` (`@theme inline`) + `src/components/ui/sidebar.tsx:186,242` (`data-sidebar="sidebar"`)
**Apply to:** the new `[data-sidebar="sidebar"]` block in `globals.css`
- Set raw tokens on the attribute hook → entire sidebar subtree resolves them; content resolves `:root` values (PANE-04)
- Companion rules must be unlayered to beat `@layer base * { @apply border-border outline-ring/50 }` (globals.css:121-123) and Tailwind's layered `border-r` utility (sidebar.tsx:236)

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| — (none) | — | — | All three Phase 10 files have strong in-repo analogs (`dedupKeys.ts`/`dedupKeys.test.ts` for the function+test; the file itself for the CSS block). Zero new packages means no dependency-pattern analog needed. |

**Note for planner:** there is no existing scoped/attribute-hook CSS-token block in the repo — the `:root`/`.dark`/`@theme inline` blocks are the only CSS-token precedent, and the new block is a novel-but-simple variant (same 8 names, scoped selector, hex values). RESEARCH.md §Pattern 1 is the authoritative reference for the mechanism.

---

## Metadata

**Analog search scope:** `src/lib/**` (58 files scanned via glob), `src/components/layout/`, `src/components/ui/sidebar.tsx`, `src/app/globals.css`, `vitest.config.ts`
**Files scanned:** ~60 (glob + targeted reads; 8 read in full or in targeted ranges)
**Pattern extraction date:** 2026-08-01
**Key verifications:** `data-sidebar="sidebar"` hook at sidebar.tsx:186 (mobile) and 242 (desktop); `@theme inline` sidebar mappings at globals.css:13-20; `:root` sidebar tokens at globals.css:76-83; `.dark` dead code at 86-118; `@layer base` cascade rival at 120-123; vitest include pattern `src/**/*.test.ts` at vitest.config.ts:12; consumer `isActive` expressions at app-sidebar.tsx:39,48,57,66.
