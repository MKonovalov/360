# Phase 18: Verification Gate - Pattern Map

**Mapped:** 2026-08-02
**Files analyzed:** 7 (4 new/modified code+artifact files mapped; 3 phase-artifact formats)
**Analogs found:** 7 / 7

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/agents/runAgent.test.ts` (EDIT, +4 loop tests) | test | request-response (mockable-seam loop) | `runAgent.test.ts` `describe('runAgent failover loop (FAL-03/04)')` (:124-237) | exact (same file, same block) |
| `src/lib/models/catalog.test.ts` (EDIT, optional real-snapshot test) | test | CRUD (pure filter) | `catalog.test.ts` `describe('getAllowlistedServableIds')` (:78-82) | exact (same file, same describe) |
| `src/lib/agents/modelConfig.test.ts` (EDIT, optional partial-chain test) | test | CRUD (pure resolver) | `modelConfig.test.ts` `describe('resolveModelChain')` (:112-140) | exact (same file, same describe) |
| `.planning/phases/18-verification-gate/18-VER-01-MATRIX.md` (NEW) | config/artifact | transform (requirement→test→assertion map) | `17-UAT.md` numbered-test format + `15-VERIFICATION.md` Observable Truths table | role-match (format mashup, no direct precedent — RESEARCH notes this) |
| `.planning/phases/18-verification-gate/18-UAT.md` (NEW) | config/artifact | request-response (live run record) | `17-UAT.md` (6 numbered tests, expected/result) | exact format match |
| `.planning/phases/18-verification-gate/18-VERIFICATION.md` (NEW) | config/artifact | event-driven (phase-gate evidence) | `15-VERIFICATION.md` / `16-VERIFICATION.md` | exact format match |
| `.planning/phases/18-verification-gate/18-VALIDATION.md` (NEW, implied by RESEARCH Wave-0) | config/artifact | transform (validation contract) | `16-VALIDATION.md` | exact format match |

## Pattern Assignments

### `src/lib/agents/runAgent.test.ts` (test, request-response) — ADD 4 loop tests

**Analog:** The existing `describe('runAgent failover loop (FAL-03/04)')` block — **add the 4 new tests INSIDE this block** (RESEARCH anti-pattern: do NOT create a new describe block or file — it fragments the seam's mock setup).

**Imports pattern** (lines 1-2 — add `InvalidResponseDataError` for the output/schema test):
```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { APICallError, RetryError } from 'ai';
// → becomes: import { APICallError, InvalidResponseDataError, RetryError } from 'ai';
```
`InvalidResponseDataError` survives the `importOriginal` spread (same mechanism that keeps RetryError real — comment lines 132-135).

**Mock-seam pattern** (lines 8-29 — do NOT touch; it's already in place and shared by all tests in the file):
```typescript
const mocks = vi.hoisted(() => ({
  generateText: vi.fn(),
  anthropic: vi.fn(),
  initLangfuse: vi.fn(),
  outputObject: vi.fn(),
}));

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return { ...actual, generateText: mocks.generateText, Output: { ...actual.Output, object: mocks.outputObject } };
});
vi.mock('@ai-sdk/anthropic', () => ({ anthropic: mocks.anthropic }));
```

**The `apiErr(statusCode)` helper** (lines 136-137 — reuse verbatim; this is how 401/403 errors are constructed):
```typescript
const apiErr = (statusCode: number) =>
  new APICallError({ message: `http ${statusCode}`, url: 'u', requestBodyValues: {}, statusCode });
