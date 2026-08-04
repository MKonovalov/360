# Phase 27: Verification Gate - Research

**Researched:** 2026-08-04
**Domain:** Test/verification engineering for a 4-provider AI-model run path (Vitest live-key integration tests, Playwright browser E2E, security-matrix grep) — no new product features
**Confidence:** HIGH (every claim below is grounded in code actually read this session, or a command actually executed — no unverified training-data claims)

## Summary

This phase proves, rather than builds. Every one of VER-01..05's targets already has direct code precedent from Phase 22 (v1.4's Verification Gate) or was already built by Phases 23-26; the job is to widen/extend those exact patterns to the 2 new providers (NousResearch, OpenCode) and close the loop on two carried-forward defects (Phase 26 CR-01/CR-02).

The single most important research finding: **the currently-failing `openrouter-only-chain.test.ts` (D-27-02) is NOT a regression, NOT a model deprecation, and NOT an infra/API change.** I reproduced the failure live this session (`npx vitest run src/lib/agents/openrouter-only-chain.test.ts` → fails on `expect(out.ok).toBe(true)`, receives `false`) and traced the exact cause by instrumenting a debug copy of the probe: `analyzeCompany` returns `{ ok: false, reason: 'billing', message: 'provider credits exhausted' }`. A direct call to OpenRouter's `/api/v1/key` endpoint confirms `OPENROUTER_API_KEY` is `is_free_tier: true`, `limit: null` — the exact same uncredited-key condition Phase 22 already documented and left as a known "pending-credit" limitation in `STATE.md` and `22-VERIFICATION.md`. This is the identical, still-unresolved billing gap from Phase 22 — not new breakage. The correct disposition (per D-27-02's discretion note) is to document this finding in `27-VERIFICATION.md` as the same pending-credit condition, not force a code fix (there is nothing to fix — the chain, the gate, and the classifier all behave correctly; the account itself has no funds).

By contrast, I verified live that both new providers' keys work: `NOUSRESEARCH_API_KEY` and `OPENCODE_API_KEY` both return HTTP 200 on their `/v1/models` list endpoints (Zen and Go base URLs both respond distinctly, confirming they are genuinely separate endpoints sharing one key). This means VER-02/VER-03's live E2E proof for NousResearch/OpenCode is NOT blocked by the same billing wall that stalls the OpenRouter re-proof — D-27-01's choice to scope live E2E to the 2 new providers only is not just cheaper, it is also the ONLY currently-unblocked live proof path in this repo.

**Primary recommendation:** Mirror Phase 22's artifacts file-for-file — two new sibling files next to `openrouter-only-chain.test.ts` (`nousresearch-only-chain.test.ts` + `opencode-only-chain.test.ts`) with matching `scripts/probe-*.ts` companions, one new Playwright spec section (or extension of `ver-05-settings.spec.ts`) closing all 4 `26-HUMAN-UAT.md` items, a `supportsStructuredOutputs: true` flip added at the `createOpenAICompatible(...)` constructor call site (NOT a per-call option) gated behind 3 independent live-key Vitest probes, a 2-token extension of `security-grep.test.ts`'s `ALLOWED`/scan-string set, and the two documented CR-01/CR-02 fixes in `model-settings-form.tsx`. Document the OpenRouter billing non-regression finding plainly in `27-VERIFICATION.md`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Provider-resolution matrix audit (VER-01) | API/Backend (test suite over `src/lib/models/catalog.ts` + `src/lib/agents/modelConfig.ts`) | — | Pure Node/Vitest logic, no I/O; this is a unit-test-tier concern |
| Live Analyze round trip (VER-02) | API/Backend (`analyzeCompany.ts` → `runAgent.ts` → provider SDKs) | Database/Storage (`agent_run.model_used` read-back) | The claim being proven is a backend orchestration + persistence contract, observed via a real HTTP call |
| Child-env key isolation (VER-03) | API/Backend (spawned child process running `analyzeCompany`) | — | Process-level env isolation is an OS/process concern layered over the same backend entry point as VER-02 |
| Security-matrix grep (VER-04) | API/Backend + Browser/Client boundary (source-level static scan across both) | — | The scan's job IS to prove no server-only secret crosses the client-component boundary — its scope necessarily spans both tiers |
| Live-browser UAT (VER-05) | Browser/Client (Playwright driving the rendered Settings UI) | Frontend Server/SSR (Next.js App Router `/settings` page + Server Actions it calls) | Playwright observes rendered DOM; the page itself is SSR + Server Actions, both exercised transitively |
| structuredOutputs live probe (RUN-06 completion) | API/Backend (`generateText`/`Output.object` against the 3 openai-compatible model instances) | — | Pure backend/provider-contract concern; no UI surface |
| CR-01/CR-02 Save-flow fixes | Browser/Client (`model-settings-form.tsx`, a `'use client'` component) | Frontend Server/SSR (the Server Action it calls, `saveSettingsAction`, untouched) | Both defects are client-side state-machine bugs in a `'use client'` React component; the Server Action itself is proven correct and must not change |

## Standard Stack

No new libraries this phase. Everything needed is already installed and already used by the exact precedent files this phase extends.

