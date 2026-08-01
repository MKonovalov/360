---
status: complete
phase: 09-analytic-agent-observability
source: [09-01-SUMMARY.md, 09-02-SUMMARY.md, 09-03-SUMMARY.md]
started: 2026-08-01T09:26:57Z
updated: 2026-08-01T09:34:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 7
name: Unauthenticated access is blocked
expected: |
  Anonymous users hitting the analyze route handler or reviews
  actions are redirected/blocked; staff-only gating holds.
result: pass

## Tests

### 1. Analyze a Company produces proposals
expected: On a company detail page, Menu → Analyze triggers the run feedback strip (running → success) and the analyzed proposal lands in the /reviews queue with inline evidence — NOT auto-written as a live signal (Accept must be explicit).
result: pass

### 2. Review queue renders proposal cards
expected: /reviews lists pending proposals: company name, evidence link, snippet, R/C ratings, Accept and Reject controls per card.
result: pass

### 3. View trace links to Langfuse
expected: Each proposal card's "View trace" link opens the matching Langfuse trace for the agent run that produced it (traceId/traceUrl persisted with the run).
result: pass

### 4. Accept a proposal creates exactly one live signal
expected: Accept → proposal disappears from queue, live signal appears on the company, and repeated/duplicate accept attempts do not duplicate the signal (ONE Accept = ONE Signal).
result: pass

### 5. Reject a proposal records a correction
expected: Reject → dialog requires a reason (note required when reason = Other), confirmation removes the card, and the correction mirrors to Langfuse as an annotation.
result: pass
note: issue found + fixed during UAT — annotation missing in Langfuse. Root cause: langfuseClient undefined on Server Action cold starts (initLangfuse only ran in Analyze route) + score.create never flushed (batch queue). Fixed in src/lib/telemetry/langfuse.ts (lazy getLangfuseClient + await client.flush()). Live-verified 2026-08-01: correction score visible on trace.

### 6. Pending badge surfaces proposal count
expected: Company detail shows an amber pending badge when proposals exist; sidebar Reviews entry shows the global pending count.
result: pass

### 7. Unauthenticated access is blocked
expected: Anonymous users hitting the analyze route handler or reviews actions are redirected/blocked; staff-only gating holds.
result: pass
