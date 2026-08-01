# Phase 14: Contrast Audit & UAT Matrix — Pattern Map

**Mapped:** 2026-08-01
**Files analyzed:** 6 (3 CREATE docs + 1 CREATE dir + 2 OPTIONAL source files; zero production edits — D-08)
**Analogs found:** 5 / 6 (all but the `artifacts/` phase-dir location have committed or vendored analogs; the novel surfaces are flagged in No Analog Found)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `.planning/phases/14-contrast-audit-uat-matrix/artifacts/` (CREATE dir) | artifact (evidence store) | file-I/O (screenshot write) | Repo-root UAT evidence committed at `89f50c25` (`05-uat-mobile-after.png`, `05-uat-s1-single-expand.yml`, `phase-8-company-review.png` — still in the working tree) + the `.playwright-mcp/` gitignored output dir (`.gitignore:42`) | partial (mechanisms exist; the in-phase `artifacts/` subdir is a new location — Pitfall 1) |
| `.planning/phases/14-contrast-audit-uat-matrix/14-UAT.md` (CREATE) | doc (UAT artifact) | request-response (test tracking) | `~/.claude/get-shit-done/templates/UAT.md` (canonical template — status/expected/result/summary/gaps) + `05-HUMAN-UAT.md` @ `89f50c25` (Playwright-driven live-UAT, evidence refs per test) + `08-06-UAT.md` @ `89f50c25` (results-table + safety gate) | exact |
| `.planning/phases/14-contrast-audit-uat-matrix/14-VERIFICATION.md` (CREATE) | doc (verification artifact) | request-response | `05-VERIFICATION.md` @ `89f50c25` (frontmatter + Observable Truths table + Required Artifacts + Behavioral Spot-Checks + Requirements Coverage) | role-match |
| `src/lib/contrast.ts` (OPTIONAL CREATE) | utility (pure function) | transform (WCAG math) | `src/lib/nav.ts` (15 lines), `src/lib/sidebar-collapse.ts` (17 lines), `src/lib/user.ts` (32 lines) — the phase-family pure-function convention | exact |
| `src/lib/contrast.test.ts` (OPTIONAL CREATE) | test | unit | `src/lib/nav.test.ts` (48 lines), `src/lib/sidebar-collapse.test.ts` (34 lines), `src/lib/user.test.ts` (50 lines) | exact |
| Production sources (READ-ONLY objects under test — D-08, fence) | component / config / css | request-response + event-driven | `src/components/layout/app-sidebar.tsx` (259 lines), `sidebar-resize-handle.tsx` (101 lines), `src/components/ui/sidebar.tsx` (702 lines, vendored), `src/app/globals.css` token block (87-96) | exact (contract — the assertion surface, never edited) |

**Scope fence (hard):** the phase produces ONLY the three docs + `artifacts/` + the two optional `src/lib/contrast*` files. `src/components/ui/{sidebar,tooltip,dropdown-menu,button}.tsx`, `src/app/globals.css`, `'src/app/(dashboard)/layout.tsx'`, `app-shell-layout.tsx`, `app-sidebar.tsx`, `sidebar-resize-handle.tsx`, `package.json`, `package-lock.json` are **READ-ONLY objects under test** — fence gates verify empty `git diff <base> HEAD` over the 11 frozen files (14-RESEARCH hard constraints; `app-sidebar.tsx` + `sidebar-resize-handle.tsx` are fenced this phase as the objects under test). Zero new npm packages — the driver is the external Playwright MCP server (`skill_mcp` → `mcp_name="playwright"`), NOT a project dependency.

---

## Pattern Assignments

### `.planning/phases/14-contrast-audit-uat-matrix/artifacts/` (artifact dir — CREATE in Wave 0)

**Analog:** the repo-root UAT evidence committed at `89f50c25` (`05-uat-mobile-after.png`, `05-uat-s1-single-expand.yml` — still in the working tree; the Phase-5 evidence lands OUTSIDE `.playwright-mcp/` exactly because that dir is gitignored), plus the `.playwright-mcp/` session-dir mechanism itself (console logs + default-named `page-*.yml` snapshots, gitignored at `.gitignore:42`).