```

**Core pattern to mirror — 400/429 never-advances test** (lines 164-171; the 401/403 tests are line-for-line clones with `apiErr(401)` / `apiErr(403)`):
```typescript
it('400 never advances — single attempt, throws (Pitfall 2)', async () => {
  mocks.generateText.mockRejectedValueOnce(apiErr(400));

  await expect(
    runAgent({ company, liveSignals: [], models: [mocks.anthropic(), mocks.anthropic()] }),
  ).rejects.toThrow();
  expect(mocks.generateText).toHaveBeenCalledTimes(1);
});
```
Assertion contract: rejects + exactly 1 `generateText` call + the 2-model chain never attempted (RESEARCH Code Example 1/2 — `classifyModelError(apiErr(401)) === 'auth'` → `isFailoverEligible('auth') === false` → loop `throw err` at attempt 0, runAgent.ts:89).

**Core pattern to mirror — output/schema never-advances test** (RESEARCH Code Example 3; constructor shape verified at `modelConfig.test.ts:80`):
```typescript
it('output/schema errors never advance — single attempt, throws (D-01)', async () => {
  mocks.generateText.mockRejectedValueOnce(new InvalidResponseDataError({ data: {} }));
  await expect(
    runAgent({ company, liveSignals: [], models: [mocks.anthropic(), mocks.anthropic()] }),
  ).rejects.toThrow();
  expect(mocks.generateText).toHaveBeenCalledTimes(1);
});
```

**Core pattern to mirror — RetryError-wrapped error advances** (lines 217-236; the RetryError-404 test is this shape with `errors: [apiErr(404)]`):
```typescript
it('RetryError-wrapped 5xx unwraps and still advances (Pitfall 3)', async () => {
  mocks.generateText
    .mockRejectedValueOnce(
      new RetryError({
        message: 'max retries exceeded',
        reason: 'maxRetriesExceeded',
        errors: [apiErr(500)],
      }),
    )
    .mockResolvedValueOnce(resolvedRun);

  const result = await runAgent({
    company,
    liveSignals: [],
    models: [mocks.anthropic(), mocks.anthropic()],
  });

  expect(mocks.generateText).toHaveBeenCalledTimes(2);
  expect(result).toEqual({ ...resolvedRun, modelUsed: 'claude-sonnet-4-6', usedFallback: true });
});
```
**Exact RetryError constructor shape** (used at :220-224 and `modelConfig.test.ts:35-39`):
```typescript
new RetryError({ message: 'max retries exceeded', reason: 'maxRetriesExceeded', errors: [apiErr(404)] })
```
Why it passes with zero classifier changes: `classifyModelError` unwraps `RetryError.isInstance` → recurses on `err.lastError` (modelConfig.ts:34-35) → inner `APICallError(404)` maps to `'model_not_found'` (:43) → `isFailoverEligible` true (:65-67).

**Shared test fixtures** (lines 35-55, already in file — reuse): `company` (:35-45), `resolvedRun` (:47-55), `outputSpec` (:60). `beforeEach` for the loop block (:125-130) resets mocks + returns `{ provider: 'anthropic', modelId: 'claude-sonnet-4-6' }`.

**Warning — do NOT delete/weaken the default-model test** (`runAgent.test.ts:113-116`, `anthropic('claude-sonnet-4-6')`): checklist item 12 pins it (PITFALLS.md:358).

---

### `src/lib/models/catalog.test.ts` (test, CRUD) — OPTIONAL real-snapshot test

**Analog:** `describe('getAllowlistedServableIds')` (:78-82) — the fixture-based filter test. Add the real-snapshot test inside the same describe.

**Fixture-decoupling convention to respect** (lines 11-13 — the inline fixture deliberately does NOT import catalog.json; the new real-snapshot test is the ONE deliberate exception per RESEARCH Pitfall 4):
```typescript
// CAT-03 pure unit coverage (D-16): zero mocks, zero live calls. The fixture
// is inline and deliberately decoupled from the committed catalog.json — these
// tests pin the filter/slug semantics, not a snapshot that drifts on refresh.
```

**Import pattern** (add at top of file, alongside the named imports at :2-8; `catalog.ts:1` precedent uses `import type` but this test needs the VALUE):
```typescript
import catalogJson from './catalog.json';
```

**Core pattern to mirror** (existing test at :78-82):
```typescript
describe('getAllowlistedServableIds', () => {
  it('returns exactly the allowlisted, non-deprecated anthropic raw IDs — no dated-ID leakage, no opencode/ leakage (CAT-03)', () => {
    expect(getAllowlistedServableIds(fixture)).toEqual(['claude-sonnet-4-6']);
  });
});
```

**New test to add** (RESEARCH Code Example 5 — pins the committed 1131-model artifact, closes Pitfall 4):
```typescript
it('committed 1131-model snapshot yields exactly the servable allowlist — zero leakage (CAT-03)', () => {
  expect(getAllowlistedServableIds(catalogJson)).toEqual(['claude-sonnet-4-6']);
  expect(getAllowlistedServableIds(catalogJson).some((id) => id.includes('/'))).toBe(false);
});
```

---

### `src/lib/agents/modelConfig.test.ts` (test, CRUD) — OPTIONAL partial-chain test

**Analog:** `describe('resolveModelChain')` (:112-140) — 5 existing tests. Add the partial-chain test at the end of this describe.

**Core pattern to mirror** — the cap test (:123-127) shows the `(settings, allowlist)` two-arg call shape; the default test (:113-115) shows the return assertion:
```typescript
it('caps at primary + 1 fallback AFTER dedupe (D-10)', () => {
  expect(
    resolveModelChain({ primaryModel: 'a', fallbackModels: ['b', 'c'] }, ['a', 'b', 'c']),
  ).toEqual(['a', 'b']);
});
```

**New test to add** (RESEARCH Code Example 6 — completes the default/partial/full matrix):
```typescript
it('a partial chain (primary + one fallback) passes through intact when allowlisted', () => {
  expect(
    resolveModelChain({ primaryModel: 'a', fallbackModels: ['b'] }, ['a', 'b']),
  ).toEqual(['a', 'b']);
});
```

---

### `.planning/phases/18-verification-gate/18-VER-01-MATRIX.md` (config/artifact, transform) — NEW

**Analog:** No direct precedent (RESEARCH: "No direct precedent — nearest are the 17-UAT numbered lists and 15-VERIFICATION truth tables"). Use `17-UAT.md`'s numbered-item format for requirement→test rows and `15-VERIFICATION.md`'s Observable Truths table for the checklist map.

**YAML frontmatter to mirror** (`17-UAT.md:1-7`):
```yaml
---
status: <complete|in-progress>
phase: 18-verification-gate
source: [18-CONTEXT.md, 18-RESEARCH.md]
started: <ISO timestamp>
updated: <ISO timestamp>
---
```

**Checklist map source (authoritative — copy verbatim, do NOT rewrite):** `.planning/research/PITFALLS.md:345-359` — **13 items, not 12** (RESEARCH Pitfall 1). Each row: checklist item verbatim → `covered-by-existing-test` (file + test name) vs `new-work` (new test / UAT line / grep). The mapping content lives in RESEARCH's `## Phase Requirements → Test Map` table (lines 427-440) and the `18-RESEARCH.md` Architecture diagram.

