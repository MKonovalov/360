# Phase 26: Settings UI — Discussion Log

**Date:** 2026-08-04
**Status:** Context captured

## Areas Discussed

| Area | Options Presented | Selection | Notes |
|------|-------------------|-----------|-------|
| SET-03 Caption ordering | Endpoint first / Suffix first | Endpoint first | `· Zen · free tier — 50 req/day` — endpoint is the primary identity cue |
| SET-03 Recap scope | Pickers + recap / Pickers only | Pickers + recap | Saved chain must disambiguate Zen vs Go after save |
| SET-03 Search index | Include 'zen'/'go' / Visual only | Include | Typing "go" filters Go-endpoint rows |
| SET-04 Hermes caveat | Uniform family label / Per-model tuning / Limitation caveat | Uniform family label | `· chat/reasoning-tuned` on both 70b + 405b |
| SET-04 Mirror cost | Hide cost / Placeholder | Hide cost | OpenRouter mirror rows carry no cost data; absence is honest |
| SET-05 Badge content | Provider-only / Badge+endpoint composite | Provider-only | Endpoint lives in captions + recap only |
| SET-05 Badge styling | Uniform secondary / 4 tinted variants | Uniform secondary | No new badge tokens |
| SET-02 Selector label | Plain 'OpenCode' / 'OpenCode (Zen + Go)' | Plain | Provider-level identity at top level |
| SET-02 Endpoint switch hint | Endpoint-aware hint / Silent re-badge | Endpoint-aware hint | "now serves via OpenCode Zen" on keep-if-valid across anthropic→opencode |
| SET-02/06 Sparse provider UX | Silent / Sparse-provider note | Silent | NousResearch 2-row picker speaks for itself |

## Decisions

10 decisions captured (D-26-01 through D-26-10) — see `26-CONTEXT.md` `<decisions>`.

## Deferred

None.
