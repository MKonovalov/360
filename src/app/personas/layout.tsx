import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { AppShellLayout } from '@/components/layout/app-shell-layout';

// This auth gate covers the entire /personas subtree (including the
// [id] detail route Plan 03 adds later) — centralizing the check here
// means no future route under this layout can accidentally skip it
// (mirrors CompaniesLayout's Pitfall 4 rationale from 02-RESEARCH.md).
export default async function PersonasLayout({ children }: { children: React.ReactNode }) {
  await requireStaffAccess();

  return <AppShellLayout>{children}</AppShellLayout>;
}
