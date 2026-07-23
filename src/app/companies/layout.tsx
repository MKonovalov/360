import { cookies } from 'next/headers';
import { requireStaffAccess } from '@/lib/auth/requireStaffAccess';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { SidebarResizeHandle } from '@/components/layout/sidebar-resize-handle';

const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 400;
const DEFAULT_SIDEBAR_WIDTH = 256; // shadcn's stock --sidebar-width (16rem)

// This auth gate covers the entire /companies subtree (including the
// [id] detail route Plan 03 adds later) — centralizing the check here
// means no future route under this layout can accidentally skip it
// (Pitfall 4 in 02-RESEARCH.md).
export default async function CompaniesLayout({ children }: { children: React.ReactNode }) {
  await requireStaffAccess();

  const cookieStore = await cookies();
  const rawWidth = Number(cookieStore.get('sidebar_width')?.value);
  const sidebarWidth =
    Number.isFinite(rawWidth) && rawWidth >= MIN_SIDEBAR_WIDTH && rawWidth <= MAX_SIDEBAR_WIDTH
      ? rawWidth
      : DEFAULT_SIDEBAR_WIDTH;

  return (
    <SidebarProvider style={{ '--sidebar-width': `${sidebarWidth}px` } as React.CSSProperties}>
      <AppSidebar />
      <SidebarResizeHandle />
      <SidebarInset>
        <SidebarTrigger />
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
