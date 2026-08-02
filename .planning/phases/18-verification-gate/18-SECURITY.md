---
phase: 18
slug: verification-gate
status: verified
threats_open: 0
asvs_level: 1
created: 2026-08-02
---

# Phase 18 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Phase 18 (verification-gate) = plan 18-01 (VER-01/02 test gaps + traceability matrix) + 18-02 (VER-03 live-browser UAT + Postgres evidence) + 18-03 (VER-04 deployed-preview verification).

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| test code → production source | Tests import real modules (modelConfig, catalog) but must never alter production behavior | none (test-only) |
| catalog.json → filter functions | The committed snapshot is the single source of truth; a stale/tampered snapshot would change what models the app offers | model ids (public catalog data) |
| browser → local dev server | Staff-authenticated session (Clerk) drives the settings/analyze flows; the UAT operates under the real staff identity | session identity, model config |
| dev server → Postgres | Live `agent_run` writes + reads via DATABASE_URL — the durable-truth assertion surface | run records (model_used/model_chain) |
| anonymous visitor → preview URL | Untrusted, unauthenticated traffic to the deployed preview | none (auth-gated) |
| preview app → committed catalog.json | The model list is sourced solely from the committed snapshot — no runtime opencode | model ids, names, costs |
| src/ → Vercel build | The built artifact must contain no subprocess surface (ASVS V7) | none by design (grep-gated) |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-18-01 | Tampering | src/lib/models/catalog.json | mitigate | Real-snapshot test in catalog.test.ts pins `getAllowlistedServableIds(catalogJson)` to exactly `['claude-sonnet-4-6']` with a `.some(id.includes('/')) === false` leakage guard — snapshot drift or opencode/ leakage fails CI (ASVS V5 servable-set integrity) | closed |
| T-18-02 | Tampering | production source files | mitigate | D-18-02: zero production code changes this phase — only `*.test.ts` files + phase artifacts touched (git-verified); zero-hit `exec\|spawn\|child_process` grep gate in src/ (ASVS V7) | closed |
| T-18-03 | Tampering | test fixtures | accept | Inline fixtures deliberately decoupled from the committed snapshot (documented at catalog.test.ts:12-14); the real-snapshot test is the single documented exception — additive and drift-guarded by its assertion — see Accepted Risks Log AR-18-01 | closed |
| T-18-04 | Spoofing | agent_run userId capture | mitigate (verify) | Analyze route captures `userId` from the Clerk session only (route.ts:28 `requireStaffAccess()`); settings.ts never accepts a client userId (schema has no userId field, upsert keyed by session userId); UAT asserted the new `agent_run` row keyed by the session user (live re-query row id=3) | closed |
| T-18-05 | Information Disclosure | .env.local / DATABASE_URL handling | mitigate | Keys verified presence-only (grep names, values never printed); psql/neon invoked with URL sourced from env without echoing; no secret value written to 18-UAT.md or 18-VERIFICATION.md (grep-verified) | closed |
| T-18-06 | Tampering | test-only code leaking to prod | accept | D-18-02: no production code added — only phase artifacts; no fail hook, no invalid-model trick (SC-3 recorded satisfied-by-extension via Vitest) — see Accepted Risks Log AR-18-02 | closed |
| T-18-07 | Information Disclosure | preview URL (unauthenticated) | mitigate (verify) | V4 access control: /settings + analyze route call `requireStaffAccess()` first (page.tsx:15, route.ts:28; (dashboard) layout gate too); verifier confirmed anonymous GET / and /settings → 307 → /sign-in with no staff data rendered | closed |
| T-18-08 | Tampering | Vercel build / runtime opencode | mitigate (verify) | VER-04 proof: /settings renders from the committed catalog.json (no 500, no empty, no opencode/ rows — human-approved on preview); zero-hit exec\|spawn\|child_process grep in src/ recorded and re-verified (ASVS V7) | closed |
| T-18-09 | Tampering | preview URL leakage of secrets | accept | PUBLIC_ prefix convention enforced (only NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is client-visible; all secrets server-only in env.ts); no new secrets added this phase — see Accepted Risks Log AR-18-03 | closed |
| T-18-SC | Tampering | npm installs | accept | No packages installed this phase (vitest 4.1.10 already present; vercel CLI + gh already installed; zero package.json/lockfile changes in phase git range) — see Accepted Risks Log AR-18-04 | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-18-01 | T-18-03 | Inline test fixtures are deliberately decoupled from the committed catalog.json (catalog.test.ts:12-14 comment) so unit tests pin filter/slug semantics, not a drifting snapshot. The real-snapshot test is the single deliberate exception — additive and drift-guarded by its own assertion (`['claude-sonnet-4-6']` + no-`/` guard), so no fixture risk remains. | plan-authored (18-01 threat register) | 2026-08-02 |
| AR-18-02 | T-18-06 | Phase 18 adds zero production code (git-verified: only `*.test.ts` files + phase artifacts). The SC-3 forced-fail clause is satisfied-by-extension via Vitest loop tests (runAgent.test.ts RetryError-404 + exhaustion tests) — no fail hook or invalid-model trick ships in src/. | plan-authored (18-02 threat register) | 2026-08-02 |
| AR-18-03 | T-18-09 | The preview renders the same Clerk-auth-gated app as prod; only `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is client-visible (env.ts:8), all secrets (DATABASE_URL, CLERK_SECRET_KEY, ANTHROPIC_API_KEY, etc.) are server-only non-PUBLIC_ vars. No new secrets were added this phase. | plan-authored (18-03 threat register) | 2026-08-02 |
| AR-18-04 | T-18-SC | No packages installed this phase: git range shows zero package.json/package-lock.json changes; vitest 4.1.10, vercel CLI, and gh were already installed before the phase. No install task existed, so no supply-chain checkpoint applies. | plan-authored (18-01/02/03 threat registers) | 2026-08-02 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-02 | 10 | 10 | 0 | gsd-security-auditor |

### Verification Evidence (per threat)

| Threat ID | Evidence |
|-----------|----------|
| T-18-01 | `src/lib/models/catalog.test.ts:84-87` `it('committed 1131-model snapshot yields exactly the servable allowlist — zero leakage (CAT-03)')` asserts `expect(getAllowlistedServableIds(catalogJson)).toEqual(['claude-sonnet-4-6'])` AND `expect(getAllowlistedServableIds(catalogJson).some((id) => id.includes('/'))).toBe(false)`; import at :2 `import catalogJson from './catalog.json'`. Re-ran suite: `npx vitest run src/lib/models/catalog.test.ts` → 10/10 pass. Production anchor: `catalog.ts:13` `ANTHROPIC_ALLOWLIST = ['claude-sonnet-4-6']`, `catalog.ts:43-47` `getAllowlistedServableIds` = snapshot ∩ allowlist |
| T-18-02 | Git-verified D-18-02: `git log 8db81558..HEAD -- src/` returns only the 2 test commits — `e5a04a11` (src/lib/agents/runAgent.test.ts), `93fd7e1c` (src/lib/agents/modelConfig.test.ts + src/lib/models/catalog.test.ts); every other phase commit touches only `.planning/` artifacts. Grep gate re-run by auditor: `grep -rE "node:child_process\|execFileSync(\|execSync(\|spawnSync(\|spawn(" src/` → 0 hits (exit 1) |
| T-18-03 | Accepted risk AR-18-01. Fixture-decoupling documented at `catalog.test.ts:12-14`; the real-snapshot test at :84-87 is the single additive exception, drift-guarded by its assertion |
| T-18-04 | `src/app/api/companies/[id]/analyze/route.ts:28` `const { userId } = await requireStaffAccess();` — first call, before any client input is touched; userId flows from Clerk `auth()` (`src/lib/auth/requireStaffAccess.ts:10-15`), never client-supplied. `src/app/actions/settings.ts:34` same gate-first pattern; schema :28-31 declares only `primaryModel` + `fallbacks` — no userId field; upsert keyed by session userId at :56-60. UAT row keyed by session user: `18-VERIFICATION.md:47` verifier's live re-query `{ id: 3, company_id: 16, model_used: "claude-sonnet-4-6", model_chain: ["claude-sonnet-4-6"] }` — exact match to 18-UAT.md test 5 |
| T-18-05 | Presence-only check re-run by auditor: `grep -cE '^(ANTHROPIC_API_KEY\|FIRECRAWL_API_KEY\|DATABASE_URL)=' .env.local` → 3; key NAMES enumerated, values never printed. `18-02-SUMMARY.md:99` documents DATABASE_URL sourced from `.env.local` and masked in command output. Auditor grep for secret patterns (`sk-`, `postgres(ql)?://`, `KEY=value`) in 18-UAT.md and 18-VERIFICATION.md → 0 matches |
| T-18-06 | Accepted risk AR-18-02. Git proof (see T-18-02): zero production code added. SC-3 forced-fail clause recorded verbatim as satisfied-by-extension at `18-VERIFICATION.md:175,179`; no fail hook exists (grep `fail` hook patterns in src/ → none; the loop tests at runAgent.test.ts:265-284 are the Vitest forced-fail evidence) |
| T-18-07 | `src/app/(dashboard)/settings/page.tsx:15` `const { userId } = await requireStaffAccess();` first statement; `src/app/api/companies/[id]/analyze/route.ts:28` same; belt-and-suspenders layout gate at `src/app/(dashboard)/layout.tsx:9`. Verifier live curl (`18-VERIFICATION.md:49,115-117`): anonymous `GET /` → 307 → /sign-in; `GET /settings` → 307 → /sign-in; `/sign-in` → 200 — no staff data renders anonymously |
| T-18-08 | `/settings` renders from the committed snapshot: `page.tsx:46` `getAllowlistedServableIds(catalogJson)` imports the committed `@/lib/models/catalog.json` directly (server-side; :40 comment confirms catalog.json never enters a client bundle). Human-approved preview render "Claude Sonnet 4.6" + cost caption, no 500/empty/opencode/ rows (18-VERIFICATION.md:63-64). Grep gate re-run by auditor → 0 hits (see T-18-02) |
| T-18-09 | Accepted risk AR-18-03. `src/lib/env.ts:6-40`: exactly one PUBLIC_-prefixed var (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` at :8); DATABASE_URL, CLERK_SECRET_KEY, ANTHROPIC_API_KEY, FIRECRAWL_API_KEY, LANGFUSE_* all server-only (no prefix, never client-visible). No env file changes in the phase git range |
| T-18-SC | Accepted risk AR-18-04. Auditor re-verified: `git log 8db81558..HEAD -- package.json package-lock.json` → empty; `npx vitest run` banner confirms vitest 4.1.10 already present. No install task existed in any plan |

### Threat Flags from SUMMARY

`18-01-SUMMARY.md`, `18-02-SUMMARY.md`, `18-03-SUMMARY.md`: **no `## Threat Flags` section in any of the three summaries** (grep for `Threat Flag` across the phase directory → 0 matches). Zero unregistered flags — no new attack surface appeared during implementation beyond the planned threat register.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log (AR-18-01..04)
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-02 (gsd-security-auditor — all 10 register rows CLOSED; 0 open; 0 unregistered flags)
