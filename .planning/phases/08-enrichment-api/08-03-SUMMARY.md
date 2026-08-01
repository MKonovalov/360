---
phase: 08-enrichment-api
plan: 03
status: complete
requirements-completed: ["ENRC-01", "ENRC-05"]
---

# Plan 08-03 Summary — Apollo client (apollo.ts)

## What was done
- `src/lib/enrichment/apollo.ts`: `enrichOrganization(domain)` (GET `/organizations/enrich`) and `enrichPerson(email)` (POST `/people/match`), both returning the discriminated `EnrichmentResult = { ok:true; fields } | { ok:false; reason }`.
- Diverges from `arcpedia.ts` (Pitfall 5): never returns `[]`-on-failure, distinguishes failure reasons (`not_configured`, `no_match_key`, `no_match`, `http_<status>`, `network`), and logs **metadata only** (`kind`, `ok`, `status`) — never the response body / caught error / PII.
- HTTP 200 ≠ success: inspects `.organization` / `.person` in the payload (permissive `.passthrough()` Zod) before declaring `ok`; absent object or zero mapped fields → `no_match`.
- Unset `APOLLO_API_KEY` → `not_configured` with no network call. `X-Api-Key` header, `AbortSignal.timeout(10000)`, `normalizeDomain`/`normalizeEmail` reused for match keys. No `reveal_*` params (avoids extra PII).

## Verification
- `npx tsc --noEmit` → clean
- `npx vitest run` → 122/122 (no regression)
- grep confirms `no_match`/`not_configured`/`X-Api-Key` present; no body/error logging.

## Files changed
- `src/lib/enrichment/apollo.ts` (new)
