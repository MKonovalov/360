# 360.arclumenpartners.com — staff short-link landing

Stack: Astro (SSR) + Clerk Auth + Sanity CMS + Tailwind CSS, deployed to Vercel.

## Why this exists
HubSpot auto-links URL-shaped strings in contact properties, so clicking the
short URL opens a browser tab. We instead redirect staff (anyone signed into
Clerk on `*.arclumenpartners.com`) to this 360 viewer. Anonymous visitors are
untouched and stay anonymous — `go.` only *reads* Clerk's `__session` cookie,
it never writes one.

## Detection (the `go.` side — separate service)
`go.arclumenpartners.com` verifies the Clerk `__session` cookie (scoped to the
root domain via Clerk Dashboard) and redirects:

```js
import { verifyToken } from '@clerk/backend';

app.get('/l/:code', async (req, res) => {
  const code = req.params.code;
  const token = req.cookies['__session']; // absent for anonymous visitors
  let isStaff = false;
  if (token) {
    try {
      await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });
      isStaff = true;
    } catch { isStaff = false; }
  }
  // NOTE: never set a cookie here -> visitors stay anonymous
  return res.redirect(isStaff
    ? `https://360.arclumenpartners.com/l/${code}`
    : `${NORMAL_DEST}${code}`);
});
```

## Prereqs already done
- [x] Clerk Dashboard: domain set to root `arclumenpartners.com`, subdomains
      `360` and `go` registered, so `__session` is issued on `.arclumenpartners.com`.

## Verify the cookie scope (do this once)
1. Sign in at 360.arclumenpartners.com.
2. DevTools -> Application -> Cookies -> `360.arclumenpartners.com`.
3. The `__session` cookie's Domain MUST show `.arclumenpartners.com`
   (leading dot). If it shows `360.arclumenpartners.com`, `go.` will never
   receive it and every click goes to the normal destination.

## Local dev
```
cp .env.example .env   # fill real keys
npm install
npm run dev
```

## Deploy (Vercel)
1. Push to GitHub, import repo in Vercel (Astro preset).
2. Add env vars from .env.example.
3. Add custom domain `360.arclumenpartners.com` + SSL.
4. Sanity schema: a `shortLink` document with `code` (string, unique),
   `title`, `targetUrl`, optional `contactName`.