**Numbered-test row format to mirror** (`17-UAT.md:15-17`):
```markdown
### 1. <checklist item / requirement>
expected: <assertion>
result: <pass | covered-by-existing-test | new-work>
```

---

### `.planning/phases/18-verification-gate/18-UAT.md` (config/artifact, request-response) — NEW — VER-03 live run record

**Analog:** `17-UAT.md` — exact format to replicate.

**Full structure to copy** (`17-UAT.md` — YAML frontmatter + `## Current Test` + `## Tests` + `## Summary` + `## Gaps`):
```markdown
---
status: complete
phase: 18-verification-gate
source: [<SUMMARY files from the UAT task>]
started: <ISO>
updated: <ISO>
---

## Current Test

[testing complete]

## Tests

### 1. <test name>
expected: <behavior to verify — e.g. Settings → pick primary → save → run Analyze → agent_run.model_used equals saved primary (Pitfall 10 wording)>
result: pass

### 2. ... (one per test)

## Summary

total: N
passed: N
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
```

**Content requirements (from CONTEXT D-18-02/D-18-04 + RESEARCH):**
- Happy path only: Settings → pick primary → save → run Analyze → `agent_run.model_used` == saved primary. NO forced-fail mechanism (no env-var fail hook, no invalid-model trick).
- Absorb 16-HUMAN-UAT's 2 pending items: (1) live-browser status strip rendering (`16-HUMAN-UAT.md:15-18`), (2) live run audit trail (`16-HUMAN-UAT.md:20-26` — `agent_run.model_used`/`model_chain` + Langfuse per-attempt spans).
- Absorb 17-03's deferred `<human-check>` (`17-03-PLAN.md:188`): dev server, staff Clerk account, `/settings` renders config/empty state, pickers show servable models with cost captions, fallback add/remove/reorder, Save shows "Saved.", reload reflects persisted state.
- **Assert DB columns only:** `model_used` + `model_chain` (schema.ts:247-248). `usedFallback` is response-only (route.ts:111) — never query a `used_fallback` column (RESEARCH Pitfall 5). DB query: `SELECT model_used, model_chain FROM agent_run ORDER BY id DESC LIMIT 1;`
- Local dev (`npm run dev`) per 17-UAT precedent; verify `.env.local` has Anthropic/Firecrawl keys first (else `not_configured`, analyzeCompany.ts:44).

