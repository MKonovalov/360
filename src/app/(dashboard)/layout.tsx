import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { debugAdminConfig } from '@/lib/auth/debugAdminConfig';
import { AppShellLayout } from '@/components/layout/app-shell-layout';
import { DebugLaunchPreferenceProvider } from '@/components/analysis/debug-launch-preference-provider';

// Mirrors companies/layout.tsx's post-refactor shape exactly (D-01/D-02) —
// this auth gate covers the entire (dashboard) route group, and the shared
// AppShellLayout puts the Start Page inside the same AppSidebar shell as
// /companies and /personas.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await requireStaffAccess();
  const canUseDebugLaunches =
    debugAdminConfig.captureEnabled
    && userId !== null
    && debugAdminConfig.adminUserIds.includes(userId);

  return (
    <DebugLaunchPreferenceProvider
      key={canUseDebugLaunches ? 'debug-enabled' : 'debug-disabled'}
      canUseDebugLaunches={canUseDebugLaunches}
    >
      <AppShellLayout>{children}</AppShellLayout>
    </DebugLaunchPreferenceProvider>
  );
}
