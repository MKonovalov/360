---
phase: 17-settings-ui-list-source
reviewed: 2026-08-02T14:37:03Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - src/app/(dashboard)/settings/page.tsx
  - src/app/actions/settings.test.ts
  - src/app/actions/settings.ts
  - src/app/companies/page.tsx
  - src/app/personas/page.tsx
  - src/components/layout/app-sidebar.tsx
  - src/components/settings/model-settings-form.tsx
  - src/lib/models/catalog.test.ts
  - src/lib/models/catalog.ts
  - src/lib/nav.test.ts
  - src/lib/nav.ts
  - src/lib/sidebar-collapse.test.ts
  - src/lib/sidebar-collapse.ts
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 17: Code Review Report

**Reviewed:** 2026-08-02T14:37:03Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Reviewed the Phase 17 settings surface: the `/settings` server page, the `saveSettingsAction` Server Action, the `ModelSettingsForm` client form, the nav wiring (`nav.ts`, `sidebar-collapse.ts`, `app-sidebar.tsx`, companies/personas pages), and the `catalog.ts` servable-set logic plus their Vitest suites.

The security-critical path is implemented correctly. I verified against the full call chain (not just the diff):

- **No client-trusted identity**: `saveSettingsAction` destructures `userId` from `requireStaffAccess()` (session), never from input; the row is keyed by that session userId (`settings.ts:34`, `userModelSettings.ts:18-33`). No IDOR — reads and writes are scoped to the session user.
- **Unknown input is zod-validated** before any DB work, and every submitted id is checked against the server-computed allowlist ∩ snapshot (`settings.ts:36-44`); `catalog.json` (21k lines) stays server-side — `catalog.ts` is imported only by server modules, never a client component (verified by grep).
- **D-08/D-09 dedupe backstop** rejects primary∈fallbacks and repeated fallbacks even if the client gates are bypassed (`settings.ts:49-54`).
- **`action_failed` on internal throw** (`settings.ts:64-66`); `requireStaffAccess()` outside the try matches the `reviews.ts` precedent.
- The 2-fallback UI cap vs. runtime primary+1 resolution is an explicit, documented UI-SPEC decision ("expected, not an error") — not a defect.
- `getAllowlistedServableIds` correctly filters `providerID === 'anthropic' && status !== 'deprecated'` before intersecting the allowlist; the snapshot's anthropic entry for `claude-sonnet-4-6` exists with status `active` (catalog.json:1753), so the current servable set is `['claude-sonnet-4-6']` and the form's sonnet-only branch is the live path.
- Nav/sidebar pure functions are well-tested and correct (`/companies-archive`, `/settings-archive` sibling-prefix guards verified).

No critical (blocker) findings. Two warnings and three info items below.

## Warnings

### WR-01: Unhandled rejection in `handleSave` leaves the form stuck in `'saving'` with no error message

**File:** `src/components/settings/model-settings-form.tsx:65-81`

**Issue:** `handleSave` awaits `saveSettingsAction(...)` inside `startTransition(async () => {...})` with no `try/catch`. The action's internal `catch` only covers throws inside its own `try` block — `requireStaffAccess()` at `settings.ts:34` runs *before* the try, so a Clerk `auth()` failure (or a transport-level 500 before the action body runs) rejects the action promise. The rejection propagates to the client as an unhandled promise rejection; `isPending` flips back to `false` but `status` remains `'saving'` forever — no error message renders (`status === 'error'` is never set), and the user gets silent failure. This contradicts the phase's own contract comment ("return `action_failed` on any throw (never throw to client)") — that guarantee only holds for throws inside the action's try. Same pattern exists in `review-queue.tsx`, but the settings form's status machine has an explicit `'error'` state that is unreachable on this path.

**Fix:**
```tsx
startTransition(async () => {
  try {
    const result = await saveSettingsAction({
      primaryModel: primary,
      fallbacks: fallbacks.filter((id) => id !== ''),
    });
    if (result.ok) {
      setStatus('saved');
      setErrorMsg(null);
    } else {
      setStatus('error');
      setErrorMsg(ERROR_COPY[result.reason] ?? ERROR_COPY.action_failed);
    }
  } catch {
    setStatus('error');
    setErrorMsg(ERROR_COPY.action_failed);
  }
});
```

