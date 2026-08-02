---
phase: 17
slug: settings-ui-list-source
status: verified
threats_open: 0
asvs_level: 1
created: 2026-08-02
---

# Phase 17 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Phase 17 (settings-ui-list-source) = plan 17-01 (nav wiring) + 17-02 (settings action + allowlist re-verify) + 17-03 (settings page + form).

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| nav data → UI | Static compile-time constants only (labels, hrefs, NavKey literals). No runtime user input flows through nav files | none (public) |
| client → `saveSettingsAction` | Untrusted arbitrary `unknown` input crosses here; every field re-validated server-side, no client state trusted | model ids (public catalog data) |
| session → userId | The only legitimate source of the settings-row key; client input must never supply it | session identity |
| server page → client form | Props are server-computed from the DB + committed snapshot; the client never fetches or independently sources this data | model ids, names, costs, catalog sync date |
| DB row → future provider call | Saved model ids eventually reach `anthropic(id)` in Phase 16's runAgent; allowlist ∩ snapshot gate keeps a 404-ing id out of the DB | model ids |
| client bundle | Any client-side import of catalog.ts would ship the 1131-row catalog.json to the browser | none by design (grep-gated) |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-17-01 | Tampering | sidebar / menu hrefs | mitigate | All hrefs are hardcoded literals in source, never parameterized or user-supplied | closed |
| T-17-02 | Tampering | `getActiveNavKey` route match | mitigate | Exact-match-only branch for `/settings` (no `startsWith('/settings/')`) pins the sibling-prefix guard; locked by boundary-guard Vitest case | closed |
| T-17-02 | Spoofing (authz) | `saveSettingsAction` | mitigate | `await requireStaffAccess()` is the FIRST statement (reviews.ts precedent); input schema has no userId field; `upsertModelSettings` keyed by session userId only | closed |
| T-17-03 | Tampering | model-id validation | mitigate | Every id checked against server-computed `getAllowlistedServableIds(catalogJson)` (allowlist ∩ committed snapshot) rejecting `invalid_model`; client-supplied "servable list" never consulted | closed |
| T-17-04 | Tampering | chain integrity | mitigate | `duplicate_model` backstop rejects primary∈fallbacks and repeated fallbacks (D-08/D-09) even if client gates bypassed | closed |
| T-17-05 | Information disclosure | D-01 roster re-verify curl | mitigate | `ANTHROPIC_API_KEY` read from `.env.local` into a shell variable, used only in curl `x-api-key` header — never echoed, printed, or committed | closed |
| T-17-06 | Tampering | stale/dated model ids | mitigate | Allowlist ∩ snapshot gate structurally excludes dated ids (`-20\d{6}` pinned by catalog.test.ts assertion, Phase 15 D-02 rule) | closed |
| T-17-07 | Information disclosure | `/settings` page | mitigate | `await requireStaffAccess()` first statement (belt-and-suspenders alongside (dashboard) layout gate); row keyed by session userId | closed |
| T-17-08 | Tampering | stale-value save bypass | mitigate | Save `disabled` while stale saved value present (client UX) AND action re-validates every id server-side (T-17-03 backstop) | closed |
| T-17-09 | Tampering | client bundle leakage | mitigate | Form/page receive server-computed `servableModels`/`defaultPrimary` props only; zero imports of `@/lib/models/catalog` in client code (grep gate); catalog.json never enters client bundle | closed |
| T-17-10 | Information disclosure | catalog data exposure | accept | Model ids, names, costs are public catalog data; no secrets/env keys in form or action; no PII beyond user's own config — see Accepted Risks Log | closed |
| T-17-SC ×3 | Tampering | npm/pip/cargo installs | n/a | Zero install surface across all three plans (no package.json/lockfile changes in any phase commit) | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-17-01 | T-17-10 | Model ids, names, and costs are public catalog data (no secrets, no env keys in the form or action). The D-04 catalog sync date is likewise public. No PII is rendered beyond the user's own model config. | plan-authored (17-03 threat register) | 2026-08-02 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-02 | 12 | 12 | 0 | gsd-security-auditor |

### Verification Evidence (per threat)

