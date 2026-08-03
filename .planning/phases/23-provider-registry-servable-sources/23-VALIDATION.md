---
phase: 23
slug: provider-registry-servable-sources
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-03
---

# Phase 23 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` (repo root; node-env pure-function tests, no mocking library) |
| **Quick run command** | `npx vitest run src/lib/models/catalog.test.ts src/components/settings/model-picker-logic.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~60 seconds (385-test baseline at v1.4 ship; ~390+ after this phase) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/lib/models/ src/components/settings/ src/lib/agents/`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green (excluding the pre-existing live-key e2e failure — VER-03 pending OpenRouter credit, unrelated to this phase)
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| *populated during planning/execution* | 01-05 | 1-2 | REG-01..07 | T-23-XX / — | N/A (registry/data-logic; env keys server-only, never client) | unit | `npx vitest run src/lib/models/catalog.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/models/catalog.test.ts` — extended canary suite (fixture + live-snapshot dual canary convention)

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Vercel env declarations for `NOUSRESEARCH_API_KEY` + `OPENCODE_API_KEY` | REG-02 | Vercel dashboard operator action; no values to provision until Phase 25 (research open question 1) | Verify keys present in Vercel env (Preview + Production, Encrypted, server-only) — deferred to Phase 25 provisioning |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
