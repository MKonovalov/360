---
status: partial
phase: 19-provider-registry-servable-model-source
source: [19-VERIFICATION.md]
started: 2026-08-02T22:12:00Z
updated: 2026-08-02T22:12:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Vercel env declaration of `OPENROUTER_API_KEY`
expected: The key exists as a server-only env var in Vercel Settings → Environment Variables for project `360-arclumen` (`prj_DbEzimzON9nzF7Nmk7Nueta7k00V`), not `PUBLIC_`-prefixed, production (optionally preview/development for Phase 20 testing). Non-blocking per D-11 — nothing consumes the key until Phase 20's chain-aware gate. Local declarations verified: `env.ts:41`, `.env.example:33`.
result: [pending]

### 2. Settings card provider-choice rendering (Phase 21 surface)
expected: Open `/settings` signed in; the card loads (anthropic-only picker per Phase 19 scope). The union validation (REG-07) accepts a cross-provider chain (e.g. primary `claude-sonnet-4-6` + fallback `anthropic/claude-sonnet-4.6`) end-to-end — visible via Phase 21's provider selector or direct action invocation. Provider-badged picker rendering is a Phase 21 deliverable.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
