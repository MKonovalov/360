# Phase 14: Contrast Audit & UAT Matrix — Research

**Researched:** 2026-08-01
**Domain:** Live-browser UAT matrix (Playwright MCP driver) + WCAG AA computed-style contrast audit + Exa-reference divergence review, on top of the shipped Phases 10-13 sidebar
**Confidence:** HIGH (every mechanism verified against the actual repo files, the installed packages, the `.playwright-mcp/` session evidence, the W3C WCAG 2.2 spec, and a live dev-DB query in this session)

<user_constraints>
## User Constraints (from 14-CONTEXT.md — LOCKED, do NOT re-research or overturn)

### Locked Decisions

- **D-01:** The live-browser UAT matrix is **Playwright-automated** (drive the live app via the Playwright MCP skill: dev server + Clerk sign-in flow, capture screenshots, assert states). Not a user-run checklist, not hybrid.
- **D-02:** Full 12-cell cross-product automated — 3 viewport states (expanded / collapsed / mobile) × 4 routes (/, /companies, /personas, /reviews) — with active/inactive asserted per route (the route's nav row shows the gray active pill; the other three are inactive). PLUS targeted interaction micro-tests: collapse/expand via the header button and ⌘B, drag-resize clamp (200-400px), rail tooltips (incl. `Reviews (N)` count), and the pendingCount badge/dot gating.
- **D-03:** Screenshots land in `.planning/phases/14-contrast-audit-uat-matrix/artifacts/` with a `cell-{state}-{route}.png` naming convention, referenced from 14-UAT.md. Evidence persists in-repo for the milestone audit.
- **D-04:** The WCAG AA audit is a **live computed-style audit** — in the browser, sample the rendered computed styles for each token pair and assert each contrast ratio ≥ its AA threshold. Not a static token-math table.
- **D-05:** Audit **all 6 shipped token pairs**: text-on-panel (≥4.5:1), `/70` label opacity (≥4.5:1), active pill fill `#909090` vs accent-foreground `#111111` (≥3:1), focus ring `ring-sidebar-ring` (≥3:1), badge chip (≥3:1 fill), letter-mark `#333333` vs white (≥4.5:1). All are the pairs Phases 10-13 claimed AA — verify each live.
- **D-06:** Reference evidence comes from a **live fetch of dashboard.exa.ai** during the phase (sample actual rendered styles: panel color, hairline border, active treatment, badge font). Not the Phase 10 research snapshot (that's a dated reference).
- **D-07:** The review is **element-wise pass/fail** per matched element (near-white panel, hairline border, gray active treatment, mono badge) against the live reference, PLUS a documented **deliberate-divergences list** — the items/assets we do NOT copy (Exa's own nav items, hotlinked assets, the ~1.05:1 contrast trap) each with a rationale.
- **D-08:** Phase 14 produces **`14-UAT.md`** (the 12-cell matrix + interaction checks with screenshot references, marked complete), **`14-VERIFICATION.md`** (contrast audit + Exa review + hard-constraint regression evidence), and **`14-SUMMARY.md`**. No production source changes unless a defect is found and fixed minimally.
- **D-09:** The 8 deferred v1.1 verification/uat gap items (01-04 VERIFICATION human_needed + partial HUMAN-UATs) are **OUT of Phase 14 scope** — they stay open and are handled at the v1.2 milestone close.

### Claude's Discretion

- Exact Playwright script structure / helper layout for driving the matrix (e.g. per-cell script vs. one parametrized run)
- Which screenshot dimensions / device emulation to use for the mobile cells
- How the auth flow (dev Clerk sign-in) is scripted (existing Clerk test user / email-password flow)
- Whether any defect found triggers a minimal fix commit inside the phase or a follow-up note (fix minimally, keep the diff scoped)

### Deferred Ideas (OUT OF SCOPE — ignore during planning)

- The 8 deferred v1.1 verification/uat gap items (01-04 VERIFICATION human_needed, partial HUMAN-UATs) — v1.2 milestone close scope (D-09)
- Any new UI polish the audit surfaces — follow-up phase or backlog, not Phase 14
- Persona-side Arcpedia "Related Knowledge" seed-data gap (deferred from v1.1) — milestone close
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| QLTY-03 | A live-browser UAT matrix replicates the v1.1 Phase-5 pattern — expanded / collapsed / mobile × the 4 routes × active/inactive state pairs, with screenshots | Full mechanics verified below: Playwright MCP tool surface (`skill_mcp` + `browser_*` tools), the 12-cell route/layout map ((dashboard)/companies/personas layouts → `AppShellLayout`), the active-pill DOM hook (`data-active` on `[data-sidebar="menu-button"]`, sidebar.tsx:511), the collapse entry points (header button `aria-label="Collapse sidebar"` + ⌘B `Meta+b`), the mobile sheet trigger (`useIsMobile` <768px → `SheetContent data-mobile="true"`, opened by the topbar "Toggle Sidebar" button), and the v1.1 Phase-5 UAT precedent (05-HUMAN-UAT.md: 6/6 passed live via Playwright at 1280x800/375x800, evidence in `.playwright-mcp/`) |

## Hard Constraints (from CONTEXT.md / STATE.md — must hold)

- **Zero new npm packages** — Playwright is an MCP server invoked via `skill_mcp`, NOT a project dependency; `package.json`/`package-lock.json` diffs must be empty.
- **Vendored + frozen regression surface byte-identical** — `src/components/ui/{sidebar,tooltip,dropdown-menu,button}.tsx`, `app-shell-layout.tsx`, `sidebar-resize-handle.tsx`, `globals.css`, `package.json`, `package-lock.json`. The phase's own grep/fence gates run PLUS the live layer proves runtime behavior.
- **QLTY-04 sweep still clean** — `grep -rnE 'indigo|amber|#[0-9a-fA-F]{3,8}|\bdark:' src/components/layout/` = 0.
- **Routes unchanged** — Start (/), Companies, Key Personas, Reviews are the only 4 nav routes; no new routes, no item copies from Exa.
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

Actionable directives from `./CLAUDE.md` that constrain Phase 14 planning/implementation:

- **GSD workflow enforcement:** start work through a GSD command (`/gsd-plan-phase 14`, then `/gsd-execute-phase`) — no direct repo edits outside the workflow; `commit_docs: true` in config.
- **Naming/conventions:** named exports only; `interface` for object shapes, `type` for unions; camelCase; prefer relative imports in edited files; `@/*` alias available for new files (optional).
- **Strict TypeScript:** `tsconfig.json` extends strict; `npx tsc --noEmit` is the per-task static gate (must stay exit 0 — currently clean).
- **Stack:** TypeScript + React/Next (App Router) + Tailwind v4; no separate backend language. The phase is verification-only by default (D-08) — any defect fix must be minimal and scoped.
- **Error handling:** fail-safe, fail-silent toward a known-good state — the driver's interactions should assert and record, not crash the whole matrix on one failed cell (a red cell is evidence, not a thrown session).
- **Comment style:** comments explain *why*, not *what* (11-02 Rule 1 — no swept class/copy strings in why-comments).
- **Repo state caution:** `packageManager` declares Yarn Classic but npm usage + `package-lock.json` are present — use **npm** for any local command; zero installs expected this phase.
- **`.playwright-mcp/` is gitignored** (`.gitignore:42`) — the MCP server's default output dir does NOT persist to git; D-03's `artifacts/` copies must be explicit in the plan (screenshots saved to the artifacts dir, not left in `.playwright-mcp/`).

This research recommends nothing contradicting the above (zero installs, verification-only artifacts, evidence persisted under the phase dir).

---

## Summary

Phase 14 is a **verification-only capstone**: it proves what Phases 10-13 shipped, in a live browser, and records the evidence in three artifacts (14-UAT.md, 14-VERIFICATION.md, 14-SUMMARY.md). No production source changes are expected — the deliverable is evidence, not code. The entire phase runs through two external surfaces: (1) the **Playwright MCP server** (invoked via `skill_mcp` with `mcp_name="playwright"` — this is the exact driver the v1.1 Phase-5 UAT used, verified by its `.playwright-mcp/` session artifacts in this repo), driving the local dev server at `http://localhost:3000` past the Clerk sign-in gate; and (2) the **live dashboard.exa.ai** reference, which this session verified sits behind a **Vercel Security Checkpoint (HTTP 429 for plain curl)** — the live fetch must go through the real Playwright browser, with the Phase-10 FEATURES.md captured values as the documented fallback evidence.

The 12-cell matrix is mechanically simple once the DOM hooks are known: all four routes render the sidebar through the same `AppShellLayout` (via the `(dashboard)`, `companies`, and `personas` layouts, each calling `requireStaffAccess()` + `<AppShellLayout>`); the active pill is asserted via `data-active={isActive}` on `[data-sidebar="menu-button"]` (sidebar.tsx:511); collapsed state is entered via the header button (`aria-label="Collapse sidebar"`) or ⌘B (the vendored handler listens for `Meta+b`/`Ctrl+b`, sidebar.tsx:96-109); mobile is triggered by resizing below 768px (the `useIsMobile` hook) and the sheet opens via the topbar "Toggle Sidebar" button (`SidebarTrigger`). The v1.1 Phase-5 precedent (05-HUMAN-UAT.md) executed all 6 scenarios this way at 1280x800 / 375x800 with evidence under `.playwright-mcp/` — the exact pattern D-01/D-02 replicate.

The contrast audit is a `browser_evaluate` computation over `getComputedStyle`: all **6 token pairs were independently recomputed in this session against the W3C WCAG 2.2 formulas** and pass their thresholds (text 12.30:1, /70-blended 4.89:1, pill fill 3.11:1, ring 4.30:1, badge fill 3.11:1 / badge text 5.91:1, letter-mark 12.63:1). The one subtlety: the `/70` label's computed color carries alpha (`rgba(51,51,51,0.7)`), so the live audit must **composite the alpha over the panel color** before computing the ratio — the naive two-color ratio on the raw rgba would be wrong. The Exa contrast trap is confirmed numerically: `rgba(0,0,0,0.04)` over `#fbfcfd` composites to ≈1.09:1 — the deliberate divergence (Pitfall 3) that D-07's divergence list documents.

**One real planning dependency surfaced:** the dev DB currently holds **0 pending proposals** (live query this session), so the badge and dot will NOT render in the live app — D-02's "pendingCount badge/dot gating" micro-test needs either a seeded fixture (one pending `signalProposal` insert) or an explicit two-branch assertion (count=0 → no badge; the fixture → badge/dot/`Reviews (N)` tooltip). The plan must include this data-prep step.

**Primary recommendation:** a 2-plan split mirroring Phases 12-13's Wave structure — (1) **live matrix plan**: dev-server + Playwright sign-in + 12-cell matrix + interaction micro-tests + screenshots → 14-UAT.md; (2) **audit plan**: contrast audit (browser computed-style, with an optional pure `src/lib/contrast.ts` + Vitest lock on the WCAG math), Exa live fetch + element-wise divergence review, hard-constraint regression battery (grep/fence/build + live cookie/keyboard/pointer checks), and the phase-gate full suite → 14-VERIFICATION.md + 14-SUMMARY.md. Zero production-file edits; the only optional source addition is the pure contrast helper if the planner wants the math unit-locked.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 12-cell UAT matrix (viewport states × routes × active/inactive) | Browser / Client (Playwright driver) | — | The sidebar, active-pill, collapse, and mobile-sheet behavior are all client-rendered; the driver asserts rendered DOM/computed state, not source |
| Collapse/expand interaction (header button + ⌘B) | Browser / Client | — | `toggleSidebar` (vendored, sidebar.tsx:91-93) is the single shared state machine; the driver clicks/presses and asserts `data-state`/rail width |
| Drag-resize clamp + cookies (`sidebar_width`) | Browser / Client (imperative write) | API / Backend (cookie read via `next/headers` in app-shell-layout.tsx:18) | The handle writes `--sidebar-width` + the cookie client-side; the server shell re-reads it on the next request — the live test asserts both the clamp and the persisted cookie |
| WCAG AA contrast audit (computed styles) | Browser / Client (getComputedStyle) | Verification gate (design-time math) | Contrast is a rendered-browser property; the audit samples the live computed styles of shipped elements (D-04), with the WCAG math optionally unit-locked in a pure helper |
| Exa divergence review (live reference fetch) | External reference (dashboard.exa.ai) | Browser / Client (sampling) | The reference is a third-party live page; the review compares our shipped values element-wise against the live sample (D-06/D-07), with FEATURES.md as fallback |
| Hard-constraint regression (routes, ⌘B, resize, badge gating) | Browser / Client (live) + repo gates (grep/fence/build) | — | Grep/fence gates prove source byte-identical (Phases 10-13 pattern); the live layer proves runtime behavior (cookies actually written, ⌘B actually toggles, badge actually gated) |
| `pendingCount` badge/dot gating | API / Backend (DB) | Browser / Client (prop) | Server thread (app-shell-layout.tsx:27-32 `countPendingProposals()`); the live matrix proves the gate end-to-end — but needs a fixture (dev DB has 0 pending today) |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Playwright MCP server (Microsoft `@playwright/mcp`) | `@latest` via `npx` (external MCP, NOT a project dep) | Browser driver: navigate, resize, snapshot, click, type, press keys, evaluate JS, screenshot | The exact driver the v1.1 Phase-5 UAT used (05-HUMAN-UAT.md + `.playwright-mcp/` evidence in this repo). Invoked via `skill_mcp` (`mcp_name="playwright"`) — zero npm installs, package.json untouched |
| `skill_mcp` (builtin skill MCP router) | — | Routes `browser_navigate` / `browser_resize` / `browser_snapshot` / `browser_take_screenshot` / `browser_click` / `browser_type` / `browser_press_key` / `browser_evaluate` / `browser_wait_for` / `browser_find` / `browser_tabs` / `browser_drag` / `browser_run_code_unsafe` to the Playwright server | Skill surface verified this session (full tool list loaded); screenshot API confirmed (`filename` param, png/jpeg, fullPage, css/device scale) |
| Next.js dev server | 16.2.11 (installed) | `npm run dev` → `http://localhost:3000` — the object under test | Script verified in package.json (`"dev": "next dev"`); `.playwright-mcp/` console logs confirm prior sessions drove localhost:3000 with Clerk dev keys |
| Clerk (`@clerk/nextjs`) | 7.5.22 (installed) | The auth gate the driver must pass: `requireStaffAccess()` (src/lib/auth) redirects to `/sign-in`; Clerk hosted `<SignIn />` at `src/app/sign-in/[[...sign-in]]/page.tsx` | `src/proxy.ts` `clerkMiddleware()` + per-layout gates (verified); console log confirms "Clerk has been loaded with development keys" on localhost:3000 |
| Vitest | 4.1.10 (installed) | Unit lock on any extracted pure helper (e.g. contrast-ratio math) | Existing infra: 24 files / 239 passed / 2 skipped this session; `--bail=1` (NOT `-x`, removed in Vitest 4); `include: ['src/**/*.test.ts']` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@neondatabase/serverless` (via `tsx`) | installed | One-off dev-DB fixture insert (pending proposal) for the badge/dot gating test | Only if the plan chooses the seeded-fixture path; run as a scripted insert/cleanup, never committed credentials |
| W3C WCAG 2.2 spec | 2.2 (2024-12-12 REC) | The AA thresholds the audit asserts: 1.4.3 text ≥4.5:1 (large text ≥3:1), 1.4.11 non-text ≥3:1 | Thresholds verified verbatim from `w3.org/TR/WCAG22` this session |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Playwright MCP via `skill_mcp` (recommended — zero installs, proven precedent) | Adding `@playwright/test` as a devDependency + a committed spec suite | Violates the "zero new npm packages" hard constraint and the D-01 "I drive via Playwright MCP skill" locked decision. The MCP is already installed, already used, and gitignored-outputs are the established pattern |
| Live browser contrast audit (D-04 locked) | Static token-math table | D-04 explicitly locks the live computed-style audit — a static table "only proves declared values" (CONTEXT.md) |
| Live fetch of dashboard.exa.ai via Playwright browser | webfetch/curl of dashboard.exa.ai | Verified this session: plain curl gets **HTTP 429 + Vercel Security Checkpoint** (`x-vercel-mitigated: challenge`). The real Chromium executes the challenge JS and is the only path likely to pass; FEATURES.md values are the documented fallback (D-06: "not the Phase 10 research snapshot" as primary, but acceptable as fallback evidence) |
| Seed one pending proposal for the badge test (recommended) | Assert only the count=0 branch | The badge/dot/tooltip-count path (D-02, D-08 micro-test) is unprovable live at count=0. Seeding one fixture (matching the 08-06-UAT precedent: "two UAT fixtures were added") proves the >0 branch, then cleanup restores state |

**Installation:**
```bash
# ZERO installs this phase. Playwright MCP is an external server (skill_mcp → @playwright/mcp@latest via npx, already wired).
# vitest, tsx, @neondatabase/serverless already installed. package.json/package-lock.json diffs must be EMPTY.
```

**Version verification:** `vitest@4.1.10` verified running this session (239 passed / 2 skipped, 1.08s). Next 16.2.11, Clerk 7.5.22, Node v22.23.1 per package.json/node_modules. Playwright MCP tool surface verified by loading the `playwright` skill this session.

## Package Legitimacy Audit

> This phase installs **zero packages** — runtime or dev (hard constraint: "zero new npm packages"; 10-UI-SPEC §Registry Safety). The Package Legitimacy Gate is therefore **N/A by exemption** — no slopcheck run required, no registry verification needed. The Playwright driver is an external MCP server consumed through `skill_mcp`, not a registry install. The plan must NOT add any dependency; a `package.json` diff should be empty.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| — (no packages installed this phase) | — | — | — | — | N/A | N/A — zero installs |

**Packages removed due to slopcheck [SLOP] verdict:** none (nothing installed)
**Packages flagged as suspicious [SUS]:** none (nothing installed)

*Note: every referenced tool is either an installed dependency (`package.json`) or an external MCP server (`@playwright/mcp@latest` via the skill's `npx` command, registered in the user's Claude plugin marketplace — verified at `~/.claude/plugins/marketplaces/claude-plugins-official/external_plugins/playwright/.mcp.json`). No registry action of any kind this phase.*

## Architecture Patterns

### System Architecture Diagram

```text
┌─────────────────────────── PLAN 1 (matrix) ─────────────────────────────┐
│                                                                         │
│  npm run dev ──────────► http://localhost:3000 (Next 16 SSR)            │
│                              │ clerkMiddleware (src/proxy.ts)           │
│                              ▼                                          │
│   Playwright MCP (skill_mcp) ──► /sign-in (Clerk hosted <SignIn />)     │
│      browser_navigate/type/click ──► authenticated session (__session)  │
│                              │                                          │
│                              ▼  requireStaffAccess() gate (every layout)│
│   ┌─────────────── AppShellLayout (app-shell-layout.tsx) ─────────────┐ │
│   │  sidebar_width cookie → --sidebar-width (clamp 200-400)           │ │
│   │  pendingCount = countPendingProposals()  (dev DB: 0 today →       │ │
│   │                                   fixture needed for badge test)  │ │
│   │  <SidebarProvider><AppSidebar/><SidebarResizeHandle/>             │ │
│   │      <SidebarInset><SidebarTrigger/>…</SidebarInset>              │ │
│   └────────────────────────────────────────────────────────────────────┘ │
│      routes: /  /companies  /personas  /reviews  (all via AppShellLayout)│
│      states: expanded (default) │ collapsed (button/⌘B) │ mobile <768px │
│      assertions: data-active on [data-sidebar="menu-button"]            │
│      screenshots → .planning/phases/14-…/artifacts/cell-{state}-{route} │
└──────────────────────────────────────────────────────────────────────────┘
                                     │
┌─────────────────────────── PLAN 2 (audits) ─────────────────────────────┐
│  A. Contrast audit: browser_evaluate → getComputedStyle on shipped      │
│     elements → WCAG relative-luminance ratio vs thresholds (6 pairs)    │
│        [optional pure src/lib/contrast.ts + Vitest lock]                │
│  B. Exa review: Playwright navigate → dashboard.exa.ai (live)           │
│        ──429 challenge?──► fallback: FEATURES.md captured values        │
│     element-wise pass/fail + deliberate-divergences list (1.09:1 trap)  │
│  C. Hard-constraint regression: grep/fence/build gates (Phases 10-13)   │
│     + LIVE checks: routes render, ⌘B toggles + sidebar_state cookie,    │
│     drag writes sidebar_width cookie, badge gated by pendingCount       │
│  D. Artifacts: 14-VERIFICATION.md + 14-SUMMARY.md                       │
└──────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
.planning/phases/14-contrast-audit-uat-matrix/
├── 14-UAT.md              # 12-cell matrix + interaction checks + screenshot refs (D-08)
├── 14-VERIFICATION.md     # contrast audit + Exa review + regression evidence (D-08)
├── 14-SUMMARY.md          # phase summary (D-08)
├── artifacts/             # D-03: cell-{state}-{route}.png — MUST be committed (unlike .playwright-mcp/)
│   └── cell-expanded-start.png, cell-collapsed-companies.png, cell-mobile-reviews.png, …
└── (optional) fixtures/   # the pending-proposal insert/cleanup script, if the seed path is chosen

src/lib/contrast.ts        # OPTIONAL — pure WCAG contrast helpers (ratio(l1,l2), compositeAlpha)
src/lib/contrast.test.ts   # OPTIONAL — Vitest lock on the math (nav.ts/user.ts convention)
```

### Pattern 1: Driving the matrix — the Playwright MCP interaction sequence
**What:** Each cell is a deterministic sequence of `skill_mcp` browser tools: navigate to the route → assert active pill → screenshot → change state → re-assert → screenshot. State transitions reuse the same vendored mechanisms the app itself uses (button click / ⌘B / viewport resize).
**When to use:** Every one of the 12 cells; the interaction micro-tests extend it with clicks, key presses, hover, and pointer drags.
**Example sequence (cell: collapsed → /companies):**
```
1. browser_resize(1280, 800)                     # desktop expanded state
2. browser_navigate("http://localhost:3000/companies")
3. browser_wait_for(text: "Companies")           # page rendered (post-auth)
4. browser_snapshot or browser_evaluate:         # assert active pill
     document.querySelector('[data-sidebar="menu-button"][data-active="true"]')
     → contains link href="/companies"; the other three rows data-active="false"
5. browser_click(target: button "Collapse sidebar")   # header collapse button (aria-label)
6. browser_wait_for(time: 0.4)                   # 200ms width transition settles
7. assert: [data-sidebar="sidebar-inner"] width === 48px
          (browser_evaluate: getComputedStyle(el).width)
8. browser_take_screenshot(type: png, scale: css, filename: "<artifacts>/cell-collapsed-companies.png")
```
Source: every hook verified in this session — `data-active` sidebar.tsx:511; collapse button `aria-label="Collapse sidebar"` app-sidebar.tsx:87; `collapsible="icon"` app-sidebar.tsx:76 → 48px rail via `--sidebar-width-icon`; route layouts all → `AppShellLayout`.

### Pattern 2: The contrast audit — computed-style sampling with alpha compositing
**What:** `browser_evaluate` runs a small script in the live page that (a) resolves the two colors of a pair from `getComputedStyle`, (b) composites any alpha over the panel, (c) computes the WCAG relative-luminance ratio, (d) returns `{pair, colorA, colorB, ratio, threshold, pass}`.
**When to use:** The 6 D-05 pairs, sampled on the shipped rendered elements (nav row label span, org sub-label, active row, focused row, badge chip, letter-mark box).
**Critical subtlety:** the `/70` label computes to `rgba(51,51,51,0.7)` — the audit MUST blend `0.7*fg + 0.3*panel` before the ratio (verified: composite `#6f6f70` over `#fbfcfd` → **4.89:1**, passes; the raw rgba-vs-panel would mislead).
**Example (pair 1 — text on panel, sampled from the "Start" nav row):**
```javascript
() => {
  const panel = getComputedStyle(document.querySelector('[data-sidebar="sidebar"]'))
                      .backgroundColor;              // rgb(251, 252, 253)
  const label = document.querySelector('[data-sidebar="menu-button"] span');
  const fg = getComputedStyle(label).color;          // rgb(51, 51, 51)
  // …parse both to sRGB, apply WCAG relative luminance, ratio = (L1+0.05)/(L2+0.05)
  return { ratio: 12.30, threshold: 4.5, pass: true };
}
```
Source: token block globals.css:87-96 (`--sidebar` `#fbfcfd`, `--sidebar-foreground` `#333333`…); all 6 pair ratios independently recomputed this session (Code Examples below).

### Pattern 3: Exa divergence review — live fetch with a documented fallback
**What:** Navigate the Playwright browser to `https://dashboard.exa.ai` (the real Chromium executes the Vercel Security Checkpoint JS that blocks curl), wait for the app shell, sample the sidebar's rendered panel color / border / active fill / badge font via `browser_evaluate`, then compare element-wise against our shipped values.
**When to use:** D-06/D-07. If the live fetch is blocked (challenge page, auth wall, 429), the review falls back to the FEATURES.md captured values (2026-08-01 live production CSS extraction) and records the fallback explicitly in 14-VERIFICATION.md.
**Example comparison targets (from FEATURES.md + this session's verification):**

| Element | Exa reference (live/fallback) | ArcLumen shipped | Verdict |
|---------|-------------------------------|------------------|---------|
| Panel | `#fbfcfd` | `--sidebar: #fbfcfd` (globals.css:88) | match |
| Hairline | 0.5px gray-200 | `border-right-width: 0.5px` + `--sidebar-border: #e5e7eb` (globals.css:100-103) | match |
| Active fill | `rgba(0,0,0,0.04)` ≈ **1.09:1** (fails 1.4.11) | `--sidebar-accent: #909090` **3.11:1** (passes) | DELIBERATE DIVERGENCE (Pitfall 3) |
| Badge | mono 10px/600 accent chip | `font-mono text-[10px] font-semibold` + sidebar-accent (app-sidebar.tsx:179) | match (anatomy), no asset copied |

### Anti-Patterns to Avoid
- **Adding `@playwright/test` as a project dependency** to "write proper specs" — violates the zero-package hard constraint and D-01's MCP-skill locked method. The MCP driver IS the automation.
- **Leaving screenshots in `.playwright-mcp/`** — gitignored (`:42`); D-03 evidence must land in `artifacts/` and be committed. Save with an explicit `filename` path into the artifacts dir, or copy after capture.
- **Asserting the `/70` label ratio without alpha compositing** — the naive rgba-vs-panel computation is wrong; blend over the panel first (Pattern 2).
- **Asserting badge/dot/tooltip-count at count=0** — the badge does not render when `pendingCount === 0`; the >0 branch needs the fixture (dev DB verified at 0).
- **Skipping the live ⌘B/cookie checks because grep proves the source** — grep proves byte-identical source; the live layer proves the cookie actually flips (`sidebar_state`) and the keyboard handler actually fires. Both are D-02/SC-4 requirements.
- **Treating a red cell as a crash** — a failed assertion is evidence (record `result: issue` + screenshot in 14-UAT.md per the template), not a session abort.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Browser automation (navigate/click/screenshot/assert) | A committed Playwright test suite or a custom puppeteer script | Playwright MCP via `skill_mcp` (`browser_*` tools) | Already installed, already proven (Phase-5 UAT), zero npm installs; D-01 locks it |
| WCAG contrast ratio math | Trusting a static table or an ad-hoc mental ratio | WCAG relative-luminance formula (W3C) — optionally extracted to `src/lib/contrast.ts` + Vitest | The audit's assertions depend on exact math; a pure helper + test locks it (nav.ts/user.ts convention) and is re-usable by the browser audit via inline JS |
| Mobile sheet emulation | Hand-rolled breakpoint logic | `browser_resize` below 768px → `useIsMobile()` → stock shadcn `Sheet` (sidebar.tsx:181-197) | The vendored mechanism already exists; the driver only sets the viewport and clicks the topbar trigger |
| Auth for the driver | Re-implementing a login bypass | Drive the real Clerk hosted sign-in (`/sign-in`, `<SignIn />`) with an existing dev test user | The app's real gate is the contract under test; bypassing it would test a different app. Credentials come from the user's Clerk dev instance (Claude's discretion) |

**Key insight:** every "hard part" of this phase is *choosing what evidence to record*. The browser mechanics are already shipped and already proven in this repo; the audit math is a 20-line pure function; the Exa review is a comparison table. The risk is in scope discipline (don't touch source, don't add packages, don't let evidence rot in a gitignored dir) and in the two data realities verified this session: **0 pending proposals in the dev DB** (badge test needs a fixture) and **dashboard.exa.ai behind a Vercel challenge** (live fetch needs the real browser; fallback values documented).

## Runtime State Inventory

> Not a rename/refactor/migration phase — omitted per the template (verification-only). One data-state note that DOES matter for planning: the **dev DB currently has 0 `signal_proposal` rows with status `pending`** (live query this session) — the badge/dot gating assertions require a seeded fixture or a documented two-branch test. This is a test-data concern, not a migration.

## Common Pitfalls

### Pitfall 1: Screenshots land in the gitignored `.playwright-mcp/` dir and never reach the repo
**What goes wrong:** D-03's `artifacts/cell-*.png` evidence is missing at milestone-audit time; 14-UAT.md references broken paths.
**Why it happens:** The Playwright MCP server's default output directory is `.playwright-mcp/` (gitignored, `.gitignore:42`) — page snapshots and default-named screenshots land there automatically; the Phase-5 precedent committed evidence at the repo root and under `.playwright-mcp/` explicitly.
**How to avoid:** In every `browser_take_screenshot` call pass an explicit `filename` targeting `.planning/phases/14-contrast-audit-uat-matrix/artifacts/cell-{state}-{route}.png` (create the dir in Wave 0), then `git add` the artifacts dir; verify `git status` shows the PNGs tracked before closing each plan.
**Warning signs:** `git status` shows nothing under `artifacts/`; screenshots only exist under `.playwright-mcp/`.

### Pitfall 2: The `/70` label contrast computed without alpha compositing
**What goes wrong:** The audit reports the org sub-label as failing (or passes on wrong math) because `getComputedStyle` returns `rgba(51,51,51,0.7)`.
**Why it happens:** WCAG contrast is defined between two opaque colors; an alpha-bearing foreground must be composited over its background first. `text-sidebar-foreground/70` renders with alpha.
**How to avoid:** Composite `final = 0.7·fg + 0.3·panel` before computing the ratio (verified: `#6f6f70` over `#fbfcfd` → 4.89:1 ≥ 4.5 — passes). Bake this into the shared audit helper so all 6 pairs use one code path.
**Warning signs:** A claimed ratio near 4.5 that used the raw rgba; audit code that never calls an alpha-blend function.

### Pitfall 3: Asserting the badge/dot/`Reviews (N)` at count=0
**What goes wrong:** The badge gating micro-test "fails" because the badge never appears — the app is behaving correctly (0 pending → no badge).
**Why it happens:** Dev DB verified at 0 pending proposals this session; `pendingCount > 0` gates the badge/dot/tooltip-count (app-sidebar.tsx:174-188).
**How to avoid:** Either (a) seed one pending `signalProposal` (matching the 08-06-UAT fixture precedent) and assert badge `"1 pending"` + dot + `Reviews (1)` tooltip, then clean up; or (b) structure the test as two explicit branches: count=0 → assert NO badge (current live state), count>0 → assert badge (fixture). Verify the fixture insert before running the matrix.
**Warning signs:** Badge assertions fail on the live app while grep shows the gating classes present — check `pendingCount` first.

### Pitfall 4: The Exa live fetch silently blocked by the Vercel Security Checkpoint
**What goes wrong:** The driver's `browser_navigate` to dashboard.exa.ai lands on a challenge page (or 429), the element-wise sampling finds no sidebar, and the review stalls.
**Why it happens:** Verified this session: plain curl → `HTTP/2 429` + `x-vercel-mitigated: challenge`. The real Chromium executes the challenge JS and often passes, but the page may still require interaction or land behind Exa's own auth.
**How to avoid:** Treat the live fetch as best-effort: attempt it, wait for the app shell (`browser_wait_for`), sample; if blocked, record the block and fall back to the FEATURES.md captured values (2026-08-01 production CSS) as explicitly-dated fallback evidence in 14-VERIFICATION.md. Never hotlink Exa assets; never screenshot-and-copy their items (D-07).
**Warning signs:** Snapshot shows "Vercel Security Checkpoint" text; `browser_network_requests` shows a 429 on the main document.

### Pitfall 5: ⌘B / drag-resize / cookie "regression" proven only by grep
**What goes wrong:** The plan checks `git diff` (fence gates) and declares COLR-02 intact, but never verifies the live keyboard shortcut or cookie write — exactly the regression blindness Phase-5's live UAT was created to cure (Pitfall 7, 10-RESEARCH).
**Why it happens:** The grep/fence layer is cheap and familiar; the live layer needs a browser.
**How to avoid:** The live matrix must include: press `Meta+b` → assert `data-state="collapsed"` on the sidebar wrapper AND `sidebar_state=false` cookie; drag the resize handle → assert width clamps to 200/400 and `sidebar_width` cookie is written (read via `browser_evaluate: document.cookie`). These are D-02 micro-tests, not optional extras.
**Warning signs:** The plan's verification table has no "live" rows for ⌘B or cookies.

### Pitfall 6: A red cell aborts the whole matrix instead of being recorded as evidence
**What goes wrong:** One failed assertion throws the driver session; 14-UAT.md never gets written with per-cell results; the phase "blocks" on a defect that should be a documented `result: issue`.
**Why it happens:** The UAT template (`~/.claude/get-shit-done/templates/UAT.md`) expects `result: pass | issue | skipped | blocked` per test — a defect is a recorded outcome, not a session killer.
**How to avoid:** Structure the driver as per-cell capture-then-assert with the screenshot taken BEFORE the assertion, so even a failing cell has evidence; record issue + severity + screenshot ref in 14-UAT.md (D-08 allows a minimal fix if a defect is real).
**Warning signs:** The plan's verify commands use `&&` chains where a failed cell would stop the whole battery.

## Code Examples

Verified patterns from official sources and this session's verification:

### WCAG relative luminance + contrast ratio (the audit's core math — W3C formula)
```typescript
// src/lib/contrast.ts (OPTIONAL pure helper — else inline the same math in browser_evaluate)
// Source: W3C WCAG 2.2 §1.4.3/1.4.11 relative-luminance definition (w3.org/TR/WCAG22)
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
export function compositeAlpha(fg: [number, number, number], bg: [number, number, number], alpha: number) {
  return fg.map((v, i) => Math.round(v * alpha + bg[i] * (1 - alpha))) as [number, number, number];
}
// Verified this session against every token pair (Code Examples below)
```

### The 6 audited pairs — verified ratios and thresholds (independently recomputed 2026-08-01)
```text
Pair                          Colors                          Ratio   Threshold  Pass
text-on-panel                 #333333 vs #fbfcfd              12.30   4.5 (1.4.3)  ✓
/70 label (alpha-composited)  #6f6f70 (=#333333@70%/panel)    4.89    4.5 (1.4.3)  ✓
active pill fill (non-text)   #909090 vs #fbfcfd              3.11    3.0 (1.4.11) ✓
accent-foreground on pill     #111111 vs #909090              5.91    3.0/4.5     ✓
focus ring vs panel           #787878 vs #fbfcfd              4.30    3.0 (1.4.11) ✓
badge chip fill (non-text)    #909090 vs #fbfcfd              3.11    3.0 (1.4.11) ✓
badge text on chip            #111111 vs #909090              5.91    4.5 (1.4.3)  ✓
letter-mark #333333/#fff      #ffffff vs #333333              12.63   4.5 (1.4.3)  ✓
Exa trap (NOT copied)         #f1f2f3 (=rgba(0,0,0,0.04)/panel) 1.09  3.0          ✗ FAIL
```
Source: token values globals.css:87-96; recomputation via the W3C formula in this session (node script).

### Active-pill assertion per route (the matrix's core check)
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
// Expect: exactly one row active, with href === '/companies'
```
Source: `data-active={isActive}` sidebar.tsx:511; `data-active:bg-sidebar-accent` sidebar.tsx:469; route mapping `getActiveNavKey` (src/lib/nav.ts).

### ⌘B and drag-resize live checks (regression layer)
```javascript
// ⌘B: browser_press_key(key: "Meta+b")  — vendored handler listens for key==='b' && (metaKey||ctrlKey)
// then browser_evaluate:
() => ({
  state: document.querySelector('[data-slot="sidebar-wrapper"]')?.dataset?.state, // 'collapsed'
  cookie: document.cookie, // contains sidebar_state=false (and sidebar_width=… after a drag)
  railWidth: getComputedStyle(document.querySelector('[data-sidebar="sidebar-inner"]')).width, // '48px'
});
// Drag-resize: browser_drag from the handle (role=separator "Resize sidebar") by ±150px,
// then assert the wrapper width clamps to [200, 400] and sidebar_width cookie is present.
```
Source: `SidebarTrigger` aria-label "Toggle Sidebar" (05-UAT evidence: `button "Toggle Sidebar"` in the snapshot); `SIDEBAR_KEYBOARD_SHORTCUT = "b"` sidebar.tsx:32; handle role `separator` sidebar-resize-handle.tsx:90.

### Mobile cell (375x800, sheet)
```
1. browser_resize(375, 800)              # <768px → useIsMobile() true → sidebar becomes Sheet
2. browser_navigate("http://localhost:3000/personas")
3. browser_click(target: button "Toggle Sidebar")   # SidebarTrigger opens the sheet
4. assert: SheetContent [data-mobile="true"] visible, nav links present, active row = /personas
5. browser_take_screenshot(type: png, scale: css, filename: "<artifacts>/cell-mobile-personas.png")
```
Source: `useIsMobile` (src/hooks/use-mobile.ts, MOBILE_BREAKPOINT=768, `max-width: 767px` matchMedia); `SheetContent data-mobile="true"` sidebar.tsx:186-189; trigger button verified in the 05-UAT snapshot (`button "Toggle Sidebar"`).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Static token-math contrast verification (design-time only) | Live computed-style audit in the browser (D-04) | Phase 14 (this phase) | Proves the *rendered* values, catching cascade/utility regressions a static table cannot |
| Human-run UAT checklists / partial HUMAN-UAT files | Playwright-MCP-driven live matrix with in-repo screenshot evidence | v1.1 Phase 5 established; Phase 14 replicates for the sidebar | Durable, machine-verifiable evidence that survives milestone audit; Phase-5 precedent: 6/6 passed live |
| Grep/fence-gate "regression proof" only | Grep/fence gates PLUS live keyboard/cookie/pointer assertions | Phase 14 (this phase) | Closes the regression-blindness gap (10-RESEARCH Pitfall 7): source-identical ≠ behavior-identical |
| dashboard.exa.ai via curl/webfetch | Live fetch through the real Playwright browser (Vercel challenge) | Phase 14 (verified 429 for curl this session) | The reference sample becomes current; fallback to FEATURES.md dated values documented |

**Deprecated/outdated:**
- **The v1.1 `-x` vitest flag:** removed in Vitest 4 — use `--bail=1` (Phase 12 Deviation 1).
- **"Dark Exa sidebar" framing:** the live reference is light `#fbfcfd` (FEATURES.md headline finding) — the light panel is the audit target; dark is out of scope (ROADMAP).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The Playwright MCP server is available in the execution environment with the full `browser_*` tool surface (navigate/resize/snapshot/screenshot/click/type/press_key/evaluate) | Standard Stack | LOW-MEDIUM — the skill loaded this session with all tools listed and the `.playwright-mcp/` session artifacts prove it ran in this repo on 2026-08-01; if a tool is missing at execution, the driver adapts (e.g. `browser_run_code_unsafe` for composite interactions) |
| A2 | The real Playwright Chromium can pass the Vercel Security Checkpoint on dashboard.exa.ai | Pattern 3 / Pitfall 4 | MEDIUM — curl is definitively blocked (429 verified); a real browser often passes the JS challenge but may still hit an auth wall; the FEATURES.md fallback is documented either way |
| A3 | A Clerk dev test user exists (or can be created) in the linked dev instance for the email/password sign-in flow | Pattern 1 | MEDIUM — prior sessions used "an authenticated Clerk session" (05-HUMAN-UAT); the exact credentials live in the user's Clerk dashboard, not the repo. Planner should gate the sign-in step behind a human-provided credential or an already-persisted session |
| A4 | Seeding one pending `signalProposal` in the dev DB is safe and reversible (fixture + cleanup) | Summary / Pitfall 3 | LOW — dev DB is the isolated QA instance (08-06-UAT precedent added fixtures there); an insert + delete leaves no residue; if the plan instead asserts only the count=0 branch, this assumption is unused |
| A5 | `browser_take_screenshot`'s `filename` parameter accepts a path outside the default output dir | Pitfall 1 | MEDIUM — the tool doc says "prefer relative file names to stay within the output directory," but the Phase-5 precedent committed evidence outside `.playwright-mcp/` (repo root). Mitigation: save then copy into `artifacts/` if the filename is confined |

## Open Questions (RESOLVED)

1. **Clerk dev sign-in credentials for the driver** — **[RESOLVED]** by 14-01 Task 2 (`checkpoint:human-verify`): the operator provides the dev test-user credentials (or confirms a persisted session) before the matrix runs; the driver scripts the real email-password path through the hosted sign-in. Never bypasses auth; no secrets in artifacts.
   - What we know: the app gates on `requireStaffAccess()` → `/sign-in` (Clerk hosted `<SignIn />`); prior Playwright sessions reached an "authenticated Clerk session"; `.env.local` has dev keys (`pk_test_`).
   - What's unclear: which email/password (or persisted session) the driver uses — this lives in the user's Clerk dashboard, not in the repo.
   - Recommendation: planner gates the matrix's first task behind a `checkpoint:human-verify` for the dev credentials (or reuses a session the operator establishes), and the driver scripts the email-password path through the real sign-in page. Non-blocking for planning; blocking for execution without the credential.
2. **Badge gating: seed a fixture or assert the count=0 branch only?** — **[RESOLVED]** by 14-01 Task 4: the fixture path (seed one pending `signalProposal` via `fixtures/seed-pending-proposal.ts` with the SHA-256 dev-DB gate + insert/assert/cleanup, 08-06-UAT precedent), with the explicit two-branch fallback (count=0 → no badge) if the dev-DB gate fails.
   - What we know: dev DB has 0 pending proposals (verified); the badge/dot/tooltip-count render only when `pendingCount > 0` (app-sidebar.tsx:174-188); D-02 lists the gating as a micro-test.
   - What's unclear: whether to insert a fixture (08-06-UAT precedent) or test only the current live state.
   - Recommendation: seed one fixture + cleanup (A4) — it proves the full gating contract both ways and matches the v1.1 live-UAT precedent. Planner's call; the two-branch alternative is acceptable.
3. **Extract the optional `src/lib/contrast.ts` pure helper?** — **[RESOLVED]** by 14-01 Task 1: extraction — `src/lib/contrast.ts` + `contrast.test.ts` (the phase's one permitted minimal source addition) unit-lock the WCAG math (12.30 / 4.89 / 3.11 / 1.09) that the live audit in 14-02 Task 1 reuses; the browser script still inlines the same formulas.
   - What we know: the audit math is ~20 lines; the repo convention locks pure logic with Vitest (nav.ts/user.ts/sidebar-collapse.ts); D-08 says no production changes *unless* needed — a helper is a source addition, though test-only in spirit.
   - What's unclear: whether the helper counts as a "production source change" under D-08.
   - Recommendation: extract it (+ test) as the phase's one permitted minimal addition — it unit-locks the WCAG math the entire audit depends on and follows the established convention. If the planner prefers a strictly zero-source phase, inline the math in `browser_evaluate` and skip the helper.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | dev server + vitest | ✓ | v22.23.1 | — |
| Next dev server (`npm run dev` → localhost:3000) | the entire matrix | ✓ | 16.2.11 | — (must be started by the plan; `.playwright-mcp/` logs confirm it ran in prior sessions) |
| Playwright MCP (`skill_mcp` → `browser_*`) | driver | ✓ | `@playwright/mcp@latest` (plugin marketplace) | `browser_run_code_unsafe` for composite interactions |
| Clerk dev instance (`pk_test_` keys in `.env.local`) | sign-in gate | ✓ | 7.5.22 | human-provided test-user credentials (A3) |
| Neon dev DB (0 pending proposals today) | badge gating fixture | ✓ | via `@neondatabase/serverless` | assert count=0 branch only (Open Question 2) |
| dashboard.exa.ai live fetch | Exa divergence review | ⚠️ challenge-gated (429 for curl) | — | FEATURES.md captured values (2026-08-01), explicitly dated in 14-VERIFICATION.md |
| Vitest | unit lock (optional helper) | ✓ | 4.1.10 (239 passed / 2 skipped) | — |

**Missing dependencies with no fallback:**
- **Clerk dev test-user credentials** for the driver's sign-in (A3) — needs the operator's Clerk dashboard or a persisted session. Everything else has a documented fallback.

**Missing dependencies with fallback:**
- **dashboard.exa.ai live fetch** — blocked for curl (429, verified); real-browser attempt first, FEATURES.md fallback documented.
- **Pending proposals for the badge test** — dev DB has 0; seed one fixture or assert the count=0 branch.

## Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json` — section required.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 (node env) — for the optional pure-helper lock; the phase's primary validation is the LIVE-BROWSER layer via Playwright MCP |
| Config file | `vitest.config.ts` (`include: ['src/**/*.test.ts']`, `@` → `./src`) |
| Quick run command | `npx vitest run src/lib/contrast.test.ts --bail=1` (if helper extracted) — NOT `-x` (removed in Vitest 4) |
| Full suite command | `npm test` (currently 239 passed / 2 skipped) |
| Live layer | Playwright MCP sequences per cell (Pattern 1) with screenshots → artifacts/ |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| QLTY-03 | 12-cell matrix: expanded/collapsed/mobile × 4 routes, active pill asserted per route | live-browser (Playwright MCP) | per-cell: navigate → assert `data-active` on `[data-sidebar="menu-button"]` → screenshot → artifacts/cell-{state}-{route}.png | ✅ target files exist (app-sidebar.tsx etc., READ-ONLY) |
| QLTY-03 | Interaction micro-tests: collapse/expand (button + ⌘B), drag-resize clamp, rail tooltips incl `Reviews (N)`, badge/dot gating | live-browser | `browser_click` header button; `browser_press_key("Meta+b")`; `browser_drag` handle → width clamp + `sidebar_width` cookie; hover rail icons → tooltip text; fixture for badge | ✅ same targets |
| QLTY-03 | Contrast audit — 6 pairs live (D-04/D-05) | live-browser + optional unit | `browser_evaluate` computed-style sampling (Pattern 2); optional `npx vitest run src/lib/contrast.test.ts --bail=1` | ✅ globals.css token block |
| QLTY-03 | Exa divergence review (D-06/D-07) | live-browser + documented fallback | navigate dashboard.exa.ai → element-wise compare → divergence list; fallback FEATURES.md | ✅ FEATURES.md exists |
| QLTY-03 | Hard-constraint regression: routes, resize+cookies, ⌘B, badge gating (SC #4) | live + grep/fence/build | live rows above + `git diff <base> HEAD -- <11 frozen files>` = empty; `grep -rnE 'indigo\|amber\|#[0-9a-fA-F]{3,8}\|\bdark:' src/components/layout/` = 0; `npx tsc --noEmit`; `npm test`; `npm run build` | ✅ all exist (Phase 13 verified clean) |

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit` + the task's targeted gates (grep/fence or the live cell batch just run)
- **Per wave merge:** `npm test` (full suite) + fence gates (`git diff <base> HEAD -- <frozen files>` = empty) + sweep gate
- **Phase gate:** full suite green + build green + sweep-clean + fence-clean + all 12 cells recorded in 14-UAT.md + all artifacts committed before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `artifacts/` directory creation under the phase dir (Wave 0 — screenshots need it before any cell runs)
- [ ] Clerk dev test-user credential resolution (checkpoint:human-verify or operator-provided session)
- [ ] Pending-proposal fixture decision (seed script + cleanup, or two-branch assertion)
- [ ] `src/lib/contrast.ts` + `src/lib/contrast.test.ts` — ONLY if the pure helper is extracted (Open Question 3; framework already configured, zero infra gaps otherwise)

*(If the helper is NOT extracted: "None — existing test infrastructure covers the phase; the live-browser layer is the primary validation.")*

## Security Domain

> `security_enforcement` is `true` (ASVS L1, `security_block_on: high`) in `.planning/config.json`.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | partial (driver, not app change) | The driver authenticates through the REAL Clerk flow (`requireStaffAccess()` → `/sign-in`) — it does not bypass auth; credentials never committed, never printed in artifacts (08-06-UAT safety-gate precedent: SHA-256 prefix check + no secret values in output) |
| V3 Session Management | no (app-side) | Session model untouched; the matrix OBSERVES `sidebar_state`/`sidebar_width` cookies being written by the shipped code — it does not write them itself except through real interactions |
| V4 Access Control | no | The sidebar only renders behind `requireStaffAccess()`; the matrix proves each of the 4 routes gate correctly (an unauthenticated navigation must redirect to `/sign-in` — a live negative check worth including) |
| V5 Input Validation | no (no new input) | No new input surfaces; the audit reads computed styles, the driver types only the dev sign-in credentials into Clerk's own form |
| V6 Cryptography | no | No crypto surface; the WCAG math is arithmetic, not crypto |

### Known Threat Patterns for {stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Credential leakage in UAT evidence | Information Disclosure | Follow the 08-06-UAT safety-gate precedent: never print secret values in 14-UAT.md/14-VERIFICATION.md; screenshots of the authenticated app are fine (they show the app, not the credential form); dev credentials live only in the operator's Clerk dashboard / untracked `.env.local` |
| Fixture insert against the wrong database | Tampering | Verify the `DATABASE_URL` used for the badge fixture is the dev/QA instance (08-06-UAT precedent: SHA-256 prefix match against the approved QA connection before touching data); cleanup deletes the fixture row |
| Hotlinked/copied Exa assets in screenshots | Intellectual property / Spoofing | D-07 divergence list documents what is NOT copied; screenshots of OUR app never embed Exa assets (the shipped sidebar has none — lucide icons only); the Exa reference sampling is read-only observation |
| Auth-bypass regression introduced by the phase | Integrity | The phase changes no source; fence gates prove `src/proxy.ts`, layouts, and auth files byte-identical; the live negative check (unauthenticated → redirect to /sign-in) proves the gate still fires |

**Net assessment:** the phase adds no attack surface to the app (zero source changes). Its security-relevant behavior is *evidential*: proving the shipped auth-gated sidebar, cookie contracts, and data gating behave correctly in a live browser, with credentials and fixtures handled per the established safety-gate precedent.

## Sources

### Primary (HIGH confidence — verified this session)
- **W3C WCAG 2.2** (w3.org/TR/WCAG22, 2024-12-12 REC) — 1.4.3 Contrast (Minimum): text ≥4.5:1, large text ≥3:1; 1.4.11 Non-text Contrast: ≥3:1 — thresholds fetched verbatim from the spec this session
- **`playwright` skill** (loaded this session) — full `browser_*` tool surface via `skill_mcp` (`mcp_name="playwright"`); screenshot API (`browser_take_screenshot`: type png/jpeg, scale css/device, filename, fullPage)
- **Playwright MCP plugin registration** — `~/.claude/plugins/marketplaces/claude-plugins-official/external_plugins/playwright/.mcp.json` (`npx @playwright/mcp@latest`)
- **`.playwright-mcp/` session evidence** — page-2026-08-01T11-*.yml + console logs proving prior Playwright sessions drove localhost:3000 with Clerk dev keys (the Phase-5/Phase-13 pattern)
- **`src/components/ui/sidebar.tsx`** (702 lines, READ) — `data-active` on menu-button (511), `data-active:bg-sidebar-accent` (469), `SIDEBAR_KEYBOARD_SHORTCUT="b"` (32) + ⌘B handler (96-109), mobile `SheetContent data-mobile="true"` (181-197), `sidebar_state` cookie write (84-85), `data-state` on wrapper (210)
- **`src/components/layout/app-sidebar.tsx`** (259 lines, READ) — collapse button `aria-label="Collapse sidebar"` (87), `collapsible="icon"` (76), badge/dot gating (174-188), `text-sidebar-foreground/70` org label (110)
- **`src/components/layout/app-shell-layout.tsx`** (44 lines, READ) — cookie→`--sidebar-width` thread (18-22), `pendingCount` server fetch (27-32), provider containment (35-42)
- **`src/components/layout/sidebar-resize-handle.tsx`** (101 lines, READ) — 200-400 clamp, `sidebar_width` cookie, `role="separator"` handle (90), collapsed early-return (80)
- **`src/app/globals.css`** (152 lines, READ) — the 8-token scoped block (87-96) + companion rules (100-106)
- **`src/hooks/use-mobile.ts`** — `MOBILE_BREAKPOINT = 768`, `max-width: 767px` matchMedia
- **Auth flow** — `src/proxy.ts` clerkMiddleware, `src/lib/auth/requireStaffAccess.ts`, `src/app/sign-in/[[...sign-in]]/page.tsx`, `src/app/(dashboard)/layout.tsx` + companies/personas layouts (all → `AppShellLayout`)
- **Dev DB live query** — 0 pending `signal_proposal` rows (this session, via @neondatabase/serverless)
- **Contrast recomputation** — all 6 pairs + Exa trap independently recomputed via a node script this session (values match the 10-UI-SPEC claims exactly: 12.30 / 4.89 / 3.11 / 5.91 / 4.30 / 12.63; Exa trap 1.09)
- **`src/lib/nav.ts`** (`getActiveNavKey`), `src/lib/sidebar-collapse.ts` (`getNavTooltipLabel` — `Reviews (N)` copy), `src/lib/user.ts` — the pure-function contracts the matrix's assertions mirror
- **05-HUMAN-UAT.md** (git 89f50c25) — the v1.1 Phase-5 live-UAT precedent: 6/6 passed via Playwright at 1280x800 / 375x800, authenticated Clerk session, evidence under `.playwright-mcp/` + repo root
- **08-06-UAT.md** (git 89f50c25) — live-UAT format + fixture/safety-gate precedent (SHA-256 DB check, fixtures added, no secrets printed)
- **`.planning/config.json`** — `nyquist_validation: true`, `security_enforcement: true`, ASVS L1
- **`~/.claude/get-shit-done/templates/UAT.md`** — canonical UAT template (status/expected/result/summary/gaps) that 14-UAT.md follows

### Secondary (MEDIUM confidence)
- **`.planning/research/FEATURES.md`** (2026-08-01 live production CSS extraction) — the Exa reference values used as the documented fallback for D-06 if the live fetch is blocked
- **`.planning/phases/10-sidebar-token-foundation/10-UI-SPEC.md`** — the token contract + divergence table (the audit's ground truth for the 6 pairs and the deliberate divergences)
- **`.planning/phases/10-sidebar-token-foundation/10-RESEARCH.md`** — Pitfall 3 (Exa 1.05:1 trap) and Pitfall 7 (regression blindness → Phase-5 matrix mandate); §Validation Architecture
- **dashboard.exa.ai reachability probe** — HTTP 429 + `x-vercel-mitigated: challenge` for curl (this session) — the reason the live fetch must go through the Playwright browser

### Tertiary (LOW confidence — flagged for validation)
- Whether the real Playwright Chromium passes Exa's Vercel Security Checkpoint without interaction (A2) — runtime-verify during execution; fallback documented
- `browser_take_screenshot` filename confinement to the MCP output dir (A5) — mitigate by explicit artifacts path + post-copy if confined

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every tool (Playwright MCP, vitest, dev server, Clerk, neon) verified present/installed in this session; zero new packages by hard constraint
- Architecture: HIGH — every DOM hook, state transition, and route layout traced line-by-line in the actual files; all 6 contrast pairs recomputed and verified
- Pitfalls: HIGH — pitfalls 1-5 grounded in verified code paths and live probes (429 challenge, 0 pending proposals, gitignored output dir); Pitfall 4's Exa-fetch outcome is the single MEDIUM item with a documented fallback

**Research date:** 2026-08-01
**Valid until:** 2026-08-08 (7 days — the live Exa reference and the Clerk dev instance are external and can change; re-verify the 429 challenge and the dev-DB pending count if the phase starts later)