**Core pattern — the screenshot write (D-03, `cell-{state}-{route}.png` naming):**
The Playwright MCP screenshot API (`browser_take_screenshot`) takes `type` (png/jpeg), `scale` (css/device), optional `filename`, optional `fullPage`/`target`. Verified schema this session:
```json
{ "type": "png", "scale": "css",
  "filename": "File name to save the screenshot to. Defaults to `page-{timestamp}.{png|jpeg}` if not specified. Prefer relative file names to stay within the output directory." }
```
**Critical constraint (Pitfall 1 / RESEARCH A5):** the MCP server's default output dir is `.playwright-mcp/` and the tool doc *prefers* filenames inside it — but D-03 requires evidence in the committed `artifacts/` dir. The Phase-5 precedent proves evidence can land outside `.playwright-mcp/` (repo root). Two mitigation paths, both acceptable:
1. **Explicit filename** targeting `artifacts/cell-{state}-{route}.png` (e.g. `.planning/phases/14-contrast-audit-uat-matrix/artifacts/cell-expanded-companies.png`) — if the server accepts an out-of-dir relative/absolute path (A5, MEDIUM confidence).
2. **Save-then-copy** — capture with the default name, then copy the PNG from `.playwright-mcp/` into `artifacts/` before closing the cell (post-copy mitigation; guaranteed to work regardless of confinement).

Either way: `git add` the artifacts dir and verify `git status` shows the PNGs tracked before closing the plan (Pitfall 1 warning sign: screenshots only exist under `.playwright-mcp/`). Evidence yml snapshots may stay in `.playwright-mcp/` (gitignored, matches precedent) or be copied as the 05-UAT yml files were.

---

### `.planning/phases/14-contrast-audit-uat-matrix/14-UAT.md` (doc — CREATE, the 12-cell matrix)

**Analog:** `~/.claude/get-shit-done/templates/UAT.md` (canonical — read in full: frontmatter + Current Test + per-test `expected`/`result` + Summary counts + YAML Gaps) + `05-HUMAN-UAT.md` @ `89f50c25` (the live-Playwright shape this phase replicates: per-scenario `expected:`/`result: [passed] —` with evidence refs) + `08-06-UAT.md` @ `89f50c25` (live results table + Safety Gate section).

**Frontmatter template (verbatim from template + 05-HUMAN-UAT shape):**
```markdown
---
status: complete
phase: 14-contrast-audit-uat-matrix
source: [14-VERIFICATION.md]
started: [ISO timestamp]
updated: [ISO timestamp]
---

## Current Test

[testing complete]
```
`status` values: `testing | partial | complete | diagnosed` (template). D-08 marks it complete at phase end with all 12 cells recorded.

**Per-test shape — 05-HUMAN-UAT.md verbatim (`### 1. …` + `expected:` + `result: [passed] —` + evidence):**
```markdown
### 6. Mobile viewport — detail panel remains visible when a row is selected (CR-01 fix)
expected: At a viewport narrower than the `md` breakpoint, selecting a row keeps the expanded detail panel visible; only non-expanded sibling rows and the header hide.
result: [passed] — Viewport 375x800; clicked Beta Sample Inc (id 4) → `?selected=4`; … Evidence: `05-uat-mobile-before.yml` (pre-click), `05-uat-mobile-after.png` (post-click), `.playwright-mcp/page-2026-08-01T11-48-33-023Z.yml`.
```
For Phase 14 each cell records: viewport state + route + active-pill assertion result + screenshot ref `artifacts/cell-{state}-{route}.png`. `result` values: `[pending] | pass | issue | skipped | blocked` (template) — the Phase-5 precedent wrote `[passed]`, `08-06-UAT.md` wrote `PASS`; keep the template's `pass`/`issue` vocabulary with the evidence trail.

**Summary block (verbatim template):**
```markdown
## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 0
```
Phase 14's totals: 12 matrix cells + the interaction micro-tests (collapse button, ⌘B, drag-resize clamp + cookie, rail tooltips incl `Reviews (N)`, badge/dot gating, unauthenticated → /sign-in negative check).

**Gaps section (only if an issue is found — template YAML):** a failed cell is a recorded `issue` with `severity` + screenshot ref (Pitfall 6 — failure is evidence, not a session abort; D-08 permits a minimal fix if the defect is real).

**Badge-gating fixture note (Pitfall 3):** dev DB has 0 pending proposals (verified in RESEARCH) — the badge/dot/`Reviews (N)` assertions need either a seeded fixture + cleanup (08-06-UAT precedent: "two UAT fixtures were added… No production rows were touched") or an explicit two-branch test (count=0 → assert NO badge; count>0 → assert badge via fixture).

