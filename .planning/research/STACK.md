# Stack Research

**Domain:** v1.1 additions — Start Page, layout rework, CSV Import + enrichment API, Analytic ("Analyze") signal-detection agent
**Researched:** 2026-07-29
**Confidence:** HIGH (Context7-verified library/version data for AI SDK, Next.js, shadcn/ui, PapaParse; multi-source cross-checked vendor pricing for enrichment APIs)

> This file supersedes the v1.0 `STACK.md` (Astro→Next.js/Sanity→Neon migration research, now fully implemented — see `CLAUDE.md` Constraints). It covers **only the net-new stack needed for v1.1**. Everything already validated (Next.js 16 App Router, Neon + Drizzle, `@clerk/nextjs` + `requireStaffAccess()`, shadcn/ui `nova`/`radix-nova` preset, `nuqs`, `zod`, the never-throws GET-only Arcpedia fetch pattern) stays as-is and is not re-litigated here.

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `csv-parse` | **7.0.1** (already installed) | CSV → row parsing for Import | Already in `package.json` as a devDependency, already used in `src/scripts/seed.ts` (`parse(content, { columns: true, skip_empty_lines: true, trim: true })`) against the exact same `companyRowSchema`/`personaRowSchema` Zod schemas Import needs. Reusing it means the CSV import Server Action can call the identical validated-row pipeline the seed script already exercises — no new parsing library, no schema duplication. **Action needed:** move it from `devDependencies` to `dependencies` — it currently only runs under `tsx` at dev/seed time, but Import will execute it inside a production Server Action bundled into the app. |
| Apollo.io REST API (no SDK package) | API v1 (`api.apollo.io/api/v1`) | Commercial enrichment vendor for Import | Best fit of the four candidates for this stack — see full comparison below. Called via native `fetch()`, matching the existing `src/lib/arcpedia.ts` client pattern (module-level client fn, Zod-validated response, server-only API key). No official or credible community npm SDK worth adding — a thin typed wrapper (~40 lines) is simpler and matches project convention better than pulling in a third-party package for two endpoints. |
| `ai` | **^7.0.41** | AI SDK core — agent loop, tool calling, multi-step orchestration for the Analytic Agent | Current stable major (v7, GA — not the v5/v6 tags Context7 still lists as legacy channels). This repo is already an early-adopter stack (Next 16.2.11, React 19.2.4, Tailwind v4, shadcn v4) so pinning the current major here is consistent, not risky. v7 adds first-class multi-step `stopWhen`/timeout config and stabilized structured-output repair — both directly used by the signal-detection agent's search → propose loop. |
| `@ai-sdk/openai` | **^4.0.23** | Model provider + built-in `openai.tools.webSearch()` tool | See "AI SDK web search" analysis below — recommended default provider for the Analytic Agent. Version-aligned with `ai@7.0.41` (both pin `@ai-sdk/provider@4.0.4` + `@ai-sdk/provider-utils@5.0.14` — confirmed via npm registry metadata, not assumed). |
| shadcn/ui `dropdown-menu` | shadcn/ui `radix-nova` registry (matches installed `components.json` style) | The "Menu" button pattern (top-right of both list pages and both detail panels) | Not yet installed in `src/components/ui/` (confirmed — only `badge`, `button`, `input`, `scroll-area`, `select`, `separator`, `sheet`, `sidebar`, `skeleton`, `table`, `tooltip` exist today). Add via `npx shadcn@latest add dropdown-menu`; it generates against the already-configured `radix-nova` style (`components.json: "style": "radix-nova"`) and imports from the **already-installed** consolidated `radix-ui` package (`^1.6.5` in `package.json`) — no new Radix primitive dependency, this repo already migrated off individual `@radix-ui/react-*` packages. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@ai-sdk/anthropic` | ^4.0.23 | Alternative single-vendor model + built-in `anthropic.tools.webSearch_20250305()` | Use instead of `@ai-sdk/openai` if the team prefers to consolidate AI spend/billing on Anthropic, or if OpenAI's web search results prove weaker for GBS/SSC-transformation-specific press. Functionally equivalent pattern; requires enabling web search in the Anthropic Console first (an extra one-time setup step OpenAI doesn't have). |
| `zod` | ^4.4.3 (already installed) | Structured-output schema for the agent's `proposeSignal` tool, Apollo response validation, CSV row validation | Already the project's validation library everywhere (Arcpedia response schema, seed row schemas). Reuse directly — AI SDK's tool `inputSchema` and Apollo response parsing both take a Zod schema exactly like `arcpediaSearchResponseSchema` already does. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `npx @ai-sdk/codemod v7` | One-time migration helper if a lower AI SDK version ever gets installed by mistake | Not needed for a fresh install — only relevant if `ai@5`/`ai@6` gets pinned first and needs upgrading later. |
| `npx shadcn@latest add dropdown-menu` | Pulls the `DropdownMenu*` component set into `src/components/ui/dropdown-menu.tsx` | Not a runtime dependency — CLI-generated source file, same as every other file in `src/components/ui/`. |

## Installation

```bash
# Core: Analytic Agent (AI SDK + primary model/search provider)
npm install ai@^7.0.41 @ai-sdk/openai@^4.0.23

