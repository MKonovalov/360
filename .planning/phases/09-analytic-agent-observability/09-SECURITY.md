---
phase: 09
slug: analytic-agent-observability
status: secured
threats_open: 0
asvs_level: 1
created: 2026-08-01
---

# SECURITY.md — Phase 09 Analytic Agent + Observability

**Audit date:** 2026-08-01
**Threat register:** 09-01-PLAN.md L207-229, 09-02-PLAN.md L168-190, 09-03-PLAN.md L172-194
**Verdict:** SECURED — 9/9 threats closed (T-09-08 retention-tag gap remediated 2026-08-01, re-audited)

## Threat Verification

| Threat ID | Category | Disposition | Evidence |
|-----------|----------|-------------|----------|
| T-09-01 | Spoofing | mitigate | **CLOSED** — `await requireStaffAccess()` is the FIRST call in the Route Handler (`src/app/api/companies/[id]/analyze/route.ts:25`) and in both Server Actions (`src/app/actions/reviews.ts:21,47`); layout-level gate on the whole `(dashboard)` route group (`src/app/(dashboard)/layout.tsx:9`) plus page-level self-gate (`src/app/(dashboard)/reviews/page.tsx:14`). Single centralized gate (`src/lib/auth/requireStaffAccess.ts:10-16`). No anonymous path to the agent or DB writes. |
| T-09-02 | Tampering (web content → agent) | mitigate | **CLOSED** — `webSearch` is the agent's ONLY tool (`src/lib/agents/runAgent.ts:34`, `src/lib/agents/tools.ts:24-43`); fetched content enters only as tool-call results and is never spliced into instructions (`src/lib/agents/prompt.ts:1-5` — prompt carries only DB-sourced company facts + covered signal types). Structured output constrained by `Output.object({ schema: outputSchema })` (`runAgent.ts:37`); fail-closed gate constrains model output before any persist (`src/lib/agents/analyzeCompany.ts:62-65`). |
| T-09-03 | Tampering (fabricated/orphan citations) | mitigate | **CLOSED** — `checkCitationsResolve` (every_citation_must_resolve port) rejects any `evidenceUrl` that does not resolve to the appendix (`src/lib/validation/airsRules.ts:60-73`); gate fails closed with `{ ok:false, reason:'gate_failed' }` before any write (`analyzeCompany.ts:63-65`), surfaced as 422 and never persisted (`route.ts:65`). Appendix derived server-side from REAL `webSearch` tool results, model-recited appendix discarded (`analyzeCompany.ts:55,112-135`). zod validation on route id (`route.ts:20,28-31`) and reject reason (`reviews.ts:41-50`, `corrections.ts:29-30`). |
| T-09-04 | Information Disclosure (API keys) | mitigate | **CLOSED** — Phase-9 keys (`ANTHROPIC_API_KEY`, `FIRECRAWL_API_KEY`, `LANGFUSE_*`) declared server-only with no `PUBLIC_` prefix (`src/lib/env.ts:35-39`). All `env` importers are server-side (lib modules, server components, server actions); the only client-bound values are booleans computed server-side (`src/components/companies/company-detail.tsx:71-74`). No Phase-9 code logs key values (no console output in route/actions/agents/telemetry; grep of key names shows only instantiation/boolean checks). |
| T-09-05 | DoS / cost amplification | mitigate | **CLOSED** — `export const maxDuration = 60` (`route.ts:16`); `isStepCount(12)` tool-loop cap (`runAgent.ts:36`); single company per run (route `[id]` → `analyzeCompany(companyId)`); lean prompt with explicit 60-second budget (`prompt.ts:43`); trigger gated by staff auth first (`route.ts:25`). |
| T-09-06 | Tampering (mass-proposal flooding) | mitigate | **CLOSED** — `insertProposals` has exactly one call site, the staff-gated route AFTER the gate passes (`route.ts:117`); post-run dedup filters against live signals and within-set duplicates (`dedup.ts:7-21`, applied at `analyzeCompany.ts:69`); accept/reject actions staff-gated (`reviews.ts:21,47`); queue page read-only for non-staff (gated layout + page gate + actions independent). |
| T-09-07 | Tampering (race: duplicate signal writes) | mitigate | **CLOSED** — `acceptProposal` status-guarded conditional UPDATE `WHERE id AND status='pending'`, 0 rows ⇒ idempotent `already_resolved` (`src/lib/db/queries/proposals.ts:107-113`); unique index `signal_company_type_idx` on `(companyId, signalType)` as DB backstop (`schema.ts:114`); 23505/duplicate-key mapped to `duplicate_signal` (`proposals.ts:134,140-146`); **no `db.transaction()` anywhere** (grep: only comments). `rejectProposal` uses the same status guard (`corrections.ts:34-39`). |
| **T-09-08** | Information Disclosure (trace data leakage) | mitigate | **CLOSED** — retention-tag mitigation implemented and re-verified 2026-08-01. `retentionTagSchema = z.enum(['public_biz','personal_data'])` with `derivedEvidenceAppendixSchema = evidenceAppendixSchema.element.extend({ retentionTag: retentionTagSchema })` — retentionTag REQUIRED on the derived shape (`src/lib/agents/types.ts:42-46`). `deriveEvidenceAppendix` emits `retentionTag: retentionTagForUrl(item.url)` per entry (`src/lib/agents/analyzeCompany.ts:112-136`); `retentionTagForUrl` host heuristic classifies personal/social platforms (linkedin, x/twitter, facebook, instagram, tiktok, youtube) as `personal_data`, everything else `public_biz`, unparseable URLs fail toward `public_biz` never crash (`analyzeCompany.ts:138-160`). `AnalyzeResult.output` typed `Omit<RunOutput,'evidenceAppendix'> & { evidenceAppendix: DerivedEvidenceAppendix }` (`analyzeCompany.ts:21`). Tag flows through persistence: route persists `result.output.evidenceAppendix` (`route.ts:114`) → `createRun` (`runs.ts:11,28`, `evidenceAppendix?: unknown`) → `agent_run.evidence_appendix` jsonb (`schema.ts:243`). Test coverage: T-09-08 host-classification test + `derivedAppendix` expectations updated with `retentionTag` per entry (`analyzeCompany.test.ts:114-118,142,155-159,205-210`). Staff-only trace view (review-queue.tsx:159-166), corrections with no personal data beyond optional staff note, internal company names only — all previously verified CLOSED. |
| T-09-SC | Tampering (npm installs) | mitigate | **CLOSED** — slopcheck 10/10 [OK] (2026-07-31) documented in `09-RESEARCH.md` L157-174; versions resolved and committed in `package.json` + `package-lock.json` (`ai@7.0.45`, `@ai-sdk/anthropic@4.0.26`, `firecrawl@4.32.0`, langfuse 5.x); plans 02/03 added no new packages (09-02/09-03-SUMMARY "added: none"); Anthropic model string re-verified live 2026-08-01, re-verify window closed (`runAgent.ts:7-13`). |

## Unregistered Flags

None — no `## Threat Flags` sections present in 09-01/09-02/09-03 SUMMARY.md.

## Accepted Risks

None documented.

## Open Threats

None — all 9 threats verified CLOSED (2026-08-01 re-audit after T-09-08 remediation).

| Threat ID | Category | Mitigation Expected | Files Searched |
|-----------|----------|---------------------|----------------|
| — | — | — | — |
