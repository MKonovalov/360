# Phase 9 — UI Review

**Audited:** 2026-08-01
**Baseline:** `09-UI-SPEC.md` (approved design contract, verified by gsd-ui-checker 6/6)
**Screenshots:** captured (sign-in page only — desktop 1440×900 + mobile 375×812 at `.planning/ui-reviews/09-20260801-124227/`). All phase surfaces (`/reviews`, Company detail panel, sidebar) are Clerk staff-gated behind a 307 → `/sign-in` redirect, so the audited components could not be captured without a session; the pillar audit is code-based (Tailwind class audit, string audit, state-machine review) for every phase surface.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | ~25 contract strings verbatim; one divergence — sidebar Reviews badge shows bare count, not the contract's "{N} pending" |
| 2. Visuals | 3/4 | Focal point + hierarchy correct; dead `[a]:hover:bg-amber-100` class shipped in `proposal-badge.tsx`; zombie card persists visually after a terminal Accept error |
| 3. Color | 4/4 | Accent discipline perfect (indigo-600 only on links + active nav); zero hardcoded colors; amber recipe copied verbatim; destructive token used for Reject |
| 4. Typography | 4/4 | Exactly 4 roles in use (12/14/18/24px), 2 weights (normal/semibold) — no drift from the declared scale |
| 5. Spacing | 3/4 | Two deviations from the declared scale: queue header→list gap is 16px (spec: 48px), inter-card gap is 12px (spec: 16px) |
| 6. Experience Design | 3/4 | Exemplary state coverage (6-state run strip, loading/error/empty/disabled everywhere) but a BLOCKER-class stuck state: terminal Accept errors leave a dead card with no retry/dismiss |

**Overall: 20/24**

---

## Top 3 Priority Fixes

1. **Zombie card on terminal Accept errors** (`review-queue.tsx:56-59`, `145-157`) — **BLOCKER**. When `acceptProposalAction` returns `already_resolved` or `duplicate_signal`, the card is set to `error` state, which swaps out the Accept/Reject buttons for an error line — but nothing removes the card, there is no retry affordance, and the code comment's premise ("the card is leaving the list regardless") is false: no `router.refresh()` and no `revalidatePath` (the action only revalidates on `ok: true`) mean the dead card persists until the user manually navigates away and back. In a team tool this is a real multi-reviewer scenario (two staff accept the same proposal). **Fix:** on a terminal error, call `router.refresh()` after a short delay (the proposal is no longer pending server-side so the re-fetched queue drops it), or filter the card out of local state, or keep the buttons visible with the error rendered as an inline banner above them.

2. **Reviews page header→list spacing** (`reviews/page.tsx:36`) — **WARNING**. `flex flex-col gap-4 p-8` puts 16px between the "Review Proposals" Display heading and the proposal list; UI-SPEC Spacing Scale declares **2xl (48px)** for "between queue page header and proposal list". The container matches the established `/companies` page pattern (`companies/page.tsx:26` uses the same `gap-4`), so this is a spec-vs-house-pattern tension, but the declared scale is the audit baseline. **Fix:** `gap-12` on the page container (or `mt-12` on the queue) to honor the 48px break — and reconcile the spec's Spacing table with §4's "match /companies p-8 container" instruction so the two stop contradicting each other.

3. **Sidebar badge copy** (`app-sidebar.tsx:75-77`) — **WARNING**. The Copywriting Contract declares the sidebar badge as the same **"{N} pending"** amber badge as the detail-panel one; the implementation renders only the bare count (`{pendingCount}`). The spec contradicts itself here (§4 says "Trailing `SidebarMenuBadge` … with the global pending count"), and a bare number is the standard shadcn badge convention, but the copy table is explicit. **Fix:** either widen the badge and render `{pendingCount} pending` (matching the contract), or amend the Copywriting Contract to document number-only — pick one so the contract and UI agree before the next phase inherits it.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

Verified **verbatim** against the Copywriting Contract — 25+ strings:

