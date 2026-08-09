# Stack Research

**Domain:** Custom structured-research agent constructors in an existing Next.js/Neon application
**Researched:** 2026-08-09
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Existing Next.js App Router | Repository-pinned | `/agents` management route and Server Actions | Reuses the authenticated page/action patterns already proven by v1.7. |
| Existing Neon Postgres + Drizzle ORM | Repository-pinned | Agent definitions, immutable versions, lifecycle, and run snapshots | Relational constraints and append-only history fit custom-agent identity, compatibility, and audit requirements. |
| Existing provider-agnostic executor/modelFactory/Firecrawl seams | v1.7 contracts | Execute custom agents without adding a research provider | Keeps v1.7's source-grounded and provider-agnostic boundary intact; Exa is research input, not a v1.8 dependency. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Existing Zod validation | Repository-pinned | Validate submitted agent configuration and normalized JSON-schema-like output configuration | At the Server Action boundary and before creating a runnable version. |
| Existing Vitest harness | Repository-pinned | Contract, security, lifecycle, compatibility, and persistence tests | For deterministic validation before browser verification. |
| Existing Playwright + Clerk setup | Repository-pinned | Authenticated `/agents` and end-to-end target-flow verification | For proving creation/edit/lifecycle plus backward-compatible Company/Persona runs. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Existing Drizzle migration/push workflow | Persist schema changes | Use the repository's established additive Neon-safe approach. |
| Existing build/typecheck/scope gates | Release verification | Application source remains unchanged during this milestone's planning work. |

## Installation

No new packages are recommended for v1.8 planning. Reuse the repository's existing dependencies and execution seams.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Existing in-house executor and Firecrawl seam | Exa Agent API | Only if a future milestone explicitly approves a new provider and its credential/policy boundary. |
| Relational immutable versions | Mutable JSON blob per agent | Only for a disposable prototype; it obscures version identity and weakens run reproducibility. |
| Server-derived compatibility and schema validation | Client-only validation | Never for runnable configuration; client checks may improve UX but cannot be the authority. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| A runtime Exa dependency in v1.8 | v1.7 explicitly locks execution to the in-house modelFactory and Firecrawl stack; adding Exa would reopen a deferred provider decision. | Apply the Exa research pattern conceptually while preserving the existing executor boundary. |
| Arbitrary tool/provider selection in the constructor | It leaks infrastructure and security policy into user-authored configuration. | Server-owned capabilities and allowlisted execution compatibility. |
| Unbounded output schemas or arrays | Cost, latency, validation, and evidence review become unpredictable. | Bounded, shallow, versioned configuration with explicit limits. |

## Stack Patterns by Variant

**If the custom agent targets a Company or Persona:**
- Reuse the target-specific v1.7 input, active-signal checklist, evidence, review, and candidate contracts.
- Reject incompatible target/configuration combinations before a run is created.

**If the custom agent needs structured output:**
- Store behavior instructions separately from output-shape configuration.
- Normalize and validate the schema server-side, require only essential fields, and bound arrays where arrays are allowed.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| Existing Next.js App Router | Existing Clerk/Neon/Drizzle stack | Matches v1.7 route, Server Action, and database patterns. |
| Existing Vitest | Existing Playwright e2e harness | Keep deterministic DB/workflow fixtures separate from authenticated browser evidence, as Phase 36 requires. |

## Sources

- [Exa Agent API guide](https://exa.ai/docs/reference/agent-api-guide) — structured output, grounding, data sources, effort, run lifecycle, and bounded arrays.
- [Exa Create a Run reference](https://exa.ai/docs/reference/agent-api/create-a-run) — `query`, `systemPrompt`, `outputSchema`, `effort`, `dataSources`, lifecycle statuses, and validation errors.
- [Exa Agent overview](https://exa.ai/docs/reference/agent-api/overview) — asynchronous run model, resumability, lifecycle, structured output, and grounding.
- [Exa Connect overview](https://exa.ai/docs/reference/agent-api/connect/overview) — provider-specific tool selection from schema/query descriptions and separate grounded sources.
- Exa Agent Playground URL supplied in the milestone brief — redirected to Exa login; builder controls were not observable without credentials.

---
*Stack research for: custom structured-research agent constructors*
*Researched: 2026-08-09*
