import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { AppShellLayout } from '@/components/layout/app-shell-layout';

// Mirrors companies/layout.tsx's shape exactly (D-01/D-02) — this auth gate
// covers the entire (dashboard) route group, and the shared AppShellLayout
// puts the Start Page inside the same AppSidebar shell as /companies and
// /personas. The DebugLaunchPreferenceProvider mounts once at the true app
// root (src/app/layout.tsx) instead of here, since (dashboard) is a sibling
// route tree to /companies and /personas, not their ancestor — see
// src/app/layout.tsx and layout.test.tsx for the shared-boundary rationale.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireStaffAccess();

  return <AppShellLayout>{children}</AppShellLayout>;
}
