import { clerkMiddleware } from '@clerk/astro/server';

// Registers Clerk's auth middleware so Astro.locals.auth() is populated on
// every request (server output). Without this file, Clerk does NOT auto-wire
// the middleware and locals.auth is undefined.
export const onRequest = clerkMiddleware();