| Threat ID | Evidence |
|-----------|----------|
| T-17-01 | `src/components/layout/app-sidebar.tsx:207` `<Link href="/settings">`; `src/app/companies/page.tsx:32` + `src/app/personas/page.tsx:30` `{ label: 'Settings', href: '/settings' }` — all hardcoded string literals; grep for `href={...}` interpolation in app-sidebar: 0 matches |
| T-17-02 (route) | `src/lib/nav.ts:16` `if (pathname === '/settings') return 'settings';` exact-match only; `grep -r "startsWith('/settings/')" src` → 0 matches; boundary guard locked at `src/lib/nav.test.ts:53-55` (`/settings-archive` → null) |
| T-17-02 (authz) | `src/app/actions/settings.ts:34` `const { userId } = await requireStaffAccess();` is the first executable statement (before safeParse at :36); schema at :28-31 declares only `primaryModel` + `fallbacks` — no userId field; upsert keyed by session userId at :57; gate-first order pinned by `src/app/actions/settings.test.ts:39-42` invocation-call-order assertion |
| T-17-03 | `src/app/actions/settings.ts:40` `const servableIds = getAllowlistedServableIds(catalogJson);` server-computed from committed snapshot; :42 `if (!all.every((id) => servableIds.includes(id))) return { ok: false, reason: 'invalid_model' };`; non-servable `claude-opus-4-9` rejected in `settings.test.ts:72-83` |
| T-17-04 | `src/app/actions/settings.ts:49-54` `fallbacks.includes(primaryModel)` OR `new Set(fallbacks).size !== fallbacks.length` → `duplicate_model`; both paths tested (`settings.test.ts:85-95`, `97-107`) |
| T-17-05 | Procedure recorded at `17-02-SUMMARY.md:65-74,124` (key existence-checked, read into shell var, used only in curl `x-api-key` header, never echoed/printed/committed); repo grep for `ANTHROPIC_API_KEY` in `.ts` → only `src/lib/env.ts:35` (optional env schema), `src/lib/agents/analyzeCompany.ts:44` (runtime check), `analyzeCompany.test.ts:11,196,205` (literal `'test-key'` stub) — zero committed key material; `.env.local` gitignored. **Note:** the mitigation-plan citation "scripts/ (roster verify script from plan 15-02 / 17-02)" does not exist on disk — `scripts/` contains only `refresh-model-catalog.ts` (the opencode CLI snapshot generator, unrelated to the Anthropic key). The D-01 re-verify was executed as a documented ad-hoc curl procedure, not a committed script; the mitigation substance (key never disclosed to source control or output) holds |
| T-17-06 | `src/lib/models/catalog.ts:13` allowlist is sonnet-only undated; no-dated-ID assertion `catalog.test.ts:87` `!/-20\d{6}/.test(id)`; `FAST_MODEL_ID` pinned undated at `catalog.test.ts:91-95`; a dropped-from-roster id fails the servable-set check at `settings.ts:42` → `invalid_model` |
| T-17-07 | `src/app/(dashboard)/settings/page.tsx:15` `const { userId } = await requireStaffAccess();` first statement; per-user fetch `getModelSettingsForUser(userId)` at :23; (dashboard) layout gate present (`src/app/(dashboard)/layout.tsx`) |
| T-17-08 | Client: `src/components/settings/model-settings-form.tsx:60-61` `staleIds` derived from current draft + `saveDisabled = isPending || staleIds.length > 0`; server backstop: `settings.ts:42` re-validates every submitted id against the servable set — a bypassed client cannot persist a non-runnable model |
| T-17-09 | Grep `lib/models/catalog` in `src/components/settings/` → 0 matches (client form imports nothing from catalog); the only catalog imports in the settings surface are the server page (`src/app/(dashboard)/settings/page.tsx:3-4`); form receives server-computed props only (`page.tsx:69-74`: `saved`, `servableModels`, `defaultPrimary`, `catalogGeneratedAt`) |
| T-17-10 | Accepted risk — see Accepted Risks Log AR-17-01; `grep -E "sk-\|api[_-]?key\|secret\|token" src/lib/models/catalog.json` → 0 matches; no env keys in form or action |
| T-17-SC ×3 | Zero install surface confirmed via `git show --stat` on all 9 phase commits (866c82dd, 61233546, b6f7c232, 7bbc8d2c, 3cee25ef, 879eabb4, cb47eaea, 5869caee, b8b7ba56) — only source/test files touched, no package.json or lockfile changes |

### Threat Flags from SUMMARY

`17-03-SUMMARY.md` `## Threat Flags` (line 128-130): **None** — no new security-relevant surface beyond the plan's threat register. 17-01/17-02 summaries carry no Threat Flags section. Zero unregistered flags.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-02 (gsd-security-auditor — all 12 register rows CLOSED; 0 open)
