# Spec: `go.` short-link redirect service (ArcLumen) — REVISED

## Why this revision
The original design had `go.` read Clerk's `__session` cookie to detect staff.
That is **impossible**. Clerk scopes `__session` strictly to the app's
subdomain (`360.arclumenpartners.com`), host-only, with no Dashboard/SDK/instance
setting to broaden it to `.arclumenpartners.com`. Confirmed by Clerk's own docs
(`/guides/how-clerk-works/overview`) and a live cookie dump: a fresh sign-in on
`360.` yields `__session` Domain = `360.arclumenpartners.com` (host-only). A
sibling subdomain (`go.`) can neither read it server-side nor via
`document.cookie` (both are origin-scoped). So staff detection MUST occur on
`360.`, where the cookie lives.

## Corrected architecture
HubSpot short URL = `https://go.arclumenpartners.com/l/CODE`

```
go.   (thin redirector — reads/sets NO cookie)
  │  302 → https://360.arclumenpartners.com/bridge?code=CODE
  ▼
360./bridge   (same origin as __session → can read auth)
  ├─ userId present (staff)  → 302 → /l/CODE     (internal viewer)
  └─ no userId (visitor)     → Sanity code→targetUrl → 302 → targetUrl
```

- Staff land on the 360 viewer. Visitors go straight to the real destination.
- `go.` never sets a cookie → visitors stay anonymous to `go.`.
  (Visitors load a 360 page momentarily for the redirect; that's our own app,
  no PII, acceptable.)

## `go.` service (this repo — Claude Code task)
A minimal redirector. It does NOT need Clerk or Sanity. Single route:

```
GET /l/:code  →  302  Location: https://360.arclumenpartners.com/bridge?code=<code>
```

Optional env (so the target isn't hardcoded):
`TARGET_BASE=https://360.arclumenpartners.com`

Files:
```
go-arclumen/
  package.json          # type:module, scripts: dev / build / start
  tsconfig.json
  vercel.json           # { "buildCommand": "npm run build", "framework": null }
  .gitignore            # .env, .env.*, node_modules/, .vercel/
  src/index.ts          # one route: 302 → TARGET_BASE/bridge?code=:code
  README.md
```

Pin Node 20 (see "Node runtime" below) — same trap as the 360 build.

## `360.` changes (already implemented in MKonovalov/360)
- `src/pages/bridge.astro`: the brain (staff → /l/CODE, visitor → targetUrl).
- `src/pages/l/[code].astro`: staff viewer (unchanged, works).

## Deploy
- `go.`: new repo `MKonovalov/go`, Vercel import (framework = Other), custom
  domain `go.arclumenpartners.com` (Cloudflare CNAME → `cname.vercel-dns.com`,
  grey cloud / DNS-only). No Clerk/Sanity keys required — it only forwards.
- `360.`: already deployed; bridge page added and redeployed.

## Node runtime (carried from the 360 build — do not rediscover)
Local Node 22 makes Vercel emit a rejected `nodejs18.x` runtime. Pin
`package.json` → `"engines": { "node": "20.x" }` and deploy with
`vercel deploy --prebuilt --prod` after a local build under Node 20
(`nvm use 20`). Do NOT rely on Vercel auto-detecting from a Node 22 shell.

## Verification checklist
- [ ] `go.` GET `/l/CODE` → 302 `Location: https://360.arclumenpartners.com/bridge?code=CODE`
- [ ] `go.` response has **NO `Set-Cookie`** header (visitor anonymity).
- [ ] `360./bridge?code=KNOWN` as staff → 302 → `/l/KNOWN`.
- [ ] `360./bridge?code=KNOWN` as visitor → 302 → `targetUrl` (from Sanity).
- [ ] `360./bridge?code=UNKNOWN` → 302 → `/` (safe fallback, no invented URL).
- [ ] DevTools: `__session` on `360.` is host-only — this is EXPECTED, not a bug.

## Hard constraints
1. `go.` MUST NOT read or set cookies (visitor anonymity to `go.`).
2. Staff detection lives on `360.` (bridge), never on `go.` (Clerk cookie is
   host-only — no override exists).
3. 302, not 301 (keep redirects mutable).
4. Same root domain `arclumenpartners.com` so `360.`'s cookie is usable by
   `360.`'s own bridge.
5. Pin Node 20.

## Out of scope
- Clerk Satellite domains (heavier cross-domain SSO; needs paid plan). Only if
  the bridge's "visitors touch a 360 page" hop is unacceptable.
- Analytics/logging on `go.` (would risk de-anonymizing visitors).
