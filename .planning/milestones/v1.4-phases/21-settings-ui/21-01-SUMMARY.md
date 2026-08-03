---
phase: 21-settings-ui
plan: 01
subsystem: ui
tags: [shadcn, cmdk, radix-ui, command, popover, combobox, vendoring, sett6]

# Dependency graph
requires:
  - phase: 21-settings-ui
    provides: D-21-05 locked cmdk-based Command decision, D-21-06 Select-stays-for-provider-selector, UI-SPEC §Vendoring contract (byte-close to official registry)
provides:
  - Vendored shadcn Command primitive (cmdk wrapper): Command/CommandInput/CommandList/CommandGroup/CommandItem/CommandEmpty/CommandSeparator/CommandShortcut/CommandDialog
  - Vendored shadcn Popover (radix-ui) with PopoverTrigger/PopoverContent/PopoverAnchor/PopoverHeader/PopoverTitle/PopoverDescription
  - Auto-registry-dependencies input-group.tsx (InputGroup/InputGroupAddon/InputGroupButton/InputGroupText/InputGroupInput/InputGroupTextarea) + textarea.tsx
  - cmdk@^1.1.1 recorded in package.json + package-lock.json via npm (no yarn.lock) — the phase's single new npm dependency (SET-06 infra)
  - The cmdk data-checked gap documented (CheckIcon gated on group-data-[checked=true] — wrapper must pass data-checked; PATTERNS.md Pitfall 1)
affects: [Plan 21-04 model-picker.tsx wrapper imports, Plan 21-05 form swap, Phase 22 verification gate, SET-06 completion]

# Tech tracking
tech-stack:
  added: [cmdk@^1.1.1 (npm), vendored src/components/ui/{command,popover,input-group,textarea}.tsx from official shadcn registry]
  patterns: [vendored-primitive house shape confirmed (use client + data-slot + cn() + named exports + @/lib/utils alias), Tailwind v4 descendant-selector form of the group-heading contract (**:[[cmdk-group-heading]]:text-xs...)]

key-files:
  created:
    - src/components/ui/command.tsx
    - src/components/ui/popover.tsx
    - src/components/ui/input-group.tsx
    - src/components/ui/textarea.tsx
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "Vendored via the official shadcn CLI (npx shadcn@latest add command popover -y) exactly per RESEARCH §Standard Stack l.120-126 — files stay byte-close to the registry item, never hand-edited"
  - "cmdk@^1.1.1 is the only new package.json dependency; recorded via npm into package-lock.json (packageManager field stays yarn but package-lock.json remains the de-facto lockfile — no yarn.lock introduced)"
  - "CommandGroup heading contract verified in its v4 registry form: **:[[cmdk-group-heading]]:text-xs **:[[cmdk-group-heading]]:font-medium **:[[cmdk-group-heading]]:text-muted-foreground — the literal string 'text-xs font-medium text-muted-foreground' does not appear; the descendant-selector form is the correct registry output"
  - "SET-06 is NOT marked complete in REQUIREMENTS.md — this plan delivers its infrastructure only; the searchable Command picker completes in plans 21-04/21-05"

patterns-established:
  - "Pattern: post-vendor registry-contract verification — grep for @/app/(create and @/registry must return 0, lucide IconPlaceholder resolution, data-slot attributes, tsc gate; the vendored v4 group-heading uses the compiled **:[[cmdk-group-heading]]: descendant form, not the literal class string"
  - "Pattern: cmdk data-checked gap — vendored CommandItem's CheckIcon is gated on group-data-[checked=true]/command-item:opacity-100 but cmdk only emits data-selected/aria-selected/data-disabled; the 21-04 wrapper MUST pass data-checked={value === m.id} per row"

requirements-completed: []

# Metrics
duration: 12min
completed: 2026-08-02
---

# Phase 21 Plan 1: Vendor Command/Popover Primitives Summary

**Vendored the shadcn Command primitive set (cmdk 1.1.1 + radix-ui Popover + auto-deps input-group/textarea) via the official shadcn CLI with zero dangling registry paths — the combobox foundation plan 21-04's model-picker wrapper imports, recorded in package-lock.json via npm with no yarn.lock**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-02T22:52:00Z
- **Completed:** 2026-08-02T23:04:14Z
- **Tasks:** 1 (both `type="auto"`, no checkpoints)
- **Files modified:** 6

## Accomplishments
- `npx shadcn@latest add command popover -y` vendored exactly the 4 planned files — `command.tsx` (cmdk wrapper), `popover.tsx` (radix-ui), plus auto-registry-dependencies `input-group.tsx` + `textarea.tsx` — from the official shadcn registry (`registries: {}`, no third-party registries, no `@shadcn/combobox`)
- Post-add verification passed on every registry-contract trap: zero `@/app/(create` / `@/registry` dangling imports in all 4 files; the registry `IconPlaceholder` resolved to lucide `SearchIcon, CheckIcon` (`command.tsx:18`); `CommandList` carries `max-h-72` (`command.tsx:99`); the `CommandGroup` heading renders the v4 descendant-selector form of `text-xs font-medium text-muted-foreground` (`command.tsx:128`)
- `cmdk@^1.1.1` (MIT, lockfile entry `registry.npmjs.org/cmdk/-/cmdk-1.1.1.tgz`) is the phase's single new npm dependency — added to package.json via the CLI and recorded in package-lock.json; no `yarn.lock` was created despite the `packageManager: yarn` field (package-lock.json stays the de-facto lockfile per RESEARCH §Project Constraints)
- `select.tsx` and its 4 non-settings consumers (`company-filters.tsx`, `column-mapping-step.tsx`, `persona-filters.tsx`, `reject-dialog.tsx`) confirmed untouched — `git status --porcelain` empty for each (D-21-06: Select stays for the provider selector + those consumers)
- `npx tsc --noEmit` exits 0 — the vendored files compile against the project; `next build` re-asserts in plan 21-05

