// Registers Clerk's session-cookie check so every request has auth state
// available downstream. This is a fast, non-authoritative first pass only —
// requireStaffAccess() at the data-access boundary is the authoritative gate
// (Clerk's own guidance: middleware alone doesn't guarantee coverage for
// Server Actions/Route Handlers invoked directly).
import { clerkMiddleware } from '@clerk/nextjs/server'; export default clerkMiddleware();

export const config = {
  matcher: [
    '/((?!_next|.*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico)).*)',
    '/(api|trpc)(.*)',
  ],
};
