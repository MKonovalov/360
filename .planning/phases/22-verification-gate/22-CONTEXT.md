# Phase 22: Verification Gate - Context

**Gathered:** 2026-08-03
**Status:** Ready for planning

<domain>
## Phase Boundary

The milestone's correctness claims are proven. This is the final phase of v1.4 — it does NOT build new features; it PROVES what Phases 19-21 shipped:
- **VER-01 (Vitest matrices):** collision resolution, the 4-cell 429 hop table, and the error taxonomy are locked by automated tests
- **VER-02 (E2E UAT):** a real OpenRouter primary saves in Settings → Analyze on a company → `agent_run.model_used` matches the saved OpenRouter slug
- **VER-03 (OpenRouter-only chain):** a chain containing only OpenRouter models runs with only `OPENROUTER_API_KEY` set (no Anthropic key required)
- **VER-04 (Security-matrix grep):** no OpenRouter key leakage — absent from client components / Server Action returns / `NEXT_PUBLIC_*`
- **VER-05 (Live-browser UAT):** provider-switch draft preservation, picker search/grouping, badge disambiguation, and no `~`/`:free` id savable-or-served outside its labels

**What this phase is NOT:** no new providers, no servable-set changes, no run-path changes, no Settings UI changes. Fixes discovered by this phase's proofs are handled as gap closure (per the established pattern), not as new scope. Any human UAT items surfaced by this phase's verification become HUMAN-UAT entries, not feature work.

</domain>

<decisions>
## Implementation Decisions