# Optional: single-vendor alternative if consolidating on Anthropic instead
npm install @ai-sdk/anthropic@^4.0.23

# csv-parse is already installed as a devDependency — reinstall as a
# production dependency since Import runs it inside a bundled Server Action,
# not just the standalone seed script
npm uninstall csv-parse
npm install csv-parse@^7.0.1

# Menu button UI (uses the already-installed `radix-ui` package)
npx shadcn@latest add dropdown-menu

# No package install for Apollo.io — plain fetch() client in src/lib/apollo.ts,
# following the existing src/lib/arcpedia.ts convention
```

New env vars (add to `src/lib/env.ts` following the existing optional/`.catch(undefined)` degrade pattern used for the Arcpedia vars — enrichment and the agent are both user-triggered features, not core-path, so they must not fail-fast the whole app if unset):

```ts
APOLLO_API_KEY: z.string().optional(),
OPENAI_API_KEY: z.string().optional(), // or ANTHROPIC_API_KEY if that path is chosen
```

`next.config.ts` needs one addition for the CSV Import Server Action — Next.js defaults Server Action request bodies to **1MB** (confirmed via Next.js source: `defaultActionBodySizeLimit = '1 MB'`), which a few-hundred-to-few-thousand-row Company/Persona CSV can realistically exceed:

```ts
const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb',
    },
  },
  // ...existing config
};
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| `csv-parse` (already installed) | PapaParse | Never for this project — PapaParse (`5.5.4` latest) is a browser-first library (worker threads, `download: true` over HTTP) whose Node story is a secondary use case; `csv-parse` is already in the stack, Node-native, RFC 4180 compliant, and already wired to the exact Zod row schemas Import needs. Adding PapaParse would mean two CSV parsers doing the same job. |
| Apollo.io | Clearbit / HubSpot Breeze Intelligence | Only if ArcLumen Partners already has a **paid HubSpot subscription** they want to route enrichment spend through — HubSpot acquired Clearbit in late 2023 and, as of 2026, its enrichment API is sold exclusively as a credit-based add-on **on top of** a paid HubSpot plan (~$65/mo realistic floor: $20/mo HubSpot + $45/mo for 100 credits), and the standalone Clearbit API is being sunset. Not usable as an independent API for a non-HubSpot app. |
| Apollo.io | ZoomInfo | Only at much larger scale/budget. No self-serve signup, no public trial without a sales call, and annual contracts starting around $15K/yr (most teams pay $25K–$60K/yr). Wrong shape entirely for a small internal tool. |
| Apollo.io | Clay | Only if the team wants a no-code enrichment-waterfall **workbook UI** (spreadsheet-style, multi-provider cascading) rather than a simple API call from inside this app. Clay's own programmatic "Clay API" is gated to its Enterprise tier (custom pricing); the $495/mo Growth tier's "HTTP API integrations" is Clay *consuming* other APIs inside its tables, not Clay exposing a simple lookup endpoint for us to call. Higher price floor ($185–495/mo) for a capability (no-code waterfalls) this app doesn't need — it already has its own DB/UI. |
| `@ai-sdk/openai` + built-in `webSearch()` | `@ai-sdk/anthropic` + built-in `webSearch_20250305()` | Equally valid — pick this if consolidating AI vendor billing on Anthropic, or if the team already has Claude usage elsewhere. Slightly more setup (must enable web search in the Anthropic Console first). |
| Built-in provider web search tool | Dedicated search provider (`@exalabs/ai-sdk` / Exa, `@tavily/ai-sdk` / Tavily, `@perplexity-ai/ai-sdk` / Perplexity Search) | Add one of these **only if** the built-in OpenAI/Anthropic web search proves too generic for ArcLumen's niche vocabulary (GBS/SSC transformation, CFO/GBS-head changes, cost-pressure signals). They plug in as an additional AI SDK tool alongside the custom `proposeSignal` tool with no change to the agent's control flow — the SDK's model-agnostic tool interface makes swapping search providers a low-cost experiment later, not an architecture decision now. Exa in particular is worth trying first if this happens — its neural/semantic search tends to do better on niche B2B terminology than keyword-oriented search. |
| Built-in-search + custom `proposeSignal` tool | Perplexity Sonar as the **primary model** (not just a search tool) | Sonar's native web-grounding is excellent for synthesized-answer use cases, but it is less proven for the mixed workload this agent needs (native search **plus** a custom `proposeSignal` structured tool call in the same turn). OpenAI/Anthropic's mature function-calling + built-in-search combo is the safer default for a review-queue-producing agent; Perplexity remains a fine fallback search *tool* (not model) if needed later. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| Clearbit standalone API | Sunset since Dec 2023; folded into HubSpot Breeze Intelligence, requires a paid HubSpot subscription as a prerequisite. Not independently usable. | Apollo.io |
| ZoomInfo (for this project's scale) | No self-serve tier, sales-gated, $15K+/yr contracts — wrong cost/complexity class for a small internal team tool. | Apollo.io |
| Clay (as the enrichment *API*) | It's a workflow/orchestration product, not a simple lookup API; its own API access sits behind the Enterprise tier. Wrong shape for "call an endpoint from a Server Action." | Apollo.io |
| A custom multipart/form-data parser (`busboy`, `formidable`) | Next.js Server Actions and Route Handlers already parse `FormData` (including `File` entries) natively via the standard `Request`/`FormData` Web APIs — confirmed in Next.js's own action-handler source (`fakeRequest.formData()`). Adding a multipart parser library duplicates built-in functionality. | Native `request.formData()` / Server Action `FormData` argument, then `await file.text()` into `csv-parse` |
| PapaParse alongside `csv-parse` | Two CSV parsers with overlapping responsibility; `csv-parse` is already installed and already wired to this project's row-validation schemas. | `csv-parse` (existing) |
| Defaulting straight to a third-party search provider (Exa/Tavily/Perplexity) for the Analytic Agent | Adds a second vendor account/API key/bill for a low-volume, internal, click-triggered feature before the built-in provider tool has even been tried. Built-in `webSearch()`/`webSearch_20250305()` tools already return `sources` (URL list) suitable for the review queue, at roughly one cent per search. | Start with the built-in OpenAI (or Anthropic) web search tool; add a dedicated provider only if result quality demonstrably falls short on ArcLumen's niche terms |
| Individual `@radix-ui/react-dropdown-menu` package | This repo already migrated to the consolidated `radix-ui` package (`^1.6.5`) — adding the per-primitive package back would reintroduce the exact duplication shadcn's own `migrate radix` codemod was built to eliminate. | `npx shadcn@latest add dropdown-menu` (imports from the already-installed `radix-ui` package) |

## Stack Patterns by Variant

**If the team wants the lowest-friction, single-vendor Analytic Agent setup:**
- Use `@ai-sdk/openai` + `openai.tools.webSearch({ searchContextSize: 'high' })` paired with a custom `proposeSignal` tool (Zod `inputSchema` matching the review-queue row shape: signal type, headline, source URL, published date, rationale/confidence). Run as a single `generateText` call with `stopWhen: isStepCount(4–6)` so the model can search, re-search with a refined query, and then emit one or more `proposeSignal` tool calls.
- Because: one API key (`OPENAI_API_KEY`), no extra search vendor, and the agent's structured output *is* the tool-call arguments — no separate `generateObject` pass needed. Critically, `proposeSignal` should have **no `execute`** that writes to the live `signals` table — the Server Action reads `result.toolCalls` and inserts into a separate review-queue table, which is what actually enforces "no auto-write" (per PROJECT.md's v1.1 scope), not the AI SDK layer itself.

