---
phase: 24-refresh-script-catalog-data
audited: 2026-08-04
auditor: gsd-security-auditor
asvs_level: 1
block_on: high
threats_open: 0
threats_total: 13
status: SECURED
---

# Phase 24: Refresh Script + Catalog Data — Security Audit

**Auditor:** gsd-security-auditor (retroactive mitigation verification)
**Audited:** 2026-08-04
**ASVS Level:** 1
**Block-on:** high (open threats)
**Result:** **SECURED** — 13/13 threats closed (12 mitigated + 1 documented accepted risk), 0 open, 0 unregistered flags.

## Threat Register (verification per disposition)

| Threat ID | Category | Component | Disposition | Evidence (file:line) | Status |
|-----------|----------|-----------|-------------|----------------------|--------|
| T-24-01 | Tampering | catalog.json regroup transform | mitigate | `src/lib/models/catalog.json`: 1427 total rows across the 9 provider keys (anthropic, google, kilo, nousresearch, openai, opencode, opencode-go, openrouter, vercel), `generatedAt` top-level, `models` key absent, keys sorted — verified by node probe; registry behavior canaries green: `src/lib/models/catalog.test.ts:433-463` (COUNT-STABILITY 40), `:465-509` (NO-FLIP 66/12/6), `:289-320` (union formula), `:582-587` (anthropic allowlist); vitest 45/45 passed on the transformed snapshot | CLOSED |
| T-24-02 | Integrity | catalog.ts type migration | mitigate | `src/lib/models/catalog.ts:16-18` `getAllModels()` is the single flattening owner, used at `:45` (getModelDisplayName) and `:132` (dedupeProviderRows); `src/lib/agents/modelFactory.ts:66` openrouter row lookup routed through it; `grep -rn "catalogJson\.models" src/` → 0 matches (exit 1); gates/precedence/union/dedup byte-identical per D-24-05 (STATE.md:179, git-diff-verified 3 intended hunks); `npx tsc --noEmit` exit 0 | CLOSED |
| T-24-03 | Tampering | catalog.test.ts fixture | mitigate | Fixture regrouped into `providers` keys (`src/lib/models/catalog.test.ts:40-225`); row bodies verbatim except the two live-verified hermes re-values: `:181-183` (0.05/0.2, context 131072, structuredOutputs false) and `:195-197` (0.09/0.37, 131072, false); openrouter mirror rows unchanged (0.2/0.6, 0.8/1.2 — `:149-162`); existing id-only assertions (REG-04 `:272-277`, precedence `:341-347`, dedup `:357-365`) re-ran green in the 45/45 suite | CLOSED |
| T-24-04 | Tampering | fetchNousRoster / verifyZenGoRosters (roster body shape injection) | mitigate | `scripts/refresh-model-catalog.ts:188-191` `(body.data ?? [])` + type-predicate `typeof r.id === 'string'` + typed `as { data?: ... }` access; `:284-287` same defensive casts in `compare()`; malformed JSON → `await res.json()` rejects → propagates through `main()` → `main().catch` exit 1 (`:382-387`) before `writeFileSync` (`:375`); drift check Set-diff bounds the id-set (`:288-305`) so a poisoned roster cannot silently change servability | CLOSED |
| T-24-05 | Information Disclosure | refresh-model-catalog.ts | mitigate | No API keys anywhere in the script (grep for `api[_-]?key|secret|token|bearer|authorization` → only pricing-related comments, exit 1); script lives at `scripts/refresh-model-catalog.ts` (never deployed — deployed code path consumes only the committed snapshot); no `exec|spawn|child_process` added to `src/` by this phase (Phase 24 modified only catalog.json/catalog.ts/catalog.test.ts/modelFactory.ts/scripts/refresh-model-catalog.ts; the lone `spawnSync` in src/ is the pre-existing, unmodified `openrouter-only-chain.test.ts:2`); the script's own `execFileSync` is confined to `scripts/` per the Phase 18 gate | CLOSED |
| T-24-06 | Integrity | main() write path | mitigate | Single atomic `writeFileSync` (`scripts/refresh-model-catalog.ts:375-378`) AFTER the live OpenRouter join (`:344`), Nous fetch (`:356`), and strict drift check (`:360` awaited before write); every throw path exits 1 via `main().catch` (`:382-387`) before `writeFileSync` — committed snapshot stays usable (throws-not-degrades, smoke-proven in 24-02-SUMMARY: pre-amendment exit 1 + `snapshot NOT regenerated` + `git status` empty) | CLOSED |
| T-24-07 | Tampering | Zen/Go roster drift (CLI vs live) | mitigate | `scripts/refresh-model-catalog.ts:247-255` `GO_KNOWN_LIVE_ONLY_IDS` = exactly the 7 pinned ids (minimax-m2.5, kimi-k2.5, glm-5, qwen3.5-plus, mimo-v2-pro, mimo-v2-omni, hy3-preview); exception scoped to `label === 'Go'` only (`:295-296`) — Zen `knownDrift = []` stays fully strict; any NEW live-only id (`unexpectedMissing`, `:297`) or ANY CLI-only id (`extra`, `:298`) throws (`:298-305`); accepted drift logged to stderr on every run, never silent (`:307-311`); acceptance-only — the snapshot's opencode-go group ships the 18 CLI rows, never injected live ids (node probe: goRows 18); user-approved amendment documented (STATE.md:182, 24-02-SUMMARY.md, commit 444bb9ed) | CLOSED |
| T-24-08 | Integrity | canary re-lock (COUNT-STABILITY/NO-FLIP) | mitigate | Re-locked literals computed from the ACTUAL regenerated snapshot, never auto-derived inside the test: `src/lib/models/catalog.test.ts:441` (40 servable), `:447-448` (npm split 23/17), `:473` (pool 66), `:475-488` (dual 12), `:495-502` (go-exclusive 6); re-lock-date comments `:435-439, :469-471`; human checkpoint approved the deliberate re-lock (24-03-SUMMARY.md Task 3, STATE.md:183); assertion structure unchanged (zero-leak `:452-458`, slash-free `:461`, per-id keep-row loops `:489-493, :503-507`); 45/45 green | CLOSED |
| T-24-09 | Tampering | regenerated catalog.json (silent row loss) | mitigate | Structural gate re-verified by node probe: nousresearch 292 / opencode-go 18 / opencode 60, `models` key removed, `generatedAt` top-level, provider keys sorted; hermes pin spot-check exact (cost 0.05/0.2 & 0.09/0.37, context 131072, structuredOutputs false, family hermes, api.url/npm mandated); COUNT-STABILITY/NO-FLIP/union/openrouter (≥300) canaries green on the committed data (vitest 45/45) | CLOSED |
| T-24-10 | Tampering | boundary canary flip | mitigate | Flip is to the LOCKED hermes pins `['nousresearch/hermes-4-70b', 'nousresearch/hermes-4-405b']` (`src/lib/models/catalog.test.ts:392-397`) — never `~latest`; `NOUSRESEARCH_ALLOWLIST` contains no `~` (catalog.ts:70-73; test `:406-413` asserts it); D-24-12 group adds the ~latest self-exclusion proof — empty servable intersection (`:562-568`) | CLOSED |
| T-24-11 | Integrity | NOUSRESEARCH canary group (non-vacuousness) | mitigate | Every assertion concrete in `src/lib/models/catalog.test.ts:511-580`: exact row count 292 (`:516, :521`), exact hermes cost/context/structuredOutputs values (`:539-542, :549-550`), exact family strings hermes/hermes/qwen3.8 (`:557-559`), exact ~latest count 11 (`:517, :565`), non-vacuous structuredOutputs some-true/some-false (`:551-552`, 214/78 per snapshot) | CLOSED |
| T-24-12 | Tampering | hardcoded canary constants (auto-derive trap) | mitigate | All counts are EXPLICIT re-locked constants with a re-lock-date comment naming the source snapshot (`:512-517` — `NOUS_COUNT = 292`, `LATEST_ALIAS_COUNT = 11`, "committed 2026-08-04, Plan 03, commit 56d9fdaa — generatedAt 2026-08-04T09:44:37.964Z"), never derived from the snapshot inside the test; ~latest self-exclusion proven by the explicit empty-intersection assertion `:567` | CLOSED |
| T-24-13 | Information Disclosure | ~latest alias handling | accept | Accepted risk genuinely documented: 24-04-PLAN.md T-24-13 threat row (disposition: accept — aliases verbatim per D-24-08, no alias flag field per D-24-09, no client exposure beyond existing snapshot consumers); D-24-08/D-24-09 must-have truth in 24-02-PLAN.md l.15 ("Nous rows ship verbatim with NO alias flag field"); behavior locked by the D-24-12 canary (`catalog.test.ts:562-568` — 11 `~latest` rows ship verbatim and self-exclude). Recorded in the Accepted Risks log below | CLOSED |

