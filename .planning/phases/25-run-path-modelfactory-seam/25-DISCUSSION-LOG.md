# Phase 25: Run Path / modelFactory Seam - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-04
**Phase:** 25-run-path-modelfactory-seam
**Areas discussed:** Anthropic-Instance Topology, Structured-Output Degrade Path, shouldAdvance Matrix, Env-Gate Widening + Defaults

---

## Anthropic-Instance Topology

| Option | Description | Selected |
|--------|-------------|----------|
| Two instances, url-dispatch | Two module-scope createAnthropic instances (zen + go baseURLs), same OPENCODE_API_KEY, dispatch by matched row's api.url — symmetric with openai-compatible pair | ✓ |
| Single anthropic, Go via compat | One createAnthropic(zen) + route Go anthropic-npm rows through the Go openai-compatible instance — breaks api.npm→SDK mapping, risks /v1/messages vs /v1/chat/completions mismatch | |
| One instance, zen only | Research literal: single createAnthropic({baseURL: zen}) — 404s/misroutes the 6 Go Claude rows | |

**User's choice:** Two instances, url-dispatch
**Notes:** The regenerated snapshot (Phase 24) has 20 anthropic-npm rows spanning BOTH Zen (14) and Go (6) endpoints — research was written pre-Phase-24 with the 18-row go roster. Instance naming: anthropicZen/anthropicGo, real-Anthropic `anthropic` instance untouched.

## Structured-Output Degrade Path

| Option | Description | Selected |
|--------|-------------|----------|
| Instance-only flag, no runAgent change | supportsStructuredOutputs unset (false) on all new instances; Output.object degrades to json_object inside the provider; probe deferred to Phase 27 VER-05 | ✓ |
| Add runAgent fallback handling | Detect the degrade warning, retry with explicit json mode — contradicts dist-verified 'still works' finding, adds unneeded surface | |

**User's choice:** Instance-only flag, no runAgent change
**Notes:** The json_object degrade + client-side validation is the same path already used for non-strict openrouter rows — precedent exists in the codebase.

## shouldAdvance Matrix

| Option | Description | Selected |
|--------|-------------|----------|
| Test-widening, verify-only | from!==to already treats Zen↔Go as same-provider (getProviderForModelId returns logical 'opencode' for both snapshot ids) — extend 4-cell matrix tests, zero production change | ✓ |
| Code change for snapshot-level | shouldAdvance accepts snapshot-level providerIDs — contradicts D-20-07 (logical identity only) | |

**User's choice:** Test-widening, verify-only
**Notes:** Verified in catalog.ts: SNAPSHOT_PROVIDER_IDS.opencode = ['opencode','opencode-go'] and getProviderForModelId collapses both to 'opencode'. 402 stays never-eligible; 404/5xx/connection provider-agnostic.

## Env-Gate Widening + Defaults

| Option | Description | Selected |
|--------|-------------|----------|
| Extend 4 providers, logical-id mapping | missingProviderKey widens to all 4 ModelProviderIds; dual-id→single-key free via getProviderForModelId collapse | ✓ |
| Snapshot-level key mapping | Map opencode AND opencode-go separately → requires different identity source, contradicts catalog-derived doctrine | |

**User's choice:** Extend 4 providers, logical-id mapping

**Follow-up (defaultChain):**
| Option | Description | Selected |
|--------|-------------|----------|
| Keep Anthropic fast path | defaultChain stays [anthropic(FAST_MODEL_ID)] — D-11 doctrine; PROVIDER_DEFAULT_MODELS remain Phase 26 reset targets | ✓ |
| Change default behavior | Provider-aware no-settings default — breaks D-11 lock, conflates 'no settings' with 'reset target' | |

**User's choice:** Keep Anthropic fast path
**Notes:** Guard pattern preserved: has(provider) && !key → return key, first-hit wins, all-or-nothing at run entry.

## Claude's Discretion

- Naming for the two openai-compatible instances (must mirror anthropicZen/anthropicGo convention).
- Exact dispatch helper shape for the scoped-row find (Anti-Pattern 1 mandatory).

## Deferred Ideas

- Live key-backed json_schema probe (supportsStructuredOutputs flip) — Phase 27 VER-05.
- Vercel env declaration of NOUSRESEARCH_API_KEY + OPENCODE_API_KEY — operator dashboard action.
- OpenCode GPT-5/Gemini rows — v2 deferred.
