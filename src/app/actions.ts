'use server';

import { requireStaffAccess } from '../lib/auth/requireStaffAccess';
import { listCompanies } from '../lib/db/queries/companies';
import { recordView as recordViewQuery } from '../lib/db/queries/recentlyViewed';

// T-1-01: requireStaffAccess() is called FIRST, before any DB access — this
// is the walking skeleton's proof that Server Actions are gated
// independently of page-level checks, not just protected by the page that
// happens to render the trigger button.
export async function refreshCompanyCount() {
  await requireStaffAccess();
  return (await listCompanies()).length;
}

// D-04/T-06-01/T-06-02: same pattern as refreshCompanyCount —
// requireStaffAccess() first, before any DB write. userId is derived
// exclusively from the server-verified Clerk session, never accepted as a
// parameter — a direct caller cannot spoof another user's recentlyViewed row.
export async function recordView(recordType: 'company' | 'persona', recordId: number) {
  const { userId } = await requireStaffAccess();
  await recordViewQuery({ userId, recordType, recordId });
}
