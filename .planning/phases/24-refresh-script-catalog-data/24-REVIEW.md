---
phase: 24-refresh-script-catalog-data
reviewed: 2026-08-04T12:15:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - scripts/refresh-model-catalog.ts
  - src/lib/agents/modelFactory.ts
  - src/lib/models/catalog.json
  - src/lib/models/catalog.test.ts
  - src/lib/models/catalog.ts
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 24: Code Review Report

**Reviewed:** 2026-08-04T12:15:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Phase 24 restructures the committed catalog snapshot from flat `{ generatedAt, models }` to grouped `{ generatedAt, providers: { <providerID>: [...] } }`, adds the `getAllModels()` flattening helper, and extends the refresh script with the Nous roster pipeline (`fetchNousRoster`, `deriveNousFamily`, `perMTok`, `nousPreMap`) and the strict Zen/Go drift check (`verifyZenGoRosters`) with the user-approved 7-id Go exception.

The migration itself is faithful and well-executed:

- **Row preservation / grouped-shape fidelity verified:** 1427 rows across 9 provider groups; every row's `providerID` matches its group key; all rows are shape-total (string/number/boolean fields complete, zero shape violations).
- **Canaries are non-vacuous and all pass (53/53 tests green).** I re-derived every hardcoded constant from the committed snapshot independently: opencode servable 40 (npm split 23/17 ✓), dedup pool 66 ✓, 12 dual Zen-kept + 6 go-exclusive ✓, nousresearch 292 rows / 11 `~latest` aliases / structuredOutputs 214-true/78-false ✓, hermes pins 0.05/0.2 and 0.09/0.37 with context 131072 ✓, openrouter ≥300 all-slash ✓, anthropic servable exactly `['claude-sonnet-4-6']` ✓, union deduped at 377 ✓.
- **Drift-check logic verified live end-to-end:** Zen 60/60 clean (no drift), Go 25-live vs 18-CLI with `missing` = exactly the 7 pinned ids, all accepted as known drift, `unexpectedMissing`/`extra` empty, no throw. The Set-diff (`missing` = live-only, `extra` = CLI-only) is correct; the exception is correctly scoped to `label === 'Go'` and to live-only ids only (any CLI-only id still throws); Zen stays fully strict.
- **Threat model holds:** all roster GETs anonymous (no API keys in the script), every fetch failure throws before `writeFileSync`, single atomic write at the end, defensive `?? []` + `typeof` guards on roster shapes.
- **Migration cross-file consistency:** the only direct `.models` reads (`getModelDisplayName`, `dedupeProviderRows`, `modelFactory.instantiateModel`) all route through `getAllModels`; the sole remaining `.models` hit in `src/` is `model-picker.tsx:140`'s *local* `CommandGroup` structure, not the catalog shape. I compared display names for all 377 servable ids old-snapshot vs new: **0 changed** — the flatten-order change caused no user-visible naming regression despite 310 dual-listed ids having cross-group name differences.

Three warnings: the most significant is a cross-file inconsistency where this phase makes the NousResearch hermes pins union-servable (and asserts they resolve through the gate in its own canary) while `instantiateModel` still throws for them; plus two script robustness gaps (silent single-line-record drop in `parseModels`, NaN pricing propagation through `perMTok`). Four info items are stale comments or latent footguns.

## Warnings

### WR-01: `instantiateModel` throws for nousresearch/opencode ids — newly reachable for hermes pins in this phase

**File:** `src/lib/agents/modelFactory.ts:57-79` (cross-file: `src/app/actions/settings.ts:41-45`, `src/lib/agents/modelConfig.ts:117`, `src/lib/agents/analyzeCompany.ts:54-63,106`)