### Core (already installed, reused verbatim)
| Library | Installed Version | Purpose | Why Standard (for this repo) |
|---------|---------|---------|--------------|
| `vitest` | ^4.1.10 [VERIFIED: package.json] | Test runner for all Vitest-tier work (VER-01, VER-03, RUN-06 probe, VER-04) | Already the project's only test runner; `describe.skipIf` used throughout for live-key gating |
| `@playwright/test` | ^1.62.1 [VERIFIED: package.json] | Browser E2E runner for VER-05 | Installed in Phase 22 (D-22-04) specifically for this verification-gate pattern; already configured (`playwright.config.ts`) |
| `@clerk/testing` | ^2.2.16 [VERIFIED: package.json] | Real Clerk sign-in in Playwright (`clerk.signIn`, `clerkSetup`) | Installed Phase 22 (D-22-05); `e2e/auth.setup.ts` already wired, reused unchanged |
| `dotenv` | (transitive, already used) [VERIFIED: code] | Loads `.env.local` for Vitest/tsx scripts (not auto-loaded outside Next.js) | Established precedent in `openrouter-only-chain.test.ts`, `probe-openrouter-only.ts`, `playwright.config.ts` |
| `tsx` | (devDependency, already used) [VERIFIED: code] | Runs the child-process probe scripts (`scripts/probe-*.ts`) | `spawnSync(process.execPath, [require.resolve('tsx/cli'), ...])` is the existing pattern |
| `@ai-sdk/openai-compatible` | ^3.0.22 [VERIFIED: package.json] | The provider SDK whose `supportsStructuredOutputs` constructor option is this phase's RUN-06 flip target | Already the sole SDK for the 3 openai-compatible instances (`modelFactory.ts`) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Extending existing test files (chosen) | New standalone verification scripts outside the test suite | Rejected — breaks the "verification proves, doesn't invent new tooling" discipline (D-22-06/D-27-12 precedent); loses `npm test` auto-discovery and CI-skip semantics |
| Per-call `supportsStructuredOutputs` option at every `instantiateModel` call site | Constructor-level flag on each `createOpenAICompatible(...)` singleton | Constructor-level is correct and simpler: each of the 3 instances is already a per-provider module singleton (D-25-01), so setting the flag once at construction is equivalent to a per-call flag but touches 1 line instead of N call sites |

**Installation:** None required — no new packages.

**Version verification:** All versions above read directly from the installed `package.json`; no registry lookup needed since nothing new is being added.

## Package Legitimacy Audit

**Not applicable.** This phase installs zero new external packages — every tool used (`vitest`, `@playwright/test`, `@clerk/testing`, `@ai-sdk/openai-compatible`, `dotenv`, `tsx`) is already installed and already in production use by the exact precedent files this phase extends. The Package Legitimacy Gate protocol is skipped per its own "required whenever this phase installs external packages" trigger — it does not trigger here.

## Architecture Patterns

### System Architecture Diagram

```text
                    ┌─────────────────────────────────────────────────────┐
                    │  VER-01: Vitest matrix audit (no I/O)                │
                    │  catalog.test.ts + modelConfig.test.ts               │
                    │  → confirms existing 4-provider coverage is complete │
                    └─────────────────────────────────────────────────────┘

  VER-02/VER-03 live proof (2 new providers only, D-27-01):
  ┌──────────────┐   spawn child env    ┌──────────────────────┐   HTTPS   ┌─────────────────────┐
  │ Vitest test  │ ───(only target-key)──▶│ scripts/probe-*.ts   │──────────▶│ NousResearch API /   │
  │ (parent env) │                       │ (tsx child process)  │           │ OpenCode Zen/Go API  │
  └──────────────┘                       └──────────┬───────────┘           └─────────────────────┘
                                                     │ imports
                                                     ▼
                                          analyzeCompany() → missingProviderKey()
                                          gate → instantiateChain() → runAgent()
                                                     │
                                                     ▼
                                          Postgres: agent_run.model_used (VER-02 read-back)

  RUN-06 structuredOutputs probe (per-instance, D-27-05/06):
  ┌──────────────┐   generateText +      ┌───────────────────────┐
  │ Vitest test  │──Output.object(real───▶│ nousresearch(id) /     │──▶ pass → flip constructor's
  │ skipIf-guard │   outputSchema)        │ openaiCompatibleZen /  │    supportsStructuredOutputs:true
  └──────────────┘                       │ openaiCompatibleGo(id) │    fail → leave false, documented
                                          └───────────────────────┘

  VER-04 security grep (static, no I/O):
  security-grep.test.ts walks src/**.ts(x) → asserts NOUSRESEARCH/OPENCODE absent from
  client-reachable code, present only in the existing ALLOWED server-file set.

  VER-05 browser UAT (real browser, real Clerk session):
  Playwright (chromium) ──auth.setup.ts (real Clerk login)──▶ /settings (SSR page)
       │
       ▼
  ver-05-settings.spec.ts (extended) ──drives──▶ model-settings-form.tsx (CR-01/CR-02 fixed)
       │                                              │
       └── asserts 4-provider selector, Zen/Go        └── calls saveSettingsAction (Server Action,
           captions, Hermes captions, badges               UNCHANGED validated order)
```

### Recommended Project Structure (new files only)
```
src/lib/agents/
├── openrouter-only-chain.test.ts       # existing — D-27-02 root-cause finding documented here or in VERIFICATION.md
├── nousresearch-only-chain.test.ts     # NEW — mirrors openrouter-only-chain.test.ts exactly (D-27-04)
├── opencode-only-chain.test.ts         # NEW — mirrors openrouter-only-chain.test.ts exactly (D-27-04)
├── structured-outputs-probe.test.ts    # NEW (or 3 files) — RUN-06 live flip probe (D-27-05..08)
scripts/
├── probe-openrouter-only.ts            # existing — pattern to mirror
├── probe-nousresearch-only.ts          # NEW — same shape, NousResearch-only settings
├── probe-opencode-only.ts              # NEW — same shape, OpenCode-only settings (pick a Zen or Go id)
e2e/
├── ver-05-settings.spec.ts             # EXTENDED — 4-provider selector, Zen/Go + Hermes captions, badges (D-27-09/10)
src/lib/verification/
├── security-grep.test.ts               # EXTENDED — NOUSRESEARCH/OPENCODE tokens added to scan + ALLOWED set (D-27-13 pattern)
src/components/settings/
├── model-settings-form.tsx             # FIXED — CR-01 (gate "Saved." on lastSaved equality) + CR-02 (try/catch) (D-27-11)
```

