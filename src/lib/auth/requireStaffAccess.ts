import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

// D-08: any signed-in Clerk user = staff, no roles/claims check in Phase 1.
// Centralized here so a future role/claim check (post-milestone-1, see
// PROJECT.md's re-examination note) is a one-file change. This is the ONLY
// function in the codebase allowed to make a gating (redirect-on-fail)
// auth decision — every protected Server Component/Server Action/Route
// Handler must call this instead of inlining an auth() check.
export async function requireStaffAccess() {
  const { userId } = await auth(); // auth() is async under @clerk/nextjs — always await it
  if (!userId) {
    redirect('/sign-in');
  }
  return { userId };
}