**Issue:** `instantiateModel` dispatches only `anthropic` and `openrouter`; anything else hits the backstop `throw new Error('unsupported provider for model …')` (line 79), justified as "unreachable post-gate (union validation + chain resolution exclude non-servable ids)". That premise is now false for NousResearch: the old snapshot held 0 nousresearch rows, so the union servable set excluded the hermes pins pre-Phase-24 — but this phase lands the 292-row roster, the `NOUSRESEARCH_ALLOWLIST` pins become union-servable (verified: `nousresearch/hermes-4-70b` and `nousresearch/hermes-4-405b` are both in the 377-id union used by `saveSettingsAction`), and the phase's own D-24-12 canary (`catalog.test.ts:392-397`) asserts they resolve to `'nousresearch'` through the gate. The full reachable path is: user switches the provider selector to NousResearch (Phase 21 reset prefills `PROVIDER_DEFAULT_MODELS.nousresearch` = `nousresearch/hermes-4-70b`) → saves (union gate passes) → `resolveModelChain` keeps the id → `missingProviderKey` **silently skips** nousresearch/opencode (the filter is `p !== null` and only anthropic/openrouter keys are checked, `analyzeCompany.ts:54-63` — no env gate intercepts) → `instantiateChain` at `analyzeCompany.ts:106` → `instantiateModel` **throws** → `isMisconfigurationError` doesn't match ("unsupported provider…" contains neither "not configured" nor "api key") → `classifyModelError` → `'input'` → not failover-eligible → rethrown → 500 on every Analyze run for that user. The opencode half of this gap (e.g. `big-pickle`, `claude-sonnet-5`) predates Phase 24; the nousresearch half is newly reachable *by this phase's own data change* and is the exact class of id the phase promotes.

**Fix:** Either (a) wire the nousresearch branch (the `@ai-sdk/openai-compatible` provider against `https://inference-api.nousresearch.com/v1`, mirroring the openrouter row lookup incl. the D-08 `structuredOutputs` flag path) and the opencode branch, or (b) if provider SDK wiring is a later phase, keep the hermes pins out of the union servable set until then (e.g. leave `NOUSRESEARCH_ALLOWLIST` empty) so the save action rejects them and the "unreachable post-gate" comment becomes true again. At minimum, correct the comment at `modelFactory.ts:77-79` — the phase's own canary disproves it — and extend `missingProviderKey` to not silently drop providers it has no key story for.

### WR-02: `parseModels` silently drops single-line (compact) JSON records

**File:** `scripts/refresh-model-catalog.ts:59-77`

**Issue:** The finalize check `if (depth <= 0)` lives only in the `else` branch (subsequent lines). When a record is balanced on its opening line (a one-line compact JSON record — `depth = braceDelta(line)` returns 0 on line 1), the check never runs for that record: it stays in the buffer, the *next* header line gets appended, `JSON.parse` fails, and the record is silently discarded. Reproduced: input `provider/x\n{"id":"c"}\nprovider/y\n{…"id":"d"…}` parses to only `["d"]` — record `c` is lost. The current CLI emits multi-line pretty JSON, so this is latent today, but a CLI output-format change (or a vendor-emitted single-line row) would silently drop rows. For `opencode`/`opencode-go` rows the Zen/Go drift check would catch the loss (throw), but for `openrouter`/`anthropic`/`google`/`kilo`/`vercel`/`openai` rows a dropped record is **permanently and silently absent from the committed snapshot** — no canary asserts those group counts (only openrouter ≥300).

**Fix:** After the opening line, finalize immediately when depth returns to 0:
```ts
if (buffer.length === 0) {
  if (!line.startsWith('{')) continue; // header / blank line
  buffer.push(line);
  depth = braceDelta(line);
  if (depth <= 0) { /* finalize block (extract shared close-block helper) */ }
} else { /* existing path */ }
```

### WR-03: `perMTok` propagates NaN into the snapshot (renders as `null` costs), breaking the total-shape invariant

**File:** `scripts/refresh-model-catalog.ts:207-209` (used at `229-230` in `nousPreMap`)

**Issue:** `perMTok` returns `Math.round(parseFloat(perToken ?? '0') * 1e12) / 1e6`. For a non-numeric pricing string (e.g. `"N/A"`, or any upstream format change), `parseFloat` yields `NaN`, `Math.round(NaN)` is `NaN`, and `JSON.stringify(NaN)` renders `null` — so the committed snapshot would contain `"cost": { "input": null, … }`, violating the script's own "shape stays total and deterministic" contract and the `CatalogModel` `number` typing at runtime (`trimRecord`'s `?? 0` does **not** catch NaN — `NaN ?? 0` is `NaN`). Downstream, `settings/page.tsx:63-64` reads `m?.cost?.input ?? 0` — `null ?? 0` is 0, so the UI degrades to $0 silently rather than failing loudly. The current Nous roster is verified numeric-string, so this is a robustness gap, not a live bug — but it is the one place the script's otherwise consistent defensive posture (`?? []`, `typeof` guards) is absent on a value that feeds the runtime snapshot.