### End-to-End Proof Mode (VER-02/03)
- **D-22-01:** VER-02 runs as a **live real-key E2E run** — a real Analyze call against a seeded test company with a saved OpenRouter primary, asserting `agent_run.model_used` matches the saved OpenRouter slug. Uses real API credits (~cents). This is the strongest proof and matches the milestone claim literally.
- **D-22-02:** VER-02 targets a **seeded test company** (deterministic, known test-domain company), not an arbitrary production row. Outcome is reproducible regardless of which company rows exist in the DB.
- **D-22-03:** VER-03 (OpenRouter-only chain, no Anthropic key) is proven via a **child-env integration test** — spawn `analyzeCompany` with `OPENROUTER_API_KEY` set and `ANTHROPIC_API_KEY` unset in a child environment, asserting the run succeeds. Automated, repeatable, structurally proves key isolation. (Does not require temporarily mutating the developer's real env.)

### Browser UAT Tooling (VER-05)
- **D-22-04:** **Add Playwright as a devDependency** and write a small e2e spec covering the three VER-05 behaviors (provider-switch draft preservation, picker search/grouping, badge disambiguation) against the dev server. This is a NEW dev tool — reusable for future phases and consistent with the "matrices lock" spirit of this phase. Includes browser download.
- **D-22-05:** The Playwright e2e authenticates via the **real Clerk hosted login flow** with a dedicated test staff account — a true end-to-end auth path. (Cookie injection stubs were rejected: they wouldn't prove the real auth gate.) The dedicated test account provisioning is an operational prerequisite for the executor.

### Matrix Scope (VER-01)
- **D-22-06:** VER-01 is **audit + fill gaps**, not rewrite-from-scratch. The existing matrices already lock most cells: the 4-cell hop table (`modelConfig.test.ts:135-146`), collision canaries (`catalog.test.ts:186-191`), and error classes (402/502/503 in `modelConfig.test.ts:56-77`). The planner/executor must verify each existing matrix covers every locked cell, add ONLY genuinely-missing cases (e.g. platform vs upstream 429 diagnostics split), and consolidate into a named verification-matrix test section. No blind rewrites, no redundant/conflicting assertions.

### Key Leak Gate (VER-04)
- **D-22-07:** The security-matrix grep is **codified as a Vitest test** — a test that scans client-component files (`'use client'`) + Server Action return shapes + `.env.example` + `NEXT_PUBLIC_*` usage, failing on any leak. Runs with every `npm test` — a permanent gate, no manual step.

### Claude's Discretion
- Exact Playwright spec file placement, test account setup mechanics, and whether the e2e spec is a single file or split.
- Where the named verification-matrix Vitest section lives (file placement and fixture style follow the existing `modelConfig.test.ts` / `runAgent.test.ts` D-16 conventions).
- The seeded test company's exact domain/identity (must be a test-domain, e.g. `*.test` or a synthetic domain that will never collide with real ICP data).
- Whether the child-env integration test (D-22-03) skips gracefully when `OPENROUTER_API_KEY` is absent in CI, and the exact skip guard.
- Whether VER-05's e2e spec gates on the dev server being up, or starts it itself.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone research (v1.4 — primary source of locked decisions)
- `.planning/research/SUMMARY.md` — §Phase 22 deliverables; locked product decisions (hop-aware 429 advance FAL-03; `~latest`/`:free` INCLUDED + labeled; OpenRouter default primary; picker grouping + Command search both P1; provider derived from catalog, no schema change REG-05).
- `.planning/research/PITFALLS.md` — Pitfall 3 (429 taxonomy, platform vs upstream split), Pitfall 5 (rate-limit helper scope), Pitfall 10 (336-row picker usability, draft preservation, dup-name disambiguation).

### Roadmap & requirements (locked scope)
- `.planning/ROADMAP.md` §Phase 22 — Goal, Depends on (Phases 19, 20, 21), Requirements (VER-01..05), Success Criteria (the 5 must-be-TRUE claims).
- `.planning/REQUIREMENTS.md` — v1.4 requirements VER-01..05 (full text).

### Project state & decision records
- `.planning/STATE.md` — v1.4 locked product decisions; Phase 20 decision log (D-20-05/06/07/08 — mid-stream 429 stays `'output'`, diagnostics-only helper, 4-cell matrix); Phase 21 decision log (D-21-* provider-switch/picker decisions).
- `.planning/PROJECT.md` — Key Decisions table (D-07, D-14, D-15 doctrine).

### Phase 19/20/21 artifacts (what this phase verifies)
- `.planning/phases/19-provider-registry-servable-model-source/19-VERIFICATION.md` + `19-SUMMARY.md` files — what Phase 19 claimed and proved (registry, servable source, collision canaries).
- `.planning/phases/20-cross-provider-run-path/20-VERIFICATION.md` + `20-SUMMARY.md` files — Phase 20 claims: classifier classes, 4-cell hop matrix, chain-aware env gate, audit columns.
- `.planning/phases/21-settings-ui/21-VERIFICATION.md` + `21-SUMMARY.md` files — Phase 21 claims (22/22 must-haves) + the deferred visual UAT note pointing at this phase (VER-05).
- `.planning/phases/21-settings-ui/21-REVIEW.md` — IN-02 (stale-primary badge guess) noted for Phase 22 UAT observation.

### Existing code (integration points + what the matrices must lock)
- `src/lib/models/catalog.ts` — `getServableIdsForProvider`, `getUnionServableIds`, `getProviderForModelId` (provider-identity source), `ANTHROPIC_ALLOWLIST`, `FAST_MODEL_ID`.
- `src/lib/models/catalog.json` — the committed snapshot (336 openrouter + 17 anthropic rows). Server-only.
- `src/lib/agents/modelConfig.ts` — `classifyModelError`, `isFailoverEligible`, `shouldAdvance`, `resolveModelChain` (the 4-cell matrix + error taxonomy live here).
- `src/lib/agents/modelFactory.ts` — `OPENROUTER_DEFAULT_MODEL_ID` + `PROVIDER_DEFAULT_MODELS` (D-07 per-provider defaults).
- `src/lib/agents/runAgent.ts` — the failover loop composing `(isFailoverEligible || rate_limited) && shouldAdvance`; `modelUsed`/`modelChain` audit population.
- `src/lib/agents/analyzeCompany.ts` — the run entry, chain-aware env gate, `missingProviderKey`.
- `src/app/actions/settings.ts` — `saveSettingsAction`: requireStaffAccess FIRST → zod → union servable check → dedupe → atomic upsert keyed by session userId.
- `src/app/api/companies/[id]/analyze/route.ts` — the analyze route + status map (not_configured→400, billing→402, rate_limited→429).
- `src/components/settings/model-settings-form.tsx` + `model-picker.tsx` + `model-picker-logic.ts` — the Settings UI the browser UAT exercises.
- Existing test files that already lock matrix cells: `src/lib/models/catalog.test.ts` (collision canaries), `src/lib/agents/modelConfig.test.ts` (4-cell table, error classes), `src/lib/agents/runAgent.test.ts` (429 hop behavior, D-16 conventions), `src/components/settings/model-picker-logic.test.ts` (31 tests).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Existing Vitest suite** (32 files / 366 tests, node-env): the matrix tests mostly exist — VER-01 is audit + targeted gap-fill, not greenfield.
- **`npx vitest run src/lib/models/catalog.test.ts src/lib/agents/modelFactory.test.ts src/lib/agents/modelConfig.test.ts src/app/actions/settings.test.ts`** — the targeted 4-file regression command used in prior phases.
- **Vitest config** (`vitest.config.ts`): `environment: 'node'`, `include: ['src/**/*.test.ts']`, `@` alias. A new security-grep test and the child-env test fit here unchanged.
- **`scripts/refresh-model-catalog.ts`** — precedent for standalone tsx scripts if a manual probe is ever needed (not the chosen path for VER-02/03).
- **Playwright is NOT installed** — D-22-04 adds it as a devDependency (new).

### Established Patterns
- **node-env Vitest only** — no component test infra (VALIDATION.md §Wave 0 constraint). VER-05's browser proof is therefore a NEW Playwright surface, distinct from the unit suite.
- **Props-only contract (T-17-09)** — `catalog.json` never enters a client bundle. The security-matrix grep (D-22-07) must respect this: scanning `'use client'` files for server-only tokens is exactly the intended proof.
- **Server Action order** (immutable): requireStaffAccess FIRST → zod → servable check → dedupe → upsert.
- **Live-proof precedent** — Phases 19/20 ran live provider probes (real OpenRouter catalog fetch, real env-key behavior) and recorded them in VERIFICATION.md. VER-02/03 continue that pattern with real-key E2E runs.
- **Why-comments** — non-obvious decisions get concise inline comments (house style).

### Integration Points
- `src/app/api/companies/[id]/analyze/route.ts` → the live E2E (VER-02) drives this route with a real OpenRouter primary.
- `src/app/actions/settings.ts` → the save path VER-02 stages the OpenRouter primary through.
- `src/lib/db/queries/userModelSettings.ts` + `src/lib/db/queries/runs.ts` → the audit-column read-back (`model_used`) the E2E asserts.
- `src/app/(dashboard)/settings/page.tsx` + `model-settings-form.tsx` → the VER-05 browser target.
- New Playwright spec + new Vitest security-grep test + child-env test are the phase's only new files.

</code_context>

<specifics>
## Specific Ideas

- The 4-cell hop matrix is the "lock" this phase must preserve verbatim — same-provider 429 never advances (v1.3 behavior), cross-provider 429 advances (FAL-03), null identity fail-closes. The audit must prove each cell, not just the happy path.
- `model_used`/`model_chain` record as-saved OpenRouter slugs verbatim (incl. `~latest` aliases) — the VER-02 assertion should compare the saved slug string exactly, not a normalized form.
- The dedicated Playwright test staff account is a real Clerk account (D-22-05) — the executor needs credentials or a documented sign-up step; flag this as a task prerequisite.
- The security grep's `NEXT_PUBLIC_*` scan should also confirm no `OPENROUTER` string appears in any client bundle reachable file — "no key-name leakage" is the claim, and it's cheap to prove.

</specifics>

<deferred>
## Deferred Ideas

- **Automated coverage thresholds** (e.g. enforcing a % coverage gate): not in scope — this phase proves specific claims with targeted matrices + E2E, not blanket coverage. Could be its own phase if the team wants a coverage budget.
- **Full CI pipeline** (GitHub Actions running Vitest + Playwright on every push): not in scope — tests run locally/on-command this phase. CI wiring is a future infra phase.
- **Bundle-scanning for the key-name string in production artifacts**: D-22-07 scans client components + actions + env at source level; a post-build bundle scan was discussed and deferred (adds build-time coupling to the test).

</deferred>

---

*Phase: 22-Verification Gate*
*Context gathered: 2026-08-03*
