---
phase: 17-settings-ui-list-source
plan: 02
subsystem: persistence
tags: [nextjs, server-actions, zod, vitest, settings, allowlist]

# Dependency graph
requires:
  - phase: 15-model-registry-foundation-persistence
    provides: upsertModelSettings atomic full-value upsert, ANTHROPIC_ALLOWLIST + getAllowlistedServableIds, catalog.json snapshot
  - phase: 09-reviews
    provides: Server Action controller pattern (gate-first, { ok } envelope, revalidatePath)
provides:
  - saveSettingsAction — the security boundary between arbitrary client input and the user_model_settings row (gate → zod → servable-set → dedupe → atomic upsert → revalidate; never throws)
  - Seven-case action security matrix locking the boundary (gate-first invocation order, invalid_model, duplicate_model, action_failed)
  - D-01 roster re-verify verdict for 2026-08-02: undated claude-haiku-4-5 STILL absent → allowlist stays sonnet-only (D-02)
  - Roster-check comment in catalog.ts updated to record the re-verify outcome; gate test description updated to the verdict
affects: [17-03, phase-18-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Server Action security boundary: requireStaffAccess() FIRST → zod safeParse(unknown) → server-computed servable set (allowlist ∩ snapshot) → dedupe backstop → atomic upsert keyed by session userId → revalidate on success only (reviews.ts controller pattern)
    - Session-only row key: the input schema declares no userId field; the upsert key comes exclusively from requireStaffAccess's destructured { userId }
    - Mock-free action testing via vi.hoisted registry (vi.mock next/cache, auth, queries, catalog) — zero live calls, invocation-order assertion pins gate-first

key-files:
  created:
    - src/app/actions/settings.ts
    - src/app/actions/settings.test.ts
  modified:
    - src/lib/models/catalog.ts
    - src/lib/models/catalog.test.ts

key-decisions:
  - "D-01 verdict 2026-08-02 (live GET /v1/models): claude-sonnet-4-6 present; undated claude-haiku-4-5 STILL ABSENT — only dated claude-haiku-4-5-20251001 exists and an exact-id match is required to count → ANTHROPIC_ALLOWLIST stays ['claude-sonnet-4-6'] (D-02 sonnet-only), no dated or invented IDs ever (Phase 15 D-02)"
  - "saveSettingsAction never returns stale_primary/stale_fallback — without reading the saved row it cannot distinguish a stale-but-once-saved id from any other unknown id; a dropped-from-roster id fails the servable-set check and surfaces as invalid_model (T-17-06). The client-side staleness gate (plan 17-03 Task 2) is the primary D-10/D-11 mechanism"
  - "The server-computed getAllowlistedServableIds(catalogJson) — allowlist ∩ committed snapshot — is the ONLY source of truth for submitted ids (SET-07, T-17-03); a client-supplied servable list is never consulted"
  - "D-08/D-09 dedupe backstop (primary∈fallbacks or repeated fallbacks → duplicate_model) enforced server-side even if client gates are bypassed — the DB can never hold a self-referencing or duplicate chain (T-17-04)"

patterns-established:
  - "Pattern: immutable action ordering for model-config writes — authz gate, then parse, then servable-set membership, then chain-integrity dedupe, then the atomic upsert; revalidate only on ok:true; catch maps every throw to action_failed"
  - "Pattern: D-01 standing roster maintenance — existence-only key check, live GET /v1/models id extraction (never prints the key), exact-id verdict, comment + gate-test update, verdict recorded in the SUMMARY for auditability"

requirements-completed: [SET-06, SET-07]

# Metrics
duration: 6min
completed: 2026-08-02
---

# Phase 17 Plan 02: Settings Persistence + Allowlist Roster Re-verify Summary

**The persistence half of the Settings surface: `saveSettingsAction` locks the immutable gate-first → zod → servable-set → dedupe → atomic-upsert ordering behind a seven-case security matrix (zero live calls, all external deps mocked), and the 2026-08-02 D-01 live-roster re-verify confirms the undated `claude-haiku-4-5` is still absent — so `ANTHROPIC_ALLOWLIST` stays sonnet-only (D-02), the content both the pickers and the action validate against.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-08-02T14:11:20Z
- **Completed:** 2026-08-02T14:17:15Z
- **Tasks:** 3
- **Files modified:** 4

## D-01 Roster Re-verify Verdict (2026-08-02)

Executed live per the standing D-02 maintenance procedure (15-02 precedent):

1. **Key existence check** — `grep -c '^ANTHROPIC_API_KEY=' .env.local` → `1` (existence only; the value was read into a shell variable for the curl header and never echoed, printed, or committed — T-17-05).
2. **Live roster** — `GET https://api.anthropic.com/v1/models` (2026-08-02) returned ids: `claude-sonnet-4-6` (**PRESENT** — the REQUIRED REG-05 no-settings default), `claude-fable-5`, `claude-haiku-4-5-20251001`, `claude-opus-4-1-20250805`, `claude-opus-4-5-20251101`, `claude-opus-4-6/4-7/4-8`, `claude-opus-5`, `claude-sonnet-4-5-20250929`, `claude-sonnet-5`.
3. **Verdict for the allowlist** — the **undated** `claude-haiku-4-5` is **ABSENT**; only the dated `claude-haiku-4-5-20251001` form exists, and the undated form must be an *exact* id match to count (17-CONTEXT.md D-01). D-01 fails → D-02 applies.
4. **Allowlist content that ships:** `['claude-sonnet-4-6']` — unchanged. No dated or invented id added (Phase 15 D-02 no-invented/dated-IDs rule).

`src/lib/models/catalog.ts` roster-check comment (lines 6-12) now records the 2026-08-02 re-verify date, the verified outcome, and the standing "adding a model = code change + deploy + roster re-verify" rule. The catalog gate test description reflects the verdict; the `every(!/-20\d{6}/)` no-dated-IDs assertion still passes, and the decoupled-fixture `getAllowlistedServableIds` expectation is unaffected (fixture has no undated anthropic haiku entry).

## Accomplishments

- **`saveSettingsAction(input: unknown): Promise<SettingsActionResult>`** (`src/app/actions/settings.ts`) implements the locked ordering: `const { userId } = await requireStaffAccess()` FIRST (schema has no userId field — the row key can never come from client input, T-17-02) → zod `safeParse` of the unknown input (`primaryModel: z.string()`, `fallbacks: z.array(z.string()).max(2)` — the `fallbacks`→`fallbackModels` map happens at the upsert call) → every submitted id checked against `getAllowlistedServableIds(catalogJson)` (allowlist ∩ committed snapshot, the only source of truth, SET-07/T-17-03) → D-08/D-09 dedupe backstop (`duplicate_model`) → `upsertModelSettings` atomic full-value upsert keyed by the session userId (Pitfall 9, no read-modify-write) → `revalidatePath('/settings')` + `{ ok: true }` on success only; every throw maps to `{ ok: false, reason: 'action_failed' }` — never thrown to the client.
- **Seven-case security matrix** (`src/app/actions/settings.test.ts`): valid save (with the invocation-call-order assertion pinning gate-first and the exact `{ userId: 'user_123', primaryModel, fallbackModels }` upsert args + `revalidatePath('/settings')`), malformed input → `invalid_model` (no write), >2 fallbacks → `invalid_model` (zod max(2), no write), non-servable id → `invalid_model` (no write), primary-in-fallbacks → `duplicate_model`, duplicate fallbacks → `duplicate_model`, upsert throw → `action_failed` (no revalidate). Zero live calls: `next/cache`, `requireStaffAccess`, `userModelSettings`, and `catalog` all mocked via the `vi.hoisted` registry; `catalog.json` is real committed data and resolves fine under Vitest.
- **No `stale_primary`/`stale_fallback` codes exist in the action** — the action returns `invalid_model` for any non-servable id (T-17-06); the client-side staleness gate (plan 17-03 Task 2) is the primary D-10/D-11 mechanism.
- Full-suite regression: **288 passed / 6 skipped / 0 failed** (30 test files); `npx tsc --noEmit` clean.
- Zero new packages, zero shadcn installs, zero install surface (T-17-SC).

## Task Commits

Each task was committed atomically:

1. **Task 1: D-01 roster re-verify — undated haiku-4-5 absent, allowlist stays sonnet-only** - `7bbc8d2c` (chore)
2. **Task 2: settings.test.ts — the saveSettingsAction security matrix** - `3cee25ef` (test, RED)
3. **Task 3: settings.ts — saveSettingsAction** - `879eabb4` (feat, GREEN)

## Files Created/Modified

- `src/app/actions/settings.ts` - `'use server'` controller; `saveSettingsAction` with the immutable gate → zod → servable-set → dedupe → atomic-upsert → revalidate ordering; `SettingsActionResult` envelope; header comment citing SET-06/SET-07, T-17-02..06, Pitfall 9, and the no-stale-codes contract
- `src/app/actions/settings.test.ts` - seven `it(...)` cases mirroring the reviews.test.ts scaffold (vi.hoisted registry, invocation-order assertion); the module-under-test absent at commit time (RED)
- `src/lib/models/catalog.ts` - roster-check comment (lines 6-12) updated to the 2026-08-02 re-verify verdict; `ANTHROPIC_ALLOWLIST` unchanged at `['claude-sonnet-4-6']`
- `src/lib/models/catalog.test.ts` - allowlist gate test description updated to the 2026-08-02 sonnet-only verdict; assertions unchanged and green

## Decisions Made

- D-01 verdict applied (sonnet-only ships); see the verdict section above for the full audit trail
- The action's `requireStaffAccess` destructures `{ userId }` — the upsert is keyed exclusively by the session value; the input schema declares no userId field
- No `stale_*` reason codes — documented in the header comment; a dropped-from-roster id returns `invalid_model` (matching 17-PATTERNS.md line 365), and the form's copy map has no `stale_*` entries (17-UI-SPEC reason-code table)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Missing `{ userId }` destructure from requireStaffAccess**
- **Found during:** Task 3 (GREEN) — the happy-path test returned `action_failed` instead of `{ ok: true }`
- **Issue:** The first draft wrote `await requireStaffAccess();` without destructuring, so the upsert call's `userId` was an undefined variable reference → `ReferenceError` → caught → `action_failed`. The plan's own step 5 (`upsertModelSettings({ userId, ... })`) requires the destructure; the test's exact-args assertion (`userId: 'user_123'`) pinned it.
- **Fix:** `const { userId } = await requireStaffAccess();` — the session-scoped destructure the acceptance criteria demand ("the upsert's userId comes only from the session").
- **Files modified:** `src/app/actions/settings.ts`
- **Commit:** `879eabb4`

Otherwise the plan executed exactly as written.

## Issues Encountered

None beyond the Rule 1 fix above (diagnosed via a temporary instrumented probe test, removed before commit — no artifact left behind).

## User Setup Required

None — the D-01 re-verify consumed the existing `ANTHROPIC_API_KEY` from `.env.local` (read-only, existence-checked, never printed or committed).

## Next Phase Readiness

- SET-06/SET-07 enforcement landed: immediate validated persistence via `saveSettingsAction` and the allowlist ∩ snapshot gate that keeps a 404-ing model out of the DB and out of the pickers
- Plan 17-03 (the Settings page + form) consumes: `saveSettingsAction` as the save path, `getAllowlistedServableIds(catalog)` as the picker source (sonnet-only until a future roster expansion), `getModelSettingsForUser(userId)` for the initial draft, and `catalog.generatedAt` for the D-04 footer
- The client-side staleness gate (17-03 Task 2) is the primary D-10/D-11 mechanism; the action's `invalid_model` return is the server-side backstop
- No blockers; threat register T-17-02..06 mitigations are in place and test-locked

---

*Phase: 17-settings-ui-list-source*
*Completed: 2026-08-02*

## Self-Check: PASSED

- [x] `src/app/actions/settings.ts` exists (grep-confirmed `'use server'`, `saveSettingsAction`, gate-first destructure)
- [x] `src/app/actions/settings.test.ts` exists with all 7 behaviors
- [x] `src/lib/models/catalog.ts` + `catalog.test.ts` modified with the 2026-08-02 verdict
- [x] Commits `7bbc8d2c`, `3cee25ef`, `879eabb4` present in git history
- [x] `npx vitest run` full suite: 288 passed / 6 skipped / 0 failed
- [x] `npx tsc --noEmit` exit 0

## Self-Check: PASSED (post-write verification)

All 5 files exist on disk and all 4 plan commits (`7bbc8d2c`, `3cee25ef`, `879eabb4`, `a0f47d86`) are present in git history — confirmed via `git log --oneline --all`.