**Fix:**
```ts
function perMTok(perToken: string | undefined): number {
  const n = parseFloat(perToken ?? '0');
  return Number.isFinite(n) ? Math.round(n * 1e6 * 1e6) / 1e6 : 0;
}
```
(or `throw` to honor the throws-not-degrades contract on shape changes — 0 keeps the snapshot total).

## Info

### IN-01: Stale data comments in `settings/page.tsx` now misdescribe the Phase-24 snapshot

**File:** `src/app/(dashboard)/settings/page.tsx:44, 51-52, 76-79`

**Issue:** Three comments describe pre-refresh numbers that Phase 24 changed: line 44 "catalog.json (1131 rows" — the snapshot now holds 1427 rows; lines 76-79 "375 rows — 336 openrouter + 1 anthropic + 39 opencode servable − 1 overlap … nousresearch contributes 0 rows until Phase 24 lands them" — the union is now 377 (337 openrouter + 2 nousresearch + 1 anthropic + 40 opencode − 3 overlaps) and Phase 24 *has* landed nousresearch; lines 51-52 "the 5 go-exclusive opencode-go ids (…)" — there are now 6 (`qwen3.8-max` added). The line-79 clause describing a pre-Phase-24 state ("until Phase 24 lands them") is actively misleading in the phase that landed them.

**Fix:** Update the counts/formula, and rephrase the "nousresearch contributes 0 rows until Phase 24 lands them" clause to reflect the current 2-pin contribution.

### IN-02: Script comment says `top_provider.max_completion_tokens` is null for 66/292 rows; the regenerated snapshot has 67 rows with output limit 0

**File:** `scripts/refresh-model-catalog.ts:159`

**Issue:** `NousRosterRow`'s comment ("null for 66/292 rows") is off by one against the committed snapshot (67 of 292 nous rows have `limit.output: 0`). Pure doc drift — no test asserts this count — but it will mislead the next reader updating the comment.

**Fix:** Re-lock the count to 67 (or drop the specific number).

### IN-03: D-06 comment overclaims "names agree so the first match is safe" — 310 dual-listed ids have differing names across groups

**File:** `src/lib/models/catalog.ts:40-43`

**Issue:** The comment's premise is factually false at dataset scale: 310 ids (e.g. `nousresearch/hermes-4-70b` → "Nous: Hermes 4 70B" vs "Hermes 4 70B"; `deepseek-v4-flash` → "DeepSeek V4 Flash 0731" vs "DeepSeek V4 Flash (New)") have differing names across provider groups. The *behavior* is nonetheless safe — I verified all 377 servable ids keep the same display name pre- vs post-migration (0 changed) — so no fix is required functionally, but the comment should state the real invariant: "the first match is safe *because every servable id's name agrees across the groups that can win first-match in flatten order*", or acknowledge that cross-group name divergence exists and is tolerated.

**Fix:** Reword the comment to match reality (names diverge across kilo/vercel/openrouter mirrors; first-match is safe for servable ids only).

### IN-04: `familyFallbackStructuredOutputs` misclassifies the hermes family (returns true for a provider that does not advertise `structured_outputs`); `?? []` guards convert shape changes into silent degradation

**File:** `scripts/refresh-model-catalog.ts:153-155, 348-350` (and the `?? []` guards at `142, 189, 285`)

**Issue:** The fallback `!/qwen|llama|deepseek|mistral|gemma|glm/.test(family)` returns `true` for the `hermes` family — but hermes advertises `response_format`, **not** `structured_outputs` (the phase's own Pitfall-5 doctrine, locked in the D-24-12 canary as `structuredOutputs: false`). The fallback is documented "effectively unreachable" (verified 100% join coverage), so there is no live impact today, but it is a footgun: if the OpenRouter live join ever misses a hermes mirror row (e.g. the `?? []` at line 142 converts an API shape change into an empty map instead of a throw), the row silently ships with the wrong flag — precisely the misclassification class the phase exists to prevent. Note the same silent-shape-degradation applies to `fetchNousRoster`'s `?? []` (a nous-roster shape change → 0 rows → a nous-less snapshot written successfully; today only the D-24-12 test canary catches it, not the script).

**Fix:** Make the fallback conservative (default `false` unless the live join proves support — the join is the only authoritative source), or remove it and let a missed join surface via the missing-id asymmetry; optionally add an in-script guard that aborts if `nousRows.length === 0`.

---

_Reviewed: 2026-08-04T12:15:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