### Pattern 1: Child-env single-provider isolation test (VER-03, D-27-04)
**What:** A Vitest test that `spawnSync`s a tsx child process with ONE provider's key present and all others explicitly emptied in a cloned `childEnv` object (parent `process.env` never mutated), asserting the spawned probe's JSON-stdout shape (`{ ok, modelUsed, modelChain }`).
**When to use:** Proving a single-provider chain runs to completion using ONLY that provider's key — this is the ONLY way to prove key isolation without ever weakening a developer's local shell env.
**Example (the exact pattern to mirror, from `src/lib/agents/openrouter-only-chain.test.ts`):**
```typescript
// Source: src/lib/agents/openrouter-only-chain.test.ts (read this session, lines 1-33)
const hasLiveKeys =
  !!process.env.NOUSRESEARCH_API_KEY && !!process.env.FIRECRAWL_API_KEY && !!process.env.DATABASE_URL;

describe.skipIf(!hasLiveKeys)('VER-03 nousresearch-only chain (child-env, real keys)', () => {
  it(
    'runs analyzeCompany with ANTHROPIC/OPENROUTER/OPENCODE_API_KEY unset in the child env',
    { timeout: 120_000 },
    () => {
      const childEnv = {
        ...process.env,
        ANTHROPIC_API_KEY: '',
        OPENROUTER_API_KEY: '',
        OPENCODE_API_KEY: '',
      };
      const result = spawnSync(process.execPath, [require.resolve('tsx/cli'), 'scripts/probe-nousresearch-only.ts'], {
        env: childEnv,
        encoding: 'utf-8',
        timeout: 110_000,
      });
      expect(result.status, result.stderr).toBe(0);
      const out = JSON.parse(result.stdout);
      expect(out.ok).toBe(true);
      expect(out.modelUsed).toBe('nousresearch/hermes-4-70b');
    },
  );
});
```
**Important correction to the existing precedent:** the current `openrouter-only-chain.test.ts` only strips `ANTHROPIC_API_KEY`, not `NOUSRESEARCH_API_KEY`/`OPENCODE_API_KEY` (those didn't exist when it was written in Phase 22). For genuine single-key isolation proof in a 4-provider world, the two NEW tests must strip **all 3 other provider keys**, not just one — otherwise the isolation claim is weaker than it looks (a NousResearch-only test that leaves `OPENROUTER_API_KEY` set doesn't actually prove NousResearch-only capability, it just proves NousResearch is reachable). This is a genuine gap in the precedent the planner should close, not copy forward.

### Pattern 2: Per-instance capability flag flip via live probe (RUN-06, D-27-05..08)
**What:** A `skipIf(!hasLiveKeys)` Vitest test that calls `generateText` with the exact production `Output.object({ schema: outputSchema })` call from `runAgent.ts:74` against each of the 3 raw model instances, forcing `supportsStructuredOutputs: true` at the call site to see if the provider genuinely honors `json_schema` mode. If it round-trips without error and produces schema-valid output, the constructor-level flag flips permanently for that instance.
**When to use:** Verifying a per-provider capability claim that can only be confirmed by a real request/response round trip (no static analysis can tell you if an OpenAI-compatible endpoint truly supports `response_format: {type: "json_schema"}` vs. silently downgrading).
**Example (constructor-level flip target, in `src/lib/agents/modelFactory.ts`):**
```typescript
// Source: src/lib/agents/modelFactory.ts (read this session, lines 34-38) — CURRENT (all false/unset):
const nousresearch = createOpenAICompatible({
  name: 'nousresearch',
  apiKey: process.env.NOUSRESEARCH_API_KEY,
  baseURL: 'https://inference-api.nousresearch.com/v1',
});

// AFTER a passing live probe (D-27-05/06 — per-instance, independent):
const nousresearch = createOpenAICompatible({
  name: 'nousresearch',
  apiKey: process.env.NOUSRESEARCH_API_KEY,
  baseURL: 'https://inference-api.nousresearch.com/v1',
  supportsStructuredOutputs: true, // RUN-06: flipped after a passing live json_schema probe (Phase 27)
});
```
**Verified option shape [VERIFIED: @ai-sdk/openai-compatible dist/index.d.ts]:** `supportsStructuredOutputs?: boolean` exists BOTH as a `createOpenAICompatible(...)` constructor option (`dist/index.d.ts:87`) and as a per-call chat-model settings option (`dist/index.d.ts:358`, the second-argument form `provider(modelId, settings)`). Because each of the 3 instances (`nousresearch`, `openaiCompatibleZen`, `openaiCompatibleGo`) is already a per-provider module singleton (D-25-01), setting the flag at the CONSTRUCTOR is the correct and simplest per-instance flip — it does not require touching the `instantiateModel` dispatch function's call sites at all. This is a different option NAME and SHAPE than OpenRouter's own flip (`openrouter(id, { structuredOutputs: { strict: false } })`, a nested object, opt-OUT semantics) — do not conflate the two; they are different SDKs with different capability-flag conventions.
**Probe target schema [VERIFIED: src/lib/agents/types.ts + runAgent.ts:74]:** the real production schema is `outputSchema` from `src/lib/agents/types.ts` (`{ proposals: ProposalSignal[], keyUncertainties: string[], evidenceAppendix: EvidenceAppendixEntry[] }`, where `ProposalSignal` has 8 fields including 2 enums and a URL). The probe must exercise this exact schema (via `Output.object({ schema: outputSchema })`, `runAgent.ts:74`) — a toy schema would not prove the real path works.

### Pattern 3: Security-matrix grep extension (VER-04, D-27-13 style additive change)
**What:** Two-line-per-provider addition to an existing allowlist-and-scan Vitest test — no new test blocks needed, the existing 5 `it()` blocks already generalize.
**When to use:** Extending an existing "no key-name leakage" gate to cover 2 more key names.
**Example:**
```typescript
// Source: src/lib/verification/security-grep.test.ts (read this session, lines 10-15)
// CURRENT:
const ALLOWED = new Set(['lib/env.ts', 'lib/agents/modelFactory.ts', 'lib/agents/analyzeCompany.ts']);
// Every occurrence of 'OPENROUTER' is scanned for; ALLOWED files may mention OPENROUTER_API_KEY.

// EXTENSION NEEDED (D-27, VER-04): modelFactory.ts already reads process.env.NOUSRESEARCH_API_KEY
// and process.env.OPENCODE_API_KEY DIRECTLY (bypassing lib/env.ts) — confirmed this session,
// modelFactory.ts:36,41,46,51,55. It is ALREADY in ALLOWED for the OPENROUTER token; it needs to
// ALSO be exempt for the NOUSRESEARCH/OPENCODE tokens (it's the same file, same exemption rationale).
// The scan target strings 'OPENROUTER' throughout the test file's it() blocks need parallel
// 'NOUSRESEARCH' and 'OPENCODE' checks (either as 2 new literal strings per it(), or refactored to
// loop over an array of the 3 new-provider key-name substrings — planner's discretion, D-27-13 style
// "audit + minimal addition", NOT a rewrite).
```
**Non-vacuous canary requirement:** the existing canary tests (`security-grep.test.ts:62-80`) assert the ALLOWED/SERVER_COMPONENT sets genuinely DO contain the scanned token, proving the gate isn't vacuously passing. Any new NOUSRESEARCH/OPENCODE scan MUST get its own canary assertion (confirm `modelFactory.ts` genuinely contains `NOUSRESEARCH_API_KEY` and `OPENCODE_API_KEY` literal strings) — skipping this would silently reintroduce Pitfall 6 (a token-rename disabling the gate without anyone noticing) for the 2 new tokens.

