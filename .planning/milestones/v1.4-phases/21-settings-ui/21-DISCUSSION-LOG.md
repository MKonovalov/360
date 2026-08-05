# Phase 21: Settings UI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-02
**Phase:** 21-settings-ui
**Areas discussed:** Provider switch UX, OpenRouter picker component, Badge + grouping design, Labels + cost warnings

---

## Provider switch UX

| Option | Description | Selected |
|--------|-------------|----------|
| Inline hint, auto-reset | Non-blocking inline hint under the provider selector; draft stays staged, user clicks Save | ✓ |
| Confirm dialog on reset | Small confirm when the switch changes the saved primary — more friction, explicit acknowledgment | |
| Silent switch, no hint | Switch provider silently; primary repopulates — cleanest but user may not notice | |

**User's choice:** Inline hint, auto-reset
**Notes:** D-07 draft-only preserved; no confirm dialog.

| Option | Description | Selected |
|--------|-------------|----------|
| Keep fallbacks, re-validate | Fallbacks stay exactly as staged; union pickers still render them; only staleness re-validated | ✓ |
| Clear fallbacks on switch | Simpler mental model but throws away staged work, fights draft preservation | |
| Keep only new-provider fallbacks | Half-measure that quietly deletes rows | |

**User's choice:** Keep fallbacks, re-validate
**Notes:** Cross-provider chains are the milestone's whole point — the UI must keep them legible, not discourage them.

| Option | Description | Selected |
|--------|-------------|----------|
| Above Primary label | Provider selector directly above the Primary model label — matches SET-01 wording | ✓ |
| Top of card, above title | More prominent but separates selector from what it controls | |
| Inline on Primary row | Compact but the provider↔primary relationship is less explicit | |

**User's choice:** Above Primary label

| Option | Description | Selected |
|--------|-------------|----------|
| Block Save on stale primary | Existing client staleness gate (D-10/D-11); hint explains why | ✓ |
| Always allow Save | Falls to server-side invalid_model | |
| Hint only, Save always enabled | Moves validation to the server | |

**User's choice:** Block Save on stale primary
**Notes:** Widen the existing client-side staleIds gate to the union servable set (D-21-14).

---

## OpenRouter picker component

| Option | Description | Selected |
|--------|-------------|----------|
| shadcn Command + Combobox | Vendor cmdk-based Command into ui/command.tsx + Combobox wrapper — standard shadcn searchable-select pattern | ✓ |
| Search Input + filtered Select | No new dependency but re-implements filtering + keyboard nav Command provides | |
| nuqs debounced search list | Copy explorers' pattern — consistent with search but not a real combobox | |

**User's choice:** shadcn Command + Combobox
**Notes:** Scout verified NO cmdk/command.tsx exists — the "Command already vendored" research claim refers to the explorers' nuqs debounced Input, not a Command primitive.

| Option | Description | Selected |
|--------|-------------|----------|
| Combobox everywhere | Replace Select for primary AND fallbacks — one consistent picker | ✓ |
| Combobox only for OpenRouter primary | Less churn but two picker patterns coexist | |
| Combobox only for fallbacks | Inverse split | |

**User's choice:** Combobox everywhere

| Option | Description | Selected |
|--------|-------------|----------|
| Search id + name + family | 'sonnet', 'anthropic/claude...', 'anthropic' all surface the right rows | ✓ |
| Search name only | Misses provider/family queries | |
| Search name + family | Misses raw id queries | |

**User's choice:** Search id + name + family

| Option | Description | Selected |
|--------|-------------|----------|
| Provider-grouped sections | SelectGroup-style headers inside the Command list — matches locked single-selector model (Conflict 6) | ✓ |
| Flat list + badges | Compact, less scannable at 336 rows | |
| Provider → family nested groups | More structure, more scrolling | |

**User's choice:** Provider-grouped sections
**Notes:** Family is a muted subtitle (D-21-11), not a second grouping level.

---

## Badge + grouping design

| Option | Description | Selected |
|--------|-------------|----------|
| Neutral slate badges | Gray badges with provider name — theme-consistent, AA-safe, no color semantics | ✓ |
| Color-coded per provider | Faster scan but adds AA + theme constraints | |
| No badges (grouping only) | Fails SET-05 same-name disambiguation | |

**User's choice:** Neutral slate badges

| Option | Description | Selected |
|--------|-------------|----------|
| Picker rows + chain entries | SET-05 requires both; chain-entry badge disambiguates saved cross-provider chains | ✓ |
| Picker rows only | Loses at-a-glance provider identity of saved chains | |
| Chain entries only | Sections already label provider inside dropdowns | |

**User's choice:** Picker rows + chain entries

| Option | Description | Selected |
|--------|-------------|----------|
| Muted family subtitle | Second line under model name — informative without another grouping level | ✓ |
| Family subgroup headers | More structure, more scrolling | |
| Search-only, not rendered | Cleanest but least information | |

**User's choice:** Muted family subtitle
**Notes:** Family also in the search index (D-21-07).

---

## Labels + cost warnings

| Option | Description | Selected |
|--------|-------------|----------|
| Row-level labels | 'always the latest' / 'free tier — 50 req/day shared' ride the row being chosen | ✓ |
| Picker-level legend banner | Cleaner rows but caveat easy to miss once scrolling | |
| Tooltip-on-suffix | Least noise but caveat hidden until hover | |

**User's choice:** Row-level labels

| Option | Description | Selected |
|--------|-------------|----------|
| Inline row warning | Cost caption styled distinctly on the offending row (e.g. $150/M o1-pro) | ✓ |
| Card-level banner when selected | Warns about the chain as a whole | |
| Both row + card | Most informative, slightly more UI | |

**User's choice:** Inline row warning

| Option | Description | Selected |
|--------|-------------|----------|
| Widen existing gate to union | Same staleIds behavior, servable list widens from anthropic-only to union | ✓ |
| Server-side only | Action already rejects unknown ids as invalid_model; client gate exists so users see it before Save | |
| Per-provider staleness | Equivalent to union-wide today (disjoint id spaces) | |

**User's choice:** Widen existing gate to union

---

## Claude's Discretion

- Hint copy wording for the provider-switch reset ("Primary model reset to [default] for [provider]")
- High-cost warning threshold (must trip `openai/o1-pro` at $150/M input; e.g. ≥$50/M input from snapshot `cost.input`)
- Command/Combobox vendoring structure (single command.tsx + wrapper; whether existing select.tsx usage is touched)
- Saved-chain recap shape (where chain-entry badges live after Save)
- Provider section header rendering inside the fallback Combobox (name vs badge+name)

## Deferred Ideas

- Per-slot provider selectors (Conflict 6 alternative) — revisit only if UAT shows the union picker is confusing
- Family subgroup headers — muted subtitle carries the info
- Card-level high-cost banner — inline row warnings suffice
- Color-coded provider badges — neutral slate first
- Vendor curation / trusted-labs filter — locked full-catalog decision; badges + egress context + cost captions ship instead