---

### `.planning/phases/14-contrast-audit-uat-matrix/14-VERIFICATION.md` (doc — CREATE)

**Analog:** `05-VERIFICATION.md` @ `89f50c25` (role-match — the phase verification report shape: frontmatter + evidence tables + spot-checks + requirements coverage). Phase 14's report records THREE evidence families (contrast audit, Exa review, regression battery) instead of 05's single observable-truths set.

**Frontmatter + truth table shape (05-VERIFICATION.md verbatim shape):**
```markdown
---
phase: 14-contrast-audit-uat-matrix
verified: [ISO timestamp]
status: passed
score: [N]/[N] pairs + [M]/[M] elements verified
overrides_applied: 0
---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | All 6 shipped token pairs meet their AA thresholds live (D-05) | ✓ VERIFIED | browser_evaluate computed-style ratios per pair, 14-08-01 … |
```

**Contrast-audit table (the 6 D-05 pairs — RESEARCH §Code Examples verified ratios, each asserted live via `browser_evaluate`):**

| Pair | Colors | Threshold | Verified ratio (2026-08-01) |
|------|--------|-----------|------------------------------|
| text-on-panel | `#333333` vs `#fbfcfd` | 4.5 (1.4.3) | 12.30 |
| /70 label (alpha-composited) | `#6f6f70` (= `#333333`@70% over panel) | 4.5 (1.4.3) | 4.89 |
| active pill fill (non-text) | `#909090` vs `#fbfcfd` | 3.0 (1.4.11) | 3.11 |
| accent-foreground on pill | `#111111` vs `#909090` | 3.0 | 5.91 |
| focus ring vs panel | `#787878` vs `#fbfcfd` | 3.0 (1.4.11) | 4.30 |
| badge chip fill (non-text) | `#909090` vs `#fbfcfd` | 3.0 (1.4.11) | 3.11 |
| letter-mark | `#ffffff` vs `#333333` | 4.5 (1.4.3) | 12.63 |

**Exa divergence table (D-07 element-wise — RESEARCH Pattern 3 / FEATURES.md values as the dated fallback):**

| Element | Exa reference | ArcLumen shipped | Verdict |
|---------|---------------|------------------|---------|
| Panel | `#fbfcfd` | `--sidebar: #fbfcfd` (globals.css:88) | match |
| Hairline | 0.5px gray-200 | `border-right-width: 0.5px` + `--sidebar-border: #e5e7eb` (globals.css:100-103) | match |
| Active fill | `rgba(0,0,0,0.04)` ≈ **1.09:1 FAIL** | `--sidebar-accent: #909090` **3.11:1 PASS** | DELIBERATE DIVERGENCE |
| Badge | mono 10px/600 accent chip | `font-mono text-[10px] font-semibold` + sidebar-accent (app-sidebar.tsx:179) | match (anatomy; no asset copied) |

**Behavioral Spot-Checks table (05-VERIFICATION shape) for the regression battery:** `grep -rnE 'indigo|amber|#[0-9a-fA-F]{3,8}|\bdark:' src/components/layout/` = 0; fence `git diff <base> HEAD -- <11 frozen files>` = empty; `npx tsc --noEmit`; `npm test`; `npm run build`; plus the live rows (⌘B toggles `sidebar_state`, drag writes `sidebar_width`, unauthenticated → `/sign-in`).

---

### `src/lib/contrast.ts` (utility — pure function; OPTIONAL, per RESEARCH Open Question 3)