## Task Commits

Each task was committed atomically:

1. **Task 1: Vendor command/popover via shadcn CLI + cmdk install + post-add verification** - `a99b13c3` (feat)

## Files Created/Modified
- `src/components/ui/command.tsx` - Vendored shadcn Command primitive (cmdk wrapper): Command, CommandDialog, CommandInput (via InputGroup + lucide SearchIcon), CommandList (max-h-72), CommandEmpty, CommandGroup (v4 descendant-form heading), CommandSeparator, CommandItem (CheckIcon gated on `data-checked`), CommandShortcut — all `data-slot`-attributed, `cn()`-merged, named exports
- `src/components/ui/popover.tsx` - Vendored shadcn Popover (radix-ui `PopoverPrimitive` from the unified radix-ui package, same import style as select.tsx:4): Popover, PopoverTrigger, PopoverContent (Portal + `w-72` default overridden by the wrapper's `w-(--radix-popover-trigger-width)`), PopoverAnchor, PopoverHeader/Title/Description
- `src/components/ui/input-group.tsx` - Auto-registry-dependency of `command`: InputGroup, InputGroupAddon, InputGroupButton, InputGroupText, InputGroupInput, InputGroupTextarea
- `src/components/ui/textarea.tsx` - Auto-registry-dependency (pulled transitively per RESEARCH l.125)
- `package.json` - `"cmdk": "^1.1.1"` added to dependencies (the only change)
- `package-lock.json` - cmdk@1.1.1 lock entry (lockfileVersion 3, npm-managed)

## Decisions Made
- Vendored exactly per the locked D-21-05 path: official shadcn CLI → cmdk-based Command, NOT `@shadcn/combobox` (Base UI-based, contradicts the decision — no such install attempted)
- Lockfile discipline honored: the CLI did not create a `yarn.lock` (no removal needed); cmdk landed in package-lock.json via the CLI's npm-managed install
- Vendored files left byte-close to the registry item — no re-quoting, no reformatting (house rule; vendored double-quote style matches select.tsx itself)
- The v4 group-heading contract is satisfied by the descendant-selector form; the literal-string grep from the plan's `verify` block (`text-xs font-medium text-muted-foreground`) is expected to miss it — verified against the actual registry output instead (documented, not a deviation)

## Deviations from Plan

None - plan executed exactly as written. All acceptance criteria met:
- `src/components/ui/command.tsx` exists and contains `from "cmdk"` ✓
- `grep -c '@/app/(create\|@/registry' src/components/ui/command.tsx` → 0 ✓
- `popover.tsx`/`input-group.tsx`/`textarea.tsx` all exist ✓
- package.json `"cmdk": "^1.1.1"`; package-lock.json cmdk entry; no yarn.lock ✓
- `git status --porcelain src/components/ui/select.tsx` empty ✓
- `npx tsc --noEmit` exit 0 ✓

## Issues Encountered
- `cmdk@1.1.1` was already present in `node_modules` as an orphan (present but absent from package.json/package-lock.json — leftover from the planner's 2026-08-03 research verification). No action needed: the CLI's install recorded it properly in both manifests. Zero impact.
- The plan's `verify` block greps for the literal class string `text-xs font-medium text-muted-foreground` on the CommandGroup heading; the vendored v4 file instead uses the compiled Tailwind v4 descendant-selector form `**:[[cmdk-group-heading]]:text-xs **:[[cmdk-group-heading]]:font-medium **:[[cmdk-group-heading]]:text-muted-foreground`. The registry contract is fully satisfied — verified by reading the vendored file (the plan's own acceptance prose names the same contract).

## User Setup Required
None - no external service configuration required (no env changes; cmdk is a pure npm dependency with no postinstall script per the RESEARCH Package Legitimacy Audit).

## Next Phase Readiness
- Plan 21-02 (`model-picker-logic.ts` + Vitest) and plan 21-04 (`model-picker.tsx` wrapper) can import `@/components/ui/command` + `@/components/ui/popover` with zero dangling registry paths — the wrapper's `PopoverContent` should pass `w-(--radix-popover-trigger-width) p-0` per PATTERNS §model-picker.tsx
- **Wrapper must pass `data-checked={value === m.id}` per `CommandItem`** (PATTERNS.md Pitfall 1 / RESEARCH Pitfall 1): cmdk 1.1.1 emits only `data-selected`/`aria-selected`/`data-disabled` — the vendored v4 CheckIcon (`command.tsx:164`) is gated on `group-data-[checked=true]/command-item:opacity-100` and will never show otherwise. Add a why-comment at the call site.
- SET-06 remains open in REQUIREMENTS.md by design — this plan shipped its infra (Command primitive + cmdk); the type-to-filter search UX completes when 21-04's wrapper and 21-05's form swap land

---

*Phase: 21-settings-ui*
*Completed: 2026-08-02*

## Self-Check: PASSED

- Files: `src/components/ui/command.tsx`, `src/components/ui/popover.tsx`, `src/components/ui/input-group.tsx`, `src/components/ui/textarea.tsx`, `.planning/phases/21-settings-ui/21-01-SUMMARY.md` — all FOUND
- Commits: `a99b13c3` (Task 1 feat), `7b77e64d` (SUMMARY docs), `190bc185` (STATE/ROADMAP docs) — all present in git log
- Gates: `npx tsc --noEmit` exit 0; dangling-import grep = 0; cmdk in package.json + package-lock.json; no yarn.lock; select.tsx + 4 consumers untouched
