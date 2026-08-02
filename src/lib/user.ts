// Display helpers for the sidebar user zone (BRND-02). Every Clerk display
// field is individually nullable and often unset for email/social sign-ins,
// so the fallback chain is the regression lock — a null field must never
// render a blank row. The Clerk types package is not directly resolvable,
// so the param is a local structural interface matching only the fields the
// display logic reads.

export interface UserDisplayFields {
  username: string | null;
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  primaryEmailAddress: { emailAddress: string } | null;
}

export function getUserDisplayName(user: UserDisplayFields): string {
  return (
    user.username ??
    user.fullName ??
    user.primaryEmailAddress?.emailAddress ??
    'User'
  );
}

export function getUserInitials(user: UserDisplayFields): string {
  const first = user.firstName?.trim();
  const last = user.lastName?.trim();
  if (first || last) return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase();
  const email = user.primaryEmailAddress?.emailAddress;
  if (email) return email.slice(0, 2).toUpperCase();
  return 'A';
}
