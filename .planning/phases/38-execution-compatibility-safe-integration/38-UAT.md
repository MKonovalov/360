---
status: complete
phase: 38-execution-compatibility-safe-integration
source:
  - 38-01-SUMMARY.md
  - 38-02-SUMMARY.md
  - 38-03-SUMMARY.md
  - 38-04-SUMMARY.md
  - 38-05-SUMMARY.md
  - 38-06-SUMMARY.md
started: 2026-08-13T23:20:00Z
updated: 2026-08-13T23:55:00Z
---

## Current Test

number: 5
name: Authenticated Company and Persona browser flow
expected: |
  With an authenticated Clerk browser session, Company and Persona users can complete the launcher flow through preview, launch, durable status, reload, and result/source inspection.
[testing complete]

## Tests

### 1. Practice Area-first analysis launcher
expected: Opening the analysis launcher first shows a Practice Area selector. After choosing a Practice Area, the agent picker appears with the compatible fixed agent first and compatible custom agents available as explicit choices. Incompatible target or Practice Area combinations are not offered.
result: pass

### 2. Fixed and custom preview and launch
expected: Selecting the fixed agent preserves the existing preview and launch flow. Selecting a custom agent sends only its opaque identity/version selection, then the server resolves the authoritative instruction, checklist, effort, capabilities, model chain, and policy before creating the run.
result: pass

### 3. Durable custom execution and safe output
expected: A custom run uses the same durable execution path as a fixed run, survives reload/replay without duplicate history, persists custom output separately from the server-owned narrative/findings/evidence/review channels, and fails safely when output or tool content is invalid.
result: pass

### 4. Neon and Workflow integration proof
expected: Against the disposable migrated database, custom snapshot/checklist data round-trips, duplicate active runs are rejected per template, claim/reload/replay and bounded failure/recovery work, packet data is readable before completion, and fixed-run behavior remains compatible.
result: pass

### 5. Authenticated Company and Persona browser flow
expected: With an authenticated Clerk browser session, Company and Persona users can complete the launcher flow through preview, launch, durable status, reload, and result/source inspection.
result: pass
evidence: "Guarded Phase 39 runner completed lifecycle, Company, and Persona lanes with real Clerk/Chromium execution; each lane passed 3 tests including auth setup."

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

none yet