---

### `.planning/phases/18-verification-gate/18-VERIFICATION.md` (config/artifact, event-driven) — NEW — phase-gate evidence

**Analog:** `15-VERIFICATION.md` / `16-VERIFICATION.md` — exact structure.

**YAML frontmatter to mirror** (`15-VERIFICATION.md:1-14` — includes `human_verification` items with `test`/`expected`/`why_human`):
```yaml
---
phase: 18-verification-gate
verified: <ISO>
status: <passed | human_needed>
score: <N/N must-haves verified>
overrides_applied: 0
human_verification:
  - test: "<VER-03 live-browser UAT description>"
    expected: "<agent_run.model_used equals saved primary>"
    why_human: "<zero component tests (QLTY-01); browser + live Postgres observation>"
---
```

**Body sections to mirror** (`15-VERIFICATION.md`): `# Phase 18: ... Verification Report` header with goal/verified/status → `## Goal Achievement` → `### Observable Truths` table (# | Truth | Status | Evidence) → `### Required Artifacts` → `### Key Link Verification` → `### Data-Flow Trace (Level 4)` → `### Behavioral Spot-Checks` → `### Probe Execution` → `### Requirements Coverage` → `### Anti-Patterns Found` → `### Human Verification Required` → `### Gaps Summary` → footer `_Verified:_` / `_Verifier:_`.

**Observable Truths table format** (`15-VERIFICATION.md:27-36`):
```markdown
| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | <claim> | ✓ VERIFIED | <file:line evidence, executed gates> |
```

**Mandatory disposition note (RESEARCH Pitfall 6):** record "SC-3 forced-fail clause satisfied-by-extension via runAgent.test.ts RetryError-404 + exhaustion tests (D-18-02)" — otherwise ROADMAP:146 reads unmet.

**Behavioral Spot-Checks to include** (RESEARCH Validation Layer Map): `npm test` (full suite ≈291 after +4), `npx tsc --noEmit`, zero-hit grep gate (exact command, `15-VERIFICATION.md:36` Truth 8 + `:78`):
```bash
grep -rE "node:child_process|execFileSync\(|execSync\(|spawnSync\(|spawn\(" src/   # → 0 hits
```

**Deferred-items section precedent** (`17-VERIFICATION.md:7-11,34-40` — YAML `deferred:` + body `### Deferred Items`): Phase 18's VERIFICATION should show the opposite — items deferred INTO it (16-HUMAN-UAT 2 items, 17-03 `<human-check>`) as absorbed/closed.

---

### `.planning/phases/18-verification-gate/18-VALIDATION.md` (config/artifact, transform) — NEW (implied by RESEARCH Wave-0 list)

**Analog:** `16-VALIDATION.md` — exact structure: YAML frontmatter (`phase/slug/status/nyquist_compliant/wave_0_complete/created`) + `## Test Infrastructure` table (Framework = Vitest 4.1.10, quick-run command, full-suite command) + `## Sampling Rate` + `## Per-Task Verification Map` table + `## Wave 0 Requirements` checklist + `## Manual-Only Verifications` + `## Validation Sign-Off`. Quick-run command for Phase 18 (from RESEARCH):
```
npx vitest run src/lib/agents/runAgent.test.ts src/lib/agents/modelConfig.test.ts src/lib/models/catalog.test.ts src/app/actions/settings.test.ts
```

## Shared Patterns

### Vitest pure-functions-only discipline (D-16)
**Source:** Phase 15 D-16 (documented in `15-CONTEXT.md`), enforced across all three test files.
**Apply to:** `runAgent.test.ts`, `catalog.test.ts`, `modelConfig.test.ts` additions.
- Zero live calls: no network, no DB, no real Anthropic. The runAgent loop tests mock `generateText` + `@ai-sdk/anthropic` + `firecrawl` + `@/lib/env` (lines 8-29). The catalog/modelConfig tests are zero-mock pure tests.
- The 4 new runAgent tests add to the EXISTING failover-loop describe block — never a new file or describe (fragments the seam's mock setup).
- Import real SDK error classes (`APICallError`, `RetryError`, `InvalidResponseDataError`) from `'ai'` — they survive the `importOriginal` spread and let the real `classifyModelError` classify them.

### Error construction shapes (shared across runAgent + modelConfig suites)
**Source:** `runAgent.test.ts:136-137`, `modelConfig.test.ts:19-25`.
**Apply to:** all new loop/taxonomy tests.
```typescript
const apiErr = (statusCode: number) =>
  new APICallError({ message: `http ${statusCode}`, url: 'u', requestBodyValues: {}, statusCode });

new RetryError({ message: 'max retries exceeded', reason: 'maxRetriesExceeded', errors: [apiErr(<code>)] });
new InvalidResponseDataError({ data: {} });
```

### Phase-artifact YAML frontmatter convention
**Source:** `17-UAT.md:1-7`, `15-VERIFICATION.md:1-14`, `16-VALIDATION.md:1-8`.
**Apply to:** all four new `18-*.md` artifacts. Every artifact opens with YAML frontmatter (status, phase slug `18-verification-gate`, source, timestamps) and closes with a footer.

### The zero-hit grep gate (VER-04 / checklist item 11 / ASVS V7)
**Source:** `15-VERIFICATION.md:36` (Truth 8) and `:78`.
**Apply to:** VERIFICATION.md Behavioral Spot-Checks + the PR/VER-04 plan task.
```bash
grep -rE "node:child_process|execFileSync\(|execSync\(|spawnSync\(|spawn\(" src/
```
Result must be 0 hits (re-verified 0 in RESEARCH this session). Use this EXACT pattern — a sloppy re-run breaks cross-phase comparability (RESEARCH anti-pattern).

### The analyze route / DB audit surface (VER-03 UAT assertion target)
**Source:** `src/app/api/companies/[id]/analyze/route.ts:107-115` (flat 201 body incl. `usedFallback`/`modelUsedName`), `:128-140` (`createRun` persists `modelUsed`/`modelChain`); `src/lib/db/schema.ts:247-248` (`modelUsed: text('model_used')`, `modelChain: jsonb('model_chain')`).
**Apply to:** 18-UAT.md assertions + VERIFICATION Truth rows. Assert on DB columns `model_used`/`model_chain` only — `usedFallback` is response-only, never a DB column (RESEARCH Pitfall 5).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `18-VER-01-MATRIX.md` | config/artifact | transform | No prior requirement→test→assertion matrix artifact exists; compose from `17-UAT.md` numbered-item format + `15-VERIFICATION.md` truth-table format + RESEARCH's `Phase Requirements → Test Map` table |

## Metadata

**Analog search scope:** `src/lib/agents/*.test.ts` (4 files), `src/lib/models/catalog.test.ts`, `.planning/phases/15|16|17/*-UAT.md`, `*-VERIFICATION.md`, `16-VALIDATION.md`, `17-03-PLAN.md`, `.planning/research/PITFALLS.md`
**Files scanned:** 10
**Pattern extraction date:** 2026-08-02
**Project skills checked:** `.claude/skills/` → `neon` + `neon-postgres` (relevant to VER-03's Postgres UAT query — follow branch-first dev flow, read-only `agent_run` SELECT); user skills `deploy-to-vercel` / `vercel-cli-with-tokens` at `~/.agents/skills/` (VER-04 fallback only, per D-18-03 — PR auto-preview is primary). No project `.agents/skills/` directory.
**Verification-phase notes:** This phase adds ZERO production code — only tests + artifacts + grep gates. No new packages (Vitest 4.1.10 already installed). Count corrections to carry: PITFALLS checklist is **13** items (not 12); `catalog.test.ts` has **9** tests (not 11).
