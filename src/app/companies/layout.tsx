import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { AppShellLayout } from '@/components/layout/app-shell-layout';

// This auth gate covers the entire /companies subtree (including the
// [id] detail route Plan 03 adds later) — centralizing the check here
// means no future route under this layout can accidentally skip it
// (Pitfall 4 in 02-RESEARCH.md).
export default async function CompaniesLayout({ children }: { children: React.ReactNode }) {
  await requireStaffAccess();

  return <AppShellLayout>{children}</AppShellLayout>;
}