- Analyze menu: "Analyze" / "Analyze — Agent not configured" (`enrichment-review-dialog.tsx:197`)
- Running: "Analyzing {company}…" + "This can take up to a minute." (`analyze-run-status.tsx:113,117`)
- Success: "Analysis complete" + "Review {N} proposals" with pluralization (`analyze-run-status.tsx:126-129`)
- Already covered: "No new proposals — {company}'s signal types are already covered." (`analyze-run-status.tsx:137`)
- Failure: "Analysis failed" + "{reason}. Try again." (`analyze-run-status.tsx:144-146`)
- Badge: "{N} pending" (`proposal-badge.tsx:15`)
- Page title "Review Proposals" (`reviews/page.tsx:37`); empty heading "No proposals to review" + body "Run Menu → Analyze on a Company detail page to generate signal proposals." (`review-queue.tsx:67-69`); load error "Couldn't load proposals" + "Something went wrong fetching this data. Try refreshing the page." (`reviews/page.tsx:26-29`)
- Accept "Accept" / confirmation "Accepted — {Signal Type} signal created for {company}." (`review-queue.tsx:138,147`); Reject "Reject" / "Rejected — reason recorded." (`review-queue.tsx:103,151`)
- Dialog: title "Why are you rejecting this proposal?", description "Your reason helps improve future analysis.", all 4 reason labels verbatim incl. the em-dash "Hallucinated — no real evidence", note placeholders "Add a note (optional)" / "Describe the issue…", confirm "Reject proposal", cancel "Cancel" (`reject-dialog.tsx:32-35,108-110,131,140,144`)
- "View trace" link (`review-queue.tsx:166`); error-copy tables for accept/reject/run states all use specific, staff-facing wording — no generic "Something went wrong"

**Finding (WARNING):** Sidebar Reviews badge shows bare `{pendingCount}` instead of the contract's "{N} pending" (`app-sidebar.tsx:75-77`). Only copy deviation found. "Cancel"/"OK"-style greps came back clean except the contract-specified dialog Cancel buttons.

### Pillar 2: Visuals (3/4)

- **Focal point correct per contract:** on `/reviews` the proposal-card list with inline evidence is the anchor (nothing behind a click except the two review actions — `review-queue.tsx:80-171`); on the Company panel, Analyze is a quiet utility in the ghost-button menu group (`company-detail.tsx:67-77`) and the run strip is a slim dismissible-by-refresh notice, not a modal (`analyze-run-status.tsx`).
- Card structure matches §4 top-to-bottom: header row (company link + date) → SignalBadge + strength + R/C → evidence block (`space-y-1`, truncate link, snippet, reasoning) → footer (`border-t border-slate-100 pt-3`, actions left, trace right). Evidence URL uses `truncate` + `target="_blank" rel="noopener noreferrer"` per contract (`review-queue.tsx:110-118`).
- Icon-only buttons all carry aria-labels: menu trigger "Menu" (`enrichment-review-dialog.tsx:185`), "Toggle Sidebar", "Resize sidebar". `ExternalLinkIcon` sits inside a text link; `Loader2Icon` is decorative beside text — no unlabeled icons.
- Visual hierarchy via size/weight/color: Display 24/600 title, Body links indigo, Label meta slate-500, amber badge, SignalBadge anchor — consistent with the app's established row grammar.