**If ArcLumen already has (or plans) a paid HubSpot subscription for other reasons:**
- Use HubSpot Breeze Intelligence instead of Apollo.io for enrichment.
- Because: it may already be a sunk cost, and the credit pricing model is broadly similar. Otherwise Apollo.io is strictly simpler to integrate (plain REST + API key, no HubSpot object model to map Company/Persona into).

**If Import volume grows well beyond "a few thousand rows per upload":**
- Move CSV parsing from a Server Action (subject to Next's request-body handling even after raising `bodySizeLimit`) to a Route Handler (`src/app/api/import/route.ts`) reading `request.formData()` directly, and consider streaming (`csv-parse` supports a streaming/Node-stream mode, not just `csv-parse/sync`) instead of buffering the whole file into memory.
- Because: `csv-parse/sync` (used by the seed script and fine for CSV import at ArcLumen's current data scale) buffers the entire parsed result in memory — acceptable for hundreds/low-thousands of ICP rows, not for arbitrarily large imports.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|------------------|-------|
| `ai@7.0.41` | `@ai-sdk/openai@4.0.23`, `@ai-sdk/anthropic@4.0.23` | Confirmed via npm registry metadata: all three resolve to the same underlying `@ai-sdk/provider@4.0.4` + `@ai-sdk/provider-utils@5.0.14` — not just "same major," actually version-pinned identical. |
| `@ai-sdk/openai@4.0.23` / `@ai-sdk/anthropic@4.0.23` | `zod@^4.4.3` (already installed) | Both providers declare `peerDependencies: { zod: "^3.25.76 \|\| ^4.1.8" }` — the project's existing zod install satisfies this without a bump. |
| `csv-parse@7.0.1` | Node 22.x (this project's runtime) | Pure Node/JS parser, no native bindings, no runtime constraint beyond what's already pinned in `package.json` `engines`. |
| `radix-ui@1.6.5` (already installed) | shadcn `dropdown-menu` (radix-nova style) | The `dropdown-menu` component generated by `npx shadcn@latest add dropdown-menu` imports from the consolidated `radix-ui` package this repo already uses (confirmed via shadcn's own `migrate radix` tooling, which moved this exact ecosystem from per-primitive `@radix-ui/react-*` packages to the single `radix-ui` package) — no version conflict, no new primitive dependency. |
| Next.js 16.2.11 (already installed) | `experimental.serverActions.bodySizeLimit` | Config key confirmed current in Next.js canary/stable docs; default is 1MB, string sizes like `'5mb'` are accepted. |

## Sources

- Context7 `/vercel/ai` — web search tool patterns (OpenAI `webSearch()`, Anthropic `webSearch_20250305()`, Exa/Tavily/Perplexity dedicated provider packages, AI Gateway `gateway.tools.*`), HIGH confidence
- Context7 `/mholt/papaparse` — Node streaming API, used to confirm PapaParse's browser-first orientation vs. `csv-parse`'s Node fit, HIGH confidence
- Context7 `/shadcn-ui/ui` — `dropdown-menu` component composition, `radix-ui` unified-package migration path, HIGH confidence
- Context7 `/vercel/next.js` — Server Actions `FormData`/`File` handling (native, no multipart library needed) and `bodySizeLimit` default (1MB) + config shape, HIGH confidence
- npm registry (`npm view`) — exact version/peer-dependency alignment for `ai@7.0.41`, `@ai-sdk/openai@4.0.23`, `@ai-sdk/anthropic@4.0.23`, `csv-parse@7.0.1`, HIGH confidence
- WebFetch `docs.apollo.io/docs/enrich-people-data`, `docs.apollo.io/reference/organization-enrichment` — auth model (`x-api-key` header), request/response JSON shape, credit cost, HIGH confidence
- WebSearch (multiple independent sources cross-checked: Landbase, Cognism, Cleanlist, MarketBetter, UpLead, Lindy, Warmly) — Clearbit/HubSpot Breeze pricing and sunset status, Apollo.io pricing tiers/free-tier credits, ZoomInfo enterprise-only pricing, Clay pricing/API tier gating — MEDIUM confidence (pricing pages change; vendor *fit/shape* conclusions are HIGH confidence, exact dollar figures should be re-verified at implementation time)
- WebFetch `raw.githubusercontent.com/vercel/ai/main/content/cookbook/05-node/56-web-search-agent.mdx` — native-vs-tool-based search tradeoff framing, multi-step `stopWhen`/`isStepCount` mechanics, MEDIUM confidence (cookbook doc, not core API reference)
- Direct repo inspection (`package.json`, `components.json`, `src/lib/env.ts`, `src/lib/arcpedia.ts`, `src/scripts/seed.ts`, `src/app/actions.ts`) — confirmed existing installed versions, established patterns to extend rather than replace, HIGH confidence

---
*Stack research for: ArcLumen 360 v1.1 (Start Page + Import + Analytic Agent)*
*Researched: 2026-07-29*
