---
status: partial
phase: 01-foundation-platform-migration-data-model
source: [01-VERIFICATION.md]
started: 2026-07-23T12:20:00Z
updated: 2026-07-23T12:20:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Signed-in dashboard shows live seeded company count + Refresh button works
expected: Sign in at https://360.arclumenpartners.com with a staff Clerk account. Dashboard should show "2 companies loaded." (or more, matching current Neon data) and clicking "Refresh" should re-fetch the count via the `refreshCompanyCount()` Server Action without a full page reload.
result: [pending]

### 2. Session continuity across the Clerk SDK swap (@clerk/astro -> @clerk/nextjs)
expected: If you had an active session before the migration, confirm you weren't unexpectedly signed out, or that signing in fresh works cleanly. Flagged as a LOW-confidence assumption in 01-VALIDATION.md — can't be verified without a real pre-migration session.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
