'use server';

import { requireStaffAccess } from '../lib/auth/requireStaffAccess';
import { listCompanies } from '../lib/db/queries/companies';

// T-1-01: requireStaffAccess() is called FIRST, before any DB access — this
// is the walking skeleton's proof that Server Actions are gated
// independently of page-level checks, not just protected by the page that
// happens to render the trigger button.
export async function refreshCompanyCount() {
  await requireStaffAccess();
  return (await listCompanies()).length;
}