**Finding (WARNING):** `proposal-badge.tsx:14` ships `[a]:hover:bg-amber-100` — a dead arbitrary-variant class (matches element-with-attribute-`a`, never fires on the Badge's span). Copied verbatim from `signal-badge.tsx:18`, so it is inherited rather than phase-introduced, but the new component propagates a no-op. Remove it from the new file.
**Finding (WARNING):** The zombie card (Pillar 6) is also a visual defect — a card left in the list showing only red error text with its action row collapsed.

### Pillar 3: Color (4/4)

- **Accent discipline verified:** indigo-600 appears only on inline text links (company link `review-queue.tsx:88`, evidence URL `:115`, "Review {N} proposals" `analyze-run-status.tsx:127`, "View trace" `:164`) and the sidebar active-nav highlight (`app-sidebar.tsx:40,49,58,67`). Never on: the Analyze menu item, run-status strip (slate-500/900), badges, or strength/R/C text (slate-500). Exactly the contract's reserved-accent list.
- **No hardcoded colors:** grep for `#[0-9a-fA-F]` / `rgb(` across `src/components` returned zero matches — all color via Tailwind tokens, matching the contract's "never hand-rolled red" rule.
- **Amber recipe verbatim:** `proposal-badge.tsx:14` and `app-sidebar.tsx:75` use the exact `bg-amber-100 text-amber-800` recipe from `signal-badge.tsx:18` — the "needs attention" semantic, no new hue.
- **Destructive token:** Reject confirm is `Button variant="destructive"` (`reject-dialog.tsx:143`) — not a hand-rolled red; error *message* text uses `text-red-600` per the established error-copy pattern (`reject-dialog.tsx:134`, `review-queue.tsx:154`, `analyze-run-status.tsx:145`).
- 60/30/10 distribution holds: white/slate-50 dominant, slate-100/200 borders + slate-100 card dividers (`review-queue.tsx:129`), indigo-600 the only ~10% accent.

### Pillar 4: Typography (4/4)

- Exactly the four declared roles in phase files: 12px Label (`text-[12px]`, 5 uses), 14px Body (`text-[14px]`, 15 uses + `text-sm` in the three error/empty card bodies which resolve to 14px), 18px Heading (`text-[18px]`, 2 uses), 24px Display (`text-[24px]`, the "Review Proposals" h1 and company name h1). Weights: `font-normal` + `font-semibold` only (the sidebar badge's `font-medium` is shadcn's own vendored default, not new vocabulary).
- No third weight, no fifth size introduced — matches "No third weight, no fifth size" contract line.
- Contract roles mapped correctly: card company name Body/400 indigo, strength + R/C Label/400 slate-500 (`review-queue.tsx:100-104`), run-strip success/failure headlines 14/600 slate-900 (`analyze-run-status.tsx:126,144`), failure reason 14/400 red-600 (`:145`).

### Pillar 5: Spacing (3/4)

- **Correct per scale:** card `p-4` (16px md) + `space-y-3` internal stack (`review-queue.tsx:82`), evidence block `space-y-1` (xs), footer `pt-3` (sm) + `border-t`, queue list `space-y-3`, run-strip icon-to-text `gap-2` (xs→sm), page container `p-8` (xl), run strip mounted inside the panel's `space-y-12` (2xl) between header and Firmographics (`company-detail.tsx:65,88`), empty/error cards `min-h-48` (192px) — all contract values.
- **Finding (WARNING):** Header→list gap on `/reviews` is `gap-4` (16px) vs the declared **2xl (48px)** for "between queue page header and proposal list" (`reviews/page.tsx:36`). Mitigating: identical to the `/companies` page container (`companies/page.tsx:26`), which the spec's §4 "Route & shell" row says to match — the spec's Spacing table and §4 contradict each other; the implementation followed §4. See Priority Fix 2.
- **Finding (minor):** Inter-card gap is `space-y-3` (12px) vs the scale's md (16px) for "queue list item gaps". 4px under spec; consistent within the queue so it reads uniform, but off the declared token.

### Pillar 6: Experience Design (3/4)

- **Loading:** run strip running state with `Loader2Icon animate-spin` + explicit wait copy (`analyze-run-status.tsx:107-121`); "Accepting…" / "Rejecting…" button states via `useTransition` (`review-queue.tsx:138`, `reject-dialog.tsx:144`).
- **Error:** fail-loud everywhere — run strip maps all four Route Handler error domains to distinct copy (`analyze-run-status.tsx:29-38`), reject dialog has its own error table + inline error (`reject-dialog.tsx:40-50,134`), queue card error copy table (`review-queue.tsx:34-39`), page-level load error card (`reviews/page.tsx:22-33`).
- **Empty:** queue empty state with instruction copy (`review-queue.tsx:64-73`); "successNoNew" run state states *why* (D-11) instead of silently succeeding.
- **Disabled/gating:** reject confirm disabled until reason AND (≠Other OR note) (`reject-dialog.tsx:67-68,143`); accept disabled while in flight; Analyze/Enrich menu items disabled with reason labels; sidebar badge degrades to hidden on fetch failure (`app-shell-layout.tsx:27-32`).
- **Destructive confirmation:** the correction dialog *is* the guard — no extra confirm, per OBSV-02.
- **Idle chrome:** run strip renders `null` when idle — no empty chrome on a panel that never ran Analyze (`analyze-run-status.tsx:105`).
- **Generation guard** on rapid double-analyze (`analyze-run-status.tsx:56,70-74`) and auto `router.refresh()` on success to re-sync badges — thoughtful interaction details.

**Finding (BLOCKER):** Zombie card on terminal Accept errors — see Priority Fix 1. `acceptProposalAction` revalidates only on `ok: true` (`reviews.ts:25-28`), the client never re-fetches on the error path, and the error state removes the only actions; the card is dead with no retry, dismiss, or auto-removal. This is a task-completion break for the second reviewer in a concurrent-review scenario.

---

## Registry Safety

`components.json` present (`style: radix-nova`, `baseColor: neutral`, `cssVariables: true`, `iconLibrary: lucide`, `menuAccent: subtle`, `registries: {}`). UI-SPEC Registry Safety table declares **zero third-party blocks** (shadcn official only, all pre-installed primitives reused — Dialog/Select/Input/Badge/Button/SidebarMenuBadge, no new `src/components/ui/*` files). Registry audit: 0 third-party blocks checked, no flags. No shadcn `view`/`diff` checks applicable.

---

## Files Audited

- `src/app/(dashboard)/reviews/page.tsx` — queue page, header, error card
- `src/components/reviews/review-queue.tsx` — proposal cards, accept/reject state machine, empty state
- `src/components/reviews/reject-dialog.tsx` — correction-reason capture dialog
- `src/components/companies/proposal-badge.tsx` — amber pending badge
- `src/components/agents/analyze-run-status.tsx` — run feedback strip (6 states)
- `src/components/enrichment/enrichment-review-dialog.tsx` — live Analyze menu item + CustomEvent bridge
- `src/components/companies/company-detail.tsx` — strip mount, badge mount, canAnalyze gate
- `src/components/layout/app-sidebar.tsx` — Reviews nav item + badge
- `src/components/layout/app-shell-layout.tsx` — global pending count fetch
- `src/app/actions/reviews.ts` — accept/reject server actions (revalidation behavior)
- `src/app/(dashboard)/layout.tsx`, `src/app/companies/page.tsx`, `src/components/personas/persona-detail.tsx` (call sites), `src/components/ui/sidebar.tsx` (SidebarMenuBadge defaults), `src/components/companies/signal-badge.tsx` (amber recipe reference), `components.json`

---

## Finding Summary

- **BLOCKER:** 1 (zombie card on terminal Accept error — `review-queue.tsx`)
- **WARNING:** 4 (sidebar badge copy; queue header→list 48px spacing; dead `[a]:hover` class; card gap 12px vs 16px)
- **Priority fixes:** 3 · **Minor recommendations:** 2

---

## Resolutions

Resolved 2026-08-01 in `fix(ui): resolve UI audit priority findings`.

- **P1 zombie card — RESOLVED** (`src/components/reviews/review-queue.tsx`). `CardState.error` gained a `retryable` flag: transient `action_failed` renders a **Try again** button (re-invokes `handleAccept`); terminal reasons (`already_resolved` / `duplicate_signal` / `not_found`) render a **Dismiss** button calling `router.refresh()` — the Server Action only revalidates on `ok:true`, and `acceptProposal` marks the row non-pending *before* the signal insert, so the refresh drops the card. No dead card remains.
- **P2 header→list spacing — RESOLVED** (`src/app/(dashboard)/reviews/page.tsx:36`). `gap-4` → `gap-12` (48px) honoring the Spacing Scale 2xl break; `09-UI-SPEC.md` §4 "Route & shell" amended to state the container matches `/companies`/`/personas` for *padding only* while the header→list gap is 2xl — the internal contradiction is gone.
- **P3 sidebar badge copy — RESOLVED** (`src/components/layout/app-sidebar.tsx:75-77`). Renders `{pendingCount} pending` per the Copywriting Contract; `09-UI-SPEC.md` §4 "Sidebar nav item" amended to the same "{N} pending" wording — the self-contradiction is gone.
- **Minors (deferred, documented):** dead `[a]:hover:bg-amber-100` in `proposal-badge.tsx`; inter-card gap 12px vs spec 16px (`space-y-3` on the queue container). Both inherited style choices, no functional impact; scheduled for a future polish pass.