**Closed: 13/13 | Open: 0/13**

## Accepted Risks

| Risk ID | Threat | Description | Rationale / Owner | Status |
|---------|--------|-------------|-------------------|--------|
| AR-24-01 | T-24-13 | `~latest` alias rows (11 in the nousresearch group) ship verbatim in the committed public `catalog.json` snapshot; `~latest`-ness is derivable from the id string (leading `~`); no alias-flag field is added to the schema | Accepted by design (D-24-08/D-24-09, documented in 24-02-PLAN.md l.15 and 24-04-PLAN.md T-24-13): the snapshot is the same public data contract pre-existing consumers already read; aliases are never servable (the allowlist pins concrete ids — D-23-05/D-07, locked by `catalog.test.ts:562-568`); the ids are not secrets and carry no credential material. Owner: Phase 24 (user-approved at plan time). | ACCEPTED |

## Audit Trail

- **Register source:** PLAN.md threat models for plans 01-04 (T-24-01..T-24-13), authored at plan time; dispositions unchanged.
- **Unregistered flags:** NONE — no `## Threat Flags` section exists in any of the four SUMMARY.md files, and no new attack surface was observed during verification beyond the register.
- **Verification method:** each `mitigate` threat was confirmed by direct grep/node/read evidence in the cited `files_to_check` (catalog.json, catalog.ts, catalog.test.ts, modelFactory.ts, refresh-model-catalog.ts) plus live execution (`npx vitest run src/lib/models/catalog.test.ts` → 45/45 passed; `npx tsc --noEmit` → exit 0); the `accept` threat (T-24-13) was confirmed documented in plan/summary/STATE.md.
- **Snapshot spot-check (independent probe):** totalRows 1427; keys anthropic,google,kilo,nousresearch,openai,opencode,opencode-go,openrouter,vercel; nousresearch 292; opencode-go 18; opencode 60; `models` undefined; `generatedAt` top-level; keys sorted; hermes-4-70b {0.05/0.2, 131072, false, hermes, mandated url/npm}; hermes-4-405b {0.09/0.37, 131072, false}; 11 `~latest` aliases; structuredOutputs 214 true / 78 false.
- **Cross-file greps:** `catalogJson\.models` in src/ → 0; `api[_-]?key|secret|token|bearer|authorization` in scripts/refresh-model-catalog.ts → 0 (only pricing comments); `exec|spawn|child_process` → no Phase-24 additions to src/.
- **Commit evidence (git):** `207a3c0e` (Plan 01 atomic regroup + migration), `b5f95890` (Plan 02 script extension), `444bb9ed` (D-24-07 user-approved pinned exception — 7 ids, Go-only, logged), `56d9fdaa` (Plan 03 snapshot + canary re-lock in ONE commit, 2 files), `80d06ee8` (Plan 04 NOUSRESEARCH D-24-12 group).
- **T-24-07 narrowness re-check (per audit instruction):** exception = exactly 7 ids, scoped to the Go compare only, logged to stderr on every run when accepted drift is present, acceptance-only (no live-id injection — snapshot go group = 18 CLI rows), any NEW live-only id or any CLI-only id still throws, Zen remains fully strict. This is the user-approved deliberate outcome (STATE.md:182, 24-02-SUMMARY.md Resolution).
- **Pre-existing items noted (not phase regressions, not open threats):** VER-03 `openrouter-only-chain.test.ts` live billing failure (uncredited OPENROUTER_API_KEY → 402, documented STATE.md:198); 24-REVIEW.md WR-02 (parseModels single-line drop) and WR-03 (perMTok NaN) are dev-time script robustness gaps in `scripts/`, documented for the next maintainer — neither introduces new attack surface in deployed code.
- **Implementation files were READ-ONLY** during this audit; only this SECURITY.md was written.

---

_Audited: 2026-08-04 by gsd-security-auditor — result SECURED (13/13 closed, 0 open, 0 unregistered flags)_