**Analog:** `src/lib/nav.ts` (15 lines, whole-file template) / `src/lib/sidebar-collapse.ts` (17 lines) / `src/lib/user.ts` (32 lines) — same directory, same convention: dependency-free, named-export, total-function modules. This would be the fourth in the family (Phase 13's `sidebar-collapse.ts` is the most recent precedent and the same extraction motive).

**Whole-file template — mirroring sidebar-collapse.ts:1-17 (why-comment + named exports + total functions):**
```typescript
// WCAG 2.2 contrast-ratio math for the live computed-style audit (D-04/D-05).
// The audit samples rendered styles via browser_evaluate, but the luminance/
// ratio formulas must not drift from the W3C definition — the shipped token
// contract (10-UI-SPEC §Color) claims specific AA ratios, so the math lives
// here under Vitest. compositeAlpha handles the /70 label (text-sidebar-
// foreground/70 computes to rgba(51,51,51,0.7) — alpha must be blended over
// the panel before the ratio, Pitfall 2).

export function relativeLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: [number, number, number], b: [number, number, number]): number {
  const [l1, l2] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

export function compositeAlpha(
  fg: [number, number, number],
  bg: [number, number, number],
  alpha: number
): [number, number, number] {
  return fg.map((v, i) => Math.round(v * alpha + bg[i] * (1 - alpha))) as [number, number, number];
}
```
Source of the math: RESEARCH §Code Examples (W3C WCAG 2.2 §1.4.3/1.4.11 relative-luminance definition, verified 2026-08-01 against all 6 pairs). Style per repo: single quotes, semicolons, 2-space indent, camelCase, no JSDoc, named exports only, `interface`-free (tuples suffice — `user.ts` reserves `interface` for object shapes). The same math is inlined in the `browser_evaluate` script for the live audit — the helper only *locks* it (a red test = the audit's math is wrong, not the app).

**Reuse decision (RESEARCH Open Question 3):** extraction (2 files) unit-locks the WCAG math the entire audit depends on, per the Phase 10/12/13 convention; inlining (0 files) keeps the phase strictly zero-source. RESEARCH recommends extraction as "the phase's one permitted minimal addition" — planner's call; the audit runs identically either way (the browser script is inline regardless).

---

### `src/lib/contrast.test.ts` (test — unit; OPTIONAL, pairs with the helper)

**Analog:** `src/lib/sidebar-collapse.test.ts` (34 lines — the closest, same extraction generation) / `src/lib/nav.test.ts` (48 lines) / `src/lib/user.test.ts` (50 lines). Auto-discovered via `vitest.config.ts` `include: ['src/**/*.test.ts']` — placement at exactly `src/lib/contrast.test.ts` required; node env (no DOM).

**Imports + structure template — sidebar-collapse.test.ts:1-3 (verbatim):**
```typescript
import { describe, it, expect } from 'vitest';
import { getCollapseToggleLabel, getNavTooltipLabel } from './sidebar-collapse';
```
`contrast.test.ts` mirrors: `import { describe, it, expect } from 'vitest';` + `import { contrastRatio, relativeLuminance, compositeAlpha } from './contrast';` — module under test imported **relatively** (`./contrast`), the repo test convention (nav.test.ts:2, user.test.ts:2). One `describe` per exported function; one `it` per behavior; `expect(...).toBe(...)`.

**Case set (lock the RESEARCH-verified numbers):**
- `contrastRatio([0x33,0x33,0x33], [0xfb,0xfc,0xfd])` ≈ `12.30` (text-on-panel)
- `compositeAlpha([51,51,51], [251,252,253], 0.7)` → `[111,111,112]` (i.e. `#6f6f70`), then `contrastRatio` of that vs panel ≈ `4.89` — the Pitfall-2 lock
- `contrastRatio([0x90,0x90,0x90], [0xfb,0xfc,0xfd])` ≈ `3.11` (pill fill, ≥3.0)
- The Exa trap: `compositeAlpha([0,0,0], [0xfb,0xfc,0xfd], 0.04)` ≈ `1.09` — documents the deliberate divergence (D-07) numerically

**Verification:** `npx vitest run src/lib/contrast.test.ts --bail=1` green — **`--bail=1`, NOT `-x`** (removed in Vitest 4 — Phase 12 Deviation 1). Full suite `npm test` stays green alongside nav 11/11, user 8/8, sidebar-collapse 7/7.

---

### The READ-ONLY assertion surface (the DOM hooks the matrix asserts — D-02, cite these, never edit)

**Analog:** the shipped files themselves — every selector below is verified byte-identical in the current working tree. The 12-cell matrix's core assertion is the active pill; the interaction micro-tests drive the vendored state machine.

**Active-pill assertion (the matrix's core check — sidebar.tsx):**
```tsx
// src/components/ui/sidebar.tsx:511 — data-active={isActive} on the menu button
<Comp
  data-slot="sidebar-menu-button"
  data-sidebar="menu-button"
  data-size={size}
  data-active={isActive}                        // ← the assertion hook
  ...
```
Plus the dormant rail/active classes at sidebar.tsx:469 (`data-active:bg-sidebar-accent data-active:font-medium data-active:text-sidebar-accent-foreground`) — the gray pill renders as `rgb(144,144,144)` (`--sidebar-accent: #909090`). Per-route expectation: exactly one row has `data-active="true"` with `href === '/{route}'`; the other three rows `data-active="false"` (driver snippet — RESEARCH §Code Examples):
```javascript
// browser_evaluate on http://localhost:3000/companies (post-auth)
() => {
  const rows = [...document.querySelectorAll('[data-sidebar="menu-button"]')];
  return rows.map((r) => ({
    href: r.querySelector('a')?.getAttribute('href'),
    active: r.getAttribute('data-active') === 'true',
    pillBg: getComputedStyle(r).backgroundColor,   // active row: rgb(144,144,144)
  }));
};
```

**Collapse entry points (the three D-02 mechanisms, all one shared state machine):**
- Header button — `aria-label={state === 'collapsed' ? 'Expand sidebar' : 'Collapse sidebar'}` on a plain `Button size="icon"` (app-sidebar.tsx:87), `onClick={toggleSidebar}` (88), icon swap `PanelLeftClose`/`PanelLeftOpen` (91). Driver: `browser_click(target: button "Collapse sidebar")`.
- ⌘B — `SIDEBAR_KEYBOARD_SHORTCUT = "b"` (sidebar.tsx:32); the vendored handler listens for `event.key === 'b' && (metaKey || ctrlKey)` (sidebar.tsx:96-109). Driver: `browser_press_key(key: "Meta+b")`.
- Mobile sheet — `useIsMobile()` (`MOBILE_BREAKPOINT = 768`, `max-width: 767px` matchMedia in `src/hooks/use-mobile.ts`); below 768px the sidebar renders `SheetContent data-mobile="true"` (sidebar.tsx:186-189). Driver: `browser_resize(375, 800)` then `browser_click(target: button "Toggle Sidebar")` (the `SidebarTrigger`, sidebar.tsx:253-277 — `span.sr-only` "Toggle Sidebar", confirmed in the 05-uat evidence yml).

**State + cookie assertions (live regression layer — Pitfall 5):**
- `data-state` on the wrapper (`[data-slot="sidebar-wrapper"]`, `dataset.state` — `'collapsed'`), rail width via `getComputedStyle('[data-sidebar="sidebar-inner"]').width === '48px'` (collapsed = `--sidebar-width-icon: 3rem`, sidebar.tsx:31/225/236).
- `sidebar_state` cookie write inside the vendored setter (sidebar.tsx:84-85: `document.cookie = \`${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}\``) — assert via `browser_evaluate: document.cookie`.
- Drag-resize clamp — handle `role="separator" aria-label="Resize sidebar"` (sidebar-resize-handle.tsx:90-92), `MIN_WIDTH = 200` / `MAX_WIDTH = 400` (6-7), `sidebar_width` cookie write (47). Driver: `browser_drag` from the separator, then assert wrapper width clamps to [200, 400] and `sidebar_width` is in `document.cookie`.

**Badge/dot gating (app-sidebar.tsx:174-188 — Pitfall 3):**
```tsx
{pendingCount > 0 && (
  <>
    <SidebarMenuBadge role="status" aria-label={`${pendingCount} pending reviews`}
      className="bg-sidebar-accent text-sidebar-accent-foreground font-mono text-[10px] font-semibold">
      {pendingCount} pending
    </SidebarMenuBadge>
    <span aria-hidden="true" className="… hidden … rounded-full bg-sidebar-accent group-data-[collapsible=icon]:block" />
  </>
)}
```
Assert at count=0 → no badge (current live state); with a seeded fixture → badge `"1 pending"` + dot + `Reviews (1)` tooltip (the tooltip string comes from `getNavTooltipLabel('reviews', pendingCount)` — sidebar-collapse.ts:14-16, Vitest-locked).

**Contrast-pair sampling elements (D-05 — where the computed styles are read):**
- Panel + base text: `[data-sidebar="sidebar"]` `backgroundColor` (`rgb(251,252,253)`) vs nav-row label span `color` (`rgb(51,51,51)`) — RESEARCH Pattern 2 example script.
- /70 label: the org sub-label `text-sidebar-foreground/70` (app-sidebar.tsx:110) computes to `rgba(51,51,51,0.7)` — MUST composite over the panel first (Pitfall 2; `compositeAlpha` in the optional helper).
- Active pill: `getComputedStyle(row).backgroundColor` on the `data-active="true"` row (`rgb(144,144,144)`) + its `color` (`rgb(17,17,17)`).
- Focus ring: `--sidebar-ring: #787878` (globals.css:95) — sample a focused row's `outline-color` (globals.css:104-106 scoped outline rule).
- Badge chip + letter-mark: `bg-sidebar-accent` chip (app-sidebar.tsx:179) / `bg-sidebar-primary text-sidebar-primary-foreground` box (app-sidebar.tsx:103).

---

## Shared Patterns

### Playwright MCP driver invocation (the ONLY browser surface — D-01 locked)
**Source:** the `playwright` builtin skill (loaded this session — full tool surface verified); plugin registration `~/.claude/plugins/marketplaces/claude-plugins-official/external_plugins/playwright/.mcp.json` (`npx @playwright/mcp@latest`); prior-use evidence: `.playwright-mcp/` console logs + the 05/08 UAT docs.
**Apply to:** every cell + interaction micro-test + the contrast audit + the Exa fetch.
- Invoke via `skill_mcp` with `mcp_name="playwright"` — never add `@playwright/test` to package.json (zero-package hard constraint).
- Tools used this phase: `browser_resize` (viewport states, width+height required), `browser_navigate`, `browser_wait_for` (text/time — 200ms width transition settles), `browser_snapshot` (a11y tree — the evidence yml format, `05-uat-s1-single-expand.yml` shape), `browser_find` (locate refs cheaply), `browser_click` (target+element), `browser_press_key` (`Meta+b`), `browser_drag` (resize handle), `browser_hover` (rail tooltips), `browser_evaluate` (computed styles + cookie reads + active-pill assertion), `browser_take_screenshot` (type+scale required; explicit `filename`), `browser_network_requests` (the Exa 429 probe), `browser_run_code_unsafe` (composite interactions fallback — RESEARCH A1).
- Credentials/secret hygiene: drive the REAL Clerk sign-in (`/sign-in` hosted `<SignIn />`) with dev test-user credentials resolved via checkpoint:human-verify (RESEARCH Open Question 1 / A3); never print secrets in artifacts (08-06-UAT safety-gate precedent).

### Screenshot-evidence discipline (Pitfall 1 — novel-but-critical)
**Source:** `browser_take_screenshot` schema (filename "prefer relative… within the output directory" — the confinement risk), `.gitignore:42` (`.playwright-mcp/`), D-03, Phase-5 repo-root evidence.
**Apply to:** every matrix cell + interaction check.
- Create `artifacts/` in Wave 0 (before any cell runs).
- Either pass an explicit `filename` targeting `artifacts/cell-{state}-{route}.png`, or capture then copy the PNG from `.playwright-mcp/` into `artifacts/` (post-copy mitigation — A5).
- `git add` + verify `git status` tracks the PNGs before closing each plan — `git status` showing nothing under `artifacts/` is the Pitfall-1 warning sign.

### Failure-as-evidence, not session abort (Pitfall 6)
**Source:** the UAT template result vocabulary (`pass | issue | skipped | blocked`, with `severity` on issue); 08-06-UAT.md's "Defects Found And Fixed During UAT" section.
**Apply to:** 14-UAT.md recording + the driver structure.
- Screenshot BEFORE asserting (a failing cell still has evidence); a red cell is `result: issue` + severity + screenshot ref, not a thrown session — avoid `&&`-chained verify commands that stop the battery on the first failure.
- If a real defect is found, fix minimally inside the phase (D-08 discretion) and record the diff in the same cell's evidence.

### Pure-function + Vitest lock convention
**Source:** nav.ts/nav.test.ts, user.ts/user.test.ts, sidebar-collapse.ts/sidebar-collapse.test.ts; vitest.config.ts:10-13 (node env, `include: ['src/**/*.test.ts']`).
**Apply to:** `src/lib/contrast.ts` + `src/lib/contrast.test.ts` (if extracted).
- Named imports `{ describe, it, expect }` from 'vitest' — never globals; one `describe` per export, `expect(...).toBe(...)`; module under test imported relatively; named exports only; total functions, never throw; why-comments without JSDoc.
- Run: `npx vitest run src/lib/contrast.test.ts --bail=1` (**NOT `-x`** — Vitest 4, Phase 12 Deviation 1); `npm test` full suite.

### Data-fixture + safety-gate precedent (badge gating — Pitfall 3)
**Source:** 08-06-UAT.md Safety Gate (SHA-256 prefix match against the approved isolated QA connection, fixtures added then cleaned up, no production rows touched, secrets not printed).
**Apply to:** the pendingCount badge/dot/`Reviews (N)` micro-test.
- Verify `DATABASE_URL` points at the dev/QA instance (SHA-256 prefix check) before any insert; seed one pending `signalProposal` via `@neondatabase/serverless`/tsx; assert badge `"1 pending"` + dot + `Reviews (1)` tooltip; delete the fixture row after. Alternative: explicit two-branch assertion (count=0 → no badge; fixture → badge) — planner's call per RESEARCH Open Question 2.
- Never print secret values in 14-UAT.md/14-VERIFICATION.md; screenshots of the authenticated app are fine (they show the app, not credentials).

### Fence + sweep + static gates (the inherited regression battery)
**Source:** Phases 10-13 (11-02-PLAN sweep precedent; 13-PATTERNS verification gates).
**Apply to:** every Phase 14 task (as evidence rows in 14-VERIFICATION.md, NOT as a substitute for the live layer — Pitfall 5).
- Fence: `git diff <base> HEAD -- src/components/ui/sidebar.tsx src/components/ui/tooltip.tsx src/components/ui/dropdown-menu.tsx src/components/ui/button.tsx src/app/globals.css 'src/app/(dashboard)/layout.tsx' src/components/layout/app-shell-layout.tsx src/components/layout/app-sidebar.tsx src/components/layout/sidebar-resize-handle.tsx package.json package-lock.json` = empty (11 files — `app-sidebar.tsx` and `sidebar-resize-handle.tsx` are fenced this phase as READ-ONLY objects under test).
- Sweep: `test -z "$(grep -rnE 'indigo|amber|#[0-9a-fA-F]{3,8}|\bdark:' src/components/layout/)"` (QLTY-04, = 0).
- Static: `npx tsc --noEmit`, `npm test`, `npm run build` — plus the live rows: ⌘B toggles `sidebar_state`, drag writes `sidebar_width`, unauthenticated navigation → redirect to `/sign-in` (V2/V4 security rows).

---

## No Analog Found

| File / Surface | Role | Data Flow | Reason |
|----------------|------|-----------|--------|
| `artifacts/` under the phase dir (CREATE) | artifact (evidence store) | file-I/O | **No committed precedent for an in-phase `artifacts/` subdir** — the Phase-5 evidence was committed at the repo root (`05-uat-*.png/yml`, `phase-8-*.png`) and default snapshots live in gitignored `.playwright-mcp/`. Novel-but-critical: the dir must exist in Wave 0 and the PNGs must be tracked (`git status` check per Pitfall 1). The mechanisms (screenshot API + explicit filename + post-copy) all exist — only the location is new |
| Live computed-style contrast audit (`browser_evaluate` → `getComputedStyle`) | verification (browser) | transform | **No committed precedent** — 05-HUMAN-UAT used snapshots/clicks/navigate only, never computed-style evaluation. The tool (`browser_evaluate`, function param) and the math (RESEARCH §Code Examples, W3C-verified) both exist; the audit script is inline per-cell. Planner should NOT invent a new harness — it's a single `browser_evaluate` call returning `{pair, colorA, colorB, ratio, threshold, pass}` per RESEARCH Pattern 2 |
| Live fetch of dashboard.exa.ai via the Playwright browser | verification (external reference) | request-response | **No committed precedent for driving an external site** — all prior Playwright sessions drove `localhost:3000` only. The fetch is best-effort (429 challenge verified for curl this session); if blocked, fall back to `.planning/research/FEATURES.md` captured values (dated 2026-08-01) and record the fallback explicitly (Pitfall 4 / D-06) |
| Live ⌘B / cookie / pointer-drag assertions | verification (browser) | event-driven | **No committed precedent** — the 05/08 UAT evidence shows snapshot/click/navigate only; grep-fence "proved" source in Phases 10-13 (the exact regression blindness Phase-5's live UAT cured). The DOM hooks all exist and are cited above (sidebar.tsx:84-85, 96-109; sidebar-resize-handle.tsx:47, 90-92); the driver sequences are one-line tool calls, not a new pattern |

**Planner notes for the novel surfaces:**
1. **`artifacts/` location** — create the dir in Wave 0 as a real task; every `browser_take_screenshot` either passes `filename: "…/artifacts/cell-{state}-{route}.png"` (A5, MEDIUM) or is followed by a copy step; verify `git status` shows the PNGs before closing each plan. Do NOT rely on `.playwright-mcp/` for any D-03 evidence (gitignored).
2. **Contrast audit script** — one `browser_evaluate` per pair (or one parametrized function returning all 6) sampling `getComputedStyle` on the shipped elements listed above; the `/70` pair MUST blend alpha over the panel first (Pitfall 2 — bake `compositeAlpha` into the shared script). Optionally lock the same math in `src/lib/contrast.ts` + Vitest.
3. **Exa fetch** — attempt `browser_navigate("https://dashboard.exa.ai")`, `browser_wait_for` the app shell, sample via `browser_evaluate`; on challenge/429 record the block and use FEATURES.md values as explicitly-dated fallback evidence. Never hotlink or screenshot-copy Exa assets (D-07).
4. **Badge gating** — the dev DB has 0 pending proposals today; pick the fixture path (SHA-256 gate + insert + assert + cleanup, 08-06 precedent) or the two-branch assertion. Do not assert badge presence at count=0 (Pitfall 3).
5. **Optional contrast helper** — extraction (2 files) follows the exact nav/sidebar-collapse convention and locks the audit's math; RESEARCH recommends it as the phase's one permitted minimal source addition. Planner may inline (0 files) for a strictly zero-source phase — the browser script is inline either way.

---

## Metadata

**Analog search scope:** `src/components/layout/` (app-sidebar.tsx 259 lines full read, sidebar-resize-handle.tsx 101 lines full read), `src/components/ui/sidebar.tsx` (702 lines — targeted reads: 25-114 provider/⌘B/cookie, 175-204 mobile sheet, 460-539 menu-button variants + `data-active`), `src/app/globals.css` (token block 80-109), `src/lib/` (nav.ts, nav.test.ts, user.ts, user.test.ts, sidebar-collapse.ts, sidebar-collapse.test.ts — full reads), `~/.claude/get-shit-done/templates/UAT.md` (265 lines full read), git `89f50c25` (05-HUMAN-UAT.md, 08-06-UAT.md, 05-VERIFICATION.md via `git show`), repo-root UAT evidence files (`05-uat-s1-single-expand.yml`, `05-uat-mobile-before.yml`), `.playwright-mcp/` listing, `.gitignore:42`, `.planning/research/FEATURES.md` (Exa reference values), `10-UI-SPEC.md` (token contract + divergence table), `13-VALIDATION.md` (Manual-Only table), `14-VALIDATION.md` (per-task verification map), the `playwright` builtin skill (full tool surface loaded this session), playwright plugin `.mcp.json`.
**Files scanned:** ~15 (6 full reads + 4 git-show reads + targeted greps + skill load)
**Pattern extraction date:** 2026-08-01
**Key verifications:** `browser_take_screenshot` requires `type`+`scale` with a `filename` param that *prefers* the output dir (Pitfall-1 confinement confirmed in the skill schema); `browser_evaluate` takes a `function` param (the audit surface); `.playwright-mcp/` gitignored at `.gitignore:42`; `data-active` at sidebar.tsx:511 and `data-active:bg-sidebar-accent` at 469; `SIDEBAR_KEYBOARD_SHORTCUT="b"` at 32 + handler 96-109; `sidebar_state` cookie write at 84-85; `SheetContent data-mobile="true"` at 186-189; collapse button `aria-label` swap at app-sidebar.tsx:87; badge/dot gating `pendingCount > 0` at 174-188; resize handle `role="separator"` + `sidebar_width` cookie at sidebar-resize-handle.tsx:47/90; token block + verified ratios at globals.css:87-96; `05-uat-s1-single-expand.yml` shows `separator "Resize sidebar"` and `button "Toggle Sidebar"` refs (driver targets); v1.1 phase docs (05/08) exist only at git `89f50c25` — the working tree was cleared by `e44f422e`; dev DB has 0 pending `signal_proposal` rows (RESEARCH, live query).
