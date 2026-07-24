---
phase: 04
slug: arcpedia-integration-resilience-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-24
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None installed — no `vitest.config.*`, `jest.config.*`, `playwright.config.*`, or `*.test.*`/`*.spec.*` anywhere in repo; no `test` script in `package.json`. Same state carried over from Phase 1–3 (unaddressed by design). |
| **Config file** | none — Wave 0 does not install one (see Wave 0 Requirements) |
| **Quick run command** | none |
| **Full suite command** | none |
| **Estimated runtime** | n/a |

---

## Sampling Rate

- **After every task commit:** No automated quick-run exists; verify via manual code inspection per acceptance criteria.
- **After every plan wave:** No automated full suite exists.
- **Before `/gsd-verify-work`:** Human UAT checklist (`*-HUMAN-UAT.md`, matching Phase 1–3 precedent) must be walked, with the ARCP-01 "articles render" item marked conditional/blocked pending Cloudflare Access Service Token provisioning (see Open Questions in RESEARCH.md).
- **Max feedback latency:** n/a (manual verification only)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-* | 01 | 1 | ARCP-01 | — | Related Knowledge section shows title+snippet, capped at 3, `target="_blank" rel="noopener noreferrer"` | manual (UAT) | — | ❌ W0 (blocked on Access token) | ⬜ pending |
| 04-01-* | 01 | 1 | ARCP-01 (empty/failure) | — | Section renders nothing on zero-match or Arcpedia unreachable | manual (UAT) / optional unit | — | ❌ W0 (optional) | ⬜ pending |
| 04-01-* | 01 | 1 | ARCP-02 | — | `fetchArcpediaArticles` only issues `GET`, never `POST`/`PUT`/`PATCH`/`DELETE` | code-review | `grep -n "method:" <new file>` | ❌ W0 | ⬜ pending |
| 04-02-* | 02 | 1-2 | EXPL-06 (error) | — | DB fetch failure on `/companies/:id` or `/personas/:id` shows "Couldn't load company/persona" card, not a 500 | manual (UAT) | — | ❌ W0 | ⬜ pending |
| 04-02-* | 02 | 1-2 | EXPL-06 (loading) | — | Route-level skeleton (`loading.tsx`) shows while detail pane loads | manual (UAT) | — | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] None — no test framework install planned this phase, consistent with Phase 2/3 precedent.

*Existing infrastructure (manual UAT checklist pattern) covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Related Knowledge section populates with real articles | ARCP-01 | Depends on live Arcpedia response through Cloudflare Access — no framework installed, and this is external-system + visual behavior | Confirm Cloudflare Access Service Token is provisioned for `arcpedia.arclumen.de`; load a Company/Persona 360 view known to have matching Arcpedia content; confirm ≤3 articles render with title+snippet, links open in new tab to correct slug |
| Zero-match / Arcpedia-unreachable hides section | ARCP-01 | Visual/rendering behavior, trivially demonstrable today even without the Access token (absence of token *is* this failure path) | Load a Company/Persona 360 view with no matching Arcpedia content (or before token provisioning); confirm no "no articles" box renders — section is fully absent |
| No write calls to Arcpedia | ARCP-02 | Static/code-review check, no test framework needed | `grep -n "method:" src/lib/arcpedia*.ts` (or equivalent) confirms only `GET` (or omitted, defaulting to GET) |
| Detail-pane DB failure shows error card | EXPL-06 | Requires forcing a DB failure (e.g., invalid `DATABASE_URL`) — environment-dependent, not unit-testable without mocking infra not present in this codebase | Temporarily break DB connectivity; load `/companies/:id` and `/personas/:id`; confirm "Couldn't load company/persona" card renders, not Next.js default 500 |
| Detail-pane loading skeleton | EXPL-06 | Visual/timing behavior | Throttle network or add artificial delay; confirm `loading.tsx` skeleton displays during detail pane load |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies — N/A this phase (manual UAT only, matching Phase 1–3)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify — N/A (no automated verify exists)
- [ ] Wave 0 covers all MISSING references — N/A (no Wave 0 test infra needed)
- [ ] No watch-mode flags — N/A
- [ ] Feedback latency < Ns — N/A
- [ ] `nyquist_compliant: true` set in frontmatter — left `false`; this phase is deliberately manual-UAT-only per Phase 1–3 precedent, not a Nyquist gap

**Approval:** pending