### WR-02: Stale "Saved." confirmation persists after the draft is edited post-save

**File:** `src/components/settings/model-settings-form.tsx:306-310` (with the edit handlers at 141, 219-225, 84-100)

**Issue:** After a successful save, `status` is set to `'saved'` and "Saved." renders beside the button. None of the edit handlers (`onValueChange` on the primary select, fallback select, `moveFallback`, `removeFallback`, `addFallback`) reset `status`. A user who saves, then changes any picker, still sees "Saved." — implying the new draft is persisted when it is not. The draft is only re-persisted on the next Save click.

**Fix:** Reset `status` to `'idle'` in every edit handler (or in `setPrimary`/`setFallbacks` wrappers):
```tsx
function markDirty() {
  setStatus('idle');
  setErrorMsg(null);
}
// call markDirty() from onValueChange={setPrimary}, the fallback
// onValueChange, moveFallback, removeFallback, and addFallback
```

## Info

### IN-01: `settings.test.ts` happy-path asserts a production-impossible fallback

**File:** `src/app/actions/settings.test.ts:26, 30-49`

**Issue:** `getAllowlistedServableIds` is mocked to return `['claude-sonnet-4-6', 'claude-haiku-4-5']`, and the flagship "saves a valid chain" test submits `claude-haiku-4-5` as the fallback. The real catalog (verified: catalog.json:1753 is the only anthropic sonnet entry; undated haiku-4-5 is absent per the D-01 re-verify) yields `['claude-sonnet-4-6']` — so the tested happy path (primary + fallback) cannot occur in production today, and the actual production happy path (sonnet-only, empty fallbacks) is never exercised. If a snapshot refresh ever drops the anthropic sonnet entry, `getAllowlistedServableIds` would return `[]` and every real save would fail with `invalid_model`, but this suite would still pass because the mock hardcodes the list.

**Fix:** Add one test that pins the action against the real catalog shape (e.g. mock `getAllowlistedServableIds` to return `['claude-sonnet-4-6']` and assert a sonnet-only save succeeds with `fallbacks: []`), keeping the haiku case only as a multi-servable regression test.

### IN-02: "Catalog synced" date renders in the viewer's local timezone

**File:** `src/components/settings/model-settings-form.tsx:318`

**Issue:** `dateFormatter.format(new Date(catalogGeneratedAt))` renders `generatedAt` (`2026-08-02T09:33:54.568Z`, UTC) in the staff member's local timezone. For negative-offset zones (e.g. UTC-10) the date shifts a day back ("Catalog synced Aug 1"), diverging from the UI-SPEC-locked copy "Catalog synced Aug 2, 2026". Low impact, but the spec treats the footer copy as contract-locked.

**Fix:** Format in UTC to match the snapshot's canonical timestamp: `dateFormatter.format(new Date(catalogGeneratedAt + 'Z'))` is already UTC-correct on parse; use `Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ... })` if the day must never shift.

### IN-03: Empty draft fallback row has no matching `SelectItem` for its `''` value

**File:** `src/components/settings/model-settings-form.tsx:214-258` (row select with `value={fb}`, options at 234-248)

**Issue:** A freshly added fallback row stages `''`, which has no corresponding `SelectItem` in the options list (the filter at 234-237 operates on `servableIds`, and `''` is not servable). Radix Select renders the trigger with no selected content and logs a dev-mode "missing item" warning until a real value is picked. Functional impact is nil (the row is filtered before submit, `settings.ts` rejects `''` as `invalid_model` anyway), but it is avoidable noise during normal use.

**Fix:** Render a disabled placeholder `SelectItem` for the empty row (`<SelectItem value={''} disabled>Select a model…</SelectItem>` inside the content when `fb === ''`), or keep the row's select uncontrolled until a value is chosen.

---

_Reviewed: 2026-08-02T14:37:03Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
