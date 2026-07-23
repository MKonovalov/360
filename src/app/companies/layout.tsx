import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/app-sidebar';

// This auth gate covers the entire /companies subtree (including the
// [id] detail route Plan 03 adds later) — centralizing the check here
// means no future route under this layout can accidentally skip it
// (Pitfall 4 in 02-RESEARCH.md).
export default async function CompaniesLayout({ children }: { children: React.ReactNode }) {
  await requireStaffAccess();

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SidebarTrigger />
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
