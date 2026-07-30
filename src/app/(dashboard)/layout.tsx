import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { AppShellLayout } from '@/components/layout/app-shell-layout';

// Mirrors companies/layout.tsx's post-refactor shape exactly (D-01/D-02) —
// this auth gate covers the entire (dashboard) route group, and the shared
// AppShellLayout puts the Start Page inside the same AppSidebar shell as
// /companies and /personas.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireStaffAccess();

  return <AppShellLayout>{children}</AppShellLayout>;
}
