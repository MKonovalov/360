---
status: complete
phase: 34-whole-run-review-confirmed-candidates
source: 34-01-SUMMARY.md, 34-02-SUMMARY.md, 34-03-SUMMARY.md, 34-04-SUMMARY.md
started: "2026-08-08T19:50:00.000Z"
updated: "2026-08-08T20:00:00.000Z"
---

# Phase 34 UAT — Whole-Run Review & Confirmed Candidates

## Current Test

[testing complete]

## Tests

### 1. Staff can access /reviews page
expected: Navigate to /reviews; page loads staff-gated (no 404, no redirect to /sign-in)
result: pass

### 2. Legacy proposal queue still visible
expected: On /reviews, legacy Proposal/Accept queue still visible (unchanged from before Phase 34)
result: pass

### 3. v1.7 run-level review section appears
expected: /reviews shows separate v1.7 "Run-level Review" section with completed packet rows
result: pass

### 4. Packet metadata is complete
expected: Each packet shows targetType, subjectId, packetHash (64 hex chars), finding count, source count
result: pass

### 5. Packet can be expanded
expected: Click/tap to expand packet details; packet info opens inline
result: pass

### 6. Confirm/Dismiss decision buttons present
expected: Expanded packet shows "Confirm" and "Dismiss" buttons (staff-gated actions)
result: pass

### 7. Decision persists (no duplicate rows)
expected: After Confirm/Dismiss, reload page; decision is stored (one decision, one row in DB)
result: pass

### 8. Confirmed candidates projection works
expected: Navigate to Companies or Personas view; only confirmed evidence appears (no dismissed, no non-eligible)
result: pass

### 9. Packet immutability
expected: After deciding a packet, reload page; packet details (findings, sources, hash) are unchanged
result: pass

### 10. Auth scope (unauthenticated cannot access)
expected: Sign out, try to access /reviews; redirected to /sign-in (staff-gated)
result: pass

## Summary

total: 10
passed: 10
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

(none yet — add as issues are discovered during testing)
