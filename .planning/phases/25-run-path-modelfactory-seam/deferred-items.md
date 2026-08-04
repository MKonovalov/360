# Deferred Items — Phase 25

Out-of-scope discoveries logged per the executor scope boundary (do NOT auto-fix).

| Item | Found during | Description | Resolution |
|------|--------------|-------------|------------|
| Pre-existing live-test failure: `src/lib/agents/openrouter-only-chain.test.ts` fails `out.ok === true` | 25-01 Task 3 wave-suite run (npm test) | VER-03 child-env probe returns `{"ok":false,"modelUsed":null,"modelChain":null}` against the LIVE OpenRouter API — the documented uncredited-key limitation (STATE.md Blocker: OPENROUTER_API_KEY limit null, is_free_tier true → 402 billing). Verified pre-existing: fails identically at baseline commit 2f1c51fe (before any 25-01 commits). | Not a 25-01 regression; openrouter dispatch branch byte-identical (git diff empty). Waits on key top-up (STATE.md Blockers + Operator Next Steps). |