### Pattern 4: Live-key skip guard convention (all VER-02/03/RUN-06 tests)
**What:** `hasLiveKeys` boolean computed from `!!process.env.X && !!process.env.FIRECRAWL_API_KEY && !!process.env.DATABASE_URL`, feeding `describe.skipIf(!hasLiveKeys)` (Vitest) or `test.skip(!hasLiveKeys, 'reason')` (Playwright).
**When to use:** Every new live-key test this phase adds — CI-safe by construction, never fails in an environment without credentials.
**Verified in this session:** all 4 target keys (`ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`, `NOUSRESEARCH_API_KEY`, `OPENCODE_API_KEY`) plus `FIRECRAWL_API_KEY` are non-empty in `.env.local` — the new tests will NOT skip in this dev environment; they will actually execute.

### Anti-Patterns to Avoid
- **Weakening an assertion to force a green run:** if the OpenRouter billing wall persists, do NOT loosen `openrouter-only-chain.test.ts`'s assertions or delete it — leave it failing-and-documented exactly as Phase 22 did (`22-VERIFICATION.md`'s "never falsely green" discipline). The correct Phase 27 action is a `27-VERIFICATION.md` entry, not a code change.
- **Conflating the two SDKs' structured-output option shapes:** `openrouter(id, { structuredOutputs: { strict: false } })` (nested object, opt-out) vs. `createOpenAICompatible({ ..., supportsStructuredOutputs: true })` (flat boolean, opt-in, constructor-level) are NOT the same shape — copying one pattern into the other SDK's call site will not compile correctly or will silently no-op.
- **Isolation tests that only strip one other key:** per Pattern 1 above, a genuine "NousResearch-only" or "OpenCode-only" proof in a 4-provider world must strip all 3 OTHER provider keys in the child env, not just one — otherwise the test doesn't actually prove what its name claims.
- **Rewriting the 16-cell `shouldAdvance` matrix or the hermes/opencode collision canaries:** both already exist and are already provider-agnostic (`SERVABLE_PROVIDERS` array-driven, confirmed this session — `modelConfig.test.ts:156-180` iterates `SERVABLE_PROVIDERS` which already has all 4 providers). VER-01 is audit-only per D-27-12; there is nothing to widen here, only to confirm.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Real browser + real auth E2E | A custom headless-browser harness or cookie-injection stub | The already-installed `@playwright/test` + `@clerk/testing` + existing `e2e/auth.setup.ts`/`playwright.config.ts` | D-22-04/05 already made and justified this choice; reusing it is strictly correct, building anything new here would be pure regression |
| Child-process env isolation | Manually forking with `child_process.fork` and IPC | `spawnSync` + a cloned `{ ...process.env, KEY: '' }` object, exactly as `openrouter-only-chain.test.ts` already does | Simpler, synchronous (matches Vitest's `it()` contract), and the existing precedent is proven to work |
| Structured-output capability detection | A custom schema-validation retry wrapper around raw fetch | The AI SDK's own `Output.object({ schema })` + the provider's native `supportsStructuredOutputs` flag | The SDK already handles the JSON-mode-vs-json_schema-mode branching; hand-rolling would duplicate SDK internals and drift from `ai@7`'s actual behavior |
| Key-leak scanning | A regex-based bundler/webpack-plugin scan | The existing source-level `readFileSync` + string-scan Vitest test (`security-grep.test.ts`) | Deliberately scoped to source, not build artifacts, per D-22-07's explicit deferral of bundle-scanning — extending scope here would be out-of-phase invention |

**Key insight:** every "don't hand-roll" item in this phase already has a working, tested, in-repo implementation from Phase 22 or Phase 25. The discipline this phase requires is restraint — copy the pattern, widen the provider set, do not redesign.

## Runtime State Inventory

Not applicable — this phase touches no renames, refactors, or migrations. All new artifacts are new test files, a constructor-flag flip, a grep-scan extension, and two client-component bug fixes. No stored data, service config, OS-registered state, secrets, or build artifacts are being renamed or relocated.

## Common Pitfalls

### Pitfall 1: Treating the OpenRouter billing failure as something to "fix"
**What goes wrong:** Spending phase time trying to patch `modelFactory.ts`, `runAgent.ts`, or the classifier to make `openrouter-only-chain.test.ts` pass green.
**Why it happens:** The failure looks like a bug (`out.ok: false` when it "should" be `true`) and the CONTEXT.md explicitly assigns root-cause investigation as phase work, which can be misread as "and then fix it."
**How to avoid:** The investigation is now DONE (this research pass) — the cause is a genuinely-empty OpenRouter account balance (`is_free_tier: true`, `limit: null`, confirmed live via the `/api/v1/key` endpoint this session), not a code defect. There is no code fix. Document the finding, leave the test red-and-explained (matching Phase 22's own disposition of the identical condition), and move on.
**Warning signs:** Any task description that says "fix `openrouter-only-chain.test.ts`" rather than "investigate and document the cause of the failure."

### Pitfall 2: Isolation tests that don't isolate
**What goes wrong:** A "NousResearch-only" test that only strips `ANTHROPIC_API_KEY` (copying `openrouter-only-chain.test.ts` verbatim) while `OPENROUTER_API_KEY` and `OPENCODE_API_KEY` remain set in the child env — the test would still pass even if `resolveModelChain`/`missingProviderKey` had a latent bug that let a different provider's key satisfy the gate.
**Why it happens:** Direct copy-paste of the 2-provider-era precedent without accounting for the 2 new providers that now also need stripping.
**How to avoid:** Each new isolation test's `childEnv` must explicitly empty ALL 3 other provider keys, not just one. See Pattern 1 above for the corrected shape.
**Warning signs:** A childEnv object with only one `KEY: ''` override in a codebase that now has 4 providers.

### Pitfall 3: Flipping `supportsStructuredOutputs` at the wrong layer
**What goes wrong:** Adding `supportsStructuredOutputs: true` as a second argument to individual `nousresearch(id)` / `openaiCompatibleZen(id)` / `openaiCompatibleGo(id)` calls inside `instantiateModel` instead of at the `createOpenAICompatible(...)` constructor.
**Why it happens:** The OpenRouter precedent in the SAME file (`modelFactory.ts:112-114`) does exactly this pattern (per-call option based on a snapshot row flag) — it's easy to assume the same shape applies here.
**How to avoid:** OpenRouter's per-call flag exists because ONE `openrouter` instance serves ALL OpenRouter models with heterogeneous per-model capability (from the snapshot). The 3 openai-compatible instances are already 1:1 with a fixed endpoint (nousresearch / zen / go) — there's no per-model heterogeneity to encode, so the constructor-level flag (set once, D-25-01 module-singleton pattern) is correct and simpler. Per-call would work too but is unnecessary indirection.
**Warning signs:** A diff that touches `instantiateModel`'s dispatch function when the actual target is the 3 constructor calls above it.

### Pitfall 4: CR-01's fix silently reintroducing WR-01's exemption bug
**What goes wrong:** Fixing CR-01 (gate the top-level "Saved." message on `lastSaved` equality) by touching the `markDirty()` function's `'saving'`-exemption logic, accidentally breaking the WR-01 fix that exemption exists to protect (a just-started save being relabeled `'idle'` by a concurrent edit).
**Why it happens:** CR-01 and the `markDirty` `'saving'`-exemption comment are adjacent and thematically connected (both about save-in-flight state), tempting a combined fix.
**How to avoid:** `26-REVIEW.md`'s own suggested fix for CR-01 is scoped ONLY to the render-gate on the "Saved." `<p>` tag (adding the same `lastSaved`-equality check the "Saved chain" recap sub-line already uses) — it does NOT touch `markDirty`. Keep the two concerns separate; `markDirty`'s exemption is correct as-is and unrelated to CR-01's actual bug (the top-level message rendering unconditionally on `status === 'saved'`).
**Warning signs:** A CR-01 diff that modifies `markDirty()` rather than the `status === 'saved'` JSX branch.

### Pitfall 5: Missing the try/catch's interaction with `startTransition`
**What goes wrong:** Wrapping `saveSettingsAction(...)` in a `try/catch` OUTSIDE the `startTransition(async () => {...})` callback instead of inside it — `startTransition`'s callback function itself is what needs the try/catch, since that's where the awaited promise lives.
**Why it happens:** `handleSave`'s outer function body is synchronous (`setStatus('saving'); startTransition(...)`) — a try/catch wrapped around the whole function body would never catch the async rejection inside the transition callback.
**How to avoid:** `26-REVIEW.md`'s CR-02 fix snippet (already read this session) wraps the try/catch INSIDE the `startTransition` arrow function, around the `await saveSettingsAction(...)` call and its `if/else` branches — follow that exact placement.
**Warning signs:** A `try` keyword appearing before `startTransition(` rather than as the first statement inside its callback.

### Pitfall 6: Forgetting Server Action validated-order lock when touching `settings.ts`
**What goes wrong:** Any temptation to "also fix" something in `saveSettingsAction` while working on CR-01/CR-02 (which live entirely client-side in `model-settings-form.tsx`).
**Why it happens:** CR-01/CR-02 are about the save flow, and `settings.ts` is the other half of that flow — proximity invites scope creep.
**How to avoid:** `settings.ts` was verified byte-identical since Phase 23 (`git diff` empty per STATE.md's Phase 23 log) and the validated order (`requireStaffAccess` → zod → union servable check → dedupe → upsert, confirmed by reading the file this session) is explicitly locked by D-27-11's discretion note. CR-01/CR-02 are 100% client-side fixes; `settings.ts` needs zero changes.
**Warning signs:** Any diff touching `src/app/actions/settings.ts` in a plan whose stated goal is CR-01/CR-02.

## Code Examples

### The exact live-key skip guard shape (verified working this session)
```typescript
// Source: src/lib/agents/openrouter-only-chain.test.ts:8-9 (existing, read this session)
const hasLiveKeys =
  !!process.env.OPENROUTER_API_KEY && !!process.env.FIRECRAWL_API_KEY && !!process.env.DATABASE_URL;
// For the 2 NEW providers, swap the first conjunct:
//   !!process.env.NOUSRESEARCH_API_KEY && ... (nousresearch test)
//   !!process.env.OPENCODE_API_KEY && ...      (opencode test)
```

### The exact probe script skeleton to mirror (verified working this session — I ran an instrumented copy)
```typescript
// Source: scripts/probe-openrouter-only.ts (read + executed a debug variant this session)
// Structural shape confirmed correct end-to-end: dotenv .env.local load → dynamic imports
// (AFTER dotenv, so env.ts's module-eval-time zod parse sees the loaded vars) → resolve
// Clerk test user by E2E_CLERK_USER_EMAIL → resolve seeded company BY NAME ('Acme Test Co',
// confirmed present in data/seed/companies.csv:2) → stamp synthetic *.test domain → upsert
// single-provider-only settings → call analyzeCompany → print ONLY { ok, modelUsed, modelChain }
// as JSON (never env values). For NousResearch: primaryModel: 'nousresearch/hermes-4-70b'.
// For OpenCode: primaryModel must be an opencode-servable id — OPENCODE_DEFAULT_MODEL_ID
// ('claude-sonnet-4-6') is the safest choice since it's already the documented default.
```

### The OpenRouter billing root-cause, reproduced live this session
```
$ npx vitest run src/lib/agents/openrouter-only-chain.test.ts
 FAIL  ... AssertionError: expected false to be true
   expect(out.ok).toBe(true);   // actual: false

# Instrumented the probe to print the FULL AnalyzeResult (not just the ok/modelUsed/modelChain
# subset the real probe deliberately restricts stdout to):
FULL RESULT: { "ok": false, "reason": "billing", "message": "provider credits exhausted" }

# Confirmed via a direct call to OpenRouter's own key-status endpoint:
$ curl -H "Authorization: Bearer $OPENROUTER_API_KEY" https://openrouter.ai/api/v1/key
{ "data": { "limit": null, "is_free_tier": true, "usage": 0.000110016, ... } }
# is_free_tier: true + limit: null == the account has never been credited. This is the
# IDENTICAL condition Phase 22 documented (22-VERIFICATION.md line 41-42, STATE.md line 212)
# as "pending-credit" — not a new regression.
```

### Live connectivity proof for the 2 new providers (verified this session — de-risks D-27-01)
```
$ curl -H "Authorization: Bearer $NOUSRESEARCH_API_KEY" https://inference-api.nousresearch.com/v1/models
→ HTTP 200, valid model list (qwen/qwen3.8-max, ...)
$ curl -H "Authorization: Bearer $OPENCODE_API_KEY" https://opencode.ai/zen/v1/models
→ HTTP 200, valid model list (claude-fable-5, claude-opus-5, ...)
$ curl -H "Authorization: Bearer $OPENCODE_API_KEY" https://opencode.ai/zen/go/v1/models
→ HTTP 200, valid model list (minimax-m3, minimax-m2.7, ...) — CONFIRMS Zen and Go are
  genuinely distinct endpoints (different model rosters) despite sharing one API key.
```
Both keys authenticate successfully. Whether they are CREDITED for real chat-completion spend (as opposed to the free `/models` list endpoint) is not something a `/models` call can confirm — the phase's actual live Analyze/probe tasks are the real test of that, and should be executed with the same "never falsely green, document pending-credit if it happens" discipline Phase 22 established, in case one of them turns out to have the same free-tier limitation.

## State of the Art

| Old Approach (Phase 22, 2 providers) | Current Approach (Phase 27, 4 providers) | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `SERVABLE_PROVIDERS = ['anthropic', 'openrouter']` | `SERVABLE_PROVIDERS = ['anthropic', 'openrouter', 'nousresearch', 'opencode']` | Phase 23 (D-23-01) | The 16-cell `shouldAdvance` matrix and every `SERVABLE_PROVIDERS`-driven test ALREADY iterates all 4 — confirmed this session by reading `modelConfig.test.ts:156-180`. VER-01's audit has genuinely little left to find. |
| 2-file `hasLiveKeys` isolation test (OpenRouter only) | Needs 2 more sibling files, each stripping all 3 OTHER keys (see Pitfall 2) | This phase | Widens the isolation-proof surface; also an opportunity to retroactively note the existing OpenRouter test's narrower-than-ideal strip scope |
| `supportsStructuredOutputs` unset (false by default) on all 3 openai-compatible instances | Per-instance flip to `true` gated on a live probe | This phase (RUN-06 completion, deferred from Phase 25 D-25-03) | First real behavioral change this phase makes to production code (everything else is test-only or client-bugfix) |

**Deprecated/outdated:** Nothing in this domain is deprecated — Phase 22's patterns are all still current AI SDK v7 / Playwright v1.62 idioms, verified against the actually-installed `node_modules` this session (not training-data recall).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `OPENCODE_DEFAULT_MODEL_ID` (`'claude-sonnet-4-6'`) is a safe/servable choice for the OpenCode-only isolation probe's `primaryModel` | Code Examples, Pattern 1 | Low — this is already the exported, catalog-verified default (`modelFactory.ts:77`, D-23-03); if wrong, the probe would fail loudly with a clear `invalid_model`/not-servable error, easy to diagnose |
| A2 | The `/v1/models` HTTP 200 responses for NousResearch/OpenCode Zen/Go prove the KEYS authenticate, but do NOT prove the account has enough credit balance for a real chat-completion call | Summary, Code Examples | Medium — if either key turns out to also be free-tier/uncredited (like OpenRouter), VER-02/VER-03's live proof for that provider would hit the same billing wall Pitfall 1 describes; the phase's execution should budget time to discover and document this per-provider, not assume both are fully funded based on the `/models` check alone |
| A3 | Setting `supportsStructuredOutputs: true` at the `createOpenAICompatible(...)` constructor (rather than per-call) is functionally equivalent for this codebase's usage pattern | Pattern 2, Pitfall 3 | Low — verified via the SDK's own `.d.ts` that both surfaces exist and are documented with the same semantics ("whether the model/provider supports structured outputs"); since each instance is a fixed single-endpoint singleton (no per-model heterogeneity within an instance), there is no scenario in this codebase where per-call vs. constructor-level would diverge in behavior |

**If this table is empty:** N/A — see entries above. All three carry LOW-to-MEDIUM risk and none block planning; A2 is the one worth an explicit phase task ("check credit/billing status for NOUSRESEARCH_API_KEY and OPENCODE_API_KEY before assuming the live E2E will produce a clean 201, not another pending-credit 402").

## Open Questions

1. **Are `NOUSRESEARCH_API_KEY` and `OPENCODE_API_KEY` actually credited for real chat-completion spend?**
   - What we know: both keys authenticate successfully against their `/v1/models` list endpoints (HTTP 200, verified this session).
   - What's unclear: whether a real `generateText`/chat-completion call against them will succeed or hit the same `billing`/402 wall that blocks the OpenRouter re-proof. NousResearch and OpenCode are different billing systems from OpenRouter, so there's no reason to assume the SAME failure, but there's also no direct evidence of a successful paid call in this session (I deliberately avoided spending real money during research).
   - Recommendation: the phase's first live-probe task (whichever isolation test or structuredOutputs probe runs first) will resolve this immediately and cheaply. If either turns out uncredited, follow the exact Phase 22/this-phase precedent: document as pending-credit in `27-VERIFICATION.md`, never force a fix, never weaken the assertion.

2. **Should the corrected "strip all 3 other keys" isolation pattern (Pitfall 2) also be retrofitted onto the existing `openrouter-only-chain.test.ts`?**
   - What we know: the existing test only strips `ANTHROPIC_API_KEY`; `NOUSRESEARCH_API_KEY`/`OPENCODE_API_KEY` are live in that test's child env too (harmless today since OpenRouter fails on billing before ever touching another provider, but not a rigorous isolation proof).
   - What's unclear: whether this is in-scope "verification gate work" (arguably yes, closing a real coverage gap) or scope creep beyond D-27-04's stated boundary (which only mandates the 2 NEW tests).
   - Recommendation: flag for planner discretion — low cost to fix (one line), genuinely improves rigor, but not explicitly locked by any D-27 decision. Could go either way without contradicting CONTEXT.md.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `ANTHROPIC_API_KEY` | Existing anthropic chain (not re-proven this phase, D-27-01) | ✓ | — (non-empty in `.env.local`, verified) | — |
| `OPENROUTER_API_KEY` | VER-02/03 OpenRouter re-proof (not required this phase per D-27-01, but the pre-existing test still runs) | ✓ (present) / ✗ (functionally, `is_free_tier: true`, uncredited) | — | Document as pending-credit (Phase 22 precedent); do not block phase completion on it |
| `NOUSRESEARCH_API_KEY` | VER-02/03 live proof (new, in-scope) | ✓ (authenticates, `/v1/models` 200) | — | Credit status for real completions unconfirmed (Open Question 1) — if uncredited, same pending-credit disposition |
| `OPENCODE_API_KEY` | VER-02/03 live proof (new, in-scope) | ✓ (authenticates on BOTH Zen and Go base URLs, `/v1/models` 200 each) | — | Same as above |
| `FIRECRAWL_API_KEY` | Pre-run gate in `analyzeCompany.ts` (required regardless of model provider) | ✓ | — | — |
| `DATABASE_URL` | Seeded test company lookup, `agent_run` read-back | ✓ | — | — |
| `E2E_CLERK_USER_EMAIL` / `CLERK_SECRET_KEY` | Playwright real-auth setup + probe scripts' Clerk user resolution | ✓ (used successfully by existing Phase 22 probe pattern) | — | — |
| Dev server (`npm run dev`) | Playwright `webServer` auto-start (`playwright.config.ts`) | ✓ (already configured, `reuseExistingServer: !CI`) | — | — |
| Seeded company row `'Acme Test Co'` | VER-02/03 probes' by-name lookup (D-27-03 reuse) | ✓ (present in `data/seed/companies.csv:2`) | — | Re-run `npm run seed` if missing |

**Missing dependencies with no fallback:** None identified.

**Missing dependencies with fallback:** OpenRouter live-proof credit (has a documented fallback: pending-credit disposition, matching Phase 22).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.10 (unit/integration) + `@playwright/test` ^1.62.1 (browser E2E) |
| Config file | `vitest.config.ts` (node env, `src/**/*.test.ts`, `@` alias) / `playwright.config.ts` (webServer auto-start, serial workers, auth-setup dependency) |
| Quick run command | `npx vitest run src/lib/agents/<new-test-file>.test.ts` |
| Full suite command | `npm test` (Vitest) + `npx playwright test` (E2E, requires dev server) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VER-01 | 4-provider collision + 16-cell 429 hop matrix audit | unit | `npx vitest run src/lib/models/catalog.test.ts src/lib/agents/modelConfig.test.ts` | ✅ (existing, confirmed already 4-provider-complete this session) |
| VER-02 | NousResearch/OpenCode Analyze round trip, `model_used` matches saved id | integration (child-env probe or Playwright live spec) | `npx tsx scripts/probe-nousresearch-only.ts` / `npx tsx scripts/probe-opencode-only.ts` | ❌ Wave 0 — new files, mirror `probe-openrouter-only.ts` |
| VER-03 | NousResearch-only / OpenCode-only chain runs with only that key | integration | `npx vitest run src/lib/agents/nousresearch-only-chain.test.ts src/lib/agents/opencode-only-chain.test.ts` | ❌ Wave 0 — new files, mirror `openrouter-only-chain.test.ts` (with the Pitfall 2 fix) |
| VER-04 | Security-matrix grep extended for NOUSRESEARCH/OPENCODE | unit | `npx vitest run src/lib/verification/security-grep.test.ts` | ✅ exists — needs additive extension, not a new file |
| VER-05 | 4-provider selector, Zen/Go/Hermes captions, badge disambiguation (browser) | e2e | `npx playwright test e2e/ver-05-settings.spec.ts` | ✅ exists — needs additive extension closing 4 `26-HUMAN-UAT.md` items |
| RUN-06 (folded into VER-05) | Live `json_schema` probe gates `supportsStructuredOutputs` flip | integration | `npx vitest run src/lib/agents/structured-outputs-probe.test.ts` (or 3 files) | ❌ Wave 0 — new file(s), no existing precedent (first-of-its-kind for this repo) |
| — | CR-01 fix (save-in-flight race) | unit/manual | Existing `model-picker-logic.test.ts` pattern could gain a targeted React-state test, OR verified via the extended Playwright spec's save-flow assertions | Covered transitively by VER-05's Playwright extension if it exercises a mid-save edit; otherwise a manual/unit gap |
| — | CR-02 fix (missing try/catch) | unit | No existing unit test simulates a transport-level rejection of a Server Action; consider a lightweight mock-rejection test, or accept code-review-level verification (no live network failure simulation exists in this codebase's test infra) | ❌ Wave 0 gap — see below |

### Sampling Rate
- **Per task commit:** targeted file-scoped `npx vitest run <file>`
- **Per wave merge:** full `npm test` + (if Playwright/UI touched) `npx playwright test`
- **Phase gate:** Full suite green before `/gsd-verify-work`, EXCEPT the pre-existing `openrouter-only-chain.test.ts` billing failure, which must be documented (not silenced) per Pitfall 1

### Wave 0 Gaps
- [ ] `src/lib/agents/nousresearch-only-chain.test.ts` — covers VER-03 (NousResearch)
- [ ] `src/lib/agents/opencode-only-chain.test.ts` — covers VER-03 (OpenCode)
- [ ] `scripts/probe-nousresearch-only.ts` — companion child-process probe for the above
- [ ] `scripts/probe-opencode-only.ts` — companion child-process probe for the above
- [ ] `src/lib/agents/structured-outputs-probe.test.ts` (or 3 sibling files) — covers RUN-06's live flip gate; no existing test shape to extend, this is genuinely new test infrastructure (first live `Output.object` round-trip test in the repo)
- [ ] A CR-02 regression test is a genuine infra gap: this codebase has no established pattern for simulating a rejected/failed Server Action call from a client test (neither Vitest component tests — none exist per `22-RESEARCH.md`'s "no component test infra" note — nor a Playwright network-interception precedent). Recommend either (a) accept code-review-level verification for CR-02 without an automated regression test, matching the codebase's current test-infra ceiling, or (b) add a minimal Playwright `page.route()` interception on the Server Action's POST to force a rejection — genuinely new E2E infra, planner's call on cost/benefit.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | yes | Reused unchanged — real Clerk session via `@clerk/testing`'s `clerk.signIn`, `requireStaffAccess()` gate on every Server Action/page (unchanged this phase) |
| V3 Session Management | yes | Clerk-managed `__session` cookie, unchanged; Playwright's `storageState` reuse is the ONLY new-ish session-adjacent surface, and it's Phase 22 precedent, not new |
| V4 Access Control | yes | `requireStaffAccess()` remains the sole gate; `settings.ts`'s validated order (confirmed unchanged this session) keeps it FIRST |
| V5 Input Validation | yes | `zod` schema (`settingsInputSchema`) unchanged; union-servable-id check unchanged; this phase adds NO new user-input surface |
| V6 Cryptography | no | No cryptographic operations in scope this phase |
| V13/V14 (config/secrets) | yes | The security-matrix grep (VER-04) IS this ASVS category's control for this codebase — extending it to 2 more key names is the primary security-relevant deliverable of the phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Server-only API key (`NOUSRESEARCH_API_KEY`/`OPENCODE_API_KEY`) leaking into a client bundle or Server Action return value | Information Disclosure | The extended `security-grep.test.ts` scan (VER-04) — source-level string-match against `'use client'` files, `src/components/`, and `app/actions/` returns, exactly as already proven for `OPENROUTER` |
| A false "Saved." confirmation (CR-01) causing a user to believe unsaved data was persisted | Repudiation-adjacent (data-trust, not a classic STRIDE security bug, but explicitly named a "data-trust issue" in `26-REVIEW.md`) | Gate the confirmation render on `lastSaved` draft-equality, per the CR-01 fix already specified |
| Unhandled promise rejection from a Server Action transport failure (CR-02) | Denial of Service (localized: the form becomes permanently unusable until page reload) | `try/catch` inside the `startTransition` callback, per the CR-02 fix already specified |
| Live-key test leaking key material to stdout/logs | Information Disclosure | Already-established convention: probe scripts print ONLY `{ ok, modelUsed, modelChain }`, never env values — confirmed in `probe-openrouter-only.ts`'s explicit comment and code; the 2 new probe scripts must follow the identical convention |

## Sources

### Primary (HIGH confidence — code read directly this session)
- `src/lib/agents/openrouter-only-chain.test.ts` — full file read; failure reproduced via `npx vitest run`
- `src/lib/agents/modelFactory.ts` — full file read; `supportsStructuredOutputs` flip target confirmed
- `src/lib/agents/analyzeCompany.ts` — full file read; `missingProviderKey`, `AnalyzeResult` shape confirmed
- `src/lib/agents/runAgent.ts` — full file read; `Output.object` call site (line 74) confirmed
- `scripts/probe-openrouter-only.ts` — full file read; executed an instrumented debug variant this session
- `src/lib/verification/security-grep.test.ts` — full file read; `ALLOWED` set + scan patterns confirmed
- `e2e/ver-05-settings.spec.ts` — full file read; 4 existing test blocks + `26-HUMAN-UAT.md` item mapping confirmed
- `src/components/settings/model-settings-form.tsx` — full file read; `handleSave`/`markDirty` exact lines confirmed
- `src/app/actions/settings.ts` — full file read; validated order confirmed
- `.planning/phases/26-settings-ui/26-REVIEW.md` — full file read; CR-01/CR-02 exact repro + fix snippets confirmed
- `.planning/phases/26-settings-ui/26-HUMAN-UAT.md` — full file read; 4 pending items confirmed
- `.planning/milestones/v1.4-phases/22-verification-gate/22-CONTEXT.md`, `22-VERIFICATION.md`, `22-05-SUMMARY.md` — full/partial reads; VER-02 pattern + billing precedent confirmed
- `e2e/ver-02-analyze.spec.ts`, `e2e/auth.setup.ts`, `playwright.config.ts` — full file reads; live E2E + auth harness pattern confirmed
- `node_modules/@ai-sdk/openai-compatible/dist/index.d.ts` — read directly; `supportsStructuredOutputs` option shape at both constructor (line 87) and per-call (line 358) levels confirmed
- `src/lib/agents/types.ts` — full file read; `outputSchema` (RUN-06 probe target) confirmed
- `src/lib/env.ts` — grep-confirmed `NOUSRESEARCH_API_KEY`/`OPENCODE_API_KEY` declared `.optional()`
- Live commands executed this session: `npx vitest run src/lib/agents/openrouter-only-chain.test.ts` (reproduced failure), an instrumented probe script run with `ANTHROPIC_API_KEY=` (revealed `reason: 'billing'`), `curl https://openrouter.ai/api/v1/key` (confirmed uncredited), `curl` against NousResearch/OpenCode Zen/OpenCode Go `/v1/models` (confirmed all 3 keys authenticate)
- `.planning/STATE.md`, `.planning/REQUIREMENTS.md`, `.planning/phases/27-verification-gate/27-CONTEXT.md` — full reads

### Secondary (MEDIUM confidence)
- None — every claim in this document traces to a primary source read or command executed this session.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — nothing new installed, every tool version read directly from `package.json`
- Architecture: HIGH — every pattern mirrored is copied from code read in full this session, not recalled from training
- Pitfalls: HIGH — Pitfalls 1 and 2 are original findings from live investigation this session (not training-data recall); Pitfalls 3-6 are grounded in `26-REVIEW.md`'s own documented fix snippets and the SDK's `.d.ts`

**Research date:** 2026-08-04
**Valid until:** 14 days (fast-moving: live provider billing/credit status can change at any time; the OpenRouter finding in particular should be re-checked if this research is consulted more than a few days after 2026-08-04)
