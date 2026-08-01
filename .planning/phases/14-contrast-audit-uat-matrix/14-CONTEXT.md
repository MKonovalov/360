# Phase 14: Contrast Audit & UAT Matrix - Context

**Gathered:** 2026-08-01
**Status:** Ready for planning

<domain>
## Phase Boundary

The shipped sidebar (Phases 10-13) is proven — a live-browser UAT matrix replicating the v1.1 Phase-5 pattern (expanded / collapsed / mobile × the 4 routes × active/inactive state pairs, with screenshots), a WCAG AA contrast audit of the shipped token set, and a divergence review against the dashboard.exa.ai reference — with zero regressions to routes, resize, ⌘B, or badge gating. Delivers QLTY-03. This phase BUILDS NO NEW UI — it verifies and documents what Phases 10-13 shipped. No production source changes are expected (any defect found is fixed minimally within the phase, but the primary output is evidence).

</domain>

<decisions>
## Implementation Decisions

### UAT matrix method & scope
- **D-01:** The live-browser UAT matrix is **Playwright-automated** (I drive the live app via the Playwright MCP skill: dev server + Clerk sign-in flow, capture screenshots, assert states). Not a user-run checklist, not hybrid.
- **D-02:** Full 12-cell cross-product automated — 3 viewport states (expanded / collapsed / mobile) × 4 routes (/, /companies, /personas, /reviews) — with active/inactive asserted per route (the route's nav row shows the gray active pill; the other three are inactive). PLUS targeted interaction micro-tests: collapse/expand via the header button and ⌘B, drag-resize clamp (200-400px), rail tooltips (incl. `Reviews (N)` count), and the pendingCount badge/dot gating.
- **D-03:** Screenshots land in `.planning/phases/14-contrast-audit-uat-matrix/artifacts/` with a `cell-{state}-{route}.png` naming convention, referenced from 14-UAT.md. Evidence persists in-repo for the milestone audit.

### Contrast audit method
- **D-04:** The WCAG AA audit is a **live computed-style audit** — in the browser, sample the rendered computed styles for each token pair and assert each contrast ratio ≥ its AA threshold. Not a static token-math table (that only proves declared values).
- **D-05:** Audit **all 6 shipped token pairs**: text-on-panel (≥4.5:1), `/70` label opacity (≥4.5:1), active pill fill `#909090` vs accent-foreground `#111111` (≥3:1), focus ring `ring-sidebar-ring` (≥3:1), badge chip (≥3:1 fill), letter-mark `#333333` vs white (≥4.5:1). All are the pairs Phases 10-13 claimed AA — verify each live.

### Exa divergence review
- **D-06:** Reference evidence comes from a **live fetch of dashboard.exa.ai** during the phase (sample actual rendered styles: panel color, hairline border, active treatment, badge font). Not the Phase 10 research snapshot (that's a dated reference).
- **D-07:** The review is **element-wise pass/fail** per matched element (near-white panel, hairline border, gray active treatment, mono badge) against the live reference, PLUS a documented **deliberate-divergences list** — the items/assets we do NOT copy (Exa's own nav items, hotlinked assets, the ~1.05:1 contrast trap) each with a rationale. Matches roadmap SC #3.

### Artifacts & completion bar
- **D-08:** Phase 14 produces **`14-UAT.md`** (the 12-cell matrix + interaction checks with screenshot references, marked complete), **`14-VERIFICATION.md`** (contrast audit + Exa review + hard-constraint regression evidence), and **`14-SUMMARY.md`**. No production source changes unless a defect is found and fixed minimally.
- **D-09:** The 8 deferred v1.1 verification/uat gap items (01-04 VERIFICATION human_needed + partial HUMAN-UATs) are **OUT of Phase 14 scope** — they stay open and are handled at the v1.2 milestone close (complete-milestone audit), matching how STATE.md records them.

### Claude's Discretion
- Exact Playwright script structure / helper layout for driving the matrix (e.g. per-cell script vs. one parametrized run)
- Which screenshot dimensions / device emulation to use for the mobile cells
- How the auth flow (dev Clerk sign-in) is scripted (existing Clerk test user / email-password flow)
- Whether any defect found triggers a minimal fix commit inside the phase or a follow-up note (fix minimally, keep the diff scoped)

</decisions>

<specifics>
## Specific Ideas

- "The matrix should replicate the v1.1 Phase-5 pattern — expanded/collapsed/mobile × routes × active/inactive with screenshots"
- "Exa's own ~1.05:1 active pill fails WCAG 1.4.11 — we deliberately diverge there; the audit must prove our ≥3:1"
- "Don't copy Exa's nav items or hotlink its assets — the divergence list documents what we intentionally don't take"
- "Evidence lives in-repo so the milestone audit can verify it"

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The shipped contract being verified (READ-ONLY reference — Phases 10-13 outputs)
- `.planning/phases/10-sidebar-token-foundation/10-UI-SPEC.md` — the token contract (8 `--sidebar-*` tokens, AA ratios, D1-D4), the Interaction & State Contract, the Copywriting Contract (`Reviews ({n})` tooltip), §Color (60/30/10, indigo-600 reservations)
- `.planning/phases/10-sidebar-token-foundation/10-RESEARCH.md` — Common Pitfalls (Pitfall 3: Exa's 1.05:1 contrast trap; Pitfall 7: regression blindness → the Phase-5 UAT matrix mandate), §Validation Architecture
- `.planning/phases/11-nav-items-restyle/11-01-SUMMARY.md` — the committed nav restyle (Exa anatomy, gray active, mono badge) the matrix verifies
- `.planning/phases/12-branding-user-zones/12-01-SUMMARY.md` + `12-UI-SPEC.md` — the branding/user zones + avatar + feedback pill the matrix verifies
- `.planning/phases/13-collapse-resize-coexistence/13-01-SUMMARY.md` + `13-CONTEXT.md` (D-01..D-12) — the collapse button, letter-mark, rail tooltips, resize-hide the matrix verifies; the D-09 ~200ms tooltip delay and D-07/D-08 tooltip scope/copy
- `.planning/phases/13-collapse-resize-coexistence/13-VALIDATION.md` — the "Manual-Only Verifications" table (live-browser items Phases 11-13 deferred here)

### The v1.1 Phase-5 UAT matrix precedent
- `.planning/milestones/v1.1-ROADMAP.md` / archived v1.1 phase docs — the Phase-5 live-browser UAT pattern this phase replicates (expanded/collapsed/mobile × routes × state pairs, screenshots)
- `.planning/milestones/v1.0-phases/0X-*/0X-HUMAN-UAT.md` — the archived HUMAN-UAT format precedent (expected/observed per test)
- `~/.claude/get-shit-done/templates/UAT.md` — the canonical UAT.md template (status/expected/awaiting structure)

### Exa reference (the divergence target)
- `.planning/research/FEATURES.md` — the Exa sidebar anatomy captured at research time (top row, nav rows, bottom zone, badge) — baseline for the live re-fetch
- `https://dashboard.exa.ai` — the LIVE reference sampled during the phase (D-06)

### Frozen regression surface (must stay byte-identical — the matrix proves it)
- `src/components/ui/sidebar.tsx`, `tooltip.tsx`, `dropdown-menu.tsx`, `button.tsx` (vendored)
- `src/components/layout/app-shell-layout.tsx`, `sidebar-resize-handle.tsx` (drag-resize contract), `app-sidebar.tsx` (the shipped sidebar)
- `src/app/globals.css` (token block)
- `package.json` / `package-lock.json`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Playwright MCP** (`.playwright-mcp/` dir + the `playwright` builtin skill) — the browser automation surface for the matrix; screenshots + state assertions
- `.planning/phases/13-collapse-resize-coexistence/13-VALIDATION.md` Manual-Only table — the exact live-browser behaviors Phases 11-13 deferred to this phase (collapse animation, tooltips, avatar, mobile sheet, rail anatomy) — the matrix's interaction checklist
- The shipped sidebar (`src/components/layout/app-sidebar.tsx` + `sidebar-resize-handle.tsx`) — the object under test; the dev server (`npm run dev`) + existing Clerk auth (`src/proxy.ts` clerkMiddleware, `(dashboard)/layout.tsx` requireStaffAccess gate, `src/app/sign-in` route) — the auth flow the Playwright driver must pass
- The v1.0 HUMAN-UAT.md files (`.planning/milestones/v1.0-phases/`) — the expected/observed doc format the 14-UAT.md should mirror

### Established Patterns
- Grep-gate + Vitest + build-gate verification (Phases 10-13) — Phase 14 adds LIVE-BROWSER verification on top, using Playwright MCP as the browser driver
- `14-UAT.md` uses the canonical UAT template (status: testing → complete; per-test expected/awaiting)
- Artifact naming: `{phase}-UAT.md`, `{phase}-VERIFICATION.md`, `{phase}-SUMMARY.md` in the phase dir; screenshots under `artifacts/`
- Zero new npm packages; vendored files + frozen regression surface stay byte-identical

### Integration Points
- The dev server must run (`npm run dev`) for the Playwright driver; Clerk sign-in is the entry gate (dev credentials or the Clerk dev instance)
- Screenshots → `.planning/phases/14-contrast-audit-uat-matrix/artifacts/cell-{state}-{route}.png`
- 14-VERIFICATION.md records the contrast audit (computed-style ratios per pair) + Exa divergence review (element-wise + divergence list) + hard-constraint regression evidence

</code_context>

<deferred>
## Deferred Ideas

- The 8 deferred v1.1 verification/uat gap items (01-04 VERIFICATION human_needed, partial HUMAN-UATs) — v1.2 milestone close scope (D-09)
- Any new UI polish the audit surfaces — follow-up phase or backlog, not Phase 14
- Persona-side Arcpedia "Related Knowledge" seed-data gap (deferred from v1.1) — milestone close

</deferred>

---

*Phase: 14-contrast-audit-uat-matrix*
*Context gathered: 2026-08-01*
